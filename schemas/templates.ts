import type { Template } from 'sanity';

import { defaultSectionsForTemplate, defaultTemplateForRoute, modalityFromRoute } from '../lib/pageTemplates';

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

type ModalityTemplateParameters = {
  tenantId?: string;
  modality: 'ticketing' | 'vip' | 'hotels' | 'marketing';
};
type PageTemplateParameters = { tenantId?: string; route: string };
type MarketingPageTemplateParameters = {
  tenantId?: string;
  slug?: string;
  templateKey?: string;
};

export const MODALITY_CONTENT_TEMPLATE_ID = 'modality-content-for-scope';
export const PAGE_CONTENT_TEMPLATE_ID = 'page-content-for-scope';
export const MARKETING_PAGE_TEMPLATE_ID = 'marketing-page-for-scope';
export const HOTELS_DEMO_PAGE_TEMPLATE_ID = 'hotels-demo-page';

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
    value: ({ tenantId, route }: PageTemplateParameters) => {
      const templateKey = defaultTemplateForRoute(route);
      return {
        ...(tenantId ? { tenant: { _type: 'reference', _ref: tenantId } } : {}),
        title: route.endsWith('/home') ? 'Homepage' : route,
        modality: modalityFromRoute(route),
        route,
        templateKey,
        templateVersion: 1,
        ...(templateKey ? { sections: defaultSectionsForTemplate(templateKey) } : {}),
      };
    },
  },
  {
    id: MARKETING_PAGE_TEMPLATE_ID,
    title: 'Marketing page for scope',
    schemaType: 'pageContent',
    parameters: [
      { name: 'tenantId', title: 'Tenant ID', type: 'string' },
      { name: 'slug', title: 'Page slug', type: 'string' },
      { name: 'templateKey', title: 'Page template', type: 'string' },
    ],
    value: ({ tenantId, slug, templateKey }: MarketingPageTemplateParameters) => {
      const resolvedTemplateKey = templateKey ?? (slug === 'home' ? 'marketing-home-v1' : 'flexible-v1');
      return {
        ...(tenantId ? { tenant: { _type: 'reference', _ref: tenantId } } : {}),
        title: slug === 'home' ? 'Marketing homepage' : 'New Marketing page',
        modality: 'marketing',
        route: 'marketing/page',
        slug: { _type: 'slug', current: slug ?? '' },
        templateKey: resolvedTemplateKey,
        templateVersion: 1,
        sections: defaultSectionsForTemplate(resolvedTemplateKey),
      };
    },
  },
  {
    id: HOTELS_DEMO_PAGE_TEMPLATE_ID,
    title: 'Demo — Hotels concept page',
    description: 'Editable Hotels concept composed from the existing approved Marketing modules.',
    schemaType: 'pageContent',
    value: {
      route: 'marketing/page',
      modality: 'marketing',
      title: 'Hotels concept page',
      slug: { _type: 'slug', current: 'hotels' },
      templateKey: 'flexible-v1',
      templateVersion: 1,
      heading: 'Private hotel rates worth checking in for.',
      subheading: 'A demo-only Hotels surface. Availability, pricing, authentication, and booking remain API-owned.',
      analyticsKey: 'hotels-concept-demo',
      sections: [
        {
          _key: 'hotels-hero',
          _type: 'marketingHeroSearchSection',
          visible: true,
          eyebrow: 'Jumeirah Marsa Al Arab · Dubai',
          heading: 'Private hotel rates worth checking in for.',
          body: 'Search standout properties and unlock prices reserved for members.',
          ctaLabel: 'Search hotels',
          ctaUrl: '#hotel-search',
        },
        {
          _key: 'hotels-private-rates',
          _type: 'commerceShelfSection',
          visible: true,
          source: 'hotels',
          selectionMode: 'automatic',
          heading: 'Explore today’s private rates',
          body: 'A frozen catalog bundle for the CMS workflow demo—no booking API required.',
          limit: 6,
          queryContext: 'tenantDefault',
          fallbackBehavior: 'broaden',
        },
        {
          _key: 'hotels-value',
          _type: 'editorialIntroSection',
          visible: true,
          key: 'hotels-value',
          eyebrow: 'The Bookit difference',
          heading: 'Lower prices without lowering expectations.',
          body: 'Members compare public prices with private Bookit rates, then earn rewards on every eligible booking.',
        },
        {
          _key: 'hotels-benefits',
          _type: 'valuePropositionGridSection',
          visible: true,
          heading: 'More value in every stay',
          items: [
            { _key: 'private-rates', _type: 'valuePropositionItem', title: 'Private rates', body: 'Member pricing unavailable on public booking sites.' },
            { _key: 'earn-points', _type: 'valuePropositionItem', title: 'Earn points', body: 'Eligible stays add rewards to your balance.' },
            { _key: 'global-choice', _type: 'valuePropositionItem', title: 'Global choice', body: 'A broad catalog of hotels and resorts.' },
          ],
        },
        {
          _key: 'hotels-membership',
          _type: 'ctaBannerSection',
          visible: true,
          heading: 'Travel better from the very first booking.',
          body: 'Join once. Unlock hotel savings, VIP access, tickets, and rewards across Bookit.',
          ctaLabel: 'Become a member',
          ctaUrl: '/membership',
          actionKey: 'openMembership',
        },
      ],
    },
  },
];

