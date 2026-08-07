/**
 * The universal-default / tenant-override document pattern.
 *
 * Every configurable section exists twice: once as a universal default and
 * once (optionally) per tenant. Rather than a boolean flag an editor could set
 * wrongly, the distinction is carried by the document ID:
 *
 *   default.experienceConfig            ← the universal default (singleton)
 *   experienceConfig.bookit             ← Bookit's override
 *
 * Encoding it in the ID buys three things: the default is addressable by a
 * fixed ID from GROQ without a join, there can only ever be one of them, and
 * an editor cannot accidentally convert a tenant document into the default.
 */
import { defineField } from 'sanity';

// The ID helpers live in lib/ so scripts and the build-time consumer can use
// them without importing the Studio runtime.
export {
  DEFAULT_ID_PREFIX,
  defaultDocumentId,
  isDefaultDocument,
  publishedId,
} from '../../lib/documentIds';

import { isDefaultDocument } from '../../lib/documentIds';

/**
 * The `tenant` reference every scoped document carries.
 *
 * Required on tenant documents, forbidden on the universal default — a default
 * that pointed at a tenant would be a default for nobody.
 */
export const tenantScopeField = () =>
  defineField({
    name: 'tenant',
    title: 'Tenant',
    type: 'reference',
    to: [{ type: 'tenant' }],
    description: 'Leave empty on the universal default. Required on a tenant override.',
    readOnly: ({ document }) => isDefaultDocument(document?._id),
    validation: (Rule) =>
      Rule.custom((value, context) => {
        const isDefault = isDefaultDocument(context.document?._id as string | undefined);
        if (isDefault && value) return 'The universal default must not reference a tenant.';
        if (!isDefault && !value) return 'Select the tenant this override applies to.';
        return true;
      }),
  });

/**
 * Preview subtitle showing which scope a document belongs to.
 * Used across every scoped type so the desk reads consistently.
 */
export const scopePreview = (documentId: string | undefined, tenantTitle?: string): string =>
  isDefaultDocument(documentId) ? 'Universal default' : (tenantTitle ?? 'Tenant override');

/**
 * Marks a field as "inherits when empty".
 *
 * Appended to descriptions on tenant-overridable fields so the behaviour is
 * visible in the form rather than only in documentation. Deliberately worded
 * to steer editors away from clearing a field to hide something — that is what
 * the visibility toggles are for.
 */
export const INHERITS = 'Leave empty to inherit the universal default.';
