import { useEffect, useMemo, useState } from 'react';
import { useClient, type DocumentActionComponent, type DocumentActionProps } from 'sanity';

import { pageTemplate } from '../lib/pageTemplates';

const API_VERSION = '2024-10-01';

type TenantOption = { _id: string; title: string; slug: string };
type SanityDocument = Record<string, unknown> & {
  _id?: string;
  _type?: string;
  title?: string;
  tenant?: { _ref?: string };
  modality?: string;
  route?: string;
  slug?: { current?: string };
  defaultSlug?: { current?: string };
  templateKey?: string;
  templateVersion?: number;
  version?: number;
  sections?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
};

const cleanIdPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 80);

const pageId = (tenantSlug: string, route: string, slug?: string) =>
  ['pageContent', tenantSlug, cleanIdPart(route), ...(slug ? [cleanIdPart(slug)] : [])].join('.');

const withoutSystemFields = (document: SanityDocument): SanityDocument => {
  const next = JSON.parse(JSON.stringify(document)) as SanityDocument;
  delete next._id;
  delete next._rev;
  delete next._createdAt;
  delete next._updatedAt;
  return next;
};

const portableSections = (sections: Array<Record<string, unknown>> | undefined) =>
  (JSON.parse(JSON.stringify(sections ?? [])) as Array<Record<string, unknown>>).map((section) => {
    delete section.analyticsKey;
    delete section.pinnedItemIds;
    delete section.excludedItemIds;
    return section;
  });

const DialogForm = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gap: 16, minWidth: 360, padding: 4 }}>{children}</div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600 }}>{children}</label>
);

const inputStyle: React.CSSProperties = {
  background: 'var(--card-bg-color, #fff)',
  border: '1px solid var(--card-border-color, #c9cbd1)',
  borderRadius: 4,
  color: 'inherit',
  font: 'inherit',
  minHeight: 36,
  padding: '7px 9px',
};

const ButtonRow = ({
  busy,
  disabled,
  label,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  disabled?: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
    <button type="button" onClick={onCancel} style={inputStyle}>Cancel</button>
    <button
      type="button"
      onClick={onConfirm}
      disabled={busy || disabled}
      style={{ ...inputStyle, background: 'var(--button-primary-color, #2276fc)', color: '#fff', fontWeight: 700 }}
    >
      {busy ? 'Working…' : label}
    </button>
  </div>
);

const useTenants = () => {
  const client = useClient({ apiVersion: API_VERSION });
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  useEffect(() => {
    client
      .fetch<TenantOption[]>(
        '*[_type == "tenant" && defined(slug.current) && !(_id in path("drafts.**"))] | order(title asc){_id,title,"slug":slug.current}',
      )
      .then(setTenants)
      .catch(() => setTenants([]));
  }, [client]);
  return { client, tenants };
};

export const copyPageToTenant: DocumentActionComponent = (props: DocumentActionProps) => {
  const { client, tenants } = useTenants();
  const source = (props.draft ?? props.published) as unknown as SanityDocument | null;
  const [open, setOpen] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [copyMetadata, setCopyMetadata] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const targetTenant = tenants.find((tenant) => tenant._id === targetTenantId);
  const route = source?.route ?? '';
  const slug = source?.slug?.current;

  const copy = async () => {
    if (!source || !targetTenant || !route) return;
    setBusy(true);
    setMessage('');
    try {
      const destinationId = pageId(targetTenant.slug, route, slug);
      const existing = await client.fetch<string | null>(
        '*[_type == "pageContent" && tenant._ref == $tenantId && route == $route && (!defined($slug) || slug.current == $slug)][0]._id',
        { tenantId: targetTenant._id, route, slug: slug ?? null },
      );
      if (existing) {
        setMessage(`${targetTenant.title} already has a page at this route. Nothing was overwritten.`);
        return;
      }

      const next = withoutSystemFields(source);
      next._id = `drafts.${destinationId}`;
      next._type = 'pageContent';
      next.tenant = { _type: 'reference', _ref: targetTenant._id } as unknown as { _ref: string };
      next.title = source.title || (slug ? `/${slug}` : route);
      delete next.analyticsKey;
      delete next.campaignKey;
      if (!copyMetadata) delete next.metadata;

      await client.create(next as { _id: string; _type: string });
      setMessage(`Draft created for ${targetTenant.title}. It is independent from the source page.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The page could not be copied.');
    } finally {
      setBusy(false);
    }
  };

  return {
    label: 'Copy to another tenant',
    disabled: !source?.tenant?._ref,
    onHandle: () => setOpen(true),
    dialog: open
      ? {
          type: 'dialog',
          header: 'Copy page to another tenant',
          onClose: () => {
            setOpen(false);
            props.onComplete();
          },
          content: (
            <DialogForm>
              <div style={{ fontSize: 13, opacity: 0.78 }}>
                The destination keeps its own theme, shared content, navigation, and tenant configuration. The modality cannot be changed.
              </div>
              <Label>
                Destination tenant
                <select value={targetTenantId} onChange={(event) => setTargetTenantId(event.currentTarget.value)} style={inputStyle}>
                  <option value="">Select a tenant…</option>
                  {tenants.filter((tenant) => tenant._id !== source?.tenant?._ref).map((tenant) => (
                    <option key={tenant._id} value={tenant._id}>{tenant.title}</option>
                  ))}
                </select>
              </Label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={copyMetadata} onChange={(event) => setCopyMetadata(event.currentTarget.checked)} />
                Copy page metadata (canonical URL and social metadata should be reviewed)
              </label>
              {message ? <div style={{ background: '#eef4ff', borderRadius: 6, fontSize: 13, padding: 10 }}>{message}</div> : null}
              <ButtonRow busy={busy} disabled={!targetTenantId} label="Create tenant draft" onCancel={() => setOpen(false)} onConfirm={() => void copy()} />
            </DialogForm>
          ),
        }
      : undefined,
  };
};

export const createBlueprintFromPage: DocumentActionComponent = (props: DocumentActionProps) => {
  const client = useClient({ apiVersion: API_VERSION });
  const source = (props.draft ?? props.published) as unknown as SanityDocument | null;
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open && !title) setTitle(`${source?.title || 'Page'} blueprint`);
  }, [open, source?.title, title]);

  const createBlueprint = async () => {
    if (!source?.modality || !source.templateKey || !title.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const sourceId = props.id.replace(/^drafts\./, '');
      const id = `drafts.pageBlueprint.${cleanIdPart(title)}.${Date.now()}`;
      await client.create({
        _id: id,
        _type: 'pageBlueprint',
        title: title.trim(),
        description: `Reusable starting point created from ${source.title || source.route || 'a tenant page'}. Review tenant-specific links and imagery before publishing.`,
        modality: source.modality,
        templateKey: source.templateKey,
        version: 1,
        ...(source.slug?.current ? { defaultSlug: { _type: 'slug', current: source.slug.current } } : {}),
        sections: portableSections(source.sections),
        sourcePage: { _type: 'reference', _ref: sourceId, _weak: true },
      });
      setMessage('Blueprint draft created. Pinned IDs and analytics keys were removed for portability.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The blueprint could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return {
    label: 'Create reusable blueprint',
    disabled: !source?.sections?.length,
    onHandle: () => setOpen(true),
    dialog: open
      ? {
          type: 'dialog',
          header: 'Create reusable page blueprint',
          onClose: () => {
            setOpen(false);
            props.onComplete();
          },
          content: (
            <DialogForm>
              <div style={{ fontSize: 13, opacity: 0.78 }}>
                A blueprint is tenant-neutral and remains compatible only with this page's modality and structural template.
              </div>
              <Label>
                Blueprint title
                <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} style={inputStyle} />
              </Label>
              {message ? <div style={{ background: '#eef4ff', borderRadius: 6, fontSize: 13, padding: 10 }}>{message}</div> : null}
              <ButtonRow busy={busy} disabled={!title.trim()} label="Create blueprint draft" onCancel={() => setOpen(false)} onConfirm={() => void createBlueprint()} />
            </DialogForm>
          ),
        }
      : undefined,
  };
};

export const createPageFromBlueprint: DocumentActionComponent = (props: DocumentActionProps) => {
  const { client, tenants } = useTenants();
  const blueprint = (props.draft ?? props.published) as unknown as SanityDocument | null;
  const [open, setOpen] = useState(false);
  const [targetTenantId, setTargetTenantId] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const definition = useMemo(() => pageTemplate(blueprint?.templateKey), [blueprint?.templateKey]);
  const targetTenant = tenants.find((tenant) => tenant._id === targetTenantId);

  useEffect(() => {
    if (!open) return;
    if (!title) setTitle(blueprint?.title || 'New page');
    if (!slug) setSlug(blueprint?.defaultSlug?.current || '');
  }, [blueprint?.defaultSlug?.current, blueprint?.title, open, slug, title]);

  const createPage = async () => {
    if (!blueprint || !definition || !targetTenant || !title.trim()) return;
    const pageSlug = definition.routePolicy === 'slug' ? slug.trim() : definition.key === 'marketing-home-v1' ? 'home' : undefined;
    if (definition.routePolicy === 'slug' && !pageSlug) return;

    setBusy(true);
    setMessage('');
    try {
      const id = pageId(targetTenant.slug, definition.route, pageSlug);
      const exists = await client.getDocument(id);
      const draftExists = await client.getDocument(`drafts.${id}`);
      if (exists || draftExists) {
        setMessage(`${targetTenant.title} already has this page. Nothing was overwritten.`);
        return;
      }
      await client.create({
        _id: `drafts.${id}`,
        _type: 'pageContent',
        tenant: { _type: 'reference', _ref: targetTenant._id },
        title: title.trim(),
        modality: definition.modality,
        route: definition.route,
        ...(pageSlug ? { slug: { _type: 'slug', current: pageSlug } } : {}),
        templateKey: definition.key,
        templateVersion: blueprint.version ?? 1,
        sections: JSON.parse(JSON.stringify(blueprint.sections ?? [])),
        ...(blueprint.metadata ? { metadata: JSON.parse(JSON.stringify(blueprint.metadata)) } : {}),
      });
      setMessage(`Tenant-local draft created for ${targetTenant.title}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The page could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return {
    label: 'Create tenant page',
    disabled: !blueprint?.sections?.length,
    onHandle: () => setOpen(true),
    dialog: open
      ? {
          type: 'dialog',
          header: 'Create page from blueprint',
          onClose: () => {
            setOpen(false);
            props.onComplete();
          },
          content: (
            <DialogForm>
              <Label>
                Destination tenant
                <select value={targetTenantId} onChange={(event) => setTargetTenantId(event.currentTarget.value)} style={inputStyle}>
                  <option value="">Select a tenant…</option>
                  {tenants.map((tenant) => <option key={tenant._id} value={tenant._id}>{tenant.title}</option>)}
                </select>
              </Label>
              <Label>
                Internal page title
                <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} style={inputStyle} />
              </Label>
              {definition?.routePolicy === 'slug' ? (
                <Label>
                  Slug
                  <input value={slug} onChange={(event) => setSlug(cleanIdPart(event.currentTarget.value).replace(/\./g, '-'))} style={inputStyle} />
                </Label>
              ) : null}
              <div style={{ fontSize: 12, opacity: 0.72 }}>
                Modality: {definition?.modality || blueprint?.modality || 'Unknown'} · Template: {definition?.title || blueprint?.templateKey || 'Unknown'}
              </div>
              {message ? <div style={{ background: '#eef4ff', borderRadius: 6, fontSize: 13, padding: 10 }}>{message}</div> : null}
              <ButtonRow busy={busy} disabled={!targetTenantId || !title.trim() || (definition?.routePolicy === 'slug' && !slug.trim())} label="Create tenant draft" onCancel={() => setOpen(false)} onConfirm={() => void createPage()} />
            </DialogForm>
          ),
        }
      : undefined,
  };
};

export const pageActionsForType = (
  prev: DocumentActionComponent[],
  schemaType: string,
): DocumentActionComponent[] => {
  if (schemaType === 'pageContent') return [copyPageToTenant, createBlueprintFromPage, ...prev];
  if (schemaType === 'pageBlueprint') return [createPageFromBlueprint, ...prev];
  return prev;
};

