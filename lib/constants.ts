/**
 * Shared vocabulary between the Studio, the publish gate, and the frontend.
 *
 * Tenants are *documents*, not an enum — adding one must not require a code
 * change, which is a stated success criterion of the PDP. What lives here is
 * only the mapping the code genuinely needs: how a tenant's Sanity slug lines
 * up with the identifiers that already exist in superlogic-ui and in Figma.
 */

/** Products, each backed by a real app in the monorepo. */
export const PRODUCTS = [
  { id: 'ticketing', title: 'Ticketing', app: 'apps/live-tickets' },
  { id: 'vip', title: 'VIP', app: 'apps/bookit' },
  { id: 'hotels', title: 'Hotels', app: 'superlogic-ui (Vite)' },
  { id: 'marketing', title: 'Marketing', app: '—' },
] as const;

export type ProductId = (typeof PRODUCTS)[number]['id'];

/**
 * Seed data for the tenant documents.
 *
 * `slug` matches `TenantId` in apps/live-tickets/src/tenant.types.ts — it is
 * the value of TENANT / NEXT_PUBLIC_TENANT_ID and the theme directory name.
 *
 * `figmaBrandKey` is the raw key inside the Figma Foundation collection's
 * `brand` group. It is NOT always the slug: Figma names carry emoji prefixes
 * for visual grouping, and some brands were renamed on one side only. Getting
 * this mapping wrong makes every alias in that theme look like cross-brand
 * leakage, so it is stored explicitly rather than derived.
 */
export const TENANT_SEED = [
  { slug: 'bookit', title: 'Bookit', figmaBrandKey: 'bookit', domain: 'join.bookit.com' },
  { slug: 'cdc', title: 'Crypto.com', figmaBrandKey: 'cdc', domain: 'crypto.com' },
  { slug: 'moca', title: 'AIR Shop (Moca)', figmaBrandKey: 'moca', domain: 'air.shop' },
  { slug: 'tria', title: 'Tria', figmaBrandKey: '🔴tria', domain: 'tria.so' },
  { slug: 'umhp', title: 'UM Pulse', figmaBrandKey: 'umhp', domain: 'umpulse.superlogic.com' },
  { slug: 'qiibee', title: 'Qiibee', figmaBrandKey: 'qiibee', domain: 'qiibeefoundation.org' },
] as const;

/**
 * Brands present in the Figma Theme · Brand collection that have no tenant in
 * superlogic-ui yet. Listed so the Studio can offer them when a new tenant is
 * created, rather than making someone retype an emoji-prefixed key.
 */
export const UNMAPPED_FIGMA_BRANDS = ['actai', '🟠futurec', 'jayz30', 'jumper', 'u_e'] as const;

/** Editorial statuses used by the publish gate to surface token health. */
export const TOKEN_STATUS = {
  never: 'Never validated',
  passing: 'Validated — safe to publish',
  failing: 'Blocked — validation errors',
} as const;

export type TokenStatus = keyof typeof TOKEN_STATUS;
