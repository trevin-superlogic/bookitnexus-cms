/**
 * Figma imports — two deliberately separate tools, one per Figma collection:
 *
 *   "Import Brands"      🌈 Theme · Brand      → per-tenant colors     (common)
 *   "Import Foundation"  📐 Foundation · Breakpoint → shared system    (rare)
 *
 * Each tool accepts only its own files and points the user at the other tool
 * when it recognises the wrong kind. Everything imports as drafts; Validate &
 * publish on the documents remains the only path to live.
 */
import { useCallback, useMemo, useState } from 'react';
import { Badge, Box, Button, Card, Checkbox, Flex, Heading, Inline, Spinner, Stack, Text } from '@sanity/ui';
import { UploadIcon } from '@sanity/icons';
import { useClient } from 'sanity';

import { flattenTokens, resolveValueRefs, toStoredTokens } from '../lib/tokens/flatten';
import { aliasBrand, brandKeyToSlug, canonicalBrandKey, stripEmoji } from '../lib/tokens/naming';
import type { FigmaTokenTree } from '../lib/tokens/types';

const FOUNDATION_ID = 'foundationTokens.singleton';
const BREAKPOINT_BY_FILENAME: Record<string, string> = {
  'desktop.tokens.json': 'desktop',
  'wide desktop.tokens.json': 'wideDesktop',
  'tablet.tokens.json': 'tablet',
  'mobile.tokens.json': 'mobile',
};

type Mode = 'brand' | 'foundation';

// ── Minimal zip reader (store + deflate), no dependencies ──────────────────
async function readZip(buf: ArrayBuffer): Promise<Array<{ name: string; data: Uint8Array }>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('Not a zip file (no end-of-central-directory record).');
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const out: Array<{ name: string; data: Uint8Array }> = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);
    if (!name.endsWith('/')) {
      let data: Uint8Array;
      if (method === 0) data = raw;
      else if (method === 8) {
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } else throw new Error(`Unsupported compression (method ${method}) for ${name}`);
      out.push({ name, data });
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

interface FoundItem {
  kind: 'foundation' | 'brand' | 'primitives';
  label: string;
  filename: string;
  tree: FigmaTokenTree;
  tokenCount: number;
  breakpoint?: string;
  brandKey?: string;
  slug?: string;
  tenantId?: string | null;
  foreignAliases?: string[];
  wrongTool?: boolean;
  /** Foundation mode: this entry's subtree per breakpoint. */
  perBreakpoint?: Record<string, FigmaTokenTree>;
  /** Foundation mode, primitives rows: path prefix inside the export. */
  prefix?: string[];
  selected: boolean;
}

function inferBrandKey(tree: FigmaTokenTree): { brandKey: string; foreign: string[] } {
  const counts = new Map<string, number>();
  for (const token of Object.values(flattenTokens(tree))) {
    const target = token.$extensions?.['com.figma.aliasData']?.targetVariableName;
    const brand = target ? aliasBrand(target) : null;
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return { brandKey: sorted[0]?.[0] ?? '', foreign: sorted.slice(1).map(([b, n]) => `${n}× ${stripEmoji(b)}`) };
}

const toTokenSet = (tree: FigmaTokenTree, filename: string, prefix: string[] = []) => ({
  _type: 'tokenSet',
  tokens: toStoredTokens(flattenTokens(tree, prefix)).map((token) => ({
    _type: 'storedToken',
    _key: token.path.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64),
    ...token,
  })),
  sourceJson: JSON.stringify(tree),
  importedAt: new Date().toISOString(),
  importedFilename: filename,
});

const COPY: Record<Mode, { title: string; when: string[]; otherTool: string }> = {
  brand: {
    title: 'Import Brands — 🌈 Theme · Brand',
    when: [
      'Use this when brand COLORS changed: a designer updated a brand in Figma, or you have a saved .tokens.json for a brand kept outside Figma.',
      'This is the common case. You choose exactly which brands to update — untouched brands are never affected.',
      "Don't use it for spacing, type sizes, radii, or brand-new palette colors — those live in Foundation (see “Import Foundation”).",
    ],
    otherTool: 'This is a Foundation file — use the “Import Foundation” tool instead.',
  },
  foundation: {
    title: 'Import Foundation — 📐 Foundation · Breakpoint',
    when: [
      'Use this when the SHARED SYSTEM changed: spacing scale, type sizes, radii, shared colors — or when any brand adds or changes a raw palette color.',
      'This is rare. The export is four files (desktop, wide desktop, tablet, mobile); drop the zip and all four import together.',
      'The shared system goes to Foundation tokens; each brand\u2019s own palette is routed to that brand\u2019s Theme & style tokens document, so Foundation stays purely universal.',
      'After importing: open Foundation tokens in the left menu and Validate & publish — BEFORE publishing any brand. Brands depend on these values.',
    ],
    otherTool: 'This is a Brand file — use the “Import Brands” tool instead.',
  },
};

function ImportCore({ mode }: { mode: Mode }) {
  const client = useClient({ apiVersion: '2024-10-01' });
  const [items, setItems] = useState<FoundItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const copy = COPY[mode];

  const analyse = useCallback(async (files: File[]) => {
    setError(null); setDone([]); setBusy('Reading files…');
    try {
      const entries: Array<{ name: string; text: string }> = [];
      for (const f of files) {
        if (f.name.toLowerCase().endsWith('.zip')) {
          for (const e of await readZip(await f.arrayBuffer())) {
            if (e.name.toLowerCase().endsWith('.json')) entries.push({ name: e.name, text: new TextDecoder().decode(e.data) });
          }
        } else if (f.name.toLowerCase().endsWith('.json')) {
          entries.push({ name: f.name, text: await f.text() });
        }
      }
      if (entries.length === 0) throw new Error('No .json token files found. Drop the Figma export zip or .tokens.json files.');

      const tenants: Array<{ slug: string; _id: string }> =
        await client.fetch('*[_type == "tenant"]{ "slug": slug.current, _id }');
      // Brands are matched on Tenant ID: "🔴tria", "u_e" and "tria" all
      // canonicalise to the same value, so no separate Figma key is needed.
      const byBrandKey = new Map(tenants.map((t) => [canonicalBrandKey(t.slug ?? ''), t]));
      const bySlug = byBrandKey;

      const found: FoundItem[] = [];
      // Foundation mode: collect the breakpoint files first, then split them
      // into "shared system" and one primitives row per brand.
      const breakpointTrees: Record<string, FigmaTokenTree> = {};
      for (const e of entries) {
        const base = e.name.split('/').pop()!.toLowerCase();
        let tree: FigmaTokenTree;
        try { tree = JSON.parse(e.text); } catch { continue; }
        const tokenCount = Object.keys(flattenTokens(tree)).length;
        if (tokenCount === 0) continue;
        const breakpoint = BREAKPOINT_BY_FILENAME[base];
        if (breakpoint) {
          if (mode !== 'foundation') {
            found.push({ kind: 'foundation', label: `Foundation — ${breakpoint}`, filename: base, tree, tokenCount, breakpoint, wrongTool: true, selected: false });
          } else {
            breakpointTrees[breakpoint] = tree;
          }
        } else {
          const { brandKey, foreign } = inferBrandKey(tree);
          const slug = byBrandKey.get(canonicalBrandKey(brandKey))?.slug ?? brandKeyToSlug(brandKey);
          const tenant = byBrandKey.get(canonicalBrandKey(brandKey)) ?? bySlug.get(canonicalBrandKey(slug));
          const wrongTool = mode !== 'brand';
          found.push({
            kind: 'brand',
            label: stripEmoji(brandKey) || base.replace('.tokens.json', ''),
            filename: base, tree, tokenCount, brandKey, slug,
            tenantId: tenant?._id ?? null,
            foreignAliases: foreign.length ? foreign : undefined,
            wrongTool,
            selected: !wrongTool && Boolean(tenant),
          });
        }
      }
      if (mode === 'foundation' && Object.keys(breakpointTrees).length > 0) {
        // Shared system row: everything except brand/*.
        const sharedTrees: Record<string, FigmaTokenTree> = {};
        let sharedCount = 0;
        for (const [bp, tree] of Object.entries(breakpointTrees)) {
          const { brand: _brand, ...rest } = tree as FigmaTokenTree & { brand?: FigmaTokenTree };
          sharedTrees[bp] = rest as FigmaTokenTree;
          sharedCount = Math.max(sharedCount, Object.keys(flattenTokens(rest as FigmaTokenTree)).length);
        }
        found.push({
          kind: 'foundation',
          label: `Shared system (spacing, type, radii, shared colors) — ${Object.keys(breakpointTrees).length} breakpoint(s)`,
          filename: 'foundation', tree: sharedTrees.desktop ?? Object.values(sharedTrees)[0],
          tokenCount: sharedCount, perBreakpoint: sharedTrees, selected: true,
        });
        // One primitives row per brand present in the export.
        const brandKeys = new Set<string>();
        for (const tree of Object.values(breakpointTrees)) {
          for (const k of Object.keys((tree as { brand?: FigmaTokenTree }).brand ?? {})) brandKeys.add(k);
        }
        for (const key of [...brandKeys].sort((a, b) => stripEmoji(a).localeCompare(stripEmoji(b)))) {
          const perBp: Record<string, FigmaTokenTree> = {};
          let count = 0;
          for (const [bp, tree] of Object.entries(breakpointTrees)) {
            const sub = ((tree as { brand?: Record<string, FigmaTokenTree> }).brand ?? {})[key];
            // Bake {a.b.c} references to literals while the full export is
            // still available — the tenant's copy must be self-contained.
            if (sub) { perBp[bp] = resolveValueRefs(sub, tree); count = Math.max(count, Object.keys(flattenTokens(sub)).length); }
          }
          const slug = byBrandKey.get(key)?.slug ?? brandKeyToSlug(key);
          const tenant = byBrandKey.get(key) ?? bySlug.get(slug);
          found.push({
            kind: 'primitives',
            label: `${stripEmoji(key)} — brand primitives`,
            filename: 'foundation', tree: perBp.desktop ?? Object.values(perBp)[0],
            tokenCount: count, brandKey: key, slug, tenantId: tenant?._id ?? null,
            perBreakpoint: perBp, prefix: ['brand', key],
            selected: Boolean(tenant),
          });
        }
      }
      found.sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === 'foundation' ? -1 : a.kind === 'primitives' && b.kind !== 'foundation' ? -1 : 1));
      if (found.length === 0) throw new Error('No token variables found in those files.');
      setItems(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
    }
    setBusy(null);
  }, [client, mode]);

  /** Existing draft (or published) theme doc, so imports merge rather than clobber. */
  const existingThemeDoc = useCallback(async (slug: string) => {
    const existing =
      (await client.fetch('*[_id == $d][0]', { d: `drafts.brandTheme.${slug}` })) ??
      (await client.fetch('*[_id == $p][0]', { p: `brandTheme.${slug}` })) ?? {};
    delete existing._rev;
    return existing as Record<string, unknown>;
  }, [client]);

  const BP_FILE: Record<string, string> = {
    desktop: 'desktop.tokens.json', wideDesktop: 'wide desktop.tokens.json',
    tablet: 'tablet.tokens.json', mobile: 'mobile.tokens.json',
  };

  const runImport = useCallback(async () => {
    setError(null); setDone([]);
    const selected = items.filter((i) => i.selected && !i.wrongTool);
    try {
      // Shared system → the Foundation document (brand sections never land here).
      const sharedRow = selected.find((i) => i.kind === 'foundation' && i.perBreakpoint);
      if (sharedRow?.perBreakpoint) {
        setBusy('Importing shared system…');
        const existing =
          (await client.fetch('*[_id == $d][0]', { d: `drafts.${FOUNDATION_ID}` })) ??
          (await client.fetch('*[_id == $p][0]', { p: FOUNDATION_ID })) ?? {};
        const doc: Record<string, unknown> = {
          ...existing,
          _id: `drafts.${FOUNDATION_ID}`,
          _type: 'foundationTokens',
          title: 'Foundation · Breakpoint',
        };
        delete (doc as Record<string, unknown>)._rev;
        for (const [bp, tree] of Object.entries(sharedRow.perBreakpoint)) doc[bp] = toTokenSet(tree, BP_FILE[bp] ?? bp);
        await client.createOrReplace(doc as { _id: string; _type: string });
        setDone((d) => [...d, `Shared system updated (${Object.keys(sharedRow.perBreakpoint).join(', ')}) — as a draft`]);
      }

      // Brand primitives → each tenant's own theme document.
      for (const item of selected.filter((i) => i.kind === 'primitives')) {
        setBusy(`Routing ${item.label} → ${item.slug}…`);
        const existing = await existingThemeDoc(item.slug!);
        const doc: Record<string, unknown> = {
          ...existing,
          _id: `drafts.brandTheme.${item.slug}`,
          _type: 'brandTheme',
          tenant: (existing.tenant as object) ?? { _type: 'reference', _ref: item.tenantId },
        };
        const fieldFor: Record<string, string> = {
          desktop: 'primitivesDesktop', wideDesktop: 'primitivesWideDesktop',
          tablet: 'primitivesTablet', mobile: 'primitivesMobile',
        };
        for (const [bp, tree] of Object.entries(item.perBreakpoint ?? {})) {
          doc[fieldFor[bp]] = toTokenSet(tree, BP_FILE[bp] ?? bp, item.prefix);
        }
        await client.createOrReplace(doc as { _id: string; _type: string });
        setDone((d) => [...d, `${item.label} → ${item.slug} (${item.tokenCount} tokens) — as a draft`]);
      }

      // Brand semantic tokens (Brand tool) — merged so primitives survive.
      for (const item of selected.filter((i) => i.kind === 'brand')) {
        setBusy(`Importing ${item.label}…`);
        const existing = await existingThemeDoc(item.slug!);
        await client.createOrReplace({
          ...existing,
          _id: `drafts.brandTheme.${item.slug}`,
          _type: 'brandTheme',
          tenant: (existing.tenant as object) ?? { _type: 'reference', _ref: item.tenantId },
          theme: toTokenSet(item.tree, item.filename),
          compatAliasesEnabled: (existing.compatAliasesEnabled as boolean | undefined) ?? true,
        } as { _id: string; _type: string });
        setDone((d) => [...d, `${item.label} → ${item.slug} (${item.tokenCount} tokens) — as a draft`]);
      }
      setBusy(null);
      setItems([]);
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [client, existingThemeDoc, items]);

  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault(); setDragOver(false);
    void analyse(Array.from(ev.dataTransfer.files));
  }, [analyse]);

  const selectedCount = useMemo(() => items.filter((i) => i.selected && !i.wrongTool).length, [items]);
  const inputId = `figma-import-file-input-${mode}`;

  return (
    <Box padding={4} style={{ maxWidth: 760, margin: '0 auto' }}>
      <Stack space={4}>
        <Heading as="h1" size={2}>{copy.title}</Heading>
        <Card padding={3} radius={3} tone="primary">
          <Stack space={3}>
            <Text size={1} weight="semibold">When to use this</Text>
            {copy.when.map((line) => <Text key={line.slice(0, 24)} size={1}>{line}</Text>)}
          </Stack>
        </Card>

        <Card
          padding={5} radius={3} border tone={dragOver ? 'positive' : 'transparent'}
          style={{ borderStyle: 'dashed', textAlign: 'center', cursor: 'pointer' }}
          onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <Stack space={3}>
            <Text align="center" size={4}><UploadIcon /></Text>
            <Text align="center" weight="semibold">
              {mode === 'brand' ? 'Drop the 🌈 Theme · Brand export here' : 'Drop the 📐 Foundation · Breakpoint export here'}
            </Text>
            <Text align="center" size={1} muted>.zip or .tokens.json — or click to choose files</Text>
          </Stack>
          <input
            id={inputId} type="file" multiple accept=".zip,.json"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.length) void analyse(Array.from(e.target.files)); e.target.value = ''; }}
          />
        </Card>

        {busy ? <Flex align="center" gap={3}><Spinner /><Text size={1}>{busy}</Text></Flex> : null}
        {error ? <Card padding={3} radius={2} tone="critical"><Text size={1}>{error}</Text></Card> : null}

        {items.length > 0 ? (
          <Card padding={4} radius={3} border>
            <Stack space={4}>
              <Text weight="semibold">Found in this export — choose what to update</Text>
              <Stack space={3}>
                {items.map((item, idx) => (
                  <Flex key={item.kind + item.filename + (item.slug ?? '')} align="center" gap={3}>
                    <Checkbox
                      checked={item.selected && !item.wrongTool}
                      disabled={item.wrongTool || (item.kind === 'brand' && !item.tenantId)}
                      onChange={() => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, selected: !p.selected } : p)))}
                    />
                    <Box flex={1}>
                      <Inline space={2}>
                        <Text size={1} weight="semibold" muted={item.wrongTool}>{item.label}</Text>
                        <Badge tone={item.kind === 'foundation' ? 'primary' : 'default'} fontSize={0}>
                          {item.kind === 'foundation' ? 'Foundation tokens' : `→ ${item.slug}`}
                        </Badge>
                        <Text size={1} muted>{item.tokenCount} tokens</Text>
                        {item.wrongTool ? <Badge tone="caution" fontSize={0}>{copy.otherTool}</Badge> : null}
                        {!item.wrongTool && (item.kind === 'brand' || item.kind === 'primitives') && !item.tenantId ? <Badge tone="caution" fontSize={0}>no tenant — can't import</Badge> : null}
                        {!item.wrongTool && item.foreignAliases ? <Badge tone="caution" fontSize={0}>aliases into other brand: {item.foreignAliases.join(', ')}</Badge> : null}
                      </Inline>
                    </Box>
                  </Flex>
                ))}
              </Stack>
              <Flex gap={3} align="center">
                <Button
                  icon={UploadIcon} text={`Import ${selectedCount} selected`} tone="primary"
                  disabled={selectedCount === 0 || busy !== null}
                  onClick={() => void runImport()}
                />
                <Text size={1} muted>Imports are drafts — publishing stays behind Validate & publish.</Text>
              </Flex>
            </Stack>
          </Card>
        ) : null}

        {done.length > 0 ? (
          <Card padding={3} radius={2} tone="positive">
            <Stack space={2}>
              {done.map((d) => <Text key={d} size={1}>✓ {d}</Text>)}
              <Text size={1} weight="semibold">
                {mode === 'foundation'
                  ? 'Next: left menu → Foundation tokens → Validate & publish. Do this before publishing any brand.'
                  : 'Next: open each updated tenant → Theme & style tokens → Validate & publish.'}
              </Text>
            </Stack>
          </Card>
        ) : null}
      </Stack>
    </Box>
  );
}

export function BrandImportTool() { return <ImportCore mode="brand" />; }
export function FoundationImportTool() { return <ImportCore mode="foundation" />; }
export default BrandImportTool;
