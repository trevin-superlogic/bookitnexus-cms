# Where things live, and how a change reaches the Studio

Two different things are often both called "the CMS", and keeping them apart
explains the whole workflow.

**Content lives in Sanity.** Tenants, tokens, brand books, navigation, copy —
everything typed into the Studio. It is stored in the Content Lake, shared by
every build, and needs no deploy. Editors work here and see each other's changes
immediately.

**Structure lives in this repo.** Schemas, field groups, the desk tree, the
import tools, the token pipeline, the site previews. The hosted Studio is a
*build* of this code: `sanity deploy` bundles it and uploads it. There is no
copy of the schema stored in Sanity that can be edited instead — if a field
should exist, it has to exist here first.

So: renaming a tab, adding a field, changing validation → a change in this repo
and a deploy. Filling that field in for a tenant → the Studio, no deploy.

## Deploying

Pushing to `main` deploys automatically (`.github/workflows/deploy.yml`). The
workflow installs, runs the token test suites, and deploys only if they pass.

To deploy by hand:

```bash
npm install
npx sanity login          # add --provider sanity for email/password
npx sanity deploy
```

## Running it locally

Only needed to develop the Studio itself. Editors never need this.

```bash
cp .env.example .env.local   # set SANITY_STUDIO_PROJECT_ID
npm install
npm run dev                  # http://localhost:3333
```

Local and hosted read the same dataset, so a local Studio edits production
content. Point `SANITY_STUDIO_DATASET` elsewhere if that is not what you want.

## What is deliberately not committed

`.env.local` (secrets), `node_modules/`, `dist/`, dataset exports (`*.tar.gz` —
they contain a full copy of the content, drafts included), and `generated-css/`
(regenerable; the tokens in Sanity are the source).

## Secrets

The deploy workflow needs one repository secret:

| Secret | Where it comes from | Permission |
| --- | --- | --- |
| `SANITY_AUTH_TOKEN` | sanity.io/manage → API → Tokens | Deploy Studio |

Nothing else belongs in the repo. Imports run through the editor's own Studio
session, so no write token is needed for day-to-day work.

## Projects

| Project | ID | Use |
| --- | --- | --- |
| Bookit Nexus | `gkcb4giq` | The hosted Studio and its content |

The project ID is set in `.env.local` and falls back to `gkcb4giq` literally in
`sanity.cli.ts` and `sanity.config.ts` — the CLI reads those files before it
loads `.env`, so without the fallback `sanity deploy` cannot find the project.

## Test suites

`npm test` covers the token pipeline: translation parity against the committed
CSS, the publish gate's validation rules, the compatibility aliases, and the
default/override inheritance rules. They run in CI before every deploy because
they are what guarantees published output still matches what the apps consume.
