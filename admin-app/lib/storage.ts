// Media storage. Production: Supabase Storage (public bucket) over its REST API.
// Local development: files written to public/uploads/ and served by `next dev`.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { q } from './db';
import { HttpError } from './http';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'media';
const useSupabase = () => !!(SB_URL && SB_KEY);

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // before optimisation
export const PDF_MAX_BYTES = 30 * 1024 * 1024;
const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff']);

export type UploadKind = 'image' | 'pdf';

/** SEO-friendly file name ("godrej-neopolis-hyderabad-exterior-3f9a2c.webp") with a short random suffix. */
function newKey(ext: string, name?: string) {
  const d = new Date();
  const base = String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  const rand = crypto.randomBytes(base ? 3 : 12).toString('hex');
  return `uploads/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${base ? `${base}-${rand}` : rand}.${ext}`;
}

function publicUrl(key: string) {
  return useSupabase() ? `${SB_URL}/storage/v1/object/public/${BUCKET}/${key}` : `/${key}`;
}

function assertWritable() {
  if (!useSupabase() && process.env.VERCEL) {
    throw new HttpError(500, 'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
}

async function put(key: string, body: Buffer, contentType: string) {
  if (useSupabase()) {
    const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, 'Content-Type': contentType, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' },
      body: new Uint8Array(body),
    });
    if (!res.ok) { console.error('storage upload failed', res.status, await res.text().catch(() => '')); throw new HttpError(502, 'Upload to storage failed.'); }
  } else {
    const file = path.join(process.cwd(), 'public', key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }
  return publicUrl(key);
}

/**
 * Validate by content (not by filename/extension), optimise and store.
 * Images are auto-rotated, resized to fit 2000px, stripped of metadata and re-encoded as WebP.
 */
export async function storeUpload(buf: Buffer, kind: UploadKind, name?: string) {
  assertWritable();
  if (kind === 'pdf') {
    if (buf.length > PDF_MAX_BYTES) throw new HttpError(413, 'PDF is larger than 30 MB.');
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new HttpError(415, 'That file is not a PDF.');
    return { url: await put(newKey('pdf', name), buf, 'application/pdf'), bytes: buf.length };
  }
  if (buf.length > IMAGE_MAX_BYTES) throw new HttpError(413, 'Image is larger than 10 MB.');
  let meta: Metadata;
  try { meta = await sharp(buf, { limitInputPixels: 80_000_000 }).metadata(); } catch { throw new HttpError(415, 'That file is not a supported image.'); }
  if (!meta.format || !IMAGE_FORMATS.has(meta.format)) throw new HttpError(415, 'Use a JPG, PNG, WebP, GIF or AVIF image.');
  const out = await sharp(buf, { limitInputPixels: 80_000_000, animated: false })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const url = await put(newKey('webp', name), out.data, 'image/webp');
  return { url, bytes: out.data.length, width: out.info.width, height: out.info.height, originalBytes: buf.length };
}

/**
 * Large PDFs (brochures) go straight from the browser to Supabase Storage, so they
 * don't pass through the 4.5 MB serverless request limit. Returns null when uploads
 * should use the normal endpoint instead (local storage).
 */
export async function signedPdfUpload(name?: string) {
  if (!useSupabase()) return null;
  const key = newKey('pdf', name);
  const res = await fetch(`${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${key}`, {
    method: 'POST', headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY },
  });
  if (!res.ok) throw new HttpError(502, 'Could not prepare the upload.');
  const { url } = (await res.json()) as { url: string };
  return { uploadUrl: `${SB_URL}/storage/v1${url}`, publicUrl: publicUrl(key) };
}

/** True for files this app stored (only those are ever deleted). */
export function isOwnUpload(url: string | null | undefined): url is string {
  if (!url) return false;
  return useSupabase() ? url.startsWith(`${SB_URL}/storage/v1/object/public/${BUCKET}/uploads/`) : url.startsWith('/uploads/');
}

/** URLs from the list that some record or setting still points at. */
async function stillReferenced(urls: string[]): Promise<Set<string>> {
  const rows = await q(
    `select u from unnest($1::text[]) as u where exists (
       select 1 from properties where main_image = u or video_url = u union all
       select 1 from property_images where url = u union all
       select 1 from projects where main_image = u or brochure_url = u or master_plan_image = u
         or strpos(floor_plans::text, u) > 0 or strpos(amenity_items::text, u) > 0 union all
       select 1 from project_images where url = u union all
       select 1 from videos where thumbnail = u union all
       select 1 from reviews where client_image = u union all
       select 1 from agents where photo = u union all
       select 1 from settings where value = u union all
       select 1 from homepage_content where strpos(content::text, u) > 0)`, [urls]);
  return new Set(rows.map((r) => r.u as string));
}

/** Best-effort removal of stored files that nothing references any more. */
export async function deleteUploads(urls: (string | null | undefined)[]) {
  try {
    const candidates = [...new Set(urls.filter(isOwnUpload))];
    if (!candidates.length) return;
    const used = await stillReferenced(candidates);
    const own = candidates.filter((u) => !used.has(u));
    if (!own.length) return;
    if (useSupabase()) {
      const prefixes = own.map((u) => u.slice(`${SB_URL}/storage/v1/object/public/${BUCKET}/`.length));
      await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes }),
      });
    } else {
      const base = path.join(process.cwd(), 'public');
      for (const u of own) {
        const file = path.join(base, u);
        if (file.startsWith(path.join(base, 'uploads'))) await fs.rm(file, { force: true });
      }
    }
  } catch (e) { console.error('deleteUploads failed', e); }
}
