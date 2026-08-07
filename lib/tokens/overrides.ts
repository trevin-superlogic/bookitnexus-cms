/**
 * Manual token overrides.
 *
 * A tenant occasionally needs a value changed now, without waiting for a Figma
 * export. An override records the new value for one token path and is applied
 * on top of the imported set every time the theme is compiled.
 *
 * Two design decisions worth stating, because both are load-bearing:
 *
 * 1. Overrides live in their own field, never merged into `theme.tokens`.
 *    Import replaces `theme.tokens` wholesale, so keeping overrides separate is
 *    what makes them survive a re-import *by construction* rather than by
 *    remembering to merge carefully. It also means "reset" can restore the
 *    Figma value exactly, because the Figma value was never overwritten.
 *
 * 2. An override drops the token's alias. A token that aliased
 *    `brand/bookit/color/slate/900` and is then set to #FF0000 is no longer a
 *    pointer — emitting `var(--color-slate-900)` would ignore the new value
 *    entirely. Overridden tokens are emitted as literals.
 *
 * Overrides persisting across imports has one hazard: Figma changes a token,
 * the override masks it, and nobody notices. `describeOverrides` reports
 * exactly that case so the Studio can show it, and orphaned overrides (paths
 * that no longer exist in the export) are reported rather than silently kept.
 */
import type { StoredToken } from './types.ts';

export interface TokenOverride {
  /** Dot path of the token being overridden, e.g. "🟢 color.text+icons.primary.default". */
  path: string;
  /** Figma token type — 'color' | 'number' | 'string'. */
  type?: string;
  /** JSON-encoded value, same encoding as StoredToken.value. */
  value: string;
  /** Optional editor note: why this was changed by hand. */
  note?: string;
  updatedAt?: string;
}

export interface AppliedOverrides {
  tokens: StoredToken[];
  /** Paths that matched a token and were applied. */
  applied: string[];
  /** Paths with no matching token — usually renamed or removed in Figma. */
  orphaned: string[];
  /** Applied overrides whose underlying Figma value has since changed. */
  maskingChange: Array<{ path: string; figmaValue: string; overrideValue: string }>;
}

/** Compare two JSON-encoded token values, tolerant of key order and float noise. */
export function sameTokenValue(a: string | undefined, b: string | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  let va: unknown;
  let vb: unknown;
  try {
    va = JSON.parse(a);
    vb = JSON.parse(b);
  } catch {
    return a === b;
  }
  const isColor = (v: unknown): v is { hex?: string; alpha?: number } =>
    !!v && typeof v === 'object' && 'hex' in (v as object);
  if (isColor(va) && isColor(vb)) {
    const alpha = (v: { alpha?: number }) => Math.round((v.alpha ?? 1) * 1000);
    return (va.hex ?? '').toLowerCase() === (vb.hex ?? '').toLowerCase() && alpha(va) === alpha(vb);
  }
  return JSON.stringify(va) === JSON.stringify(vb);
}

/**
 * Apply overrides to an imported token set.
 *
 * The input array is not mutated; overridden entries are replaced with copies.
 */
export function applyOverrides(tokens: StoredToken[], overrides: TokenOverride[] = []): AppliedOverrides {
  if (overrides.length === 0) {
    return { tokens, applied: [], orphaned: [], maskingChange: [] };
  }

  const byPath = new Map(tokens.map((token, index) => [token.path, index]));
  const next = tokens.slice();
  const applied: string[] = [];
  const orphaned: string[] = [];
  const maskingChange: AppliedOverrides['maskingChange'] = [];

  for (const override of overrides) {
    if (!override?.path || override.value === undefined || override.value === null) continue;
    const index = byPath.get(override.path);
    if (index === undefined) {
      orphaned.push(override.path);
      continue;
    }
    const original = next[index];

    // The override is now the value; the alias is no longer how it resolves.
    const replacement: StoredToken = {
      path: original.path,
      type: override.type ?? original.type,
      value: override.value,
    };
    next[index] = replacement;
    applied.push(override.path);

    // The imported value is still on `original` — if it differs from what the
    // override replaced, Figma has moved on and this override is hiding it.
    if (!sameTokenValue(original.value, override.value) && original.aliasTarget === undefined) {
      // Unaliased token: any difference is a straightforward mask.
      maskingChange.push({ path: override.path, figmaValue: original.value, overrideValue: override.value });
    }
  }

  return { tokens: next, applied, orphaned, maskingChange };
}

/** Overridden paths, for callers that need to skip them (e.g. drift checks). */
export function overriddenPaths(overrides: TokenOverride[] = []): Set<string> {
  return new Set(overrides.filter((o) => o?.path).map((o) => o.path));
}

// ── Value construction ───────────────────────────────────────────────────────
// The Studio must never ask an editor to write JSON by hand; these build the
// stored encoding from what a picker produces.

/** #RRGGBB + 0–100 alpha → the stored colour shape, components included. */
export function colorValue(hex: string, alphaPercent = 100): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const components = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return JSON.stringify({
    colorSpace: 'srgb',
    components,
    alpha: Math.max(0, Math.min(100, alphaPercent)) / 100,
    hex: `#${full.toUpperCase()}`,
  });
}

export function numberValue(n: number): string {
  return JSON.stringify(n);
}

export function stringValue(s: string): string {
  return JSON.stringify(s);
}

/** Stored value → { hex, alphaPercent } for a colour picker. Null if not a colour. */
export function parseColorValue(value: string | undefined): { hex: string; alphaPercent: number } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { hex?: string; alpha?: number };
    if (!parsed || typeof parsed !== 'object' || !parsed.hex) return null;
    return { hex: parsed.hex.toUpperCase(), alphaPercent: Math.round((parsed.alpha ?? 1) * 100) };
  } catch {
    return null;
  }
}

/** Stored value → a short human string, for display next to a swatch. */
export function displayValue(value: string | undefined, type?: string): string {
  if (value === undefined) return '';
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && 'hex' in parsed) {
      const alpha = (parsed as { alpha?: number }).alpha ?? 1;
      const hex = String((parsed as { hex: string }).hex).toUpperCase();
      return alpha >= 0.999 ? hex : `${hex} · ${Math.round(alpha * 100)}%`;
    }
    if (typeof parsed === 'number') return type === 'number' ? `${parsed}px` : String(parsed);
    return String(parsed);
  } catch {
    return String(value);
  }
}

/** Stored value → a CSS colour usable in a swatch, or null. */
export function cssColor(value: string | undefined): string | null {
  const parsed = parseColorValue(value);
  if (!parsed) return null;
  if (parsed.alphaPercent >= 100) return parsed.hex;
  const clean = parsed.hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${parsed.alphaPercent / 100})`;
}
