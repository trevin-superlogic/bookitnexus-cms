# Figma Tenant Config variable mapping

Source: `Tenant Config · Template Variables`, Mode 1. Coverage: **85 of 85 variables**.

The Figma export uses fixed numbered slots because Figma variables cannot store arrays. Sanity stores repeatable content as ordered arrays, preserving the same order without imposing a permanent slot limit.

| Figma variables | Count | CMS control | API path |
| --- | ---: | --- | --- |
| Pricing display, VIP collection pricing, show earnings, earnings unit, points name | 5 | Tenant Configuration → Rewards | `config.rewards` |
| Has Sweeps | 1 | Tenant Configuration → Modalities & features | `config.products.hasSweeps` |
| Has points top up | 1 | Tenant Configuration → Commerce → Points top-up | `config.topUp.enabled` |
| VIP headline and subheading | 2 | Modality Content → VIP → Homepage | `modalities.vip.homepage` |
| VIP carousel headings 1–4 | 4 | Modality Content → VIP → Homepage → Carousel headings | `modalities.vip.homepage.carouselHeadings` |
| VIP sweepstakes heading, subheading, and rules | 3 | Modality Content → VIP → Sweepstakes | `modalities.vip.sweepstakes` |
| VIP search hint | 1 | Modality Content → VIP → Search hint | `modalities.vip.searchPlaceholder` |
| Ticketing homepage heading and subheading | 2 | Modality Content → Ticketing → Homepage | `modalities.ticketing.homepage` |
| Featured nav label and visibility | 2 | Shared Content → Navbar → Navigation → Featured item | `shared.navbar.navigation.featured` |
| Level 1 nav labels and visibility, slots 1–7 | 14 | Shared Content → Navbar → Navigation → Primary navigation | `shared.navbar.navigation.primary` |
| VIP level 2 labels and visibility, slots 1–4 | 8 | Shared Content → Navbar → Navigation → VIP sub-navigation | `shared.navbar.navigation.vipSubNav` |
| Ticketing level 2 labels and visibility, slots 1–4 | 8 | Shared Content → Navbar → Navigation → Ticketing sub-navigation | `shared.navbar.navigation.ticketingSubNav` |
| Support phone visibility and number | 2 | Shared Content → Footer → Support contacts | `shared.footer.support.supportPhone` |
| Support email visibility and address | 2 | Shared Content → Footer → Support contacts | `shared.footer.support.supportEmail` |
| ONE legal copy and trademark copy | 2 | Shared Content → Footer → Support contacts | `shared.footer.support.sellerOfTravelCopy`, `trademarkCopy` |
| Points spending, crypto, credit card, and CDC Pay visibility | 4 | Tenant Configuration → Commerce → Payment methods | `config.payments` |
| Onboarding headlines and body copy, slides 1–4 | 8 | Tenant Configuration → Commerce → Login & onboarding → Slides | `config.onboarding.slides` |
| Login, email, verification, and profile headings/subheadings | 8 | Tenant Configuration → Commerce → Login & onboarding | `config.onboarding` |
| Eight identity and consent collection toggles | 8 | Tenant Configuration → Commerce → Login & onboarding → Fields collected at sign-up | `config.onboarding.collectedFields` |

## Navigation parity

The tenant selects `Bookit Nexus` or `Legacy` in Shared Content → Navbar. Both renderers use the same `navigationConfig`:

- featured item
- primary navigation
- VIP sub-navigation
- Ticketing sub-navigation
- account navigation

Every navigation item supports visibility, label, internal path or external URL, optional SVG icon, membership gating, category injection, and emphasis. Existing Nexus slot data remains read-only until migrated.
