import { useEffect, useMemo, useState } from 'react';
import { useClient } from 'sanity';
import type { PreviewHeaderProps } from 'sanity/presentation';

import { defaultSectionsForTemplate, defaultTemplateForRoute, modalityFromRoute } from '../lib/pageTemplates';

const DEFAULT_TENANT = 'bookit';
const PREVIEW_ROUTE = '/__sanity-preview/';
const API_VERSION = '2024-10-01';

type PreviewSurface = 'marketing' | 'vip' | 'ticketing' | 'hotels';

type TenantOption = {
  _id: string;
  title: string;
  slug: string;
  domain?: string;
  active?: boolean;
  enabledProducts?: PreviewSurface[];
};

const TENANTS_QUERY = `
  *[_type == "tenant" && defined(slug.current) && !(_id in path("drafts.**"))]
    | order(active desc, title asc) {
    _id,
    title,
    "slug": slug.current,
    domain,
    active,
    enabledProducts
  }
`;

const SURFACE_ROUTES: Record<PreviewSurface, string> = {
  marketing: 'marketing/page',
  vip: 'vip/home',
  ticketing: 'ticketing/home',
  hotels: 'hotels/home',
};

const pageDocumentId = (surface: PreviewSurface, tenantSlug: string) =>
  `pageContent.${tenantSlug}.${SURFACE_ROUTES[surface].replace(/[^a-zA-Z0-9_-]/g, '.')}${surface === 'marketing' ? '.home' : ''}`;

const PREVIEW_CONTENT_QUERY = `
  *[
    (_type == "pageContent" && route == $route && (tenant._ref == $tenantId || !defined(tenant))) ||
    (_type == "productContent" && modality == $surface && (tenant._ref == $tenantId || !defined(tenant))) ||
    (_type == "brandTheme" && (tenant._ref == $tenantId || _id == "default.brandTheme")) ||
    (_type == "tenant" && _id == $tenantId)
  ]
`;

const previewUrl = (props: PreviewHeaderProps) => {
  const current = props.previewUrl || props.initialUrl.toString();
  return new URL(current, props.targetOrigin);
};

const tenantFromUrl = (props: PreviewHeaderProps) => {
  const match = previewUrl(props).pathname.match(/^\/__sanity-preview\/([a-z0-9-]+)/i);
  return match?.[1]?.toLowerCase() || DEFAULT_TENANT;
};

/**
 * Adds tenant context to Sanity's own Presentation header without touching the
 * rendered application UI. The tenant is encoded in the preview pathname so
 * Presentation's main-document resolver and the frontend always agree.
 */
export const createTenantPreviewHeader = (surface: PreviewSurface, surfaceTitle: string) => {
  const TenantPreviewHeader = (props: PreviewHeaderProps) => {
    const client = useClient({ apiVersion: API_VERSION });
    const [tenants, setTenants] = useState<TenantOption[]>([]);
    const [loadError, setLoadError] = useState(false);
    const [switchError, setSwitchError] = useState(false);
    const selectedSlug = tenantFromUrl(props);

    useEffect(() => {
      let cancelled = false;
      client
        .fetch<TenantOption[]>(TENANTS_QUERY)
        .then((nextTenants) => {
          if (!cancelled) setTenants(nextTenants);
        })
        .catch(() => {
          if (!cancelled) setLoadError(true);
        });
      return () => {
        cancelled = true;
      };
    }, [client]);

    useEffect(() => {
      let refreshTimer: ReturnType<typeof setTimeout> | undefined;
      let consistencyTimer: ReturnType<typeof setTimeout> | undefined;
      const refreshPreview = () => {
        const next = previewUrl(props);
        next.searchParams.set('sanity-refresh', Date.now().toString());
        if (props.iframeRef.current) props.iframeRef.current.src = next.toString();
        props.onPathChange(`${next.pathname}${next.search}${next.hash}`);
      };
      const subscription = client
        .listen(
          PREVIEW_CONTENT_QUERY,
          {
            route: SURFACE_ROUTES[surface],
            surface,
            tenantId: `tenant.${selectedSlug}`,
          },
          { includeResult: false, visibility: 'query' },
        )
        .subscribe(() => {
          if (refreshTimer) clearTimeout(refreshTimer);
          if (consistencyTimer) clearTimeout(consistencyTimer);
          refreshTimer = setTimeout(refreshPreview, 500);
          consistencyTimer = setTimeout(refreshPreview, 2000);
        });

      return () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        if (consistencyTimer) clearTimeout(consistencyTimer);
        subscription.unsubscribe();
      };
    }, [client, props.onPathChange, selectedSlug]);

    const selectedTenant = useMemo(
      () => tenants.find((tenant) => tenant.slug === selectedSlug),
      [selectedSlug, tenants],
    );
    const enabled = selectedTenant?.enabledProducts?.includes(surface) ?? false;

    const ensureTenantPage = async (tenant: TenantOption) => {
      const route = SURFACE_ROUTES[surface];
      const generatedId = pageDocumentId(surface, tenant.slug);
      const templateKey = defaultTemplateForRoute(route, surface === 'marketing' ? 'home' : undefined);
      const templateDefaults: Record<string, unknown> = templateKey
        ? {
            title: 'Homepage',
            modality: modalityFromRoute(route),
            templateKey,
            templateVersion: 4,
            sections: defaultSectionsForTemplate(templateKey),
          }
        : {};
      const existingId = await client.fetch<string | null>(
        `*[
          _type == "pageContent" &&
          route == $route &&
          tenant._ref == $tenantId &&
          ($surface != "marketing" || slug.current == "home")
        ][0]._id`,
        { route, surface, tenantId: tenant._id },
      );

      // New tenant pages start from the current Bookit implementation because
      // that is the complete, production-shaped component set used by these
      // demo previews. A universal page remains the fallback where no Bookit
      // page exists.
      const sourcePages = await client.fetch<{
        bookit: Record<string, unknown> | null;
        universal: Record<string, unknown> | null;
      }>(
        `{
          "bookit": *[
            _type == "pageContent" &&
            route == $route &&
            tenant._ref == "tenant.bookit" &&
            ($surface != "marketing" || slug.current == "home")
          ][0],
          "universal": *[
            _type == "pageContent" &&
            route == $route &&
            !defined(tenant) &&
            ($surface != "marketing" || slug.current == "home")
          ][0]
        }`,
        { route, surface },
      );
      const inheritedFields: Record<string, unknown> = {
        ...templateDefaults,
        ...(sourcePages.bookit ?? sourcePages.universal ?? {}),
      };
      delete inheritedFields._id;
      delete inheritedFields._rev;
      delete inheritedFields._createdAt;
      delete inheritedFields._updatedAt;
      delete inheritedFields.tenant;

      if (existingId) {
        // Only hydrate documents created by this selector. Existing editorial
        // overrides keep their intentional inheritance choices untouched.
        if (existingId === generatedId && Object.keys(inheritedFields).length > 0) {
          await client.patch(existingId).setIfMissing(inheritedFields).commit();
        }
        return;
      }

      await client.createIfNotExists({
        ...inheritedFields,
        _id: generatedId,
        _type: 'pageContent',
        route,
        ...(surface === 'marketing' ? { slug: { _type: 'slug', current: 'home' } } : {}),
        tenant: { _type: 'reference', _ref: tenant._id },
      });
    };

    const selectTenant = async (slug: string) => {
      const next = previewUrl(props);
      next.pathname = `${PREVIEW_ROUTE}${encodeURIComponent(slug)}`;
      next.searchParams.delete('tenant');
      const nextPath = `${next.pathname}${next.search}${next.hash}`;

      setSwitchError(false);
      const tenant = tenants.find((option) => option.slug === slug);
      try {
        if (tenant) await ensureTenantPage(tenant);
      } catch {
        setSwitchError(true);
      }

      // Presentation can briefly retain the prior iframe/document pair when a
      // custom header changes only its path. Navigating the iframe as well
      // keeps the visible tenant, main document and overlay click targets in
      // lockstep.
      if (props.iframeRef.current) props.iframeRef.current.src = next.toString();
      props.onPathChange(nextPath);
    };

    return (
      <>
        {props.renderDefault(props)}
        <div
          aria-label={`${surfaceTitle} tenant preview controls`}
          style={{
            alignItems: 'center',
            background: 'var(--card-bg-color, #fff)',
            borderTop: '1px solid var(--card-border-color, #e3e4e8)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            minHeight: '44px',
            padding: '6px 12px',
          }}
        >
          <span style={{ color: 'var(--card-muted-fg-color, #6e7683)', fontSize: 12, fontWeight: 600 }}>
            Previewing tenant
          </span>
          <select
            aria-label="Previewing tenant"
            onChange={(event) => void selectTenant(event.currentTarget.value)}
            value={selectedSlug}
            style={{
              background: 'var(--input-bg-color, #fff)',
              border: '1px solid var(--input-border-color, #c9cbd1)',
              borderRadius: 4,
              color: 'var(--input-fg-color, #202123)',
              font: 'inherit',
              fontSize: 13,
              minWidth: 190,
              padding: '6px 28px 6px 8px',
            }}
          >
            {!tenants.some((tenant) => tenant.slug === selectedSlug) ? (
              <option value={selectedSlug}>{selectedSlug}</option>
            ) : null}
            {tenants.map((tenant) => (
              <option key={tenant._id} value={tenant.slug}>
                {tenant.title}{tenant.active === false ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
          {selectedTenant ? (
            <>
              <span
                style={{
                  background: selectedTenant.active === false ? '#fce8e6' : enabled ? '#e6f4ea' : '#fff4ce',
                  borderRadius: 999,
                  color: selectedTenant.active === false ? '#a50e0e' : enabled ? '#137333' : '#7a4d00',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                }}
              >
                {selectedTenant.active === false
                  ? 'Inactive tenant'
                  : enabled
                    ? `${surfaceTitle} enabled`
                    : `${surfaceTitle} not enabled`}
              </span>
              {selectedTenant.domain ? (
                <span style={{ color: 'var(--card-muted-fg-color, #6e7683)', fontSize: 12 }}>
                  {selectedTenant.domain}
                </span>
              ) : null}
            </>
          ) : loadError ? (
            <span style={{ color: '#a50e0e', fontSize: 12 }}>Tenant list unavailable</span>
          ) : (
            <span style={{ color: 'var(--card-muted-fg-color, #6e7683)', fontSize: 12 }}>Loading tenants…</span>
          )}
          {switchError ? (
            <span style={{ color: '#a50e0e', fontSize: 12 }}>
              Could not prepare this tenant's editable page
            </span>
          ) : null}
        </div>
      </>
    );
  };

  TenantPreviewHeader.displayName = `${surfaceTitle.replace(/\s+/g, '')}TenantPreviewHeader`;
  return TenantPreviewHeader;
};

