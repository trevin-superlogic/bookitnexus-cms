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

import { MODALITY_PAGES } from '../lib/constants';
import {
  defaultDocumentId,
  defaultModalityContentDocumentId,
  defaultPageContentDocumentId,
  modalityContentDocumentId,
  pageContentDocumentId,
} from '../lib/documentIds';
import { MODALITY_CONTENT_TEMPLATE_ID, PAGE_CONTENT_TEMPLATE_ID } from '../schemas/templates';

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

const MODELED_MODALITIES = [
  { id: 'ticketing', title: 'Ticketing', pages: MODALITY_PAGES.ticketing },
  { id: 'vip', title: 'VIP', pages: MODALITY_PAGES.vip },
] as const;

const modalityBranch = (
  S: StructureBuilder,
  modality: (typeof MODELED_MODALITIES)[number],
  tenantId?: string,
) => {
  const overviewId = tenantId
    ? modalityContentDocumentId(tenantId, modality.id)
    : defaultModalityContentDocumentId(modality.id);

  return S.listItem()
    .title(modality.title)
    .id(modality.id)
    .child(
      S.list()
        .title(modality.title)
        .items([
          S.listItem()
            .title('Overview & settings')
            .id('overview')
            .child(
              S.document()
                .title(`${modality.title} — overview & settings`)
                .schemaType('productContent')
                .documentId(overviewId)
                .initialValueTemplate(MODALITY_CONTENT_TEMPLATE_ID, {
                  ...(tenantId ? { tenantId } : {}),
                  modality: modality.id,
                }),
            ),
          S.divider(),
          ...modality.pages.map((page) => {
            const route = `${modality.id}/${page.id}`;
            const documentId = tenantId
              ? pageContentDocumentId(tenantId, route)
              : defaultPageContentDocumentId(route);
            return S.listItem()
              .title(page.title)
              .id(page.id)
              .child(
                S.document()
                  .title(`${modality.title} — ${page.title}`)
                  .schemaType('pageContent')
                  .documentId(documentId)
                  .initialValueTemplate(PAGE_CONTENT_TEMPLATE_ID, {
                    ...(tenantId ? { tenantId } : {}),
                    route,
                  }),
              );
          }),
        ]),
    );
};

const productBranch = (S: StructureBuilder, tenantId: string) =>
  S.listItem()
    .title('Modality Content')
    .id('productContent')
    .child(
      S.list()
        .title('Modalities')
        .items(MODELED_MODALITIES.map((modality) => modalityBranch(S, modality, tenantId))),
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
                  S.list()
                    .title('Modality Content defaults')
                    .items(MODELED_MODALITIES.map((modality) => modalityBranch(S, modality))),
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
