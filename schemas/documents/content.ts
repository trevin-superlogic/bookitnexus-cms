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
import { INHERITS, scopePreview, tenantScopeField } from '../lib/scope';
import { MARKETING_MODULE_TYPES, MARKETING_PAGE_TEMPLATES } from '../objects/marketingContent';

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
      title: `${modality ?? product ?? 'Modality'} — shared content`,
      subtitle: `${scopePreview(id, tenantTitle)} · ${(entries ?? []).length} entries`,
    }),
  },
});

export const pageContent = defineType({
  name: 'pageContent',
  title: 'Page content',
  type: 'document',
  description: 'Copy and approved component composition for one application route or flexible Marketing page.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'route',
      title: 'Page',
      type: 'string',
      options: { list: PAGE_ROUTES },
      readOnly: ({ value }) => value !== undefined,
      description: 'Chosen from the routes that exist in the apps — free text would let content point at nothing.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Marketing page slug',
      type: 'slug',
      hidden: ({ document }) => document?.route !== 'marketing/page',
      description: 'URL path without a leading slash, for example “home” or “qualification”.',
      validation: (Rule) =>
        Rule.custom((value, context) =>
          context.document?.route !== 'marketing/page' || value?.current
            ? true
            : 'A slug is required for Marketing pages.',
        ),
    }),
    defineField({
      name: 'templateKey',
      title: 'Marketing page template',
      type: 'string',
      hidden: ({ document }) => document?.route !== 'marketing/page',
      options: { list: [...MARKETING_PAGE_TEMPLATES], layout: 'radio' },
      description: 'Selects a code-defined starting layout. Modules remain individually editable below.',
    }),
    defineField({
      name: 'campaignKey',
      title: 'Campaign key',
      type: 'string',
      hidden: ({ document }) => document?.route !== 'marketing/page',
      description: 'Optional stable key for campaign targeting and reporting.',
    }),
    defineField({
      name: 'analyticsKey',
      title: 'Page analytics key',
      type: 'string',
      hidden: ({ document }) => document?.route !== 'marketing/page',
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: `The page's main heading. ${INHERITS}`,
    }),
    defineField({
      name: 'subheading',
      title: 'Subheading',
      type: 'text',
      rows: 3,
      description: INHERITS,
    }),
    defineField({
      name: 'metadata',
      title: 'Metadata',
      type: 'siteMetadata',
      description:
        'Overrides for this route only. Anything left empty falls through to tenant Shared Content, then to the ' +
        'universal default, so setting just a title here keeps the tenant favicon and social image.',
    }),
    defineField({
      name: 'modules',
      title: 'Marketing page modules',
      type: 'array',
      hidden: ({ document }) => document?.route !== 'marketing/page',
      description:
        'Ordered, approved application components. Sanity controls content and merchandising direction; the app and APIs own live inventory, eligibility, and rendering.',
      of: MARKETING_MODULE_TYPES.map((type) => defineArrayMember({ type })),
    }),
    defineField({
      name: 'sections',
      title: 'Legacy sections',
      type: 'array',
      description: `Existing simple sections. Use Marketing page modules for new Marketing pages. ${INHERITS}`,
      of: [
        defineArrayMember({
          type: 'object',
          name: 'contentSection',
          fields: [
            defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
            defineField({
              name: 'key',
              title: 'Key',
              type: 'string',
              description: 'Which slot on the page this fills, e.g. "highlight", "ticketsCallout".',
              validation: (Rule) => Rule.required(),
            }),
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
              title: `${visible === false ? '○ ' : ''}${key ?? ''}`,
              subtitle: heading,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'entries',
      title: 'Additional copy',
      type: 'array',
      of: [defineArrayMember({ type: 'copyEntry' })],
      description: `Keyed strings specific to this page. ${INHERITS}`,
    }),
    defineField({
      name: 'seo',
      title: 'SEO overrides (legacy)',
      type: 'seoConfig',
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
      heading: 'heading',
    },
    prepare: ({ tenantTitle, id, route, slug, templateKey, heading }) => ({
      title: route === 'marketing/page' ? `Marketing /${slug ?? 'untitled'}` : route ?? 'Page',
      subtitle: [scopePreview(id, tenantTitle), templateKey, heading].filter(Boolean).join(' · '),
    }),
  },
});
