'use client';
// Reusable upload inputs: single image, image gallery, PDF. Files are checked in
// the browser (type, size), downscaled before upload, then validated and
// re-optimised again on the server.
import { useRef, useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Replace, Trash2, Upload } from 'lucide-react';
import { api, ApiError } from './api';
import { mediaSrc } from '@/lib/format';
import { useToast } from './ui';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const RAW_IMAGE_MAX = 25 * 1024 * 1024;
const PDF_MAX = 30 * 1024 * 1024;
const MB = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

function checkImage(f: File): string | null {
  if (!IMAGE_TYPES.includes(f.type)) return `“${f.name}” isn’t a JPG, PNG, WebP, GIF or AVIF image.`;
  if (f.size > RAW_IMAGE_MAX) return `“${f.name}” is ${MB(f.size)} — the limit is 25 MB.`;
  return null;
}

/** Downscale big photos in the browser so uploads stay small and fast. */
async function shrink(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.88));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadImage(file: File, name = ''): Promise<string> {
  const err = checkImage(file);
  if (err) throw new ApiError(415, err);
  const form = new FormData();
  form.append('file', await shrink(file), file.name);
  const res = await api<{ url: string }>(`/api/admin/upload?kind=image&name=${encodeURIComponent(name)}`, { form });
  return res.url;
}

export async function uploadPdf(file: File, name = ''): Promise<string> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new ApiError(415, 'Choose a PDF file.');
  if (file.size > PDF_MAX) throw new ApiError(413, `PDF is ${MB(file.size)} — the limit is 30 MB.`);
  const plan = await api<{ mode: 'signed' | 'direct'; uploadUrl?: string; publicUrl?: string }>(`/api/admin/upload?name=${encodeURIComponent(name)}`, { method: 'PUT' });
  if (plan.mode === 'signed' && plan.uploadUrl) {
    const res = await fetch(plan.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
    if (!res.ok) throw new ApiError(res.status, 'Upload to storage failed.');
    return plan.publicUrl!;
  }
  const form = new FormData();
  form.append('file', file, file.name);
  return (await api<{ url: string }>(`/api/admin/upload?kind=pdf&name=${encodeURIComponent(name)}`, { form })).url;
}

function DropZone({ multiple, accept, onFiles, label, hint }: {
  multiple?: boolean; accept: string; onFiles: (f: File[]) => void; label: string; hint: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); };
  return (
    <div className={`drop ${over ? 'over' : ''}`} role="button" tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      <Upload size={22} />
      <div><b>{label}</b> or drag and drop</div>
      <div className="hint">{hint}</div>
      <input ref={input} type="file" accept={accept} multiple={multiple}
        onChange={(e) => { onFiles([...(e.target.files || [])]); e.target.value = ''; }} />
    </div>
  );
}

/* ---------- single image ---------- */
export function ImageInput({ value, onChange, id, nameHint = '' }: { value: string | null; onChange: (v: string | null) => void; id?: string; nameHint?: string }) {
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const replace = useRef<HTMLInputElement>(null);

  async function take(files: File[]) {
    const f = files[0];
    if (!f) return;
    const err = checkImage(f);
    if (err) return toast(err, 'err');
    const local = URL.createObjectURL(f);
    setPreview(local); setBusy(true);
    try {
      onChange(await uploadImage(f, nameHint));
      toast('Image uploaded — save to publish it.');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(false); setPreview(null); URL.revokeObjectURL(local);
    }
  }

  const shown = preview || value;
  if (!shown) {
    return <div id={id}><DropZone accept={IMAGE_TYPES.join(',')} onFiles={take} label="Upload an image" hint="JPG, PNG, WebP, GIF or AVIF · up to 25 MB · optimised automatically" /></div>;
  }
  return (
    <div className="media-one" id={id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaSrc(shown)} alt="" style={{ opacity: busy ? 0.5 : 1 }} />
      <div className="meta">
        <div style={{ fontWeight: 600 }}>{busy ? 'Uploading…' : 'Current image'}</div>
        {!busy && value && <div className="u" title={value}>{value}</div>}
        <div className="btns">
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => replace.current?.click()}><Replace size={14} />Replace</button>
          <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => onChange(null)}><Trash2 size={14} />Remove</button>
          {value && !busy && <a className="btn btn-sm btn-ghost" href={mediaSrc(value)} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open</a>}
        </div>
        <input ref={replace} type="file" hidden accept={IMAGE_TYPES.join(',')} onChange={(e) => { take([...(e.target.files || [])]); e.target.value = ''; }} />
      </div>
    </div>
  );
}

/* ---------- gallery ---------- */
export type GalleryItem = { url: string; alt?: string | null };
type Pending = { key: string; preview: string };

export function GalleryInput({ value, onChange, max, nameHint = '' }: { value: GalleryItem[]; onChange: (v: GalleryItem[]) => void; max: number; nameHint?: string }) {
  const toast = useToast();
  const [pending, setPending] = useState<Pending[]>([]);
  const latest = useRef(value);
  latest.current = value;

  async function take(files: File[]) {
    const room = max - value.length - pending.length;
    if (files.length > room) toast(`Only ${Math.max(0, room)} more image(s) fit in this gallery (max ${max}).`, 'err');
    const ok = files.slice(0, Math.max(0, room)).filter((f) => {
      const err = checkImage(f);
      if (err) toast(err, 'err');
      return !err;
    });
    // Upload up to 3 at a time; each finished image is appended in order of completion.
    const queue = ok.map((f, i) => ({ f, key: `${Date.now()}-${i}`, preview: URL.createObjectURL(f) }));
    setPending((p) => [...p, ...queue.map(({ key, preview }) => ({ key, preview }))]);
    let done = 0;
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const url = await uploadImage(job.f, nameHint);
          onChange([...latest.current, { url, alt: '' }]);
          done++;
        } catch (e) {
          toast(`${job.f.name}: ${(e as Error).message}`, 'err');
        } finally {
          setPending((p) => p.filter((x) => x.key !== job!.key));
          URL.revokeObjectURL(job.preview);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (done) toast(`${done} image${done > 1 ? 's' : ''} added — save to publish.`);
  }

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {(value.length > 0 || pending.length > 0) && (
        <div className="gallery">
          {value.map((it, i) => (
            <div className="g-item" key={it.url + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaSrc(it.url)} alt={it.alt || ''} loading="lazy" />
              <input className="alt" placeholder="Caption / alt text" value={it.alt || ''} maxLength={200}
                onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, alt: e.target.value } : x)))} />
              <div className="g-bar">
                <button type="button" className="icon-btn" title="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><ChevronLeft size={16} /></button>
                <button type="button" className="icon-btn" title="Move later" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ChevronRight size={16} /></button>
                <span className="grow" />
                <button type="button" className="icon-btn" title="Remove image" onClick={() => onChange(value.filter((_, k) => k !== i))}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
          {pending.map((p) => (
            <div className="g-item uploading" key={p.key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" />
              <div className="busy"><span className="spinner" /></div>
              <div className="g-bar"><span className="muted" style={{ fontSize: 12, padding: '4px 6px' }}>Uploading…</span></div>
            </div>
          ))}
        </div>
      )}
      {value.length + pending.length < max && (
        <DropZone multiple accept={IMAGE_TYPES.join(',')} onFiles={take} label="Add images"
          hint={`Select several at once · ${value.length}/${max} used · optimised automatically`} />
      )}
    </div>
  );
}

/* ---------- PDF ---------- */
export function PdfInput({ value, onChange, id, nameHint = '' }: { value: string | null; onChange: (v: string | null) => void; id?: string; nameHint?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const replace = useRef<HTMLInputElement>(null);
  async function take(files: File[]) {
    const f = files[0];
    if (!f) return;
    setBusy(f.name);
    try {
      onChange(await uploadPdf(f, nameHint));
      toast('PDF uploaded — save to publish it.');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally { setBusy(null); }
  }
  if (busy) return <div className="pdf-chip" id={id}><span className="spinner" /><span className="grow">Uploading {busy}…</span></div>;
  if (!value) return <div id={id}><DropZone accept="application/pdf,.pdf" onFiles={take} label="Upload a PDF" hint="PDF only · up to 30 MB" /></div>;
  return (
    <div className="pdf-chip" id={id}>
      <FileText size={20} color="var(--accent)" />
      <a className="grow" href={mediaSrc(value)} target="_blank" rel="noreferrer" title={value}>{value.split('/').pop()}</a>
      <button type="button" className="btn btn-sm" onClick={() => replace.current?.click()}><Replace size={14} />Replace</button>
      <button type="button" className="icon-btn" title="Remove PDF" onClick={() => onChange(null)}><Trash2 size={15} /></button>
      <input ref={replace} type="file" hidden accept="application/pdf,.pdf" onChange={(e) => { take([...(e.target.files || [])]); e.target.value = ''; }} />
    </div>
  );
}

