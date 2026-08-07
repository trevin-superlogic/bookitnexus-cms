/**
 * Figma name → CSS custom property naming.
 *
 * This is a faithful port of the naming rules in
 * `apps/live-tickets/scripts/extract-figma-tokens.ts`. It must stay
 * byte-compatible with that script: the generated CSS is consumed by
 * hand-written Tailwind classes like `text-(--color-text-icons-brand-default)`
 * across both apps, so a naming change silently breaks styling rather than
 * failing a build.
 *
 * Any change here is a breaking change. See `translate.test.ts`, which asserts
 * parity against the CSS committed in superlogic-ui.
 */

/**
 * Strip leading pictographic emoji from a Figma group name.
 *
 * Figma collections use emoji prefixes for visual grouping ("🟢 color",
 * "🔴tria", "🟠futurec"). These are decoration, not identity.
 *
 * Note: \p{Emoji} matches ASCII digits 0-9, which would eat "scale/400".
 * Extended_Pictographic is the correct property.
 */
export function stripEmoji(str: string): string {
  return String(str)
    .replace(/^[\p{Extended_Pictographic}\s]+/u, '')
    .trim();
}

/**
 * Figma name → URL-safe slug.
 *
 * Rules, in order:
 *   - drop leading emoji
 *   - lowercase
 *   - drop the "·" separator Figma uses in names like "400 · 16"
 *   - "text+icons" → "text-icons"  (alnum + letter)
 *   - a bare "+" → "-plus"         (e.g. "primary+" → "primary-plus")
 *   - anything else non-alphanumeric → "-"
 *   - trim leading/trailing "-"
 */
export function slugify(str: string): string {
  return stripEmoji(str)
    .toLowerCase()
    .replace(/·/g, '')
    .replace(/([a-z0-9])\+([a-z])/g, '$1-$2')
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Path segments → CSS custom property name.
 *
 * Consecutive identical slugs are collapsed. Figma often repeats a name at the
 * group and variable level ("component/bg-disabled/bg-disabled"), which would
 * otherwise produce `--color-component-bg-disabled-bg-disabled`.
 */
export function pathToCssVar(segments: string[]): string {
  const slugs = segments.map(slugify).filter(Boolean);
  const deduped = slugs.filter((s, i) => i === 0 || s !== slugs[i - 1]);
  return `--${deduped.join('-')}`;
}

/**
 * A Figma alias target → the CSS var() it resolves to.
 *
 *   "brand/bookit/color/slate/900" + brand "bookit" → "var(--color-slate-900)"
 *   "shared/color/black/30%"                        → "var(--shared-color-black-30)"
 *   "scale/400 · 16"                                → "var(--scale-400-16)"
 *
 * The `brand/<tenant>/` prefix is stripped because each tenant's foundation
 * primitives are emitted unprefixed into that tenant's own `:root` — the brand
 * segment is expressed by *which file* you load, not by the variable name.
 * That is also why a token aliasing into a *different* brand is a hard error:
 * the var it emits would silently resolve against the wrong brand's primitives.
 */
export function aliasToVar(targetVariableName: string, brandKey: string): string {
  let p = targetVariableName;
  if (p.startsWith('brand/')) {
    const parts = p.split('/');
    // Figma renames sometimes add or drop the emoji marker ("🔴tria" ↔ "tria");
    // the two exports can straddle such a rename, so match emoji-insensitively.
    if (parts.length >= 2 && canonicalBrandKey(parts[1]) === canonicalBrandKey(brandKey)) {
      p = parts.slice(2).join('/');
    }
  }
  return `var(${pathToCssVar(p.split('/'))})`;
}

/** "brand/🔴tria/color/x" → "brand/tria/color/x" — for era-tolerant lookups. */
export function normalizeBrandPath(name: string): string {
  if (!name.startsWith('brand/')) return name;
  const parts = name.split('/');
  if (parts.length >= 2) parts[1] = stripEmoji(parts[1]);
  return parts.join('/');
}

/**
 * The canonical identity of a brand, used for every brand-to-brand comparison.
 *
 * Figma's key, the tenant ID and the CSS directory name are spelled
 * differently for the same brand — "🔴tria" / "tria", "u_e" / "u-e". Slugifying
 * after stripping emoji collapses all of them onto one value, so the tenant ID
 * is the only identifier anyone needs to type.
 */
export function canonicalBrandKey(brandKey: string): string {
  return slugify(stripEmoji(brandKey));
}

/** The brand segment of an alias target, or null if it isn't a brand alias. */
export function aliasBrand(targetVariableName: string): string | null {
  if (!targetVariableName.startsWith('brand/')) return null;
  const parts = targetVariableName.split('/');
  return parts.length >= 2 ? parts[1] : null;
}

/** Tenant slug used for filenames and directories: "🔴tria" → "tria". */
export function brandKeyToSlug(brandKey: string): string {
  return slugify(brandKey);
}
