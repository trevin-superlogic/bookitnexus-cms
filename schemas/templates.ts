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

type ModalityTemplateParameters = { tenantId?: string; modality: 'ticketing' | 'vip' };
type PageTemplateParameters = { tenantId?: string; route: string };

export const MODALITY_CONTENT_TEMPLATE_ID = 'modality-content-for-scope';
export const PAGE_CONTENT_TEMPLATE_ID = 'page-content-for-scope';

export const standardContentTemplates: Template[] = [
  {
    id: MODALITY_CONTENT_TEMPLATE_ID,
    title: 'Modality settings for scope',
    schemaType: 'productContent',
    parameters: [
      { name: 'tenantId', title: 'Tenant ID', type: 'string' },
      { name: 'modality', title: 'Modality', type: 'string' },
    ],
    value: ({ tenantId, modality }: ModalityTemplateParameters) => ({
      ...(tenantId ? { tenant: { _type: 'reference', _ref: tenantId } } : {}),
      modality,
    }),
  },
  {
    id: PAGE_CONTENT_TEMPLATE_ID,
    title: 'Standard page for scope',
    schemaType: 'pageContent',
    parameters: [
      { name: 'tenantId', title: 'Tenant ID', type: 'string' },
      { name: 'route', title: 'Page route', type: 'string' },
    ],
    value: ({ tenantId, route }: PageTemplateParameters) => ({
      ...(tenantId ? { tenant: { _type: 'reference', _ref: tenantId } } : {}),
      route,
    }),
  },
];
