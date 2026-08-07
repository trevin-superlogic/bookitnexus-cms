/**
 * Structural drift report: new Figma exports vs. the CSS variables the apps
 * actually reference today.
 *
 * This is the analysis behind the publish gate's output-validation rule. It
 * answers three questions per tenant:
 *
 *   1. Do the variable NAMES our translator emits match the committed CSS?
 *      (proves the port is correct, independent of value drift)
 *   2. Which committed variables would DISAPPEAR if we published the new
 *      export? Those are the ones that break styling silently.
 *   3. Which variables are NEW?
 *
 *   node --experimental-strip-types lib/tokens/drift.test.ts
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildThemeVarLines } from './translate.ts';
import { flattenTokens } from './flatten.ts';
import { aliasBrand, brandKeyToSlug } from './naming.ts';
import type { FigmaTokenTree } from './types.ts';

const THEME_EXPORTS = process.env.THEME_EXPORTS ?? '/home/claude/tokens/theme_brand';
const UI_THEME_DIR = process.env.UI_THEME_DIR ?? '/home/claude/repo/superlogic-ui-main/apps/live-tickets/src/theme';

const SLUG_ALIASES: Record<string, string> = { u_e: 'u-e', umpulse: 'umhp' };

function inferBrandKey(flat: ReturnType<typeof flattenTokens>): string {
  const counts = new Map<string, number>();
  for (const token of Object.values(flat)) {
    const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
    const brand = target ? aliasBrand(target) : null;
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function parseDecls(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const m = /^\s*(--[a-z0-9-]+):\s*(.+);\s*$/.exec(line);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function committedThemeLines(css: string): string[] {
  const marker = css.indexOf('Theme (semantic) tokens');
  if (marker === -1) return [];
  const section = css.slice(marker);
  const open = section.indexOf('{');
  const close = section.indexOf('\n}', open);
  return section.slice(open + 1, close).split('\n');
}

const summary: string[] = [];
const allRemoved = new Map<string, Set<string>>();

for (const file of readdirSync(THEME_EXPORTS).filter((f) => f.endsWith('.tokens.json'))) {
  const exportName = file.replace('.tokens.json', '');
  const slug = SLUG_ALIASES[exportName] ?? brandKeyToSlug(exportName);
  const committedPath = join(UI_THEME_DIR, slug, `${slug}.figma.css`);
  if (!existsSync(committedPath)) continue;

  const flat = flattenTokens(JSON.parse(readFileSync(join(THEME_EXPORTS, file), 'utf-8')) as FigmaTokenTree);
  const brandKey = inferBrandKey(flat);

  const expected = parseDecls(committedThemeLines(readFileSync(committedPath, 'utf-8')));
  const actual = parseDecls(buildThemeVarLines(flat, brandKey));

  const removed = [...expected.keys()].filter((k) => !actual.has(k));
  const added = [...actual.keys()].filter((k) => !expected.has(k));
  const kept = [...expected.keys()].filter((k) => actual.has(k));
  const revalued = kept.filter((k) => expected.get(k) !== actual.get(k));

  summary.push(
    `${slug.padEnd(8)} committed ${String(expected.size).padStart(3)} | new ${String(actual.size).padStart(3)} | ` +
      `kept ${String(kept.length).padStart(3)} | removed ${String(removed.length).padStart(3)} | ` +
      `added ${String(added.length).padStart(3)} | value-changed ${String(revalued.length).padStart(3)}`,
  );

  for (const r of removed) {
    if (!allRemoved.has(r)) allRemoved.set(r, new Set());
    allRemoved.get(r)!.add(slug);
  }
}

console.log('Per-tenant drift (semantic/theme layer only):\n');
summary.forEach((s) => console.log('  ' + s));

console.log(`\nVariables that exist today but would DISAPPEAR under the new export (${allRemoved.size} distinct):\n`);
const grouped = new Map<string, string[]>();
for (const v of allRemoved.keys()) {
  const prefix = v.split('-').slice(0, 4).join('-');
  if (!grouped.has(prefix)) grouped.set(prefix, []);
  grouped.get(prefix)!.push(v);
}
for (const [prefix, vars] of [...grouped.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${prefix}* (${vars.length})`);
  vars.slice(0, 4).forEach((v) => console.log(`      ${v}`));
  if (vars.length > 4) console.log(`      … ${vars.length - 4} more`);
}
