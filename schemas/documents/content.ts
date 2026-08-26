/**
 * Content documents: shared → modality → page.
 *
 * Three levels, each a separate document per the PDP's "focused documents that
 * reference the tenant, not one large document":
 *
 *   sharedContent   content reused across multiple modalities
 *   productContent  content shared within one modality
 *   pageContent     copy for one route
 *
 * Each level exists as a universal default plus optional tenant overrides, so
 * "No events have been found" is written once and a tenant only overrides what
 * it actually wants to say differently.
 *
 * Page routes are constrained to a known list rather than free text: a typo in
 * a free-text route produces content that silently never renders, and there is
 * nothing in the CMS to notice it.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { MODALITY_PAGES, PRODUCTS } from '../../lib/constants';
import {
  PAGE_TEMPLATE_OPTIONS,
  modalityFromRoute,
  pageTemplate,
} from '../../lib/pageTemplates';
import { INHERITS, scopePreview, tenantScopeField } from '../lib/scope';
import { MARKETING_MODULE_TYPES } from '../objects/marketingContent';
import { PAGE_SECTION_TYPE_NAMES } from '../objects/pageSections';

const PRODUCT_TITLES = Object.fromEntries(PRODUCTS.map(({ id, title }) => [id, title]));

const PAGE_ROUTES = [
  ...Object.entries(MODALITY_PAGES).flatMap(([modality, pages]) =>
    pages.map((page) => ({
      title: `${PRODUCT_TITLES[modality] ?? modality} — ${page.title}`,
      value: `${modality}/${page.id}`,
    })),
  ),
  { title: 'Marketing — Flexible page', value: 'marketing/page' },
];

const PRODUCT_OPTIONS = PRODUCTS.map(({ id, title }) => ({ title, value: id }));

/**
 * A named piece of copy.
 *
 * Keyed rather than positional so the frontend reads `copy.emptyState` instead
 * of `copy[3]`, and so reordering in the Studio cannot change what renders.
 */
export const copyEntry = defineType({
  name: 'copyEntry',
  title: 'Copy',
  type: 'object',
  fields: [
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({
      name: 'key',
      title: 'Key',
      type: 'string',
      description: 'Stable identifier the frontend reads, e.g. "emptyState.noEvents". Changing it breaks the reference.',
      validation: (Rule) =>
        Rule.required().custom((value) =>
          value && /^[a-zA-Z0-9.\-_]+$/.test(value) ? true : 'Letters, numbers, dots, hyphens and underscores only.',
        ),
    }),
    defineField({ name: 'value', title: 'Text', type: 'text', rows: 2, description: INHERITS }),
    defineField({
      name: 'notes',
      title: 'Notes for editors',
      type: 'string',
      description: 'Where this appears, and anything worth knowing before changing it.',
    }),
  ],
  preview: {
    select: { key: 'key', value: 'value', visible: 'visible' },
    prepare: ({ key, value, visible }) => ({ title: `${visible === false ? '○ ' : ''}${key ?? ''}`, subtitle: value }),
  },
});

export const sharedContent = defineType({
  name: 'sharedContent',
  title: 'Shared Content',
  type: 'document',
  description:
    'Content and presentation settings reused across Ticketing, VIP, Hotels, and Marketing. Tenant overrides inherit empty values from Universal defaults.',
  groups: [
    { name: 'navbar', title: 'Navbar', default: true },
    { name: 'footer', title: 'Footer' },
    { name: 'metadata', title: 'Metadata' },
    { name: 'payments', title: 'Payment content' },
    { name: 'copy', title: 'Copy & legal' },
  ],
  fields: [
    { ...tenantScopeField(), group: 'navbar' },
    defineField({
      name: 'navbar',
      title: 'Navbar',
      type: 'navbarConfig',
      group: 'navbar',
      description: 'The bar at the top of every page — logo, destinations, and the account control.',
    }),
    defineField({
      name: 'footer',
      title: 'Footer',
      type: 'footerChrome',
      group: 'footer',
      description: 'The footer on every page — logo, link groups, co-branding, and support contacts.',
    }),
    defineField({
      name: 'metadata',
      title: 'Metadata',
      type: 'siteMetadata',
      group: 'metadata',
      description:
        'Head metadata for the whole tenant. Individual pages carry the same fields and override only what ' +
        'they set, so a page can change its title while keeping this favicon and social image.',
    }),
    defineField({
      name: 'spreePay',
      title: 'Payment widget content',
      type: 'spreePayWidget',
      group: 'payments',
      description: 'Cross-modality payment copy and links. Payment availability belongs in Tenant Configuration.',
    }),
    defineField({
      name: 'entries',
      title: 'Copy',
      type: 'array',
      group: 'copy',
      of: [defineArrayMember({ type: 'copyEntry' })],
      description: `Overriding any entry replaces only that key — other keys still inherit. ${INHERITS}`,
    }),
    defineField({
      name: 'legal',
      title: 'Legal documents',
      type: 'array',
      group: 'copy',
      description:
        'Terms, privacy policy and similar. Replaces the static HTML currently served from ' +
        'public/assets/privacy/ and hardcoded to a single tenant.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'sharedLegalDocument',
          fields: [
            defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
            defineField({
              name: 'slug',
              title: 'Route',
              type: 'string',
              options: {
                list: [
                  { title: '/terms', value: 'terms' },
                  { title: '/privacy-policy', value: 'privacy-policy' },
                  { title: '/accessibility', value: 'accessibility' },
                  { title: '/cookie-policy', value: 'cookie-policy' },
                ],
              },
              validation: (Rule) => Rule.required(),
            }),
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'body', title: 'Body', type: 'array', of: [{ type: 'block' }] }),
          ],
          preview: { select: { title: 'title', subtitle: 'slug', visible: 'visible' } },
        }),
      ],
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', entries: 'entries' },
    prepare: ({ tenantTitle, id, entries }) => ({
      title: 'Shared content',
      subtitle: `${scopePreview(id, tenantTitle)} · ${(entries ?? []).length} entries`,
    }),
  },
});

export const productContent = defineType({
  name: 'productContent',
  title: 'Modality Content',
  type: 'document',
  description: 'Content and settings specific to one Bookit modality.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'modality',
      title: 'Modality',
      type: 'string',
      options: { list: PRODUCT_OPTIONS, layout: 'radio' },
      readOnly: ({ value }) => value !== undefined,
      validation: (Rule) =>
        Rule.custom((value, context) =>
          value || context.document?.product ? true : 'Select a modality.',
        ),
    }),
    defineField({
      name: 'product',
      title: 'Product (legacy)',
      type: 'string',
      options: { list: PRODUCT_OPTIONS },
      readOnly: true,
      hidden: ({ value }) => value === undefined,
      deprecated: { reason: 'Use Modality. Existing values remain readable while content migrates.' },
    }),
    defineField({
      name: 'ticketing',
      title: 'Ticketing controls',
      type: 'ticketingContentConfig',
      description: 'Explicit Ticketing controls represented in the Figma tenant-config collection.',
      hidden: ({ document }) => (document?.modality ?? document?.product) !== 'ticketing',
    }),
    defineField({
      name: 'vip',
      title: 'VIP controls',
      type: 'vipContentConfig',
      description: 'Explicit VIP controls represented in the Figma tenant-config collection.',
      hidden: ({ document }) => (document?.modality ?? document?.product) !== 'vip',
    }),
    defineField({
      name: 'entries',
      title: 'Additional copy',
      type: 'array',
      of: [defineArrayMember({ type: 'copyEntry' })],
      description: INHERITS,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', modality: 'modality', product: 'product', entries: 'entries' },
    prepare: ({ tenantTitle, id, modality, product, entries }) => ({
      title: `${tenantTitle ? `${tenantTitle} · ` : ''}${modality ?? product ?? 'Modality'} — shared content`,
      subtitle: `${scopePreview(id, tenantTitle)} · ${(entries ?? []).length} entries`,
    }),
  },
});

const LEGACY_CONTENT_SECTION = defineArrayMember({
  type: 'object',
  name: 'contentSection',
  title: 'Legacy generic section',
  fields: [
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({ name: 'key', title: 'Key', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    defineField({ name: 'ctaLabel', title: 'Call to action label', type: 'string' }),
    defineField({ name: 'ctaUrl', title: 'Call to action URL', type: 'string' }),
    defineField({ name: 'disclaimer', title: 'Disclaimer', type: 'string' }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string' })],
    }),
  ],
  preview: {
    select: { key: 'key', heading: 'heading', visible: 'visible' },
    prepare: ({ key, heading, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${key ?? 'Legacy section'}`,
      subtitle: heading,
    }),
  },
});

const UNIVERSAL_SECTION_TYPES = [
  ...PAGE_SECTION_TYPE_NAMES,
  'marketingQualificationHero',
  'marketingQualificationOptions',
  'marketingTrustMetrics',
] as const;

const SECTION_INSERT_GROUPS = [
  {
    name: 'shared',
    title: 'Shared building blocks',
    of: ['editorialIntroSection', 'commerceShelfSection', 'valuePropositionGridSection', 'promoBannerSection', 'faqSection', 'mediaSplitSection', 'ctaBannerSection'],
  },
  { name: 'marketing', title: 'Marketing', of: ['marketingHeroSearchSection', 'dealGridSection', 'marketingQualificationHero', 'marketingQualificationOptions', 'marketingTrustMetrics'] },
  { name: 'ticketing', title: 'Tickets', of: ['ticketHeroSearchSection', 'ticketDiscoveryControlsSection', 'ticketCollectionGroupSection', 'ticketPopularCitiesSection'] },
  { name: 'vip', title: 'VIP Experiences', of: ['vipHeroSearchSection', 'vipSecondaryNavigationSection', 'vipExperienceCollectionSection', 'vipCategoryGridSection'] },
  { name: 'hotels', title: 'Stays', of: ['hotelHeroSearchSection', 'appDownloadPromoSection', 'brandLogoStripSection'] },
] as const;

const sectionsField = (includeLegacy: boolean) =>
  defineField({
    name: 'sections',
    title: 'Sections',
    type: 'array',
    group: 'content',
    description:
      'The ordered components rendered by this page. Every section maps to a registered frontend component; live inventory and transactional behavior remain application-owned.',
    hidden: ({ document }) => pageTemplate(document?.templateKey as string | undefined)?.structurePolicy === 'locked',
    of: [
      ...UNIVERSAL_SECTION_TYPES.map((type) => defineArrayMember({ type })),
      ...(includeLegacy ? [LEGACY_CONTENT_SECTION] : []),
    ],
    options: {
      insertMenu: {
        filter: true,
        groups: [
          ...SECTION_INSERT_GROUPS.map((group) => ({ ...group, of: [...group.of] })),
          ...(includeLegacy ? [{ name: 'legacy', title: 'Legacy — migration only', of: ['contentSection'] }] : []),
        ],
        views: [{ name: 'list' }],
      },
    },
    validation: (Rule) =>
      Rule.custom((sections, context) => {
        if (!Array.isArray(sections)) return true;
        const templateKey = context.document?.templateKey as string | undefined;
        const definition = pageTemplate(templateKey);
        if (!definition) return true;

        const typedSections = sections as Array<{ _type?: string; slotKey?: string }>;
        const unsupported = typedSections
          .filter((section) => section._type && !definition.allowedSectionTypes.includes(section._type))
          .map((section) => section._type);
        if (unsupported.length > 0) {
          return `This template does not support: ${Array.from(new Set(unsupported)).join(', ')}.`;
        }

        const slots = new Set(typedSections.map((section) => section.slotKey).filter(Boolean));
        const missing = definition.requiredSlots.filter((slot) => !slots.has(slot));
        return missing.length > 0 ? `Required template slots are missing: ${missing.join(', ')}.` : true;
      }),
  });

export const pageContent = defineType({
  name: 'pageContent',
  title: 'Page',
  type: 'document',
  description: 'A tenant-local page composed from approved frontend components.',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'settings', title: 'Settings' },
    { name: 'metadata', title: 'Metadata' },
  ],
  fields: [
    {
      ...tenantScopeField(),
      hidden: true,
    },
    defineField({
      name: 'title',
      title: 'Internal page title',
      type: 'string',
      group: 'content',
      description: 'Shown to editors in Sanity. This is not automatically rendered on the site.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'modality',
      title: 'Modality',
      type: 'string',
      hidden: true,
      readOnly: true,
      options: {
        list: [
          { title: 'Marketing', value: 'marketing' },
          { title: 'VIP Experiences', value: 'vip' },
          { title: 'Ticketing', value: 'ticketing' },
          { title: 'Stays', value: 'hotels' },
        ],
      },
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const expected = modalityFromRoute(context.document?.route as string | undefined);
          return !expected || value === expected ? true : `This page belongs to the ${expected} modality.`;
        }),
    }),
    defineField({
      name: 'templateKey',
      title: 'Page template',
      type: 'string',
      group: 'content',
      options: { list: PAGE_TEMPLATE_OPTIONS },
      readOnly: ({ value }) => value !== undefined,
      description: 'Defines the route policy, supported components, required slots, and structural flexibility.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'templateVersion', title: 'Template version', type: 'number', hidden: true, readOnly: true }),
    defineField({
      name: 'route',
      title: 'Application route',
      type: 'string',
      group: 'settings',
      options: { list: PAGE_ROUTES },
      readOnly: ({ value }) => value !== undefined,
      description: 'Assigned by the folder and template. Fixed application routes cannot be changed by an editor.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Page slug',
      type: 'slug',
      group: 'settings',
      hidden: ({ document }) => document?.route !== 'marketing/page' || document?.templateKey === 'marketing-home-v1',
      readOnly: ({ document }) => pageTemplate(document?.templateKey as string | undefined)?.routePolicy === 'locked',
      description: 'URL path without a leading slash. Only templates with an editor-controlled route expose this field.',
      validation: (Rule) =>
        Rule.custom((value, context) =>
          context.document?.route !== 'marketing/page' || value?.current
            ? true
            : 'A slug is required for Marketing pages.',
        ),
    }),
    sectionsField(true),
    defineField({
      name: 'campaignKey',
      title: 'Campaign key',
      type: 'string',
      group: 'settings',
      hidden: ({ document }) => document?.route !== 'marketing/page',
      description: 'Optional stable key for campaign targeting and reporting.',
    }),
    defineField({
      name: 'analyticsKey',
      title: 'Page analytics key',
      type: 'string',
      group: 'settings',
    }),
    defineField({
      name: 'heading',
      title: 'Page heading (legacy)',
      type: 'string',
      group: 'content',
      hidden: ({ document }) => Array.isArray(document?.sections) && document.sections.length > 0,
      deprecated: { reason: 'Move this value into the page hero section.' },
      description: `The page's main heading. ${INHERITS}`,
    }),
    defineField({
      name: 'subheading',
      title: 'Page subheading (legacy)',
      type: 'text',
      rows: 3,
      group: 'content',
      hidden: ({ document }) => Array.isArray(document?.sections) && document.sections.length > 0,
      deprecated: { reason: 'Move this value into the page hero section.' },
      description: INHERITS,
    }),
    defineField({
      name: 'metadata',
      title: 'Metadata',
      type: 'siteMetadata',
      group: 'metadata',
      description:
        'Overrides for this route only. Anything left empty falls through to tenant Shared Content, then to the ' +
        'universal default, so setting just a title here keeps the tenant favicon and social image.',
    }),
    defineField({
      name: 'modules',
      title: 'Marketing modules (legacy)',
      type: 'array',
      group: 'content',
      hidden: ({ document }) => document?.route !== 'marketing/page' || (Array.isArray(document?.sections) && document.sections.length > 0),
      readOnly: true,
      deprecated: { reason: 'Migrated to universal Sections.' },
      of: MARKETING_MODULE_TYPES.map((type) => defineArrayMember({ type })),
    }),
    defineField({
      name: 'entries',
      title: 'Additional keyed copy (legacy)',
      type: 'array',
      group: 'settings',
      of: [defineArrayMember({ type: 'copyEntry' })],
      description: `Keyed strings specific to this page. ${INHERITS}`,
    }),
    defineField({
      name: 'seo',
      title: 'SEO overrides (legacy)',
      type: 'seoConfig',
      group: 'metadata',
      readOnly: true,
      hidden: ({ value }) => value === undefined,
      deprecated: { reason: 'Use Metadata. Existing values remain readable until consumers migrate.' },
    }),
  ],
  preview: {
    select: {
      tenantTitle: 'tenant.title',
      id: '_id',
      route: 'route',
      slug: 'slug.current',
      templateKey: 'templateKey',
      title: 'title',
      modality: 'modality',
    },
    prepare: ({ tenantTitle, id, route, slug, templateKey, title, modality }) => ({
      title: `${tenantTitle ? `${tenantTitle} · ` : ''}${title || (route === 'marketing/page' ? `Marketing /${slug ?? 'untitled'}` : route ?? 'Page')}`,
      subtitle: [scopePreview(id, tenantTitle), modality ?? modalityFromRoute(route), templateKey].filter(Boolean).join(' · '),
    }),
  },
});

export const pageBlueprint = defineType({
  name: 'pageBlueprint',
  title: 'Page blueprint',
  type: 'document',
  description: 'A reusable, tenant-neutral starting point for creating tenant-local pages.',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'settings', title: 'Settings' },
    { name: 'metadata', title: 'Metadata defaults' },
  ],
  fields: [
    defineField({ name: 'title', title: 'Blueprint title', type: 'string', group: 'content', validation: (Rule) => Rule.required() }),
    defineField({ name: 'description', title: 'Description for editors', type: 'text', rows: 3, group: 'content' }),
    defineField({
      name: 'modality',
      title: 'Compatible modality',
      type: 'string',
      group: 'settings',
      readOnly: ({ value }) => value !== undefined,
      options: { list: [{ title: 'Marketing', value: 'marketing' }, { title: 'VIP Experiences', value: 'vip' }, { title: 'Ticketing', value: 'ticketing' }, { title: 'Stays', value: 'hotels' }] },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'templateKey',
      title: 'Structural template',
      type: 'string',
      group: 'settings',
      readOnly: ({ value }) => value !== undefined,
      options: { list: PAGE_TEMPLATE_OPTIONS },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'version', title: 'Blueprint version', type: 'number', group: 'settings', initialValue: 1, validation: (Rule) => Rule.integer().min(1).required() }),
    defineField({ name: 'defaultSlug', title: 'Suggested slug', type: 'slug', group: 'settings' }),
    sectionsField(false),
    defineField({ name: 'metadata', title: 'Metadata defaults', type: 'siteMetadata', group: 'metadata' }),
    defineField({ name: 'sourcePage', title: 'Created from page', type: 'reference', to: [{ type: 'pageContent' }], group: 'settings', readOnly: true }),
  ],
  preview: {
    select: { title: 'title', modality: 'modality', templateKey: 'templateKey', version: 'version' },
    prepare: ({ title, modality, templateKey, version }) => ({ title, subtitle: [modality, templateKey, `v${version ?? 1}`].filter(Boolean).join(' · ') }),
  },
});

