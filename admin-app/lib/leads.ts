import { z } from 'zod';
import { plain, q, one } from './db';
import { HttpError } from './http';
import { LEAD_STATUS } from './resources';

export interface LeadFilters { q?: string; status?: string; type?: string; source?: string; from?: string; to?: string }

export function leadFilters(sp: URLSearchParams): LeadFilters {
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    q: (sp.get('q') || '').trim().slice(0, 100) || undefined,
    status: LEAD_STATUS.some((s) => s.value === sp.get('status')) ? sp.get('status')! : undefined,
    type: (sp.get('type') || '').slice(0, 80) || undefined,
    source: (sp.get('source') || '').slice(0, 120) || undefined,
    from: date(sp.get('from')),
    to: date(sp.get('to')),
  };
}

function where(f: LeadFilters) {
  const w: string[] = [], p: unknown[] = [];
  if (f.q) {
    p.push(`%${f.q.replace(/[\\%_]/g, (m) => '\\' + m)}%`);
    const n = p.length;
    w.push(`(l.name ilike $${n} or l.email ilike $${n} or l.phone ilike $${n} or l.message ilike $${n} or l.reference_label ilike $${n})`);
  }
  if (f.status) { p.push(f.status); w.push(`l.status = $${p.length}`); }
  if (f.type) { p.push(f.type); w.push(`l.inquiry_type = $${p.length}`); }
  if (f.source) { p.push(f.source); w.push(`l.source = $${p.length}`); }
  if (f.from) { p.push(f.from); w.push(`l.created_at >= $${p.length}::date`); }
  if (f.to) { p.push(f.to); w.push(`l.created_at < ($${p.length}::date + 1)`); }
  return { sql: w.length ? `where ${w.join(' and ')}` : '', params: p };
}

export async function listLeads(f: LeadFilters, page: number, pageSize: number) {
  const { sql, params } = where(f);
  const [{ n }] = await q(`select count(*)::int as n from leads l ${sql}`, params);
  const rows = await q(
    `select l.id, l.name, l.phone, l.email, l.inquiry_type, l.reference_label, l.source, l.status, l.created_at,
            left(l.message, 140) as message
       from leads l ${sql} order by l.created_at desc, l.id desc limit ${pageSize} offset ${(page - 1) * pageSize}`, params);
  const types = await q('select distinct inquiry_type as v from leads where inquiry_type is not null order by 1');
  const sources = await q('select distinct source as v from leads where source is not null order by 1');
  return {
    items: rows.map((r) => plain(r)), total: Number(n), page, pageSize,
    facets: { types: types.map((r) => r.v as string), sources: sources.map((r) => r.v as string) },
  };
}

export async function getLead(id: number) {
  const lead = await one(
    `select l.*, p.title as property_title, p.slug as property_slug, pr.name as project_name, pr.slug as project_slug
       from leads l left join properties p on p.id = l.property_id left join projects pr on pr.id = l.project_id
      where l.id = $1`, [id]);
  if (!lead) throw new HttpError(404, 'Lead not found.');
  const notes = await q(
    `select n.id, n.note, n.created_at, a.name as admin_name from lead_notes n left join admins a on a.id = n.admin_id
      where n.lead_id = $1 order by n.created_at desc`, [id]);
  return { ...plain(lead), notes: notes.map((n) => plain(n)) } as Record<string, any>;
}

export async function exportLeadsCsv(f: LeadFilters) {
  const { sql, params } = where(f);
  const rows = await q(
    `select l.id, l.created_at, l.name, l.phone, l.email, l.inquiry_type, l.reference_label, l.source, l.status, l.message, l.details,
            (select string_agg(to_char(n.created_at, 'YYYY-MM-DD') || ': ' || n.note, ' | ' order by n.created_at)
               from lead_notes n where n.lead_id = l.id) as notes
       from leads l ${sql} order by l.created_at desc limit 50000`, params);
  // Cells starting with = + - @ are prefixed so spreadsheet apps don't run them as formulas.
  const cell = (v: unknown) => {
    let s = v == null ? ''
      : v instanceof Date ? v.toISOString()
      : typeof v === 'object' ? Object.entries(v as object).map(([k, x]) => `${k}: ${x}`).join('; ')
      : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['ID', 'Date', 'Name', 'Phone', 'Email', 'Inquiry type', 'Property / project', 'Source', 'Status', 'Message', 'Other details', 'Internal notes'];
  const label = (s: string) => LEAD_STATUS.find((x) => x.value === s)?.label ?? s;
  const lines = rows.map((r) =>
    [r.id, r.created_at, r.name, r.phone, r.email, r.inquiry_type, r.reference_label, r.source, label(r.status), r.message, r.details, r.notes]
      .map(cell).join(','));
  return '﻿' + [head.join(','), ...lines].join('\r\n');
}

// ---------- public submissions ----------
const str = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

export const PublicLead = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(120),
  phone: str(30).refine((v) => !v || v.replace(/\D/g, '').length >= 7, 'Enter a valid phone number.'),
  email: z.union([z.literal(''), z.email('Enter a valid email.').max(200)]).optional().transform((v) => v || null),
  message: str(5000),
  inquiry_type: str(80),
  source: str(120),
  reference: z.object({ type: z.enum(['property', 'project']), id: z.string().max(100) }).optional(),
  details: z.record(z.string().max(80), z.string().max(500)).optional()
    .refine((d) => !d || Object.keys(d).length <= 20, 'Too many fields.'),
  website: z.string().max(200).optional(), // honeypot — real visitors never fill it
}).refine((d) => d.phone || d.email, { message: 'Enter a phone number or email.', path: ['phone'] });
