/**
 * Translation layer: Figma token structure → the frontend CSS token structure.
 *
 * This is a faithful port of `apps/live-tickets/scripts/extract-figma-tokens.ts`.
 * It runs inside the Sanity publish gate so that the *only* artefact the API
 * ever serves is already in the shape the apps expect — per the PDP, the
 * frontend never runs this translation itself.
 *
 * Output parity with the committed `*.figma.css` files in superlogic-ui is
 * asserted by `translate.test.ts`. Treat any diff as a regression.
 */
import { aliasBrand, aliasToVar, brandKeyToSlug, canonicalBrandKey, normalizeBrandPath, pathToCssVar, slugify } from './naming.ts';
import { flattenTokens } from './flatten.ts';
import { generateCompatBlock, type CompatAlias } from './compat.ts';
import {
  BREAKPOINT_MEDIA,
  type Breakpoint,
  type FigmaColorValue,
  type FigmaToken,
  type FigmaTokenTree,
  type FlatTokens,
  type FoundationTokenTree,
} from './types.ts';

/** Figma emits this literal for variables whose value was never set. */
const FIGMA_PLACEHOLDER = 'String value';

/** Wrap `var(...)` declarations onto multiple lines past this width. */
const MAX_LINE_WIDTH = 120;

// ── Value resolution ──────────────────────────────────────────────────────────

/** Walk a token tree to resolve a "{path.to.token}" reference. */
function resolveRef(ref: string, root: FigmaTokenTree): FigmaToken['$value'] | null {
  const parts = ref.slice(1, -1).split('.');
  let node: unknown = root;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return node && typeof node === 'object' && '$value' in (node as FigmaToken) ? (node as FigmaToken).$value : null;
}

/**
 * A token → its CSS value string.
 *
 * `{reference}` values are resolved against `root` where possible; when the
 * target lives in another collection we fall back to emitting a var() so the
 * cascade resolves it at runtime.
 */
export function toCssValue(token: FigmaToken, root: FigmaTokenTree): string {
  const { $type, $value } = token;

  if (typeof $value === 'string' && $value.startsWith('{') && $value.endsWith('}')) {
    const resolved = resolveRef($value, root);
    if (resolved !== null) return toCssValue({ $type, $value: resolved }, root);
    const cssVar = `--${$value.slice(1, -1).split('.').map(slugify).filter(Boolean).join('-')}`;
    return `var(${cssVar})`;
  }

  switch ($type) {
    case 'color': {
      const colorVal = $value as FigmaColorValue;
      if (typeof colorVal === 'object' && colorVal !== null && colorVal.hex) {
        const alpha = colorVal.alpha ?? 1;
        if (alpha < 1) {
          // Translucent tokens must round-trip through rgba(); a hex would
          // silently drop the alpha channel.
          const comps = colorVal.components ?? [];
          const r = Math.round((comps[0] ?? 0) * 255);
          const g = Math.round((comps[1] ?? 0) * 255);
          const b = Math.round((comps[2] ?? 0) * 255);
          const a = parseFloat(alpha.toFixed(3));
          return `rgba(${r}, ${g}, ${b}, ${a})`;
        }
        const hex = (colorVal.hex.startsWith('#') ? colorVal.hex : `#${colorVal.hex}`).toLowerCase();
        // #rrggbb → #rgb where the pairs repeat.
        if (hex.length === 7 && hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
          return `#${hex[1]}${hex[3]}${hex[5]}`;
        }
        return hex;
      }
      return String($value);
    }
    case 'number': {
      const n = Number($value);
      if (Number.isNaN(n)) return String($value);
      return n === 0 ? '0' : `${n}px`;
    }
    default:
      return String($value);
  }
}

/**
 * A theme token → a var() reference via its alias, or a literal.
 *
 * When a `resolvable` set is provided and the alias target is not in it, the
 * token's baked value is emitted instead of a var() that would dangle at
 * runtime — the stale-Foundation case. Source validation reports the gap.
 */
function toThemeCssValue(token: FigmaToken, brandKey: string, resolvable?: Set<string>): string {
  const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
  if (target) {
    // A pointer into ANOTHER brand's palette is emitted as the baked constant,
    // never as a var(). Emitting a var would either dangle or — worse, if the
    // name collided — resolve against this tenant's palette and render a
    // silently wrong colour. The constant is always the value Figma shows.
    const targetBrand = aliasBrand(target);
    if (targetBrand && canonicalBrandKey(targetBrand) !== canonicalBrandKey(brandKey)) {
      return toCssValue(token, {});
    }
    if (!resolvable || resolvable.has(target) || resolvable.has(normalizeBrandPath(target))) {
      return aliasToVar(target, brandKey);
    }
    return toCssValue(token, {});
  }
  return toCssValue(token, {});
}

// ── Line emission ─────────────────────────────────────────────────────────────

function cssLine(cssVar: string, cssValue: string): string {
  const line = `  ${cssVar}: ${cssValue};`;
  if (line.length <= MAX_LINE_WIDTH || !cssValue.startsWith('var(')) return line;
  const inner = cssValue.slice(4, -1);
  return `  ${cssVar}: var(\n    ${inner}\n  );`;
}

/** Foundation (primitive) declarations — values are resolved literals. */
export function buildVarLines(flat: FlatTokens, root: FigmaTokenTree, prefixSegments: string[] = []): string[] {
  const lines: string[] = [];
  for (const [dotPath, token] of Object.entries(flat)) {
    const cssVar = pathToCssVar([...prefixSegments, ...dotPath.split('.')]);
    const cssValue = toCssValue(token, root);
    if (cssValue === FIGMA_PLACEHOLDER) continue;
    lines.push(cssLine(cssVar, cssValue));
  }
  return lines;
}

/** Theme (semantic) declarations — values are var() references into foundation. */
export function buildThemeVarLines(flat: FlatTokens, brandKey: string, resolvable?: Set<string>): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const [dotPath, token] of Object.entries(flat)) {
    // An unaliased string is an unbound Figma variable, not a real token.
    if (token.$type === 'string' && !token.$extensions?.['com.figma.aliasData']?.targetVariableName) continue;
    const cssVar = pathToCssVar(dotPath.split('.'));
    const cssValue = toThemeCssValue(token, brandKey, resolvable);
    // `--foo: var(--foo)` is a no-op that breaks the cascade; drop it. Later
    // duplicates of the same var lose to the first, matching Figma's own
    // first-declaration-wins ordering.
    if (cssValue === `var(${cssVar})` || seen.has(cssVar)) continue;
    seen.add(cssVar);
    lines.push(cssLine(cssVar, cssValue));
  }
  return lines;
}

/** Entries of `other` whose resolved value differs from `base`. */
export function diffFlat(
  baseFlat: FlatTokens,
  otherFlat: FlatTokens,
  baseRoot: FigmaTokenTree,
  otherRoot: FigmaTokenTree,
): FlatTokens {
  const diff: FlatTokens = {};
  for (const [dotPath, token] of Object.entries(otherFlat)) {
    const baseToken = baseFlat[dotPath];
    // A token absent at desktop has no base to override — skip rather than
    // emit an orphan that only exists below a breakpoint.
    if (!baseToken) continue;
    if (toCssValue(baseToken, baseRoot) !== toCssValue(token, otherRoot)) diff[dotPath] = token;
  }
  return diff;
}

function mediaBlock(condition: string, selector: string, varLines: string[]): string[] {
  if (varLines.length === 0) return [];
  return ['', `@media (${condition}) {`, `  ${selector} {`, ...varLines.map((l) => `  ${l}`), '  }', '}'];
}

// ── Document generation ───────────────────────────────────────────────────────

/** The four breakpoint exports of the Foundation collection. */
export type FoundationByBreakpoint = Record<Breakpoint, FoundationTokenTree>;

export interface TenantCssInput {
  /** Raw Figma brand key, e.g. "bookit" or "🔴tria". */
  brandKey: string;
  foundation: FoundationByBreakpoint;
  /** The tenant's Theme · Brand export. */
  theme: FigmaTokenTree;
  /**
   * Old → new names to keep alive while the frontend migrates. Emitted as a
   * trailing block so the stylesheet is a superset: every token design ships,
   * plus every name code still uses.
   */
  compatAliases?: CompatAlias[];
}

/**
 * Generate one tenant's `<slug>.figma.css`: foundation primitives with
 * responsive overrides, then semantic aliases (single viewport).
 */
export function generateTenantCss({ brandKey, foundation, theme, compatAliases }: TenantCssInput): string {
  const selector = ':root';

  const brandSubtree = (bp: Breakpoint): FigmaTokenTree => {
    const brands = (foundation[bp]?.brand ?? {}) as Record<string, FigmaTokenTree>;
    if (brands[brandKey]) return brands[brandKey];
    // The stored export and the tenant's brand key can straddle an emoji
    // rename ("🔴tria" ↔ "tria") — match emoji-insensitively before giving up.
    const want = canonicalBrandKey(brandKey);
    for (const [key, subtree] of Object.entries(brands)) {
      if (canonicalBrandKey(key) === want) return subtree;
    }
    return {} as FigmaTokenTree;
  };
  const flatFor = (bp: Breakpoint): FlatTokens => flattenTokens(brandSubtree(bp));

  // Every Figma name the stored Foundation can actually resolve — used to fall
  // back to baked values for targets a stale Foundation export doesn't know.
  const resolvable = new Set<string>();
  for (const bp of Object.keys(foundation) as Breakpoint[]) {
    for (const path of Object.keys(flattenTokens((foundation[bp] ?? {}) as FigmaTokenTree))) {
      const name = path.split('.').join('/');
      resolvable.add(name);
      resolvable.add(normalizeBrandPath(name));
    }
  }

  const desktopFlat = flatFor('desktop');
  const wideDesktopDiff = diffFlat(desktopFlat, flatFor('wideDesktop'), foundation.desktop, foundation.wideDesktop);
  const tabletDiff = diffFlat(desktopFlat, flatFor('tablet'), foundation.desktop, foundation.tablet);
  const mobileDiff = diffFlat(desktopFlat, flatFor('mobile'), foundation.desktop, foundation.mobile);

  const themeFlat = flattenTokens(theme);

  const lines: string[] = [
    `/* Auto-generated from figma/foundation + figma/theme — tenant: ${brandKey} */`,
    `/* Do not edit manually */`,
    '',
    `/* ── Foundation tokens ─────────────────────────────────────────────────── */`,
    `${selector} {`,
    ...buildVarLines(desktopFlat, foundation.desktop),
    '}',
    ...mediaBlock(BREAKPOINT_MEDIA.wideDesktop, selector, buildVarLines(wideDesktopDiff, foundation.wideDesktop)),
    ...mediaBlock(BREAKPOINT_MEDIA.tablet, selector, buildVarLines(tabletDiff, foundation.tablet)),
    ...mediaBlock(BREAKPOINT_MEDIA.mobile, selector, buildVarLines(mobileDiff, foundation.mobile)),
  ];

  if (Object.keys(themeFlat).length > 0) {
    lines.push(
      '',
      `/* ── Theme (semantic) tokens ────────────────────────────────────────────── */`,
      `${selector} {`,
      ...buildThemeVarLines(themeFlat, brandKey, resolvable),
      '}',
    );
  }

  // Aliases go last so they can reference anything declared above, and so the
  // block is trivial to locate and delete once the migration finishes.
  if (compatAliases?.length) {
    const published = new Set(Object.keys(cssToVariableMap(lines.join('\n'))));
    const { css } = generateCompatBlock(compatAliases, published);
    if (css) lines.push(css);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate `shared.figma.css` / `scale.figma.css` — the tenant-independent
 * primitives consumed via `@repo/ui/globals.css`.
 */
export function generateGlobalCss(sectionName: 'shared' | 'scale', foundation: FoundationByBreakpoint): string {
  const selector = ':root';
  const flatFor = (bp: Breakpoint): FlatTokens => flattenTokens((foundation[bp]?.[sectionName] ?? {}) as FigmaTokenTree);

  const desktopFlat = flatFor('desktop');
  const wideDesktopDiff = diffFlat(desktopFlat, flatFor('wideDesktop'), foundation.desktop, foundation.wideDesktop);
  const tabletDiff = diffFlat(desktopFlat, flatFor('tablet'), foundation.desktop, foundation.tablet);
  const mobileDiff = diffFlat(desktopFlat, flatFor('mobile'), foundation.desktop, foundation.mobile);

  const prefix = [sectionName];

  return [
    `/* Auto-generated from figma/foundation/*.tokens.json — section: ${sectionName} */`,
    `/* Do not edit manually */`,
    '',
    `${selector} {`,
    ...buildVarLines(desktopFlat, foundation.desktop, prefix),
    '}',
    ...mediaBlock(
      BREAKPOINT_MEDIA.wideDesktop,
      selector,
      buildVarLines(wideDesktopDiff, foundation.wideDesktop, prefix),
    ),
    ...mediaBlock(BREAKPOINT_MEDIA.tablet, selector, buildVarLines(tabletDiff, foundation.tablet, prefix)),
    ...mediaBlock(BREAKPOINT_MEDIA.mobile, selector, buildVarLines(mobileDiff, foundation.mobile, prefix)),
    '',
  ].join('\n');
}

/**
 * The full translated payload for one tenant. This is exactly what the publish
 * gate stores and the API serves — no further processing downstream.
 */
export interface TranslatedTheme {
  brandKey: string;
  /** Filename-safe tenant slug, e.g. "tria". */
  slug: string;
  /** Contents of `src/theme/<slug>/<slug>.figma.css`. */
  css: string;
  /** Flat `{ "--var": "value" }` map, for consumers that want JSON not CSS. */
  variables: Record<string, string>;
}

/** Parse the emitted CSS back into a flat var map (theme + base foundation). */
export function cssToVariableMap(css: string): Record<string, string> {
  const variables: Record<string, string> = {};
  // Collapse the multi-line var() wrapping applied by cssLine before matching.
  const normalized = css.replace(/var\(\s*\n\s*/g, 'var(').replace(/\s*\n\s*\)/g, ')');
  let depth = 0;
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('@media')) depth = 1;
    if (line === '}') depth = Math.max(0, depth - 1);
    // Only capture base-layer declarations; media overrides are viewport-specific.
    if (depth > 0) continue;
    const match = /^(--[a-z0-9-]+):\s*(.+);$/.exec(line);
    if (match) variables[match[1]] = match[2];
  }
  return variables;
}

export function translateTheme(input: TenantCssInput): TranslatedTheme {
  const css = generateTenantCss(input);
  return {
    brandKey: input.brandKey,
    slug: brandKeyToSlug(input.brandKey),
    css,
    variables: cssToVariableMap(css),
  };
}
