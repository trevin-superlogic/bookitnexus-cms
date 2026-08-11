/**
 * Desk structure — organised by tenant, matching the PDP's CMS tree.
 *
 *   Tenants
 *     └── <Tenant>
 *          ├── Tenant Configuration
 *          ├── Theme & style tokens
 *          ├── Shared content   (navbar · footer · metadata · SpreePay · copy)
 *          └── Product content
 *               ├── Ticketing → shared copy + pages
 *               ├── VIP       → shared copy + pages
 *               └── Hotels    → shared copy + pages
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
import { tenantScopedTemplateId } from '../schemas/templates';

const FOUNDATION_ID = 'foundationTokens.singleton';

/** Types that exist as both a universal default and per-tenant overrides. */
const SCOPED_TYPES = [
  { type: 'experienceConfig', title: 'Tenant Configuration' },
  { type: 'siteSettings', title: 'Site settings' },
  { type: 'siteNavigation', title: 'Navigation & footer' },
  { type: 'paymentSettings', title: 'Payment settings' },
] as const;

const singleton = (S: StructureBuilder, schemaType: string, title: string) =>
  S.listItem()
    .title(title)
    .id(schemaType)
    .child(S.document().schemaType(schemaType).documentId(defaultDocumentId(schemaType)).title(title));

/** Documents of `type` scoped to one tenant. Creates one on demand if absent. */
const tenantDocument = (
  S: StructureBuilder,
  schemaType: string,
  title: string,
  tenantId: string,
  useTenantTemplate = false,
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
        // New documents created from here are pre-linked to the tenant, so an
        // override cannot be saved pointing at the wrong one.
        .initialValueTemplates(
          useTenantTemplate
            ? [S.initialValueTemplateItem(tenantScopedTemplateId(schemaType), { tenantId })]
            : [],
        )
        .canHandleIntent(() => true)
        .apiVersion('2024-10-01'),
    );

const productBranch = (S: StructureBuilder, tenantId: string) =>
  S.listItem()
    .title('Product content')
    .id('productContent')
    .child(
      S.list()
        .title('Products')
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
                          .title(`${product.title} — shared copy`)
                          .schemaType('productContent')
                          .filter('_type == "productContent" && tenant._ref == $tenantId && product == $product')
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
                  // The tenant document itself — name, ID, domain, active flag.
                  S.listItem()
                    .title('Tenant CMS Settings')
                    .id('tenantSettings')
                    .child(S.document().schemaType('tenant').documentId(tenantId).title('Tenant CMS Settings')),
                  S.listItem()
                    .title('Tenant Configuration')
                    .id('experienceConfig')
                    .child(
                      S.documentList()
                        .title('Tenant Configuration')
                        .schemaType('experienceConfig')
                        .filter('_type == "experienceConfig" && tenant._ref == $tenantId')
                        .params({ tenantId })
                        .apiVersion('2024-10-01'),
                    ),
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
                  tenantDocument(S, 'siteSettings', 'Site settings', tenantId, true),
                  tenantDocument(S, 'siteNavigation', 'Navigation & footer', tenantId, true),
                  tenantDocument(S, 'paymentSettings', 'Payment settings', tenantId, true),
                  tenantDocument(S, 'sharedCopy', 'Shared copy', tenantId, true),
                  tenantDocument(S, 'legalDocument', 'Legal documents', tenantId, true),
                  productBranch(S, tenantId),
                  S.divider(),
                  tenantDocument(S, 'sharedContent', 'Shared content (legacy)', tenantId),
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
              ...SCOPED_TYPES.map(({ type, title }) => singleton(S, type, title)),
              S.listItem()
                .title('Shared copy')
                .id('sharedCopyDefaults')
                .child(
                  S.documentList()
                    .title('Shared copy defaults')
                    .schemaType('sharedCopy')
                    .filter('_type == "sharedCopy" && !defined(tenant)')
                    .apiVersion('2024-10-01'),
                ),
              S.listItem()
                .title('Legal documents')
                .id('legalDocumentDefaults')
                .child(
                  S.documentList()
                    .title('Legal document defaults')
                    .schemaType('legalDocument')
                    .filter('_type == "legalDocument" && !defined(tenant)')
                    .apiVersion('2024-10-01'),
                ),
              singleton(S, 'brandTheme', 'Theme & style tokens'),
              S.listItem()
                .title('Product content defaults')
                .id('productContentDefaults')
                .child(
                  S.documentList()
                    .title('Product content defaults')
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
              S.divider(),
              singleton(S, 'sharedContent', 'Shared content (legacy)'),
            ]),
        ),

      S.listItem()
        .title('Foundation tokens')
        .id('foundationTokens')
        .child(S.document().schemaType('foundationTokens').documentId(FOUNDATION_ID).title('Foundation tokens')),
    ]);

/** Types the desk manages as singletons — hidden from the "create new" menu. */
export const SINGLETON_TYPES = new Set(['foundationTokens']);

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
