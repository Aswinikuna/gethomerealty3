'use client';
import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

/** Free-text list input: type and press Enter (or comma) to add a tag. */
export function TagsInput({ value, onChange, id, placeholder = 'Type and press Enter' }: {
  value: string[]; onChange: (v: string[]) => void; id?: string; placeholder?: string;
}) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p.slice(0, 120));
    onChange(next.slice(0, 60));
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && text.trim()) { e.preventDefault(); add(text); }
    else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="tags" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
      {value.map((t, i) => (
        <span className="tag" key={t + i}>{t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((_, k) => k !== i))}><X size={13} /></button>
        </span>
      ))}
      <input id={id} value={text} placeholder={value.length ? '' : placeholder} onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey} onBlur={() => text.trim() && add(text)} onPaste={(e) => {
          const t = e.clipboardData.getData('text');
          if (/[,\n]/.test(t)) { e.preventDefault(); add(t); }
        }} />
    </div>
  );
}

/** Question / answer list (location-page FAQs). */
export function FaqsInput({ value, onChange, id }: { value: { q: string; a: string }[]; onChange: (v: { q: string; a: string }[]) => void; id?: string }) {
  const items = value || [];
  const upd = (i: number, k: 'q' | 'a', v: string) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= items.length) return;
    const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  return (
    <div className="rows" id={id}>
      {items.map((f, i) => (
        <div key={i} className="row-item" style={{ gridTemplateColumns: '1fr auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input className="input" aria-label={`Question ${i + 1}`} placeholder="Question" maxLength={300} value={f.q} onChange={(e) => upd(i, 'q', e.target.value)} />
            <textarea className="textarea" aria-label={`Answer ${i + 1}`} placeholder="Answer" rows={3} maxLength={3000} value={f.a} onChange={(e) => upd(i, 'a', e.target.value)} />
          </div>
          <div className="ctl" style={{ flexDirection: 'column' }}>
            <button type="button" className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="icon-btn" title="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="icon-btn" title="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={15} /></button>
          </div>
        </div>
      ))}
      {items.length < 30 && <div><button type="button" className="btn btn-sm" onClick={() => onChange([...items, { q: '', a: '' }])}>+ Add question</button></div>}
    </div>
  );
}
