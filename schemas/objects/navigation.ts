/**
 * Navigation — replaces the five hand-maintained `navItems.<tenant>.ts` files
 * in apps/live-tickets/src/components/Header/HeaderNav/navItems/.
 *
 * The Figma collection models this as fixed slots ("Nav Bar | Level 1 | Slot 3"
 * plus a matching "Show Slot 3"). That shape exists because Figma variables
 * cannot be lists — it is a workaround, not a requirement, and carrying it into
 * Sanity would cap navigation at seven items and leave gaps when slot 3 is
 * hidden. Here it is a proper ordered array; the importer maps slots onto it.
 *
 * Tier gating (`requiresTier`) mirrors `isLocked` / `lockedUrl` in the current
 * nav config. Which tiers are actually locked stays in
 * apps/live-tickets/src/config/lockedTiers.ts — that is entitlement logic, not
 * presentation.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

export const navItem = defineType({
  name: 'navItem',
  title: 'Navigation item',
  type: 'object',
  fields: [
    defineField({
      name: 'visible',
      title: 'Visible',
      type: 'boolean',
      description: 'Turn off to hide this item without deleting it. Emptying the label will not hide it.',
      initialValue: true,
    }),
    defineField({
      name: 'label',
      title: 'Label',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'string',
      description:
        'Use a path beginning with "/" for an internal destination, a full http(s) URL for an external ' +
        'destination, or {travelUrl}, {experiencesUrl} or {upgradeUrl} for a tenant base URL.',
      validation: (Rule) =>
        Rule.required().custom((value) =>
          !value || value.startsWith('/') || value.startsWith('http') || value.startsWith('{')
            ? true
            : 'Must start with "/", "http", or a {placeholder}.',
        ),
    }),
    defineField({
      name: 'iconSvg',
      title: 'Icon SVG',
      type: 'image',
      description: `Optional SVG displayed with this navigation item. ${INHERITS}`,
      options: { accept: '.svg', hotspot: false },
      fields: [
        defineField({
          name: 'alt',
          title: 'Accessible label',
          type: 'string',
          description: 'Describe the icon when it communicates meaning that is not already present in the link label.',
        }),
      ],
    }),
    defineField({
      name: 'requiresTier',
      title: 'Gated behind membership tier',
      type: 'boolean',
      description:
        'When on, members below the required tier are sent to the upgrade URL instead. Which tiers qualify is ' +
        'decided in code (config/lockedTiers.ts), not here.',
      initialValue: false,
    }),
    defineField({
      name: 'showCategoryTags',
      title: 'Show featured categories',
      type: 'boolean',
      description: 'Injects SLAPI-fetched featured categories as sub-items under this entry. Use on one item only.',
      initialValue: false,
    }),
    defineField({
      name: 'emphasis',
      title: 'Emphasis',
      type: 'string',
      description: 'Visual treatment. "Accent" applies the gradient style used for Sweepstakes today.',
      options: {
        list: [
          { title: 'Default', value: 'default' },
          { title: 'Accent', value: 'accent' },
        ],
        layout: 'radio',
      },
      initialValue: 'default',
    }),
  ],
  preview: {
    select: { label: 'label', url: 'url', visible: 'visible', gated: 'requiresTier', icon: 'iconSvg' },
    prepare: ({ label, url, visible, gated, icon }) => ({
      title: `${visible === false ? '○ ' : ''}${label ?? 'Untitled'}`,
      subtitle: [icon ? 'SVG icon' : null, url, gated ? 'tier-gated' : null].filter(Boolean).join(' · '),
    }),
  },
});

const navList = (name: string, title: string, description: string) =>
  defineField({
    name,
    title,
    type: 'array',
    description: `${description} ${INHERITS} Setting any items replaces the whole list — inheritance is per-list, not per-item.`,
    of: [defineArrayMember({ type: 'navItem' })],
  });

export const navigationConfig = defineType({
  name: 'navigationConfig',
  title: 'Navigation',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'featured',
      title: 'Featured item',
      type: 'navItem',
      description: `Highlighted entry shown ahead of the main list — Sweepstakes for Moca and UM Pulse. ${INHERITS}`,
    }),
    navList('primary', 'Primary navigation', 'The top-level product bar: Stays, Flights, Tickets and so on.'),
    navList('vipSubNav', 'VIP sub-navigation', 'Second-level items shown under the VIP product.'),
    navList('ticketingSubNav', 'Ticketing sub-navigation', 'Second-level items shown under Tickets — Concerts, Sports, Theatre.'),
    navList('accountNav', 'Account navigation', 'Items in the account/mobile menu.'),
  ],
});
