/**
 * Conversion between the nested Figma export tree, the flat dot-path map the
 * translator works on, and the flat array Sanity stores.
 *
 * Flattening is lossless for our purposes: the dot-path preserves the raw
 * Figma segment names, so `unflatten(flatten(tree))` round-trips.
 */
import type { FigmaToken, FigmaTokenTree, FlatTokens, StoredToken } from './types.ts';

/** Keys that are token metadata rather than child groups. */
const RESERVED = new Set(['$type', '$value', '$extensions', '$description']);

function isToken(value: unknown): value is FigmaToken {
  return !!value && typeof value === 'object' && '$type' in (value as object) && '$value' in (value as object);
}

/**
 * Nested tree → { "a.b.c": token }.
 *
 * Segment names are kept verbatim (emoji, spaces, "·" and all) — slugification
 * happens later, at CSS-emit time, so that the stored path stays a faithful
 * pointer back into the Figma collection.
 */
export function flattenTokens(tree: FigmaTokenTree, prefix: string[] = []): FlatTokens {
  const result: FlatTokens = {};
  for (const [key, value] of Object.entries(tree)) {
    if (RESERVED.has(key)) continue;
    if (isToken(value)) {
      result[prefix.concat(key).join('.')] = value;
    } else if (value && typeof value === 'object') {
      Object.assign(result, flattenTokens(value as FigmaTokenTree, prefix.concat(key)));
    }
  }
  return result;
}

/** { "a.b.c": token } → nested tree. Inverse of flattenTokens. */
export function unflattenTokens(flat: FlatTokens): FigmaTokenTree {
  const root: FigmaTokenTree = {};
  for (const [dotPath, token] of Object.entries(flat)) {
    const segments = dotPath.split('.');
    let node = root as Record<string, unknown>;
    for (const segment of segments.slice(0, -1)) {
      if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {};
      node = node[segment] as Record<string, unknown>;
    }
    node[segments[segments.length - 1]] = token;
  }
  return root;
}

/**
 * Flat token map → the array Sanity persists.
 *
 * $value is JSON-encoded so that colors keep their full
 * {colorSpace, components, alpha, hex} shape. We need `components` to render
 * rgba() for translucent tokens; storing only the hex would lose alpha.
 */
export function toStoredTokens(flat: FlatTokens): StoredToken[] {
  return Object.entries(flat).map(([path, token]) => {
    const alias = token.$extensions?.['com.figma.aliasData'];
    const stored: StoredToken = {
      path,
      type: token.$type,
      value: JSON.stringify(token.$value),
    };
    if (alias?.targetVariableName) stored.aliasTarget = alias.targetVariableName;
    if (alias?.targetVariableSetName) stored.aliasCollection = alias.targetVariableSetName;
    return stored;
  });
}

/** Sanity's stored array → the flat map the translator consumes. */
export function fromStoredTokens(stored: StoredToken[]): FlatTokens {
  const flat: FlatTokens = {};
  for (const entry of stored) {
    const token: FigmaToken = {
      $type: entry.type,
      $value: JSON.parse(entry.value),
    };
    if (entry.aliasTarget) {
      token.$extensions = {
        'com.figma.aliasData': {
          targetVariableName: entry.aliasTarget,
          targetVariableSetName: entry.aliasCollection,
        },
      };
    }
    flat[entry.path] = token;
  }
  return flat;
}


/**
 * Resolve `{a.b.c}` string references in `tree` against `root`, returning a
 * deep copy with literal values.
 *
 * Used when a brand's Foundation section is split out to its tenant document:
 * cross-brand references (umhp pointing into u_e's slates, say) would no
 * longer have the other brand's data available at translate time, so they are
 * baked to literals here, while the whole export is still in hand.
 */
export function resolveValueRefs(tree: FigmaTokenTree, root: FigmaTokenTree): FigmaTokenTree {
  const lookup = (dotPath: string): FigmaToken | null => {
    let node: unknown = root;
    for (const segment of dotPath.split('.')) {
      if (!node || typeof node !== 'object') return null;
      node = (node as Record<string, unknown>)[segment];
    }
    return isToken(node) ? node : null;
  };

  const resolveValue = (value: unknown, depth: number): unknown => {
    if (depth > 10) return value;
    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
      const target = lookup(value.slice(1, -1));
      if (target) return resolveValue(target.$value, depth + 1);
    }
    return value;
  };

  const walk = (node: FigmaTokenTree): FigmaTokenTree => {
    const out: FigmaTokenTree = {};
    for (const [key, value] of Object.entries(node)) {
      if (isToken(value)) {
        out[key] = { ...value, $value: resolveValue(value.$value, 0) } as FigmaToken;
      } else if (value && typeof value === 'object') {
        out[key] = walk(value as FigmaTokenTree);
      } else {
        out[key] = value as FigmaTokenTree[string];
      }
    }
    return out;
  };

  return walk(tree);
}
