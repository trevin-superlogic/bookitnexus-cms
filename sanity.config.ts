import { visionTool } from '@sanity/vision';
import { defineConfig } from 'sanity';
import { presentationTool } from 'sanity/presentation';
import { structureTool } from 'sanity/structure';

import { resolveDocumentActions } from './actions/validateAndPublish';
import { BrandImportTool, FoundationImportTool } from './components/FigmaImportTool';
import { createTenantPreviewHeader } from './components/TenantPreviewHeader';
import { schemaTypes } from './schemas';
import { standardContentTemplates } from './schemas/templates';
import {
  hotelsPresentationResolve,
  marketingPresentationResolve,
  ticketsPresentationResolve,
  vipPresentationResolve,
} from './presentation';
import { HIDDEN_CREATE_TYPES, defaultDocumentNode, deskStructure } from './structure/deskStructure';

// Same fallback as sanity.cli.ts: the Studio build reads .env.local through
// Vite, but a deploy run from a shell without it should still resolve.
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? 'gkcb4giq';
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';
const localPreview = process.env.NODE_ENV === 'development';
const marketingPreviewUrl = process.env.SANITY_STUDIO_MARKETING_PREVIEW_URL ??
  (localPreview ? 'http://localhost:3335' : '/static/previews/index.html');
const vipPreviewUrl = process.env.SANITY_STUDIO_VIP_PREVIEW_URL ??
  (localPreview ? 'http://localhost:3334' : '/static/previews/vip.html');
const ticketsPreviewUrl = process.env.SANITY_STUDIO_TICKETS_PREVIEW_URL ??
  (localPreview ? 'http://localhost:3336' : '/static/previews/ticketing.html');
const hotelsPreviewUrl = process.env.SANITY_STUDIO_HOTELS_PREVIEW_URL ??
  (localPreview ? 'http://127.0.0.1:3337' : '/static/previews/index.html');
const defaultTenantPreviewPath = '/__sanity-preview/bookit';

const MarketingTenantHeader = createTenantPreviewHeader('marketing', 'Marketing');
const VipTenantHeader = createTenantPreviewHeader('vip', 'VIP Experiences');
const TicketsTenantHeader = createTenantPreviewHeader('ticketing', 'Tickets');
const HotelsTenantHeader = createTenantPreviewHeader('hotels', 'Hotels');

const nextPreview = (origin: string) => ({
  initial: `${origin}${defaultTenantPreviewPath}`,
  previewMode: { enable: '/api/draft-mode/enable' },
});

const vitePreview = (origin: string) => ({
  initial: `${origin}${defaultTenantPreviewPath}`,
});

export default defineConfig({
  name: 'bookit-cms',
  title: 'BookitCMS',
  projectId,
  dataset,

  plugins: [
    structureTool({ structure: deskStructure, defaultDocumentNode }),
    presentationTool({
      name: 'marketing-preview',
      title: 'Marketing preview',
      previewUrl: localPreview ? nextPreview(marketingPreviewUrl) : marketingPreviewUrl,
      allowOrigins: localPreview ? marketingPreviewUrl : undefined,
      resolve: marketingPresentationResolve,
      components: localPreview ? { unstable_header: { component: MarketingTenantHeader } } : undefined,
    }),
    presentationTool({
      name: 'vip-preview',
      title: 'VIP Experiences preview',
      previewUrl: localPreview ? nextPreview(vipPreviewUrl) : vipPreviewUrl,
      allowOrigins: localPreview ? vipPreviewUrl : undefined,
      resolve: vipPresentationResolve,
      components: localPreview ? { unstable_header: { component: VipTenantHeader } } : undefined,
    }),
    presentationTool({
      name: 'tickets-preview',
      title: 'Tickets preview',
      previewUrl: localPreview ? nextPreview(ticketsPreviewUrl) : ticketsPreviewUrl,
      allowOrigins: localPreview ? ticketsPreviewUrl : undefined,
      resolve: ticketsPresentationResolve,
      components: localPreview ? { unstable_header: { component: TicketsTenantHeader } } : undefined,
    }),
    presentationTool({
      name: 'hotels-preview',
      title: 'Hotels preview',
      previewUrl: localPreview ? vitePreview(hotelsPreviewUrl) : hotelsPreviewUrl,
      allowOrigins: localPreview ? hotelsPreviewUrl : undefined,
      resolve: hotelsPresentationResolve,
      components: localPreview ? { unstable_header: { component: HotelsTenantHeader } } : undefined,
    }),
    visionTool({ defaultApiVersion: '2024-10-01' }),
  ],

  tools: (prev) => [
    ...prev,
    { name: 'import-brands', title: 'Import Brands', component: BrandImportTool },
    { name: 'import-foundation', title: 'Import Foundation', component: FoundationImportTool },
  ],

  schema: {
    types: schemaTypes,
    // Singletons are reachable from the desk at a fixed ID; offering "create
    // new" would let an editor make a second one that nothing reads.
    templates: (prev) => [
      ...prev.filter(
        (template) =>
          !HIDDEN_CREATE_TYPES.has(template.schemaType) &&
          template.schemaType !== 'productContent' &&
          template.schemaType !== 'pageContent',
      ),
      ...standardContentTemplates,
    ],
  },

  document: {
    // Replaces the stock publish action on token types with the validation
    // gate. See actions/validateAndPublish.tsx.
    actions: resolveDocumentActions,

    // Singletons are not deletable or duplicable from the document menu.
    unstable_comments: { enabled: false },
  },
});

