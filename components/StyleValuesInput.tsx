/**
 * Theme variables — the editable view of a tenant's tokens.
 *
 * Deliberately does NOT present itself as an "overrides" screen. An editor sees
 * the variables and their current values; changing one marks that row as edited
 * and enables its reset. The distinction between "from Figma" and "set here" is
 * surfaced only where it matters, because for most of the job it does not.
 *
 * Values are edited with a control appropriate to the type — colour swatch,
 * number with its unit, toggle, text — never raw JSON. The JSON encoding is an
 * implementation detail of how Figma ships tokens; nobody should need to know
 * it to change a colour.
 *
 * Bound to the `overrides` field, but reads `theme.tokens` from the form to
 * render the merged picture. Only edited variables are written, which is what
 * makes a Figma re-import safe: untouched rows have nothing stored to go stale,
 * and reset restores the imported value exactly.
 *
 * The row chevron is a placeholder for per-variable usage examples ("where does
 * this show up in the product?"), which land in a later pass — it is rendered
 * inactive rather than omitted so the row layout does not shift when it works.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Stack, Text, TextInput, Tooltip } from '@sanity/ui';
import { ChevronDownIcon, LaunchIcon, ResetIcon, SearchIcon } from '@sanity/icons';
import { set, unset, useFormValue, type ArrayOfObjectsInputProps } from 'sanity';

const PREVIEW_CHANNEL = 'bookitcms-tokens';
const PREVIEW_STORE = 'bookitcms.preview.css';
const PREVIEW_READY = 'bookitcms-preview-ready';

type PreviewProduct = 'marketing' | 'hotels' | 'vip' | 'ticketing';

import {
  colorValue,
  cssColor,
  numberValue,
  parseColorValue,
  sameTokenValue,
  stringValue,
  type TokenOverride,
} from '../lib/tokens/overrides';
import { DEFAULT_COMPAT_ALIASES } from '../lib/tokens/compat';
import { pathToCssVar } from '../lib/tokens/naming';
import type { StoredToken } from '../lib/tokens/types';
import { TokenExample } from './TokenExamples';

interface Row {
  path: string;
  /** The exported CSS variable — what the apps actually reference. */
  cssVar: string;
  type?: string;
  figmaValue: string;
  effectiveValue: string;
  aliasTarget?: string;
  edited: boolean;
  masksChange: boolean;
}

/** "🟢 color.attribute.1.bg" → ["attribute", "1", "bg"] */
function segments(path: string): string[] {
  const clean = path.replace(/^[^a-zA-Z0-9]+\s*/, '');
  const parts = clean.split('.').filter(Boolean);
  return parts.length > 1 ? parts.slice(1) : parts;
}

const parseJson = (value: string | undefined): unknown => {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

function kindOf(row: Row): 'color' | 'number' | 'boolean' | 'text' {
  if (row.type === 'color' || cssColor(row.effectiveValue) !== null) return 'color';
  if (row.type === 'number' || typeof parseJson(row.effectiveValue) === 'number') return 'number';
  if (row.type === 'boolean' || typeof parseJson(row.effectiveValue) === 'boolean') return 'boolean';
  return 'text';
}

export function StyleValuesInput(props: ArrayOfObjectsInputProps) {
  const { onChange, readOnly } = props;
  const overrides = (props.value ?? []) as unknown as TokenOverride[];
  const tokens = (useFormValue(['theme', 'tokens']) ?? []) as StoredToken[];

  const [query, setQuery] = useState('');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedOnce, setExpandedOnce] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const previewWindows = useRef<Partial<Record<PreviewProduct, Window>>>({});

  const overrideByPath = useMemo(() => {
    const map = new Map<string, TokenOverride>();
    for (const override of overrides) if (override?.path) map.set(override.path, override);
    return map;
  }, [overrides]);

  const rows: Row[] = useMemo(
    () =>
      tokens
        .filter((token) => token?.path)
        .map((token) => {
          const override = overrideByPath.get(token.path);
          return {
            path: token.path,
            cssVar: pathToCssVar(token.path.split('.')),
            type: token.type,
            figmaValue: token.value,
            effectiveValue: override?.value ?? token.value,
            aliasTarget: token.aliasTarget,
            edited: Boolean(override),
            masksChange: Boolean(override) && !sameTokenValue(token.value, override?.value),
          };
        })
        .sort((a, b) => segments(a.path).join('/').localeCompare(segments(b.path).join('/'))),
    [overrideByPath, tokens],
  );

  /**
   * Every variable at its current value, as CSS custom properties.
   *
   * Fed to the usage previews so they render in this tenant's palette and
   * update the moment a value is edited — including before it is saved.
   */
  const cssVars = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rows) {
      const color = cssColor(row.effectiveValue);
      if (color !== null) {
        map[row.cssVar] = color;
        continue;
      }
      const parsed = parseJson(row.effectiveValue);
      if (typeof parsed === 'number') map[row.cssVar] = `${parsed}px`;
      else if (typeof parsed === 'string' && parsed.trim() !== '') map[row.cssVar] = parsed;
    }
    return map;
  }, [rows]);

  const tenantSlug = (useFormValue(['tenant', '_ref']) as string | undefined)?.replace(/^drafts\./, '').replace(/^tenant\./, '') ?? '';

  /**
   * The same map as CSS declaration text, for the site preview.
   *
   * The compatibility aliases matter here as much as they do at publish time:
   * the shipped sites still reference pre-rename variables like
   * `--color-control-secondary-default-bg-default`, while current exports emit
   * `…-filled-default-…`. Without the aliases those controls resolve to
   * nothing and render unstyled — which is exactly the washed-out button state
   * you see on a preview that only carries the new names.
   */
  const previewCss = useMemo(() => {
    const declarations = Object.entries(cssVars).map(([name, value]) => `${name}:${value};`);
    for (const alias of DEFAULT_COMPAT_ALIASES) {
      if (cssVars[alias.to] !== undefined && cssVars[alias.from] === undefined) {
        declarations.push(`${alias.from}:var(${alias.to});`);
      }
    }
    return declarations.join('');
  }, [cssVars]);

  const previewUrls = useMemo<Record<PreviewProduct, URL>>(() => {
    const configured = process.env.SANITY_STUDIO_PREVIEW_URL;
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!local && configured) {
      const base = new URL(configured, window.location.href);
      return { marketing: base, hotels: base, vip: base, ticketing: base };
    }
    if (local) {
      return {
        marketing: new URL('http://localhost:3335/'),
        hotels: new URL('http://127.0.0.1:3337/'),
        vip: new URL('http://localhost:3334/'),
        ticketing: new URL('http://localhost:3336/'),
      };
    }
    const base = new URL('/static/previews/index.html', window.location.href);
    return { marketing: base, hotels: base, vip: base, ticketing: base };
  }, []);

  const sendToPreview = useCallback(
    (target: Window | null | undefined, origin: string) => {
      if (!target || target.closed || !previewCss) return;
      target.postMessage(
        { type: PREVIEW_CHANNEL, tenant: tenantSlug, css: previewCss },
        origin,
      );
    },
    [previewCss, tenantSlug],
  );

  // Push to any open preview tab. Also stored, so a tab opened later paints
  // with the current values immediately instead of waiting for the next edit.
  useEffect(() => {
    if (!previewCss) return;
    try {
      localStorage.setItem(PREVIEW_STORE, previewCss);
    } catch {
      /* private mode — the channel still works for open tabs */
    }
    (Object.keys(previewUrls) as PreviewProduct[]).forEach((product) =>
      sendToPreview(previewWindows.current[product], previewUrls[product].origin),
    );
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(PREVIEW_CHANNEL);
    channel.postMessage({ tenant: tenantSlug, css: previewCss });
    channel.close();
  }, [previewCss, previewUrls, sendToPreview, tenantSlug]);

  useEffect(() => {
    const allowedOrigins = new Set(Object.values(previewUrls).map((url) => url.origin));
    const onReady = (event: MessageEvent) => {
      if (event.data?.type !== PREVIEW_READY || !allowedOrigins.has(event.origin)) return;
      sendToPreview(event.source as Window | null, event.origin);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [previewUrls, sendToPreview]);

  const openPreview = useCallback(
    (product: PreviewProduct) => {
      try {
        localStorage.setItem(PREVIEW_STORE, previewCss);
      } catch {
        /* ignore */
      }
      const url = new URL(previewUrls[product]);
      url.searchParams.set('studioOrigin', window.location.origin);
      if (tenantSlug) url.searchParams.set('tenant', tenantSlug);
      previewWindows.current[product] = window.open(url, `bookitcms-preview-${product}`) ?? undefined;
      window.setTimeout(() => sendToPreview(previewWindows.current[product], url.origin), 500);
      window.setTimeout(() => sendToPreview(previewWindows.current[product], url.origin), 1500);
    },
    [previewUrls, sendToPreview, tenantSlug],
  );

  const orphaned = useMemo(
    () => overrides.filter((o) => o?.path && !tokens.some((t) => t.path === o.path)),
    [overrides, tokens],
  );
  const editedCount = rows.filter((r) => r.edited).length;

  const writeOverrides = useCallback(
    (next: TokenOverride[]) => onChange(next.length === 0 ? unset() : set(next as unknown as never)),
    [onChange],
  );

  const setValue = useCallback(
    (row: Row, value: string) => {
      const others = overrides.filter((o) => o?.path !== row.path);
      // Setting a variable back to exactly the Figma value is a reset — storing
      // it would be a permanent no-op that hides future Figma changes.
      if (sameTokenValue(value, row.figmaValue)) {
        writeOverrides(others);
        return;
      }
      writeOverrides([
        ...others,
        {
          _type: 'tokenOverride',
          _key: row.path.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64),
          path: row.path,
          type: row.type,
          value,
          updatedAt: new Date().toISOString(),
        } as unknown as TokenOverride,
      ]);
    },
    [overrides, writeOverrides],
  );

  const resetOne = useCallback(
    (row: Row) => writeOverrides(overrides.filter((o) => o?.path !== row.path)),
    [overrides, writeOverrides],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (onlyEdited && !row.edited) return false;
      if (!q) return true;
      return segments(row.path).join('/').toLowerCase().includes(q) || row.path.toLowerCase().includes(q);
    });
  }, [onlyEdited, query, rows]);

  // Grouped by the first path segment — "attribute", "control", "surface" …
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of filtered) {
      const group = segments(row.path)[0] ?? 'other';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(row);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Searching or filtering opens everything: hiding matches behind a collapsed
  // header would make the search look broken.
  const forceOpen = query.trim().length > 0 || onlyEdited;
  // First group starts open so the panel is never a wall of closed headers.
  const isOpen = (group: string, index: number) =>
    forceOpen || expanded.has(group) || (!expandedOnce && index === 0);

  const toggle = (group: string) => {
    setExpandedOnce(true);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  if (tokens.length === 0) {
    return (
      <Card padding={4} radius={3} tone="caution" border>
        <Text size={1}>
          No variables imported yet. Use <b>Import Brands</b> to bring this tenant’s Figma export in, then values can be
          edited here.
        </Text>
      </Card>
    );
  }

  return (
    <Stack space={3}>
      <style>{NO_SPINNER}</style>
      <Card radius={3} border overflow="hidden">
        {/* Header */}
        <Flex
          align="center"
          gap={3}
          padding={3}
          style={{ borderBottom: '1px solid var(--card-border-color, #e3e4e8)', background: 'var(--card-bg-color, #fff)' }}
        >
          <Box flex={1}>
            <Text size={2} weight="semibold">
              Theme variables
            </Text>
          </Box>
          <Text size={1} muted>
            {rows.length}
            {editedCount > 0 ? ` · ${editedCount} edited` : ''}
          </Text>
          <Tooltip
            content={
              <Box padding={2} style={{ maxWidth: 260 }}>
                <Text size={1}>
                  Opens the real site in a new tab with these values applied. It repaints as you edit — no need to save
                  or publish first.
                </Text>
              </Box>
            }
            placement="bottom"
          >
            <Flex gap={1}>
              <Button
                icon={LaunchIcon}
                mode="ghost"
                fontSize={1}
                padding={3}
                radius={2}
                text="Marketing"
                onClick={() => openPreview('marketing')}
              />
              <Button
                icon={LaunchIcon}
                mode="ghost"
                fontSize={1}
                padding={3}
                radius={2}
                text="Hotels"
                onClick={() => openPreview('hotels')}
              />
              <Button
                icon={LaunchIcon}
                mode="ghost"
                fontSize={1}
                padding={3}
                radius={2}
                text="Tickets"
                onClick={() => openPreview('ticketing')}
              />
              <Button
                icon={LaunchIcon}
                mode="ghost"
                fontSize={1}
                padding={3}
                radius={2}
                text="VIP"
                onClick={() => openPreview('vip')}
              />
            </Flex>
          </Tooltip>
        </Flex>

        {/* Controls */}
        <Flex align="center" gap={2} padding={3} style={{ borderBottom: '1px solid var(--card-border-color, #e3e4e8)' }}>
          <Box flex={1}>
            <TextInput
              icon={SearchIcon}
              placeholder="Find a variable — try “primary”, “surface”, “radius”"
              value={query}
              radius={2}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </Box>
          <Button
            mode={onlyEdited ? 'default' : 'ghost'}
            tone={onlyEdited ? 'primary' : 'default'}
            text="Edited only"
            fontSize={1}
            padding={3}
            radius={2}
            onClick={() => setOnlyEdited((v) => !v)}
          />
          <Button
            mode="ghost"
            text={expanded.size > 0 || !expandedOnce ? 'Collapse all' : 'Expand all'}
            fontSize={1}
            padding={3}
            radius={2}
            onClick={() => {
              setExpandedOnce(true);
              setExpanded((prev) => (prev.size > 0 ? new Set() : new Set(groups.map(([g]) => g))));
            }}
          />
          {editedCount > 0 ? (
            <Button
              mode="ghost"
              tone="critical"
              text="Reset all"
              fontSize={1}
              padding={3}
              radius={2}
              disabled={readOnly}
              onClick={() => {
                if (confirm(`Hand all ${editedCount} edited value(s) back to the Figma export?`)) {
                  writeOverrides(orphaned);
                }
              }}
            />
          ) : null}
        </Flex>

        {/* Grouped rows */}
        <Stack>
          {groups.map(([group, groupRows], index) => {
            const open = isOpen(group, index);
            const edited = groupRows.filter((r) => r.edited).length;
            return (
              <Box key={group}>
                <Flex
                  as="button"
                  align="center"
                  gap={3}
                  padding={3}
                  onClick={() => toggle(group)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: '#f6f7f9',
                    borderBottom: '1px solid var(--card-border-color, #e3e4e8)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 120ms ease',
                      opacity: 0.55,
                    }}
                  >
                    <ChevronDownIcon />
                  </div>
                  <Box flex={1}>
                    <Text size={1} weight="semibold" style={{ textTransform: 'capitalize' }}>
                      {group.replace(/\+/g, ' & ')}
                    </Text>
                  </Box>
                  {/* Collapsed groups still show their palette at a glance. */}
                  {!open ? (
                    <Flex gap={1} align="center">
                      {groupRows
                        .map((r) => cssColor(r.effectiveValue))
                        .filter((c): c is string => c !== null)
                        .slice(0, 8)
                        .map((c, i) => (
                          <span
                            key={`${c}-${i}`}
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: c,
                              border: '1px solid rgba(0,0,0,0.15)',
                              display: 'block',
                            }}
                          />
                        ))}
                    </Flex>
                  ) : null}
                  <Text size={1} muted>
                    {groupRows.length}
                    {edited > 0 ? ` · ${edited} edited` : ''}
                  </Text>
                </Flex>

                {open ? (
                  <Stack>
                    {groupRows.map((row) => (
                      <VariableRow
                        key={row.path}
                        row={row}
                        readOnly={Boolean(readOnly)}
                        open={openRow === row.path}
                        cssVars={cssVars}
                        onToggle={() => setOpenRow((cur) => (cur === row.path ? null : row.path))}
                        onSet={(value) => setValue(row, value)}
                        onReset={() => resetOne(row)}
                      />
                    ))}
                  </Stack>
                ) : null}
              </Box>
            );
          })}
          {groups.length === 0 ? (
            <Box padding={4}>
              <Text size={1} muted>
                Nothing matches “{query}”.
              </Text>
            </Box>
          ) : null}
        </Stack>
      </Card>

      {orphaned.length > 0 ? (
        <Card padding={3} radius={3} tone="caution" border>
          <Flex align="center" gap={3}>
            <Box flex={1}>
              <Text size={1} weight="semibold">
                {orphaned.length} edited variable{orphaned.length === 1 ? '' : 's'} no longer exist in Figma
              </Text>
              <Text size={1} muted style={{ marginTop: 4 }}>
                {orphaned.slice(0, 3).map((o) => segments(o.path).join(' / ')).join(', ')}
                {orphaned.length > 3 ? `, … ${orphaned.length - 3} more` : ''}. They have no effect.
              </Text>
            </Box>
            <Button
              mode="ghost"
              fontSize={1}
              padding={3}
              radius={2}
              text="Remove"
              disabled={readOnly}
              onClick={() => writeOverrides(overrides.filter((o) => !orphaned.includes(o)))}
            />
          </Flex>
        </Card>
      ) : null}

      <Text size={1} muted>
        Edits stay when a new Figma file is imported, so a quick fix is not undone by the next export. Reset a row to
        hand it back to Figma.
      </Text>
    </Stack>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

function VariableRow({
  row,
  readOnly,
  open,
  cssVars,
  onToggle,
  onSet,
  onReset,
}: {
  row: Row;
  readOnly: boolean;
  open: boolean;
  cssVars: Record<string, string>;
  onToggle: () => void;
  onSet: (value: string) => void;
  onReset: () => void;
}) {
  const kind = kindOf(row);
  const parts = segments(row.path);
  const leaf = parts[parts.length - 1] ?? row.path;
  const prefix = parts.slice(0, -1);

  return (
    <Box style={{ borderBottom: '1px solid var(--card-border-color, #eceef1)' }}>
    <Flex
      align="center"
      gap={3}
      padding={3}
      style={{ background: row.edited ? 'var(--card-bg-color, transparent)' : 'transparent' }}
    >
      <TypeGlyph kind={kind} color={cssColor(row.effectiveValue)} />

      {/* Path — trail muted, leaf emphasised, as in the reference */}
      <Box flex={1} style={{ minWidth: 140 }}>
        <Text size={1} textOverflow="ellipsis">
          {prefix.map((part) => (
            <span key={part} style={{ opacity: 0.55 }}>
              {part.replace(/\+/g, ' & ')} <span style={{ opacity: 0.4 }}>/</span>{' '}
            </span>
          ))}
          <span style={{ fontWeight: 600 }}>{leaf.replace(/\+/g, ' & ')}</span>
        </Text>
        {row.masksChange ? (
          <Text size={0} style={{ marginTop: 3, color: '#8a6100' }}>
            Figma changed this — reset to take theirs
          </Text>
        ) : null}
      </Box>

      {/* Value */}
      {kind === 'color' ? (
        <ColorControl value={row.effectiveValue} edited={row.edited} readOnly={readOnly} onSet={onSet} />
      ) : kind === 'number' ? (
        <NumberControl value={row.effectiveValue} edited={row.edited} readOnly={readOnly} onSet={onSet} />
      ) : kind === 'boolean' ? (
        <BooleanControl value={row.effectiveValue} readOnly={readOnly} onSet={onSet} />
      ) : (
        <TextControl value={row.effectiveValue} edited={row.edited} readOnly={readOnly} onSet={onSet} />
      )}

      {/* Reset — inactive until the row is edited */}
      <Tooltip
        content={
          <Box padding={2}>
            <Text size={1}>{row.edited ? 'Reset to the Figma value' : 'Not edited'}</Text>
          </Box>
        }
        placement="top"
      >
        <div>
          <Button
            icon={ResetIcon}
            mode="bleed"
            fontSize={1}
            padding={2}
            disabled={readOnly || !row.edited}
            onClick={onReset}
            style={{ opacity: row.edited ? 1 : 0.3 }}
            aria-label="Reset to the Figma value"
          />
        </div>
      </Tooltip>

      {/* Where this variable shows up in the product */}
      <Tooltip
        content={
          <Box padding={2}>
            <Text size={1}>{open ? 'Hide example' : 'Show where this is used'}</Text>
          </Box>
        }
        placement="top"
      >
        <div>
          <Button
            icon={ChevronDownIcon}
            mode="bleed"
            fontSize={1}
            padding={2}
            onClick={onToggle}
            aria-label="Show where this is used"
            aria-expanded={open}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }}
          />
        </div>
      </Tooltip>
    </Flex>

      {open ? (
        <Box paddingX={3} paddingBottom={3}>
          <TokenExample cssVar={row.cssVar} isColor={kind === 'color'} vars={cssVars} />
          <Text size={0} muted style={{ marginTop: 6, fontFamily: 'ui-monospace, Consolas, monospace' }}>
            {row.cssVar}
            {row.aliasTarget ? `  ⤷ ${row.aliasTarget}` : ''}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function TypeGlyph({ kind, color }: { kind: string; color: string | null }) {
  const base: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: 5,
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
    color: '#6b7280',
    background: '#f1f3f6',
  };
  if (kind === 'color') {
    return (
      <div
        style={{
          ...base,
          background: color ?? '#fff',
          border: '1px solid rgba(0,0,0,0.15)',
          backgroundImage:
            color && color.startsWith('rgba')
              ? 'linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%),linear-gradient(45deg,#eee 25%,transparent 25%,transparent 75%,#eee 75%)'
              : undefined,
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 4px 4px',
        }}
      />
    );
  }
  return <div style={base}>{kind === 'number' ? '#' : kind === 'boolean' ? '◑' : 'Tr'}</div>;
}

const FIELD: React.CSSProperties = {
  height: 34,
  border: '1px solid #d5d8de',
  borderRadius: 7,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 8px',
};
const EDITED_FIELD: React.CSSProperties = { ...FIELD, borderColor: '#2276fc', boxShadow: '0 0 0 1px #2276fc33' };
/** Native number spinners steal ~16px and clip three-digit values. */
const NO_SPINNER = `
  .sv-num::-webkit-outer-spin-button,
  .sv-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .sv-num { -moz-appearance: textfield; }
`;

const BARE_INPUT: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontFamily: 'ui-monospace, Consolas, monospace',
  fontSize: 12.5,
  width: '100%',
  padding: 0,
};
const UNIT: React.CSSProperties = {
  background: '#f1f3f6',
  borderRadius: 5,
  padding: '2px 6px',
  fontSize: 11,
  color: '#6b7280',
  flex: 'none',
};

function ColorControl({
  value,
  edited,
  readOnly,
  onSet,
}: {
  value: string;
  edited: boolean;
  readOnly: boolean;
  onSet: (value: string) => void;
}) {
  const parsed = parseColorValue(value) ?? { hex: '#000000', alphaPercent: 100 };
  return (
    <div style={{ ...(edited ? EDITED_FIELD : FIELD), width: 190 }}>
      <label style={{ display: 'flex', cursor: readOnly ? 'default' : 'pointer', flex: 'none' }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: '1px solid rgba(0,0,0,0.2)',
            background: cssColor(value) ?? parsed.hex,
            display: 'block',
          }}
        />
        <input
          type="color"
          value={parsed.hex}
          disabled={readOnly}
          onChange={(e) => onSet(colorValue(e.currentTarget.value, parsed.alphaPercent))}
          style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
          aria-label="Colour"
        />
      </label>
      <input
        type="text"
        value={parsed.hex}
        disabled={readOnly}
        onChange={(e) => {
          const next = e.currentTarget.value.trim();
          if (/^#?[0-9a-fA-F]{6}$/.test(next)) onSet(colorValue(next, parsed.alphaPercent));
        }}
        style={{ ...BARE_INPUT, width: 72, flex: 'none' }}
        aria-label="Hex value"
      />
      <input
        className="sv-num"
        type="number"
        min={0}
        max={100}
        value={parsed.alphaPercent}
        disabled={readOnly}
        onChange={(e) => onSet(colorValue(parsed.hex, Number(e.currentTarget.value)))}
        style={{ ...BARE_INPUT, width: 38, textAlign: 'right', flex: 'none' }}
        aria-label="Opacity percent"
        title="Opacity"
      />
      <span style={UNIT}>%</span>
    </div>
  );
}

function NumberControl({
  value,
  edited,
  readOnly,
  onSet,
}: {
  value: string;
  edited: boolean;
  readOnly: boolean;
  onSet: (value: string) => void;
}) {
  const current = Number(parseJson(value));
  return (
    <div style={{ ...(edited ? EDITED_FIELD : FIELD), width: 130 }}>
      <input
        className="sv-num"
        type="number"
        value={Number.isFinite(current) ? current : 0}
        disabled={readOnly}
        onChange={(e) => onSet(numberValue(Number(e.currentTarget.value)))}
        style={BARE_INPUT}
        aria-label="Value"
      />
      {/* Numbers are emitted as px by the translator, so that is what we show. */}
      <span style={UNIT}>px</span>
    </div>
  );
}

function BooleanControl({
  value,
  readOnly,
  onSet,
}: {
  value: string;
  readOnly: boolean;
  onSet: (value: string) => void;
}) {
  const on = parseJson(value) === true;
  return (
    <Flex align="center" gap={2} style={{ width: 130 }}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => onSet(JSON.stringify(!on))}
        aria-label={on ? 'On' : 'Off'}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: 'none',
          background: on ? '#0f172a' : '#cbd2da',
          position: 'relative',
          cursor: readOnly ? 'default' : 'pointer',
          flex: 'none',
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
            background: '#fff',
            transition: 'left 120ms ease',
          }}
        />
      </button>
      <Text size={1} muted>
        {on ? 'On' : 'Off'}
      </Text>
    </Flex>
  );
}

function TextControl({
  value,
  edited,
  readOnly,
  onSet,
}: {
  value: string;
  edited: boolean;
  readOnly: boolean;
  onSet: (value: string) => void;
}) {
  const parsed = parseJson(value);
  const current = typeof parsed === 'string' ? parsed : String(parsed ?? '');
  return (
    <div style={{ ...(edited ? EDITED_FIELD : FIELD), width: 168 }}>
      <input
        type="text"
        value={current}
        disabled={readOnly}
        onChange={(e) => onSet(stringValue(e.currentTarget.value))}
        style={BARE_INPUT}
        aria-label="Value"
      />
    </div>
  );
}

export default StyleValuesInput;

