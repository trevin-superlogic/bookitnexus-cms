/**
 * Brand Theme — one per tenant. Holds that tenant's semantic (Theme · Brand)
 * tokens plus the translated output the API serves.
 *
 * Unlike every other scoped document there is no universal default here.
 * Tokens are not additive: a theme is a complete set of aliases into one
 * brand's primitives, and half-inheriting another brand's semantics would
 * produce a coherent-looking but wrong palette. Sharing happens one level down,
 * in the Foundation document, where `shared/*` and `scale/*` genuinely are
 * common across tenants.
 */
import { defineField, defineType } from 'sanity';

import { StyleValuesInput } from '../../components/StyleValuesInput';
import { isDefaultDocument } from '../../lib/documentIds';
import { scopePreview, tenantScopeField } from '../lib/scope';

export const brandTheme = defineType({
  name: 'brandTheme',
  title: 'Theme & style tokens',
  type: 'document',
  groups: [
    { name: 'styles', title: 'Theme variables', default: true },
    { name: 'tokens', title: 'Imported from Figma' },
    { name: 'primitives', title: 'Brand primitives' },
    { name: 'output', title: 'Compiled output' },
    { name: 'validation', title: 'Validation' },
  ],
  fields: [
    { ...tenantScopeField(), group: 'tokens' },
    defineField({
      name: 'sourceTenant',
      title: 'Tracks this brand',
      type: 'reference',
      to: [{ type: 'tenant' }],
      group: 'tokens',
      hidden: ({ document }) => !isDefaultDocument(document?._id as string | undefined),
      description:
        'Universal default only. Whenever this brand publishes, its compiled tokens are mirrored here, ' +
        'so the default never goes stale. Tenants without their own theme serve these tokens, and any ' +
        'tenant missing an individual token inherits it from here.',
    }),
    defineField({
      name: 'theme',
      title: 'Semantic tokens',
      type: 'tokenSet',
      group: 'tokens',
      description:
        'The Theme · Brand export for this tenant — semantic aliases like color/text+icons/brand/default. ' +
        'Import with `npm run import:tokens`; edit individual values here.',
    }),
    defineField({
      name: 'overrides',
      title: '',
      type: 'array',
      group: 'styles',
      of: [{ type: 'tokenOverride' }],
      components: { input: StyleValuesInput },
      description:
        'Every token this tenant publishes. Values come from the Figma import unless changed here; a changed value ' +
        'is kept when a new Figma file is imported, and Reset hands it back to Figma.',
    }),
    defineField({
      name: 'primitivesDesktop',
      title: 'Brand primitives — desktop',
      type: 'tokenSet',
      group: 'primitives',
      description:
        "This brand's section of the 📐 Foundation · Breakpoint export — its raw palette and per-brand overrides. " +
        'Written by “Import Foundation”; stored here so the Foundation document stays purely universal.',
    }),
    defineField({ name: 'primitivesWideDesktop', title: 'Brand primitives — wide desktop', type: 'tokenSet', group: 'primitives' }),
    defineField({ name: 'primitivesTablet', title: 'Brand primitives — tablet', type: 'tokenSet', group: 'primitives' }),
    defineField({ name: 'primitivesMobile', title: 'Brand primitives — mobile', type: 'tokenSet', group: 'primitives' }),
    defineField({
      name: 'compatAliasesEnabled',
      title: 'Emit compatibility aliases',
      type: 'boolean',
      group: 'tokens',
      initialValue: true,
      description:
        'Keeps old variable names resolving to their renamed equivalents while the frontend catches up. ' +
        'Turn off once no source references the old names — the publish report lists which are still in use.',
    }),
    defineField({
      name: 'compiled',
      title: 'Compiled output',
      type: 'compiledTheme',
      group: 'output',
      description: 'Written by the publish action. Always reflects the last successfully validated tokens.',
    }),
    defineField({
      name: 'validation',
      title: 'Last validation',
      type: 'validationReport',
      group: 'validation',
    }),
  ],
  preview: {
    select: {
      _id: '_id',
      tenantTitle: 'tenant.title',
      sourceTitle: 'sourceTenant.title',
      status: 'validation.status',
      errors: 'validation.errorCount',
      count: 'compiled.tokenCount',
    },
    prepare: ({ _id, tenantTitle, sourceTitle, status, errors, count }) => {
      const badge = status === 'failing' ? `✕ ${errors ?? 0} error(s)` : status === 'passing' ? '✓ validated' : 'not validated';
      const isDefault = isDefaultDocument(_id as string | undefined);
      return {
        title: isDefault ? 'Theme & style tokens — universal default' : `${tenantTitle ?? 'Unassigned'} — theme`,
        subtitle: [
          isDefault ? `${scopePreview(_id as string)} · tracks ${sourceTitle ?? 'no brand'}` : badge,
          count ? `${count} tokens` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    },
  },
});

/**
 * Foundation tokens — the 📐 Foundation · Breakpoint collection.
 *
 * A single document, not one per tenant, because that is how Figma models it:
 * one collection containing every brand's primitives plus the shared and scale
 * scales, exported once per breakpoint. Splitting it per tenant here would mean
 * re-importing the same `shared/*` values six times and letting them drift.
 *
 * The four breakpoint sets are diffed against desktop at publish time; only
 * genuinely differing values become @media overrides.
 */
export const foundationTokens = defineType({
  name: 'foundationTokens',
  title: 'Foundation tokens',
  type: 'document',
  groups: [
    { name: 'desktop', title: 'Desktop (base)', default: true },
    { name: 'responsive', title: 'Responsive' },
    { name: 'output', title: 'Compiled output' },
    { name: 'validation', title: 'Validation' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Label',
      type: 'string',
      initialValue: 'Foundation · Breakpoint',
      readOnly: true,
    }),
    defineField({
      name: 'desktop',
      title: 'Desktop',
      type: 'tokenSet',
      group: 'desktop',
      description: 'The base layer. Every other breakpoint is expressed as a difference from this one.',
    }),
    defineField({
      name: 'wideDesktop',
      title: 'Wide desktop (min-width: 1512px)',
      type: 'tokenSet',
      group: 'responsive',
      description: 'Only values that differ from desktop are emitted.',
    }),
    defineField({
      name: 'tablet',
      title: 'Tablet (max-width: 1199px)',
      type: 'tokenSet',
      group: 'responsive',
      description: 'Only values that differ from desktop are emitted.',
    }),
    defineField({
      name: 'mobile',
      title: 'Mobile (max-width: 767px)',
      type: 'tokenSet',
      group: 'responsive',
      description: 'Only values that differ from desktop are emitted.',
    }),
    defineField({
      name: 'compiledShared',
      title: 'shared.figma.css',
      type: 'compiledTheme',
      group: 'output',
      description: 'Consumed by both apps via @repo/ui/globals.css.',
    }),
    defineField({
      name: 'compiledScale',
      title: 'scale.figma.css',
      type: 'compiledTheme',
      group: 'output',
    }),
    defineField({
      name: 'validation',
      title: 'Last validation',
      type: 'validationReport',
      group: 'validation',
    }),
  ],
  preview: {
    select: { status: 'validation.status', errors: 'validation.errorCount' },
    prepare: ({ status, errors }) => ({
      title: 'Foundation tokens',
      subtitle: status === 'failing' ? `✕ ${errors ?? 0} error(s)` : status === 'passing' ? '✓ validated' : 'not validated',
    }),
  },
});
