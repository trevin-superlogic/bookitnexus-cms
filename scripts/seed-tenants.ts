/**
 * Create the tenant documents and the universal-default singletons.
 *
 * Run once against a fresh dataset, before importing tokens — the token import
 * matches each theme export to a tenant by Figma brand key, so the tenants have
 * to exist first.
 *
 * Uses `createIfNotExists`, so re-running will not overwrite edits.
 *
 *   npm run seed
 *   npm run seed -- --dry-run
 */
import { MODALITY_PAGES, TENANT_SEED } from '../lib/constants.ts';
import {
  defaultDocumentId,
  defaultModalityContentDocumentId,
  defaultPageContentDocumentId,
  tenantDocumentId,
} from '../lib/documentIds.ts';
import { requireSanityEnv } from './lib/env.ts';

const DEFAULT_TYPES = [
  'experienceConfig',
  'siteSettings',
  'siteNavigation',
  'paymentSettings',
  'sharedCopy',
  'legalDocument',
  'sharedContent',
];

/**
 * Seed values for the universal default experience config.
 *
 * Taken from the Figma tenant-config collection and from what the current
 * apps do, so that a tenant which overrides nothing still renders correctly.
 * Deliberately conservative: anything genuinely tenant-specific (points name,
 * support contacts) is left unset rather than guessed, so it shows up as
 * missing rather than silently wrong.
 */
const DEFAULT_EXPERIENCE_CONFIG = {
  products: { hasTicketing: true, hasVipExperiences: true, hasHotels: false, hasSweeps: false },
  rewards: {
    _type: 'rewardsConfig',
    pointsName: 'PT',
    pricingDisplay: 'moneyOrPoints',
    vipPricingDisplay: 'moneyOrPoints',
    showPointsEarning: true,
    earningDisplay: 'points',
  },
  footer: {
    _type: 'footerConfig',
    supportPhone: { visible: true },
    supportEmail: { visible: false },
    sellerOfTravelCopy:
      'Open Network Exchange Inc is registered with the State of Florida as a Seller of Travel. ' +
      'Registration No. ST43055. Washington UBI 604 361 837. Hawaii TAR-7231. ' +
      'California CST 2141600-50. Registration as a seller of travel in California does not constitute ' +
      'approval by the State of California.',
    trademarkCopy: '© 2026 Open Network Exchange Inc. All rights reserved.',
    showDoNotSellLink: true,
    poweredBy: 'spree',
  },
  payments: { _type: 'paymentConfig', allowPointsSpending: true, creditCard: true, crypto: false, cryptoCom: false },
  onboarding: {
    _type: 'onboardingConfig',
    collectedFields: ['firstName', 'surname', 'email', 'phone', 'dateOfBirth', 'country', 'marketingOptIn', 'termsOptIn'],
  },
};

/** Shared copy that is currently duplicated inline across both apps. */
const DEFAULT_SHARED_CONTENT = {
  entries: [
    { key: 'emptyState.noEvents', value: 'No events have been found', notes: 'Search and browse results.' },
    { key: 'emptyState.noTickets', value: 'No tickets right now. Working to get more.', notes: 'Event detail page.' },
    { key: 'emptyState.noResults', value: 'No results found', notes: 'Search dropdown.' },
    {
      key: 'emptyState.noPurchases',
      value: 'You have not purchased any tickets yet. Explore events to get started.',
      notes: 'Account purchase history.',
    },
    { key: 'error.generic.title', value: 'Oops! Something went wrong', notes: 'Route error boundaries.' },
    {
      key: 'error.generic.body',
      value: "We're having trouble loading this page right now. Please try again.",
      notes: 'Route error boundaries.',
    },
    { key: 'error.notFound.title', value: '404', notes: 'not-found page.' },
    {
      key: 'error.notFound.body',
      value: 'Sorry, the page you are looking for does not exist.',
      notes: 'not-found page.',
    },
    { key: 'search.placeholder', value: 'Search by artist, event or venue', notes: 'Global search bar.' },
    { key: 'action.showMore', value: 'Show more' },
    { key: 'action.signUp', value: 'Sign Up' },
    { key: 'action.signIn', value: 'Sign In' },
  ].map((entry, index) => ({ _type: 'copyEntry', _key: `copy-${index}`, visible: true, ...entry })),
};

const DEFAULT_SITE_SETTINGS = {
  metadata: {
    _type: 'siteMetadata',
    title: 'Bookit',
    titleTemplate: '%s | Bookit',
    description: 'Discover tickets, stays, and memorable experiences.',
    noIndex: false,
  },
};

const DEFAULT_SITE_NAVIGATION = {
  variant: 'nexus',
  nexus: {
    _type: 'nexusNavbar',
    auth: {
      _type: 'authControls',
      showSignIn: true,
      signInLabel: 'Sign In',
      signedInLabel: 'My Account',
    },
  },
  footer: {
    _type: 'footerChrome',
    support: DEFAULT_EXPERIENCE_CONFIG.footer,
  },
};

const DEFAULT_PAYMENT_SETTINGS = {
  methods: DEFAULT_EXPERIENCE_CONFIG.payments,
  widget: {
    _type: 'spreePayWidget',
    allowPointsSpending: true,
    creditCardPayment: true,
    cryptoPayment: false,
    cdcPayment: false,
    widgetTitle: 'How would you like to pay?',
  },
};

const DEFAULT_SHARED_COPY = {
  title: 'Global UI copy',
  feature: 'global',
  entries: DEFAULT_SHARED_CONTENT.entries,
};

/** Standard white-label controls shared by every Ticketing and VIP tenant. */
const DEFAULT_MODALITY_CONTENT = [
  {
    _id: defaultModalityContentDocumentId('ticketing'),
    _type: 'productContent',
    modality: 'ticketing',
    ticketing: {
      _type: 'ticketingContentConfig',
      homepage: {
        _type: 'object',
        searchPlaceholder: 'Search by artist, event or venue',
        locationPlaceholder: 'Search by city, venue or ZIP',
        dateFilterLabels: {
          _type: 'object',
          tomorrow: 'Tomorrow',
          thisWeekend: 'This weekend',
          nextWeekend: 'Next weekend',
          otherDates: 'Other dates',
        },
        collections: [
          {
            _type: 'ticketCollection',
            _key: 'popular-nearby',
            visible: true,
            heading: 'Popular near you',
            sourceType: 'nearby',
            itemLimit: 12,
            viewAllLabel: 'View all',
          },
        ],
      },
      browse: {
        _type: 'object',
        resultsHeading: 'Events',
        emptyHeading: 'No events have been found',
        emptyBody: 'Try changing your search, location, or filters.',
      },
      eventDetail: {
        _type: 'object',
        selectTicketsLabel: 'Select tickets',
        soldOutLabel: 'Sold out',
        relatedHeading: 'Related events',
      },
    },
  },
  {
    _id: defaultModalityContentDocumentId('vip'),
    _type: 'productContent',
    modality: 'vip',
    vip: {
      _type: 'vipContentConfig',
      homepage: {
        _type: 'object',
        secondaryNavigation: [
          ['all', 'All'],
          ['sweeps', 'Sweeps'],
          ['trending', 'Trending'],
          ['sports', 'Sports'],
          ['music', 'Music'],
          ['culinary', 'Culinary'],
          ['lifestyle', 'Lifestyle'],
        ].map(([key, label]) => ({ _type: 'editorialLink', _key: key, visible: true, label })),
        collections: [
          ['curated', 'Curated'],
          ['trending', 'Trending'],
          ['exclusive', 'Exclusive'],
          ['lifetime', 'Once in a Lifetime'],
        ].map(([sourceKey, heading]) => ({
          _type: 'experienceCollection',
          _key: sourceKey,
          visible: true,
          heading,
          sourceType: 'tag',
          sourceKey,
          itemLimit: 12,
          viewAllLabel: 'View all',
        })),
      },
      searchPlaceholder: 'Search experiences',
      searchResults: {
        _type: 'object',
        resultsHeading: 'Experiences',
        emptyHeading: 'No results found',
        emptyBody: 'Try another search or explore a different category.',
      },
      detailPage: {
        _type: 'object',
        bookLabel: 'Book now',
        soldOutLabel: 'Sold out',
        aboutHeading: 'About this experience',
        includedHeading: "What's included",
        relatedHeading: 'Related experiences',
      },
    },
  },
];

const DEFAULT_PAGE_CONTENT = Object.entries(MODALITY_PAGES).flatMap(([modality, pages]) =>
  pages.map(({ id }) => {
    const route = `${modality}/${id}`;
    return {
      _id: defaultPageContentDocumentId(route),
      _type: 'pageContent',
      route,
    };
  }),
);

const LEGAL_ROUTES = [
  { slug: '/terms', title: 'Terms' },
  { slug: '/privacy-policy', title: 'Privacy policy' },
  { slug: '/accessibility', title: 'Accessibility' },
  { slug: '/cookie-policy', title: 'Cookie policy' },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const documents: Array<Record<string, unknown>> = [
    ...TENANT_SEED.map((tenant) => ({
      _id: tenantDocumentId(tenant.slug),
      _type: 'tenant',
      title: tenant.title,
      slug: { _type: 'slug', current: tenant.slug },
      figmaBrandKey: tenant.figmaBrandKey,
      domain: tenant.domain,
      active: true,
      enabledProducts: ['ticketing'],
    })),
    {
      _id: defaultDocumentId('experienceConfig'),
      _type: 'experienceConfig',
      ...DEFAULT_EXPERIENCE_CONFIG,
    },
    {
      _id: defaultDocumentId('sharedContent'),
      _type: 'sharedContent',
      ...DEFAULT_SHARED_CONTENT,
    },
    {
      _id: defaultDocumentId('siteSettings'),
      _type: 'siteSettings',
      ...DEFAULT_SITE_SETTINGS,
    },
    {
      _id: defaultDocumentId('siteNavigation'),
      _type: 'siteNavigation',
      ...DEFAULT_SITE_NAVIGATION,
    },
    {
      _id: defaultDocumentId('paymentSettings'),
      _type: 'paymentSettings',
      ...DEFAULT_PAYMENT_SETTINGS,
    },
    {
      _id: defaultDocumentId('sharedCopy'),
      _type: 'sharedCopy',
      ...DEFAULT_SHARED_COPY,
    },
    ...DEFAULT_MODALITY_CONTENT,
    ...DEFAULT_PAGE_CONTENT,
    ...LEGAL_ROUTES.map(({ slug, title }) => ({
      _id: `${defaultDocumentId('legalDocument')}.${slug.slice(1)}`,
      _type: 'legalDocument',
      visible: false,
      slug,
      title,
      body: [
        {
          _type: 'block',
          _key: 'placeholder',
          style: 'normal',
          markDefs: [],
          children: [
            {
              _type: 'span',
              _key: 'text',
              marks: [],
              text: 'Add the approved legal content before making this page visible.',
            },
          ],
        },
      ],
    })),
  ];

  if (dryRun) {
    for (const doc of documents) console.log(`  would create ${doc._id}  (${doc._type})`);
    console.log(`\nDry run — ${documents.length} document(s), nothing written.`);
    console.log(`Default types: ${DEFAULT_TYPES.join(', ')}`);
    return;
  }

  const { projectId, dataset, token } = requireSanityEnv();

  const { createClient } = await import('@sanity/client');
  const client = createClient({ projectId, dataset, apiVersion: '2024-10-01', token, useCdn: false });

  console.log(`Seeding ${projectId} / ${dataset}\n`);

  // createIfNotExists in a single transaction: re-running is safe and never
  // clobbers an editor's work.
  const transaction = documents.reduce((tx, doc) => tx.createIfNotExists(doc as never), client.transaction());
  await transaction.commit();

  for (const doc of documents) console.log(`  ✓ ${doc._id}`);
  console.log(`\n${documents.length} document(s) ensured. Next: npm run tokens:import`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
