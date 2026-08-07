/**
 * Experience Configuration — one document per tenant, plus one universal
 * default (`default.experienceConfig`).
 *
 * This is the CMS home for everything the Figma "Tenant Config · Template
 * Variables" collection describes, and for the ~40 `switch (NEXT_PUBLIC_TENANT_ID)`
 * branches spread across apps/live-tickets today.
 *
 * Note what is NOT here, per the PDP's configuration boundary: no secrets, no
 * API endpoints, no payment or pricing rules, no points conversion, no
 * eligibility logic. Feature toggles below control whether a surface is
 * *offered*; whether a given user may actually use it stays with the backend.
 */
import { defineField, defineType } from 'sanity';

import { INHERITS, scopePreview, tenantScopeField } from '../lib/scope';

export const experienceConfig = defineType({
  name: 'experienceConfig',
  title: 'Tenant Configuration',
  type: 'document',
  groups: [
    { name: 'general', title: 'General', default: true },
    { name: 'rewards', title: 'Rewards' },
    { name: 'navigation', title: 'Navigation' },
    { name: 'footer', title: 'Footer' },
    { name: 'commerce', title: 'Commerce' },
    { name: 'brand', title: 'Brand & SEO' },
  ],
  fields: [
    tenantScopeField(),

    defineField({
      name: 'products',
      title: 'Product availability',
      type: 'object',
      group: 'general',
      description:
        'Whether each product surface is offered to this tenant. Turning one off removes its navigation, its ' +
        'content from the API response, and its entry points across the apps.',
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: 'hasTicketing', title: 'Ticketing', type: 'boolean', description: INHERITS }),
        defineField({ name: 'hasVipExperiences', title: 'VIP experiences', type: 'boolean', description: INHERITS }),
        defineField({ name: 'hasHotels', title: 'Hotels', type: 'boolean', description: INHERITS }),
        defineField({ name: 'hasSweeps', title: 'Sweepstakes', type: 'boolean', description: INHERITS }),
      ],
    }),

    defineField({
      name: 'externalUrls',
      title: 'External destinations',
      type: 'object',
      group: 'general',
      description:
        'Base URLs referenced by navigation and footer links as {travelUrl}, {experiencesUrl} and {upgradeUrl}. ' +
        'These are per-environment values today (NEXT_PUBLIC_TRAVEL_URL and friends); set them here only if you ' +
        'want the CMS to own them. Leave empty to keep using the environment variables.',
      options: { collapsible: true, collapsed: true },
      fields: [
        defineField({ name: 'travelUrl', title: 'Travel URL', type: 'url', description: INHERITS }),
        defineField({ name: 'experiencesUrl', title: 'Experiences URL', type: 'url', description: INHERITS }),
        defineField({ name: 'upgradeUrl', title: 'Membership upgrade URL', type: 'url', description: INHERITS }),
      ],
    }),

    defineField({ name: 'rewards', title: 'Rewards & pricing display', type: 'rewardsConfig', group: 'rewards' }),
    // Navigation and footer moved to Shared content, where the rest of the
    // editable chrome lives. Kept here, deprecated, so existing tenant data is
    // not orphaned — the resolver prefers Shared content when both are set.
    defineField({
      name: 'navigation',
      title: 'Navigation (moved)',
      type: 'navigationConfig',
      group: 'navigation',
      description: 'Edit navigation under Shared content → Navbar. This copy is retained only for existing data.',
    }),
    defineField({
      name: 'footer',
      title: 'Footer (moved)',
      type: 'footerConfig',
      group: 'footer',
      description: 'Edit the footer under Shared content → Footer. This copy is retained only for existing data.',
    }),
    defineField({ name: 'payments', title: 'Payment methods', type: 'paymentConfig', group: 'commerce' }),
    defineField({ name: 'topUp', title: 'Points top-up', type: 'topUpConfig', group: 'commerce' }),
    defineField({ name: 'onboarding', title: 'Login & onboarding', type: 'onboardingConfig', group: 'commerce' }),
    defineField({ name: 'brandAssets', title: 'Brand assets', type: 'brandAssets', group: 'brand' }),
    defineField({ name: 'seo', title: 'SEO & metadata', type: 'seoConfig', group: 'brand' }),
  ],
  preview: {
    select: { tenantTitle: 'tenant.title', id: '_id' },
    prepare: ({ tenantTitle, id }) => ({
      title: 'Tenant Configuration',
      subtitle: scopePreview(id, tenantTitle),
    }),
  },
});
