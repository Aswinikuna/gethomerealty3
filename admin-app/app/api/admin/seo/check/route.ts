// Duplicate-metadata check for the SEO editor: same SEO title / meta description
// anywhere on the site, or the same URL slug within a section.
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { handle, json, readJson } from '@/lib/http';
import { readSingleton } from '@/lib/singletons';

const SEO_TABLES: Record<string, { label: string; title: string }> = {
  properties: { label: 'Property', title: 'title' },
  projects: { label: 'Project', title: 'name' },
  agents: { label: 'Agent', title: 'name' },
  videos: { label: 'Video', title: 'title' },
  locations: { label: 'Location', title: 'name' },
};

const Body = z.object({
  resource: z.string().max(40),
  id: z.number().int().nullable().optional(),
  slug: z.string().max(100).optional().default(''),
  seo_title: z.string().max(400).optional().default(''),
  meta_description: z.string().max(1000).optional().default(''),
});

export interface Duplicate { field: 'seo_title' | 'meta_description' | 'slug'; where: string; href?: string }

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const b = Body.parse(await readJson(req, 8192));
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const title = norm(b.seo_title), desc = norm(b.meta_description);
    const out: Duplicate[] = [];
    for (const [table, t] of Object.entries(SEO_TABLES)) {
      if (!title && !desc) break;
      const self = table === b.resource ? b.id ?? -1 : -1;
      const rows = await q(
        `select id, ${t.title} as name,
                (lower(regexp_replace(trim(coalesce(seo_title,'')), '\\s+', ' ', 'g')) = $1 and $1 <> '') as t,
                (lower(regexp_replace(trim(coalesce(meta_description,'')), '\\s+', ' ', 'g')) = $2 and $2 <> '') as d
           from ${table}
          where id <> $3 and ((lower(regexp_replace(trim(coalesce(seo_title,'')), '\\s+', ' ', 'g')) = $1 and $1 <> '')
             or (lower(regexp_replace(trim(coalesce(meta_description,'')), '\\s+', ' ', 'g')) = $2 and $2 <> ''))
          limit 5`, [title, desc, self]);
      for (const r of rows) {
        const where = `${t.label} “${r.name}”`, href = `/admin/${table}/${r.id}`;
        if (r.t) out.push({ field: 'seo_title', where, href });
        if (r.d) out.push({ field: 'meta_description', where, href });
      }
    }
    if (b.resource !== 'homepage') {
      const hp = (await readSingleton('homepage')).seo || {};
      if (title && norm(hp.seo_title || '') === title) out.push({ field: 'seo_title', where: 'Homepage', href: '/admin/homepage' });
      if (desc && norm(hp.meta_description || '') === desc) out.push({ field: 'meta_description', where: 'Homepage', href: '/admin/homepage' });
    }
    if (b.slug && SEO_TABLES[b.resource]) {
      const t = SEO_TABLES[b.resource];
      const rows = await q(`select id, ${t.title} as name from ${b.resource} where slug = $1 and id <> $2 limit 3`, [b.slug.trim().toLowerCase(), b.id ?? -1]);
      for (const r of rows) out.push({ field: 'slug', where: `${t.label} “${r.name}”`, href: `/admin/${b.resource}/${r.id}` });
    }
    return json({ duplicates: out });
  } catch (e) { return handle(e); }
}
