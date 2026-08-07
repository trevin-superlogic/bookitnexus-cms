/**
 * Usage examples — "where does this variable show up in the product?"
 *
 * Every example is lifted from the shipped sites, not invented. The Ticketing
 * app is Tailwind v4 referencing our variables directly
 * (`bg-(--color-control-primary-emphasized-bg-default)`), so its components can
 * be reproduced faithfully; VIP is Chakra, so its examples are rebuilt from the
 * same variables it consumes.
 *
 * The governing rule: **a preview always renders using the variable being
 * edited**, never a fixed sibling. Opening `control/primary/bg/hover` shows the
 * button painted with the hover set; opening `…/bg/disabled` shows the disabled
 * one. Without that, every row in a family renders identically and the panel
 * teaches nothing about what is actually being changed.
 *
 * Values come from CSS custom properties supplied by the caller — the tenant's
 * current values including unsaved edits — so a preview updates as you type.
 * Every var() carries a fallback so previews still render before a tenant has
 * published, or when a variable lives in the Foundation document.
 */
import { Text } from '@sanity/ui';

export type Product = 'Ticketing' | 'VIP';

export interface Example {
  product: Product;
  /** Component name as it reads in the product, e.g. "Event card". */
  name: string;
  /** The state being shown, when it isn't the resting one. */
  state?: string;
  node: React.ReactNode;
}

// ── Shared bits ──────────────────────────────────────────────────────────────

const v = (name: string, fallback: string) => `var(${name}, ${fallback})`;

/**
 * Try several variable names in order.
 *
 * Used for two things: falling back from a state to its resting value
 * (`…-bg-hover` → `…-bg-default`), and spanning the control rename the shipped
 * sites have not caught up with (`…-secondary-default-…` →
 * `…-secondary-filled-default-…`).
 */
const vv = (names: string[], fallback: string): string =>
  names.reduceRight((inner, name) => `var(${name}, ${inner})`, fallback);

const ring: React.CSSProperties = {
  outline: '2px dashed rgba(34,118,252,0.55)',
  outlineOffset: 3,
  borderRadius: 6,
};
const ringIf = (on: boolean): React.CSSProperties => (on ? ring : {});

const MapPin = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const Calendar = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M8 2v4" /><path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />
  </svg>
);

const Search = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />
  </svg>
);

const STATES = ['default', 'hover', 'active', 'selected', 'pressed', 'focus', 'disabled', 'subtle', 'emphasized'];

/** Split a variable into its state suffix, e.g. "…-bg-hover" → "hover". */
function splitState(name: string): { stem: string; state: string } {
  for (const state of STATES) {
    if (name.endsWith(`-${state}`)) return { stem: name.slice(0, -(state.length + 1)), state };
  }
  return { stem: name, state: 'default' };
}

const caption = (state: string) => (state === 'default' ? undefined : state);

// ── Controls ─────────────────────────────────────────────────────────────────

/**
 * Any control token → the real button, painted in that token's own state.
 *
 * `--color-control-primary-emphasized-bg-hover` yields base
 * `--color-control-primary-emphasized` and state `hover`, so the button is
 * rendered with the hover background, border and label together — which is
 * what the user sees on the site when hovering.
 */
function controlExample(cssVar: string): Example | null {
  const m = /^(--color-control-.+?)-(bg|border|label-icons)-(\w+)$/.exec(cssVar);
  if (!m) return null;
  const [, base, prop, state] = m;

  const bg = vv([`${base}-bg-${state}`, `${base}-bg-default`], '#022647');
  const border = vv([`${base}-border-${state}`, `${base}-border-default`], 'transparent');
  const fg = vv(
    [`${base}-label-icons-${state}`, `${base}-label-icons-default`, '--color-text-icons-inverse-default'],
    '#fff',
  );

  const isPrimary = base.includes('primary');
  const label = isPrimary ? 'Search' : base.includes('tertiary') ? 'See all events' : 'All events';

  return {
    product: 'Ticketing',
    name: isPrimary ? 'Primary CTA' : base.includes('tertiary') ? 'Tertiary action' : 'Secondary button',
    state: caption(state),
    node: (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          padding: `${v('--spacing-universal-xs', '10px')} ${v('--spacing-universal-s', '16px')}`,
          borderRadius: v('--radius-component-button-all-corners', '8px'),
          background: bg,
          color: fg,
          border: `1px solid ${border}`,
          fontSize: 13.5,
          fontWeight: 600,
          // The ring marks the property actually being edited.
          ...(prop === 'border' ? ring : {}),
          ...(prop === 'bg' ? { boxShadow: '0 0 0 3px rgba(34,118,252,0.18)' } : {}),
        }}
      >
        {isPrimary ? <Search /> : null}
        <span style={prop === 'label-icons' ? ring : undefined}>{label}</span>
      </span>
    ),
  };
}

/** The settings switch, rendered in the state the variable belongs to. */
function switchExample(cssVar: string): Example | null {
  if (!cssVar.includes('control-switch')) return null;
  const on = !cssVar.includes('track-default');
  const track = cssVar.includes('track')
    ? cssVar
    : on
      ? '--color-control-switch-track-active'
      : '--color-control-switch-track-default';
  const thumb = cssVar.includes('thumb') ? cssVar : '--color-control-switch-thumb-bg';
  return {
    product: 'VIP',
    name: 'Toggle',
    state: on ? 'on' : 'off',
    node: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 46,
            height: 26,
            borderRadius: 999,
            background: v(track, on ? '#0f172a' : '#cbd2da'),
            position: 'relative',
            display: 'block',
            ...(cssVar.includes('track') ? ring : {}),
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: on ? 23 : 3,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: v(thumb, '#fff'),
              display: 'block',
              ...(cssVar.includes('thumb') ? ring : {}),
            }}
          />
        </span>
        <span style={{ fontSize: 13, color: v('--color-text-icons-primary-default', '#111') }}>Email me about drops</span>
      </div>
    ),
  };
}

// ── Cards, text, surfaces ────────────────────────────────────────────────────

/** The event card, with the edited variable plugged into its own slot. */
function cardExample(cssVar: string, slot: 'bg' | 'border' | 'title' | 'meta'): Example {
  const { state } = splitState(cssVar);
  return {
    product: 'Ticketing',
    name: 'Event card',
    state: caption(state),
    node: (
      <div
        style={{
          width: 268,
          padding: 12,
          borderRadius: v('--radius-component-card-all-corners', '10px'),
          background: slot === 'bg' ? v(cssVar, '#fff') : v('--color-surface-layer-card', '#fff'),
          border: `1px solid ${slot === 'border' ? v(cssVar, 'rgba(0,0,0,0.08)') : v('--color-border-default', 'rgba(0,0,0,0.08)')}`,
          ...ringIf(slot === 'bg' || slot === 'border'),
        }}
      >
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.35,
            marginBottom: 8,
            color: slot === 'title' ? v(cssVar, '#111') : v('--color-text-icons-primary-default', '#111'),
            ...ringIf(slot === 'title'),
          }}
        >
          My Chemical Romance with Franz Ferdinand
        </div>
        <div style={{ display: 'grid', gap: 4, ...ringIf(slot === 'meta') }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: slot === 'meta' ? v(cssVar, '#6b7280') : v('--color-text-icons-tertiary-default', '#6b7280') }}>
            <MapPin /> <span>Citi Field · Flushing, NY</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: slot === 'meta' ? v(cssVar, '#6b7280') : v('--color-text-icons-tertiary-default', '#6b7280') }}>
            <Calendar /> <span>Aug 9th, ’26 6:00 PM</span>
          </div>
        </div>
      </div>
    ),
  };
}

/** "Popular near United States" — the brand-coloured span. */
function headingExample(cssVar: string): Example {
  const { state } = splitState(cssVar);
  return {
    product: 'Ticketing',
    name: 'Section heading',
    state: caption(state),
    node: (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: v('--color-text-icons-tertiary-default', '#6b7280') }}>
          Popular near <span style={{ color: v(cssVar, '#022647'), ...ring }}>United States</span>
        </div>
      </div>
    ),
  };
}

/** The hero search field. */
function searchExample(cssVar: string): Example {
  const { state } = splitState(cssVar);
  return {
    product: 'Ticketing',
    name: 'Search bar',
    state: caption(state),
    node: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: 280,
          padding: '10px 12px',
          borderRadius: v('--radius-component-searchbar-all-corners', '999px'),
          background: v(cssVar, '#fff'),
          border: `1px solid ${v('--color-border-default', 'rgba(0,0,0,0.12)')}`,
          color: v('--color-text-icons-tertiary-default', '#6b7280'),
          fontSize: 13.5,
          ...ring,
        }}
      >
        <Search /> <span>Search events, artists, teams</span>
      </div>
    ),
  };
}

/** VIP experience tags — the edited slot is filled by the edited variable. */
function attributeExample(cssVar: string): Example {
  const m = /attribute-(\w+)-(bg|border)/.exec(cssVar);
  const which = m?.[1] ?? '1';
  const slot = m?.[2] ?? 'bg';
  const labels: Record<string, string> = { '1': 'Meet & greet', '2': 'Sweepstakes', '3': 'VIP', subtle: 'Presale' };
  return {
    product: 'VIP',
    name: 'Experience tag',
    node: (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {['1', '2', '3', 'subtle'].map((n) => {
          const isTarget = n === which;
          return (
            <span
              key={n}
              style={{
                padding: '5px 11px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: isTarget && slot === 'bg' ? v(cssVar, '#f89e28') : v(`--color-attribute-${n}-bg`, '#e6e8ec'),
                border: `1px solid ${isTarget && slot === 'border' ? v(cssVar, 'transparent') : v(`--color-attribute-${n}-border`, 'transparent')}`,
                color: v('--color-text-icons-inverse-default', '#fff'),
                opacity: isTarget ? 1 : 0.45,
                ...ringIf(isTarget),
              }}
            >
              {labels[n] ?? n}
            </span>
          );
        })}
      </div>
    ),
  };
}

/** Status messaging — the edited status is the one lit up. */
function feedbackExample(cssVar: string): Example {
  const m = /feedback-(\w+)/.exec(cssVar);
  const which = m?.[1] ?? 'success';
  const labels: Record<string, string> = {
    success: 'Entry confirmed',
    attention: 'Closing soon',
    error: 'Sold out',
    warning: 'Payment needs attention',
  };
  const all = ['success', 'attention', 'error', 'warning'].filter((k) => k === which || ['success', 'attention', 'error'].includes(k));
  return {
    product: 'VIP',
    name: 'Status message',
    node: (
      <div style={{ display: 'grid', gap: 6 }}>
        {all.map((kind) => {
          const isTarget = kind === which;
          return (
            <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, opacity: isTarget ? 1 : 0.4, ...ringIf(isTarget) }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: isTarget ? v(cssVar, '#21d466') : v(`--color-feedback-${kind}`, '#ccc'),
                  display: 'block',
                }}
              />
              <span style={{ color: v('--color-text-icons-secondary-default', '#45505b') }}>{labels[kind]}</span>
            </div>
          );
        })}
      </div>
    ),
  };
}

/** The gradient scrim over rail artwork. */
function overlayExample(cssVar: string): Example {
  return {
    product: 'Ticketing',
    name: 'Media overlay',
    node: (
      <div style={{ position: 'relative', width: 220, height: 92, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(120deg,#5b6b7f,#2b3542)', ...ring }}>
        <div style={{ position: 'absolute', inset: 0, background: v(cssVar, 'rgba(0,0,0,0.35)') }} />
        <div style={{ position: 'absolute', left: 12, bottom: 10, color: v('--color-text-icons-inverse-default', '#fff'), fontSize: 13, fontWeight: 600 }}>
          Tonight’s picks
        </div>
      </div>
    ),
  };
}


// ── Named components ─────────────────────────────────────────────────────────
// These variables name a specific piece of UI, so the preview shows that piece
// rather than a generic card. Where the shipped markup was available it was
// followed; the seat map and calendar are simplified but structurally true.

/** Event date picker — the month grid on an event page. */
function calendarExample(cssVar: string): Example {
  const { state } = splitState(cssVar);
  const cell = (n: number, kind: 'default' | 'hover' | 'selected') => {
    const isTarget = kind === state || (state === 'default' && kind === 'default');
    const bg =
      kind === state
        ? v(cssVar, '#eef1f4')
        : v(`--color-component-calendar-cell-${kind}`, kind === 'selected' ? '#022647' : '#f4f6f8');
    return (
      <span
        key={`${kind}-${n}`}
        style={{
          width: 26,
          height: 24,
          borderRadius: 5,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          background: bg,
          color:
            kind === 'selected'
              ? v('--color-text-icons-inverse-default', '#fff')
              : v('--color-text-icons-primary-default', '#111'),
          ...ringIf(isTarget && kind === state),
        }}
      >
        {n}
      </span>
    );
  };
  return {
    product: 'Ticketing',
    name: 'Date picker',
    state: caption(state),
    node: (
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 11.5, opacity: 0.6, letterSpacing: '0.04em' }}>AUGUST 2026</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 26px)', gap: 4 }}>
          {[3, 4, 5, 6, 7].map((n) => cell(n, 'default'))}
          {cell(8, 'hover')}
          {cell(9, 'selected')}
          {[10, 11, 12, 13, 14, 15, 16].map((n) => cell(n, 'default'))}
        </div>
      </div>
    ),
  };
}

/** Seat map — the tiered venue widget on a ticket page. */
function seatMapExample(cssVar: string): Example {
  const tier = /map-tier-(\d)/.exec(cssVar)?.[1];
  const isLabel = cssVar.includes('map-cell-label');
  const isWidget = cssVar.includes('map-widget') || cssVar.includes('maps-');
  const blocks: Array<{ t: string; x: number; y: number; w: number; h: number }> = [
    { t: '1', x: 62, y: 46, w: 76, h: 26 },
    { t: '2', x: 30, y: 20, w: 44, h: 22 },
    { t: '2', x: 126, y: 20, w: 44, h: 22 },
    { t: '3', x: 12, y: 50, w: 42, h: 30 },
    { t: '3', x: 146, y: 50, w: 42, h: 30 },
    { t: '4', x: 40, y: 86, w: 56, h: 22 },
    { t: '5', x: 104, y: 86, w: 56, h: 22 },
  ];
  return {
    product: 'Ticketing',
    name: isLabel ? 'Seat map label' : isWidget ? 'Seat map widget' : `Seat map · tier ${tier ?? ''}`.trim(),
    node: (
      <div
        style={{
          position: 'relative',
          width: 208,
          height: 124,
          padding: 6,
          background: v('--color-surface-layer-card', '#fff'),
          borderTop: `1px solid ${v('--border-component-map-widget-t', 'rgba(0,0,0,0.1)')}`,
          borderRight: `1px solid ${v('--border-component-map-widget-r', 'rgba(0,0,0,0.1)')}`,
          borderBottom: `1px solid ${v('--border-component-map-widget-b', 'rgba(0,0,0,0.1)')}`,
          borderLeft: `1px solid ${v('--border-component-map-widget-l', 'rgba(0,0,0,0.1)')}`,
          borderTopLeftRadius: v('--radius-component-map-widget-tl', '10px'),
          borderTopRightRadius: v('--radius-component-map-widget-tr', '10px'),
          borderBottomLeftRadius: v('--radius-component-map-widget-bl', '10px'),
          borderBottomRightRadius: v('--radius-component-map-widget-br', '10px'),
          ...ringIf(isWidget),
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 62,
            top: 8,
            width: 76,
            height: 9,
            borderRadius: 3,
            background: v('--color-component-divider-default', '#d7dbe0'),
          }}
        />
        {blocks.map((b, i) => {
          const isTarget = tier === b.t;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: b.x,
                top: b.y + 14,
                width: b.w,
                height: b.h,
                borderRadius: 4,
                background: isTarget ? v(cssVar, '#888') : v(`--color-component-map-tier-${b.t}`, '#c9ced6'),
                opacity: tier && !isTarget ? 0.35 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: isLabel ? v(cssVar, '#fff') : v('--color-text-icons-component-map-cell-label', '#fff'),
                ...ringIf(Boolean(isTarget) || (isLabel && i === 0)),
              }}
            >
              {b.t === '1' ? 'FLOOR' : `T${b.t}`}
            </div>
          );
        })}
      </div>
    ),
  };
}

/** Primary navigation — the category bar across the top of the site. */
function navExample(cssVar: string): Example {
  const { state } = splitState(cssVar);
  const level2 = cssVar.includes('level-2');
  const isBg = cssVar.includes('nav-primary-bg');
  const items: Array<[string, string]> = [
    ['Concerts', 'default'],
    ['Sports', 'hover'],
    ['Theater', 'activated'],
    ['Festivals', 'disabled'],
  ];
  return {
    product: 'Ticketing',
    name: level2 ? 'Sub-navigation' : 'Primary navigation',
    state: caption(state),
    node: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 14px',
          borderRadius: 8,
          background: isBg ? v(cssVar, '#fff') : v('--color-component-nav-primary-bg', '#fff'),
          ...ringIf(isBg),
        }}
      >
        {items.map(([label, itemState]) => {
          const level = level2 ? 'level-2' : 'level-1';
          const isTarget = itemState === state;
          return (
            <span
              key={label}
              style={{
                fontSize: 13,
                fontWeight: itemState === 'activated' ? 700 : 500,
                color: isTarget
                  ? v(cssVar, '#111')
                  : v(`--color-text-icons-component-nav-items-${level}-${itemState}`, '#4b5563'),
                opacity: itemState === 'disabled' ? 0.55 : 1,
                ...ringIf(isTarget),
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    ),
  };
}

/** Ticket listing rows — the results list beside the seat map. */
function listRowExample(cssVar: string): Example {
  const isHover = cssVar.includes('hover');
  const subtle = cssVar.includes('subtle');
  return {
    product: 'Ticketing',
    name: 'Ticket list',
    state: isHover ? 'hover' : undefined,
    node: (
      <div style={{ width: 250, borderRadius: 8, overflow: 'hidden', border: `1px solid ${v('--color-border-default', 'rgba(0,0,0,0.08)')}` }}>
        {[
          ['Sec 104 · Row F', '$182', false],
          ['Sec 112 · Row B', '$210', true],
          ['Sec 201 · Row K', '$96', false],
        ].map(([label, price, isTargetRow]) => (
          <div
            key={label as string}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 11px',
              fontSize: 12.5,
              background: isTargetRow
                ? v(cssVar, '#f2f5f8')
                : v(subtle ? '--color-component-list-row-subtle-default' : '--color-component-list-row-default', '#fff'),
              color: v('--color-text-icons-primary-default', '#111'),
              borderBottom: `1px solid ${v('--color-component-divider-subtle', 'rgba(0,0,0,0.06)')}`,
              ...ringIf(Boolean(isTargetRow)),
            }}
          >
            <span>{label}</span>
            <span style={{ fontWeight: 600 }}>{price}</span>
          </div>
        ))}
      </div>
    ),
  };
}

/** Order summary table. */
function tableExample(cssVar: string): Example {
  const isHeader = cssVar.includes('header');
  const isDivider = cssVar.includes('divider');
  return {
    product: 'VIP',
    name: 'Order table',
    node: (
      <div style={{ width: 250, borderRadius: 8, overflow: 'hidden', border: `1px solid ${v('--color-border-default', 'rgba(0,0,0,0.08)')}` }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 11px',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.04em',
            background: isHeader ? v(cssVar, '#eef1f4') : v('--color-component-table-header', '#eef1f4'),
            color: v('--color-text-icons-secondary-default', '#45505b'),
            ...ringIf(isHeader),
          }}
        >
          <span>ITEM</span>
          <span>TOTAL</span>
        </div>
        {[
          ['2 × GA ticket', '$364'],
          ['Service fee', '$41'],
        ].map(([label, total], i) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '9px 11px',
              fontSize: 12.5,
              background: v('--color-component-table-row', '#fff'),
              color: v('--color-text-icons-primary-default', '#111'),
              borderTop: i === 0 ? undefined : `1px solid ${isDivider ? v(cssVar, 'rgba(0,0,0,0.08)') : v('--color-component-table-divider', 'rgba(0,0,0,0.08)')}`,
              ...ringIf(isDivider && i === 1),
            }}
          >
            <span>{label}</span>
            <span>{total}</span>
          </div>
        ))}
      </div>
    ),
  };
}

/** Price filter — the histogram above the range slider. */
function histogramExample(cssVar: string): Example {
  const isAxis = cssVar.includes('axis');
  const bars = [8, 14, 22, 30, 26, 34, 20, 12, 16, 9];
  return {
    product: 'Ticketing',
    name: 'Price filter',
    node: (
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, ...ringIf(!isAxis) }}>
          {bars.map((h, i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: h,
                borderRadius: '2px 2px 0 0',
                background: isAxis ? v('--color-component-price-filter-histogram-bar', '#9fb2c8') : v(cssVar, '#9fb2c8'),
                display: 'block',
              }}
            />
          ))}
        </div>
        <div style={{ height: 2, background: isAxis ? v(cssVar, '#c9ced6') : v('--color-component-price-filter-histogram-axis', '#c9ced6'), ...ringIf(isAxis) }} />
        <div style={{ fontSize: 11, opacity: 0.6 }}>$40 – $600</div>
      </div>
    ),
  };
}

/** Section divider. */
function dividerExample(cssVar: string): Example {
  const isGradient = cssVar.includes('gradient');
  return {
    product: 'Ticketing',
    name: 'Divider',
    node: (
      <div style={{ width: 260, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 12.5, color: v('--color-text-icons-secondary-default', '#45505b') }}>Recommended for you</div>
        <div
          style={{
            height: isGradient ? 3 : 1,
            background: isGradient
              ? `linear-gradient(90deg, ${v(cssVar, '#d7dbe0')}, transparent)`
              : v(cssVar, '#d7dbe0'),
            ...ring,
          }}
        />
        <div style={{ fontSize: 12.5, opacity: 0.55 }}>More events near you</div>
      </div>
    ),
  };
}

/** Hero artwork — the rounded masthead at the top of an event page. */
function heroExample(cssVar: string): Example {
  return {
    product: 'Ticketing',
    name: 'Hero image',
    node: (
      <div
        style={{
          width: 240,
          height: 84,
          background: 'linear-gradient(120deg,#5b6b7f,#2b3542)',
          borderTopLeftRadius: v('--radius-component-hero-tl', '16px'),
          borderTopRightRadius: v('--radius-component-hero-tr', '16px'),
          borderBottomLeftRadius: v('--radius-component-hero-bl', '0px'),
          borderBottomRightRadius: v('--radius-component-hero-br', '0px'),
          display: 'flex',
          alignItems: 'flex-end',
          padding: 12,
          color: v('--color-text-icons-inverse-default', '#fff'),
          fontSize: 13,
          fontWeight: 700,
          ...ring,
        }}
      >
        My Chemical Romance
      </div>
    ),
  };
}

// ── Specimens (non-colour) ───────────────────────────────────────────────────

function typeExample(cssVar: string): Example {
  const isFamily = cssVar.includes('family');
  const isWeight = cssVar.includes('weight');
  const isLineHeight = cssVar.includes('line-height');
  return {
    product: 'Ticketing',
    name: isFamily ? 'Typeface' : isWeight ? 'Font weight' : isLineHeight ? 'Line height' : 'Type size',
    node: (
      <div style={{ display: 'grid', gap: 6, ...ring }}>
        <div
          style={{
            fontSize: isFamily || isWeight || isLineHeight ? '17px' : v(cssVar, '18px'),
            lineHeight: isLineHeight ? v(cssVar, '1.3') : 1.25,
            fontFamily: isFamily ? v(cssVar, 'inherit') : v('--type-family-heading', 'inherit'),
            fontWeight: isWeight ? (v(cssVar, '600') as unknown as number) : 600,
            color: v('--color-text-icons-primary-default', '#111'),
            maxWidth: 300,
          }}
        >
          Tickets that earn rewards
          {isLineHeight ? <> — on every event, every time you buy</> : null}
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.6 }}>rendered at this variable’s value</div>
      </div>
    ),
  };
}

function spacingExample(cssVar: string): Example {
  return {
    product: 'Ticketing',
    name: 'Spacing',
    node: (
      <div style={{ display: 'grid', gap: 8, ...ring }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: v(cssVar, '8px') }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 44, height: 26, borderRadius: 5, background: v('--color-surface-container-subtle', '#e9edf1'), display: 'block' }} />
          ))}
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.6 }}>gap between elements at this value</div>
      </div>
    ),
  };
}

function radiusExample(cssVar: string): Example {
  return {
    product: 'Ticketing',
    name: 'Corner radius',
    node: (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '10px 16px',
          borderRadius: v(cssVar, '8px'),
          background: vv(['--color-control-secondary-filled-default-bg-default', '--color-control-secondary-default-bg-default'], '#eef1f4'),
          color: v('--color-text-icons-primary-default', '#111'),
          fontSize: 13.5,
          fontWeight: 600,
          ...ring,
        }}
      >
        All events
      </span>
    ),
  };
}

function layoutExample(cssVar: string, label: string): Example {
  return {
    product: 'Ticketing',
    name: label,
    node: (
      <div style={{ display: 'grid', gap: 6, width: '100%', maxWidth: 320 }}>
        <div
          style={{
            height: 34,
            borderRadius: 6,
            background: v('--color-surface-container-subtle', '#e9edf1'),
            border: `1px dashed ${v('--color-border-default', 'rgba(0,0,0,0.2)')}`,
            width: `min(100%, calc(${v(cssVar, '600px')} / 4))`,
            ...ring,
          }}
        />
        <div style={{ fontSize: 11.5, opacity: 0.6 }}>shown at ¼ scale — {label.toLowerCase()}</div>
      </div>
    ),
  };
}

function swatchExample(cssVar: string, isColor: boolean): Example {
  return {
    product: 'Ticketing',
    name: 'Value',
    node: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isColor ? (
          <span style={{ width: 84, height: 54, borderRadius: 8, display: 'block', background: v(cssVar, '#ddd'), border: '1px solid rgba(0,0,0,0.15)', ...ring }} />
        ) : null}
        <div style={{ fontSize: 11.5, opacity: 0.7, fontFamily: 'ui-monospace, Consolas, monospace' }}>{cssVar}</div>
      </div>
    ),
  };
}

// ── Selection ────────────────────────────────────────────────────────────────

/** Choose the example that best shows a variable, in that variable's own state. */
export function pickExample(cssVar: string, isColor: boolean): Example {
  const n = cssVar;
  const has = (...parts: string[]) => parts.every((p) => n.includes(p));

  const sw = switchExample(n);
  if (sw) return sw;
  const control = controlExample(n);
  if (control) return control;

  if (has('calendar')) return calendarExample(n);
  if (has('map-tier') || has('map-cell') || has('map-widget') || has('maps-')) return seatMapExample(n);
  if (has('nav-')) return navExample(n);
  if (has('list-row')) return listRowExample(n);
  if (has('table-')) return tableExample(n);
  if (has('histogram')) return histogramExample(n);
  if (has('divider')) return dividerExample(n);
  if (has('component-hero') || has('-hero-')) return heroExample(n);
  if (has('searchbar')) return searchExample(n);
  if (has('attribute-')) return attributeExample(n);
  if (has('feedback-')) return feedbackExample(n);
  if (has('effect-') || has('overlay')) return overlayExample(n);
  if (has('text-icons-brand')) return headingExample(n);
  if (has('text-icons-tertiary')) return cardExample(n, 'meta');
  if (has('text-icons')) return cardExample(n, 'title');
  if (has('border-')) return cardExample(n, 'border');
  if (has('surface-') || has('component-') || has('container')) return cardExample(n, 'bg');

  if (n.startsWith('--type-')) return typeExample(n);
  if (n.startsWith('--spacing')) return spacingExample(n);
  if (n.startsWith('--radius')) return radiusExample(n);
  if (n.startsWith('--layout-responsive-size')) return typeExample(n);
  if (n.startsWith('--layout-modal')) return layoutExample(n, 'Modal width');
  if (n.startsWith('--layout-container')) return layoutExample(n, 'Container width');
  if (n.startsWith('--layout-breakpoint')) return layoutExample(n, 'Breakpoint width');
  if (n.startsWith('--layout')) return layoutExample(n, 'Layout width');

  return swatchExample(n, isColor);
}

/**
 * The example panel for one variable.
 *
 * `vars` are applied as CSS custom properties on the wrapper, so previews use
 * this tenant's live values — including edits not yet saved.
 */
export function TokenExample({
  cssVar,
  isColor,
  vars,
}: {
  cssVar: string;
  isColor: boolean;
  vars: Record<string, string>;
}) {
  const example = pickExample(cssVar, isColor);
  return (
    <div
      style={{
        ...(vars as React.CSSProperties),
        background: v('--color-surface-layer-page', '#fff'),
        border: '1px solid var(--card-border-color, #e3e4e8)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 60 }}>{example.node}</div>
      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
        <Text size={0} muted style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {example.product} · {example.name}
        </Text>
        {example.state ? (
          <Text size={1} weight="semibold" style={{ marginTop: 2 }}>
            {example.state} state
          </Text>
        ) : null}
      </div>
    </div>
  );
}

export default TokenExample;
