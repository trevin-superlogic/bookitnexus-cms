/**
 * Figma Variables → DTCG token export shapes.
 *
 * These mirror exactly what the Figma "Export variables" plugin emits for the
 * two collections that matter to us:
 *
 *   📐 Foundation · Breakpoint  → desktop / wide desktop / tablet / mobile .tokens.json
 *                                 (primitives: brand/<tenant>/*, shared/*, scale/*)
 *   🟢 Theme · Brand            → <tenant>.tokens.json
 *                                 (semantic aliases pointing into Foundation)
 *
 * Nothing here is Sanity-specific — this module is shared by the Studio, the
 * publish gate, and the build-time consumer in superlogic-ui.
 */

export interface FigmaColorValue {
  /** e.g. "#242A2F" — Figma emits uppercase with a leading '#'. */
  hex: string;
  /** 0..1. Absent is treated as 1. */
  alpha?: number;
  /** [r, g, b] as 0..1 floats. Required to render rgba() when alpha < 1. */
  components?: number[];
  colorSpace?: string;
}

export interface FigmaAliasData {
  targetVariableId?: string;
  /** e.g. "brand/bookit/color/slate/900", "shared/color/black/30%", "scale/400 · 16" */
  targetVariableName: string;
  targetVariableSetId?: string;
  /** e.g. "📐 Foundation · Breakpoint" */
  targetVariableSetName?: string;
}

export interface FigmaExtensions {
  'com.figma.aliasData'?: FigmaAliasData;
  'com.figma.variableId'?: string;
  'com.figma.scopes'?: string[];
  'com.figma.type'?: string;
  'com.figma.modeName'?: string;
  [key: string]: unknown;
}

export type FigmaTokenType = 'color' | 'number' | 'string' | 'boolean';

export type FigmaTokenValue = string | number | boolean | FigmaColorValue | Record<string, unknown>;

export interface FigmaToken {
  $type: FigmaTokenType;
  $value: FigmaTokenValue;
  $extensions?: FigmaExtensions;
}

/** A nested export tree. Leaves are FigmaToken, branches are further trees. */
export interface FigmaTokenTree {
  [key: string]: FigmaToken | FigmaTokenTree | FigmaExtensions | undefined;
}

/** Foundation exports nest primitives under these three roots. */
export interface FoundationTokenTree extends FigmaTokenTree {
  brand?: Record<string, FigmaTokenTree>;
  shared?: FigmaTokenTree;
  scale?: FigmaTokenTree;
}

/** Dot-path → token. Path segments are the *raw* Figma names, pre-slugify. */
export type FlatTokens = Record<string, FigmaToken>;

/**
 * The storage shape inside Sanity. We keep tokens flat rather than nested:
 * a 307-entry flat array is editable and diffable in the Studio, whereas a
 * 6-level nested object is neither. `path` round-trips back to the Figma tree.
 */
export interface StoredToken {
  /** Dot-joined raw Figma path, e.g. "🟢 color.text+icons.primary.default" */
  path: string;
  type: FigmaTokenType;
  /** JSON-encoded $value. Colors keep their full {hex, alpha, components} shape. */
  value: string;
  /** aliasData.targetVariableName, when this token is an alias. */
  aliasTarget?: string;
  /** aliasData.targetVariableSetName — used to detect cross-collection drift. */
  aliasCollection?: string;
}

export type Breakpoint = 'desktop' | 'wideDesktop' | 'tablet' | 'mobile';

export const BREAKPOINT_MEDIA: Record<Exclude<Breakpoint, 'desktop'>, string> = {
  wideDesktop: 'min-width: 1512px',
  tablet: 'max-width: 1199px',
  mobile: 'max-width: 767px',
};

/** Order matters: desktop is the base layer, the rest are diffed against it. */
export const BREAKPOINT_ORDER: Breakpoint[] = ['desktop', 'wideDesktop', 'tablet', 'mobile'];
