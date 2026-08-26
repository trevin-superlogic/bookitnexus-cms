export type PageModality = 'marketing' | 'vip' | 'ticketing' | 'hotels';
export type PageStructurePolicy = 'locked' | 'curated' | 'flexible';
export type PageRoutePolicy = 'locked' | 'slug';

export type PageTemplateDefinition = {
  key: string;
  title: string;
  description: string;
  modality: PageModality;
  route: string;
  routePolicy: PageRoutePolicy;
  structurePolicy: PageStructurePolicy;
  allowedSectionTypes: readonly string[];
  requiredSlots: readonly string[];
};

const GLOBAL_CHROME_SECTION_TYPES = ['siteNavbarSection', 'siteFooterSection'] as const;
const GLOBAL_CHROME_SLOTS = ['navbar', 'footer'] as const;

const withGlobalChrome = (sections: Array<Record<string, unknown>>) => [
  { _key: 'page-navbar', _type: 'siteNavbarSection', slotKey: 'navbar', visible: true },
  ...sections,
  { _key: 'page-footer', _type: 'siteFooterSection', slotKey: 'footer', visible: true },
];

const MARKETING_SECTIONS = [
  ...GLOBAL_CHROME_SECTION_TYPES,
  'marketingHeroSearchSection',
  'editorialIntroSection',
  'commerceShelfSection',
  'dealGridSection',
  'valuePropositionGridSection',
  'promoBannerSection',
  'faqSection',
  'mediaSplitSection',
  'ctaBannerSection',
  'marketingQualificationHero',
  'marketingQualificationOptions',
  'marketingTrustMetrics',
] as const;

const LOCKED_APPLICATION_PAGE_TEMPLATES: readonly PageTemplateDefinition[] = [
  ['ticketing', 'search', 'Tickets search'],
  ['ticketing', 'browse', 'Tickets browse and category'],
  ['ticketing', 'checkout', 'Tickets checkout'],
  ['ticketing', 'account', 'Tickets account and orders'],
  ['vip', 'search', 'VIP search and collections'],
  ['vip', 'sweepstakes', 'VIP sweepstakes'],
  ['vip', 'checkout', 'VIP checkout'],
  ['vip', 'membership', 'VIP membership'],
  ['vip', 'profile', 'VIP profile'],
  ['hotels', 'search', 'Stays search and results'],
].map(([modality, page, title]) => ({
  key: `${modality}-${page}-v1`,
  title,
  description: 'Locked application route. Its editable component contract will expand as this production surface is mapped.',
  modality: modality as PageModality,
  route: `${modality}/${page}`,
  routePolicy: 'locked',
  structurePolicy: 'locked',
  allowedSectionTypes: GLOBAL_CHROME_SECTION_TYPES,
  requiredSlots: GLOBAL_CHROME_SLOTS,
}));

export const PAGE_TEMPLATE_DEFINITIONS = [
  {
    key: 'marketing-home-v1',
    title: 'Marketing homepage',
    description: 'Fixed homepage route with a curated set of approved Marketing sections.',
    modality: 'marketing',
    route: 'marketing/page',
    routePolicy: 'locked',
    structurePolicy: 'curated',
    allowedSectionTypes: MARKETING_SECTIONS,
    requiredSlots: ['navbar', 'hero', 'intro', 'featured-stays', 'deals', 'value-propositions', 'vip-shelf', 'footer'],
  },
  {
    key: 'qualification-v1',
    title: 'Qualification page',
    description: 'Campaign qualification journey with approved proof, option, and CTA sections.',
    modality: 'marketing',
    route: 'marketing/page',
    routePolicy: 'slug',
    structurePolicy: 'curated',
    allowedSectionTypes: MARKETING_SECTIONS,
    requiredSlots: ['navbar', 'qualification-hero', 'qualification-options', 'footer'],
  },
  {
    key: 'flexible-v1',
    title: 'Flexible Marketing page',
    description: 'Editor-created Marketing page composed from the registered Marketing section library.',
    modality: 'marketing',
    route: 'marketing/page',
    routePolicy: 'slug',
    structurePolicy: 'flexible',
    allowedSectionTypes: MARKETING_SECTIONS,
    requiredSlots: GLOBAL_CHROME_SLOTS,
  },
  {
    key: 'ticketing-home-v1',
    title: 'Tickets homepage',
    description: 'Ticketing homepage with API-backed discovery and event collection sections.',
    modality: 'ticketing',
    route: 'ticketing/home',
    routePolicy: 'locked',
    structurePolicy: 'curated',
    allowedSectionTypes: [
      ...GLOBAL_CHROME_SECTION_TYPES,
      'ticketHeroSearchSection',
      'ticketPopularNearHeadingSection',
      'ticketDiscoveryControlsSection',
      'ticketCollectionGroupSection',
      'linkTilesSection',
      'promoBannerSection',
      'ctaBannerSection',
    ],
    requiredSlots: ['navbar', 'hero', 'popular-near-heading', 'discovery-controls', 'collections', 'category-tiles', 'popular-city-tiles', 'footer'],
  },
  {
    key: 'vip-home-v1',
    title: 'VIP Experiences homepage',
    description: 'VIP homepage with hero search, navigation, API-backed shelves, and discovery tiles.',
    modality: 'vip',
    route: 'vip/home',
    routePolicy: 'locked',
    structurePolicy: 'curated',
    allowedSectionTypes: [
      ...GLOBAL_CHROME_SECTION_TYPES,
      'vipHeroSearchSection',
      'vipSecondaryNavigationSection',
      'vipExperienceCollectionSection',
      'vipCategoryGridSection',
      'promoBannerSection',
      'valuePropositionGridSection',
      'ctaBannerSection',
    ],
    requiredSlots: ['navbar', 'hero', 'secondary-navigation', 'categories', 'footer'],
  },
  {
    key: 'hotels-home-v1',
    title: 'Stays homepage',
    description: 'Stays homepage built from the Bookit hotel search and marketing components.',
    modality: 'hotels',
    route: 'hotels/home',
    routePolicy: 'locked',
    structurePolicy: 'curated',
    allowedSectionTypes: [
      ...GLOBAL_CHROME_SECTION_TYPES,
      'hotelHeroSearchSection',
      'commerceShelfSection',
      'valuePropositionGridSection',
      'appDownloadPromoSection',
      'brandLogoStripSection',
      'promoBannerSection',
      'ctaBannerSection',
    ],
    requiredSlots: ['navbar', 'hero', 'featured-hotels', 'value-propositions', 'app-download', 'brand-strip', 'footer'],
  },
  ...LOCKED_APPLICATION_PAGE_TEMPLATES,
] as const satisfies readonly PageTemplateDefinition[];

export const PAGE_TEMPLATE_OPTIONS = PAGE_TEMPLATE_DEFINITIONS.map((template) => ({
  title: template.title,
  value: template.key,
}));

export const pageTemplate = (key: string | undefined): PageTemplateDefinition | undefined =>
  PAGE_TEMPLATE_DEFINITIONS.find((template) => template.key === key);

export const modalityFromRoute = (route: string | undefined): PageModality | undefined => {
  const prefix = route?.split('/')[0];
  return prefix === 'marketing' || prefix === 'vip' || prefix === 'ticketing' || prefix === 'hotels'
    ? prefix
    : undefined;
};

export const defaultTemplateForRoute = (route: string | undefined, slug?: string): string | undefined => {
  if (route === 'marketing/page') return slug === 'home' ? 'marketing-home-v1' : 'flexible-v1';
  if (route === 'ticketing/home') return 'ticketing-home-v1';
  if (route === 'vip/home') return 'vip-home-v1';
  if (route === 'hotels/home') return 'hotels-home-v1';
  return PAGE_TEMPLATE_DEFINITIONS.find((template) => template.route === route)?.key;
};

export const defaultSectionsForTemplate = (key: string): Array<Record<string, unknown>> => {
  if (key === 'marketing-home-v1') {
    return withGlobalChrome([
      { _key: 'home-hero', _type: 'marketingHeroSearchSection', slotKey: 'hero', visible: true, heading: 'The Most Exclusive Only', locationLabel: 'Buckingham Palace', enabledModalities: ['vip', 'hotels', 'ticketing'], defaultModality: 'vip' },
      { _key: 'home-intro', _type: 'editorialIntroSection', slotKey: 'intro', visible: true, heading: 'Closed Group.', accentText: 'Best Price.', body: 'Members of our private network unlock rates unavailable to the public across hotels, flights, and experiences worldwide.' },
      { _key: 'home-stays', _type: 'commerceShelfSection', slotKey: 'featured-stays', visible: true, source: 'hotels', selectionMode: 'automatic', heading: 'Featured Stays', itemLimit: 8, fallbackBehavior: 'broaden' },
      { _key: 'home-deals', _type: 'dealGridSection', slotKey: 'deals', visible: true, heading: "Today's", accentText: 'Best Deals', selectionMode: 'automatic', itemLimit: 2 },
      { _key: 'home-values', _type: 'valuePropositionGridSection', slotKey: 'value-propositions', visible: true, heading: 'What Makes Us', accentText: 'Special?' },
      { _key: 'home-vip', _type: 'commerceShelfSection', slotKey: 'vip-shelf', visible: true, source: 'vip', selectionMode: 'automatic', heading: 'VIP Experiences', itemLimit: 8, fallbackBehavior: 'broaden' },
    ]);
  }

  if (key === 'ticketing-home-v1') {
    return withGlobalChrome([
      { _key: 'tickets-hero', _type: 'ticketHeroSearchSection', slotKey: 'hero', visible: true },
      { _key: 'tickets-popular-near-heading', _type: 'ticketPopularNearHeadingSection', slotKey: 'popular-near-heading' },
      { _key: 'tickets-discovery', _type: 'ticketDiscoveryControlsSection', slotKey: 'discovery-controls', visible: true },
      { _key: 'tickets-collections', _type: 'ticketCollectionGroupSection', slotKey: 'collections', visible: true },
      {
        _key: 'tickets-categories',
        _type: 'linkTilesSection',
        slotKey: 'category-tiles',
        visible: true,
        heading: 'Categories',
        tiles: [
          { _key: 'concerts', _type: 'linkTileItem', visible: true, label: 'Concerts', route: '/browse/concerts' },
          { _key: 'sports', _type: 'linkTileItem', visible: true, label: 'Sports', route: '/browse/sports' },
          { _key: 'theater', _type: 'linkTileItem', visible: true, label: 'Theater & Comedy', route: '/browse/theater-comedy' },
        ],
      },
      {
        _key: 'tickets-cities',
        _type: 'linkTilesSection',
        slotKey: 'popular-city-tiles',
        visible: true,
        heading: 'Popular cities',
        tiles: [
          { _key: 'new-york', _type: 'linkTileItem', visible: true, label: 'New York', route: '/browse/new-york' },
          { _key: 'las-vegas', _type: 'linkTileItem', visible: true, label: 'Las Vegas', route: '/browse/las-vegas' },
          { _key: 'miami', _type: 'linkTileItem', visible: true, label: 'Miami', route: '/browse/miami' },
        ],
      },
    ]);
  }

  if (key === 'vip-home-v1') {
    return withGlobalChrome([
      { _key: 'vip-hero', _type: 'vipHeroSearchSection', slotKey: 'hero', visible: true, eyebrow: 'Bookit access', heading: 'Unique Experiences for You', subheading: 'From concerts to sports — your seat is here.', searchPlaceholder: 'Search experiences' },
      { _key: 'vip-navigation', _type: 'vipSecondaryNavigationSection', slotKey: 'secondary-navigation', visible: true },
      { _key: 'vip-curated', _type: 'vipExperienceCollectionSection', slotKey: 'collection-curated', visible: true, heading: 'Curated Experiences', sourceType: 'tag', sourceKey: 'curated', itemLimit: 12, viewAllLabel: 'View all' },
      { _key: 'vip-trending', _type: 'vipExperienceCollectionSection', slotKey: 'collection-trending', visible: true, heading: 'Trending Experiences', sourceType: 'tag', sourceKey: 'trending', itemLimit: 12, viewAllLabel: 'View all' },
      { _key: 'vip-exclusive', _type: 'vipExperienceCollectionSection', slotKey: 'collection-exclusive', visible: true, heading: 'Exclusive Experiences', sourceType: 'tag', sourceKey: 'exclusive', itemLimit: 12, viewAllLabel: 'View all' },
      { _key: 'vip-lifetime', _type: 'vipExperienceCollectionSection', slotKey: 'collection-lifetime', visible: true, heading: 'Once in a Lifetime', sourceType: 'tag', sourceKey: 'lifetime', itemLimit: 12, viewAllLabel: 'View all' },
      { _key: 'vip-categories', _type: 'vipCategoryGridSection', slotKey: 'categories', visible: true, heading: 'Categories' },
    ]);
  }

  if (key === 'hotels-home-v1') {
    return withGlobalChrome([
      { _key: 'hotels-hero', _type: 'hotelHeroSearchSection', slotKey: 'hero', visible: true, enabledSearchModes: ['hotels'], defaultSearchMode: 'hotels' },
      { _key: 'hotels-featured', _type: 'commerceShelfSection', slotKey: 'featured-hotels', visible: true, source: 'hotels', selectionMode: 'automatic', heading: 'Featured stays', itemLimit: 8, fallbackBehavior: 'broaden' },
      { _key: 'hotels-values', _type: 'valuePropositionGridSection', slotKey: 'value-propositions', visible: true, heading: 'Why book with us' },
      { _key: 'hotels-app', _type: 'appDownloadPromoSection', slotKey: 'app-download', visible: true },
      { _key: 'hotels-brands', _type: 'brandLogoStripSection', slotKey: 'brand-strip', visible: true },
    ]);
  }

  if (key === 'qualification-v1') {
    return withGlobalChrome([
      { _key: 'qualification-hero', _type: 'marketingQualificationHero', slotKey: 'qualification-hero', visible: true, heading: 'See if you qualify' },
      { _key: 'qualification-options', _type: 'marketingQualificationOptions', slotKey: 'qualification-options', visible: true, variant: 'multiPath', options: [] },
    ]);
  }

  return withGlobalChrome([]);
};

