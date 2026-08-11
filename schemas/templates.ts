import type { Template } from 'sanity';

export const TENANT_SCOPED_TYPES = [
  'siteSettings',
  'siteNavigation',
  'paymentSettings',
  'legalDocument',
  'sharedCopy',
] as const;

type TenantScopedType = (typeof TENANT_SCOPED_TYPES)[number];
type TenantTemplateParameters = { tenantId: string };

const TITLES: Record<TenantScopedType, string> = {
  siteSettings: 'Site settings',
  siteNavigation: 'Navigation & footer',
  paymentSettings: 'Payment settings',
  legalDocument: 'Legal document',
  sharedCopy: 'Shared copy',
};

export const tenantScopedTemplateId = (schemaType: string): string => `${schemaType}-for-tenant`;

export const tenantScopedTemplates: Template<TenantTemplateParameters>[] = TENANT_SCOPED_TYPES.map(
  (schemaType) => ({
    id: tenantScopedTemplateId(schemaType),
    title: `${TITLES[schemaType]} for tenant`,
    schemaType,
    parameters: [{ name: 'tenantId', title: 'Tenant ID', type: 'string' }],
    value: ({ tenantId }: TenantTemplateParameters) => ({
      tenant: { _type: 'reference', _ref: tenantId },
    }),
  }),
);
