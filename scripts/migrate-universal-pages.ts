import { createRequire } from 'node:module';

import { defaultSectionsForTemplate, defaultTemplateForRoute, modalityFromRoute } from '../lib/pageTemplates.ts';

type RecordValue = Record<string, any>;

const { getCliClient } = createRequire(import.meta.url)('@sanity/cli') as typeof import('@sanity/cli');
const client = getCliClient({ apiVersion: '2024-10-01' });
const dryRun = process.argv.includes('--dry-run');

const cleanId = (id: string) => id.replace(/^drafts\./, '');
const isDraft = (id: string) => id.startsWith('drafts.');
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const textBlocks = (text: string | undefined) =>
  text
    ? [{ _key: 'body', _type: 'block', style: 'normal', markDefs: [], children: [{ _key: 'text', _type: 'span', marks: [], text }] }]
    : undefined;

const pageTitle = (page: RecordValue) => {
  if (page.route === 'marketing/page') {
    const slug = page.slug?.current;
    if (slug === 'home') return 'Homepage';
    return slug ? slug.split('-').map((word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ') : page.heading || 'Marketing page';
  }

  const titles: Record<string, string> = {
    'ticketing/home': 'Homepage',
    'ticketing/search': 'Search',
    'ticketing/browse': 'Browse & category',
    'ticketing/checkout': 'Checkout',
    'ticketing/account': 'Account & tickets',
    'vip/home': 'Homepage',
    'vip/search': 'Search & collections',
    'vip/sweepstakes': 'Sweepstakes',
    'vip/checkout': 'Checkout',
    'vip/membership': 'Membership',
    'vip/profile': 'Profile',
    'hotels/home': 'Homepage',
    'hotels/search': 'Search & results',
  };
  return titles[page.route] || page.heading || page.route;
};

const portableItems = (items: RecordValue[] | undefined) =>
  items?.map((item, index) => ({
    _key: item._key || `item-${index}`,
    _type: 'valuePropositionItem',
    title: item.title,
    body: item.body || item.description,
    iconKey: item.iconKey,
    image: item.image,
  }));

const marketingSections = (page: RecordValue) => {
  const modules: RecordValue[] = page.modules || [];
  const search = modules.find((module) => module._type === 'marketingMultiModalitySearch');

  return modules.flatMap((module, index) => {
    const common = { _key: module._key || `section-${index}`, visible: module.visible !== false, analyticsKey: module.analyticsKey };
    switch (module._type) {
      case 'marketingEditorialHero':
        return [{
          ...common,
          _type: 'marketingHeroSearchSection',
          slotKey: page.slug?.current === 'home' ? 'hero' : module.slotKey,
          eyebrow: module.eyebrow,
          heading: module.heading || page.heading || 'Page hero',
          body: module.body,
          locationLabel: module.locationLabel,
          image: module.image,
          mobileImage: module.mobileImage,
          enabledModalities: search?.enabledModalities || ['vip', 'hotels', 'ticketing'],
          defaultModality: search?.defaultModality || 'vip',
        }];
      case 'marketingMultiModalitySearch':
        return [];
      case 'marketingCopySection':
        return [{ ...common, _type: 'editorialIntroSection', slotKey: page.slug?.current === 'home' ? 'intro' : module.slotKey, eyebrow: module.eyebrow, heading: module.heading, body: module.body, iconKey: module.iconKey }];
      case 'marketingCommerceShelf': {
        const source = module.source || 'hotels';
        const slotKey = page.slug?.current === 'home'
          ? source === 'hotels' ? 'featured-stays' : source === 'deals' ? 'deals' : source === 'vip' ? 'vip-shelf' : module._key
          : module.slotKey;
        if (source === 'deals') {
          return [{ ...common, _type: 'dealGridSection', slotKey, heading: module.heading, selectionMode: module.selectionMode || 'automatic', filters: module.filters, pinnedItemIds: module.pinnedItemIds, excludedItemIds: module.excludedItemIds, itemLimit: module.limit, sort: module.sort, ctaLabel: module.ctaLabel }];
        }
        return [{ ...common, _type: 'commerceShelfSection', slotKey, heading: module.heading, body: module.body, source, selectionMode: module.selectionMode || 'automatic', filters: module.filters, pinnedItemIds: module.pinnedItemIds, excludedItemIds: module.excludedItemIds, itemLimit: module.limit, sort: module.sort, fallbackBehavior: module.fallbackBehavior, ctaLabel: module.ctaLabel, ctaUrl: module.ctaUrl, variant: module.componentVariant }];
      }
      case 'marketingValuePropositionGrid':
        return [{ ...common, _type: 'valuePropositionGridSection', slotKey: page.slug?.current === 'home' ? 'value-propositions' : module.slotKey, heading: module.heading, body: module.body, backgroundImage: module.backgroundImage, items: portableItems(module.items), variant: module.variant }];
      case 'marketingPromoBanner':
        return [{ ...common, _type: 'promoBannerSection', slotKey: module.slotKey, eyebrow: module.eyebrow, heading: module.heading, body: module.body, image: module.image, mobileImage: module.mobileImage, ctaLabel: module.ctaLabel, ctaUrl: module.ctaUrl, actionKey: module.actionKey }];
      case 'marketingCtaBanner':
        return [{ ...common, _type: 'ctaBannerSection', slotKey: module.slotKey, heading: module.heading, body: module.body, backgroundImage: module.backgroundImage || module.image, ctaLabel: module.ctaLabel, ctaUrl: module.ctaUrl, actionKey: module.actionKey }];
      case 'marketingMediaSplit':
        return [{ ...common, _type: 'mediaSplitSection', slotKey: module.slotKey, eyebrow: module.eyebrow, heading: module.heading, body: Array.isArray(module.body) ? module.body : textBlocks(module.body), image: module.image, ctaLabel: module.ctaLabel, ctaUrl: module.ctaUrl, variant: module.variant }];
      case 'marketingFaqSection':
        return [{ ...common, _type: 'faqSection', slotKey: module.slotKey, heading: module.heading, items: module.items?.map((item: RecordValue, itemIndex: number) => ({ _key: item._key || `faq-${itemIndex}`, _type: 'faqSectionItem', question: item.question, answer: Array.isArray(item.answer) ? item.answer : textBlocks(item.answer) })) }];
      case 'marketingQualificationHero':
        return [{ ...clone(module), slotKey: 'qualification-hero' }];
      case 'marketingQualificationOptions':
        return [{ ...clone(module), slotKey: 'qualification-options' }];
      case 'marketingTrustMetrics':
        return [{ ...clone(module), slotKey: module.slotKey || 'qualification-proof' }];
      default:
        return [];
    }
  });
};

const hotelSections = (page: RecordValue) => {
  const legacy: RecordValue[] = page.sections || [];
  const byKey = (key: string) => legacy.find((section) => (section.key || section._key) === key) || {};
  const hero = byKey('featuredHotel');
  const values = byKey('valuePropositions');
  const app = byKey('marketing');
  const brands = byKey('brandStrip');
  return [
    { _key: 'hotels-hero', _type: 'hotelHeroSearchSection', slotKey: 'hero', visible: hero.visible !== false, heading: page.heading || hero.heading, subheading: page.subheading || hero.body, image: hero.image, enabledSearchModes: ['hotels'], defaultSearchMode: 'hotels' },
    { _key: 'hotels-featured', _type: 'commerceShelfSection', slotKey: 'featured-hotels', visible: hero.visible !== false, heading: hero.heading || 'Featured stays', body: hero.body, source: 'hotels', selectionMode: 'automatic', itemLimit: 8, fallbackBehavior: 'broaden', ctaLabel: hero.ctaLabel, ctaUrl: hero.ctaUrl },
    { _key: 'hotels-values', _type: 'valuePropositionGridSection', slotKey: 'value-propositions', visible: values.visible !== false, heading: values.heading || 'Why book with us', body: values.body, backgroundImage: values.image, items: portableItems(values.items) },
    { _key: 'hotels-app', _type: 'appDownloadPromoSection', slotKey: 'app-download', visible: app.visible !== false, heading: app.heading, body: app.body, image: app.image, mobileImage: app.mobileImage, ctaLabel: app.ctaLabel },
    { _key: 'hotels-brands', _type: 'brandLogoStripSection', slotKey: 'brand-strip', visible: brands.visible !== false, heading: brands.heading, subheading: brands.body, logos: brands.logos },
  ];
};

const productForPage = (page: RecordValue, products: RecordValue[]) => {
  const modality = modalityFromRoute(page.route);
  const tenantRef = page.tenant?._ref;
  const exact = products.filter((product) => product.modality === modality && product.tenant?._ref === tenantRef);
  const fallback = products.filter((product) => product.modality === modality && !product.tenant);
  const preferred = (options: RecordValue[]) => options.find((doc) => isDraft(doc._id) === isDraft(page._id)) || options.find((doc) => !isDraft(doc._id)) || options[0];
  return preferred(exact) || preferred(fallback);
};

const defaultLinkTiles = (slotKey: 'category-tiles' | 'popular-city-tiles'): RecordValue => {
  const section = defaultSectionsForTemplate('ticketing-home-v1').find(
    (candidate) => candidate._type === 'linkTilesSection' && candidate.slotKey === slotKey,
  );
  if (!section) throw new Error(`Missing default Ticketing link-tile slot: ${slotKey}`);
  return clone(section);
};

const routeTiles = (items: RecordValue[] | undefined) =>
  items?.map((item, index) => ({
    _key: item._key || `tile-${index}`,
    _type: 'linkTileItem',
    visible: item.visible !== false,
    label: item.label,
    route: item.route || item.url,
    image: item.image,
    openInNewWindow: item.openInNewWindow || (item.route || item.url || '').startsWith('https://'),
  })).filter((item) => item.label && item.route);

const normalizeTicketSections = (
  sections: RecordValue[],
  product: RecordValue | undefined,
) => {
  const home = product?.ticketing?.homepage || {};
  const bySlot = (slot: string) => sections.find((section) => section.slotKey === slot);
  const byType = (type: string) => sections.find((section) => section._type === type);

  const hero = bySlot('hero') || byType('ticketHeroSearchSection');
  const discovery = bySlot('discovery-controls') || byType('ticketDiscoveryControlsSection');
  const collections = bySlot('collections') || byType('ticketCollectionGroupSection');
  const categoryTiles = bySlot('category-tiles') || {
    ...defaultLinkTiles('category-tiles'),
    tiles: routeTiles(home.categoryTiles) || defaultLinkTiles('category-tiles').tiles,
  };
  const popularCityTiles = bySlot('popular-city-tiles') || {
    ...defaultLinkTiles('popular-city-tiles'),
    tiles: routeTiles(home.popularCities) || defaultLinkTiles('popular-city-tiles').tiles,
  };

  const coreTypes = new Set([
    'siteNavbarSection',
    'siteFooterSection',
    'ticketHeroSearchSection',
    'ticketPopularNearHeadingSection',
    'ticketDiscoveryControlsSection',
    'ticketCollectionGroupSection',
    'ticketPopularCitiesSection',
    'linkTilesSection',
  ]);
  const extras = sections.filter((section) => !coreTypes.has(section._type));

  return [
    hero,
    { _key: 'tickets-popular-near-heading', _type: 'ticketPopularNearHeadingSection', slotKey: 'popular-near-heading' },
    discovery ? { ...discovery, heading: undefined } : undefined,
    collections,
    categoryTiles,
    popularCityTiles,
    ...extras,
  ].filter(Boolean) as RecordValue[];
};

const normalizeGlobalChrome = (sections: RecordValue[]) => {
  const navbar = sections.find((section) => section.slotKey === 'navbar' || section._type === 'siteNavbarSection') ||
    { _key: 'page-navbar', _type: 'siteNavbarSection', slotKey: 'navbar', visible: true };
  const footer = sections.find((section) => section.slotKey === 'footer' || section._type === 'siteFooterSection') ||
    { _key: 'page-footer', _type: 'siteFooterSection', slotKey: 'footer', visible: true };
  const body = sections.filter((section) => section !== navbar && section !== footer && section._type !== 'siteNavbarSection' && section._type !== 'siteFooterSection');
  return [navbar, ...body, footer];
};

const ticketSections = (page: RecordValue, product: RecordValue | undefined) => {
  const ticketing = product?.ticketing || {};
  const home = ticketing.homepage || {};
  const hero = home.hero || {};
  return [
    { _key: 'tickets-hero', _type: 'ticketHeroSearchSection', slotKey: 'hero', visible: true, heading: page.heading || hero.heading || hero.headline, subheading: page.subheading || hero.subheading, image: hero.image, mobileImage: hero.mobileImage, searchPlaceholder: ticketing.searchPlaceholder, locationPlaceholder: home.locationPlaceholder },
    { _key: 'tickets-popular-near-heading', _type: 'ticketPopularNearHeadingSection', slotKey: 'popular-near-heading' },
    { _key: 'tickets-discovery', _type: 'ticketDiscoveryControlsSection', slotKey: 'discovery-controls', visible: true, quickDateLabels: home.dateFilterLabels },
    { _key: 'tickets-collections', _type: 'ticketCollectionGroupSection', slotKey: 'collections', visible: true, collections: clone(home.collections || []) },
    { ...defaultLinkTiles('category-tiles'), tiles: routeTiles(home.categoryTiles) || defaultLinkTiles('category-tiles').tiles },
    { ...defaultLinkTiles('popular-city-tiles'), tiles: routeTiles(home.popularCities) || defaultLinkTiles('popular-city-tiles').tiles },
  ];
};

const vipSections = (page: RecordValue, product: RecordValue | undefined) => {
  const vip = product?.vip || {};
  const home = vip.homepage || {};
  const hero = home.hero || {};
  const collections: RecordValue[] = home.collections || [];
  return [
    { _key: 'vip-hero', _type: 'vipHeroSearchSection', slotKey: 'hero', visible: true, eyebrow: 'Bookit access', heading: page.heading || hero.heading || 'Unique Experiences for You', subheading: page.subheading || hero.subheading, image: hero.image, mobileImage: hero.mobileImage, searchPlaceholder: vip.searchPlaceholder, searchLabel: 'Search' },
    { _key: 'vip-navigation', _type: 'vipSecondaryNavigationSection', slotKey: 'secondary-navigation', visible: true, links: clone(vip.secondaryNavigation || []) },
    ...collections.map((collection, index) => ({ ...clone(collection), _key: collection._key || `collection-${index}`, _type: 'vipExperienceCollectionSection', slotKey: `collection-${collection._key || index}` })),
    { _key: 'vip-categories', _type: 'vipCategoryGridSection', slotKey: 'categories', visible: true, heading: 'Categories', tiles: clone(home.categoryTiles || []) },
  ];
};

async function main() {
  const [pages, products] = await Promise.all([
    client.fetch<RecordValue[]>(`*[_type == "pageContent"]`),
    client.fetch<RecordValue[]>(`*[_type == "productContent"]`),
  ]);

  const changes: Array<{ page: RecordValue; set: RecordValue }> = [];
  for (const page of pages) {
    const modality = modalityFromRoute(page.route);
    const templateKey = page.templateKey || defaultTemplateForRoute(page.route, page.slug?.current);
    if (!modality || !templateKey) continue;

    const existingTypes = (page.sections || []).map((section: RecordValue) => section._type);
    const alreadyUniversal = Array.isArray(page.sections) && existingTypes.every((type: string) => type !== 'contentSection');
    let sections = alreadyUniversal ? page.sections : undefined;
    const product = productForPage(page, products);

    if (!sections && page.route === 'marketing/page') sections = marketingSections(page);
    if (!sections && page.route === 'ticketing/home') sections = ticketSections(page, product);
    if (!sections && page.route === 'vip/home') sections = vipSections(page, product);
    if (!sections && page.route === 'hotels/home') sections = hotelSections(page);
    if (!sections) sections = defaultSectionsForTemplate(templateKey);

    if (page.route === 'ticketing/home') sections = normalizeTicketSections(sections, product);
    sections = clone(normalizeGlobalChrome(sections));

    const set = { title: page.title || pageTitle(page), modality, templateKey, templateVersion: 2, sections };
    const changed =
      page.title !== set.title ||
      page.modality !== modality ||
      page.templateKey !== templateKey ||
      page.templateVersion !== 2 ||
      JSON.stringify(page.sections || []) !== JSON.stringify(sections);
    if (changed) changes.push({ page, set });
  }

  for (const { page, set } of changes) {
    console.log(`${dryRun ? 'would migrate' : 'migrating'} ${page._id} -> ${set.templateKey} (${set.sections.length} sections)`);
  }
  if (dryRun) {
    console.log(`\nDry run: ${changes.length} page document(s); no data written.`);
    return;
  }

  for (let index = 0; index < changes.length; index += 50) {
    const batch = changes.slice(index, index + 50);
    const transaction = batch.reduce((tx, { page, set }) => tx.patch(page._id, (patch) => patch.set(set)), client.transaction());
    await transaction.commit();
  }
  console.log(`\nMigrated ${changes.length} page document(s). Legacy fields were retained for rollback.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

