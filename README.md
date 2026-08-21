# BookitCMS — multi-tenant Sanity Studio

Implements `multi_tenant_sanity_cms_pdp.md`: tenant configuration, Figma-structured
style tokens with a translation + validation publish gate, and shared/product/page content, all
delivered pre-resolved through the API.

Tenants: `bookit`, `cdc`, `moca`, `tria`, `umhp`, `qiibee`.
Products: **Ticketing** (`apps/live-tickets`), **VIP** (`apps/bookit`), **Hotels** (Vite app), Marketing.

---

## Read this first — three things found while building

**1. The Figma exports are ahead of the frontend, and publishing them as-is would break styling.**

The Theme · Brand library restructured `color/control/*`: `primary/bg/default` became
`primary/filled/bg/default`. The new export adds 59 variables per tenant and drops 22 — and
`--color-control-primary-border-default` alone is referenced in 12 source files.

This is handled, not blocked. See [Compatibility aliases](#compatibility-aliases).

**2. Three theme files alias into the wrong brand.**

| Export | Aliases into | Should be |
| --- | --- | --- |
| `actai.tokens.json` | `brand/umhp/*` | `brand/actai/*` |
| `jayz30.tokens.json` | `brand/jumper/*` | `brand/jayz30/*` |
| `umpulse.tokens.json` | `brand/🔴tria/*` | `brand/umhp/*` |

This is the worst failure mode in the whole pipeline, because it does not look like a failure. The
`brand/<x>/` prefix is stripped when emitting CSS — each tenant's primitives go into that tenant's
own `:root` unprefixed — so a token pointing at another brand emits a variable that resolves against
*this* tenant's primitive of the same name. The page renders. The colour is just wrong.

`validateSource` blocks publishing on this. Worth fixing in Figma regardless.

**3. `umhp` has been redesigned light → dark.** 111 of its 226 semantic tokens changed value; its
text tokens now alias into `shared/color/white/*`. Expected, and recorded in `translate.test.ts`.

---

## What is verified

`npm test` runs against the real Figma exports and the real superlogic-ui checkout — no fixtures.

| Suite | Asserts |
| --- | --- |
| `translate.test.ts` | For every variable in both the new export and the committed CSS, the value is **identical** — 226/226 across bookit, cdc, moca, tria. This is the proof that the port of `extract-figma-tokens.ts` is exact. |
| `validate.test.ts` | 16 assertions: the seven clean exports pass; actai/jayz30/umpulse are blocked on cross-brand aliasing; self-references and dangling `var()` are caught. |
| `compat.test.ts` | 12 assertions: all 307 export tokens are accounted for, aliases keep the 9 renamed variables resolving, and the gate goes from 9 blockers to 0. |
| `inheritance.test.ts` | 15 assertions on the default/override rules — including that `false` overrides `true` and `0` overrides a non-zero default. |

```bash
npm test
npm run tokens:drift             # structural diff: new exports vs. committed CSS
npm run tokens:propose-aliases   # draft aliases for anything newly dropped
```

---

## Setup

**New to this / not a developer? Read [SETUP.md](./SETUP.md) instead** — same thing,
but every step spelled out, including installing Node and deploying to a shareable URL.

```bash
cp .env.example .env.local        # add SANITY_STUDIO_PROJECT_ID + SANITY_WRITE_TOKEN
npm install
npm run seed                      # tenants + universal defaults
npm run tokens:import -- --dir ./figma-exports
npm run dev                       # http://localhost:3333
npx sanity deploy                 # → https://<hostname>.sanity.studio
```

The ten Theme · Brand exports are bundled in `figma-exports/theme/`, so the import
works immediately.

`tokens:import` writes **drafts only**. Nothing reaches the API until someone clicks
**Validate & publish** — an import is exactly when a bad export is most likely to arrive.

### Figma export layout

```
figma-exports/
  foundation/         ← 📐 Foundation · Breakpoint
    desktop.tokens.json
    wide desktop.tokens.json
    tablet.tokens.json
    mobile.tokens.json
  theme/              ← 🟢 Theme · Brand
    bookit.tokens.json
    …
```

> The `foundation/` exports were not included in what I received — only Theme · Brand. Everything is
> built and tested against the theme layer; **drop those four files in and the foundation half runs
> without code changes.** Until then, `--color-slate-*` and friends come from the committed CSS.

---

## Structure

```
lib/tokens/        translation + validation. No Sanity imports — the same code runs in the
                   Studio, in CI, and in the superlogic-ui build, so the Studio cannot pass
                   something the build then rejects.
  naming.ts        Figma name → CSS variable. Byte-compatible with extract-figma-tokens.ts.
  translate.ts     token tree → CSS, with breakpoint diffing
  validate.ts      source + output validation
  compat.ts        old → new variable aliases
  pipeline.ts      the four PDP publish steps, in order
lib/resolve/       universal default + tenant override merging
schemas/           tenant configuration, cross-modality shared content,
                   modality content, pages, brand, and theme types
actions/           the publish gate
queries/           GROQ + resolveTenantBundle()
scripts/           manifest builder, importer, seeder, alias proposer
```

---

## The publish gate

Replaces Sanity's stock publish on `brandTheme` and `foundationTokens` — the default action is
removed, not merely supplemented, since leaving it would make the gate optional.

```
Edit tokens
    ↓
Validate source        cross-brand aliases, unresolved targets, placeholders, empty values
    ↓
Translate              Figma structure → frontend CSS structure
    ↓
Validate output        every token the apps reference is present and resolves
    ├── failed  →  publish blocked, per-token errors naming the referencing files
    └── passed  →  compiled output written to the draft, then published
```

Because compiled output is written immediately before publishing, the published document always
carries output built from exactly the tokens being published — and a failed validation leaves the
previous published version untouched. That is the PDP's "the published API response must always
contain the last successfully validated version".

### Compatibility aliases

Design ships ahead of code. Rather than freezing every token change behind one rename, or publishing
and letting old names silently fall back to their initial values, the export is a **superset**:

- every token in the Figma export is emitted, including vocabulary nothing consumes yet
- renamed variables get an alias block so old names keep resolving:
  `--color-control-primary-bg-default: var(--color-control-primary-filled-bg-default);`
- the gate downgrades an aliased token from **block** to **warning** — visible debt, not a wall
- genuinely new tokens are reported as an informational note, never a fault

Currently 9 aliases across the `control` restructure. Run `npm run tokens:propose-aliases` after any
Figma change; it drafts mappings for review but never applies them, because a name match is not proof
of equivalent meaning.

Turn the block off per tenant with **Emit compatibility aliases** once nothing references the old
names. `compiled.aliasCount` reaching zero is the signal that the migration is done.

---

## Inheritance

```
Universal default  +  optional tenant override  →  resolved response
```

| Tenant field | Result |
| --- | --- |
| unset / `null` | inherits |
| any value, including `false` and `0` | overrides |
| `""` or whitespace | inherits, **and warns** |
| `visible: false` | removed from the response |

The `false` and `0` cases are the reason this is a tested function rather than GROQ `coalesce()`
chains: a falsy check means a tenant can never switch off something the default switches on, and
that bug is invisible until a tenant asks why their toggle does nothing.

Empty strings inherit *and* warn because both alternatives are worse — overriding ships blank UI, and
inheriting silently makes the editor think they cleared it. Hiding is always an explicit toggle.

Arrays replace wholesale. Merging by index means overriding item 2 of a 5-item default produces a
chimera no editor predicted.

---

## Consuming from superlogic-ui

Tenancy stays build-time, as it is today.

```ts
import { resolveTenantBundle } from '@superlogic/bookit-cms/queries/resolveTenant';

const bundle = await resolveTenantBundle(client, process.env.TENANT!);
// bundle.config  — resolved, visibility applied, no inheritance left
// bundle.shared  — resolved navbar, footer, metadata, and shared content
// bundle.modalities — resolved Ticketing, VIP, Hotels, and Marketing controls
// bundle.copy    — flat key → text
// bundle.pages   — keyed by route
// bundle.theme   — { css, variables, sharedCss, scaleCss }
```

The prebuild step writes `bundle.theme.css` to `src/theme/<tenant>/<tenant>.figma.css` and the
shared/scale files to `packages/ui/src/styles/`, replacing `extract-figma-tokens.ts` while
`generate-theme.ts` stays exactly as it is.

**Not yet wired up** — this session covers the Studio. The frontend integration is the next step:
`fetchTenantBundle` in `src/fetcher/`, the prebuild token generation, and replacing the ~40
`switch (NEXT_PUBLIC_TENANT_ID)` branches.

### Keeping the manifest current

`schemas/tokens/required-tokens.json` records which CSS variables the apps actually reference — the
contract output validation checks against. It is generated, not hand-written:

```bash
npm run tokens:manifest -- --repo ../superlogic-ui
```

Current: 180 required (90 theme, 88 shared, 1 scale, 1 foundation), 399 known-but-unreferenced, and
105 correctly excluded as *not* CMS-owned — shadcn system vars and legacy spree-pay names, which the
CMS must not be blamed for.

---

## Boundaries

Managed here: display settings, product availability, rewards **labels**, navigation, brand assets,
style tokens, copy.

Managed outside, deliberately: secrets, API endpoints, payment rules, pricing, points **conversion**,
tier eligibility. Payment toggles here control what a user *sees*; keys and ratios stay in the
SpreePay tenant config API. Top-up prices are display labels — the amount charged is settled
server-side.

`apps/bookit` currently hardcodes `X-Tenant-ID: 'bookit'` with a `// TODO: Update tenant`. That is
the seam for giving VIP a real tenant axis.
