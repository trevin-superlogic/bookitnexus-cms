/**
 * Document ID conventions.
 *
 * Kept free of Sanity imports so that scripts, the build-time consumer and CI
 * can use them without pulling in the Studio runtime. `schemas/lib/scope.ts`
 * re-exports these alongside the schema helpers that do need Sanity.
 */

/** Documents whose ID begins with this prefix are universal defaults. */
export const DEFAULT_ID_PREFIX = 'default.';

/** The fixed ID of the universal default for a given schema type. */
export const defaultDocumentId = (schemaType: string): string => `${DEFAULT_ID_PREFIX}${schemaType}`;

/** Strips Sanity's `drafts.` prefix so ID checks work on drafts too. */
export const publishedId = (id: string): string => id.replace(/^drafts\./, '');

export const isDefaultDocument = (id: string | undefined): boolean =>
  publishedId(id ?? '').startsWith(DEFAULT_ID_PREFIX);

/** The Foundation collection is a singleton at a fixed ID. */
export const FOUNDATION_DOCUMENT_ID = 'foundationTokens.singleton';

/** Deterministic IDs so imports and seeds are idempotent. */
export const tenantDocumentId = (slug: string): string => `tenant.${slug}`;
export const brandThemeDocumentId = (slug: string): string => `brandTheme.${slug}`;

/** One modality settings document per scope. */
export const modalityContentDocumentId = (tenantId: string, modality: string): string =>
  `productContent.${publishedId(tenantId).replace(/^tenant\./, '')}.${modality}`;
export const defaultModalityContentDocumentId = (modality: string): string =>
  `${DEFAULT_ID_PREFIX}productContent.${modality}`;

/** One page document per route and scope. Slashes are not valid in Sanity IDs. */
const routeId = (route: string): string => route.replace(/[^a-zA-Z0-9_-]/g, '.');
export const pageContentDocumentId = (tenantId: string, route: string): string =>
  `pageContent.${publishedId(tenantId).replace(/^tenant\./, '')}.${routeId(route)}`;
export const defaultPageContentDocumentId = (route: string): string =>
  `${DEFAULT_ID_PREFIX}pageContent.${routeId(route)}`;
