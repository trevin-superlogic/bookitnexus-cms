/**
 * Rewards & pricing display — the "Tenant Level Controls" group from the
 * Figma tenant-config collection.
 *
 * These are presentation choices only. Per the PDP's configuration boundary,
 * conversion rates, margin share and eligibility stay in code/backend: they
 * decide what a customer is charged, and a CMS edit must never be able to
 * change that. Compare `getPointsName()` (moves here) with
 * `getPointsConversionRate()` and `TICKETING_FEE` in
 * apps/live-tickets/src/utils/points.ts (both stay put).
 */
import { defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

export const rewardsConfig = defineType({
  name: 'rewardsConfig',
  title: 'Rewards & pricing display',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: 'pointsName',
      title: 'Points name',
      type: 'string',
      description: `What this tenant calls its points — "CRO", "AIR SP", "Pulse Points". ${INHERITS}`,
    }),
    defineField({
      name: 'pricingDisplay',
      title: 'Pricing display',
      type: 'string',
      description: `How prices are shown on ticket and product listings. ${INHERITS}`,
      options: {
        list: [
          { title: 'Points only', value: 'points' },
          { title: 'Money only', value: 'money' },
          { title: 'Money or points', value: 'moneyOrPoints' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'vipPricingDisplay',
      title: 'VIP collection pricing display',
      type: 'string',
      description: `The "From …" price format used on VIP collection cards. ${INHERITS}`,
      options: {
        list: [
          { title: 'From <points>', value: 'points' },
          { title: 'From <money>', value: 'money' },
          { title: 'From <money> or <points>', value: 'moneyOrPoints' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'showPointsEarning',
      title: 'Show points earning',
      type: 'boolean',
      description:
        'Whether "Earn …" badges appear on listings and at checkout. Qiibee and Tria hide these today. ' +
        `${INHERITS}`,
    }),
    defineField({
      name: 'earningDisplay',
      title: 'Earning display',
      type: 'string',
      description:
        'Whether earnings are expressed in points ("Earn 500 AIR SP") or money ("Earn $12 in CRO"). ' +
        `Only applies when points earning is shown. ${INHERITS}`,
      options: {
        list: [
          { title: 'Earn points', value: 'points' },
          { title: 'Earn money', value: 'money' },
        ],
        layout: 'radio',
      },
      hidden: ({ parent }) => parent?.showPointsEarning === false,
    }),
    defineField({
      name: 'dollarsPlaceholder',
      title: 'Money placeholder',
      type: 'string',
      description: `Sample value used in design mocks and loading skeletons, e.g. "$15,093.75". ${INHERITS}`,
    }),
    defineField({
      name: 'pointsPlaceholder',
      title: 'Points placeholder',
      type: 'string',
      description: `Sample value used in design mocks and loading skeletons, e.g. "1,509.4k". ${INHERITS}`,
    }),
  ],
});
