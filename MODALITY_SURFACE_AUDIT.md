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
