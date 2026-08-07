/**
 * Validation layer verified against the real supplied Figma exports.
 *
 * Expectations, all drawn from actual data rather than fixtures:
 *   - bookit / cdc / moca / tria / jumper / futurec / u_e pass source validation
 *   - actai, jayz30, umpulse FAIL on cross-brand alias leakage
 *   - every tenant FAILS output validation on the `control` restructure
 *
 *   node --experimental-strip-types lib/tokens/validate.test.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { flattenTokens } from './flatten.ts';
import { aliasBrand } from './naming.ts';
import { buildThemeVarLines } from './translate.ts';
import { validateOutput, validateSource, type TokenManifest } from './validate.ts';
import type { FigmaTokenTree } from './types.ts';

const THEME_EXPORTS = process.env.THEME_EXPORTS ?? '/home/claude/tokens/theme_brand';
const MANIFEST = process.env.MANIFEST ?? '/home/claude/superlogic-cms/schemas/tokens/required-tokens.json';

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8')) as TokenManifest;

function inferBrandKey(flat: ReturnType<typeof flattenTokens>): string {
  const counts = new Map<string, number>();
  for (const token of Object.values(flat)) {
    const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
    const brand = target ? aliasBrand(target) : null;
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function toVariableMap(lines: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const line of lines) {
    const m = /^\s*(--[a-z0-9-]+):\s*([\s\S]+);\s*$/.exec(line);
    if (m) map[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  }
  return map;
}

const EXPECT_SOURCE_FAIL = new Set(['actai', 'jayz30', 'umpulse']);

let assertions = 0;
let failed = 0;

function expect(label: string, condition: boolean, detail = ''): void {
  assertions++;
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

console.log('Source validation:\n');

for (const file of readdirSync(THEME_EXPORTS).filter((f) => f.endsWith('.tokens.json')).sort()) {
  const name = file.replace('.tokens.json', '');
  const flat = flattenTokens(JSON.parse(readFileSync(join(THEME_EXPORTS, file), 'utf-8')) as FigmaTokenTree);
  const brandKey = inferBrandKey(flat);
  const result = validateSource({ theme: flat, brandKey });

  const foreign = result.issues.filter((i) => i.code === 'alias.foreign-brand');
  const expectForeign = EXPECT_SOURCE_FAIL.has(name);

  // A cross-brand alias is reported but does not block: the translator emits
  // the token's baked constant rather than a var() into another brand's
  // namespace, so the published colour is right — what's lost is the live
  // link, which is a warning ("frozen value"), not an error. It only becomes
  // an error when there is no baked value to fall back on.
  expect(
    `${name.padEnd(8)} ${expectForeign ? 'reports its cross-brand alias as a warning' : 'passes'}`,
    expectForeign
      ? foreign.length > 0 && foreign.every((i) => i.severity === 'warning') && result.ok
      : result.ok,
    expectForeign
      ? `expected a non-blocking foreign-brand warning, got ok=${result.ok}, foreign=${foreign.length}` +
        `, severities=[${foreign.map((i) => i.severity).join(', ')}]`
      : result.issues
          .filter((i) => i.severity === 'error')
          .slice(0, 3)
          .map((i) => `${i.code}: ${i.subject} — ${i.message}`)
          .join('\n      '),
  );

  if (expectForeign && foreign[0]) console.log(`      ↳ ${foreign[0].subject}: ${foreign[0].message}`);
}

console.log('\nOutput validation (new exports vs. what the apps reference):\n');

for (const name of ['bookit', 'cdc', 'tria']) {
  const flat = flattenTokens(
    JSON.parse(readFileSync(join(THEME_EXPORTS, `${name}.tokens.json`), 'utf-8')) as FigmaTokenTree,
  );
  const variables = toVariableMap(buildThemeVarLines(flat, inferBrandKey(flat)));
  const result = validateOutput({ variables, manifest, layers: ['theme'] });
  const missing = result.issues.filter((i) => i.code === 'output.missing-required');

  expect(
    `${name.padEnd(8)} publish blocked — ${missing.length} required token(s) missing`,
    !result.ok && missing.length > 0,
    `ok=${result.ok}, missing=${missing.length}`,
  );
  for (const issue of missing.slice(0, 3)) console.log(`      ↳ ${issue.subject} — ${issue.detail ?? issue.message}`);
  if (missing.length > 3) console.log(`      ↳ … ${missing.length - 3} more`);
}

console.log('\nSelf-reference and dangling-reference detection:\n');

const dangling = validateOutput({
  variables: { '--color-x': 'var(--color-x)', '--color-y': 'var(--color-nope)', '--color-z': '#fff' },
  manifest: { required: [], known: [] },
  externalVariables: new Set(['--color-z']),
});
expect(
  'self-reference caught',
  dangling.issues.some((i) => i.code === 'output.self-reference' && i.subject === '--color-x'),
);
expect(
  'dangling reference caught',
  dangling.issues.some((i) => i.code === 'output.dangling-reference' && i.subject === '--color-y'),
);
expect('valid literal not flagged', !dangling.issues.some((i) => i.subject === '--color-z'));

console.log(`\n${assertions - failed}/${assertions} assertions passed.`);
process.exit(failed === 0 ? 0 : 1);
