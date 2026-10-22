'use client';
// Structured list editors for the project presentation slides: details rows,
// floor plans, amenities and connectivity. Every list supports add / reorder / delete.
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { ImageInput } from './media';
import { AMENITY_ICONS, CONNECTIVITY_CATEGORIES } from '@/lib/resources';
import { slugify } from '@/lib/seo/suggest';

type Item = Record<string, string>;

function ListEditor<T extends Item>({ items, onChange, blank, max, addLabel, render, title }: {
  items: T[]; onChange: (v: T[]) => void; blank: T; max: number; addLabel: string;
  render: (it: T, set: (k: keyof T, v: string) => void, i: number) => ReactNode;
  title?: (it: T, i: number) => string;
}) {
  const list = items || [];
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  return (
    <div className="rows">
      {list.map((it, i) => (
        <div key={i} className="card" style={{ padding: 14, boxShadow: 'none', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 13 }}>{i + 1}. {title ? title(it, i) : ''}</b>
            <span style={{ flex: 1 }} />
            <button type="button" className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="icon-btn" title="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            <button type="button" className="icon-btn" title="Delete" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
          </div>
          {render(it, (k, v) => onChange(list.map((x, j) => (j === i ? { ...x, [k]: v } : x))), i)}
        </div>
      ))}
      {list.length < max
        ? <div><button type="button" className="btn btn-sm" onClick={() => onChange([...list, { ...blank }])}><Plus size={14} />{addLabel}</button></div>
        : <p className="help">Maximum of {max} reached.</p>}
    </div>
  );
}

const In = ({ label, value, onChange, placeholder, span = 2, max = 120 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; span?: number; max?: number }) => (
  <div className={`field span-${span}`}>
    <label style={{ fontSize: 12.5 }}>{label}</label>
    <input className="input" value={value || ''} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
  </div>
);

/** Label → value rows (Project Details). */
export function PairsInput({ value, onChange }: { value: Item[]; onChange: (v: Item[]) => void }) {
  return (
    <ListEditor items={value} onChange={onChange} blank={{ label: '', value: '' }} max={80} addLabel="Add detail"
      title={(it) => it.label || 'New detail'}
      render={(it, set) => (
        <div className="form-grid">
          <In label="Label" value={it.label} onChange={(v) => set('label', v)} placeholder="TS RERA" max={80} />
          <div className="field span-4"><label style={{ fontSize: 12.5 }}>Value</label>
            <textarea className="textarea" rows={2} style={{ minHeight: 44 }} maxLength={600} value={it.value || ''} placeholder="P02400006086" onChange={(e) => set('value', e.target.value)} /></div>
        </div>
      )} />
  );
}

const FACINGS = ['', 'East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];

export function FloorPlansInput({ value, onChange, nameHint = '' }: { value: Item[]; onChange: (v: Item[]) => void; nameHint?: string }) {
  return (
    <ListEditor items={value} onChange={onChange} max={60} addLabel="Add floor plan"
      blank={{ image: '', bhk: '', size: '', carpet: '', tower: '', facing: '', description: '' }}
      title={(it) => [it.bhk, it.size, it.facing && `${it.facing} facing`].filter(Boolean).join(' · ') || it.description || 'New floor plan'}
      render={(it, set) => (
        <div className="form-grid">
          <div className="field span-6">
            <ImageInput value={it.image || null} onChange={(v) => set('image', v || '')}
              nameHint={slugify([nameHint, it.bhk, it.size, 'floor plan'].filter(Boolean).join(' '))} />
          </div>
          <In label="Unit type / BHK" value={it.bhk} onChange={(v) => set('bhk', v)} placeholder="3 BHK" max={60} />
          <In label="Built-up / saleable size" value={it.size} onChange={(v) => set('size', v)} placeholder="1,730 sq.ft" max={60} />
          <In label="Carpet area" value={it.carpet} onChange={(v) => set('carpet', v)} placeholder="1,128 sq.ft" max={60} />
          <In label="Tower" value={it.tower} onChange={(v) => set('tower', v)} placeholder="B – E" max={80} />
          <div className="field span-2"><label style={{ fontSize: 12.5 }}>Facing</label>
            <select className="select" value={it.facing || ''} onChange={(e) => set('facing', e.target.value)}>
              {FACINGS.map((f) => <option key={f} value={f}>{f || '—'}</option>)}
            </select></div>
          <In label="Short description" value={it.description} onChange={(v) => set('description', v)} placeholder="Corner unit, 2 balconies" span={2} max={500} />
        </div>
      )} />
  );
}

export function AmenityItemsInput({ value, onChange, nameHint = '' }: { value: Item[]; onChange: (v: Item[]) => void; nameHint?: string }) {
  return (
    <ListEditor items={value} onChange={onChange} max={150} addLabel="Add amenity"
      blank={{ title: '', icon: '', image: '', description: '', configs: '' }}
      title={(it) => (it.title || 'New amenity') + (it.configs ? ` — ${it.configs} only` : '')}
      render={(it, set) => (
        <div className="form-grid">
          <In label="Title" value={it.title} onChange={(v) => set('title', v)} placeholder="Infinity pool" max={100} />
          <div className="field span-2"><label style={{ fontSize: 12.5 }}>Icon</label>
            <select className="select" value={it.icon || ''} onChange={(e) => set('icon', e.target.value)}>
              <option value="">Automatic (from title)</option>
              {AMENITY_ICONS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
            </select></div>
          <In label="Description (optional)" value={it.description} onChange={(v) => set('description', v)} placeholder="Rooftop, 25 m" max={400} />
          <div className="field span-6">
            <label style={{ fontSize: 12.5 }}>Only for (optional)</label>
            <input className="input" value={it.configs || ''} maxLength={80} placeholder="e.g. 4 BHK  — leave empty if every home gets it"
              onChange={(e) => set('configs', e.target.value)} />
            <span className="help">For amenities limited to some homes (e.g. private terrace for 4 BHK). Visitors can filter amenities by BHK.</span>
          </div>
          <div className="field span-6">
            <label style={{ fontSize: 12.5 }}>Image (optional)</label>
            <ImageInput value={it.image || null} onChange={(v) => set('image', v || '')} nameHint={slugify([nameHint, it.title].filter(Boolean).join(' '))} />
          </div>
        </div>
      )} />
  );
}

export function ConnectivityInput({ value, onChange }: { value: Item[]; onChange: (v: Item[]) => void }) {
  return (
    <ListEditor items={value} onChange={onChange} max={60} addLabel="Add place"
      blank={{ place: '', time: '', category: '' }}
      title={(it) => [it.place, it.time].filter(Boolean).join(' — ') || 'New place'}
      render={(it, set) => (
        <div className="form-grid">
          <In label="Place" value={it.place} onChange={(v) => set('place', v)} placeholder="Financial District" max={120} />
          <In label="Travel time / distance" value={it.time} onChange={(v) => set('time', v)} placeholder="10 mins" max={40} />
          <div className="field span-2"><label style={{ fontSize: 12.5 }}>Category</label>
            <select className="select" value={it.category || ''} onChange={(e) => set('category', e.target.value)}>
              <option value="">—</option>
              {CONNECTIVITY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select></div>
        </div>
      )} />
  );
}
