/**
 * GROQ queries backing the API.
 *
 * Each returns the RAW default and tenant documents rather than a merged
 * result. GROQ has no deep-merge, and expressing "undefined inherits but false
 * overrides" in coalesce() chains would need one hand-written expression per
 * field — hundreds of them, each a chance to write `coalesce(a, b)` where a
 * legitimate `false` silently loses to the default.
 *
 * So the split is: GROQ fetches, `lib/resolve/inheritance.ts` merges. The
 * merge is one tested function instead of hundreds of untested expressions,
 * and `resolveTenantBundle` below is the only thing callers touch — per the
 * PDP, applications never see the inheritance.
 */

/** Fields shared by the default and tenant copies of the experience config. */
const EXPERIENCE_CONFIG_PROJECTION = /* groq */ `{
  products,
  externalUrls,
  rewards,
  navigation,
  footer,
  payments,
  topUp,
  onboarding,
  seo,
  "brandAssets": brandAssets {
    "headerLogo":     headerLogo{ "url": asset->url, "mimeType": asset->mimeType, alt, href },
    "footerLogo":     footerLogo{ "url": asset->url, "mimeType": asset->mimeType, alt },
    "favicon":        favicon{ "url": asset->url, "mimeType": asset->mimeType },
    "openGraphImage": openGraphImage{ "url": asset->url, alt },
    "browseHeroImage": browseHeroImage{ "url": asset->url, alt, hotspot, crop }
  }
}`;

const NAV_ITEM_PROJECTION = /* groq */ `{
  _key,
  visible,
  label,
  url,
  requiresTier,
  showCategoryTags,
  emphasis,
  "iconSvg": iconSvg{ "url": asset->url, "mimeType": asset->mimeType, alt }
}`;

const NAVIGATION_PROJECTION = /* groq */ `{
  "featured": featured ${NAV_ITEM_PROJECTION},
  "primary": primary[] ${NAV_ITEM_PROJECTION},
  "vipSubNav": vipSubNav[] ${NAV_ITEM_PROJECTION},
  "ticketingSubNav": ticketingSubNav[] ${NAV_ITEM_PROJECTION},
  "accountNav": accountNav[] ${NAV_ITEM_PROJECTION}
}`;

const NAVBAR_PROJECTION = /* groq */ `{
  variant,
  "primaryLogo": primaryLogo{ "url": asset->url, "mimeType": asset->mimeType, alt, href },
  "navigation": navigation ${NAVIGATION_PROJECTION},
  auth,
  nexus {
    "primaryLogo": primaryLogo{ "url": asset->url, "mimeType": asset->mimeType, alt, href },
    auth,
    slots[]{ _key, visible, label, url, icon, emphasis }
  },
  legacy {
    "primaryLogo": primaryLogo{ "url": asset->url, "mimeType": asset->mimeType, alt, href },
    "navigation": navigation ${NAVIGATION_PROJECTION},
    auth
  }
}`;

const METADATA_PROJECTION = /* groq */ `{
  applicationName,
  title,
  titleTemplate,
  description,
  canonicalUrl,
  themeColor,
  noIndex,
  noFollow,
  "favicon": favicon{ "url": asset->url, "mimeType": asset->mimeType },
  "appleTouchIcon": appleTouchIcon{ "url": asset->url, "mimeType": asset->mimeType },
  "socialImage": socialImage{ "url": asset->url, "mimeType": asset->mimeType, alt, hotspot, crop }
}`;

const SHARED_CONTENT_PROJECTION = /* groq */ `{
  "navbar": navbar ${NAVBAR_PROJECTION},
  footer,
  "metadata": metadata ${METADATA_PROJECTION},
  spreePay,
  entries[]{ _key, key, value, visible },
  legal[]{ _key, slug, title, body, visible }
}`;

const IMAGE_PROJECTION = /* groq */ `{
  "url": asset->url,
  "mimeType": asset->mimeType,
  "metadata": asset->metadata{ lqip, dimensions },
  alt,
  hotspot,
  crop
}`;

const HERO_PROJECTION = /* groq */ `{
  heading,
  subheading,
  "image": image ${IMAGE_PROJECTION},
  "mobileImage": mobileImage ${IMAGE_PROJECTION}
}`;

const EDITORIAL_LINK_PROJECTION = /* groq */ `{
  _key,
  visible,
  label,
  url,
  iconName,
  "iconSvg": iconSvg{ "url": asset->url, "mimeType": asset->mimeType, alt }
}`;

const DISCOVERY_TILE_PROJECTION = /* groq */ `{
  _key,
  visible,
  label,
  sourceId,
  url,
  "image": image ${IMAGE_PROJECTION}
}`;

const MODALITY_CONTENT_PROJECTION = /* groq */ `{
  "modality": coalesce(modality, product),
  ticketing {
    searchPlaceholder,
    secondaryNavigation[] ${EDITORIAL_LINK_PROJECTION},
    homepage {
      "hero": hero ${HERO_PROJECTION},
      locationPlaceholder,
      dateFilterLabels,
      collections[]{ _key, visible, heading, sourceType, sourceId, itemLimit, viewAllLabel, viewAllUrl },
      categoryTiles[] ${DISCOVERY_TILE_PROJECTION},
      popularCities[] ${DISCOVERY_TILE_PROJECTION},
      heading,
      subheading
    },
    browse {
      "heroImage": heroImage ${IMAGE_PROJECTION},
      "mobileHeroImage": mobileHeroImage ${IMAGE_PROJECTION},
      resultsHeading,
      emptyHeading,
      emptyBody
    },
  },
  vip {
    searchPlaceholder,
    secondaryNavigation[] ${EDITORIAL_LINK_PROJECTION},
    homepage {
      "hero": hero ${HERO_PROJECTION},
      collections[]{ _key, visible, heading, sourceType, sourceKey, itemLimit, viewAllLabel, viewAllUrl },
      categoryTiles[] ${DISCOVERY_TILE_PROJECTION},
      heading,
      subheading,
      carouselHeadings[]
    },
    searchResults,
    sweepstakes {
      "hero": hero ${HERO_PROJECTION},
      heading,
      subheading,
      rulesText
    }
  },
  entries[]{ _key, key, value, visible }
}`;

const PAGE_PROJECTION = /* groq */ `{
  route,
  heading,
  subheading,
  sections[]{ key, heading, body, ctaLabel, ctaUrl, disclaimer, visible, "image": image{ "url": asset->url, alt } },
  entries[]{ key, value, visible },
  "metadata": metadata ${METADATA_PROJECTION},
  seo
}`;

/**
 * Everything needed to resolve one tenant, in a single round trip.
 *
 * Published output only: `compiled` is written by the publish gate, so a
 * failing draft cannot reach this response — the last validated version stays
 * served.
 */
export const TENANT_BUNDLE_QUERY = /* groq */ `{
  "tenant": *[_type == "tenant" && slug.current == $tenant && active != false][0]{
    "id": slug.current, title, figmaBrandKey, domain, enabledProducts
  },

  "configDefault":  *[_id == "default.experienceConfig"][0] ${EXPERIENCE_CONFIG_PROJECTION},
  "configOverrideLegacy": *[_type == "experienceConfig" && tenant->slug.current == $tenant][0] ${EXPERIENCE_CONFIG_PROJECTION},
  "configOverride": *[_type == "tenant" && slug.current == $tenant][0]{
    "products": {
      "hasTicketing": "ticketing" in enabledProducts,
      "hasVipExperiences": "vip" in enabledProducts,
      "hasHotels": "hotels" in enabledProducts,
      "hasSweeps": features.hasSweeps
    },
    externalUrls,
    rewards,
    payments,
    topUp,
    onboarding,
    seo,
    "brandAssets": brandAssets {
      "headerLogo":     headerLogo{ "url": asset->url, "mimeType": asset->mimeType, alt, href },
      "footerLogo":     footerLogo{ "url": asset->url, "mimeType": asset->mimeType, alt },
      "favicon":        favicon{ "url": asset->url, "mimeType": asset->mimeType },
      "openGraphImage": openGraphImage{ "url": asset->url, alt },
      "browseHeroImage": browseHeroImage{ "url": asset->url, alt, hotspot, crop }
    }
  },

  "sharedDefault":  *[_id == "default.sharedContent"][0] ${SHARED_CONTENT_PROJECTION},
  "sharedOverride": *[_type == "sharedContent" && tenant->slug.current == $tenant][0] ${SHARED_CONTENT_PROJECTION},

  "productDefaults":  *[_type == "productContent" && !defined(tenant)] ${MODALITY_CONTENT_PROJECTION},
  "productOverrides": *[_type == "productContent" && tenant->slug.current == $tenant] ${MODALITY_CONTENT_PROJECTION},

  "pageDefaults":  *[_type == "pageContent" && !defined(tenant)] ${PAGE_PROJECTION},
  "pageOverrides": *[_type == "pageContent" && tenant->slug.current == $tenant] ${PAGE_PROJECTION},

  "themeOverride": *[_type == "brandTheme" && tenant->slug.current == $tenant][0]{
    "css": compiled.css,
    "variables": compiled.variablesJson,
    "compiledAt": compiled.compiledAt,
    "sourceHash": compiled.sourceHash,
    "tokenCount": compiled.tokenCount,
    "aliasCount": compiled.aliasCount,
    "status": validation.status
  },

  "themeDefault": *[_id == "default.brandTheme"][0]{
    "sourceTenant": sourceTenant->slug.current,
    "css": compiled.css,
    "variables": compiled.variablesJson,
    "compiledAt": compiled.compiledAt
  },

  "foundation": *[_id == "foundationTokens.singleton"][0]{
    "sharedCss": compiledShared.css,
    "scaleCss":  compiledScale.css,
    "sourceHash": compiledShared.sourceHash
  }
}`;

/** Tenants the build should generate themes for. */
export const ACTIVE_TENANTS_QUERY = /* groq */ `
  *[_type == "tenant" && active != false] | order(slug.current asc) {
    "id": slug.current, title, figmaBrandKey, enabledProducts
  }
`;

/**
 * Publish-readiness across every tenant — powers a dashboard and gives CI a
 * single call to assert on before a release.
 */
export const TOKEN_HEALTH_QUERY = /* groq */ `
  *[_type == "brandTheme"]{
    "tenant": tenant->slug.current,
    "status": validation.status,
    "errors": validation.errorCount,
    "warnings": validation.warningCount,
    "notes": validation.noteCount,
    "compiledAt": compiled.compiledAt,
    "aliasCount": compiled.aliasCount,
    "issues": validation.issues[severity == "error"]{ code, subject, message }
  } | order(tenant asc)
`;
