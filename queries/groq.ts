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

const SHARED_CONTENT_PROJECTION = /* groq */ `{
  navbar,
  footer,
  metadata,
  spreePay,
  entries[]{ _key, key, value, visible },
  legal[]{ _key, slug, title, body, visible }
}`;

const PAGE_PROJECTION = /* groq */ `{
  route,
  heading,
  subheading,
  sections[]{ key, heading, body, ctaLabel, ctaUrl, disclaimer, visible, "image": image{ "url": asset->url, alt } },
  entries[]{ key, value, visible },
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

  "productDefaults":  *[_type == "productContent" && !defined(tenant)]{
    "modality": coalesce(modality, product), entries[]{ _key, key, value, visible }
  },
  "productOverrides": *[_type == "productContent" && tenant->slug.current == $tenant]{
    "modality": coalesce(modality, product), entries[]{ _key, key, value, visible }
  },

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
