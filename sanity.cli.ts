/**
 * Sanity CLI configuration.
 *
 * Read by `sanity dev`, `sanity build` and `sanity deploy` — separate from
 * sanity.config.ts, which configures the Studio itself. The CLI needs to know
 * which project and dataset to talk to before the Studio has loaded.
 *
 * Values come from .env.local so the same checkout can point at a staging or a
 * production project without editing code — but with a literal fallback,
 * because the CLI evaluates this file before it loads .env files. Without the
 * fallback `sanity deploy` fails with "does not contain a project identifier".
 */
import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? 'gkcb4giq',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },

  /**
   * The hostname for `sanity deploy` — the studio ends up at
   * https://<studioHost>.sanity.studio
   *
   * Set SANITY_STUDIO_HOSTNAME in .env.local to claim a specific name;
   * otherwise the CLI prompts on first deploy and remembers the choice.
   */
  studioHost: process.env.SANITY_STUDIO_HOSTNAME,

  /** Pin deployments to the original BookitCMS Studio application. */
  deployment: {
    appId: process.env.SANITY_STUDIO_APP_ID ?? 'm882ejkvl9echsn8tkslwjwv',
    autoUpdates: true,
  },

  /** Vite needs this to resolve the .ts extensions used across lib/. */
  vite: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
    },
  }),
});
