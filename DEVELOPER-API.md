# Style tokens API — for engineering

The CMS **is** the API. Sanity's Content Lake serves every published document
over HTTPS as JSON, no server of ours involved. What your team fetches is the
**compiled output** on each tenant's theme document — the tokens already
translated from Figma names to the exact CSS variable names the apps use today.

Nothing reaches this API unpublished: the Validate & publish gate is the only
writer of compiled output, and a failed validation leaves the last good version
in place.

---

## The endpoints

Project `4u3y1wz4`, dataset `production` (public — reads need no token).

Base URLs (CDN-cached vs. live):

```
https://4u3y1wz4.apicdn.sanity.io/v2024-10-01/data/query/production?query=<GROQ>
https://4u3y1wz4.api.sanity.io/v2024-10-01/data/query/production?query=<GROQ>
```

### 1. Token JSON for one tenant (frontend names → final values)

GROQ:

```groq
*[_id == "brandTheme.bookit"][0].compiled.variablesJson
```

curl (URL-encoded):

```bash
curl -s "https://4u3y1wz4.apicdn.sanity.io/v2024-10-01/data/query/production?query=*%5B_id%20%3D%3D%20%22brandTheme.bookit%22%5D%5B0%5D.compiled.variablesJson"
```

`result` is a JSON string; parse it to get
`{"--color-text-icons-primary-default": "#242A2F", ...}` — every key is the
variable name the apps reference today, every value final. Swap `bookit` for
`cdc`, `moca`, `tria`, `umhp`.

### 2. Ready-to-write CSS for one tenant

```groq
*[_id == "brandTheme.bookit"][0].compiled.css
```

This is the byte-for-byte replacement for `src/theme/<tenant>/<tenant>.figma.css`
— same structure `extract-figma-tokens.ts` produces (verified 226/226 identical
values against the committed files). `compiled.aliasCount` on the same object
reports how many legacy names are being kept alive (currently 9); when it hits
zero the migration is done.

### 3. Shared + scale CSS (tenant-independent)

```groq
*[_id == "foundationTokens.singleton"][0]{ "shared": compiledShared.css, "scale": compiledScale.css }
```

Replaces `packages/ui/src/styles/shared.figma.css` and `scale.figma.css`
(verified identical: scale 30/30, shared 150/150 + 9 additive).

### 4. Everything for a tenant in one call (JS)

```ts
import { createClient } from '@sanity/client';
import { resolveTenantBundle } from '@superlogic/bookit-cms/queries/resolveTenant';

const client = createClient({ projectId: '4u3y1wz4', dataset: 'production', apiVersion: '2024-10-01', useCdn: true });
const bundle = await resolveTenantBundle(client, 'bookit');
// bundle.theme.css / bundle.theme.variables / bundle.theme.sharedCss / bundle.theme.scaleCss
// bundle.config / bundle.copy / bundle.pages
```

### Prebuild integration (the zero-rework path)

In each app's prebuild, replace the `extract-figma-tokens.ts` invocation with:
fetch bundle → write `bundle.theme.css` to `src/theme/<tenant>/<tenant>.figma.css`
and shared/scale to `packages/ui/src/styles/`. `generate-theme.ts` and every
`var(--…)` reference in components stay exactly as they are.

---

## What each Studio tab means

| Tab | What it is |
| --- | --- |
| Tokens | Source of truth as imported from Figma — names, values, and the Figma alias each token points at. Kept verbatim so re-import/diff is always possible. |
| Compiled output | **The API payload** — the translated, renamed, validated result your apps consume. Generated only by Validate & publish. |
| Validation | The gate's last report: what blocked, what's a warning, which source files reference a missing token. |

## Publish flow (who does what)

1. Designer exports variables from Figma (or saves .tokens.json for brands kept
   outside Figma).
2. Anyone drops the file(s) on **Import from Figma** in the Studio, ticks the
   brands to update. Drafts only.
3. **Validate & publish** on each affected tenant. Green = live on the API
   instantly, CDN within a minute.

Rollback is Sanity's document history (Restore on any previous revision, then
publish).
