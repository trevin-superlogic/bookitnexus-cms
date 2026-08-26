import { defineDocuments, defineLocations, type PresentationPluginOptions } from 'sanity/presentation';

const DEFAULT_TENANT_SLUG = 'bookit';
const PREVIEW_ROUTE = '/__sanity-preview/:tenant';

const tenantId = (tenantSlug?: string) => `tenant.${tenantSlug || DEFAULT_TENANT_SLUG}`;

const homeDocument = (filter: string) =>
  defineDocuments([
    {
      route: ['/', PREVIEW_ROUTE],
      resolve: ({ params }) => ({
        filter: `${filter} && tenant._ref == $tenantId`,
        params: { tenantId: tenantId(params.tenant) },
      }),
    },
  ]);

const pageLocation = (route: string, title: string) =>
  defineLocations({
    select: { title: 'title', heading: 'heading', route: 'route', tenantSlug: 'tenant.slug.current' },
    resolve: (document) =>
      document?.route === route
        ? {
            locations: [{ title: document.title || document.heading || title, href: `/__sanity-preview/${document.tenantSlug || DEFAULT_TENANT_SLUG}` }],
          }
        : undefined,
  });

const productLocation = (modality: string, title: string) =>
  defineLocations({
    select: { modality: 'modality', tenantSlug: 'tenant.slug.current' },
    resolve: (document) =>
      document?.modality === modality
        ? {
            locations: [{ title, href: `/__sanity-preview/${document.tenantSlug || DEFAULT_TENANT_SLUG}` }],
          }
        : undefined,
  });

export const marketingPresentationResolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: homeDocument(
    `_type == "pageContent" && route == "marketing/page" && slug.current == "home"`,
  ),
  locations: {
    pageContent: defineLocations({
      select: { title: 'title', heading: 'heading', route: 'route', slug: 'slug.current', tenantSlug: 'tenant.slug.current' },
      resolve: (document) =>
        document?.route === 'marketing/page' && document.slug === 'home'
          ? {
              locations: [{
                title: document.title || document.heading || 'Marketing home',
                href: `/__sanity-preview/${document.tenantSlug || DEFAULT_TENANT_SLUG}`,
              }],
            }
          : undefined,
    }),
  },
};

export const vipPresentationResolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: homeDocument(
    `_type == "pageContent" && route == "vip/home"`,
  ),
  locations: {
    pageContent: pageLocation('vip/home', 'VIP Experiences home'),
    productContent: productLocation('vip', 'VIP Experiences home'),
  },
};

export const ticketsPresentationResolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: homeDocument(
    `_type == "pageContent" && route == "ticketing/home"`,
  ),
  locations: {
    pageContent: pageLocation('ticketing/home', 'Tickets home'),
    productContent: productLocation('ticketing', 'Tickets home'),
  },
};

export const hotelsPresentationResolve: PresentationPluginOptions['resolve'] = {
  mainDocuments: homeDocument(
    `_type == "pageContent" && route == "hotels/home"`,
  ),
  locations: {
    pageContent: pageLocation('hotels/home', 'Hotels home'),
    productContent: productLocation('hotels', 'Hotels home'),
  },
};

