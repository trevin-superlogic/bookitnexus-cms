/**
 * Point the saved preview pages at the live stylesheets.
 *
 * A browser "save page as" rewrites asset links to a local folder that is
 * easily lost — and reconstructing Tailwind by hand was never going to match
 * the real thing. But the saved HTML keeps the original Next.js asset paths
 * (`/_next/static/chunks/….css`), so the pages can simply load the real
 * stylesheets from the live sites instead.
 *
 * That gets us the actual CSS, the actual fonts (the @font-face URLs inside
 * those stylesheets resolve against their own origin) and therefore the actual
 * layout. The CMS then injects token values on top, which is exactly how the
 * real build works.
 *
 * Scripts are removed: the saved markup is server-rendered, so it displays
 * without JavaScript, and re-running hydration, analytics and the translation
 * widget in a preview only causes trouble.
 *
 *   node scripts/prepare-previews.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS = join(HERE, '..', 'static', 'previews');

const SITES = {
  'ticketing.html': { origin: 'https://tickets.air.shop', cssDir: '/_next/static/chunks/' },
  'vip.html': { origin: 'https://experiences.air.shop', cssDir: '/_next/static/css/' },
};

/**
 * Where a saved asset lives on the live site.
 *
 * "Save page as" flattens every asset into one folder but keeps its filename,
 * and the filename is still the key: experience artwork is named by its asset
 * id, so `2603ac3a-….jpg` is served from the asset host under exactly that
 * name. The rest sit under /assets, with tenant art one level deeper and
 * bundler-hashed imports under _next/static/media.
 *
 * Each rule is a guess, so all of them are emitted: the first becomes the src,
 * the rest ride along in data-cms-fallbacks for the preview to try in turn.
 * That way a filename we classify wrongly still resolves instead of vanishing.
 */
const UUID_ASSET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i;
const IMAGE = /\.(svg|png|jpe?g|webp|gif|avif)$/i;

function assetCandidates(name, origin) {
  const urls = [];
  // Chrome prefixes an underscore when a saved filename would otherwise clash,
  // so "_Abu-Dhabi-yacht.jpg" is really "Abu-Dhabi-yacht.jpg" upstream.
  const names = name.startsWith('_') ? [name.replace(/^_+/, ''), name] : [name];
  for (const n of names) {
    if (n !== name) {
      urls.push(`https://assets.${origin.replace('https://', '')}/${n}`);
      urls.push(`${origin}/assets/${n}`);
      urls.push(`${origin}/_next/static/media/${n}`);
    }
  }
  if (UUID_ASSET.test(name)) urls.push(`https://assets.${origin.replace('https://', '')}/${name}`);
  if (/^moca/i.test(name)) urls.push(`${origin}/assets/moca/${name}`);
  // Bundler-hashed static imports, e.g. music_thumbnail.96a576bb.webp
  if (/\.[0-9a-f]{8}\./i.test(name)) urls.push(`${origin}/_next/static/media/${name}`);
  urls.push(`${origin}/assets/${name}`);
  urls.push(`${origin}/_next/static/media/${name}`);
  urls.push(`https://assets.${origin.replace('https://', '')}/${name}`);
  return [...new Set(urls)];
}

for (const [file, site] of Object.entries(SITES)) {
  let html = readFileSync(join(PREVIEWS, file), 'utf-8');
  const before = html.length;

  // 1. Stylesheets → the live originals, by their real Next.js paths.
  let styles = 0;
  html = html.replace(
    /<link([^>]*?)href="\.?\/?[^"]*?_files\/([^"/]+\.css)"([^>]*?)>/g,
    (_match, pre, name, post) => {
      styles++;
      return `<link${pre}href="${site.origin}${site.cssDir}${name}"${post}>`;
    },
  );

  // 2. Any remaining absolute Next asset paths → the live origin.
  html = html.replace(/(href|src)="\/_next\//g, `$1="${site.origin}/_next/`);

  // 3. Drop scripts. The markup is server-rendered; hydration, analytics and
  //    the translation widget have nothing to offer a static preview.
  const scripts = (html.match(/<script\b/g) || []).length;
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script\b[^>]*\/>/gi, '');

  // 4. Images → their live URLs, with alternates for the preview to fall back on.
  let images = 0;
  html = html.replace(/(<img\b[^>]*?\bsrc=")\.?\/?[^"]*?_files\/([^"]+)"/g, (match, pre, name) => {
    if (!IMAGE.test(name)) return match;
    const urls = assetCandidates(name, site.origin);
    images++;
    return `${pre}${urls[0]}" data-cms-fallbacks="${urls.slice(1).join(' ')}"`;
  });

  // Preload hints for those same images, so the browser does not chase the
  // local folder that no longer exists.
  html = html.replace(/(<link[^>]*?\bhref=")\.?\/?[^"]*?_files\/([^"]+\.(?:svg|png|jpe?g|webp|gif|avif))"/g,
    (_m, pre, name) => `${pre}${assetCandidates(name, site.origin)[0]}"`);

  // 5. Preloads and prefetches pointing at the missing local folder are noise.
  html = html.replace(/<link[^>]*rel="(?:preload|prefetch|modulepreload)"[^>]*_files\/[^>]*>/g, '');

  // 6. The translation widget ships as markup too.
  html = html.replace(/<div id="localize-widget"[\s\S]*?<\/div>\s*<\/div>/g, '');

  writeFileSync(join(PREVIEWS, file), html, 'utf-8');
  console.log(
    `${file}: ${styles} stylesheet(s) + ${images} image(s) → live URLs, ${scripts} script(s) removed ` +
      `(${Math.round(before / 1024)}KB → ${Math.round(html.length / 1024)}KB)`,
  );
}
