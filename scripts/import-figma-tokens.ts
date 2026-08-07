/**
 * Import Figma exports into Sanity.
 *
 * Reads the two collections from disk and writes them into the Foundation
 * document and one Brand Theme document per tenant:
 *
 *   <FIGMA_EXPORT_DIR>/foundation/desktop.tokens.json      → foundationTokens.desktop
 *   <FIGMA_EXPORT_DIR>/foundation/wide desktop.tokens.json → foundationTokens.wideDesktop
 *   <FIGMA_EXPORT_DIR>/foundation/tablet.tokens.json       → foundationTokens.tablet
 *   <FIGMA_EXPORT_DIR>/foundation/mobile.tokens.json       → foundationTokens.mobile
 *   <FIGMA_EXPORT_DIR>/theme/<brand>.tokens.json           → brandTheme (per tenant)
 *
 * Import writes DRAFTS only. Nothing reaches the API until someone runs
 * Validate & publish in the Studio, which is the point of the gate — an import
 * is exactly when a bad export is most likely to arrive.
 *
 * The raw export is stored alongside the parsed tokens so nothing from Figma is
 * discarded, including tokens the frontend does not use yet.
 *
 *   npm run tokens:import -- --dir ./figma-exports [--dry-run]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { flattenTokens, resolveValueRefs, toStoredTokens } from '../lib/tokens/flatten.ts';
import { aliasBrand, brandKeyToSlug, canonicalBrandKey } from '../lib/tokens/naming.ts';
import type { FigmaTokenTree } from '../lib/tokens/types.ts';
import { requireSanityEnv } from './lib/env.ts';

const FOUNDATION_ID = 'foundationTokens.singleton';

const BREAKPOINT_FILES: Record<string, string> = {
  desktop: 'desktop.tokens.json',
  wideDesktop: 'wide desktop.tokens.json',
  tablet: 'tablet.tokens.json',
  mobile: 'mobile.tokens.json',
};

interface Args {
  dir: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    dir: get('--dir', process.env.FIGMA_EXPORT_DIR ?? './figma-exports'),
    dryRun: argv.includes('--dry-run'),
  };
}

/** Which brand a theme export belongs to, from its dominant alias prefix. */
function inferBrandKey(tree: FigmaTokenTree): string {
  const counts = new Map<string, number>();
  for (const token of Object.values(flattenTokens(tree))) {
    const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
    const brand = target ? aliasBrand(target) : null;
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

const toTokenSet = (tree: FigmaTokenTree, filename: string) => ({
  _type: 'tokenSet',
  tokens: toStoredTokens(flattenTokens(tree)).map((token) => ({
    _type: 'storedToken',
    // Sanity array items need a stable key; the path is already unique and
    // stable, so reusing it keeps diffs readable across re-imports.
    _key: token.path.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64),
    ...token,
  })),
  sourceJson: JSON.stringify(tree),
  importedAt: new Date().toISOString(),
  importedFilename: filename,
});

async function main(): Promise<void> {
  const { dir, dryRun } = parseArgs();

  const foundationDir = join(dir, 'foundation');
  const themeDir = join(dir, 'theme');

  if (!existsSync(themeDir)) {
    console.error(`No theme exports at ${themeDir}. Pass --dir <path> or set FIGMA_EXPORT_DIR.`);
    process.exit(1);
  }

  let client: { createOrReplace: (doc: any) => Promise<any>; fetch: (q: string, p?: any) => Promise<any> } | null = null;
  if (!dryRun) {
    const { projectId, dataset, token } = requireSanityEnv();
    const { createClient } = await import('@sanity/client');
    client = createClient({ projectId, dataset, apiVersion: '2024-10-01', token, useCdn: false });
    console.log(`Importing into ${projectId} / ${dataset}\n`);
  }

  // ── Foundation — split: shared system → Foundation doc; brand/* → each tenant ──
  const PRIMITIVE_FIELDS: Record<string, string> = {
    desktop: 'primitivesDesktop',
    wideDesktop: 'primitivesWideDesktop',
    tablet: 'primitivesTablet',
    mobile: 'primitivesMobile',
  };
  if (existsSync(foundationDir)) {
    const foundationDoc: Record<string, unknown> = {
      _id: `drafts.${FOUNDATION_ID}`,
      _type: 'foundationTokens',
      title: 'Foundation · Breakpoint',
    };
    const brandSections = new Map<string, Record<string, FigmaTokenTree>>();

    for (const [field, filename] of Object.entries(BREAKPOINT_FILES)) {
      const path = join(foundationDir, filename);
      if (!existsSync(path)) {
        console.log(`  - foundation/${filename} missing — ${field} left empty`);
        continue;
      }
      const tree = JSON.parse(readFileSync(path, 'utf-8')) as FigmaTokenTree & { brand?: Record<string, FigmaTokenTree> };
      const { brand, ...shared } = tree;
      const set = toTokenSet(shared as FigmaTokenTree, filename);
      foundationDoc[field] = set;
      console.log(`  ✓ foundation ${field.padEnd(12)} ${set.tokens.length} shared tokens`);
      for (const [key, sub] of Object.entries(brand ?? {})) {
        if (!brandSections.has(key)) brandSections.set(key, {});
        // Bake cross-section references to literals while the full file is in hand.
        brandSections.get(key)![field] = resolveValueRefs(sub, tree);
      }
    }

    if (!dryRun && client) await client.createOrReplace(foundationDoc);

    // Route each brand's primitives to its tenant document.
    if (!dryRun && client) {
      const tenantRows: Array<{ slug: string; _id: string }> =
        await client.fetch('*[_type == "tenant"]{ "slug": slug.current, _id }');
      // Matched on Tenant ID — see canonicalBrandKey().
      const tenantByKey = new Map(tenantRows.map((t) => [canonicalBrandKey(t.slug ?? ''), t]));
      for (const [key, perBp] of brandSections) {
        const tenant = tenantByKey.get(canonicalBrandKey(key));
        if (!tenant) {
          console.log(`  ! primitives for "${key}" have no tenant — skipped (create the tenant, re-run)`);
          continue;
        }
        const existing =
          (await client.fetch('*[_id == $d][0]', { d: `drafts.brandTheme.${tenant.slug}` })) ??
          (await client.fetch('*[_id == $p][0]', { p: `brandTheme.${tenant.slug}` })) ?? {};
        delete existing._rev;
        const doc: Record<string, unknown> = {
          ...existing,
          _id: `drafts.brandTheme.${tenant.slug}`,
          _type: 'brandTheme',
          tenant: existing.tenant ?? { _type: 'reference', _ref: tenant._id },
        };
        for (const [field, sub] of Object.entries(perBp)) {
          doc[PRIMITIVE_FIELDS[field]] = {
            ...toTokenSet(sub, BREAKPOINT_FILES[field]),
            tokens: toStoredTokens(flattenTokens(sub, ['brand', key])).map((token) => ({
              _type: 'storedToken',
              _key: token.path.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64),
              ...token,
            })),
          };
        }
        await client.createOrReplace(doc);
        console.log(`  ✓ primitives "${key}" → ${tenant.slug}`);
      }
    }
  } else {
    console.log(`  - no foundation/ directory at ${foundationDir} — skipping foundation import`);
  }

  // ── Themes ──
  const tenants: Array<{ slug: string }> = dryRun
    ? []
    : await client!.fetch('*[_type == "tenant"]{ "slug": slug.current }');
  const byBrandKey = new Map(tenants.map((t) => [canonicalBrandKey(t.slug ?? ''), t.slug]));

  for (const file of readdirSync(themeDir).filter((f) => f.endsWith('.tokens.json'))) {
    const tree = JSON.parse(readFileSync(join(themeDir, file), 'utf-8')) as FigmaTokenTree;
    const brandKey = inferBrandKey(tree);
    const set = toTokenSet(tree, file);

    const tenantSlug = byBrandKey.get(canonicalBrandKey(brandKey)) ?? brandKeyToSlug(brandKey);
    if (!byBrandKey.has(canonicalBrandKey(brandKey)) && !dryRun) {
      // Importing a theme for a brand with no tenant would create an orphan
      // document nothing can publish. Report it and move on.
      console.log(`  ! ${file.padEnd(24)} brand "${brandKey}" has no tenant — skipped`);
      continue;
    }

    console.log(`  ✓ ${file.padEnd(24)} → ${tenantSlug} (brand "${brandKey}", ${set.tokens.length} tokens)`);

    if (!dryRun && client) {
      const tenantId = await client.fetch('*[_type == "tenant" && slug.current == $slug][0]._id', { slug: tenantSlug });
      const existing =
        (await client.fetch('*[_id == $d][0]', { d: `drafts.brandTheme.${tenantSlug}` })) ??
        (await client.fetch('*[_id == $p][0]', { p: `brandTheme.${tenantSlug}` })) ?? {};
      delete existing._rev;
      await client.createOrReplace({
        ...existing,
        _id: `drafts.brandTheme.${tenantSlug}`,
        _type: 'brandTheme',
        tenant: existing.tenant ?? { _type: 'reference', _ref: tenantId },
        theme: set,
        compatAliasesEnabled: existing.compatAliasesEnabled ?? true,
      });
    }
  }

  console.log(
    dryRun
      ? '\nDry run — nothing written.'
      : '\nImported as DRAFTS. Open each document in the Studio and use "Validate & publish".',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
