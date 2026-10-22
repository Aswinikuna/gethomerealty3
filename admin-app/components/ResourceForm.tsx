'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from './api';
import { GalleryInput, ImageInput, PdfInput, type GalleryItem } from './media';
import { FaqsInput, TagsInput } from './inputs';
import { AmenityItemsInput, ConnectivityInput, FloorPlansInput, PairsInput } from './ProjectInputs';
import SeoPanel from './SeoPanel';
import { slugify } from '@/lib/seo/suggest';
import { Confirm, FieldWrap, fmtDate, RatingInput, Switch, useToast, useUnsavedWarning } from './ui';
import { formatMoney, priceSpread, RESOURCES, SEO_PANEL_FIELDS, type Field, type Resource } from '@/lib/resources';
import { useRole } from './AdminShell';

type Rec = Record<string, any>;
const LIST_TYPES = new Set(['tags', 'faqs', 'pairs', 'floorplans', 'amenityItems', 'connectivity']);

function blank(r: Resource): Rec {
  const rec: Rec = {};
  for (const f of r.fields) {
    if (f.type === 'bool') rec[f.name] = ['is_active', 'is_published', 'is_approved', 'is_indexed', 'is_followed'].includes(f.name);
    else if (LIST_TYPES.has(f.type)) rec[f.name] = [];
    else if (f.type === 'rating') rec[f.name] = 5;
    else if (f.type === 'select' && f.required) rec[f.name] = f.options?.[0]?.value ?? '';
    else if (f.name === 'currency') rec[f.name] = 'INR';
    else if (f.name === 'display_order') rec[f.name] = 0;
    else rec[f.name] = '';
  }
  rec.galleries = Object.fromEntries((r.galleries || []).map((g) => [g.name, []]));
  return rec;
}

/** Where this record appears on the public site, if it has a page of its own. */
function publicLink(r: Resource, rec: Rec) {
  if (!rec.id || !rec.slug) return null;
  if (!r.seo || !rec[r.seo.publishedField]) return null;
  return `${r.seo.path}${encodeURIComponent(rec.slug)}`;
}

export default function ResourceForm({ resourceKey, id }: { resourceKey: string; id: string }) {
  const base = RESOURCES[resourceKey];
  const role = useRole();
  // Internal prices are never shown to (or sent by) non-admin roles.
  const r = role === 'admin' ? base : { ...base, fields: base.fields.filter((f) => !f.confidential) };
  const isNew = id === 'new';
  const router = useRouter();
  const toast = useToast();
  const [rec, setRec] = useState<Rec | null>(isNew ? blank(r) : null);
  const [loadErr, setLoadErr] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [tab, setTab] = useState(r.sections[0]);
  const sectionOf = (key: string) => r.fields.find((f) => f.name === key.split('.')[0])?.section
    ?? r.galleries?.find((g) => `galleries.${g.name}` === key.split('.').slice(0, 2).join('.'))?.section;
  const errorCount = (sec: string) => Object.entries(errors).filter(([k, v]) => v && sectionOf(k) === sec).length;
  const [deleting, setDeleting] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    if (isNew) return;
    api<Rec>(`/api/admin/r/${r.key}/${id}`).then((d) => {
      for (const f of r.fields) if (d[f.name] == null && f.type !== 'bool') d[f.name] = LIST_TYPES.has(f.type) ? [] : '';
      setRec(d);
    }).catch((e) => setLoadErr((e as Error).message));
  }, [r, id, isNew]);

  const set = (name: string, v: unknown) => { setRec((x) => ({ ...x!, [name]: v })); setDirty(true); setErrors((e) => ({ ...e, [name]: '' })); };
  const setGallery = (name: string, v: GalleryItem[]) => { setRec((x) => ({ ...x!, galleries: { ...x!.galleries, [name]: v } })); setDirty(true); };

  function clientCheck(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const f of r.fields) {
      const v = rec![f.name];
      if (f.required && (v === '' || v == null)) errs[f.name] = `${f.label} is required.`;
      if (f.type === 'number' && v !== '' && v != null && Number.isNaN(Number(v))) errs[f.name] = 'Enter a number.';
    }
    return errs;
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!rec) return;
    const errs = clientCheck();
    setErrors(errs); setFormErr('');
    if (Object.keys(errs).length) {
      setFormErr('Please fix the highlighted fields.');
      const first = Object.keys(errs)[0];
      if (r.tabs) setTab(sectionOf(first) || tab);
      setTimeout(() => document.getElementById(`f-${first}`)?.focus(), 0);
      return;
    }
    const body: Rec = { galleries: rec.galleries };
    for (const f of r.fields) body[f.name] = rec[f.name];
    setSaving(true);
    try {
      const saved = isNew
        ? await api<Rec>(`/api/admin/r/${r.key}`, { body })
        : await api<Rec>(`/api/admin/r/${r.key}/${id}`, { method: 'PATCH', body });
      setDirty(false);
      toast(isNew ? `${r.singular} created` : 'Changes saved');
      if (isNew) router.replace(`/admin/${r.key}/${saved.id}`);
      else setRec((x) => ({ ...x!, ...saved, galleries: saved.galleries ?? x!.galleries }));
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.fields || {});
      setFormErr(ae.message);
      const first = Object.keys(ae.fields || {})[0];
      if (r.tabs && first && sectionOf(first)) setTab(sectionOf(first)!);
      toast(ae.message, 'err');
    } finally { setSaving(false); }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await api(`/api/admin/r/${r.key}/${id}`, { method: 'DELETE' });
      setDirty(false);
      toast(`${r.singular} deleted`);
      router.replace(`/admin/${r.key}`);
    } catch (e) { toast((e as Error).message, 'err'); setDeleting(false); }
  }

  if (loadErr) return <div className="alert err">{loadErr} <Link className="link" href={`/admin/${r.key}`}>Back to {r.label.toLowerCase()}</Link></div>;
  if (!rec) return <div className="loading-block"><span className="spinner" /></div>;

  const title = isNew ? `Add ${r.singular.toLowerCase()}` : rec[r.titleField] || r.singular;
  const live = publicLink(r, rec);

  return (
    <form onSubmit={save} noValidate>
      <div className="page-head">
        <div>
          <div className="crumbs"><Link href={`/admin/${r.key}`}>{r.label}</Link><span>/</span><span>{isNew ? 'New' : 'Edit'}</span></div>
          <h1>{title}</h1>
        </div>
        <div className="actions">
          {live && <a className="btn" href={live} target="_blank" rel="noreferrer"><ExternalLink size={16} />View on website</a>}
          {!isNew && <button type="button" className="btn btn-danger" onClick={() => setAskDelete(true)}><Trash2 size={16} />Delete</button>}
        </div>
      </div>

      {formErr && <div className="alert err" style={{ marginBottom: 16 }} role="alert">{formErr}</div>}

      {r.tabs && (
        <div className="status-pills" role="tablist" aria-label="Sections" style={{ marginBottom: 16 }}>
          {r.sections.map((sec, i) => (
            <button key={sec} type="button" role="tab" aria-selected={tab === sec} className={tab === sec ? 'on' : ''} onClick={() => setTab(sec)}>
              {i < 8 && r.key === 'projects' ? `${i + 1}. ` : ''}{sec}{errorCount(sec) > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>●</span>}
            </button>
          ))}
        </div>
      )}

      {r.sections.map((sec) => {
        const isSeo = sec === 'SEO';
        // Title + description live inside the SEO panel (preview, counters, suggestions).
        const fields = r.fields.filter((f) => f.section === sec && !(isSeo && SEO_PANEL_FIELDS.includes(f.name)));
        const gals = (r.galleries || []).filter((g) => g.section === sec);
        // Uploaded files get descriptive names, e.g. "godrej-neopolis-hyderabad-…webp".
        const nameHint = slugify([rec[r.titleField], rec.city].filter(Boolean).join(' '));
        return (
          <section className="card" key={sec} hidden={!!r.tabs && tab !== sec}>
            <div className="card-head"><div><h2>{isSeo ? 'SEO' : sec}</h2>{isSeo && r.seo && <p>How this page appears in Google and when shared. Leave fields empty to use the automatic values shown as placeholders.</p>}</div></div>
            <div className="card-body">
              <div className="form-grid">
                {isSeo && r.seo && <SeoPanel resourceKey={r.key} id={isNew ? null : Number(id)} rec={rec} seo={rec} set={set} />}
                {fields.map((f) => <FieldInput key={f.name} f={f} value={rec[f.name]} error={errors[f.name]} isNew={isNew} nameHint={nameHint} onChange={(v) => set(f.name, v)} />)}
                {fields.some((f) => f.name === 'brokerage_price') && <PricingSummary rec={rec} r={r} onUse={(v) => set(r.key === 'projects' ? 'public_price' : 'price', v)} />}
                {gals.map((g) => (
                  <FieldWrap key={g.name} label={g.label} help={g.help} error={errors[`galleries.${g.name}`]} className="span-6">
                    <GalleryInput value={rec.galleries?.[g.name] || []} max={g.max} nameHint={`${nameHint}${g.kind === 'floorplan' ? '-floor-plan' : ''}`} onChange={(v) => setGallery(g.name, v)} />
                  </FieldWrap>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <div className="savebar">
        <span className="note">
          {dirty ? 'Unsaved changes' : !isNew && rec.updated_at ? `Last saved ${fmtDate(rec.updated_at)}` : ''}
        </span>
        <Link className="btn" href={`/admin/${r.key}`}>Cancel</Link>
        <button className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : <Save size={16} />}{isNew ? `Create ${r.singular.toLowerCase()}` : 'Save changes'}</button>
      </div>

      <Confirm open={askDelete} busy={deleting} title={`Delete this ${r.singular.toLowerCase()}?`}
        body={<>“{rec[r.titleField]}” and its images will be removed. This can’t be undone.</>}
        onConfirm={doDelete} onCancel={() => setAskDelete(false)} />
    </form>
  );
}

function FieldInput({ f, value, error, onChange, isNew, nameHint = '' }: { f: Field; value: any; error?: string; onChange: (v: any) => void; isNew: boolean; nameHint?: string }) {
  const id = `f-${f.name}`;
  const cls = `span-${f.span || 6}`;
  const inv = error ? 'invalid' : '';
  const common = { id, 'aria-invalid': !!error || undefined };
  if (f.type === 'bool') {
    return (
      <div className={`field ${cls}`} style={{ justifyContent: 'flex-end' }}>
        <Switch checked={!!value} onChange={onChange} label={f.label} />
        {f.help && <span className="help">{f.help}</span>}
      </div>
    );
  }
  let input: React.ReactNode;
  switch (f.type) {
    case 'textarea':
      input = <textarea {...common} className={`textarea ${inv}`} value={value ?? ''} maxLength={f.maxLength} rows={f.maxLength && f.maxLength > 2000 ? 7 : 4} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      input = (
        <select {...common} className={`select ${inv}`} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">—</option>}
          {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'number':
      input = <input {...common} className={`input ${inv}`} type="number" inputMode="decimal" step={f.integer ? 1 : 'any'} min={f.min} max={f.max} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} />;
      break;
    case 'image':
      input = <ImageInput id={id} value={value || null} nameHint={f.name === 'og_image' ? `${nameHint}-social` : nameHint} onChange={(v) => onChange(v ?? '')} />;
      break;
    case 'file':
      input = <PdfInput id={id} value={value || null} nameHint={`${nameHint}-brochure`} onChange={(v) => onChange(v ?? '')} />;
      break;
    case 'tags':
      input = <TagsInput id={id} value={value || []} onChange={onChange} />;
      break;
    case 'faqs':
      input = <FaqsInput id={id} value={value || []} onChange={onChange} />;
      break;
    case 'pairs':
      input = <PairsInput value={value || []} onChange={onChange} />;
      break;
    case 'floorplans':
      input = <FloorPlansInput value={value || []} onChange={onChange} nameHint={nameHint} />;
      break;
    case 'amenityItems':
      input = <AmenityItemsInput value={value || []} onChange={onChange} nameHint={nameHint} />;
      break;
    case 'connectivity':
      input = <ConnectivityInput value={value || []} onChange={onChange} />;
      break;
    case 'rating':
      input = <RatingInput value={Number(value) || 0} onChange={onChange} />;
      break;
    case 'slug':
      input = <input {...common} className={`input ${inv}`} value={value ?? ''} placeholder={isNew ? 'auto' : ''} maxLength={80} onChange={(e) => onChange(e.target.value.toLowerCase())} />;
      break;
    default: {
      const type = f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : 'text';
      input = <input {...common} className={`input ${inv}`} type={type} value={value ?? ''} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
    }
  }
  return <FieldWrap label={f.label} required={f.required} help={f.help} error={error} className={cls} htmlFor={id}>{input}</FieldWrap>;
}

/** Live builder vs brokerage comparison, plus exactly what visitors will see. Admin-only. */
function PricingSummary({ rec, r, onUse }: { rec: Rec; r: Resource; onUse: (v: number) => void }) {
  const cur = rec.currency || 'INR';
  const pub = r.key === 'projects' ? rec.public_price : rec.price;
  const pubText = r.key === 'projects'
    ? rec.starting_price || (pub !== '' && pub != null ? `Starting from ${formatMoney(pub, cur)}` : '')
    : rec.price_label || (pub !== '' && pub != null ? formatMoney(pub, cur) : '');
  const sp = priceSpread(rec.builder_price, rec.brokerage_price);
  const below = pub !== '' && pub != null && rec.brokerage_price !== '' && rec.brokerage_price != null && Number(pub) < Number(rec.brokerage_price);
  const cell = (label: string, value: React.ReactNode, tone?: string) => (
    <div><div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: tone }}>{value}</div></div>
  );
  return (
    <div className="span-6" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface-2)', padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
        {cell('Builder price', formatMoney(rec.builder_price === '' ? null : rec.builder_price, cur) || '—')}
        {cell('Brokerage price', formatMoney(rec.brokerage_price === '' ? null : rec.brokerage_price, cur) || '—')}
        {cell('Difference', sp ? formatMoney(sp.diff, cur) : '—', sp ? (sp.diff >= 0 ? 'var(--ok)' : 'var(--accent)') : undefined)}
        {cell('Savings', sp && sp.pct != null && sp.diff > 0 ? `${sp.pct.toFixed(1)}%` : '—')}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="muted">Website visitors see:</span>
        <b>{pubText || <span className="muted" style={{ fontWeight: 500 }}>{r.key === 'projects' ? 'On request' : 'no price'}</span>}</b>
        {rec.brokerage_price !== '' && rec.brokerage_price != null && (
          <button type="button" className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onUse(Number(rec.brokerage_price))}>
            Use brokerage price as public price
          </button>
        )}
      </div>
      <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
        Builder and brokerage prices are internal: they are never sent to the website. Only the public display price is published.
        {below && <span style={{ color: 'var(--warn)', fontWeight: 600 }}> The public price is below the brokerage price.</span>}
      </p>
    </div>
  );
}
