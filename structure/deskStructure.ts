/**
 * Desk structure — organised by tenant, matching the PDP's CMS tree.
 *
 *   Tenants
 *     └── <Tenant>
 *          ├── Tenant Configuration
 *          ├── Theme & style tokens
 *          ├── Shared Content
 *          └── Modality Content
 *               ├── Ticketing
 *               ├── VIP
 *               ├── Hotels
 *               └── Marketing
 *   Universal defaults
 *   Foundation tokens
 *
 * Two deliberate choices:
 *
 *   Universal defaults sit in their own top-level section rather than inside
 *   each tenant. They are shared, and nesting a shared document under one
 *   tenant implies editing it is local when it is not.
 *
 *   The default document IDs are fixed, so each is a true singleton reachable
 *   by ID — an editor cannot create a second competing default.
 */
import type { DefaultDocumentNodeResolver, StructureBuilder, StructureResolverContext } from 'sanity/structure';

import { BrandBoard } from '../components/BrandBoard';

import { PRODUCTS } from '../lib/constants';
import { defaultDocumentId } from '../lib/documentIds';

const FOUNDATION_ID = 'foundationTokens.singleton';

/** Types that exist as both a universal default and per-tenant overrides. */
const SCOPED_SINGLETON_TYPES = [
  { type: 'experienceConfig', title: 'Tenant Configuration Defaults' },
  { type: 'sharedContent', title: 'Shared Content' },
] as const;

const singleton = (S: StructureBuilder, schemaType: string, title: string) =>
  S.listItem()
    .title(title)
    .id(schemaType)
    .child(S.document().schemaType(schemaType).documentId(defaultDocumentId(schemaType)).title(title));

/** Documents of `type` scoped to one tenant. */
const tenantDocument = (
  S: StructureBuilder,
  schemaType: string,
  title: string,
  tenantId: string,
) =>
  S.listItem()
    .title(title)
    .id(schemaType)
    .child(
      S.documentList()
        .title(title)
        .schemaType(schemaType)
        .filter('_type == $type && tenant._ref == $tenantId')
        .params({ type: schemaType, tenantId })
        .initialValueTemplates([])
        .canHandleIntent(() => true)
        .apiVersion('2024-10-01'),
    );

const tenantConfiguration = (S: StructureBuilder, tenantId: string) =>
  S.listItem()
    .title('Tenant Configuration')
    .id('tenantConfiguration')
    .child(S.document().schemaType('tenant').documentId(tenantId).title('Tenant Configuration'));

const productBranch = (S: StructureBuilder, tenantId: string) =>
  S.listItem()
    .title('Modality Content')
    .id('productContent')
    .child(
      S.list()
        .title('Modalities')
        .items(
          PRODUCTS.map((product) =>
            S.listItem()
              .title(product.title)
              .id(product.id)
              .child(
                S.list()
                  .title(product.title)
                  .items([
                    S.listItem()
                      .title('Shared copy')
                      .id('shared')
                      .child(
                        S.documentList()
                          .title(`${product.title} — shared content`)
                          .schemaType('productContent')
                          .filter('_type == "productContent" && tenant._ref == $tenantId && coalesce(modality, product) == $product')
                          .params({ tenantId, product: product.id })
                          .apiVersion('2024-10-01'),
                      ),
                    S.listItem()
                      .title('Pages')
                      .id('pages')
                      .child(
                        S.documentList()
                          .title(`${product.title} — pages`)
                          .schemaType('pageContent')
                          .filter('_type == "pageContent" && tenant._ref == $tenantId && route match $prefix')
                          .params({ tenantId, prefix: `${product.id}/*` })
                          .apiVersion('2024-10-01'),
                      ),
                  ]),
              ),
          ),
        ),
    );

export const deskStructure = (S: StructureBuilder, _context: StructureResolverContext) =>
  S.list()
    .title('BookitCMS')
    .items([
      S.listItem()
        .title('Tenants')
        .id('tenants')
        .child(
          S.documentTypeList('tenant')
            .title('Tenants')
            .child((tenantId) =>
              S.list()
                .title('Tenant')
                .items([
                  tenantConfiguration(S, tenantId),
                  S.listItem()
                    .title('Brand')
                    .id('brand')
                    .child(
                      S.documentList()
                        .title('Brand')
                        .schemaType('brand')
                        .filter('_type == "brand" && tenant._ref == $tenantId')
                        .params({ tenantId })
                        .apiVersion('2024-10-01'),
                    ),
                  S.listItem()
                    .title('Theme & style tokens')
                    .id('brandTheme')
                    .child(
                      S.documentList()
                        .title('Theme & style tokens')
                        .schemaType('brandTheme')
                        .filter('_type == "brandTheme" && tenant._ref == $tenantId')
                        .params({ tenantId })
                        .apiVersion('2024-10-01'),
                    ),
                  tenantDocument(S, 'sharedContent', 'Shared Content', tenantId),
                  productBranch(S, tenantId),
                ]),
            ),
        ),

      S.divider(),

      S.listItem()
        .title('Universal defaults')
        .id('defaults')
        .child(
          S.list()
            .title('Universal defaults')
            .items([
              ...SCOPED_SINGLETON_TYPES.map(({ type, title }) => singleton(S, type, title)),
              singleton(S, 'brandTheme', 'Theme & style tokens'),
              S.listItem()
                .title('Modality Content defaults')
                .id('productContentDefaults')
                .child(
                  S.documentList()
                    .title('Modality Content defaults')
                    .schemaType('productContent')
                    .filter('_type == "productContent" && !defined(tenant)')
                    .apiVersion('2024-10-01'),
                ),
              S.listItem()
                .title('Page content defaults')
                .id('pageContentDefaults')
                .child(
                  S.documentList()
                    .title('Page content defaults')
                    .schemaType('pageContent')
                    .filter('_type == "pageContent" && !defined(tenant)')
                    .apiVersion('2024-10-01'),
                ),
            ]),
        ),

      S.listItem()
        .title('Foundation tokens')
        .id('foundationTokens')
        .child(S.document().schemaType('foundationTokens').documentId(FOUNDATION_ID).title('Foundation tokens')),
    ]);

/** Types the desk manages as singletons — hidden from the "create new" menu. */
export const HIDDEN_CREATE_TYPES = new Set([
  'foundationTokens',
  'siteSettings',
  'siteNavigation',
  'paymentSettings',
  'legalDocument',
  'sharedCopy',
]);

/**
 * The brand document opens on its visual board; the form is the second tab.
 * Everything else keeps the stock form-only view.
 */
export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, { schemaType }) => {
  if (schemaType === 'brand') {
    return S.document().views([
      S.view.component(BrandBoard).title('Brand board'),
      S.view.form().title('Edit'),
    ]);
  }
  return S.document();
};
