/**
 * The publish pipeline, in the order the PDP mandates:
 *
 *   1. validate the editable Figma structure
 *   2. translate into the frontend structure
 *   3. validate the translated output against the app schema
 *   4. block if any step fails
 *
 * Kept free of Sanity imports so the exact same code runs in three places: the
 * Studio publish action, `npm run validate:tokens` in CI, and the build-time
 * consumer in superlogic-ui. One implementation means the Studio cannot pass
 * something the build then rejects.
 */
import { fromStoredTokens, unflattenTokens } from './flatten.ts';
import { normalizeBrandPath } from './naming.ts';
import { applyOverrides, type TokenOverride } from './overrides.ts';
import { generateGlobalCss, generateTenantCss, cssToVariableMap } from './translate.ts';
import { combine, validateOutput, validateSource, type TokenManifest, type ValidationIssue, type ValidationResult } from './validate.ts';
import { DEFAULT_COMPAT_ALIASES, generateCompatBlock, toAliasMap, type CompatAlias } from './compat.ts';
import type { Breakpoint, FoundationTokenTree, StoredToken } from './types.ts';

export interface FoundationSets {
  desktop: StoredToken[];
  wideDesktop: StoredToken[];
  tablet: StoredToken[];
  mobile: StoredToken[];
}

export interface ThemePipelineInput {
  brandKey: string;
  /** The tenant's semantic tokens, as stored. */
  theme: StoredToken[];
  /** The Foundation collection, as stored. */
  foundation: FoundationSets;
  manifest: TokenManifest;
  compatAliases?: CompatAlias[];
  /** Set false to publish without the compatibility block. */
  compatEnabled?: boolean;
  /** Manual value overrides, applied on top of the imported tokens. */
  overrides?: TokenOverride[];
}

export interface ThemePipelineResult {
  validation: ValidationResult;
  /** Present only when validation passed — there is nothing safe to publish otherwise. */
  output?: {
    css: string;
    variables: Record<string, string>;
    tokenCount: number;
    aliasCount: number;
    sourceHash: string;
  };
}

/** Stable fingerprint of the inputs, so the build can skip unchanged tenants. */
function fingerprint(tokens: StoredToken[]): string {
  const canonical = tokens
    .map((t) => `${t.path}|${t.type}|${t.value}|${t.aliasTarget ?? ''}`)
    .sort()
    .join('\n');
  // FNV-1a — no crypto dependency, and collision resistance is irrelevant here
  // because this only ever gates "did anything change?".
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const toTree = (tokens: StoredToken[]): FoundationTokenTree =>
  unflattenTokens(fromStoredTokens(tokens)) as FoundationTokenTree;

/**
 * Run the full gate for one tenant's theme.
 *
 * Note the ordering guarantee: `output` is only populated when validation
 * passed. A caller cannot accidentally publish a failed translation, because
 * there is nothing to publish.
 */
export function runThemePipeline({
  brandKey,
  theme,
  foundation,
  manifest,
  compatAliases = DEFAULT_COMPAT_ALIASES,
  compatEnabled = true,
  overrides = [],
}: ThemePipelineInput): ThemePipelineResult {
  // Manual overrides are applied first, so everything downstream — validation,
  // translation, the published CSS — sees the value that will actually ship.
  const { tokens: effectiveTheme, applied, orphaned, maskingChange } = applyOverrides(theme, overrides);
  const overrideIssues: ValidationIssue[] = [];
  if (applied.length > 0) {
    overrideIssues.push({
      severity: 'info',
      code: 'override.applied',
      subject: `${applied.length} manual override(s)`,
      message: 'These values are set in the CMS and take precedence over the Figma export.',
      detail: `${applied.slice(0, 6).join(', ')}${applied.length > 6 ? `, … ${applied.length - 6} more` : ''}.`,
    });
  }
  for (const change of maskingChange) {
    overrideIssues.push({
      severity: 'warning',
      code: 'override.masks-figma',
      subject: change.path,
      message: 'Figma has a different value for this token, but the manual override is being published instead.',
      detail: 'Reset this variable under Theme variables if Figma should win.',
    });
  }
  for (const path of orphaned) {
    overrideIssues.push({
      severity: 'warning',
      code: 'override.orphaned',
      subject: path,
      message: 'Overridden token no longer exists in the Figma export — the override does nothing.',
      detail: 'It was probably renamed or removed in Figma. Remove it under Theme variables.',
    });
  }

  const themeFlat = fromStoredTokens(effectiveTheme);

  // Step 1 — source validation. Alias targets are checked against the real
  // Foundation names, so a rename in Figma is caught here rather than becoming
  // a dangling var() later.
  const foundationNames = new Set<string>();
  for (const token of foundation.desktop) {
    const name = token.path.split('.').join('/');
    foundationNames.add(name);
    foundationNames.add(normalizeBrandPath(name));
  }

  const source = validateSource({
    theme: themeFlat,
    brandKey,
    foundationNames: foundationNames.size > 0 ? foundationNames : undefined,
  });

  if (!source.ok) return { validation: source };

  // Step 2 — translate.
  const breakpoints: Record<Breakpoint, FoundationTokenTree> = {
    desktop: toTree(foundation.desktop),
    wideDesktop: toTree(foundation.wideDesktop),
    tablet: toTree(foundation.tablet),
    mobile: toTree(foundation.mobile),
  };

  const aliases = compatEnabled ? compatAliases : [];
  const css = generateTenantCss({
    brandKey,
    foundation: breakpoints,
    theme: unflattenTokens(themeFlat),
    compatAliases: aliases,
  });
  const variables = cssToVariableMap(css);

  // Step 3 — output validation. Aliases are passed separately rather than
  // folded into `variables`: at runtime they make the old names resolve, but
  // the editor still needs to see that the debt exists.
  // Only names the compat block actually emitted are aliases. When Figma
  // legitimately defines a name that also appears in the alias table (a rename
  // that was reverted or never applied), the emitted value is the token's own
  // — not `var(<alias target>)` — and it must count as a real definition.
  const aliasedNames = new Set(
    aliases.filter((a) => variables[a.from] === `var(${a.to})`).map((a) => a.from),
  );
  const tokenVariables = Object.fromEntries(
    Object.entries(variables).filter(([name]) => !aliasedNames.has(name)),
  );

  // Variables owned by other layers (shared/scale) are published by the
  // Foundation document, not this one — references to them are resolvable at
  // runtime and must not read as dangling here. The Foundation gate is what
  // guarantees they exist.
  const layers = ['foundation', 'theme'];
  const otherLayerRequired = manifest.required.filter((t) => {
    const owner = manifest.layer?.[t];
    return owner !== undefined && !layers.includes(owner);
  });

  // What the Foundation document will actually publish (shared + scale) is
  // resolvable at runtime even before the manifest catches up — a shared color
  // added in Figma must not read as dangling in every tenant until the next
  // manifest rebuild.
  const foundationProvides = new Set([
    ...Object.keys(cssToVariableMap(generateGlobalCss('shared', breakpoints))),
    ...Object.keys(cssToVariableMap(generateGlobalCss('scale', breakpoints))),
  ]);

  const output = validateOutput({
    variables: tokenVariables,
    manifest,
    layers,
    compatAliases: toAliasMap(aliases),
    externalVariables: new Set([
      ...manifest.known,
      ...(manifest.external ?? []),
      ...otherLayerRequired,
      ...foundationProvides,
    ]),
  });

  const combined = combine(source, output);
  const validation: ValidationResult = {
    ok: combined.ok,
    issues: [...overrideIssues, ...combined.issues],
  };
  if (!validation.ok) return { validation };

  const { emitted } = generateCompatBlock(aliases, new Set(Object.keys(tokenVariables)));

  return {
    validation,
    output: {
      css,
      variables,
      tokenCount: Object.keys(tokenVariables).length,
      aliasCount: emitted.length,
      sourceHash: fingerprint([...effectiveTheme, ...foundation.desktop]),
    },
  };
}

export interface GlobalPipelineResult {
  validation: ValidationResult;
  output?: {
    shared: { css: string; variables: Record<string, string> };
    scale: { css: string; variables: Record<string, string> };
    sourceHash: string;
  };
}

/** The tenant-independent half: shared.figma.css and scale.figma.css. */
export function runGlobalPipeline(foundation: FoundationSets, manifest: TokenManifest): GlobalPipelineResult {
  const breakpoints: Record<Breakpoint, FoundationTokenTree> = {
    desktop: toTree(foundation.desktop),
    wideDesktop: toTree(foundation.wideDesktop),
    tablet: toTree(foundation.tablet),
    mobile: toTree(foundation.mobile),
  };

  const sharedCss = generateGlobalCss('shared', breakpoints);
  const scaleCss = generateGlobalCss('scale', breakpoints);
  const sharedVars = cssToVariableMap(sharedCss);
  const scaleVars = cssToVariableMap(scaleCss);

  const validation = validateOutput({
    variables: { ...sharedVars, ...scaleVars },
    manifest,
    layers: ['shared', 'scale'],
  });

  if (!validation.ok) return { validation };

  return {
    validation,
    output: {
      shared: { css: sharedCss, variables: sharedVars },
      scale: { css: scaleCss, variables: scaleVars },
      sourceHash: fingerprint(foundation.desktop),
    },
  };
}
