import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

const visibleField = () =>
  defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true });

const imageField = (name: string, title: string) =>
  defineField({
    name,
    title,
    type: 'image',
    options: { hotspot: true },
    fields: [
      defineField({
        name: 'alt',
        title: 'Alt text',
        type: 'string',
        validation: (Rule) => Rule.required().warning('Add alt text unless the image is decorative.'),
      }),
    ],
  });

const ctaFields = [
  defineField({ name: 'ctaLabel', title: 'Call to action label', type: 'string' }),
  defineField({
    name: 'ctaUrl',
    title: 'Call to action URL',
    type: 'string',
    description: 'Use an internal path, approved deep link, or full http(s) URL.',
  }),
];

export const marketingEditorialHero = defineType({
  name: 'marketingEditorialHero',
  title: 'Editorial hero',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    defineField({ name: 'locationLabel', title: 'Location label', type: 'string' }),
    imageField('image', 'Image'),
    ...ctaFields,
  ],
  preview: { select: { title: 'heading', media: 'image', visible: 'visible' } },
});

export const marketingMultiModalitySearch = defineType({
  name: 'marketingMultiModalitySearch',
  title: 'Multi-modality search',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'heading', title: 'Accessible heading', type: 'string' }),
    defineField({
      name: 'enabledModalities',
      title: 'Enabled modalities',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      options: {
        list: [
          { title: 'Experiences', value: 'vip' },
          { title: 'Stays', value: 'hotels' },
          { title: 'Tickets', value: 'ticketing' },
        ],
      },
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: 'defaultModality',
      title: 'Default modality',
      type: 'string',
      options: {
        list: [
          { title: 'Experiences', value: 'vip' },
          { title: 'Stays', value: 'hotels' },
          { title: 'Tickets', value: 'ticketing' },
        ],
      },
    }),
    defineField({ name: 'analyticsKey', title: 'Analytics key', type: 'string' }),
  ],
  preview: {
    prepare: () => ({ title: 'Multi-modality search', subtitle: 'Application-backed search controls' }),
  },
});

export const marketingCopySection = defineType({
  name: 'marketingCopySection',
  title: 'Copy section',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'key', title: 'Section key', type: 'string' }),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 4 }),
    ...ctaFields,
  ],
  preview: { select: { title: 'heading', subtitle: 'key', visible: 'visible' } },
});

export const marketingValuePropositionGrid = defineType({
  name: 'marketingValuePropositionGrid',
  title: 'Value proposition grid',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    defineField({
      name: 'items',
      title: 'Value propositions',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'valueProposition',
          title: 'Value proposition',
          type: 'object',
          fields: [
            defineField({ name: 'key', title: 'Key', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
            defineField({
              name: 'iconKey',
              title: 'Approved icon key',
              type: 'string',
              description: 'The application maps this stable key to the approved icon library.',
            }),
          ],
          preview: { select: { title: 'title', subtitle: 'key' } },
        }),
      ],
    }),
  ],
  preview: { select: { title: 'heading', items: 'items', visible: 'visible' } },
});

export const marketingCommerceShelf = defineType({
  name: 'marketingCommerceShelf',
  title: 'Commerce shelf',
  type: 'object',
  description: 'Stores merchandising direction. Product data remains API-owned.',
  fields: [
    visibleField(),
    defineField({
      name: 'source',
      title: 'Product source',
      type: 'string',
      options: {
        list: [
          { title: 'Hotels', value: 'hotels' },
          { title: 'VIP Experiences', value: 'vip' },
          { title: 'Ticketing', value: 'ticketing' },
          { title: 'Deals', value: 'deals' },
          { title: 'Sweepstakes', value: 'sweepstakes' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'selectionMode',
      title: 'Selection mode',
      type: 'string',
      options: {
        list: [
          { title: 'Automatic', value: 'automatic' },
          { title: 'Rules', value: 'rules' },
          { title: 'Curated', value: 'curated' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Supporting copy', type: 'text', rows: 3 }),
    ...ctaFields,
    defineField({ name: 'limit', title: 'Maximum items', type: 'number', validation: (Rule) => Rule.min(1).max(24) }),
    defineField({
      name: 'queryContext',
      title: 'Query context',
      type: 'string',
      options: {
        list: [
          { title: 'Tenant default', value: 'tenantDefault' },
          { title: 'Current location', value: 'currentLocation' },
          { title: 'Campaign', value: 'campaign' },
        ],
      },
    }),
    defineField({
      name: 'filters',
      title: 'Approved filters',
      type: 'array',
      description: 'The resolver accepts only source-specific approved filter keys.',
      of: [
        defineArrayMember({
          name: 'merchandisingFilter',
          title: 'Filter',
          type: 'object',
          fields: [
            defineField({ name: 'key', title: 'Filter key', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'value', title: 'Filter value', type: 'string', validation: (Rule) => Rule.required() }),
          ],
          preview: { select: { title: 'key', subtitle: 'value' } },
        }),
      ],
    }),
    defineField({ name: 'pinnedItemIds', title: 'Pinned product IDs', type: 'array', of: [defineArrayMember({ type: 'string' })] }),
    defineField({ name: 'excludedItemIds', title: 'Excluded product IDs', type: 'array', of: [defineArrayMember({ type: 'string' })] }),
    defineField({ name: 'sort', title: 'Approved sort key', type: 'string' }),
    defineField({
      name: 'fallbackBehavior',
      title: 'Fallback behavior',
      type: 'string',
      options: {
        list: [
          { title: 'Hide the module', value: 'hide' },
          { title: 'Broaden the query', value: 'broaden' },
          { title: 'Use curated fallback', value: 'curatedFallback' },
        ],
      },
    }),
    defineField({
      name: 'componentVariant',
      title: 'Approved component variant',
      type: 'string',
      description: 'A code-defined variant key. This does not allow arbitrary styling.',
    }),
    defineField({ name: 'analyticsKey', title: 'Analytics key', type: 'string' }),
  ],
  preview: {
    select: { title: 'heading', source: 'source', mode: 'selectionMode', visible: 'visible' },
    prepare: ({ title, source, mode, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${title || source || 'Commerce shelf'}`,
      subtitle: [source, mode].filter(Boolean).join(' · '),
    }),
  },
});

export const marketingPromoBanner = defineType({
  name: 'marketingPromoBanner',
  title: 'Promotion banner',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    imageField('media', 'Media'),
    ...ctaFields,
    defineField({ name: 'actionKey', title: 'Approved action key', type: 'string' }),
    defineField({ name: 'analyticsKey', title: 'Analytics key', type: 'string' }),
  ],
  preview: { select: { title: 'heading', media: 'media', visible: 'visible' } },
});

export const marketingQualificationHero = defineType({
  name: 'marketingQualificationHero',
  title: 'Qualification hero',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'tag', title: 'Feature tag', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    imageField('image', 'Image'),
    defineField({
      name: 'proofChips',
      title: 'Proof and benefit chips',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'proofChip',
          title: 'Proof chip',
          type: 'object',
          fields: [
            defineField({ name: 'key', title: 'Key', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'label', title: 'Label', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'iconKey', title: 'Approved icon key', type: 'string' }),
          ],
          preview: { select: { title: 'label', subtitle: 'key' } },
        }),
      ],
    }),
  ],
  preview: { select: { title: 'heading', subtitle: 'tag', media: 'image', visible: 'visible' } },
});

export const marketingQualificationOptions = defineType({
  name: 'marketingQualificationOptions',
  title: 'Qualification options',
  type: 'object',
  description: 'Sanity controls presentation. The application or API evaluates eligibility and executes actions.',
  fields: [
    visibleField(),
    defineField({
      name: 'variant',
      title: 'Qualification layout',
      type: 'string',
      options: {
        list: [
          { title: 'Single path', value: 'singlePath' },
          { title: 'Multiple paths', value: 'multiPath' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    defineField({
      name: 'options',
      title: 'Qualification paths',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'qualificationOption',
          title: 'Qualification path',
          type: 'object',
          fields: [
            defineField({ name: 'key', title: 'Key', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
            defineField({ name: 'badge', title: 'Badge', type: 'string' }),
            defineField({ name: 'benefits', title: 'Benefits', type: 'array', of: [defineArrayMember({ type: 'string' })] }),
            defineField({ name: 'steps', title: 'Steps', type: 'array', of: [defineArrayMember({ type: 'string' })] }),
            defineField({ name: 'ctaLabel', title: 'Call to action label', type: 'string' }),
            defineField({
              name: 'actionKey',
              title: 'Approved action',
              type: 'string',
              options: {
                list: [
                  { title: 'Open app', value: 'openApp' },
                  { title: 'Sign in', value: 'signIn' },
                  { title: 'Connect wallet', value: 'connectWallet' },
                  { title: 'Start referral', value: 'startReferral' },
                  { title: 'Start card application', value: 'startCardApplication' },
                  { title: 'Open external URL', value: 'openExternalUrl' },
                ],
              },
              validation: (Rule) => Rule.required(),
            }),
            defineField({ name: 'actionUrl', title: 'Action URL', type: 'string' }),
            defineField({
              name: 'eligibilityRuleKey',
              title: 'Eligibility rule key',
              type: 'string',
              description: 'A code-defined resolver key. Do not place executable rules in Sanity.',
            }),
            defineField({ name: 'supportingNote', title: 'Supporting note', type: 'string' }),
            defineField({ name: 'priority', title: 'Priority', type: 'number' }),
          ],
          preview: { select: { title: 'title', subtitle: 'actionKey' } },
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: { title: 'heading', variant: 'variant', visible: 'visible' },
    prepare: ({ title, variant, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${title || 'Qualification options'}`,
      subtitle: variant,
    }),
  },
});

export const marketingTrustMetrics = defineType({
  name: 'marketingTrustMetrics',
  title: 'Trust metrics',
  type: 'object',
  fields: [
    visibleField(),
    defineField({
      name: 'items',
      title: 'Metrics',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'trustMetric',
          title: 'Trust metric',
          type: 'object',
          fields: [
            defineField({ name: 'key', title: 'Key', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'value', title: 'Value', type: 'string' }),
            defineField({ name: 'label', title: 'Label', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'iconKey', title: 'Approved icon key', type: 'string' }),
            defineField({
              name: 'source',
              title: 'Data source',
              type: 'string',
              options: { list: [{ title: 'Static CMS value', value: 'static' }, { title: 'API value', value: 'api' }] },
            }),
            defineField({ name: 'metricKey', title: 'API metric key', type: 'string' }),
          ],
          preview: { select: { title: 'value', subtitle: 'label' } },
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Trust metrics' }) },
});

export const marketingFaqSection = defineType({
  name: 'marketingFaqSection',
  title: 'FAQ section',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({
      name: 'items',
      title: 'Questions',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'faqItem',
          title: 'Question',
          type: 'object',
          fields: [
            defineField({ name: 'question', title: 'Question', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'answer', title: 'Answer', type: 'text', rows: 4, validation: (Rule) => Rule.required() }),
          ],
          preview: { select: { title: 'question', subtitle: 'answer' } },
        }),
      ],
    }),
  ],
  preview: { select: { title: 'heading', visible: 'visible' } },
});

export const marketingMediaSplit = defineType({
  name: 'marketingMediaSplit',
  title: 'Media and copy section',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 4 }),
    imageField('media', 'Media'),
    ...ctaFields,
    defineField({
      name: 'variant',
      title: 'Approved component variant',
      type: 'string',
      description: 'A code-defined variant key. This does not allow arbitrary styling.',
    }),
  ],
  preview: { select: { title: 'heading', media: 'media', visible: 'visible' } },
});

export const marketingCtaBanner = defineType({
  name: 'marketingCtaBanner',
  title: 'Call to action banner',
  type: 'object',
  fields: [
    visibleField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    ...ctaFields,
    defineField({ name: 'actionKey', title: 'Approved action key', type: 'string' }),
    defineField({ name: 'analyticsKey', title: 'Analytics key', type: 'string' }),
  ],
  preview: { select: { title: 'heading', visible: 'visible' } },
});

export const marketingPageModules = [
  marketingEditorialHero,
  marketingMultiModalitySearch,
  marketingCopySection,
  marketingValuePropositionGrid,
  marketingCommerceShelf,
  marketingPromoBanner,
  marketingQualificationHero,
  marketingQualificationOptions,
  marketingTrustMetrics,
  marketingFaqSection,
  marketingMediaSplit,
  marketingCtaBanner,
];

export const MARKETING_MODULE_TYPES = [
  'marketingEditorialHero',
  'marketingMultiModalitySearch',
  'marketingCopySection',
  'marketingValuePropositionGrid',
  'marketingCommerceShelf',
  'marketingPromoBanner',
  'marketingQualificationHero',
  'marketingQualificationOptions',
  'marketingTrustMetrics',
  'marketingFaqSection',
  'marketingMediaSplit',
  'marketingCtaBanner',
] as const;

export const MARKETING_PAGE_TEMPLATES = [
  { title: 'Marketing home v1', value: 'marketing-home-v1' },
  { title: 'Qualification v1', value: 'qualification-v1' },
  { title: 'Flexible marketing page v1', value: 'flexible-v1' },
] as const;

export const MARKETING_INHERITANCE = INHERITS;
