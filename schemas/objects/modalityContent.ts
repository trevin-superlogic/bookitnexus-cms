/** Explicit modality controls represented in the Figma tenant-config collection. */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

export const vipContentConfig = defineType({
  name: 'vipContentConfig',
  title: 'VIP content controls',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: 'homepage',
      title: 'Homepage',
      type: 'object',
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: 'heading', title: 'Headline', type: 'string', description: INHERITS }),
        defineField({ name: 'subheading', title: 'Subheading', type: 'text', rows: 3, description: INHERITS }),
        defineField({
          name: 'carouselHeadings',
          title: 'Carousel headings',
          type: 'array',
          description:
            `Ordered headings for the homepage carousels. The current Figma template defines four. ${INHERITS}`,
          of: [defineArrayMember({ type: 'string' })],
          validation: (Rule) => Rule.max(4).warning('The current VIP homepage supports four carousel headings.'),
        }),
      ],
    }),
    defineField({
      name: 'searchPlaceholder',
      title: 'Search hint',
      type: 'string',
      description: `Placeholder shown in VIP search, e.g. "Search experiences". ${INHERITS}`,
    }),
    defineField({
      name: 'sweepstakes',
      title: 'Sweepstakes',
      type: 'object',
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: 'heading', title: 'Heading', type: 'string', description: INHERITS }),
        defineField({ name: 'subheading', title: 'Subheading', type: 'string', description: INHERITS }),
        defineField({
          name: 'rulesText',
          title: 'Rules and marketing consent text',
          type: 'text',
          rows: 6,
          description: INHERITS,
        }),
      ],
    }),
  ],
});

export const ticketingContentConfig = defineType({
  name: 'ticketingContentConfig',
  title: 'Ticketing content controls',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: 'homepage',
      title: 'Homepage',
      type: 'object',
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({ name: 'heading', title: 'Heading', type: 'string', description: INHERITS }),
        defineField({ name: 'subheading', title: 'Subheading', type: 'text', rows: 3, description: INHERITS }),
      ],
    }),
  ],
});
