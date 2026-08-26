/**
 * The publish gate.
 *
 * Replaces Sanity's default publish action on token documents so that, per the
 * PDP, "publishing must not be possible through the standard Sanity publish
 * action unless translation and validation complete successfully".
 *
 * Sequence on click:
 *   1. read the draft's tokens (and, for a theme, the Foundation document)
 *   2. run the pipeline — source validation → translate → output validation
 *   3. on failure: write the report, show the errors, do NOT publish
 *   4. on success: patch the compiled output onto the draft, then publish
 *
 * Because the compiled output is written to the draft immediately before
 * publishing, the published document always carries output built from exactly
 * the tokens being published — and the previously published version stays
 * intact whenever validation fails, which is the PDP's "the published API
 * response must always contain the last successfully validated version".
 *
 * Registered in sanity.config.ts via `document.actions`.
 */
import { useCallback, useMemo, useState } from 'react';
import { useClient, type DocumentActionComponent, type DocumentActionProps } from 'sanity';

import { runGlobalPipeline, runThemePipeline, type FoundationSets } from '../lib/tokens/pipeline';
import { DEFAULT_COMPAT_ALIASES } from '../lib/tokens/compat';
import { validatePrimitiveDrift } from '../lib/tokens/validate';
import { overriddenPaths, type TokenOverride } from '../lib/tokens/overrides';
import type { ValidationIssue, ValidationResult, TokenManifest } from '../lib/tokens/validate';
import type { StoredToken } from '../lib/tokens/types';
import manifestJson from '../schemas/tokens/required-tokens.json';
import { pageActionsForType } from './pageActions';

const manifest = manifestJson as unknown as TokenManifest;

const API_VERSION = '2024-10-01';

/** Shape of the fields the action reads and writes. */
interface TokenSetValue {
  tokens?: StoredToken[];
}

interface BrandThemeDoc {
  _id: string;
  tenant?: { _ref: string };
  theme?: TokenSetValue;
  primitivesDesktop?: TokenSetValue;
  primitivesWideDesktop?: TokenSetValue;
  primitivesTablet?: TokenSetValue;
  primitivesMobile?: TokenSetValue;
  overrides?: TokenOverride[];
  compatAliasesEnabled?: boolean;
}

interface FoundationDoc {
  _id: string;
  desktop?: TokenSetValue;
  wideDesktop?: TokenSetValue;
  tablet?: TokenSetValue;
  mobile?: TokenSetValue;
}

const FOUNDATION_ID = 'foundationTokens.singleton';
const DEFAULT_THEME_ID = 'default.brandTheme';

const toReport = (result: ValidationResult) => ({
  status: result.ok ? 'passing' : 'failing',
  checkedAt: new Date().toISOString(),
  errorCount: result.issues.filter((i) => i.severity === 'error').length,
  warningCount: result.issues.filter((i) => i.severity === 'warning').length,
  noteCount: result.issues.filter((i) => i.severity === 'info').length,
  // Cap what we persist: a broken import can produce hundreds of issues, and
  // a document that large is slow to open — which is precisely when an editor
  // most needs it to open.
  issues: result.issues.slice(0, 100).map((issue: ValidationIssue) => ({
    _type: 'validationIssue',
    _key: `${issue.code}-${issue.subject}`.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 60),
    severity: issue.severity,
    code: issue.code,
    subject: issue.subject,
    message: issue.message,
    detail: issue.detail,
  })),
});

const emptySets = (doc: FoundationDoc | null): FoundationSets => ({
  desktop: doc?.desktop?.tokens ?? [],
  wideDesktop: doc?.wideDesktop?.tokens ?? [],
  tablet: doc?.tablet?.tokens ?? [],
  mobile: doc?.mobile?.tokens ?? [],
});

/** The tenant's own slice of the Foundation collection, stored on its document. */
const primitiveSets = (doc: BrandThemeDoc | null): FoundationSets => ({
  desktop: doc?.primitivesDesktop?.tokens ?? [],
  wideDesktop: doc?.primitivesWideDesktop?.tokens ?? [],
  tablet: doc?.primitivesTablet?.tokens ?? [],
  mobile: doc?.primitivesMobile?.tokens ?? [],
});

const mergeSets = (a: FoundationSets, b: FoundationSets): FoundationSets => ({
  desktop: [...a.desktop, ...b.desktop],
  wideDesktop: [...a.wideDesktop, ...b.wideDesktop],
  tablet: [...a.tablet, ...b.tablet],
  mobile: [...a.mobile, ...b.mobile],
});

export const validateAndPublish: DocumentActionComponent = (props: DocumentActionProps) => {
  const { id, type, draft, published, onComplete } = props;
  const client = useClient({ apiVersion: API_VERSION });

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  // Publishing via `useDocumentOperation` proved unreliable here: `execute()`
  // on a disabled op is a silent no-op, and the op's enabled-ness depends on
  // render timing we do not control from inside an async handler. The content
  // API gives us the same semantics deterministically — a publish IS
  // "createOrReplace the published id, delete the draft" in one transaction.
  const baseId = id.replace(/^drafts\./, '');
  const draftId = `drafts.${baseId}`;

  const currentDoc = useCallback(async (): Promise<Record<string, unknown> | null> => {
    const fromDraft = await client.getDocument(draftId);
    if (fromDraft) return fromDraft as unknown as Record<string, unknown>;
    const fromPublished = await client.getDocument(baseId);
    return (fromPublished as unknown as Record<string, unknown>) ?? null;
  }, [baseId, client, draftId]);

  /** Persist fields on the draft without publishing (used for failed runs). */
  const saveToDraft = useCallback(async (fields: Record<string, unknown>) => {
    const existing = (await currentDoc()) ?? {};
    const next = { ...existing, ...fields, _id: draftId, _type: type };
    delete (next as { _rev?: string })._rev;
    await client.createOrReplace(next as { _id: string; _type: string });
  }, [client, currentDoc, draftId, type]);

  /** Write the compiled output and publish, atomically. */
  const publishNow = useCallback(async (fields: Record<string, unknown>) => {
    const existing = await currentDoc();
    if (!existing) throw new Error('There is no document to publish.');
    const next = { ...existing, ...fields, _id: baseId, _type: type };
    delete (next as { _rev?: string })._rev;
    await client.transaction().createOrReplace(next as { _id: string; _type: string }).delete(draftId).commit();
  }, [baseId, client, currentDoc, draftId, type]);

  const doc = (draft ?? published) as unknown as BrandThemeDoc & FoundationDoc & { _id: string };

  const run = useCallback(async () => {
    setBusy(true);
    try {
      if (type === 'foundationTokens') {
        const foundation = emptySets(doc);
        const { validation, output } = runGlobalPipeline(foundation, manifest);

        if (!validation.ok || !output) {
          await saveToDraft({ validation: toReport(validation) });
          setResult(validation);
          setBusy(false);
          return;
        }

        await publishNow({
          validation: toReport(validation),
          compiledShared: {
            _type: 'compiledTheme',
            css: output.shared.css,
            variablesJson: JSON.stringify(output.shared.variables, null, 2),
            compiledAt: new Date().toISOString(),
            sourceHash: output.sourceHash,
            tokenCount: Object.keys(output.shared.variables).length,
          },
          compiledScale: {
            _type: 'compiledTheme',
            css: output.scale.css,
            variablesJson: JSON.stringify(output.scale.variables, null, 2),
            compiledAt: new Date().toISOString(),
            sourceHash: output.sourceHash,
            tokenCount: Object.keys(output.scale.variables).length,
          },
        });
        // onComplete() dismisses the dialog, so only call it when there is
        // nothing to report; otherwise it is called when the user closes.
        if (validation.issues.length > 0) setResult(validation);
        else onComplete();
        return;
      }

      // brandTheme — needs the tenant's Figma brand key and the Foundation set,
      // neither of which lives on this document.
      const tenantRef = doc?.tenant?._ref;
      if (!tenantRef) {
        setResult({
          ok: false,
          issues: [
            {
              severity: 'error',
              code: 'theme.no-tenant',
              subject: id,
              message: 'This theme is not linked to a tenant.',
              detail: 'Select a tenant so the brand key can be resolved.',
            },
          ],
        });
        setBusy(false);
        return;
      }

      const [tenant, foundationDoc] = await Promise.all([
        client.fetch<{ slug?: string; title?: string } | null>(
          '*[_id == $id][0]{"slug": slug.current, title}',
          { id: tenantRef },
        ),
        client.fetch<FoundationDoc | null>(
          `*[_id == $id][0]{_id, desktop, wideDesktop, tablet, mobile}`,
          { id: FOUNDATION_ID },
        ),
      ]);

      if (!tenant?.slug) {
        setResult({
          ok: false,
          issues: [
            {
              severity: 'error',
              code: 'tenant.no-id',
              subject: tenant?.title ?? tenantRef,
              message: 'This tenant has no Tenant ID.',
              detail: 'Open Tenant CMS Settings and set the Tenant ID — it is what matches this theme to its brand in Figma.',
            },
          ],
        });
        setBusy(false);
        return;
      }

      // Staleness check: baked brand-file values vs stored primitives. Reported
      // as prominent warnings — the publish proceeds, but on the older values.
      // A deliberately overridden token is expected to differ from its
      // primitive — that is the point — so it is not drift.
      const skip = overriddenPaths(doc?.overrides ?? []);
      const drift = validatePrimitiveDrift({
        theme: (doc?.theme?.tokens ?? []).filter((token) => !skip.has(token.path)),
        primitives: primitiveSets(doc).desktop,
      });

      const { validation: pipelineValidation, output } = runThemePipeline({
        brandKey: tenant.slug,
        theme: doc?.theme?.tokens ?? [],
        foundation: mergeSets(emptySets(foundationDoc), primitiveSets(doc)),
        manifest,
        compatAliases: DEFAULT_COMPAT_ALIASES,
        compatEnabled: doc?.compatAliasesEnabled !== false,
        overrides: doc?.overrides ?? [],
      });
      const validation: ValidationResult = {
        ok: pipelineValidation.ok,
        issues: [...drift, ...pipelineValidation.issues],
      };

      // The report is written whether or not we publish, so a blocked editor
      // can see why without re-running anything.
      if (!validation.ok || !output) {
        await saveToDraft({ validation: toReport(validation) });
        setResult(validation);
        setBusy(false);
        return;
      }

      const compiled = {
        _type: 'compiledTheme',
        css: output.css,
        variablesJson: JSON.stringify(output.variables, null, 2),
        compiledAt: new Date().toISOString(),
        sourceHash: output.sourceHash,
        tokenCount: output.tokenCount,
        aliasCount: output.aliasCount,
      };

      await publishNow({ validation: toReport(validation), compiled });

      // Keep the universal default in step with the brand it tracks, so it can
      // never serve tokens older than that brand's last publish.
      const defaultDoc = await client.getDocument<{ sourceTenant?: { _ref?: string } }>(DEFAULT_THEME_ID);
      if (defaultDoc?.sourceTenant?._ref && defaultDoc.sourceTenant._ref === tenantRef) {
        await client
          .patch(DEFAULT_THEME_ID)
          .set({ compiled, validation: toReport(validation) })
          .commit();
      }
      if (validation.issues.length > 0) setResult(validation);
      else onComplete();
    } finally {
      setBusy(false);
    }
  }, [client, doc, id, onComplete, publishNow, saveToDraft, type]);

  const dialog = useMemo(() => {
    if (!result) return undefined;
    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    const notes = result.issues.filter((i) => i.severity === 'info');
    const blocked = errors.length > 0;

    const SECTIONS = [
      {
        items: errors,
        accent: '#b3261e',
        bg: '#fdecea',
        label: 'Must fix',
        heading: `${errors.length} problem${errors.length === 1 ? '' : 's'} blocking publish`,
        blurb: 'Nothing was published. Fix these, then press Validate & publish again.',
      },
      {
        items: warnings,
        accent: '#8a6100',
        bg: '#fff6e0',
        label: 'Worth knowing',
        heading: `${warnings.length} warning${warnings.length === 1 ? '' : 's'}`,
        blurb: blocked
          ? 'These do not block publishing — no action needed right now.'
          : 'Published successfully. These are informational — no action needed right now.',
      },
      {
        items: notes,
        accent: '#00629e',
        bg: '#e7f3fb',
        label: 'FYI',
        heading: `${notes.length} note${notes.length === 1 ? '' : 's'}`,
        blurb: 'New tokens from Figma that no application code uses yet.',
      },
    ].filter((section) => section.items.length > 0);

    return {
      type: 'dialog' as const,
      onClose: () => {
        setResult(null);
        onComplete();
      },
      header: blocked ? 'Publish blocked' : 'Published successfully',
      content: (
        <div style={{ display: 'grid', gap: 20, maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Verdict banner — the one thing that must be unmissable. */}
          <div
            style={{
              background: blocked ? '#fdecea' : '#e8f5e9',
              border: `1px solid ${blocked ? '#f2b8b5' : '#b7dfb9'}`,
              borderRadius: 8,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: blocked ? '#b3261e' : '#1b5e20' }}>
              {blocked
                ? `Not published — ${errors.length} error${errors.length === 1 ? '' : 's'} to fix`
                : 'Published — these tokens are live on the API'}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 4, opacity: 0.85 }}>
              {blocked
                ? 'Your work is saved as a draft. Nothing was lost.'
                : warnings.length || notes.length
                  ? 'The items below are informational only.'
                  : 'No issues found.'}
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span
                  style={{
                    background: section.accent,
                    color: '#fff',
                    borderRadius: 999,
                    padding: '2px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {section.label}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{section.heading}</span>
              </div>
              <div style={{ fontSize: 12.5, opacity: 0.8, marginBottom: 10 }}>{section.blurb}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {section.items.slice(0, 40).map((issue, index) => (
                  <div
                    key={`${issue.code}-${issue.subject}-${index}`}
                    style={{
                      background: section.bg,
                      borderLeft: `4px solid ${section.accent}`,
                      borderRadius: '0 6px 6px 0',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{issue.subject}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>{issue.message}</div>
                    {issue.detail ? (
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{issue.detail}</div>
                    ) : null}
                    <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 5 }}>{issue.code}</div>
                  </div>
                ))}
                {section.items.length > 40 ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    … and {section.items.length - 40} more of the same kind.
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ),
    };
  }, [onComplete, result]);

  return {
    disabled: busy || (!draft && !result),
    label: busy ? 'Validating…' : 'Validate & publish',
    tone: 'primary',
    onHandle: run,
    dialog,
  };
};

/**
 * Wire-up helper for sanity.config.ts.
 *
 * Removes the stock publish action on token documents entirely — leaving it
 * available alongside ours would make the gate optional, which defeats it.
 */
export const resolveDocumentActions = (
  prev: DocumentActionComponent[],
  context: { schemaType: string },
): DocumentActionComponent[] => {
  const GATED_TYPES = ['brandTheme', 'foundationTokens'];
  const withPageActions = pageActionsForType(prev, context.schemaType);
  if (!GATED_TYPES.includes(context.schemaType)) return withPageActions;
  return [validateAndPublish, ...withPageActions.filter((action) => action.action !== 'publish')];
};

