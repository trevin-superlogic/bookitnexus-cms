/**
 * Generate the "required tokens" manifest — the contract the publish gate
 * validates translated output against.
 *
 * The PDP requires that "the translated result must match the token structure
 * expected by the app". That expectation isn't written down anywhere today; it
 * is implicit in every `text-(--color-...)` class across the codebase. This
 * script makes it explicit.
 *
 * The subtlety is that not every `--color-*` in the source is a Figma token.
 * The apps also use shadcn system vars (`--color-accent`, `--color-ring`) and
 * legacy spree-pay vars (`--border-component-specific-card`) that the CMS does
 * not own and must not be blamed for. So we classify by PROVENANCE — a token is
 * CMS-owned only if a generated `*.figma.css` file currently defines it.
 *
 *   node --experimental-strip-types scripts/build-token-manifest.ts \
 *     --repo ../superlogic-ui --out schemas/tokens/required-tokens.json
 *
 * Re-run and commit whenever the frontend changes its token usage.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

/**
 * Which generated layer defines a token — determines who must publish it.
 *
 * A tenant stylesheet has two halves that come from different Figma
 * collections and are validated independently:
 *   foundation — brand primitives (--color-slate-900) from Foundation·Breakpoint
 *   theme      — semantic aliases (--color-text-icons-brand-default) from Theme·Brand
 * Collapsing them into one "tenant" layer means a theme-only validation
 * reports every primitive as missing.
 */
type Layer = 'shared' | 'scale' | 'foundation' | 'theme';

interface Manifest {
  generatedFrom: string;
  /** CMS-owned + referenced by source. Absence blocks publishing. */
  required: string[];
  /** CMS-owned but unreferenced. Absence is a warning only. */
  known: string[];
  /** Referenced by source but NOT CMS-owned (shadcn, spree-pay legacy). Ignored by the gate. */
  external: string[];
  /** token → the generated layer that defines it. */
  layer: Record<string, Layer>;
  /** token → referencing source files, for actionable error messages. */
  usage: Record<string, string[]>;
}

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.js', '.jsx']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.turbo', 'build', 'dist', 'coverage']);

/** Prefixes that could plausibly be design tokens. Provenance decides the rest. */
const TOKEN_PREFIXES = [
  '--color-',
  '--type-',
  '--radius-',
  '--spacing-',
  '--layout-',
  '--border-',
  '--shared-',
  '--scale-',
];

const isTokenish = (name: string): boolean => TOKEN_PREFIXES.some((p) => name.startsWith(p));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    // extract-figma-tokens.ts is the legacy generator this CMS replaces; its
    // internal variable names are not application references and must not pin
    // tokens as "required".
    else if (entry === 'extract-figma-tokens.ts') continue;
    else if (SCAN_EXTENSIONS.has(extname(entry))) out.push(full);
  }
  return out;
}

/** Is this a generated token file at all? */
function isGenerated(file: string): boolean {
  return basename(file).endsWith('.figma.css');
}

/** Custom properties DEFINED (not merely referenced) by a stylesheet. */
function definedIn(content: string): string[] {
  return [...content.matchAll(/^\s*(--[a-z][a-z0-9-]*)\s*:/gm)].map((m) => m[1]);
}

/**
 * Split a generated stylesheet into (layer, definitions) pairs.
 *
 * Tenant files carry the section banners the generator writes
 * ("── Foundation tokens ──" / "── Theme (semantic) tokens ──"), which is what
 * lets us attribute each variable to the collection it came from.
 */
function definitionsByLayer(file: string, content: string): Array<[Layer, string[]]> {
  const name = basename(file);
  if (name === 'shared.figma.css') return [['shared', definedIn(content)]];
  if (name === 'scale.figma.css') return [['scale', definedIn(content)]];

  const themeMarker = content.indexOf('Theme (semantic) tokens');
  if (themeMarker === -1) return [['foundation', definedIn(content)]];
  return [
    ['foundation', definedIn(content.slice(0, themeMarker))],
    ['theme', definedIn(content.slice(themeMarker))],
  ];
}

function parseArgs(): { repo: string; out: string } {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback: string): string => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  return {
    repo: get('--repo', process.env.SUPERLOGIC_UI_PATH ?? '../superlogic-ui'),
    out: get('--out', new URL('../schemas/tokens/required-tokens.json', import.meta.url).pathname),
  };
}

const { repo, out } = parseArgs();
if (!existsSync(repo)) {
  console.error(`superlogic-ui checkout not found at ${repo} — pass --repo <path>`);
  process.exit(1);
}

const roots = ['apps', 'packages'].map((d) => join(repo, d)).filter(existsSync);
const files = roots.flatMap((r) => walk(r));

const usage: Record<string, Set<string>> = {};
const layer: Record<string, Layer> = {};

for (const file of files) {
  const relative = file.slice(repo.length + 1);
  const content = readFileSync(file, 'utf-8');
  if (isGenerated(file)) {
    // Generated files establish the vocabulary the CMS owns.
    for (const [generatedLayer, names] of definitionsByLayer(file, content)) {
      for (const name of names) {
        if (!isTokenish(name)) continue;
        // Global layers win: shared/scale are defined once for every tenant,
        // so if a name appears in both, the global definition is the real one.
        const isGlobal = generatedLayer === 'shared' || generatedLayer === 'scale';
        if (!layer[name] || isGlobal) layer[name] = generatedLayer;
      }
    }
    continue;
  }

  // Hand-written source establishes what's actually referenced.
  for (const match of content.matchAll(/--[a-z][a-z0-9-]*/g)) {
    if (isTokenish(match[0])) (usage[match[0]] ??= new Set()).add(relative);
  }
}

const referenced = Object.keys(usage);
const required = referenced.filter((t) => layer[t]).sort();
const external = referenced.filter((t) => !layer[t]).sort();
const known = Object.keys(layer)
  .filter((t) => !usage[t])
  .sort();

const manifest: Manifest = {
  generatedFrom: repo,
  required,
  known,
  external,
  layer: Object.fromEntries(Object.keys(layer).sort().map((k) => [k, layer[k]])),
  usage: Object.fromEntries(required.map((k) => [k, [...usage[k]].sort()])),
};

writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

const byLayer = (l: Layer): number => required.filter((t) => layer[t] === l).length;

console.log(`Scanned ${files.length} files under ${roots.map((r) => r.slice(repo.length + 1)).join(', ')}\n`);
console.log(
  `  required : ${required.length}  (foundation ${byLayer('foundation')}, theme ${byLayer('theme')}, ` +
    `shared ${byLayer('shared')}, scale ${byLayer('scale')})`,
);
console.log(`  known    : ${known.length}  CMS-owned but unreferenced`);
console.log(`  external : ${external.length}  referenced but not CMS-owned — the gate ignores these`);
if (external.length) console.log(`             e.g. ${external.slice(0, 6).join(', ')}`);
console.log(`\n  → ${out}`);
