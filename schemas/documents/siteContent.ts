/** Focused site-wide content documents. */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS, scopePreview, tenantScopeField } from '../lib/scope';

const NAVIGATION_MODELS = [
  { title: 'Bookit Nexus', value: 'nexus' },
  { title: 'Legacy', value: 'legacy' },
];

const LEGAL_ROUTES = [
  { title: '/terms', value: '/terms' },
  { title: '/privacy-policy', value: '/privacy-policy' },
  { title: '/accessibility', value: '/accessibility' },
  { title: '/cookie-policy', value: '/cookie-policy' },
];

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  description: 'Site metadata, icons, social defaults, and search visibility.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'metadata',
      title: 'Metadata',
      type: 'siteMetadata',
      description: `Defaults for page titles, icons, social sharing, and search visibility. ${INHERITS}`,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', metadataTitle: 'metadata.title' },
    prepare: ({ tenantTitle, id, metadataTitle }) => ({
      title: metadataTitle || 'Site settings',
      subtitle: scopePreview(id, tenantTitle),
    }),
  },
});

export const siteNavigation = defineType({
  name: 'siteNavigation',
  title: 'Navigation & footer',
  type: 'document',
  description: 'Navigation-model selection, model-specific configuration, and footer content.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'variant',
      title: 'Navigation model',
      type: 'string',
      description:
        'Selects the navigation the apps render. Both models stay saved so editors can switch without losing work. ' +
        INHERITS,
      options: { list: NAVIGATION_MODELS },
    }),
    defineField({
      name: 'nexus',
      title: 'Bookit Nexus navbar',
      type: 'nexusNavbar',
      hidden: ({ document }) => document?.variant !== 'nexus',
    }),
    defineField({
      name: 'legacy',
      title: 'Legacy navbar',
      type: 'legacyNavbar',
      hidden: ({ document }) => document?.variant !== 'legacy',
    }),
    defineField({
      name: 'footer',
      title: 'Footer',
      type: 'footerChrome',
      description: `Footer links, support details, logos, and co-branding. ${INHERITS}`,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', variant: 'variant' },
    prepare: ({ tenantTitle, id, variant }) => ({
      title: 'Navigation & footer',
      subtitle: [scopePreview(id, tenantTitle), variant === 'nexus' ? 'Bookit Nexus' : variant === 'legacy' ? 'Legacy' : undefined]
        .filter(Boolean)
        .join(' · '),
    }),
  },
});

export const paymentSettings = defineType({
  name: 'paymentSettings',
  title: 'Payment settings',
  type: 'document',
  description: 'Payment-method display settings and SpreePay widget content.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'methods',
      title: 'Payment methods',
      type: 'paymentConfig',
      description: `Controls which payment methods the experience presents. ${INHERITS}`,
    }),
    defineField({
      name: 'widget',
      title: 'SpreePay widget',
      type: 'spreePayWidget',
      description: `Controls the payment choices and copy shown inside the widget. ${INHERITS}`,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id' },
    prepare: ({ tenantTitle, id }) => ({
      title: 'Payment settings',
      subtitle: scopePreview(id, tenantTitle),
    }),
  },
});

export const legalDocument = defineType({
  name: 'legalDocument',
  title: 'Legal document',
  type: 'document',
  description: 'A tenant-scoped legal page for one supported route.',
  fields: [
    tenantScopeField(),
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({
      name: 'slug',
      title: 'Route',
      type: 'string',
      options: { list: LEGAL_ROUTES },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: INHERITS,
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [defineArrayMember({ type: 'block' })],
      description: INHERITS,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', title: 'title', slug: 'slug', visible: 'visible' },
    prepare: ({ tenantTitle, id, title, slug, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${title || slug || 'Legal document'}`,
      subtitle: [scopePreview(id, tenantTitle), slug].filter(Boolean).join(' · '),
    }),
  },
});

export const sharedCopy = defineType({
  name: 'sharedCopy',
  title: 'Shared copy',
  type: 'document',
  description: 'Reusable keyed copy grouped by a product or feature identifier.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Editor-facing name for this group of reusable copy.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'feature',
      title: 'Feature key',
      type: 'string',
      description: 'Stable product or feature identifier. Changing it breaks frontend references.',
      validation: (Rule) =>
        Rule.required().custom((value) =>
          value && /^[a-zA-Z0-9.\-_]+$/.test(value) ? true : 'Letters, numbers, dots, hyphens and underscores only.',
        ),
    }),
    defineField({
      name: 'entries',
      title: 'Copy',
      type: 'array',
      of: [defineArrayMember({ type: 'copyEntry' })],
      description: `Overriding an entry replaces only that key. ${INHERITS}`,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', title: 'title', feature: 'feature', entries: 'entries' },
    prepare: ({ tenantTitle, id, title, feature, entries }) => ({
      title: title || feature || 'Shared copy',
      subtitle: [scopePreview(id, tenantTitle), feature, `${(entries ?? []).length} entries`].filter(Boolean).join(' · '),
    }),
  },
});
