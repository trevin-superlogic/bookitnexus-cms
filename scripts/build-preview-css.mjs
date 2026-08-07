/**
 * Rebuild the stylesheet a saved page needs, from the page itself.
 *
 * A browser "save page as" gives you the HTML but the CSS lands in a sibling
 * folder that is easy to lose — and without it the Ticketing page is unstyled
 * text. Every class it uses is a Tailwind v4 utility, and Tailwind utilities are
 * mechanical: `gap-universal-4xs` is `gap: var(--spacing-universal-4xs)`,
 * `text-(--color-x)` is `color: var(--color-x)`. So the stylesheet can be
 * regenerated from the class list with no guesswork.
 *
 * The output deliberately resolves to our token variables rather than baked
 * values, so the preview is driven by the CMS exactly like the real build is.
 *
 *   node scripts/build-preview-css.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREVIEWS = join(HERE, '..', 'static', 'previews');

/** Tailwind's default breakpoints. */
const SCREENS = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' };

/** Tailwind numeric spacing: 1 unit = 0.25rem. */
const num = (n) => `${Number(n) * 0.25}rem`;

const SIZE_WORDS = { full: '100%', screen: '100vw', max: 'max-content', min: 'min-content', auto: 'auto' };
const MAX_W = { sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem', '2xl': '42rem', '6xl': '72rem', full: '100%' };

/** Escape a class name for use in a CSS selector. */
const esc = (cls) =>
  '.' +
  cls.replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);

/** Arbitrary value in brackets: "[18px]" → "18px", "[85vw]" → "85vw". */
const bracket = (s) => (s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1).replace(/_/g, ' ') : null);

/** A length token: number, bracketed value, or keyword. */
function len(value) {
  const b = bracket(value);
  if (b) return b;
  if (SIZE_WORDS[value]) return SIZE_WORDS[value];
  if (/^\d+(\.\d+)?$/.test(value)) return num(value);
  if (/^\d+\/\d+$/.test(value)) {
    const [a, c] = value.split('/').map(Number);
    return `${((a / c) * 100).toFixed(4)}%`;
  }
  return null;
}

/** "(--color-x)" or "(--color-x)/65" → "var(--color-x)" plus optional alpha. */
function varRef(value) {
  const m = /^\((--[a-z0-9-]+)\)(?:\/(\d+))?$/.exec(value);
  if (!m) return null;
  return { ref: `var(${m[1]})`, alpha: m[2] ? Number(m[2]) / 100 : null };
}

/** Token-scale helpers. */
const spacing = (name) => `var(--spacing-${name})`;
const typeSize = (name) => `var(--type-size-${name})`;
const lineHeight = (name) => `var(--type-line-height-${name})`;

const SPACING_SIDES = {
  p: ['padding'],
  px: ['padding-left', 'padding-right'],
  py: ['padding-top', 'padding-bottom'],
  pt: ['padding-top'],
  pb: ['padding-bottom'],
  pl: ['padding-left'],
  pr: ['padding-right'],
  m: ['margin'],
  mx: ['margin-left', 'margin-right'],
  my: ['margin-top', 'margin-bottom'],
  mt: ['margin-top'],
  mb: ['margin-bottom'],
  ml: ['margin-left'],
  mr: ['margin-right'],
};

const STATIC = {
  flex: 'display:flex',
  'inline-flex': 'display:inline-flex',
  block: 'display:block',
  'inline-block': 'display:inline-block',
  inline: 'display:inline',
  grid: 'display:grid',
  hidden: 'display:none',
  contents: 'display:contents',
  'flex-col': 'flex-direction:column',
  'flex-row': 'flex-direction:row',
  'flex-wrap': 'flex-wrap:wrap',
  'flex-1': 'flex:1 1 0%',
  'shrink-0': 'flex-shrink:0',
  'grow-0': 'flex-grow:0',
  'items-center': 'align-items:center',
  'items-start': 'align-items:flex-start',
  'items-end': 'align-items:flex-end',
  'align-center': 'align-items:center',
  'justify-center': 'justify-content:center',
  'justify-between': 'justify-content:space-between',
  'justify-end': 'justify-content:flex-end',
  'justify-start': 'justify-content:flex-start',
  relative: 'position:relative',
  absolute: 'position:absolute',
  fixed: 'position:fixed',
  sticky: 'position:sticky',
  'inset-0': 'inset:0',
  'top-0': 'top:0',
  'bottom-0': 'bottom:0',
  'left-0': 'left:0',
  'right-0': 'right:0',
  'top-1/2': 'top:50%',
  '-translate-y-1/2': 'transform:translateY(-50%)',
  'mx-auto': 'margin-left:auto;margin-right:auto',
  'overflow-hidden': 'overflow:hidden',
  'overflow-x-auto': 'overflow-x:auto',
  'overflow-y-hidden': 'overflow-y:hidden',
  'overscroll-x-contain': 'overscroll-behavior-x:contain',
  'scroll-smooth': 'scroll-behavior:smooth',
  'scrollbar-hide': 'scrollbar-width:none',
  'text-center': 'text-align:center',
  'text-nowrap': 'white-space:nowrap',
  'whitespace-nowrap': 'white-space:nowrap',
  'leading-none': 'line-height:1',
  antialiased: '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale',
  'cursor-pointer': 'cursor:pointer',
  'pointer-events-none': 'pointer-events:none',
  'outline-none': 'outline:none',
  'object-cover': 'object-fit:cover',
  'aspect-square': 'aspect-ratio:1/1',
  'bg-cover': 'background-size:cover',
  'bg-center': 'background-position:center',
  'bg-no-repeat': 'background-repeat:no-repeat',
  border: 'border-width:1px;border-style:solid',
  'border-0': 'border-width:0',
  'border-b': 'border-bottom-width:1px;border-bottom-style:solid',
  'border-t': 'border-top-width:1px;border-top-style:solid',
  'p-0': 'padding:0',
  transition: 'transition:color .15s,background-color .15s,border-color .15s,transform .15s,opacity .15s',
  'transition-all': 'transition:all .3s',
  'transition-transform': 'transition:transform .3s',
  'transition-[max-width]': 'transition:max-width .3s',
  'duration-300': 'transition-duration:.3s',
  'ease-out': 'transition-timing-function:cubic-bezier(0,0,.2,1)',
  'shadow-lg': 'box-shadow:0 10px 15px -3px rgb(0 0 0/.1),0 4px 6px -4px rgb(0 0 0/.1)',
  'text-shadow-md': 'text-shadow:0 2px 4px rgb(0 0 0/.25)',
  'text-shadow-lg': 'text-shadow:0 4px 8px rgb(0 0 0/.3)',
  'line-clamp-2': 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden',
  'w-full': 'width:100%',
  'w-max': 'width:max-content',
  'h-full': 'height:100%',
  'size-full': 'width:100%;height:100%',
  'min-h-screen': 'min-height:100vh',
  container: 'width:100%;margin-inline:auto;padding-inline:1rem',
  'to-transparent': '--tw-gradient-to:transparent',
  'via-transparent': '--tw-gradient-via:transparent',
  'opacity-70': 'opacity:.7',
  group: '',
  lucide: '',
  notranslate: '',
  'accent-nav-item': '',
  'section-heading': '',
  'hero-container': 'position:relative;width:100%',
  'hero-heading': 'font-family:var(--type-family-heading,inherit)',
  'bg-card': 'background-color:var(--color-surface-layer-card,#fff)',
  'text-card-foreground': 'color:var(--color-text-icons-primary-default,#111)',
  'localize-dark': '',
  'localize-right-center': '',
};

/** One utility → CSS declarations, or null if unrecognised. */
function declarations(cls) {
  if (cls in STATIC) return STATIC[cls];

  // Font module classes emitted by next/font.
  if (/^(poppins|dm_sans|rethink_sans|inter)_/.test(cls)) {
    return 'font-family:var(--type-family-body,inherit)';
  }

  // z-index
  let m = /^-?z-(\d+)$/.exec(cls);
  if (m) return `z-index:${cls.startsWith('-') ? '-' : ''}${m[1]}`;

  // Arbitrary-value colour utilities: text-(--x), bg-(--x), border-(--x)
  m = /^(text|bg|border|from|via|to)-(\(.+\)(?:\/\d+)?)$/.exec(cls);
  if (m) {
    const ref = varRef(m[2]);
    if (ref) {
      const value = ref.alpha === null ? ref.ref : `color-mix(in srgb, ${ref.ref} ${ref.alpha * 100}%, transparent)`;
      if (m[1] === 'text') return `color:${value}`;
      if (m[1] === 'bg') return `background-color:${value}`;
      if (m[1] === 'border') return `border-color:${value}`;
      return `--tw-gradient-${m[1]}:${value}`;
    }
  }

  // Radius: rounded-(--x), rounded-tl-(--x), rounded-radius-universal-xl
  m = /^rounded(-(tl|tr|bl|br))?-(\(.+\))$/.exec(cls);
  if (m) {
    const ref = varRef(m[3]);
    if (ref) {
      const corner = { tl: 'border-top-left-radius', tr: 'border-top-right-radius', bl: 'border-bottom-left-radius', br: 'border-bottom-right-radius' };
      return `${m[2] ? corner[m[2]] : 'border-radius'}:${ref.ref}`;
    }
  }
  m = /^rounded-radius-universal-(.+)$/.exec(cls);
  if (m) return `border-radius:var(--radius-universal-${m[1]},${m[1] === 'max' ? '9999px' : '12px'})`;
  if (cls === 'rounded-full') return 'border-radius:9999px';

  // Gradients
  m = /^bg-linear-to-([a-z]{1,2})$/.exec(cls);
  if (m) {
    const dir = { l: 'to left', r: 'to right', t: 'to top', b: 'to bottom', tr: 'to top right', tl: 'to top left' }[m[1]] ?? 'to right';
    return `background-image:linear-gradient(${dir},var(--tw-gradient-from,transparent),var(--tw-gradient-via,var(--tw-gradient-from,transparent)),var(--tw-gradient-to,transparent))`;
  }

  // Spacing scale — gap / padding / margin / space-y, all token-backed.
  m = /^gap-(universal-.+)$/.exec(cls);
  if (m) return `gap:${spacing(m[1])}`;
  m = /^gap-([xy])-(universal-.+)$/.exec(cls);
  if (m) return `${m[1] === 'x' ? 'column-gap' : 'row-gap'}:${spacing(m[2])}`;
  m = /^(-)?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(universal-.+)$/.exec(cls);
  if (m) {
    const value = `${m[1] ? 'calc(-1 * ' : ''}${spacing(m[3])}${m[1] ? ')' : ''}`;
    return SPACING_SIDES[m[2]].map((prop) => `${prop}:${value}`).join(';');
  }
  m = /^space-y-(universal-.+)$/.exec(cls);
  if (m) return { child: `margin-top:${spacing(m[1])}` };
  m = /^left-(universal-.+)$/.exec(cls);
  if (m) return `left:${spacing(m[1])}`;

  // Type scale
  m = /^text-(body|heading|label|menu)-(.+)$/.exec(cls);
  if (m) return `font-size:${typeSize(`${m[1]}-${m[2]}`)};line-height:${lineHeight(`${m[1]}-${m[2]}`)}`;
  m = /^leading-(body|heading|label|menu)-(.+)$/.exec(cls);
  if (m) return `line-height:${lineHeight(`${m[1]}-${m[2]}`)}`;
  m = /^(font|leading|text)-(\(.+\))$/.exec(cls);
  if (m) {
    const ref = varRef(m[2]);
    if (ref) return m[1] === 'leading' ? `line-height:${ref.ref}` : `font-size:${ref.ref}`;
  }
  m = /^font-(heading|body|label|menu)-(primary|secondary|tertiary)$/.exec(cls);
  if (m) return `font-family:var(--type-family-${m[1]},inherit);font-weight:var(--type-weight-${m[1]}-${m[2]},600)`;

  // Sizing
  m = /^size-(.+)$/.exec(cls);
  if (m) {
    const value = len(m[1]);
    if (value) return `width:${value};height:${value}`;
  }
  m = /^(w|h|min-w|min-h|max-w|max-h)-(.+)$/.exec(cls);
  if (m) {
    const prop = { w: 'width', h: 'height', 'min-w': 'min-width', 'min-h': 'min-height', 'max-w': 'max-width', 'max-h': 'max-height' }[m[1]];
    if (m[2].startsWith('layout-')) return `${prop}:var(--${m[2]})`;
    const value = MAX_W[m[2]] && m[1] === 'max-w' ? MAX_W[m[2]] : len(m[2]);
    if (value) return `${prop}:${value}`;
  }

  // Transforms used for hover polish
  if (cls === 'scale-102') return 'transform:scale(1.02)';
  if (cls === 'scale-105') return 'transform:scale(1.05)';
  if (cls === '-translate-y-px') return 'transform:translateY(-1px)';
  m = /^shadow-\[(.+)\]$/.exec(cls);
  if (m) return `box-shadow:${m[1].replace(/_/g, ' ')}`;

  return null;
}

/** Turn one class (with any variants) into a CSS rule. */
function rule(cls) {
  let selector = esc(cls);
  let rest = cls;
  let media = null;
  let pseudo = '';
  let prefix = '';

  const variants = [];
  // Peel variants off the front: md:, hover:, group-hover:, max-md:, focus:
  const parts = rest.split(':');
  if (parts.length > 1) {
    const utility = parts.pop();
    for (const variant of parts) variants.push(variant);
    rest = utility;
  }

  for (const variant of variants) {
    if (SCREENS[variant]) media = `@media (min-width:${SCREENS[variant]})`;
    else if (variant.startsWith('max-') && SCREENS[variant.slice(4)]) {
      media = `@media (max-width:calc(${SCREENS[variant.slice(4)]} - 0.02px))`;
    } else if (variant === 'hover') pseudo += ':hover';
    else if (variant === 'focus') pseudo += ':focus';
    else if (variant === 'focus-visible') pseudo += ':focus-visible';
    else if (variant === 'disabled') pseudo += ':disabled';
    else if (variant === 'group-hover') prefix = '.group:hover ';
    else return null; // data-[…], [&_svg] and friends: skipped deliberately
  }

  const decls = declarations(rest);
  if (decls === null) return null;

  let body;
  if (typeof decls === 'object' && decls.child) {
    body = `${prefix}${selector}${pseudo} > * + * {${decls.child}}`;
  } else {
    if (decls === '') return null;
    body = `${prefix}${selector}${pseudo} {${decls}}`;
  }
  return media ? `${media}{${body}}` : body;
}

// ── Build ────────────────────────────────────────────────────────────────────

const BASE = `
/* Reset and page defaults, matching the app shell. */
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:var(--type-family-body,system-ui,sans-serif);
  background:var(--color-surface-layer-page,#fff);color:var(--color-text-icons-primary-default,#111)}
h1,h2,h3,h4,p{margin:0}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0}
svg{display:block}
.scrollbar-hide::-webkit-scrollbar{display:none}
ul,ol{margin:0;padding:0;list-style:none}
img{max-width:100%}
`;

/**
 * Utilities whose Tailwind syntax is arbitrary-selector rather than mechanical
 * (`[&_svg]:shrink-0`, `data-[orientation=…]`). Few enough to hand-write, and
 * each one is load-bearing for how the page actually looks.
 */
const EXTRA = `
[class*="[&_svg]:shrink-0"] svg{flex-shrink:0}
[class*="[&_svg]:pointer-events-none"] svg{pointer-events:none}
[class*="size-"] svg:not([class*="size-"]){width:1rem;height:1rem}
.border-transparent{border-color:transparent}
[class*="disabled:opacity-50"]:disabled{opacity:.5}
[class*="disabled:pointer-events-none"]:disabled{pointer-events:none}
[data-orientation="horizontal"]{height:1px;width:100%}
[data-orientation="vertical"]{width:1px;height:100%}
.custom-title{font-family:var(--type-family-heading,inherit)}
/* Nav accent underline, from the app's own stylesheet. */
.accent-nav-item:hover{color:var(--color-text-icons-component-nav-items-level-1-hover,inherit)}
.section-heading{font-family:var(--type-family-heading,inherit);font-weight:var(--type-weight-heading-primary,700)}
`;

function build(file, out) {
  const html = readFileSync(join(PREVIEWS, file), 'utf-8');
  const classes = new Set();
  for (const match of html.matchAll(/class="([^"]{1,800})"/g)) {
    for (const token of match[1].replace(/&amp;/g, '&').split(/\s+/)) if (token) classes.add(token);
  }

  const rules = [];
  const skipped = [];
  for (const cls of [...classes].sort()) {
    const css = rule(cls);
    if (css) rules.push(css);
    else skipped.push(cls);
  }

  writeFileSync(
    join(PREVIEWS, out),
    `/* Generated by scripts/build-preview-css.mjs — do not edit.\n   Rebuilds the utility CSS ${file} needs, resolved against CMS token variables. */\n${BASE}\n${EXTRA}\n${rules.join('\n')}\n`,
    'utf-8',
  );
  console.log(`${file}: ${classes.size} classes → ${rules.length} rules written to ${out}`);
  if (skipped.length) console.log(`  skipped (no visual effect or unsupported): ${skipped.length}`);
  return skipped;
}

// Only the Tailwind page needs this. VIP is Chakra with ~95KB of its own CSS
// inline; it renders from that plus the tokens the preview injects.
build('ticketing.html', 'ticketing.generated.css');
