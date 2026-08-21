/**
 * Site chrome — navigation, footer, metadata and the SpreePay widget.
 *
 * These sit on Shared content rather than Tenant Configuration because they are
 * content a tenant edits, not switches that describe what a tenant *is*. The
 * split matters for who opens which screen: marketing edits the nav labels and
 * the footer; whoever provisions a tenant sets product availability and URLs.
 *
 * Everything here is empty by default. An empty field inherits from the
 * universal default, so a tenant document carries only its differences — the
 * same rule as every other scoped section (see lib/resolve/inheritance.ts).
 *
 * Two navbars exist on purpose. The legacy bar is the one the Figma "Tenant
 * Config" collection describes: seven level-1 slots plus a featured slot, and
 * two second-level rows. Nexus and Legacy render differently, but they use one
 * shared navigation configuration so switching renderers never duplicates or
 * drops labels, destinations, or icons. The older nested model definitions are
 * retained read-only for compatibility with existing documents.
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

/** A link target: absolute, root-relative, or an environment placeholder. */
const urlField = (name = 'url', title = 'URL', extra = '') =>
  defineField({
    name,
    title,
    type: 'string',
    description:
      `Absolute URL, a path beginning with "/", or {travelUrl} / {experiencesUrl} / {upgradeUrl} to use the ` +
      `environment-configured base rather than hardcoding a domain. ${extra} ${INHERITS}`.trim(),
    validation: (Rule) =>
      Rule.custom((value) =>
        !value || value.startsWith('/') || value.startsWith('http') || value.startsWith('{')
          ? true
          : 'Must start with "/", "http", or a {placeholder}.',
      ),
  });

/** An uploaded mark, with the link it points at. SVG first — see brandAssets. */
const logoField = (name: string, title: string, description: string) =>
  defineField({
    name,
    title,
    type: 'image',
    description: `${description} SVG preferred: logos are recoloured through CSS custom properties, which only ` +
      `works on inline SVG. A raster upload renders but will not follow the theme. ${INHERITS}`,
    options: { accept: '.svg,.png,.webp', hotspot: false },
    fields: [
      defineField({
        name: 'alt',
        title: 'Alt text',
        type: 'string',
        validation: (Rule) => Rule.required().warning('Needed for screen readers.'),
      }),
      urlField('href', 'Link target', 'Where clicking the logo goes; defaults to "/" when empty.'),
    ],
  });

// ── Nexus navbar ─────────────────────────────────────────────────────────────

/**
 * A destination in the simplified bar: label, link, and an icon drawn from the
 * app's icon set. The icon is a name rather than an upload because these are
 * lucide glyphs that inherit the nav item colour tokens; an uploaded image
 * would not recolour with the theme.
 */
export const navSlot = defineType({
  name: 'navSlot',
  title: 'Navigation slot',
  type: 'object',
  fields: [
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({ name: 'label', title: 'Label', type: 'string', validation: (Rule) => Rule.required() }),
    urlField(),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Name from the app icon set, e.g. "sparkles", "bed", "ticket". Leave empty for a label-only slot.',
      options: {
        list: [
          { title: 'Sparkles — Experiences', value: 'sparkles' },
          { title: 'Bed — Stays', value: 'bed' },
          { title: 'Ticket — Tickets', value: 'ticket' },
          { title: 'Plane — Flights', value: 'plane' },
          { title: 'Ship — Cruises', value: 'ship' },
          { title: 'Car — Cars', value: 'car' },
          { title: 'Bag — Shopping', value: 'bag' },
          { title: 'Gift — Sweepstakes', value: 'gift' },
          { title: 'None', value: '' },
        ],
      },
    }),
    defineField({
      name: 'emphasis',
      title: 'Emphasis',
      type: 'string',
      description: 'Accent applies the highlighted treatment used for Sweepstakes.',
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
    select: { label: 'label', url: 'url', icon: 'icon', visible: 'visible' },
    prepare: ({ label, url, icon, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${label ?? 'Untitled'}`,
      subtitle: [icon, url].filter(Boolean).join(' · '),
    }),
  },
});

/** What an anonymous visitor sees where the account control would be. */
export const authControls = defineType({
  name: 'authControls',
  title: 'Signed-out state',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: 'showSignIn',
      title: 'Show sign-in call to action',
      type: 'boolean',
      description: `Off hides the control entirely — for tenants with no logged-in experience. ${INHERITS}`,
      initialValue: true,
    }),
    defineField({ name: 'signInLabel', title: 'Sign-in label', type: 'string', description: `e.g. "Sign Up". ${INHERITS}` }),
    urlField('signInUrl', 'Sign-in URL'),
    defineField({
      name: 'signedInLabel',
      title: 'Signed-in label',
      type: 'string',
      description: `Shown on the account control once a member is signed in. ${INHERITS}`,
    }),
    urlField('accountUrl', 'Account URL'),
  ],
});

export const nexusNavbar = defineType({
  name: 'nexusNavbar',
  title: 'Bookit Nexus navbar',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  description: 'Legacy nested Nexus data retained until existing documents are migrated to the shared Navbar fields.',
  fields: [
    logoField('primaryLogo', 'Primary logo', 'Shown at the left of the bar.'),
    defineField({
      name: 'slots',
      title: 'Destinations',
      type: 'array',
      description: `The top-level items. Order here is the order on screen. ${INHERITS} Setting any item replaces ` +
        'the whole list — inheritance is per-list, not per-item.',
      of: [defineArrayMember({ type: 'navSlot' })],
    }),
    defineField({ name: 'auth', title: 'Account control', type: 'authControls' }),
  ],
});

// ── Legacy navbar ────────────────────────────────────────────────────────────

export const legacyNavbar = defineType({
  name: 'legacyNavbar',
  title: 'Legacy navbar',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  description:
    'The current multi-level bar — a featured slot, seven level-1 destinations, and second-level rows for VIP ' +
    'and Ticketing. Modelled as ordered lists rather than fixed numbered slots: the Figma collection uses ' +
    '"Slot 3" + "Show Slot 3" only because Figma variables cannot hold lists.',
  fields: [
    logoField('primaryLogo', 'Primary logo', 'Shown at the left of the bar.'),
    defineField({ name: 'navigation', title: 'Navigation lists', type: 'navigationConfig' }),
    defineField({ name: 'auth', title: 'Account control', type: 'authControls' }),
  ],
});

export const navbarConfig = defineType({
  name: 'navbarConfig',
  title: 'Navbar',
  type: 'object',
  fields: [
    defineField({
      name: 'variant',
      title: 'Navigation model',
      type: 'string',
      description:
        `Choose which navbar renderer the tenant uses. The navigation content below is shared by both. ${INHERITS}`,
      options: {
        list: [
          { title: 'Bookit Nexus', value: 'nexus' },
          { title: 'Legacy', value: 'legacy' },
        ],
        layout: 'radio',
      },
    }),
    logoField('primaryLogo', 'Primary logo', 'Shown at the left of either navbar.'),
    defineField({
      name: 'navigation',
      title: 'Navigation',
      type: 'navigationConfig',
      description: 'Shared labels, destinations, SVG icons, visibility, and behavior for both navbar renderers.',
    }),
    defineField({ name: 'auth', title: 'Account control', type: 'authControls' }),
    defineField({
      name: 'nexus',
      title: 'Bookit Nexus configuration (legacy data)',
      type: 'nexusNavbar',
      readOnly: true,
      hidden: ({ value }) => value === undefined,
      deprecated: { reason: 'Use the shared Navbar fields above. Existing data remains readable until migrated.' },
    }),
    defineField({
      name: 'legacy',
      title: 'Legacy configuration (legacy data)',
      type: 'legacyNavbar',
      readOnly: true,
      hidden: ({ value }) => value === undefined,
      deprecated: { reason: 'Use the shared Navbar fields above. Existing data remains readable until migrated.' },
    }),
  ],
});

// ── Footer ───────────────────────────────────────────────────────────────────

/** A titled column of links, as the footer renders them in rows. */
export const footerLinkGroup = defineType({
  name: 'footerLinkGroup',
  title: 'Link group',
  type: 'object',
  fields: [
    defineField({ name: 'visible', title: 'Visible', type: 'boolean', initialValue: true }),
    defineField({
      name: 'title',
      title: 'Group heading',
      type: 'string',
      description: 'Optional. Leave empty for an untitled row of links.',
    }),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [defineArrayMember({ type: 'footerLink' })],
    }),
  ],
  preview: {
    select: { title: 'title', links: 'links', visible: 'visible' },
    prepare: ({ title, links, visible }) => ({
      title: `${visible === false ? '○ ' : ''}${title || 'Untitled group'}`,
      subtitle: `${(links ?? []).length} link(s)`,
    }),
  },
});

export const footerChrome = defineType({
  name: 'footerChrome',
  title: 'Footer',
  type: 'object',
  fields: [
    logoField('footerLogo', 'Footer logo', 'The brand mark in the footer.'),
    defineField({
      name: 'linkGroups',
      title: 'Link groups',
      type: 'array',
      description: `Rows of footer links. ${INHERITS} Setting any group replaces the whole list.`,
      of: [defineArrayMember({ type: 'footerLinkGroup' })],
    }),
    defineField({
      name: 'coBranding',
      title: 'Bookit co-branding',
      type: 'object',
      description: 'Adds the "powered by" lockup beneath the footer logo.',
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({
          name: 'enabled',
          title: 'Show co-branding',
          type: 'boolean',
          description: `Off for tenants who present the product as wholly their own. ${INHERITS}`,
          initialValue: false,
        }),
        logoField('logo', 'Co-branding lockup', 'The "powered by" mark. Usually supplied by the universal default.'),
      ],
    }),
    defineField({ name: 'support', title: 'Support contacts', type: 'footerConfig' }),
  ],
});

// ── Metadata ─────────────────────────────────────────────────────────────────

/**
 * Head metadata, defined once and reusable per page.
 *
 * The same object is attached to Shared content and to each page, so a page can
 * override the title or social image while inheriting the favicon. Anything
 * left empty falls through: page → tenant shared → universal default.
 */
export const siteMetadata = defineType({
  name: 'siteMetadata',
  title: 'Metadata',
  type: 'object',
  options: { collapsible: true, collapsed: false },
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: `Page title. At tenant level this is the fallback for pages that do not set one. ${INHERITS}`,
      validation: (Rule) => Rule.max(70).warning('Titles beyond ~70 characters get truncated in search results.'),
    }),
    defineField({
      name: 'titleTemplate',
      title: 'Title template',
      type: 'string',
      description: `How page titles compose, e.g. "%s | AIR Shop". Use %s for the page title. Tenant level only. ${INHERITS}`,
    }),
    defineField({
      name: 'description',
      title: 'Meta description',
      type: 'text',
      rows: 3,
      description: INHERITS,
      validation: (Rule) => Rule.max(160).warning('Descriptions beyond ~160 characters get truncated.'),
    }),
    defineField({
      name: 'favicon',
      title: 'Favicon',
      type: 'image',
      description: `SVG or a 512px square PNG. Overridable per page, though rarely worth doing. ${INHERITS}`,
      options: { accept: '.svg,.png,.ico' },
    }),
    defineField({
      name: 'appleTouchIcon',
      title: 'Apple touch icon',
      type: 'image',
      description: `180px square PNG, used when the site is saved to a home screen. ${INHERITS}`,
      options: { accept: '.png' },
    }),
    defineField({
      name: 'socialImage',
      title: 'Social share image',
      type: 'image',
      description: `1200×630. Shown when the page is shared to social or chat. ${INHERITS}`,
      options: { accept: '.png,.jpg,.webp' },
      fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string' })],
    }),
    defineField({
      name: 'themeColor',
      title: 'Browser theme colour',
      type: 'string',
      description: `Hex value used for the mobile browser chrome, e.g. "#022647". ${INHERITS}`,
      validation: (Rule) =>
        Rule.custom((value) => (!value || /^#[0-9a-fA-F]{6}$/.test(value) ? true : 'Use a 6-digit hex like #022647.')),
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from search engines',
      type: 'boolean',
      description: 'Adds a noindex directive. Useful on staging tenants and unlisted pages.',
      initialValue: false,
    }),
  ],
});

// ── SpreePay ─────────────────────────────────────────────────────────────────

export const spreePayWidget = defineType({
  name: 'spreePayWidget',
  title: 'Payment widget content',
  type: 'object',
  description:
    'Cross-modality copy and links displayed by the payment widget. Payment availability, keys, rates and ' +
    'eligibility belong in Tenant Configuration or the SpreePay config API.',
  fields: [
    defineField({
      name: 'widgetTitle',
      title: 'Widget heading',
      type: 'string',
      description: `Heading above the payment options, e.g. "How would you like to pay?". ${INHERITS}`,
    }),
    urlField('termsUrl', 'Payment terms URL'),
  ],
});
