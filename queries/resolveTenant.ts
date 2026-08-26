/**
 * The resolved tenant API.
 *
 * `resolveTenantBundle` is the single entry point for both apps and for the
 * build-time theme generator. It fetches, merges defaults with overrides,
 * applies visibility, and returns a plain object with no inheritance left in
 * it — satisfying the PDP's "applications should not need to understand tenant
 * inheritance or token translation".
 */
import { resolveSection, type ResolveWarning } from '../lib/resolve/inheritance';
import { TENANT_BUNDLE_QUERY } from './groq';

export interface SanityFetcher {
  fetch<T>(query: string, params?: Record<string, unknown>): Promise<T>;
}

export interface CopyEntry {
  key: string;
  value?: string;
  visible?: boolean;
}

export interface ResolvedTenantBundle {
  tenant: { id: string; title: string; figmaBrandKey: string; domain?: string; enabledProducts?: string[] };
  config: Record<string, unknown>;
  /** Cross-modality content after Universal-default and tenant-override resolution. */
  shared: Record<string, unknown>;
  /** Modality-specific controls after Universal-default and tenant-override resolution. */
  modalities: Record<string, Record<string, unknown>>;
  /** Flattened key → text. Product and page copy are namespaced. */
  copy: Record<string, string>;
  pages: Record<string, unknown>;
  theme: {
    css?: string;
    variables?: Record<string, string>;
    sharedCss?: string;
    scaleCss?: string;
    compiledAt?: string;
    sourceHash?: string;
    status?: string;
    /** Set when some or all of this theme came from the universal default. */
    inheritedFrom?: {
      /** The brand the universal default tracks, e.g. "bookit". */
      tenant: string;
      /** 'all' — this tenant has no theme of its own; 'partial' — only gaps filled. */
      mode: 'all' | 'partial';
      /** How many variables came from the default. */
      inherited: number;
    };
  };
  /** Non-fatal issues found while resolving — surfaced, never thrown. */
  warnings: ResolveWarning[];
}

/** Copy entries → a flat key/value map, dropping anything hidden or unset. */
function entriesToMap(entries: CopyEntry[] | undefined, prefix = ''): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries ?? []) {
    if (!entry?.key || entry.visible === false) continue;
    if (entry.value === undefined || entry.value === null) continue;
    map[prefix ? `${prefix}.${entry.key}` : entry.key] = entry.value;
  }
  return map;
}

export async function resolveTenantBundle(
  client: SanityFetcher,
  tenantSlug: string,
): Promise<ResolvedTenantBundle | null> {
  const raw = await client.fetch<any>(TENANT_BUNDLE_QUERY, { tenant: tenantSlug });
  if (!raw?.tenant) return null;

  const warnings: ResolveWarning[] = [];

  const legacyConfig = resolveSection<Record<string, unknown>>(
    raw.configDefault ?? {},
    raw.configOverrideLegacy ?? {},
  );
  warnings.push(...legacyConfig.warnings);
  const config = resolveSection<Record<string, unknown>>(legacyConfig.value, raw.configOverride ?? {});
  warnings.push(...config.warnings);

  const shared = resolveSection<{ entries?: CopyEntry[]; legal?: unknown[] }>(
    raw.sharedDefault ?? {},
    raw.sharedOverride ?? {},
  );
  warnings.push(...shared.warnings);

  // Product copy: merge per product so a tenant overriding Ticketing copy does
  // not drop the VIP defaults.
  const copy: Record<string, string> = { ...entriesToMap(shared.value?.entries) };
  const modalities: Record<string, Record<string, unknown>> = {};
  const modalityIds = new Set<string>([
    ...(raw.productDefaults ?? []).map((p: any) => p.modality),
    ...(raw.productOverrides ?? []).map((p: any) => p.modality),
  ]);
  for (const modality of modalityIds) {
    if (!modality) continue;
    const base = (raw.productDefaults ?? []).find((p: any) => p.modality === modality);
    const override = (raw.productOverrides ?? []).find((p: any) => p.modality === modality);
    const merged = resolveSection<Record<string, unknown> & { entries?: CopyEntry[] }>(base ?? {}, override ?? {});
    warnings.push(...merged.warnings.map((w) => ({ ...w, path: `${modality}.${w.path}` })));
    Object.assign(copy, entriesToMap(merged.value?.entries, modality));
    const specific = merged.value?.[modality];
    modalities[modality] = {
      ...(specific && typeof specific === 'object' && !Array.isArray(specific)
        ? (specific as Record<string, unknown>)
        : {}),
      entries: merged.value?.entries ?? [],
    };
  }

  // Page content, keyed by application route. Flexible Marketing pages need
  // their slug in the key; otherwise every Marketing page collapses onto the
  // single literal route "marketing/page" and only one survives resolution.
  const pages: Record<string, unknown> = {};
  const pageKey = (page: any): string | undefined => {
    if (!page?.route) return undefined;
    if (page.route !== 'marketing/page') return page.route;
    return page.slug?.current ? `marketing/${page.slug.current}` : undefined;
  };
  const pageKeys = new Set<string>([
    ...(raw.pageDefaults ?? []).map(pageKey),
    ...(raw.pageOverrides ?? []).map(pageKey),
  ]);
  for (const key of pageKeys) {
    if (!key) continue;
    const base = (raw.pageDefaults ?? []).find((p: any) => pageKey(p) === key);
    const override = (raw.pageOverrides ?? []).find((p: any) => pageKey(p) === key);
    const merged = resolveSection<Record<string, unknown>>(base ?? {}, override ?? {});
    warnings.push(...merged.warnings.map((w) => ({ ...w, path: `${key}.${w.path}` })));
    pages[key] = merged.value;
  }

  // ── Theme: universal default + tenant override ───────────────────────────
  // Same rule as every other scoped section — the tenant's own value wins, the
  // default fills the rest. Stored as a JSON string so the document stays a
  // manageable size in the Studio; parsed once here, not by every consumer.
  const own: Record<string, string> | undefined = raw.themeOverride?.variables
    ? JSON.parse(raw.themeOverride.variables)
    : undefined;
  const defaults: Record<string, string> | undefined = raw.themeDefault?.variables
    ? JSON.parse(raw.themeDefault.variables)
    : undefined;
  const tracks: string | undefined = raw.themeDefault?.sourceTenant;

  const theme: ResolvedTenantBundle['theme'] = {
    css: raw.themeOverride?.css,
    variables: own,
    sharedCss: raw.foundation?.sharedCss,
    scaleCss: raw.foundation?.scaleCss,
    compiledAt: raw.themeOverride?.compiledAt,
    sourceHash: raw.themeOverride?.sourceHash,
    status: raw.themeOverride?.status,
  };

  // The brand the default tracks already *is* the default — never inherit onto it.
  const isSourceBrand = tracks && tracks === raw.tenant?.id;
  if (defaults && !isSourceBrand) {
    if (!own || Object.keys(own).length === 0) {
      theme.css = raw.themeDefault.css;
      theme.variables = defaults;
      theme.compiledAt = raw.themeDefault.compiledAt;
      theme.inheritedFrom = { tenant: tracks ?? 'default', mode: 'all', inherited: Object.keys(defaults).length };
      warnings.push({
        path: 'theme',
        code: 'theme-fallback',
        message: `No published theme for "${raw.tenant.id}" — serving the universal default${tracks ? ` (tracks ${tracks})` : ''}.`,
      });
    } else {
      const missing = Object.keys(defaults).filter((name) => own[name] === undefined);
      if (missing.length > 0) {
        theme.variables = { ...own };
        const lines: string[] = [];
        for (const name of missing) {
          theme.variables[name] = defaults[name];
          lines.push(`  ${name}: ${defaults[name]};`);
        }
        // Appended as its own block so the inherited half is obvious in the file.
        theme.css = `${raw.themeOverride?.css ?? ''}\n\n/* ── Inherited from the universal default${tracks ? ` (${tracks})` : ''} ── */\n:root {\n${lines.join('\n')}\n}\n`;
        theme.inheritedFrom = { tenant: tracks ?? 'default', mode: 'partial', inherited: missing.length };
        warnings.push({
          path: 'theme',
          code: 'theme-fallback',
          message: `${missing.length} token(s) not defined by "${raw.tenant.id}" — inherited from the universal default.`,
        });
      }
    }
  }

  return {
    tenant: raw.tenant,
    config: config.value,
    shared: shared.value as Record<string, unknown>,
    modalities,
    copy,
    pages,
    theme,
    warnings,
  };
}

