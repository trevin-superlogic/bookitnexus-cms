/**
 * Brand assets and SEO metadata.
 *
 * Replaces the tenant switches in apps/live-tickets/src/app/metadata.ts and the
 * static imports in Header/HeaderNav/Logo.tsx, Footer.<tenant>.tsx and
 * browse/[...slug]/Hero.tsx.
 *
 * Logos are SVG-first on purpose: the current logos are recoloured by the
 * cascade (`text-(--color-text-icons-brand-default)`), which only works on
 * inline SVG. Uploading a PNG would silently lose that behaviour, so the
 * distinction is called out in the field descriptions.
 */
import { defineField, defineType } from 'sanity';

import { INHERITS } from '../lib/scope';

export const brandAssets = defineType({
  name: 'brandAssets',
  title: 'Brand assets',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'headerLogo',
      title: 'Header logo',
      type: 'image',
      description:
        'SVG strongly preferred — header logos are recoloured via CSS custom properties, which requires inline ' +
        `SVG. A raster upload will render but will not follow the theme. ${INHERITS}`,
      options: { accept: '.svg,.png,.webp' },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          validation: (Rule) => Rule.required().warning('Alt text is needed for screen readers.'),
        }),
        defineField({
          name: 'href',
          title: 'Link target',
          type: 'string',
          description: 'Where clicking the logo goes. Defaults to "/" when empty.',
        }),
      ],
    }),
    defineField({
      name: 'footerLogo',
      title: 'Footer logo',
      type: 'image',
      description: `Falls back to the header logo when empty. ${INHERITS}`,
      options: { accept: '.svg,.png,.webp' },
      fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string' })],
    }),
    defineField({
      name: 'favicon',
      title: 'Favicon',
      type: 'image',
      description: `Square, at least 512×512. The build generates the smaller sizes. ${INHERITS}`,
      options: { accept: '.svg,.png,.ico' },
    }),
    defineField({
      name: 'openGraphImage',
      title: 'Social share image',
      type: 'image',
      description: `1200×630 recommended. Used for Open Graph and Twitter cards. ${INHERITS}`,
      fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string' })],
    }),
    defineField({
      name: 'browseHeroImage',
      title: 'Browse page hero background',
      type: 'image',
      description: `Background behind the category/city browse header. ${INHERITS}`,
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string' })],
    }),
  ],
});

export const seoConfig = defineType({
  name: 'seoConfig',
  title: 'SEO & metadata',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'applicationName',
      title: 'Application name',
      type: 'string',
      description: `Used in the web manifest and as the browser install name. ${INHERITS}`,
    }),
    defineField({
      name: 'defaultTitle',
      title: 'Default page title',
      type: 'string',
      description: `Shown when a page does not set its own title. ${INHERITS}`,
      validation: (Rule) => Rule.max(70).warning('Titles beyond ~70 characters are truncated in search results.'),
    }),
    defineField({
      name: 'titleTemplate',
      title: 'Title template',
      type: 'string',
      description: `How page titles are composed, e.g. "%s | AIR Shop". Use %s for the page title. ${INHERITS}`,
    }),
    defineField({
      name: 'defaultDescription',
      title: 'Default meta description',
      type: 'text',
      rows: 3,
      description: INHERITS,
      validation: (Rule) =>
        Rule.max(160).warning('Descriptions beyond ~160 characters are truncated in search results.'),
    }),
  ],
});
