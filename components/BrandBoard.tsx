/**
 * Brand board — the visual view on a `brand` document. Renders the brand's
 * defining colors as the brand would actually feel: page canvas, sample UI,
 * swatch wall. Reads whatever is currently in the editor (drafts included),
 * so edits in the form tab preview here immediately.
 */
import { type CSSProperties } from 'react';

interface Role {
  _key?: string;
  role?: string;
  name?: string;
  value?: string;
  cssVar?: string;
  figmaAlias?: string;
}

interface BrandDoc {
  title?: string;
  essence?: string;
  roles?: Role[];
}

const pick = (roles: Role[], role: string, fallback: string): string =>
  roles.find((r) => r.role === role)?.value ?? fallback;

export function BrandBoard(props: { document: { displayed: BrandDoc } }) {
  const doc = props.document.displayed;
  const roles = doc.roles ?? [];

  const page = pick(roles, 'Page', '#ffffff');
  const card = pick(roles, 'Card', '#f7f7f7');
  const cardEm = pick(roles, 'Card emphasized', card);
  const primary = pick(roles, 'Primary action', '#333333');
  const onPrimary = pick(roles, 'On primary', '#ffffff');
  const accent = pick(roles, 'Accent', primary);
  const textPrimary = pick(roles, 'Text primary', '#111111');
  const textSecondary = pick(roles, 'Text secondary', textPrimary);
  const textBrand = pick(roles, 'Text brand', textPrimary);
  const success = pick(roles, 'Success', '#21D466');
  const attention = pick(roles, 'Attention', '#F89E28');
  const error = pick(roles, 'Error', '#F41C4B');

  const mono: CSSProperties = { fontFamily: 'ui-monospace, Consolas, monospace' };

  return (
    <div style={{ background: page, color: textPrimary, minHeight: '100%', padding: '48px 48px 64px', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }}>
      {/* Hero */}
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: textSecondary }}>Brand book</div>
        <h1 style={{ fontSize: 56, lineHeight: 1.05, margin: '10px 0 14px', color: textBrand, fontWeight: 800 }}>{doc.title ?? 'Untitled brand'}</h1>
        {doc.essence ? <p style={{ fontSize: 18, lineHeight: 1.5, color: textSecondary, maxWidth: 640, margin: 0 }}>{doc.essence}</p> : null}

        {/* Core chips */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          {[
            { label: 'Primary', bg: primary, fg: onPrimary },
            { label: 'Accent', bg: accent, fg: '#00000099' },
            { label: 'Canvas', bg: page, fg: textSecondary },
            { label: 'Card', bg: cardEm, fg: textSecondary },
          ].map((c) => (
            <div key={c.label} style={{ width: 130, height: 90, borderRadius: 14, background: c.bg, border: '1px solid rgba(127,127,127,0.35)', display: 'flex', alignItems: 'flex-end', padding: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: c.fg }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Sample UI */}
        <div style={{ marginTop: 40, background: card, border: '1px solid rgba(127,127,127,0.25)', borderRadius: 18, padding: 28, maxWidth: 560 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: textPrimary }}>This is how it feels</div>
          <p style={{ fontSize: 14, color: textSecondary, lineHeight: 1.55, margin: '8px 0 18px' }}>
            Body copy sits in the secondary text color on the card surface. Actions use the primary
            control color. Nothing on this board is a mockup color — every value is the real token.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={{ background: primary, color: onPrimary, border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600 }}>Primary action</button>
            <button type="button" style={{ background: 'transparent', color: textPrimary, border: `1.5px solid ${primary}`, borderRadius: 10, padding: '9px 20px', fontSize: 14, fontWeight: 600 }}>Secondary</button>
            <span style={{ background: accent, color: '#000000cc', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700 }}>Accent</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {[
              { label: 'Success', c: success },
              { label: 'Attention', c: attention },
              { label: 'Error', c: error },
            ].map((f) => (
              <span key={f.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: textSecondary }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: f.c, display: 'inline-block' }} />
                {f.label}
              </span>
            ))}
          </div>
        </div>

        {/* Swatch wall */}
        <div style={{ marginTop: 44 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: textSecondary, marginBottom: 14 }}>Every defining color</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
            {roles.map((r) => (
              <div key={r._key ?? r.role} style={{ background: card, border: '1px solid rgba(127,127,127,0.25)', borderRadius: 12, padding: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 46, height: 46, borderRadius: 9, background: r.value, border: '1px solid rgba(127,127,127,0.4)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: textPrimary }}>{r.role}</div>
                  <div style={{ ...mono, fontSize: 12, color: textSecondary }}>{r.value}</div>
                  <div style={{ ...mono, fontSize: 10.5, color: textSecondary, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⤷ {r.figmaAlias ?? 'raw value'}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: textSecondary, opacity: 0.8, marginTop: 22 }}>
            Values come from the Figma Theme · Brand export. To change a color, use the Edit tab,
            then Publish. The ⤷ path names the matching Figma variable so design stays in sync.
          </p>
        </div>
      </div>
    </div>
  );
}

export default BrandBoard;
