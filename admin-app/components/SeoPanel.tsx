'use client';
// SEO editor block used on every page-bearing record and the homepage:
// live Google preview, length counters, suggestions (applied only on request),
// duplicate warnings and a plain checklist score.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Sparkles } from 'lucide-react';
import { api } from './api';
import { FieldWrap } from './ui';
import { scoreSeo } from '@/lib/seo/score';
import { LIMITS, lengthTone, suggestSeo, type SuggestKind, type Tone } from '@/lib/seo/suggest';

type Rec = Record<string, any>;
type Dup = { field: 'seo_title' | 'meta_description' | 'slug'; where: string; href?: string };

const KIND: Record<string, SuggestKind> = {
  properties: 'property', projects: 'project', agents: 'agent', videos: 'video', locations: 'location', homepage: 'homepage',
};
const PATH: Record<string, string> = { properties: '/properties/', projects: '/projects/', agents: '/agents/', videos: '/videos/', locations: '/real-estate/' };

/** What the public page will contain — used for the score's H1 / content / image checks. */
function pageFacts(resourceKey: string, rec: Rec) {
  const alts = (rec.galleries?.gallery || []).map((g: Rec) => g.alt);
  switch (resourceKey) {
    case 'properties': return { h1: rec.title, body: rec.description, mainImage: rec.main_image || null, galleryAlts: alts, minWords: 80 };
    case 'projects': return { h1: rec.name, body: rec.description, mainImage: rec.main_image || null, galleryAlts: alts, minWords: 80 };
    case 'agents': return { h1: rec.name, body: rec.bio, mainImage: rec.photo || null, minWords: 60 };
    case 'videos': return { h1: rec.title, body: [rec.description, rec.transcript].join(' '), mainImage: rec.thumbnail || rec.youtube_url || null, minWords: 50 };
    case 'locations': return { h1: rec.heading || rec.name, body: [rec.intro, rec.market_content, ...(rec.faqs || []).map((f: Rec) => `${f.q} ${f.a}`)].join(' '), mainImage: rec.hero_image || null, minWords: 300 };
    default: return { h1: rec.hero?.heading, body: [rec.hero?.description, rec.about?.short_description].join(' '), mainImage: rec.seo?.og_image || rec.hero?.image || null, minWords: 50 };
  }
}

const TONE_COLOR: Record<Tone, string> = { good: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--accent)' };
const TONE_TEXT: Record<Tone, string> = { good: 'Good length', warn: 'Too short', bad: 'Too long' };

export function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const len = (value || '').trim().length;
  const tone = len === 0 ? 'warn' : lengthTone(len, min, max);
  return (
    <span className="help" style={{ color: TONE_COLOR[tone], fontWeight: 600 }} aria-live="polite">
      {len} / {max} · {len === 0 ? 'Missing' : TONE_TEXT[tone]}{min > 1 ? ` (aim for ${min}–${max})` : ''}
    </span>
  );
}

let baseCache: string | null = null;
function useBaseUrl() {
  const [base, setBase] = useState(baseCache || '');
  useEffect(() => {
    if (baseCache) return;
    api<Rec>('/api/admin/content/settings')
      .then((s) => { const b: string = s.canonical_base_url || window.location.origin; baseCache = b; setBase(b); })
      .catch(() => setBase(window.location.origin));
  }, []);
  return base || (typeof window !== 'undefined' ? window.location.origin : '');
}

export default function SeoPanel({ resourceKey, id, rec, seo, set }: {
  resourceKey: string;            // 'properties' … or 'homepage'
  id: number | null;
  rec: Rec;                       // the full record (content used for suggestions/score)
  seo: Rec;                       // the SEO values (same object as rec for resources; rec.seo for the homepage)
  set: (name: string, v: unknown) => void;
}) {
  const kind = KIND[resourceKey];
  const base = useBaseUrl();
  const [dups, setDups] = useState<Dup[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [showChecks, setShowChecks] = useState(false);

  const sug = useMemo(() => suggestSeo(kind, resourceKey === 'homepage' ? rec : rec), [kind, rec, resourceKey]);
  const title = String(seo.seo_title || '');
  const desc = String(seo.meta_description || '');
  const slug = resourceKey === 'homepage' ? '' : String(rec.slug || '');
  const path = resourceKey === 'homepage' ? '/' : `${PATH[resourceKey]}${slug || sug.slug}`;
  const shownUrl = (seo.canonical_url ? (String(seo.canonical_url).startsWith('http') ? seo.canonical_url : `${base}/${String(seo.canonical_url).replace(/^\//, '')}`) : `${base}${path}`);

  // Duplicate check (debounced).
  useEffect(() => {
    if (!title && !desc && !slug) { setDups([]); return; }
    const t = setTimeout(() => {
      api<{ duplicates: Dup[] }>('/api/admin/seo/check', { body: { resource: resourceKey, id, slug, seo_title: title, meta_description: desc } })
        .then((r) => setDups(r.duplicates)).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [resourceKey, id, slug, title, desc]);

  const facts = pageFacts(resourceKey, rec);
  const score = scoreSeo({ rec: seo, ...facts, slug: resourceKey === 'homepage' ? undefined : slug, duplicates: dups.length, internalLinks: true });
  const gradeTone = score.grade === 'Good' ? 'ok' : score.grade === 'Poor' ? 'red' : 'warn';

  const rows: { field: string; label: string; value: string }[] = [
    { field: 'seo_title', label: 'SEO title', value: sug.seo_title },
    { field: 'meta_description', label: 'Meta description', value: sug.meta_description },
    ...('slug' in rec && resourceKey !== 'homepage' ? [{ field: 'slug', label: 'URL slug', value: sug.slug }] : []),
    ...('image_alt_text' in seo || resourceKey !== 'videos' ? [{ field: 'image_alt_text', label: resourceKey === 'videos' ? 'Thumbnail alt text' : 'Image alt text', value: sug.image_alt_text }] : []),
  ].filter((r) => r.value);
  const current = (f: string) => String((f === 'slug' ? rec.slug : seo[f]) ?? '');
  const useAllEmpty = () => rows.forEach((r) => { if (!current(r.field).trim()) set(r.field, r.value); });

  return (
    <div className="span-6" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Google preview */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '14px 16px', background: '#fff' }}>
        <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Google preview</div>
        <div style={{ maxWidth: 600, fontFamily: 'arial, sans-serif' }}>
          <div style={{ fontSize: 13, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shownUrl}</div>
          <div style={{ fontSize: 20, color: '#1a0dab', lineHeight: 1.3, margin: '3px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title || sug.seo_title}{!title && <span className="muted" style={{ fontSize: 12, marginLeft: 6 }}>(automatic)</span>}
          </div>
          <div style={{ fontSize: 14, color: '#4d5156', lineHeight: 1.58 }}>
            {(desc || sug.meta_description).length > 160 ? `${(desc || sug.meta_description).slice(0, 157)}…` : desc || sug.meta_description}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <FieldWrap label="SEO title" htmlFor="f-seo_title" className="span-6">
          <input id="f-seo_title" className="input" value={title} maxLength={120} placeholder={sug.seo_title} onChange={(e) => set('seo_title', e.target.value)} />
          <Counter value={title} min={LIMITS.title.min} max={LIMITS.title.max} />
        </FieldWrap>
        <FieldWrap label="Meta description" htmlFor="f-meta_description" className="span-6">
          <textarea id="f-meta_description" className="textarea" rows={3} value={desc} maxLength={320} placeholder={sug.meta_description} onChange={(e) => set('meta_description', e.target.value)} />
          <Counter value={desc} min={LIMITS.description.min} max={LIMITS.description.max} />
        </FieldWrap>
      </div>

      {dups.length > 0 && (
        <div className="alert err" role="alert" style={{ flexDirection: 'column', gap: 4 }}>
          <b><CircleAlert size={16} style={{ verticalAlign: '-3px' }} /> Duplicate content detected</b>
          {dups.map((d, i) => (
            <span key={i} style={{ fontWeight: 500 }}>
              Same {d.field === 'seo_title' ? 'SEO title' : d.field === 'meta_description' ? 'meta description' : 'URL slug'} as{' '}
              {d.href ? <Link href={d.href} style={{ textDecoration: 'underline' }}>{d.where}</Link> : d.where}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-sm" onClick={() => setShowSug((s) => !s)}><Sparkles size={15} />{showSug ? 'Hide suggestions' : 'Generate SEO suggestion'}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowChecks((s) => !s)} aria-expanded={showChecks}>
          SEO score: <span className={`badge ${gradeTone}`} style={{ marginLeft: 6 }}>{score.grade}</span>
          <span className="muted" style={{ marginLeft: 6 }}>{score.passed}/{score.total} checks</span>
        </button>
      </div>

      {showSug && (
        <div style={{ border: '1px dashed var(--line-strong)', borderRadius: 'var(--radius)', padding: 14, background: 'var(--surface-2)' }}>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>Suggestions from this page’s content. Nothing changes until you click <b>Use</b> — then review and save.</p>
          {rows.map((r) => (
            <div key={r.field} style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: 10, alignItems: 'start', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</span>
              <span style={{ fontSize: 13.5, wordBreak: 'break-word' }}>{r.value}
                {current(r.field) && current(r.field) !== r.value && <span className="muted" style={{ display: 'block', fontSize: 12 }}>Current: {current(r.field)}</span>}
                {r.field === 'slug' && rec.id && current('slug') && current('slug') !== r.value && <span style={{ display: 'block', fontSize: 12, color: 'var(--warn)' }}>Changing the slug changes this page’s address.</span>}
              </span>
              <button type="button" className="btn btn-sm" disabled={current(r.field) === r.value} onClick={() => set(r.field, r.value)}>Use</button>
            </div>
          ))}
          <div style={{ marginTop: 8 }}><button type="button" className="btn btn-sm btn-ghost" onClick={useAllEmpty}>Fill empty fields only</button></div>
        </div>
      )}

      {showChecks && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
          {score.checks.map((c) => (
            <li key={c.label} style={{ display: 'flex', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
              {c.ok ? <CircleCheck size={17} color="var(--ok)" /> : <CircleAlert size={17} color="var(--warn)" />}
              <span><span style={{ fontWeight: 500 }}>{c.label}</span>{!c.ok && c.hint && <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{c.hint}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
