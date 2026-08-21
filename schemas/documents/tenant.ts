/**
 * Tenant Configuration — the root document every other document references.
 *
 * This is the single editor-facing home for tenant identity and higher-level
 * application settings that are currently stored as environment variables.
 * Content and theme data remain in focused documents that reference it.
 */
import { defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

export const tenant = defineType({
  name: 'tenant',
  title: 'Tenant Configuration',
  type: 'document',
  groups: [
    { name: 'identity', title: 'Identity & status', default: true },
    { name: 'modalities', title: 'Modalities & features' },
    { name: 'destinations', title: 'External destinations' },
    { name: 'rewards', title: 'Rewards' },
    { name: 'commerce', title: 'Commerce' },
    { name: 'brand', title: 'Brand & SEO' },
  ],
  fields: [
    defineField({
      name: 'title',
      group: 'identity',
      title: 'Display name',
      type: 'string',
      description: 'Human-readable name shown in the Studio, e.g. "Crypto.com".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      group: 'identity',
      title: 'Tenant ID',
      type: 'slug',
      description:
        'Must match TenantId in apps/live-tickets/src/tenant.types.ts — this is the value of the TENANT build ' +
        'variable and the name of the theme directory. Changing it after launch breaks the build.',
      options: { source: 'title', maxLength: 32 },
      validation: (Rule) =>
        Rule.required().custom((value) =>
          value?.current && /^[a-z0-9-]+$/.test(value.current)
            ? true
            : 'Use lowercase letters, numbers and hyphens only.',
        ),
    }),
    defineField({
      name: 'figmaBrandKey',
      group: 'identity',
      title: 'Figma brand key (legacy)',
      type: 'string',
      readOnly: true,
      hidden: true,
      description:
        'No longer set by hand. Brands are matched on Tenant ID: "🔴tria", "u_e" and "tria" all resolve to the ' +
        'same brand, so the Figma key and the Tenant ID never have to be kept in sync. Retained only so older ' +
        'documents keep their value.',
    }),
    defineField({
      name: 'domain',
      group: 'identity',
      title: 'Primary domain',
      type: 'string',
      description: 'Production domain, e.g. "crypto.com". Matches TENANT_DOMAINS in scripts/run-next.ts.',
    }),
    defineField({
      name: 'enabledProducts',
      group: 'modalities',
      title: 'Enabled modalities',
      type: 'array',
      description:
        'Which modality surfaces this tenant runs. Controls navigation, API output, and which modality content is used.',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Ticketing (live-tickets)', value: 'ticketing' },
          { title: 'VIP (bookit)', value: 'vip' },
          { title: 'Hotels (Vite app)', value: 'hotels' },
          { title: 'Marketing', value: 'marketing' },
        ],
      },
    }),
    defineField({
      name: 'active',
      group: 'identity',
      title: 'Active',
      type: 'boolean',
      description: 'Inactive tenants stay editable but are excluded from the API response.',
      initialValue: true,
    }),
    defineField({
      name: 'features',
      group: 'modalities',
      title: 'Feature availability',
      type: 'object',
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: 'hasSweeps', title: 'Sweepstakes', type: 'boolean', description: INHERITS }),
      ],
    }),
    defineField({
      name: 'externalUrls',
      group: 'destinations',
      title: 'External destinations',
      type: 'object',
      description:
        'Tenant-specific destinations currently supplied through environment variables. Leave a value empty to keep using the application fallback.',
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: 'travelUrl', title: 'Travel URL', type: 'url', description: INHERITS }),
        defineField({ name: 'experiencesUrl', title: 'Experiences URL', type: 'url', description: INHERITS }),
        defineField({ name: 'upgradeUrl', title: 'Membership upgrade URL', type: 'url', description: INHERITS }),
      ],
    }),
    defineField({ name: 'rewards', title: 'Rewards & pricing display', type: 'rewardsConfig', group: 'rewards' }),
    defineField({ name: 'payments', title: 'Payment methods', type: 'paymentConfig', group: 'commerce' }),
    defineField({ name: 'topUp', title: 'Points top-up', type: 'topUpConfig', group: 'commerce' }),
    defineField({ name: 'onboarding', title: 'Login & onboarding', type: 'onboardingConfig', group: 'commerce' }),
    defineField({ name: 'brandAssets', title: 'Brand assets', type: 'brandAssets', group: 'brand' }),
    defineField({ name: 'seo', title: 'SEO & metadata', type: 'seoConfig', group: 'brand' }),
  ],
  preview: {
    select: { title: 'title', slug: 'slug.current', active: 'active' },
    prepare: ({ title, slug, active }) => ({
      title: `${title}${active === false ? ' (inactive)' : ''}`,
      subtitle: slug,
    }),
  },
});
