/**
 * Validation for the publish gate.
 *
 * Two independent passes, per the PDP publishing order:
 *
 *   validateSource(...)  — is the editable Figma structure coherent?
 *   validateOutput(...)  — does the translated CSS match what the apps expect?
 *
 * Both return structured issues rather than throwing, so the Studio can render
 * one error per token with a reason the editor can act on.
 *
 * Design note: severity 'error' blocks publishing; 'warning' does not. The
 * split matters — a token that exists in generated CSS but is unreferenced by
 * source can safely disappear, while one the source references cannot.
 */
import { aliasBrand, canonicalBrandKey, normalizeBrandPath, pathToCssVar } from './naming.ts';
import type { CompatAliasMap } from './compat.ts';
import type { FlatTokens, StoredToken } from './types.ts';

/**
 * 'error'   blocks publishing.
 * 'warning' publishes, but the editor is told.
 * 'info'    publishes silently into the report — used for the "new tokens the
 *           frontend does not consume yet" bucket, which is expected during a
 *           redesign and must not read as a problem.
 */
export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: Severity;
  /** Stable machine-readable code, e.g. 'alias.foreign-brand'. */
  code: string;
  /** The Figma token path or CSS variable the issue concerns. */
  subject: string;
  message: string;
  /** Extra context — referencing files, expected values, etc. */
  detail?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const ok = (issues: ValidationIssue[]): ValidationResult => ({
  ok: !issues.some((i) => i.severity === 'error'),
  issues,
});

// ── Source validation ─────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['color', 'number', 'string', 'boolean']);

/** Alias targets must address one of the three Foundation roots. */
const VALID_ALIAS_ROOTS = ['brand/', 'shared/', 'scale/'];

export interface SourceValidationInput {
  /** The tenant's semantic token set, flattened. */
  theme: FlatTokens;
  /** Raw Figma brand key this tenant owns, e.g. "bookit" or "🔴tria". */
  brandKey: string;
  /**
   * Every variable name defined by the Foundation collection, e.g.
   * "brand/bookit/color/slate/900". When supplied, alias targets are checked
   * for existence; when omitted that check is skipped rather than guessed.
   */
  foundationNames?: Set<string>;
}

export function validateSource({ theme, brandKey, foundationNames }: SourceValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const emittedVars = new Map<string, string>();

  for (const [path, token] of Object.entries(theme)) {
    const alias = token.$extensions?.['com.figma.aliasData']?.targetVariableName;

    if (!VALID_TYPES.has(token.$type)) {
      issues.push({
        severity: 'error',
        code: 'token.bad-type',
        subject: path,
        message: `Unsupported token type "${token.$type}".`,
        detail: `Expected one of: ${[...VALID_TYPES].join(', ')}.`,
      });
    }

    if (token.$value === undefined || token.$value === null || token.$value === '') {
      issues.push({
        severity: 'error',
        code: 'token.empty-value',
        subject: path,
        message: 'Token has no value.',
        detail: 'Set a value in Figma, or remove the variable. Empty strings are not a way to unset a token.',
      });
    }

    if (token.$value === 'String value') {
      issues.push({
        severity: 'error',
        code: 'token.figma-placeholder',
        subject: path,
        message: 'Token still holds the Figma placeholder "String value".',
        detail: 'This variable was created but never given a value.',
      });
    }

    if (token.$type === 'color' && !alias) {
      const value = token.$value as { hex?: string };
      if (!value || typeof value !== 'object' || !value.hex) {
        issues.push({
          severity: 'error',
          code: 'color.no-hex',
          subject: path,
          message: 'Colour token has neither an alias nor a hex value.',
        });
      }
    }

    if (alias) {
      if (!VALID_ALIAS_ROOTS.some((r) => alias.startsWith(r))) {
        issues.push({
          severity: 'error',
          code: 'alias.bad-root',
          subject: path,
          message: `Alias target "${alias}" does not point into the Foundation collection.`,
          detail: `Expected it to start with one of: ${VALID_ALIAS_ROOTS.join(', ')}.`,
        });
      }

      // The load-bearing rule. Brand-scoped aliases have their `brand/<x>/`
      // prefix stripped at emit time, because each tenant's primitives are
      // written unprefixed into that tenant's own :root. So a token pointing
      // at another brand emits a var() that resolves against THIS tenant's
      // primitives — same name, different colour. It renders, it just renders
      // wrong, which is why this has to be an error and not a warning.
      const brand = aliasBrand(alias);
      if (brand && canonicalBrandKey(brand) !== canonicalBrandKey(brandKey)) {
        // Publishing emits the token's baked value as a constant, so the colour
        // is correct — what's lost is the live link to the other brand's
        // palette: a later change there will not reach this tenant.
        const hasBaked = token.$value !== undefined && token.$value !== null;
        issues.push({
          severity: hasBaked ? 'warning' : 'error',
          code: 'alias.foreign-brand',
          subject: path,
          message: hasBaked
            ? `Points at brand "${brand}", not "${brandKey}" — publishing the fixed value Figma shows.`
            : `Aliases into brand "${brand}" but this theme belongs to "${brandKey}", and no value is baked in to fall back on.`,
          detail: hasBaked
            ? `The colour published is correct today, but it is frozen: if "${brand}" changes this colour in Figma, ` +
              `"${brandKey}" will not follow. Re-point it at a ${brandKey} primitive in Figma to keep them linked.`
            : `Re-point this variable at a ${brandKey} primitive in Figma.`,
        });
      }

      if (foundationNames && !foundationNames.has(alias) && !foundationNames.has(normalizeBrandPath(alias))) {
        // The export bakes the final value alongside the alias, so a missing
        // target is survivable: we publish the baked value and flag the gap.
        const hasBakedValue = token.$value !== undefined && token.$value !== null;
        issues.push({
          severity: hasBakedValue ? 'warning' : 'error',
          code: hasBakedValue ? 'alias.unresolved-fallback' : 'alias.unresolved',
          subject: path,
          message: hasBakedValue
            ? `Alias target "${alias}" is not in the stored Foundation export — publishing the baked value instead.`
            : `Alias target "${alias}" does not exist in the Foundation collection.`,
          detail: hasBakedValue
            ? 'The Foundation export in the CMS is older than this brand export. Re-export 📐 Foundation · Breakpoint from Figma and import it to restore the link.'
            : 'The variable was probably renamed or deleted in Figma. Re-link it.',
        });
      }
    }

    // Two Figma paths can slugify to the same CSS variable (e.g. "text+icons"
    // vs "text-icons"). First wins at emit time, so the second is dead weight.
    const cssVar = pathToCssVar(path.split('.'));
    const previous = emittedVars.get(cssVar);
    if (previous && previous !== path) {
      issues.push({
        severity: 'warning',
        code: 'token.duplicate-var',
        subject: path,
        message: `Collides with "${previous}" — both produce ${cssVar}.`,
        detail: 'Only the first is emitted. Rename one in Figma to remove the ambiguity.',
      });
    } else if (!previous) {
      emittedVars.set(cssVar, path);
    }
  }

  if (Object.keys(theme).length === 0) {
    issues.push({
      severity: 'error',
      code: 'theme.empty',
      subject: brandKey,
      message: 'Theme contains no tokens.',
    });
  }

  return ok(issues);
}

// ── Output validation ─────────────────────────────────────────────────────────

/** Which generated layer publishes a token. */
export type TokenLayer = 'shared' | 'scale' | 'foundation' | 'theme';

export interface TokenManifest {
  /** CMS-owned and referenced by source — absence breaks styling. */
  required: string[];
  /** CMS-owned but unreferenced — absence is survivable. */
  known: string[];
  /** Referenced but not CMS-owned (shadcn, legacy spree-pay). Never checked. */
  external?: string[];
  /** token → the layer responsible for publishing it. */
  layer?: Record<string, TokenLayer>;
  /** token → files that reference it, for actionable errors. */
  usage?: Record<string, string[]>;
}

export interface OutputValidationInput {
  /** Flat `--var` → value map produced by the translator. */
  variables: Record<string, string>;
  manifest: TokenManifest;
  /**
   * Restrict the required/known checks to tokens this document is responsible
   * for. Validating a tenant theme against shared-layer tokens would report
   * every `--shared-*` as missing, since a different document publishes those.
   */
  layers?: TokenLayer[];
  /**
   * Variables defined outside this document — the other layers' output. Used
   * to prove every var() reference resolves somewhere.
   */
  externalVariables?: Set<string>;
  /**
   * Old → new variable mappings emitted as a compatibility block. A required
   * token that is missing but covered by a live alias is a warning, not a
   * block: the frontend still resolves it.
   */
  compatAliases?: CompatAliasMap;
}

/**
 * Validate the translated output against the structure the apps expect.
 *
 * This is the check that would have caught the Figma `control` restructure:
 * the new export renames `--color-control-primary-bg-default` to
 * `--color-control-primary-filled-bg-default`, and 12 source files still
 * reference the old name.
 */
export function validateOutput({
  variables,
  manifest,
  layers,
  externalVariables,
  compatAliases,
}: OutputValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const defined = new Set(Object.keys(variables));

  /** Is this document on the hook for publishing `token`? */
  const inScope = (token: string): boolean => {
    if (!layers) return true;
    const owner = manifest.layer?.[token];
    // An unclassified token has no owner we can identify; checking it here
    // would pin another layer's gap on this document.
    return owner !== undefined && layers.includes(owner);
  };

  for (const token of manifest.required) {
    if (defined.has(token) || !inScope(token)) continue;
    const users = manifest.usage?.[token] ?? [];
    const where = users.length
      ? `Referenced in ${users.length} file(s): ${users.slice(0, 5).join(', ')}${users.length > 5 ? ', …' : ''}.`
      : '';

    // A live compatibility alias means the frontend still resolves this name,
    // so the rename is survivable — surface it as migration debt rather than
    // blocking every other token change behind it.
    const alias = compatAliases?.[token];
    if (alias && defined.has(alias.to)) {
      issues.push({
        severity: 'warning',
        code: 'output.aliased-required',
        subject: token,
        message: `Renamed to ${alias.to}; kept working by a compatibility alias.`,
        detail: [where, 'Update the frontend to the new name, then remove the alias.', alias.reason]
          .filter(Boolean)
          .join(' '),
      });
      continue;
    }

    issues.push({
      severity: 'error',
      code: 'output.missing-required',
      subject: token,
      message: 'Referenced by application source but absent from the translated output.',
      detail: [
        where,
        'Either restore the token in Figma, add a compatibility alias, or update the frontend before publishing.',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  // New vocabulary that design has shipped ahead of code. Expected during a
  // redesign — recorded so it is visible, never treated as a fault.
  const expected = new Set([...manifest.required, ...manifest.known, ...(manifest.external ?? [])]);
  const unmapped = [...defined].filter((token) => !expected.has(token) && !compatAliases?.[token]);
  if (unmapped.length > 0) {
    issues.push({
      severity: 'info',
      code: 'output.unmapped',
      subject: `${unmapped.length} new token(s)`,
      message: 'Published but not yet referenced by any application source.',
      detail:
        `${unmapped.slice(0, 8).join(', ')}${unmapped.length > 8 ? `, … ${unmapped.length - 8} more` : ''}. ` +
        'These are available to the frontend now — no action needed unless you expected them to be in use.',
    });
  }

  for (const token of manifest.known) {
    if (!defined.has(token) && inScope(token)) {
      issues.push({
        severity: 'warning',
        code: 'output.missing-known',
        subject: token,
        message: 'Previously generated but no longer produced. No source references it, so this is likely intentional.',
      });
    }
  }

  const resolvable = new Set([...defined, ...(externalVariables ?? [])]);
  for (const [name, value] of Object.entries(variables)) {
    if (value.trim() === '' || value === 'undefined' || value === 'null') {
      issues.push({
        severity: 'error',
        code: 'output.empty-value',
        subject: name,
        message: `Resolved to "${value}".`,
      });
      continue;
    }

    if (value === `var(${name})`) {
      issues.push({
        severity: 'error',
        code: 'output.self-reference',
        subject: name,
        message: 'Resolves to itself, which breaks the cascade.',
      });
      continue;
    }

    // Only check references when we were told what exists elsewhere;
    // otherwise every foundation reference would look dangling.
    if (!externalVariables) continue;
    for (const match of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!resolvable.has(match[1])) {
        issues.push({
          severity: 'error',
          code: 'output.dangling-reference',
          subject: name,
          message: `References ${match[1]}, which is not defined by any published token set.`,
          detail: 'The property will fall back to its initial value at runtime — usually invisible in review.',
        });
      }
    }
  }

  return ok(issues);
}

/** Merge several results, preserving order. */
export function combine(...results: ValidationResult[]): ValidationResult {
  return ok(results.flatMap((r) => r.issues));
}

export function formatIssues(result: ValidationResult, limit = 20): string {
  if (result.issues.length === 0) return 'No issues.';
  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const infos = result.issues.filter((i) => i.severity === 'info');
  const lines = [`${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} note(s)`, ''];
  for (const issue of [...errors, ...warnings, ...infos].slice(0, limit)) {
    lines.push(`  [${issue.severity}] ${issue.code} — ${issue.subject}`);
    lines.push(`      ${issue.message}`);
    if (issue.detail) lines.push(`      ${issue.detail}`);
  }
  if (result.issues.length > limit) lines.push(`  … ${result.issues.length - limit} more`);
  return lines.join('\n');
}


// ── Foundation staleness ─────────────────────────────────────────────────────

/**
 * The Theme · Brand export bakes each token's final value alongside its alias.
 * When a designer changes a *primitive* in Figma and re-exports only the brand
 * file, the baked values disagree with the primitives stored in the CMS — the
 * classic way stale colors ship while everything looks green.
 *
 * This compares every brand-aliased theme token's baked value against the
 * stored desktop primitive it points at, and reports disagreements.
 */
export interface PrimitiveDriftInput {
  /** The tenant's semantic tokens, as stored. */
  theme: StoredToken[];
  /** The tenant's desktop primitives, as stored (paths like "brand.x.color.slate.900"). */
  primitives: StoredToken[];
}

function driftValuesEqual(a: string, b: string): boolean {
  let va: unknown, vb: unknown;
  try { va = JSON.parse(a); vb = JSON.parse(b); } catch { return a === b; }
  const isColor = (v: unknown): v is { hex?: string; alpha?: number } =>
    !!v && typeof v === 'object' && 'hex' in (v as object);
  if (isColor(va) && isColor(vb)) {
    const alpha = (v: { alpha?: number }) => Math.round(((v.alpha ?? 1) as number) * 1000);
    return (va.hex ?? '').toLowerCase() === (vb.hex ?? '').toLowerCase() && alpha(va) === alpha(vb);
  }
  if (typeof va === 'number' && typeof vb === 'number') return va === vb;
  if (typeof va === 'string' && typeof vb === 'string') return va === vb;
  return JSON.stringify(va) === JSON.stringify(vb);
}

function driftShort(v: string): string {
  try {
    const parsed = JSON.parse(v);
    if (parsed && typeof parsed === 'object' && 'hex' in parsed) {
      const alpha = (parsed as { alpha?: number }).alpha ?? 1;
      return alpha >= 0.999 ? (parsed as { hex: string }).hex : `${(parsed as { hex: string }).hex} @ ${Math.round(alpha * 100)}%`;
    }
    return String(parsed);
  } catch { return v; }
}

export function validatePrimitiveDrift({ theme, primitives }: PrimitiveDriftInput): ValidationIssue[] {
  const byFigmaName = new Map<string, StoredToken>();
  for (const p of primitives) byFigmaName.set(p.path.split('.').join('/'), p);
  if (byFigmaName.size === 0) return [];

  const issues: ValidationIssue[] = [];
  for (const token of theme) {
    const target = token.aliasTarget;
    if (!target || !target.startsWith('brand/')) continue;
    const primitive = byFigmaName.get(target);
    if (!primitive) continue; // a missing primitive is source validation's job
    if (!driftValuesEqual(token.value, primitive.value)) {
      issues.push({
        severity: 'warning',
        code: 'source.primitive-drift',
        subject: target,
        message: `STALE FOUNDATION: the brand file says ${driftShort(token.value)}, but the stored primitive is ${driftShort(primitive.value)} — publishing uses the older value.`,
        detail:
          'The Foundation export in the CMS is older than this brand export. In Figma, re-export ' +
          'the Foundation · Breakpoint collection, import it with "Import Foundation", publish Foundation tokens, then publish this theme.',
      });
    }
  }
  return issues;
}
