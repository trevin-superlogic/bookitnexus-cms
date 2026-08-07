/**
 * Compatibility aliases — the bridge that lets design and code move at
 * different speeds.
 *
 * The Figma library is restructured ahead of the frontend. The current example:
 * `color/control/primary/{bg,border}` gained a `filled` / `outlined` level, so
 * `--color-control-primary-bg-default` became
 * `--color-control-primary-filled-bg-default` while 12 source files still
 * reference the old name.
 *
 * Three ways to handle that, and why this is the one:
 *
 *   Block publishing until the frontend catches up — safe, but freezes every
 *   other token change behind one rename.
 *
 *   Publish and let the old names 404 — the properties silently fall back to
 *   their initial values. Nothing errors; the UI is just subtly wrong.
 *
 *   Publish BOTH: emit the new names, and emit the old names as aliases
 *   pointing at them. Nothing breaks, the new vocabulary is available
 *   immediately, and the alias list is an explicit, reviewable record of what
 *   still needs migrating.
 *
 * Aliases are emitted in their own clearly-labelled block at the end of the
 * tenant stylesheet, so they are trivial to find and delete once the frontend
 * has moved. They are meant to be temporary — `deprecatedSince` exists so the
 * Studio can nag about ones that have outlived their usefulness.
 */

export interface CompatAlias {
  /** The old variable the frontend still references. */
  from: string;
  /** The new variable it should resolve to. */
  to: string;
  /** Why the rename happened — shown in the Studio and in the CSS comment. */
  reason?: string;
  /** ISO date the alias was introduced, for staleness reporting. */
  deprecatedSince?: string;
}

export type CompatAliasMap = Record<string, CompatAlias>;

/**
 * Aliases for the Figma `control` restructure.
 *
 * Derived by matching each removed variable against the new export: the
 * `filled` variant is the correct target because the old flat
 * `control/primary/bg` was the filled button treatment — `outlined` is new
 * behaviour that had no previous equivalent.
 */
export const CONTROL_RESTRUCTURE_ALIASES: CompatAlias[] = [
  'bg-default',
  'bg-hover',
  'bg-disabled',
  'border-default',
  'border-hover',
  'border-disabled',
].map((suffix) => ({
  from: `--color-control-primary-${suffix}`,
  to: `--color-control-primary-filled-${suffix}`,
  reason: 'Figma split control/primary into filled and outlined variants.',
  deprecatedSince: '2026-07-28',
}));

export const CONTROL_EMPHASIZED_ALIASES: CompatAlias[] = [
  'bg-default',
  'bg-hover',
  'border-default',
].map((suffix) => ({
  from: `--color-control-primary-emphasized-${suffix}`,
  to: `--color-control-primary-emphasized-filled-${suffix}`,
  reason: 'Figma split control/primary-emphasized into filled and outlined variants.',
  deprecatedSince: '2026-07-28',
}));

/**
 * `control/secondary/<variant>` gained the same filled/outlined level.
 * Confirmed unambiguous by scripts/propose-compat-aliases.ts across all five
 * tenants with committed CSS: only one candidate exists per old name.
 */
export const CONTROL_SECONDARY_ALIASES: CompatAlias[] = ['default', 'on-surface'].flatMap((variant) =>
  ['bg', 'border'].flatMap((property) =>
    ['default', 'hover', 'selected', 'disabled'].map((state) => ({
      from: `--color-control-secondary-${variant}-${property}-${state}`,
      to: `--color-control-secondary-filled-${variant}-${property}-${state}`,
      reason: 'Figma split control/secondary into filled and outlined variants.',
      deprecatedSince: '2026-07-28',
    })),
  ),
);

export const DEFAULT_COMPAT_ALIASES: CompatAlias[] = [
  ...CONTROL_RESTRUCTURE_ALIASES,
  ...CONTROL_EMPHASIZED_ALIASES,
  ...CONTROL_SECONDARY_ALIASES,
];

export const toAliasMap = (aliases: CompatAlias[]): CompatAliasMap =>
  Object.fromEntries(aliases.map((a) => [a.from, a]));

/**
 * Emit the compatibility block.
 *
 * Only aliases whose target actually exists in this tenant's output are
 * emitted — an alias pointing at a variable that isn't published would just
 * move the dangling reference rather than fix it. Skipped aliases are returned
 * so the publish report can show them.
 */
export function generateCompatBlock(
  aliases: CompatAlias[],
  publishedVariables: Set<string>,
): { css: string; emitted: CompatAlias[]; skipped: CompatAlias[] } {
  const emitted: CompatAlias[] = [];
  const skipped: CompatAlias[] = [];

  for (const alias of aliases) {
    // Never shadow a real token: if the export still publishes the old name,
    // that value wins and the alias is redundant.
    if (publishedVariables.has(alias.from)) {
      skipped.push(alias);
      continue;
    }
    if (!publishedVariables.has(alias.to)) {
      skipped.push(alias);
      continue;
    }
    emitted.push(alias);
  }

  if (emitted.length === 0) return { css: '', emitted, skipped };

  const lines = [
    '',
    '/* ── Compatibility aliases ─────────────────────────────────────────────── */',
    '/* Old token names kept alive while the frontend migrates to the new       */',
    '/* Figma structure. Safe to delete once nothing references them.           */',
    ':root {',
  ];

  let lastReason: string | undefined;
  for (const alias of emitted) {
    if (alias.reason && alias.reason !== lastReason) {
      lines.push(`  /* ${alias.reason} */`);
      lastReason = alias.reason;
    }
    lines.push(`  ${alias.from}: var(${alias.to});`);
  }
  lines.push('}');

  return { css: lines.join('\n'), emitted, skipped };
}

/**
 * Propose aliases for variables that disappeared, by finding the new variable
 * whose name differs only by inserted segments.
 *
 * Used by `scripts/propose-compat-aliases.ts` to draft a mapping for human
 * review. Never applied automatically — a plausible name match is not proof of
 * equivalent meaning, and getting it wrong produces a confidently wrong colour.
 */
export function proposeAliases(removed: string[], added: string[]): CompatAlias[] {
  const proposals: CompatAlias[] = [];

  for (const oldName of removed) {
    const oldParts = oldName.replace(/^--/, '').split('-');
    const candidates = added.filter((newName) => {
      const newParts = newName.replace(/^--/, '').split('-');
      if (newParts.length <= oldParts.length) return false;
      // Every segment of the old name must appear in the new name, in order.
      let i = 0;
      for (const part of newParts) if (part === oldParts[i]) i++;
      return i === oldParts.length;
    });

    // Prefer the shortest candidate — fewest inserted segments means the most
    // direct descendant rather than a distant cousin.
    candidates.sort((a, b) => a.length - b.length);
    if (candidates.length > 0) {
      proposals.push({
        from: oldName,
        to: candidates[0],
        reason: candidates.length > 1 ? `Ambiguous — other candidates: ${candidates.slice(1, 4).join(', ')}` : undefined,
      });
    }
  }

  return proposals;
}
