// Generic CRUD over the tables described in resources.ts. Column and table names
// only ever come from those definitions (a fixed whitelist); values are always
// bound parameters.
import { plain, q, tx, type Queryable, type Row } from './db';
import { HttpError } from './http';
import { confidentialFields, RESOURCES, type Resource } from './resources';
import { deleteUploads } from './storage';
import { resourceSchema, slugify } from './validate';

export function getResource(key: string): Resource {
  const r = Object.prototype.hasOwnProperty.call(RESOURCES, key) ? RESOURCES[key] : undefined;
  if (!r) throw new HttpError(404, 'Unknown section.');
  return r;
}

const JSON_TYPES = new Set(['tags', 'faqs', 'pairs', 'floorplans', 'amenityItems', 'connectivity']);
const fieldByName = (r: Resource, name: string) => r.fields.find((f) => f.name === name);

function toDb(r: Resource, data: Row) {
  const cols: string[] = [], vals: unknown[] = [], casts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'galleries' || v === undefined) continue;
    const f = fieldByName(r, k);
    if (!f) continue;
    cols.push(k);
    vals.push(JSON_TYPES.has(f.type) ? JSON.stringify(v) : v);
    casts.push(JSON_TYPES.has(f.type) ? '::jsonb' : '');
  }
  return { cols, vals, casts };
}

function fromDb(r: Resource, row: Row) {
  const out = plain(row);
  for (const f of r.fields) if (f.type === 'date' && out[f.name]) out[f.name] = String(out[f.name]).slice(0, 10);
  return out;
}

export interface ListParams { page: number; pageSize: number; q?: string; filters?: Record<string, string>; }
export type Role = 'admin' | 'editor';

/** Internal prices are only ever returned to the "admin" role. */
function forRole(r: Resource, row: Row, role: Role) {
  if (role !== 'admin') for (const k of confidentialFields(r)) delete row[k];
  return row;
}
/** …and only the "admin" role may set them. */
function inputForRole(r: Resource, input: unknown, role: Role) {
  if (role === 'admin' || !input || typeof input !== 'object') return input;
  const copy = { ...(input as Row) };
  for (const k of confidentialFields(r)) delete copy[k];
  return copy;
}

export async function list(r: Resource, p: ListParams, role: Role) {
  const where: string[] = [], params: unknown[] = [];
  if (p.q) {
    params.push(`%${p.q.replace(/[\\%_]/g, (m) => '\\' + m)}%`);
    where.push(`(${r.search.map((c) => `coalesce(${c}::text,'') ilike $${params.length}`).join(' or ')})`);
  }
  for (const flt of r.filters) {
    const v = p.filters?.[flt.name];
    if (!v || !flt.options.some((o) => o.value === v)) continue;
    params.push(v === 'true' ? true : v === 'false' ? false : v);
    where.push(`${flt.name} = $${params.length}`);
  }
  const w = where.length ? `where ${where.join(' and ')}` : '';
  const cols = new Set(['id', 'updated_at', r.titleField, ...r.toggles.map((t) => t.field)]);
  for (const c of r.columns) {
    if (c.confidential && role !== 'admin') continue;
    cols.add(c.field);
    if (c.kind === 'pricing') cols.add('builder_price').add('brokerage_price');
  }
  for (const extra of ['currency', 'starting_price', 'price_label']) if (r.fields.some((f) => f.name === extra)) cols.add(extra);
  if (r.fields.some((f) => f.name === 'display_order')) cols.add('display_order');
  const [{ n }] = await q(`select count(*)::int as n from ${r.table} ${w}`, params);
  const rows = await q(
    `select ${[...cols].join(', ')} from ${r.table} ${w} order by ${r.order} limit ${p.pageSize} offset ${(p.page - 1) * p.pageSize}`,
    params);
  return { items: rows.map((row) => forRole(r, fromDb(r, row), role)), total: Number(n), page: p.page, pageSize: p.pageSize };
}

async function loadGalleries(r: Resource, id: number, db: Queryable = { query: q }) {
  const out: Record<string, { url: string; alt: string | null }[]> = {};
  for (const g of r.galleries || []) {
    const rows = await db.query(
      `select url, alt from ${g.table} where ${g.fk} = $1 ${g.kind ? `and kind = '${g.kind}'` : ''} order by sort_order, id`, [id]);
    out[g.name] = rows.map((x) => ({ url: x.url, alt: x.alt }));
  }
  return out;
}

export async function get(r: Resource, id: number, role: Role = 'admin') {
  const row = (await q(`select * from ${r.table} where id = $1`, [id]))[0];
  if (!row) throw new HttpError(404, `${r.singular} not found.`);
  const out: Row = fromDb(r, row);
  if (r.galleries?.length) out.galleries = await loadGalleries(r, id);
  return forRole(r, out, role);
}

async function uniqueSlug(r: Resource, base: string, db: Queryable, exceptId?: number) {
  let slug = base, i = 2;
  while ((await db.query(`select 1 from ${r.table} where slug = $1 and id <> $2`, [slug, exceptId ?? -1])).length) slug = `${base}-${i++}`;
  return slug;
}

async function saveGalleries(r: Resource, id: number, galleries: Row | undefined, db: Queryable) {
  for (const g of r.galleries || []) {
    const items = galleries?.[g.name] as { url: string; alt?: string | null }[] | undefined;
    if (!items) continue;
    await db.query(`delete from ${g.table} where ${g.fk} = $1 ${g.kind ? `and kind = '${g.kind}'` : ''}`, [id]);
    for (let i = 0; i < items.length; i++) {
      const cols = [g.fk, 'url', 'alt', 'sort_order', ...(g.kind ? ['kind'] : [])];
      const vals = [id, items[i].url, items[i].alt || null, i, ...(g.kind ? [g.kind] : [])];
      await db.query(`insert into ${g.table} (${cols.join(', ')}) values (${vals.map((_, j) => `$${j + 1}`).join(', ')})`, vals);
    }
  }
}

/** Every stored-file URL a record references (images, PDFs, gallery items). */
function mediaUrls(r: Resource, rec: Row): string[] {
  const urls = r.fields.filter((f) => f.type === 'image' || f.type === 'file').map((f) => rec[f.name]);
  for (const items of Object.values((rec.galleries || {}) as Record<string, { url: string }[]>)) urls.push(...items.map((x) => x.url));
  // images inside structured lists (floor plans, amenity cards)
  for (const f of r.fields) if (f.type === 'floorplans' || f.type === 'amenityItems') urls.push(...((rec[f.name] || []) as Row[]).map((x) => x.image));
  return urls.filter(Boolean);
}

export async function create(r: Resource, input: unknown, adminId: number, role: Role) {
  const data = resourceSchema(r, false).parse(inputForRole(r, input, role)) as Row;
  const id = await tx(async (db) => {
    if (r.slugFrom) data.slug = await uniqueSlug(r, data.slug || slugify(String(data[r.slugFrom] || '')), db);
    const { cols, vals, casts } = toDb(r, data);
    cols.push('created_by', 'updated_by'); vals.push(adminId, adminId); casts.push('', '');
    const [row] = await db.query(
      `insert into ${r.table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}${casts[i]}`).join(', ')}) returning id`, vals);
    await saveGalleries(r, row.id, data.galleries, db);
    return row.id as number;
  });
  return get(r, id, role);
}

export async function update(r: Resource, id: number, input: unknown, adminId: number, role: Role) {
  const data = resourceSchema(r, true).parse(inputForRole(r, input, role)) as Row;
  const before = await get(r, id);
  await tx(async (db) => {
    if (r.slugFrom && 'slug' in data) data.slug = await uniqueSlug(r, data.slug || slugify(String(data[r.slugFrom] ?? before[r.slugFrom] ?? '')), db, id);
    const { cols, vals, casts } = toDb(r, data);
    const sets = cols.map((c, i) => `${c} = $${i + 1}${casts[i]}`);
    sets.push(`updated_at = now()`, `updated_by = $${vals.length + 1}`);
    vals.push(adminId, id);
    await db.query(`update ${r.table} set ${sets.join(', ')} where id = $${vals.length}`, vals);
    await saveGalleries(r, id, data.galleries, db);
  });
  const after = await get(r, id);
  // Remove files that were replaced or deleted in this edit.
  const kept = new Set(mediaUrls(r, after));
  await deleteUploads(mediaUrls(r, before).filter((u) => !kept.has(u)));
  return forRole(r, after, role);
}

export async function remove(r: Resource, id: number) {
  const before = await get(r, id);
  await q(`delete from ${r.table} where id = $1`, [id]);
  await deleteUploads(mediaUrls(r, before));
  return before;
}

export const titleOf = (r: Resource, row: Row) => String(row[r.titleField] ?? `#${row.id}`);
