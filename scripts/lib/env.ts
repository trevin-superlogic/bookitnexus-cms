/**
 * Minimal .env loader for the CLI scripts.
 *
 * The Sanity CLI loads .env.local itself (via Vite), but plain `node` does not —
 * so `npm run seed` and `npm run tokens:import` would otherwise see no
 * environment at all and fail with an unhelpful "projectId is required".
 *
 * Node's own `--env-file` flag would do this, but it throws ENOENT when the file
 * is absent and its version support has moved around across 20/22/23. Twenty
 * lines here is more predictable, and lets us fail with a message that says what
 * to actually do.
 *
 * Existing environment variables always win, so CI can pass secrets in directly
 * without a file on disk.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Loaded in order; the first file to define a key wins. */
const ENV_FILES = ['.env.local', '.env'];

export function loadEnv(cwd = process.cwd()): string[] {
  const loaded: string[] = [];

  for (const filename of ENV_FILES) {
    const path = resolve(cwd, filename);
    if (!existsSync(path)) continue;

    for (const rawLine of readFileSync(path, 'utf-8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();

      // Strip matching surrounding quotes — people paste tokens with them.
      if (value.length >= 2 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value[0])) {
        value = value.slice(1, -1);
      }

      if (key && process.env[key] === undefined) process.env[key] = value;
    }

    loaded.push(filename);
  }

  return loaded;
}

/**
 * Read the Sanity credentials, failing with instructions rather than a stack
 * trace. These scripts are run by people who did not write them.
 */
export function requireSanityEnv(): { projectId: string; dataset: string; token: string } {
  const loaded = loadEnv();

  const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
  const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';
  const token = process.env.SANITY_WRITE_TOKEN;

  const missing = [
    !projectId && 'SANITY_STUDIO_PROJECT_ID',
    !token && 'SANITY_WRITE_TOKEN',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(`\nMissing: ${missing.join(', ')}\n`);
    console.error(
      loaded.length
        ? `Read ${loaded.join(' and ')}, but ${missing.length > 1 ? 'those keys were' : 'that key was'} not in there.`
        : 'No .env.local file found in this folder.',
    );
    console.error(`\nCreate a file called .env.local here, containing:\n`);
    console.error('  SANITY_STUDIO_PROJECT_ID=your-project-id');
    console.error('  SANITY_STUDIO_DATASET=production');
    console.error('  SANITY_WRITE_TOKEN=your-token\n');
    console.error('Project ID: https://sanity.io/manage → your project (shown near the top)');
    console.error('Token:      https://sanity.io/manage → your project → API → Tokens → Add API token');
    console.error('            Permission must be "Editor". Sanity shows the token only once.\n');
    console.error('See SETUP.md steps 5 and 6.\n');
    process.exit(1);
  }

  return { projectId: projectId!, dataset, token: token! };
}
