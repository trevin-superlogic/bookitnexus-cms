# Experiences and Ticketing CMS surface audit

Audited against the live AIR Shop experiences and tickets sites in August 2026. The model makes tenant-owned presentation and marketing content editable without copying commerce records into Sanity.

## Ownership boundary

| Surface                                                                                                  | Owner                          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Hero copy and media, navigation labels, section headings, tile imagery, destinations, metadata, favicons | Sanity                         |
| Which API tag/category populates a homepage collection                                                   | Sanity selector                |
| Experience, package, show, ticket, venue, availability, description and pricing records                  | Experiences or Ticketing API   |
| Entitlement, payment and date-range calculation logic                                                    | Application/configuration code |

## Experiences

Verified routes include the homepage, tag and category listings, sweepstakes, and an experience detail route.

| Live surface                                                       | CMS field                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Hero headline, subheading, desktop/mobile media                    | `vip.homepage.hero`                                                |
| Search placeholder                                                 | `vip.searchPlaceholder`                                            |
| Links below search, including All, Sweeps, Trending and categories | `vip.homepage.secondaryNavigation[]`                               |
| Curated, Trending, Exclusive and Once in a Lifetime carousels      | `vip.homepage.collections[]` with API `sourceType` and `sourceKey` |
| Sports, Music, Culinary and Lifestyle discovery tiles              | `vip.homepage.categoryTiles[]`                                     |
| Search/listing empty states                                        | `vip.searchResults`                                                |
| Reusable detail-page labels, not the API description or price      | `vip.detailPage`                                                   |
| Sweepstakes hero and consent/rules copy                            | `vip.sweepstakes`                                                  |

## Ticketing

Verified routes include the homepage, a category browse route, and an event detail route.

| Live surface                                                                  | CMS field                                                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Hero headline, subheading, desktop/mobile media                               | `ticketing.homepage.hero`                                                        |
| Event and location search placeholders                                        | `ticketing.homepage.searchPlaceholder`, `locationPlaceholder`                    |
| Tomorrow/This weekend/Next weekend/Other dates labels                         | `ticketing.homepage.dateFilterLabels`                                            |
| Popular near visitor, Concerts, Sports and Theater sections                   | `ticketing.homepage.collections[]` with API `sourceType` and optional `sourceId` |
| Concerts, Sports, Theater and Special Events tiles                            | `ticketing.homepage.categoryTiles[]`                                             |
| Las Vegas, New York City, London and Chicago tiles                            | `ticketing.homepage.popularCities[]`                                             |
| Browse hero media and no-event states                                         | `ticketing.browse`                                                               |
| Reusable event-detail labels and pricing disclosure, not event/ticket records | `ticketing.eventDetail`                                                          |

## Metadata and crawlability

Shared Content metadata supplies application name, default title/template, description, favicon, Apple touch icon, social image, browser theme colour, canonical URL, and robots directives. Page Content can override the same object per route.

The live sites currently expose metadata and icons, but `/robots.txt` and `/sitemap.xml` resolve to application 404 pages. The CMS can provide indexing policy and canonical content, but each frontend still needs to generate those two endpoints from its public routes and API-backed detail URLs.

## Environment and code controls

Audited against `apps/bookit/src/env.ts`, `apps/live-tickets/src/env.ts`, their `.env.example` files, and every tenant switch in the two applications. The boundary is intentional: Sanity may choose presentation, destinations, and visible product configuration; it must not become the authority for credentials, authentication, entitlement, or price calculation.

### Already represented in the CMS, but the frontends still need to consume it

| Current frontend control | Current CMS field | Migration note |
| --- | --- | --- |
| `NEXT_PUBLIC_TENANT_ID` / `TENANT` | `tenant.slug` | Keep the deployment/build selector in environment configuration. Use the matching CMS slug to resolve tenant content; do not let an editor change the running tenant. |
| `NEXT_PUBLIC_TRAVEL_URL` | `tenant.externalUrls.travelUrl` | Move the public destination to the CMS resolver, retaining the environment value as a deployment fallback. |
| `NEXT_PUBLIC_EXPERIENCES_URL` | `tenant.externalUrls.experiencesUrl` | Same pattern: CMS value first, environment fallback. |
| `NEXT_PUBLIC_UPGRADE_LINK` | `tenant.externalUrls.upgradeUrl` | CMS may own the destination. Tier eligibility stays in the application/backend. |
| Header/footer links and visibility in tenant-specific `.tsx` files | `sharedContent.navbar`, `sharedContent.footer` | The CMS model exists; Tickets still selects hardcoded tenant components and nav arrays. Replace those switches with the resolved shared-content payload. |
| Logo, favicon, metadata, and tenant-specific metadata switches | `tenant.brandAssets`, `tenant.seo`, shared/page metadata | The model exists; Tickets still has hardcoded logo and metadata switches that should become fallbacks only. |
| Points name and whether earnings/prices are displayed | `tenant.rewards` | CMS owns labels and visibility only. Existing `utils/points.ts` switches should consume these resolved display settings. |
| Visible payment options and points top-up presentation | `tenant.payments`, `tenant.topUp` | CMS controls what is shown. Provider keys, settlement, ratios, and eligibility remain backend-owned. |
| Sweepstakes/product availability | `tenant.features.hasSweeps`, `tenant.enabledProducts` | Frontends should use the resolved product flags for navigation and surface visibility. |
| Legal-page navigation and copy | `sharedContent.footer`, tenant legal-page documents | Tenant-specific Terms/Privacy page switches still need to be replaced by CMS routes/content. |

### Decision required before adding a CMS field

| Current frontend control | Recommendation | Reason |
| --- | --- | --- |
| `NEXT_PUBLIC_DISALLOWED_TIER_CHECKOUT_REDIRECT_URL` | Either map it to `externalUrls.upgradeUrl`, or add a separately named restricted-checkout destination | The destination is editorial/configuration; the tier decision is entitlement logic and must remain outside Sanity. |
| `NEXT_PUBLIC_GTM` | Keep in deployment config unless analytics administration is explicitly in CMS scope | A malformed container ID can affect tracking and compliance across the whole tenant. If moved, restrict it to an administrator-only operational document. |
| `NEXT_PUBLIC_CURRENCY_CODE` | Consider a display-only locale/currency preference in tenant configuration | Safe only if it changes formatting. It must not set settlement currency or authoritative conversion. |

### Keep outside Sanity

| Controls | Owner |
| --- | --- |
| API and SLAPI URLs, SLAPI auth keys | Deployment/secrets management |
| Keycloak issuer/client IDs/secrets, NextAuth URL/domain/secret, mobile-auth credentials | Identity platform and deployment/secrets management |
| `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_URL`, `PORT` | Deployment/runtime configuration |
| `NEXT_PUBLIC_FEE_PERCENTAGE`, `NEXT_PUBLIC_MARGIN_PERCENTAGE` | Commerce backend or protected server configuration |
| `NEXT_PUBLIC_FOREIGN_CURRENCY_AMOUNT`, `NEXT_PUBLIC_EXCHANGE_RATE` | Pricing/FX service; never editorial content |
| Locked membership tiers, points conversion rates, checkout eligibility, web3 points behavior | Entitlement/rewards backend and application code |
| `SANITY_API_READ_TOKEN` | Server-only secrets management |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`, dataset, and Studio URL | Deployment integration configuration |

`NEXT_PUBLIC_DEMO_MODE` exists only in the staged Bookit/VIP shell created for this local workflow and is not a proposed production CMS control.

