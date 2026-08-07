/**
 * Brand book — one per tenant. The marketing-facing distillation of the token
 * system: the ~14 colors that define the brand, with plain-language roles.
 *
 * Values are copied from the Figma Theme · Brand export (final resolved
 * values, not aliases). `figmaAlias` records where each color lives in Figma
 * so design and marketing are always talking about the same variable.
 *
 * The visual "Brand board" view for this document lives in
 * components/BrandBoard.tsx and is wired up via defaultDocumentNode.
 */
import { createElement } from 'react';
import { defineField, defineType } from 'sanity';

export const brandRole = defineType({
  name: 'brandRole',
  title: 'Brand color',
  type: 'object',
  fields: [
    defineField({ name: 'role', title: 'Role', type: 'string', description: 'What this color does, in plain language.' }),
    defineField({ name: 'value', title: 'Value', type: 'string', description: 'Hex like #022647, or rgba(…) for translucent colors.' }),
    defineField({ name: 'name', title: 'Token name', type: 'string', readOnly: true }),
    defineField({ name: 'cssVar', title: 'CSS variable (frontend)', type: 'string', readOnly: true }),
    defineField({ name: 'figmaAlias', title: 'Figma variable', type: 'string', readOnly: true }),
  ],
  preview: {
    select: { role: 'role', value: 'value', figmaAlias: 'figmaAlias' },
    prepare: ({ role, value, figmaAlias }) => ({
      title: role ?? 'Color',
      subtitle: `${value ?? ''}   ⤷ ${figmaAlias ?? 'raw value'}`,
      media: createElement('div', {
        style: {
          width: '100%',
          height: '100%',
          borderRadius: 4,
          background: value ?? '#ffffff',
          border: '1px solid rgba(0,0,0,0.15)',
        },
      }),
    }),
  },
});

export const brand = defineType({
  name: 'brand',
  title: 'Brand book',
  type: 'document',
  fields: [
    defineField({
      name: 'tenant',
      title: 'Tenant',
      type: 'reference',
      to: [{ type: 'tenant' }],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'tenantSlug', title: 'Tenant slug', type: 'string', readOnly: true, hidden: true }),
    defineField({ name: 'title', title: 'Brand name', type: 'string' }),
    defineField({
      name: 'essence',
      title: 'Essence',
      type: 'text',
      rows: 2,
      description: 'One line on how this brand should feel. Shown on the brand board.',
    }),
    defineField({
      name: 'roles',
      title: 'Defining colors',
      type: 'array',
      of: [{ type: 'brandRole' }],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'essence' },
  },
});
