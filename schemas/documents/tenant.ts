/**
 * Tenant — the root document every other document references.
 *
 * Deliberately thin. It carries identity and the keys needed to line a tenant
 * up with the code and with Figma; everything else (config, theme, content)
 * lives in focused documents that reference this one. The PDP is explicit that
 * a tenant must not become one large document.
 */
import { defineField, defineType } from 'sanity';

export const tenant = defineType({
  name: 'tenant',
  title: 'Tenant',
  type: 'document',
  groups: [
    { name: 'identity', title: 'Tenant CMS Settings', default: true },
    { name: 'products', title: 'Products' },
  ],
  fields: [
    defineField({
      name: 'title',
      group: 'identity',
      title: 'Display name',
      type: 'string',
      description: 'Human-readable name shown in the Studio, e.g. "Crypto.com".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      group: 'identity',
      title: 'Tenant ID',
      type: 'slug',
      description:
        'Must match TenantId in apps/live-tickets/src/tenant.types.ts — this is the value of the TENANT build ' +
        'variable and the name of the theme directory. Changing it after launch breaks the build.',
      options: { source: 'title', maxLength: 32 },
      validation: (Rule) =>
        Rule.required().custom((value) =>
          value?.current && /^[a-z0-9-]+$/.test(value.current)
            ? true
            : 'Use lowercase letters, numbers and hyphens only.',
        ),
    }),
    defineField({
      name: 'figmaBrandKey',
      group: 'identity',
      title: 'Figma brand key (legacy)',
      type: 'string',
      readOnly: true,
      hidden: true,
      description:
        'No longer set by hand. Brands are matched on Tenant ID: "🔴tria", "u_e" and "tria" all resolve to the ' +
        'same brand, so the Figma key and the Tenant ID never have to be kept in sync. Retained only so older ' +
        'documents keep their value.',
    }),
    defineField({
      name: 'domain',
      group: 'identity',
      title: 'Primary domain',
      type: 'string',
      description: 'Production domain, e.g. "crypto.com". Matches TENANT_DOMAINS in scripts/run-next.ts.',
    }),
    defineField({
      name: 'enabledProducts',
      group: 'products',
      title: 'Enabled products',
      type: 'array',
      description:
        'Which product surfaces this tenant runs. Controls what appears in the Studio for this tenant and which ' +
        'product content the API returns. Feature availability inside an app is set in Experience Configuration.',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'Ticketing (live-tickets)', value: 'ticketing' },
          { title: 'VIP (bookit)', value: 'vip' },
          { title: 'Hotels (Vite app)', value: 'hotels' },
          { title: 'Marketing', value: 'marketing' },
        ],
      },
    }),
    defineField({
      name: 'active',
      group: 'identity',
      title: 'Active',
      type: 'boolean',
      description: 'Inactive tenants stay editable but are excluded from the API response.',
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: 'title', slug: 'slug.current', active: 'active' },
    prepare: ({ title, slug, active }) => ({
      title: `${title}${active === false ? ' (inactive)' : ''}`,
      subtitle: slug,
    }),
  },
});
