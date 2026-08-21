/**
 * Payment method visibility, onboarding, and points top-up presentation.
 *
 * Boundary note, because this is the area where the PDP's "managed outside
 * Sanity" list matters most: everything here controls what a user SEES, never
 * what they are charged or what they are entitled to.
 *
 *   Here            — whether the crypto tab is offered, top-up tile labels,
 *                     which onboarding fields are asked for.
 *   Not here        — Stripe keys, points conversion ratios, chain/token
 *                     addresses, tier eligibility. Those already come from the
 *                     SpreePay tenant config API
 *                     (packages/spree-pay/src/hooks/useSpreePayConfig.ts) and
 *                     must stay there.
 *
 * A top-up tile's price is presentation (the label on the button); the amount
 * actually charged is settled server-side at purchase. They are stored here as
 * display strings for exactly that reason — so nobody mistakes them for the
 * authoritative figure.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

export const paymentConfig = defineType({
  name: 'paymentConfig',
  title: 'Payment methods',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  description: 'Which payment options are offered. Keys, ratios and chain configuration stay in the SpreePay config API.',
  fields: [
    defineField({
      name: 'allowPointsSpending',
      title: 'Allow spending points',
      type: 'boolean',
      description: INHERITS,
    }),
    defineField({ name: 'creditCard', title: 'Credit card', type: 'boolean', description: INHERITS }),
    defineField({ name: 'crypto', title: 'Crypto wallet', type: 'boolean', description: INHERITS }),
    defineField({ name: 'cryptoCom', title: 'Crypto.com Pay', type: 'boolean', description: INHERITS }),
  ],
});

export const topUpTile = defineType({
  name: 'topUpTile',
  title: 'Top-up tile',
  type: 'object',
  fields: [
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({
      name: 'pointsLabel',
      title: 'Points label',
      type: 'string',
      description: 'As displayed, e.g. "2,500".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'priceLabel',
      title: 'Price label',
      type: 'string',
      description:
        'As displayed, e.g. "$25.00". This is the label only — the amount charged is determined server-side.',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { points: 'pointsLabel', price: 'priceLabel', visible: 'visible' },
    prepare: ({ points, price, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${points ?? ''} pts`,
      subtitle: price,
    }),
  },
});

export const topUpConfig = defineType({
  name: 'topUpConfig',
  title: 'Points top-up',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'enabled',
      title: 'Enable points top-up',
      type: 'boolean',
      description: `Controls whether the points top-up surface is offered for this tenant. ${INHERITS}`,
    }),
    defineField({
      name: 'tiles',
      title: 'Top-up tiles',
      type: 'array',
      description: `The preset amounts offered. ${INHERITS}`,
      of: [defineArrayMember({ type: 'topUpTile' })],
      validation: (Rule) => Rule.max(6).warning('More than six tiles will wrap awkwardly on mobile.'),
      hidden: ({ parent }) => parent?.enabled === false,
    }),
  ],
});

export const onboardingSlide = defineType({
  name: 'onboardingSlide',
  title: 'Onboarding slide',
  type: 'object',
  fields: [
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({ name: 'headline', title: 'Headline', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({ name: 'body', title: 'Body', type: 'text', rows: 3 }),
  ],
  preview: {
    select: { title: 'headline', subtitle: 'body', visible: 'visible' },
    prepare: ({ title, subtitle, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${title ?? ''}`,
      subtitle,
    }),
  },
});

export const onboardingConfig = defineType({
  name: 'onboardingConfig',
  title: 'Login & onboarding',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'slides',
      title: 'Onboarding slides',
      type: 'array',
      description: `The carousel shown before sign-up. The current Figma template defines four slides. ${INHERITS}`,
      of: [defineArrayMember({ type: 'onboardingSlide' })],
      validation: (Rule) => Rule.max(4).warning('The current onboarding surface supports four slides.'),
    }),
    defineField({ name: 'loginHeading', title: 'Login heading', type: 'string', description: INHERITS }),
    defineField({ name: 'loginSubheading', title: 'Login subheading', type: 'text', rows: 2, description: INHERITS }),
    defineField({
      name: 'emailStepHeading',
      title: 'Email step heading',
      type: 'string',
      description: INHERITS,
    }),
    defineField({ name: 'emailStepSubheading', title: 'Email step subheading', type: 'text', rows: 2, description: INHERITS }),
    defineField({ name: 'verifyStepHeading', title: 'Verification step heading', type: 'string', description: INHERITS }),
    defineField({
      name: 'verifyStepSubheading',
      title: 'Verification step subheading',
      type: 'text',
      rows: 2,
      description: `Use {email} to insert the address the code was sent to. ${INHERITS}`,
    }),
    defineField({ name: 'profileStepHeading', title: 'Profile step heading', type: 'string', description: INHERITS }),
    defineField({ name: 'profileStepSubheading', title: 'Profile step subheading', type: 'text', rows: 2, description: INHERITS }),
    defineField({
      name: 'collectedFields',
      title: 'Fields collected at sign-up',
      type: 'array',
      description:
        'Which details the profile step asks for. Removing a field here stops it being asked for; it does not ' +
        `delete anything already stored. ${INHERITS}`,
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'First name', value: 'firstName' },
          { title: 'Surname', value: 'surname' },
          { title: 'Email', value: 'email' },
          { title: 'Phone number', value: 'phone' },
          { title: 'Date of birth', value: 'dateOfBirth' },
          { title: 'Country', value: 'country' },
          { title: 'Marketing opt-in', value: 'marketingOptIn' },
          { title: 'Terms opt-in', value: 'termsOptIn' },
        ],
      },
    }),
  ],
});
