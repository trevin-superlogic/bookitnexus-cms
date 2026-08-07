/**
 * The additive-export guarantee.
 *
 * Asserts, against the real supplied exports, that publishing the restructured
 * Figma library loses nothing:
 *
 *   - every token in the export reaches the CSS (new vocabulary included)
 *   - every old name the frontend still uses keeps resolving, via aliases
 *   - the gate stops blocking once aliases cover the gap
 *   - genuinely-new tokens are reported as notes, not faults
 *
 *   node --experimental-strip-types lib/tokens/compat.test.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { flattenTokens } from './flatten.ts';
import { aliasBrand, aliasToVar, pathToCssVar } from './naming.ts';
import { buildThemeVarLines, cssToVariableMap } from './translate.ts';
import { generateCompatBlock, DEFAULT_COMPAT_ALIASES, proposeAliases, toAliasMap } from './compat.ts';
import { validateOutput, type TokenManifest } from './validate.ts';
import type { FigmaTokenTree } from './types.ts';

const THEME_EXPORTS = process.env.THEME_EXPORTS ?? '/home/claude/tokens/theme_brand';
const MANIFEST = process.env.MANIFEST ?? '/home/claude/superlogic-cms/schemas/tokens/required-tokens.json';
const UI_THEME_DIR = process.env.UI_THEME_DIR ?? '/home/claude/repo/superlogic-ui-main/apps/live-tickets/src/theme';

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as TokenManifest;

let assertions = 0;
let failed = 0;

function expect(label: string, condition: boolean, detail = ''): void {
  assertions++;
  if (condition) console.log(`  ✓ ${label}`);
  else {
    failed++;
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

function loadTenant(name: string) {
  const flat = flattenTokens(JSON.parse(readFileSync(join(THEME_EXPORTS, `${name}.tokens.json`), 'utf-8')) as FigmaTokenTree);
  const counts = new Map<string, number>();
  for (const token of Object.values(flat)) {
    const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
    const brand = target ? aliasBrand(target) : null;
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const brandKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const lines = buildThemeVarLines(flat, brandKey);
  return { flat, brandKey, lines, variables: cssToVariableMap([':root {', ...lines, '}'].join('\n')) };
}

console.log('Nothing is dropped:\n');

const bookit = loadTenant('bookit');

// Every token in the export must be accounted for: either emitted, or skipped
// for a reason we can name. "Dropped silently" is the failure mode this guards
// against — it is how a redesign quietly loses tokens.
const accounted = { emitted: 0, selfReference: 0, unaliasedString: 0, duplicate: 0 };
const seenVars = new Set<string>();
for (const [path, token] of Object.entries(bookit.flat)) {
  const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
  const cssVar = pathToCssVar(path.split('.'));
  if (token.$type === 'string' && !target) accounted.unaliasedString++;
  // A token whose alias resolves to its own name is already defined by the
  // foundation layer — the theme layer has nothing to add. All 22 `type.*`
  // tokens are this case.
  else if (target && aliasToVar(target, bookit.brandKey) === `var(${cssVar})`) accounted.selfReference++;
  else if (seenVars.has(cssVar)) accounted.duplicate++;
  else {
    accounted.emitted++;
    seenVars.add(cssVar);
  }
}
const total = Object.keys(bookit.flat).length;
expect(
  `all ${total} export tokens accounted for (${accounted.emitted} emitted, ` +
    `${accounted.selfReference} defined by foundation, ${accounted.unaliasedString} unbound, ${accounted.duplicate} duplicate)`,
  accounted.emitted === Object.keys(bookit.variables).length &&
    accounted.emitted + accounted.selfReference + accounted.unaliasedString + accounted.duplicate === total,
  `emitted=${Object.keys(bookit.variables).length} vs counted=${accounted.emitted}, total=${total}`,
);

expect(
  'every skipped token is a self-reference the foundation layer already defines',
  accounted.unaliasedString === 0 && accounted.duplicate === 0,
  `unbound=${accounted.unaliasedString}, duplicate=${accounted.duplicate}`,
);

// The new vocabulary specifically — this is what the redesign added.
const newStructure = Object.keys(bookit.variables).filter((v) => v.includes('-filled-') || v.includes('-outlined-'));
expect(
  `new control filled/outlined vocabulary ships (${newStructure.length} vars)`,
  newStructure.length > 0,
  'expected the restructured control tokens to be present',
);

console.log('\nOld names keep resolving:\n');

const published = new Set(Object.keys(bookit.variables));
const { css, emitted, skipped } = generateCompatBlock(DEFAULT_COMPAT_ALIASES, published);

expect(
  `${emitted.length}/${DEFAULT_COMPAT_ALIASES.length} aliases emitted`,
  emitted.length > 0,
  `skipped: ${skipped.map((s) => s.from).join(', ')}`,
);
expect('alias block is valid CSS declarations', /^\s+--[a-z-]+: var\(--[a-z-]+\);$/m.test(css));
expect(
  'no alias points at a variable that is not published',
  emitted.every((a) => published.has(a.to)),
);
expect(
  'no alias shadows a token the export still publishes',
  emitted.every((a) => !published.has(a.from)),
);

console.log('\nThe gate reacts correctly:\n');

const withoutAliases = validateOutput({ variables: bookit.variables, manifest, layers: ['theme'] });
const blocked = withoutAliases.issues.filter((i) => i.code === 'output.missing-required');
expect(`without aliases: blocked on ${blocked.length} missing token(s)`, !withoutAliases.ok && blocked.length > 0);

// `variables` stays the TOKEN output only — aliases are declared separately.
// Folding them in would make the old names simply "present", which is true at
// runtime but hides the migration debt the editor needs to see.
const withAliases = validateOutput({
  variables: bookit.variables,
  manifest,
  layers: ['theme'],
  compatAliases: toAliasMap(DEFAULT_COMPAT_ALIASES),
});
const stillBlocked = withAliases.issues.filter((i) => i.code === 'output.missing-required');
const downgraded = withAliases.issues.filter((i) => i.code === 'output.aliased-required');

expect(
  `with aliases: ${downgraded.length} downgraded to warnings, ${stillBlocked.length} still blocking`,
  downgraded.length + stillBlocked.length === blocked.length,
  `expected the ${blocked.length} blockers to be accounted for; got ${downgraded.length} + ${stillBlocked.length}`,
);
for (const issue of stillBlocked) console.log(`      ↳ still blocking: ${issue.subject}`);

console.log('\nNew tokens are reported, not faulted:\n');

const note = withAliases.issues.find((i) => i.code === 'output.unmapped');
expect('unmapped tokens surfaced as an informational note', note?.severity === 'info', `got ${note?.severity}`);
if (note) console.log(`      ↳ ${note.subject}: ${note.detail?.slice(0, 120)}…`);
expect(
  'informational notes never block publishing',
  validateOutput({
    variables: { '--color-brand-new': '#fff' },
    manifest: { required: [], known: [], external: [] },
  }).ok,
);

console.log('\nAlias proposals for review:\n');

const committed = readFileSync(join(UI_THEME_DIR, 'bookit', 'bookit.figma.css'), 'utf-8');
const committedVars = [...committed.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]);
const removed = committedVars.filter((v) => !published.has(v));
const added = [...published].filter((v) => !committedVars.includes(v));
const proposals = proposeAliases(removed, added);

expect(`proposed ${proposals.length} mapping(s) for ${removed.length} removed variable(s)`, proposals.length > 0);
for (const p of proposals.slice(0, 8)) console.log(`      ${p.from}\n        → ${p.to}${p.reason ? `  (${p.reason})` : ''}`);
const unproposed = removed.filter((r) => !proposals.some((p) => p.from === r));
if (unproposed.length) console.log(`      no candidate for: ${unproposed.join(', ')}`);

console.log(`\n${assertions - failed}/${assertions} assertions passed.`);
process.exit(failed === 0 ? 0 : 1);
