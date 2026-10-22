'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from './api';
import { ImageInput } from './media';
import { FieldWrap, Switch, useToast, useUnsavedWarning } from './ui';
import { TagsInput } from './inputs';
import SeoPanel, { Counter } from './SeoPanel';
import { LIMITS } from '@/lib/seo/suggest';

type Data = Record<string, any>;

/** Load + save one of the singleton documents (homepage, contact, social, settings). */
function useDoc(name: string) {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  useUnsavedWarning(dirty);
  useEffect(() => { api(`/api/admin/content/${name}`).then(setData).catch((e) => setLoadErr(e.message)); }, [name]);

  /** Set a value at a dotted path, e.g. "hero.heading" or "offices.0.address". */
  const set = (path: string, v: unknown) => {
    setData((d) => {
      const next = structuredClone(d!);
      const keys = path.split('.');
      let o: any = next;
      for (const k of keys.slice(0, -1)) o = o[k];
      o[keys[keys.length - 1]] = v;
      return next;
    });
    setDirty(true);
    setErrors((e) => ({ ...e, [path]: '' }));
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setFormErr('');
    try {
      setData(await api(`/api/admin/content/${name}`, { method: 'PUT', body: data }));
      setErrors({}); setDirty(false);
      toast('Saved — the website updates within a minute.');
    } catch (err) {
      const ae = err as ApiError;
      setErrors(ae.fields || {}); setFormErr(ae.message); toast(ae.message, 'err');
    } finally { setSaving(false); }
  }
  return { data, set, errors, formErr, saving, dirty, save, loadErr };
}

type Doc = ReturnType<typeof useDoc>;

function Shell({ doc, title, desc, children, preview }: { doc: Doc; title: string; desc: string; children: ReactNode; preview?: string }) {
  if (doc.loadErr) return <div className="alert err">{doc.loadErr}</div>;
  if (!doc.data) return <div className="loading-block"><span className="spinner" /></div>;
  return (
    <form onSubmit={doc.save} noValidate>
      <div className="page-head">
        <div><h1>{title}</h1><p>{desc}</p></div>
        {preview && <a className="btn" href={preview} target="_blank" rel="noreferrer"><ExternalLink size={16} />View on website</a>}
      </div>
      {doc.formErr && <div className="alert err" style={{ marginBottom: 16 }} role="alert">{doc.formErr}</div>}
      {children}
      <div className="savebar">
        <span className="note">{doc.dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button className="btn btn-primary" disabled={doc.saving}>{doc.saving ? <span className="spinner" /> : <Save size={16} />}Save changes</button>
      </div>
    </form>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head"><div><h2>{title}</h2>{desc && <p>{desc}</p>}</div></div>
      <div className="card-body"><div className="form-grid">{children}</div></div>
    </section>
  );
}

function Text({ doc, path, label, span = 6, help, type = 'text', max, area, placeholder, limit }: {
  doc: Doc; path: string; label: string; span?: 2 | 3 | 6; help?: string; type?: string; max?: number; area?: boolean; placeholder?: string;
  /** Show a green / orange / red length counter for this range. */
  limit?: { min: number; max: number };
}) {
  const v = path.split('.').reduce((o: any, k) => o?.[k], doc.data) ?? '';
  const err = doc.errors[path];
  const id = `f-${path.replace(/\./g, '-')}`;
  const counter = !limit && max && String(v).length > max * 0.8 ? `${String(v).length}/${max}` : '';
  return (
    <FieldWrap label={label} help={[help, counter].filter(Boolean).join(' · ')} error={err} className={`span-${span}`} htmlFor={id}>
      {area
        ? <textarea id={id} className={`textarea ${err ? 'invalid' : ''}`} value={v} maxLength={max} placeholder={placeholder} rows={4} onChange={(e) => doc.set(path, e.target.value)} />
        : <input id={id} className={`input ${err ? 'invalid' : ''}`} type={type} value={v} maxLength={max} placeholder={placeholder} onChange={(e) => doc.set(path, e.target.value)} />}
      {limit && <Counter value={String(v)} min={limit.min} max={limit.max} />}
    </FieldWrap>
  );
}

function Img({ doc, path, label, help }: { doc: Doc; path: string; label: string; help?: string }) {
  const v = path.split('.').reduce((o: any, k) => o?.[k], doc.data) || null;
  return (
    <FieldWrap label={label} help={help} error={doc.errors[path]} className="span-6">
      <ImageInput value={v} onChange={(u) => doc.set(path, u ?? '')} />
    </FieldWrap>
  );
}

/** Editable list of rows with two text fields each, plus reorder/remove. */
function Repeater({ doc, path, fields, addLabel, max, wide }: {
  doc: Doc; path: string; fields: { key: string; label: string; placeholder?: string; max?: number }[]; addLabel: string; max: number; wide?: boolean;
}) {
  const items: Data[] = path.split('.').reduce((o: any, k) => o?.[k], doc.data) || [];
  const update = (next: Data[]) => doc.set(path, next);
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= items.length) return;
    const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; update(n);
  };
  return (
    <div className="span-6 rows">
      {items.map((it, i) => (
        <div className={`row-item ${wide ? 'wide' : ''}`} key={i}>
          {fields.map((f) => {
            const err = doc.errors[`${path}.${i}.${f.key}`];
            return (
              <div className="field" key={f.key}>
                <input className={`input ${err ? 'invalid' : ''}`} aria-label={`${f.label} ${i + 1}`} placeholder={f.placeholder || f.label} maxLength={f.max}
                  value={it[f.key] ?? ''} onChange={(e) => update(items.map((x, k) => (k === i ? { ...x, [f.key]: e.target.value } : x)))} />
                {err && <span className="err">{err}</span>}
              </div>
            );
          })}
          <div className="ctl">
            <button type="button" className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="icon-btn" title="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            <button type="button" className="icon-btn" title="Remove" onClick={() => update(items.filter((_, k) => k !== i))}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <div><button type="button" className="btn btn-sm" onClick={() => update([...items, Object.fromEntries(fields.map((f) => [f.key, '']))])}><Plus size={14} />{addLabel}</button></div>
      )}
    </div>
  );
}

function Tabs({ tab, setTab, tabs }: { tab: string; setTab: (t: string) => void; tabs: string[] }) {
  return (
    <div className="status-pills" role="tablist" style={{ marginBottom: 16 }}>
      {tabs.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
    </div>
  );
}

export function HomepageForm() {
  const doc = useDoc('homepage');
  const [tab, setTab] = useState('Content');
  const seo = doc.data?.seo || {};
  return (
    <Shell doc={doc} title="Homepage" desc="Edit the text and images on the public homepage. The layout and design stay the same." preview="/index.html">
      <Tabs tab={tab} setTab={setTab} tabs={['Content', 'SEO']} />
      {tab === 'SEO' && doc.data && (
        <Card title="Homepage SEO" desc="Rendered into the homepage’s page source: title, description, canonical, social tags and structured data.">
          <SeoPanel resourceKey="homepage" id={null} rec={doc.data} seo={seo} set={(name, v) => doc.set(`seo.${name}`, v)} />
          <Text doc={doc} path="seo.focus_keyword" label="Focus keyword" span={3} max={80} placeholder="real estate hyderabad" />
          <FieldWrap label="Secondary keywords" className="span-3">
            <TagsInput value={seo.secondary_keywords || []} onChange={(v) => doc.set('seo.secondary_keywords', v)} />
          </FieldWrap>
          <Text doc={doc} path="seo.canonical_url" label="Canonical URL" placeholder="Leave empty to use the site address" help="Leave empty unless this page must point at another address." />
          <Text doc={doc} path="seo.og_title" label="Social share title (OG)" max={120} limit={LIMITS.og_title} />
          <Text doc={doc} path="seo.og_description" label="Social share description (OG)" area max={300} limit={LIMITS.og_description} />
          <Img doc={doc} path="seo.og_image" label="Social share image (OG)" help="1200×630 px works best. Defaults to the hero image, then the global default." />
          <Text doc={doc} path="seo.image_alt_text" label="Image alt text" max={160} />
          <div className="field span-3"><Switch checked={seo.is_indexed !== false} onChange={(v) => doc.set('seo.is_indexed', v)} label="Index (show in search results)" /></div>
          <div className="field span-3"><Switch checked={seo.is_followed !== false} onChange={(v) => doc.set('seo.is_followed', v)} label="Follow links" /></div>
        </Card>
      )}
      <div hidden={tab !== 'Content'}>
      <Card title="Hero section" desc="The first thing visitors see.">
        <Text doc={doc} path="hero.location_text" label="Location text" placeholder="Canada · Hyderabad · Visakhapatnam" max={120} />
        <Text doc={doc} path="hero.heading" label="Main heading" area max={120} help="Each line becomes a line of the big heading; the middle line of three is shown in outline style." />
        <Text doc={doc} path="hero.description" label="Hero description" area max={600} />
        <Text doc={doc} path="hero.button_text" label="Primary button text" span={3} max={40} />
        <Text doc={doc} path="hero.button_url" label="Primary button URL" span={3} placeholder="services.html" help="A page like services.html, or a full https:// link." />
        <Img doc={doc} path="hero.image" label="Hero image" help="Optional. Replaces the illustrated towers on the right of the hero. Leave empty to keep the illustration." />
      </Card>
      <Card title="Top bar" desc="The thin bar above the menu on every page.">
        <Text doc={doc} path="topbar.phone" label="Phone number" span={3} type="tel" />
        <Text doc={doc} path="topbar.whatsapp" label="WhatsApp number" span={3} type="tel" help="With country code, e.g. 919963206933." />
        <Text doc={doc} path="topbar.email" label="Email address" span={3} type="email" />
        <Text doc={doc} path="topbar.location_text" label="Location text" span={3} max={120} />
      </Card>
      <Card title="Navigation" desc="Menu labels and links. Leave as-is unless you need to rename a page. Removing every item restores the built-in menu.">
        <Repeater doc={doc} path="navigation.items" addLabel="Add menu item" max={12} wide
          fields={[{ key: 'label', label: 'Label', max: 40 }, { key: 'href', label: 'Link', placeholder: 'about.html' }]} />
      </Card>
      <Card title="About section" desc="Shown in “Who We Are” on the About page.">
        <Text doc={doc} path="about.heading" label="Section heading" max={160} />
        <Text doc={doc} path="about.short_description" label="Short description" area max={1500} />
        <Text doc={doc} path="about.company_description" label="Company description" area max={5000} />
        <Img doc={doc} path="about.image" label="About image" />
      </Card>
      <Card title="Statistics" desc="The figures band on the homepage (up to 6).">
        <Repeater doc={doc} path="stats.items" addLabel="Add statistic" max={6} wide
          fields={[{ key: 'value', label: 'Value', placeholder: '1,200+', max: 20 }, { key: 'label', label: 'Label', placeholder: 'Families Served', max: 60 }]} />
      </Card>
      </div>
    </Shell>
  );
}

export function ContactForm() {
  const doc = useDoc('contact');
  return (
    <Shell doc={doc} title="Contact Details" desc="Used in the header, footer, contact page and WhatsApp button." preview="/contact.html">
      <Card title="Phone & email">
        <Text doc={doc} path="canada_phone" label="Canada phone" span={3} type="tel" placeholder="+1 905 …" />
        <Text doc={doc} path="india_phone" label="India phone" span={3} type="tel" placeholder="+91 …" />
        <Text doc={doc} path="whatsapp" label="WhatsApp" span={3} type="tel" help="With country code, e.g. 919963206933." />
        <Text doc={doc} path="email" label="Email" span={3} type="email" />
        <Text doc={doc} path="business_hours" label="Business hours" placeholder="Mon–Sat 9am–7pm" max={200} />
      </Card>
      <Card title="Office addresses" desc="The first office is shown in the footer and on the contact page.">
        <Repeater doc={doc} path="offices" addLabel="Add office" max={6} wide
          fields={[{ key: 'label', label: 'Office name', placeholder: 'Hyderabad', max: 60 }, { key: 'address', label: 'Address', max: 300 }]} />
      </Card>
    </Shell>
  );
}

const SOCIAL: [string, string, string][] = [
  ['instagram', 'Instagram', 'https://www.instagram.com/…'],
  ['facebook', 'Facebook', 'https://www.facebook.com/…'],
  ['youtube', 'YouTube', 'https://www.youtube.com/@…'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/…'],
  ['x', 'X (Twitter)', 'https://x.com/…'],
  ['whatsapp', 'WhatsApp link', 'https://wa.me/919963206933'],
];

export function SocialForm() {
  const doc = useDoc('social');
  return (
    <Shell doc={doc} title="Social Media" desc="Profiles linked from the footer and contact page. Leave a field empty to hide that icon.">
      <Card title="Profiles">
        {SOCIAL.map(([k, label, ph]) => <Text key={k} doc={doc} path={k} label={label} span={3} type="url" placeholder={ph} />)}
      </Card>
    </Shell>
  );
}

export function SettingsForm() {
  const doc = useDoc('settings');
  return (
    <Shell doc={doc} title="Settings" desc="Branding, search-engine and tracking settings for the public website.">
      <Card title="Branding">
        <Text doc={doc} path="site_name" label="Website name" max={80} />
        <Img doc={doc} path="logo" label="Website logo" help="Optional. Replaces the header logo. Leave empty to keep the current logo." />
        <Img doc={doc} path="favicon" label="Favicon" help="Square image, at least 64×64 px." />
      </Card>
      <Card title="SEO" desc="Site-wide defaults. Pages use their own SEO fields first and fall back to these.">
        <Text doc={doc} path="seo_title" label="Default SEO title" max={120} limit={LIMITS.title} />
        <Text doc={doc} path="seo_description" label="Default meta description" area max={320} limit={LIMITS.description} />
        <Text doc={doc} path="default_og_title" label="Default OG title" max={120} limit={LIMITS.og_title} />
        <Text doc={doc} path="default_og_description" label="Default OG description" area max={300} limit={LIMITS.og_description} />
        <Img doc={doc} path="default_og_image" label="Default OG image" help="Used when a page has no image of its own. 1200×630 px works best." />
        <Img doc={doc} path="default_twitter_image" label="Default Twitter / X image" help="Optional — defaults to the OG image." />
        <Text doc={doc} path="canonical_base_url" label="Canonical base URL" placeholder="https://www.gethomerealty.ca" help="The live site address used in canonical tags, the sitemap and social links." />
        <FieldWrap label="Default robots setting" className="span-6" error={doc.errors.default_robots}
          help="“noindex” hides the whole site from search engines (use only for a staging copy).">
          <select className="select" value={doc.data?.default_robots || 'index,follow'} onChange={(e) => doc.set('default_robots', e.target.value)}>
            <option value="index,follow">Index, follow (recommended)</option>
            <option value="index,nofollow">Index, nofollow</option>
            <option value="noindex,follow">Noindex, follow</option>
            <option value="noindex,nofollow">Noindex, nofollow</option>
          </select>
        </FieldWrap>
        <Text doc={doc} path="google_site_verification" label="Google Search Console verification code" span={3} placeholder="the content=&quot;…&quot; value" />
        <Text doc={doc} path="bing_site_verification" label="Bing Webmaster verification code" span={3} placeholder="the content=&quot;…&quot; value" />
      </Card>
      <Card title="Tracking & email">
        <Text doc={doc} path="google_analytics_id" label="Google Analytics ID" span={3} placeholder="G-XXXXXXXXXX" />
        <Text doc={doc} path="facebook_pixel_id" label="Facebook Pixel ID" span={3} placeholder="123456789012345" />
        <Text doc={doc} path="default_contact_email" label="Default contact email" type="email" />
      </Card>
    </Shell>
  );
}
