/**
 * Draft compatibility aliases for variables that a new Figma export drops.
 *
 * Compares the committed CSS in superlogic-ui against what the current exports
 * would produce, and proposes a mapping for each variable that disappeared.
 *
 * Output is for REVIEW, not for automatic application. A name that matches is
 * not proof of equivalent meaning — `control/primary/bg` maps to the `filled`
 * variant rather than `outlined` because of what the token means, which no
 * string comparison can know. Paste confirmed entries into
 * `lib/tokens/compat.ts`.
 *
 *   node --experimental-strip-types scripts/propose-compat-aliases.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { flattenTokens } from '../lib/tokens/flatten.ts';
import { aliasBrand } from '../lib/tokens/naming.ts';
import { buildThemeVarLines } from '../lib/tokens/translate.ts';
import { proposeAliases, DEFAULT_COMPAT_ALIASES } from '../lib/tokens/compat.ts';
import type { FigmaTokenTree } from '../lib/tokens/types.ts';

const THEME_EXPORTS = process.env.THEME_EXPORTS ?? '/home/claude/tokens/theme_brand';
const UI_THEME_DIR = process.env.UI_THEME_DIR ?? '/home/claude/repo/superlogic-ui-main/apps/live-tickets/src/theme';

const SLUG_ALIASES: Record<string, string> = { u_e: 'u-e', umpulse: 'umhp' };

/** Only the semantic half — foundation lives in a different export. */
function themeSection(css: string): string {
  const marker = css.indexOf('Theme (semantic) tokens');
  return marker === -1 ? '' : css.slice(marker);
}

const alreadyMapped = new Set(DEFAULT_COMPAT_ALIASES.map((a) => a.from));
const proposalsByVar = new Map<string, { to: string; reason?: string; tenants: string[] }>();

for (const file of readdirSync(THEME_EXPORTS).filter((f) => f.endsWith('.tokens.json'))) {
  const exportName = file.replace('.tokens.json', '');
  const slug = SLUG_ALIASES[exportName] ?? exportName;
  const committedPath = join(UI_THEME_DIR, slug, `${slug}.figma.css`);
  if (!existsSync(committedPath)) continue;

  const flat = flattenTokens(JSON.parse(readFileSync(join(THEME_EXPORTS, file), 'utf-8')) as FigmaTokenTree);
  const counts = new Map<string, number>();
  for (const token of Object.values(flat)) {
    const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
    const brand = target ? aliasBrand(target) : null;
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const brandKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  const published = new Set(
    buildThemeVarLines(flat, brandKey)
      .map((l) => /^\s*(--[a-z0-9-]+):/.exec(l)?.[1])
      .filter((v): v is string => Boolean(v)),
  );
  const committed = [...themeSection(readFileSync(committedPath, 'utf-8')).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(
    (m) => m[1],
  );

  const removed = committed.filter((v) => !published.has(v) && !alreadyMapped.has(v));
  const added = [...published].filter((v) => !committed.includes(v));

  for (const proposal of proposeAliases(removed, added)) {
    const existing = proposalsByVar.get(proposal.from);
    if (existing) existing.tenants.push(slug);
    else proposalsByVar.set(proposal.from, { to: proposal.to, reason: proposal.reason, tenants: [slug] });
  }
}

if (proposalsByVar.size === 0) {
  console.log('No unmapped removals — every dropped variable already has a compatibility alias.');
  process.exit(0);
}

console.log(`${proposalsByVar.size} variable(s) dropped without an alias. Proposed mappings:\n`);
for (const [from, { to, reason, tenants }] of proposalsByVar) {
  console.log(`  ${from}`);
  console.log(`    → ${to}`);
  console.log(`      affects: ${tenants.join(', ')}`);
  if (reason) console.log(`      ${reason}`);
  console.log('');
}

console.log('Paste confirmed entries into lib/tokens/compat.ts as:\n');
console.log('  { from: \'<old>\', to: \'<new>\', reason: \'…\', deprecatedSince: \'YYYY-MM-DD\' },');
