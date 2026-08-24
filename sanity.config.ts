import { visionTool } from '@sanity/vision';
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';

import { resolveDocumentActions } from './actions/validateAndPublish';
import { BrandImportTool, FoundationImportTool } from './components/FigmaImportTool';
import { schemaTypes } from './schemas';
import { standardContentTemplates } from './schemas/templates';
import { HIDDEN_CREATE_TYPES, defaultDocumentNode, deskStructure } from './structure/deskStructure';

// Same fallback as sanity.cli.ts: the Studio build reads .env.local through
// Vite, but a deploy run from a shell without it should still resolve.
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? 'gkcb4giq';
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';

export default defineConfig({
  name: 'bookit-cms',
  title: 'BookitCMS',
  projectId,
  dataset,

  plugins: [structureTool({ structure: deskStructure, defaultDocumentNode }), visionTool({ defaultApiVersion: '2024-10-01' })],

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
