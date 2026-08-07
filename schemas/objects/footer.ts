/**
 * Footer — replaces the five `Footer.<tenant>.tsx` files in
 * apps/live-tickets/src/components/Footer/.
 *
 * Those files duplicate the same Seller-of-Travel paragraph verbatim four
 * times. Modelling it once as a universal default with tenant overrides is the
 * single clearest win in the whole migration: legal copy changes in one place.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

export const footerLink = defineType({
  name: 'footerLink',
  title: 'Footer link',
  type: 'object',
  fields: [
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({ name: 'label', title: 'Label', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'string',
      description: 'Absolute URL, a path beginning with "/", or a {placeholder} for an environment base URL.',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { label: 'label', url: 'url', visible: 'visible' },
    prepare: ({ label, url, visible }) => ({ title: `${visible === false ? '○ ' : ''}${label ?? ''}`, subtitle: url }),
  },
});

export const footerConfig = defineType({
  name: 'footerConfig',
  title: 'Footer',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'supportPhone',
      title: 'Support phone',
      type: 'object',
      fields: [
        defineField({ name: 'visible', title: 'Show support phone', type: 'boolean', initialValue: true }),
        defineField({
          name: 'value',
          title: 'Phone number',
          type: 'string',
          description: `In display format, e.g. "+1 888-805-2295". ${INHERITS}`,
        }),
      ],
    }),
    defineField({
      name: 'supportEmail',
      title: 'Support email',
      type: 'object',
      fields: [
        defineField({ name: 'visible', title: 'Show support email', type: 'boolean', initialValue: false }),
        defineField({
          name: 'value',
          title: 'Email address',
          type: 'string',
          description: INHERITS,
          validation: (Rule) => Rule.email().error('Enter a valid email address.'),
        }),
      ],
    }),
    defineField({
      name: 'productLinks',
      title: 'Product links',
      type: 'array',
      description: `The main footer link columns. ${INHERITS}`,
      of: [defineArrayMember({ type: 'footerLink' })],
    }),
    defineField({
      name: 'legalLinks',
      title: 'Legal links',
      type: 'array',
      description: `Privacy Notice, Accessibility Policy, Terms of Use, FAQs. ${INHERITS}`,
      of: [defineArrayMember({ type: 'footerLink' })],
    }),
    defineField({
      name: 'sellerOfTravelCopy',
      title: 'Seller of Travel disclosure',
      type: 'text',
      rows: 4,
      description:
        'The registration disclosure (Florida ST43055, Washington UBI, Hawaii, California). Currently duplicated ' +
        `across four tenant footers — set it once on the universal default. ${INHERITS}`,
    }),
    defineField({
      name: 'trademarkCopy',
      title: 'Copyright line',
      type: 'string',
      description: `e.g. "© 2026 Open Network Exchange Inc. All rights reserved." ${INHERITS}`,
    }),
    defineField({
      name: 'showDoNotSellLink',
      title: 'Show "Do Not Sell or Share My Personal Information"',
      type: 'boolean',
      description: `Required in some jurisdictions. ${INHERITS}`,
    }),
    defineField({
      name: 'poweredBy',
      title: 'Powered-by badge',
      type: 'string',
      description: `Which attribution badge to display. ${INHERITS}`,
      options: {
        list: [
          { title: 'None', value: 'none' },
          { title: 'Powered by Bookit', value: 'bookit' },
          { title: 'Powered by SPREE', value: 'spree' },
        ],
        layout: 'radio',
      },
    }),
  ],
});
