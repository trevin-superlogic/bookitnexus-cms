/**
 * Deprecated split site-content documents.
 *
 * These types were briefly introduced while the CMS information architecture
 * was being explored. Shared Content remains the canonical home for anything
 * reused across modalities. Keep these definitions until their drafts have
 * been reviewed and removed so Sanity can still render the old documents.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS, scopePreview, tenantScopeField } from '../lib/scope';

const LEGAL_ROUTES = [
  { title: '/terms', value: 'terms' },
  { title: '/privacy-policy', value: 'privacy-policy' },
  { title: '/accessibility', value: 'accessibility' },
  { title: '/cookie-policy', value: 'cookie-policy' },
];

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings (legacy)',
  type: 'document',
  deprecated: { reason: 'Tenant-level settings belong in Tenant Configuration.' },
  description: 'Tenant-level metadata, icons, social sharing defaults and search-engine visibility.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'metadata',
      title: 'Metadata',
      type: 'siteMetadata',
      description: `Pages can override individual values. ${INHERITS}`,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', title: 'metadata.title' },
    prepare: ({ tenantTitle, id, title }) => ({
      title: title || 'Site settings',
      subtitle: scopePreview(id, tenantTitle),
    }),
  },
});

export const siteNavigation = defineType({
  name: 'siteNavigation',
  title: 'Navigation & footer (legacy)',
  type: 'document',
  deprecated: { reason: 'Navigation and footer belong in Shared Content.' },
  description:
    'Choose the navigation model, edit only that model\'s features, and manage the site footer. Switching models does not delete the other model\'s saved configuration.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'variant',
      title: 'Navigation model',
      type: 'string',
      description: `Choose the navigation the tenant renders. ${INHERITS}`,
      options: {
        list: [
          { title: 'Bookit Nexus', value: 'nexus' },
          { title: 'Legacy', value: 'legacy' },
        ],
      },
    }),
    defineField({
      name: 'nexus',
      title: 'Bookit Nexus features',
      type: 'nexusNavbar',
      description: 'Simplified top-level destinations, icons and account controls.',
      hidden: ({ parent }) => parent?.variant !== 'nexus',
    }),
    defineField({
      name: 'legacy',
      title: 'Legacy features',
      type: 'legacyNavbar',
      description: 'Multi-level navigation, featured destinations, product rows and account controls.',
      hidden: ({ parent }) => parent?.variant !== 'legacy',
    }),
    defineField({
      name: 'footer',
      title: 'Footer',
      type: 'footerChrome',
      description: `Logo, link groups, co-branding and support contacts. ${INHERITS}`,
    }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id', variant: 'variant' },
    prepare: ({ tenantTitle, id, variant }) => ({
      title: 'Navigation & footer',
      subtitle: [scopePreview(id, tenantTitle), variant === 'nexus' ? 'Bookit Nexus' : variant === 'legacy' ? 'Legacy' : null]
        .filter(Boolean)
        .join(' · '),
    }),
  },
});

export const paymentSettings = defineType({
  name: 'paymentSettings',
  title: 'Payment settings (legacy)',
  type: 'document',
  deprecated: { reason: 'Payment availability belongs in Tenant Configuration; shared widget content belongs in Shared Content.' },
  description: 'Tenant-level payment methods and customer-facing SpreePay widget configuration.',
  fields: [
    tenantScopeField(),
    defineField({ name: 'methods', title: 'Payment methods', type: 'paymentConfig', description: INHERITS }),
    defineField({ name: 'widget', title: 'SpreePay widget', type: 'spreePayWidget', description: INHERITS }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id' },
    prepare: ({ tenantTitle, id }) => ({ title: 'Payment settings', subtitle: scopePreview(id, tenantTitle) }),
  },
});

export const legalDocument = defineType({
  name: 'legalDocument',
  title: 'Legal document (legacy)',
  type: 'document',
  deprecated: { reason: 'Cross-modality legal content belongs in Shared Content.' },
  description: 'A tenant-specific legal page. Create one document per route.',
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
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'body', title: 'Body', type: 'array', of: [defineArrayMember({ type: 'block' })] }),
  ],
  preview: {
    select: { title: 'title', slug: 'slug', visible: 'visible', tenantTitle: 'tenant.title', id: '_id' },
    prepare: ({ title, slug, visible, tenantTitle, id }) => ({
      title: `${visible === false ? '○ ' : ''}${title || 'Legal document'}`,
      subtitle: [scopePreview(id, tenantTitle), slug ? `/${slug}` : null].filter(Boolean).join(' · '),
    }),
  },
});

export const sharedCopy = defineType({
  name: 'sharedCopy',
  title: 'Shared copy (legacy)',
  type: 'document',
  deprecated: { reason: 'Cross-modality copy belongs in Shared Content.' },
  description: 'Reusable copy grouped by a stable product or feature key.',
  fields: [
    tenantScopeField(),
    defineField({
      name: 'title',
      title: 'Group title',
      type: 'string',
      description: 'An editor-friendly name for this group.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'feature',
      title: 'Product or feature',
      type: 'string',
      description: 'A stable grouping key such as ticketing.checkout or vip.membership.',
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
      description: `Each key overrides only the matching universal key. ${INHERITS}`,
    }),
  ],
  preview: {
    select: { title: 'title', feature: 'feature', entries: 'entries', tenantTitle: 'tenant.title', id: '_id' },
    prepare: ({ title, feature, entries, tenantTitle, id }) => ({
      title: title || feature || 'Shared copy',
      subtitle: `${scopePreview(id, tenantTitle)} · ${(entries ?? []).length} entries`,
    }),
  },
});
