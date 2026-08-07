/**
 * Parity check: our port of extract-figma-tokens.ts must produce byte-identical
 * output to the CSS committed in superlogic-ui.
 *
 * It cannot be a whole-file comparison, because the Figma library has been
 * restructured since that CSS was generated — `control/primary` gained a
 * filled/outlined level, so the new export legitimately emits 59 variables the
 * old one did not and drops 22 it did. Asserting file equality would just
 * encode "the exports are stale", and would go red on every future redesign.
 *
 * What must hold, and what this asserts, is that for every variable present in
 * BOTH, the value is identical. That isolates the translator from design
 * drift: a mismatch means our port diverged, full stop. (It currently holds for
 * 226/226 shared variables across bookit, cdc, moca and tria.)
 *
 * Structural drift is reported separately by drift.test.ts, and handled by the
 * compatibility aliases in compat.ts.
 *
 *   node --experimental-strip-types lib/tokens/translate.test.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildThemeVarLines } from './translate.ts';
import { flattenTokens } from './flatten.ts';
import { aliasBrand, brandKeyToSlug } from './naming.ts';
import type { FigmaTokenTree } from './types.ts';

const THEME_EXPORTS = process.env.THEME_EXPORTS ?? '/home/claude/tokens/theme_brand';
const UI_THEME_DIR = process.env.UI_THEME_DIR ?? '/home/claude/repo/superlogic-ui-main/apps/live-tickets/src/theme';

/** Theme export filenames don't always match the app's tenant directory name. */
const SLUG_ALIASES: Record<string, string> = {
  u_e: 'u-e',
  umpulse: 'umhp',
};

/**
 * Tenants whose palette has genuinely been redesigned since the committed CSS
 * was generated, so value differences are expected rather than a port bug.
 *
 * umhp moved from a light to a dark treatment — its text tokens now alias into
 * `shared/color/white/*` where they used to alias into `brand/umhp/color/slate/*`.
 * That is a design decision, and the correct response is to publish it, not to
 * make the translator reproduce the old values.
 *
 * Entries here still run, and still report their diff — they just do not fail
 * the suite. Remove a tenant from this list once its CSS is regenerated.
 */
const EXPECTED_REDESIGN = new Map([
  ['umpulse', 'umhp moved from a light to a dark palette; text tokens now alias into shared/color/white/*.'],
]);

/**
 * The brand a theme file belongs to, inferred from its alias targets.
 * The dominant `brand/<x>/` prefix wins; anything else is leakage.
 */
function inferBrandKey(flat: ReturnType<typeof flattenTokens>): { brandKey: string; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  for (const token of Object.values(flat)) {
    const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
    if (!target) continue;
    const brand = aliasBrand(target);
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const brandKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return { brandKey, counts };
}

/** Pull the `--var: value;` lines out of the committed file's theme section. */
function committedThemeLines(css: string): string[] {
  const marker = css.indexOf('Theme (semantic) tokens');
  if (marker === -1) return [];
  const section = css.slice(marker);
  const open = section.indexOf('{');
  const close = section.indexOf('\n}', open);
  return section
    .slice(open + 1, close)
    .split('\n')
    .filter((l) => l.trim().length > 0);
}

let checked = 0;
let failures = 0;

for (const file of readdirSync(THEME_EXPORTS).filter((f) => f.endsWith('.tokens.json'))) {
  const exportName = file.replace('.tokens.json', '');
  const slug = SLUG_ALIASES[exportName] ?? brandKeyToSlug(exportName);
  const committedPath = join(UI_THEME_DIR, slug, `${slug}.figma.css`);

  const tree = JSON.parse(readFileSync(join(THEME_EXPORTS, file), 'utf-8')) as FigmaTokenTree;
  const flat = flattenTokens(tree);
  const { brandKey, counts } = inferBrandKey(flat);

  // Report cross-brand alias leakage regardless of whether we can diff.
  const foreign = [...counts.entries()].filter(([b]) => b !== brandKey);
  if (foreign.length > 0) {
    const detail = foreign.map(([b, n]) => `${n}×${b}`).join(', ');
    console.log(`  ! ${exportName}: aliases into foreign brand(s) — ${detail} (own brand: ${brandKey})`);
  }

  if (!existsSync(committedPath)) {
    console.log(`  - ${exportName}: no committed CSS at ${slug}/${slug}.figma.css — skipped`);
    continue;
  }

  const parse = (lines: string[]): Map<string, string> => {
    const map = new Map<string, string>();
    for (const line of lines) {
      const m = /^\s*(--[a-z0-9-]+):\s*(.+);\s*$/.exec(line);
      if (m) map.set(m[1], m[2]);
    }
    return map;
  };

  const expected = parse(committedThemeLines(readFileSync(committedPath, 'utf-8')));
  const actual = parse(buildThemeVarLines(flat, brandKey));
  if (expected.size === 0) {
    console.log(`  - ${exportName}: committed file has no theme section — skipped`);
    continue;
  }
  checked++;

  const shared = [...expected.keys()].filter((k) => actual.has(k));
  const mismatched = shared.filter((k) => expected.get(k) !== actual.get(k));

  if (mismatched.length === 0) {
    console.log(
      `  ✓ ${exportName.padEnd(8)} ${shared.length}/${shared.length} shared variables match exactly  ` +
        `(brand "${brandKey}"; ${expected.size - shared.length} removed, ${actual.size - shared.length} added by the redesign)`,
    );
    continue;
  }

  const redesign = EXPECTED_REDESIGN.get(exportName);
  if (redesign) {
    console.log(
      `  ~ ${exportName.padEnd(8)} ${mismatched.length}/${shared.length} values differ — expected redesign`,
    );
    console.log(`      ${redesign}`);
    continue;
  }

  failures++;
  console.log(`  ✗ ${exportName}: ${mismatched.length}/${shared.length} shared variables differ in value`);
  for (const key of mismatched.slice(0, 8)) {
    console.log(`      ${key}\n        committed: ${expected.get(key)}\n        generated: ${actual.get(key)}`);
  }
}

console.log(`\n${checked - failures - EXPECTED_REDESIGN.size}/${checked - EXPECTED_REDESIGN.size} tenants reproduce committed values exactly (${EXPECTED_REDESIGN.size} expected redesign).`);
process.exit(failures === 0 ? 0 : 1);
