import { defineArrayMember, defineField, defineType } from 'sanity';

const visibleField = () =>
  defineField({
    name: 'visible',
    title: 'Visible',
    type: 'boolean',
    initialValue: true,
    description: 'Turn this off to keep the section configured without rendering it.',
  });

const slotField = () =>
  defineField({
    name: 'slotKey',
    title: 'Template slot',
    type: 'string',
    readOnly: true,
    hidden: ({ value }) => !value,
    description: 'Stable slot assigned by the page template.',
  });

const analyticsField = () =>
  defineField({ name: 'analyticsKey', title: 'Analytics key', type: 'string' });

const imageField = (name: string, title: string, description?: string) =>
  defineField({
    name,
    title,
    type: 'image',
    description,
    options: { hotspot: true, accept: 'image/*' },
    fields: [
      defineField({
        name: 'alt',
        title: 'Alt text',
        type: 'string',
        validation: (Rule) => Rule.required().warning('Add alt text unless this image is purely decorative.'),
      }),
    ],
  });

const ctaFields = [
  defineField({ name: 'ctaLabel', title: 'Call to action label', type: 'string' }),
  defineField({
    name: 'ctaUrl',
    title: 'Call to action destination',
    type: 'string',
    description: 'Use a path beginning with / or a complete https URL.',
    validation: (Rule) =>
      Rule.custom((value) =>
        !value || value.startsWith('/') || value.startsWith('https://')
          ? true
          : 'Use an internal path beginning with / or a complete https URL.',
      ),
  }),
];

const modalityOptions = [
  { title: 'VIP Experiences', value: 'vip' },
  { title: 'Stays', value: 'hotels' },
  { title: 'Tickets', value: 'ticketing' },
];

const merchandisingFields = [
  defineField({
    name: 'selectionMode',
    title: 'Selection mode',
    type: 'string',
    initialValue: 'automatic',
    options: {
      list: [
        { title: 'Automatic', value: 'automatic' },
        { title: 'Rules', value: 'rules' },
        { title: 'Curated', value: 'curated' },
        { title: 'Mixed', value: 'mixed' },
      ],
      layout: 'radio',
    },
    validation: (Rule) => Rule.required(),
  }),
  defineField({
    name: 'filters',
    title: 'Approved filters',
    type: 'array',
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
  defineField({ name: 'pinnedItemIds', title: 'Pinned API item IDs', type: 'array', of: [{ type: 'string' }] }),
  defineField({ name: 'excludedItemIds', title: 'Excluded API item IDs', type: 'array', of: [{ type: 'string' }] }),
  defineField({ name: 'itemLimit', title: 'Maximum items', type: 'number', validation: (Rule) => Rule.integer().min(1).max(24) }),
  defineField({ name: 'sort', title: 'Approved sort key', type: 'string' }),
  defineField({
    name: 'fallbackBehavior',
    title: 'When the API returns too few items',
    type: 'string',
    options: {
      list: [
        { title: 'Hide the section', value: 'hide' },
        { title: 'Broaden the query', value: 'broaden' },
        { title: 'Use curated fallback IDs', value: 'curatedFallback' },
      ],
    },
  }),
];

export const siteNavbarSection = defineType({
  name: 'siteNavbarSection',
  title: 'Navbar',
  type: 'object',
  description: 'Structural page slot. Navbar content is managed in Shared Content for this tenant.',
  fields: [visibleField(), slotField()],
  preview: {
    select: { visible: 'visible' },
    prepare: ({ visible }) => ({
      title: `${visible === false ? '○ ' : ''}Navbar`,
      subtitle: 'Uses tenant Shared Content',
    }),
  },
});

export const siteFooterSection = defineType({
  name: 'siteFooterSection',
  title: 'Footer',
  type: 'object',
  description: 'Structural page slot. Footer content is managed in Shared Content for this tenant.',
  fields: [visibleField(), slotField()],
  preview: {
    select: { visible: 'visible' },
    prepare: ({ visible }) => ({
      title: `${visible === false ? '○ ' : ''}Footer`,
      subtitle: 'Uses tenant Shared Content',
    }),
  },
});

export const linkTilesSection = defineType({
  name: 'linkTilesSection',
  title: 'Link tiles',
  type: 'object',
  description: 'An editorial tile row. Every tile links directly to an internal route or an external URL; no API identifier is required.',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'tiles',
      title: 'Tiles',
      type: 'array',
      validation: (Rule) => Rule.min(1).warning('Add at least one tile or the application fallback will be shown.'),
      of: [
        defineArrayMember({
          name: 'linkTileItem',
          title: 'Link tile',
          type: 'object',
          fields: [
            defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
            defineField({ name: 'label', title: 'Label', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({
              name: 'route',
              title: 'Destination route',
              type: 'string',
              description: 'Use an internal path beginning with / or a complete https URL.',
              validation: (Rule) =>
                Rule.required().custom((value) =>
                  !value || value.startsWith('/') || value.startsWith('https://')
                    ? true
                    : 'Use an internal path beginning with / or a complete https URL.',
                ),
            }),
            imageField('image', 'Tile image', 'Upload the image displayed behind this tile.'),
            defineField({
              name: 'openInNewWindow',
              title: 'Open in a new window',
              type: 'boolean',
              initialValue: false,
              description: 'Usually appropriate only for external destinations.',
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'route', media: 'image', visible: 'visible' },
            prepare: ({ title, subtitle, media, visible }) => ({
              title: `${visible === false ? '○ ' : ''}${title || 'Link tile'}`,
              subtitle,
              media,
            }),
          },
        }),
      ],
    }),
    analyticsField(),
  ],
  preview: {
    select: { title: 'heading', tiles: 'tiles', visible: 'visible' },
    prepare: ({ title, tiles, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${title || 'Link tiles'}`,
      subtitle: `${tiles?.length ?? 0} route-based tiles`,
    }),
  },
});

export const marketingHeroSearchSection = defineType({
  name: 'marketingHeroSearchSection',
  title: 'Marketing hero and search',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'body', title: 'Supporting copy', type: 'text', rows: 3 }),
    defineField({ name: 'locationLabel', title: 'Image location label', type: 'string' }),
    imageField('image', 'Hero image', 'Wide desktop image. Upload a replacement or use the tenant fallback.'),
    imageField('mobileImage', 'Mobile hero image', 'Optional portrait crop for smaller screens.'),
    defineField({
      name: 'enabledModalities',
      title: 'Search tabs',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: modalityOptions },
      validation: (Rule) => Rule.min(1),
    }),
    defineField({ name: 'defaultModality', title: 'Default search tab', type: 'string', options: { list: modalityOptions } }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'locationLabel', media: 'image', visible: 'visible' } },
});

export const editorialIntroSection = defineType({
  name: 'editorialIntroSection',
  title: 'Editorial introduction',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'accentText', title: 'Accent text', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 4 }),
    defineField({ name: 'iconKey', title: 'Approved icon key', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'accentText', visible: 'visible' } },
});

export const commerceShelfSection = defineType({
  name: 'commerceShelfSection',
  title: 'Commerce shelf',
  type: 'object',
  description: 'The CMS controls merchandising; the application/API supplies live products, availability, and pricing.',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Supporting copy', type: 'text', rows: 3 }),
    defineField({
      name: 'source',
      title: 'Product source',
      type: 'string',
      options: {
        list: [
          { title: 'Stays', value: 'hotels' },
          { title: 'VIP Experiences', value: 'vip' },
          { title: 'Tickets', value: 'ticketing' },
          { title: 'Deals', value: 'deals' },
          { title: 'Sweepstakes', value: 'sweepstakes' },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    ...merchandisingFields,
    ...ctaFields,
    defineField({ name: 'variant', title: 'Approved component variant', type: 'string' }),
    analyticsField(),
  ],
  preview: {
    select: { title: 'heading', source: 'source', mode: 'selectionMode', visible: 'visible' },
    prepare: ({ title, source, mode, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${title || 'Commerce shelf'}`,
      subtitle: [source, mode].filter(Boolean).join(' · '),
    }),
  },
});

export const dealGridSection = defineType({
  name: 'dealGridSection',
  title: 'Deal grid',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'accentText', title: 'Accent text', type: 'string' }),
    ...merchandisingFields,
    defineField({ name: 'ctaLabel', title: 'Card action label', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'accentText', visible: 'visible' } },
});

export const valuePropositionGridSection = defineType({
  name: 'valuePropositionGridSection',
  title: 'Value proposition grid',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'accentText', title: 'Accent text', type: 'string' }),
    defineField({ name: 'body', title: 'Supporting copy', type: 'text', rows: 3 }),
    imageField('backgroundImage', 'Background image', 'Optional section background.'),
    defineField({
      name: 'items',
      title: 'Value propositions',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'valuePropositionItem',
          title: 'Value proposition',
          type: 'object',
          fields: [
            defineField({ name: 'title', title: 'Title', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
            defineField({ name: 'iconKey', title: 'Approved icon key', type: 'string' }),
            imageField('image', 'Image', 'Optional image when the component variant supports imagery.'),
          ],
          preview: { select: { title: 'title', subtitle: 'body', media: 'image' } },
        }),
      ],
    }),
    defineField({ name: 'variant', title: 'Approved component variant', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'accentText', media: 'backgroundImage', visible: 'visible' } },
});

export const promoBannerSection = defineType({
  name: 'promoBannerSection',
  title: 'Promotion banner',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    imageField('image', 'Banner image'),
    imageField('mobileImage', 'Mobile banner image'),
    ...ctaFields,
    defineField({ name: 'actionKey', title: 'Approved action key', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'eyebrow', media: 'image', visible: 'visible' } },
});

export const faqSection = defineType({
  name: 'faqSection',
  title: 'FAQ section',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({
      name: 'items',
      title: 'Questions',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'faqSectionItem',
          title: 'Question',
          type: 'object',
          fields: [
            defineField({ name: 'question', title: 'Question', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'answer', title: 'Answer', type: 'array', of: [{ type: 'block' }], validation: (Rule) => Rule.required() }),
          ],
          preview: { select: { title: 'question' } },
        }),
      ],
    }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', visible: 'visible' } },
});

export const mediaSplitSection = defineType({
  name: 'mediaSplitSection',
  title: 'Media and copy',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'array', of: [{ type: 'block' }] }),
    imageField('image', 'Image'),
    ...ctaFields,
    defineField({
      name: 'variant',
      title: 'Layout',
      type: 'string',
      options: { list: [{ title: 'Media left', value: 'mediaLeft' }, { title: 'Media right', value: 'mediaRight' }] },
    }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'eyebrow', media: 'image', visible: 'visible' } },
});

export const ctaBannerSection = defineType({
  name: 'ctaBannerSection',
  title: 'Call to action banner',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
    imageField('backgroundImage', 'Background image'),
    ...ctaFields,
    defineField({ name: 'actionKey', title: 'Approved action key', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', media: 'backgroundImage', visible: 'visible' } },
});

export const ticketHeroSearchSection = defineType({
  name: 'ticketHeroSearchSection',
  title: 'Tickets hero and search',
  type: 'object',
  description: 'CMS imagery overrides the Ticketing promotion API; empty fields keep the live promotion fallback.',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading override', type: 'string' }),
    defineField({ name: 'subheading', title: 'Subheading override', type: 'text', rows: 3 }),
    imageField('image', 'Hero image override'),
    imageField('mobileImage', 'Mobile hero image override'),
    defineField({ name: 'searchPlaceholder', title: 'Event search hint', type: 'string' }),
    defineField({ name: 'locationPlaceholder', title: 'Location search hint', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'subheading', media: 'image', visible: 'visible' }, prepare: ({ title, subtitle, media, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'Tickets hero and search'}`, subtitle, media }) },
});

export const ticketDiscoveryControlsSection = defineType({
  name: 'ticketDiscoveryControlsSection',
  title: 'Ticket discovery controls',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({
      name: 'heading',
      title: 'Location-aware heading prefix (legacy)',
      type: 'string',
      hidden: true,
      deprecated: { reason: 'The location-aware heading is now its own fixed structural section.' },
    }),
    defineField({
      name: 'quickDateLabels',
      title: 'Quick-date labels',
      type: 'object',
      fields: [
        defineField({ name: 'tomorrow', title: 'Tomorrow', type: 'string' }),
        defineField({ name: 'thisWeekend', title: 'This weekend', type: 'string' }),
        defineField({ name: 'nextWeekend', title: 'Next weekend', type: 'string' }),
        defineField({ name: 'otherDates', title: 'Other dates', type: 'string' }),
      ],
    }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', visible: 'visible' }, prepare: ({ title, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'Ticket discovery controls'}` }) },
});

export const ticketPopularNearHeadingSection = defineType({
  name: 'ticketPopularNearHeadingSection',
  title: 'Popular near heading',
  type: 'object',
  description: 'Structural marker for the application-owned, location-aware “Popular near…” heading. It has no editorial controls.',
  fields: [slotField()],
  preview: {
    prepare: () => ({
      title: 'Popular near heading',
      subtitle: 'Location-aware · no controls',
    }),
  },
});

export const ticketCollectionGroupSection = defineType({
  name: 'ticketCollectionGroupSection',
  title: 'Ticket collection group',
  type: 'object',
  description: 'Configures API-backed event shelves. Events and prices remain in Ticketing.',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Section heading', type: 'string' }),
    defineField({
      name: 'collections',
      title: 'Event collections',
      type: 'array',
      of: [defineArrayMember({ type: 'ticketCollection' })],
    }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', collections: 'collections', visible: 'visible' }, prepare: ({ title, collections, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'Ticket collections'}`, subtitle: `${collections?.length ?? 0} configured collections` }) },
});

export const ticketPopularCitiesSection = defineType({
  name: 'ticketPopularCitiesSection',
  title: 'Popular ticket cities (legacy)',
  type: 'object',
  deprecated: { reason: 'Use Link tiles with direct routes and uploaded images.' },
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'pinnedCityIds', title: 'Pinned city API IDs', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'itemLimit', title: 'Maximum cities', type: 'number', validation: (Rule) => Rule.integer().min(1).max(24) }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', visible: 'visible' } },
});

export const vipHeroSearchSection = defineType({
  name: 'vipHeroSearchSection',
  title: 'VIP hero and search',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'subheading', title: 'Subheading', type: 'text', rows: 3 }),
    imageField('image', 'Hero image'),
    imageField('mobileImage', 'Mobile hero image'),
    defineField({ name: 'searchPlaceholder', title: 'Search hint', type: 'string' }),
    defineField({ name: 'searchLabel', title: 'Search button label', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'eyebrow', media: 'image', visible: 'visible' } },
});

export const vipSecondaryNavigationSection = defineType({
  name: 'vipSecondaryNavigationSection',
  title: 'VIP secondary navigation',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'links', title: 'Navigation links', type: 'array', of: [defineArrayMember({ type: 'editorialLink' })] }),
    analyticsField(),
  ],
  preview: { select: { links: 'links', visible: 'visible' }, prepare: ({ links, visible }) => ({ title: `${visible === false ? '○ ' : ''}VIP secondary navigation`, subtitle: `${links?.length ?? 0} links` }) },
});

export const vipExperienceCollectionSection = defineType({
  name: 'vipExperienceCollectionSection',
  title: 'VIP experience shelf',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'sourceType',
      title: 'Experience source',
      type: 'string',
      options: { list: [{ title: 'Tag', value: 'tag' }, { title: 'Category', value: 'category' }, { title: 'Sweepstakes', value: 'sweepstakes' }], layout: 'radio' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'sourceKey', title: 'API tag or category key', type: 'string', hidden: ({ parent }) => parent?.sourceType === 'sweepstakes' }),
    defineField({ name: 'pinnedItemIds', title: 'Pinned experience IDs', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'excludedItemIds', title: 'Excluded experience IDs', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'itemLimit', title: 'Maximum items', type: 'number', validation: (Rule) => Rule.integer().min(1).max(24) }),
    defineField({ name: 'viewAllLabel', title: 'View-all label', type: 'string' }),
    defineField({ name: 'viewAllUrl', title: 'View-all destination', type: 'string' }),
    defineField({ name: 'variant', title: 'Approved component variant', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', sourceType: 'sourceType', sourceKey: 'sourceKey', visible: 'visible' }, prepare: ({ title, sourceType, sourceKey, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'Experience shelf'}`, subtitle: [sourceType, sourceKey].filter(Boolean).join(' · ') }) },
});

export const vipCategoryGridSection = defineType({
  name: 'vipCategoryGridSection',
  title: 'VIP category grid',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'tiles', title: 'Category tiles', type: 'array', of: [defineArrayMember({ type: 'discoveryTile' })] }),
    defineField({ name: 'variant', title: 'Approved component variant', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', tiles: 'tiles', visible: 'visible' }, prepare: ({ title, tiles, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'VIP categories'}`, subtitle: `${tiles?.length ?? 0} tiles` }) },
});

export const hotelHeroSearchSection = defineType({
  name: 'hotelHeroSearchSection',
  title: 'Stays hero and search',
  type: 'object',
  description: 'The application owns authentication, search state, and API options. Sanity controls the approved editorial presentation.',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'eyebrow', title: 'Eyebrow', type: 'string' }),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'subheading', title: 'Subheading', type: 'text', rows: 3 }),
    imageField('image', 'Hero image'),
    imageField('mobileImage', 'Mobile hero image'),
    defineField({
      name: 'enabledSearchModes',
      title: 'Enabled search tabs',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: [{ title: 'Hotels', value: 'hotels' }, { title: 'Flights', value: 'flights' }, { title: 'Events', value: 'events' }] },
    }),
    defineField({ name: 'defaultSearchMode', title: 'Default search tab', type: 'string', options: { list: [{ title: 'Hotels', value: 'hotels' }, { title: 'Flights', value: 'flights' }, { title: 'Events', value: 'events' }] } }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', subtitle: 'eyebrow', media: 'image', visible: 'visible' }, prepare: ({ title, subtitle, media, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'Stays hero and search'}`, subtitle, media }) },
});

export const appDownloadPromoSection = defineType({
  name: 'appDownloadPromoSection',
  title: 'App download promotion',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 4 }),
    imageField('image', 'Desktop device image'),
    imageField('mobileImage', 'Mobile app image'),
    defineField({ name: 'ctaLabel', title: 'Mobile action label', type: 'string' }),
    defineField({ name: 'iosLabel', title: 'iOS action label', type: 'string' }),
    defineField({ name: 'iosUrl', title: 'iOS App Store URL', type: 'url' }),
    defineField({ name: 'androidLabel', title: 'Android action label', type: 'string' }),
    defineField({ name: 'androidUrl', title: 'Google Play URL', type: 'url' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', media: 'image', visible: 'visible' }, prepare: ({ title, media, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'App download promotion'}`, media }) },
});

export const brandLogoStripSection = defineType({
  name: 'brandLogoStripSection',
  title: 'Brand logo strip',
  type: 'object',
  fields: [
    visibleField(),
    slotField(),
    defineField({ name: 'heading', title: 'Heading', type: 'string' }),
    defineField({ name: 'subheading', title: 'Subheading', type: 'text', rows: 2 }),
    defineField({
      name: 'logos',
      title: 'Logos',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'brandLogoItem',
          title: 'Logo',
          type: 'object',
          fields: [
            imageField('image', 'Logo'),
            defineField({ name: 'label', title: 'Accessible label', type: 'string' }),
            defineField({ name: 'url', title: 'Optional destination', type: 'url' }),
          ],
          preview: { select: { title: 'label', media: 'image' } },
        }),
      ],
    }),
    defineField({ name: 'variant', title: 'Approved component variant', type: 'string' }),
    analyticsField(),
  ],
  preview: { select: { title: 'heading', logos: 'logos', visible: 'visible' }, prepare: ({ title, logos, visible }) => ({ title: `${visible === false ? '○ ' : ''}${title || 'Brand logo strip'}`, subtitle: `${logos?.length ?? 0} uploaded logos` }) },
});

export const pageSectionTypes = [
  siteNavbarSection,
  siteFooterSection,
  linkTilesSection,
  marketingHeroSearchSection,
  editorialIntroSection,
  commerceShelfSection,
  dealGridSection,
  valuePropositionGridSection,
  promoBannerSection,
  faqSection,
  mediaSplitSection,
  ctaBannerSection,
  ticketHeroSearchSection,
  ticketPopularNearHeadingSection,
  ticketDiscoveryControlsSection,
  ticketCollectionGroupSection,
  ticketPopularCitiesSection,
  vipHeroSearchSection,
  vipSecondaryNavigationSection,
  vipExperienceCollectionSection,
  vipCategoryGridSection,
  hotelHeroSearchSection,
  appDownloadPromoSection,
  brandLogoStripSection,
];

export const PAGE_SECTION_TYPE_NAMES = pageSectionTypes.map((section) => section.name);

