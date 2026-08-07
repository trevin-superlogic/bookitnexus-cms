/**
 * Universal default + optional tenant override → resolved tenant response.
 *
 * The PDP's rules, and how each is implemented:
 *
 *   "An unset tenant field inherits the universal default."
 *       → undefined / null / absent key inherits.
 *
 *   "A populated tenant field overrides the universal default."
 *       → any other value overrides, INCLUDING false and 0. Those are real
 *         values; treating them as unset is the classic falsy-check bug that
 *         makes a tenant unable to turn off something the default turns on.
 *
 *   "Empty strings should not be used to control inheritance."
 *       → "" and whitespace-only inherit AND raise a warning. If they
 *         overrode, an editor who cleared a field would ship blank UI; if they
 *         inherited silently, the editor would think they'd cleared it. So we
 *         inherit and tell them to use the visibility toggle instead.
 *
 *   "Hiding content requires an explicit visibility setting."
 *       → `visible: false` on the containing object. Never inferred from
 *         emptiness.
 *
 * Resolution runs here, in the API layer, so that — per the PDP — applications
 * never need to understand tenant inheritance.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

export interface ResolveWarning {
  /** Dot path into the resolved object, e.g. "footer.supportEmail". */
  path: string;
  code: 'empty-string-inherits' | 'override-type-mismatch' | 'theme-fallback';
  message: string;
}

export interface ResolveResult<T> {
  value: T;
  warnings: ResolveWarning[];
  /** Dot paths the tenant actually overrode — useful for "what's customised?" UI. */
  overridden: string[];
}

const isPlainObject = (v: unknown): v is Record<string, Json | undefined> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isBlankString = (v: unknown): boolean => typeof v === 'string' && v.trim() === '';

/**
 * Deep-merge a tenant override onto a universal default.
 *
 * Objects merge key by key. Arrays REPLACE wholesale — index-wise array
 * merging produces results no editor can predict (override element 2 of a
 * 5-item default and you get a chimera). A tenant that sets nav items sets all
 * of them.
 */
export function resolveWithDefaults<T>(defaults: unknown, override: unknown): ResolveResult<T> {
  const warnings: ResolveWarning[] = [];
  const overridden: string[] = [];

  const merge = (base: unknown, patch: unknown, path: string): unknown => {
    if (patch === undefined || patch === null) return base;

    if (isBlankString(patch)) {
      // Only worth warning about when there was something to inherit.
      if (base !== undefined && base !== null) {
        warnings.push({
          path,
          code: 'empty-string-inherits',
          message:
            `"${path}" was cleared to an empty string, so it falls back to the universal default. ` +
            'To hide this content, set its visibility toggle to off instead.',
        });
      }
      return base;
    }

    if (Array.isArray(patch)) {
      if (path) overridden.push(path);
      return patch;
    }

    if (isPlainObject(patch)) {
      if (!isPlainObject(base)) {
        // No default to merge into (or the default is a scalar) — take the
        // override wholesale rather than silently dropping half of it.
        if (base !== undefined && base !== null && path) {
          warnings.push({
            path,
            code: 'override-type-mismatch',
            message: `"${path}" is an object in the tenant override but a ${typeof base} in the default. Using the override.`,
          });
        }
        if (path) overridden.push(path);
        return patch;
      }
      const out: Record<string, unknown> = { ...base };
      for (const key of Object.keys(patch)) {
        const childPath = path ? `${path}.${key}` : key;
        const merged = merge(base[key], patch[key], childPath);
        if (merged !== undefined) out[key] = merged;
      }
      return out;
    }

    if (path) overridden.push(path);
    return patch;
  };

  return { value: merge(defaults, override, '') as T, warnings, overridden };
}

/**
 * Strip anything switched off via an explicit `visible: false`.
 *
 * Applied after merging, so a tenant can hide a block the default shows, or
 * re-show one the default hides. The `visible` key itself is removed from the
 * output — apps receive only what they should render.
 */
export function applyVisibility<T>(value: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(walk).filter((child) => child !== undefined);
    }
    if (isPlainObject(node)) {
      if (node.visible === false) return undefined;
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) {
        if (key === 'visible') continue;
        const resolved = walk(child);
        if (resolved !== undefined) out[key] = resolved;
      }
      return out;
    }
    return node;
  };
  return walk(value) as T;
}

/**
 * The full pipeline for one section: merge, then apply visibility.
 * This is what the GROQ-backed API handler calls per section.
 */
export function resolveSection<T>(defaults: unknown, override: unknown): ResolveResult<T> {
  const merged = resolveWithDefaults<T>(defaults, override);
  return { ...merged, value: applyVisibility(merged.value) };
}
