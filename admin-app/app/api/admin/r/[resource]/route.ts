import { requireAdmin } from '@/lib/auth';
import { create, getResource, list, titleOf } from '@/lib/crud';
import { handle, json, readJson } from '@/lib/http';
import { logActivity } from '@/lib/activity';

type Ctx = { params: Promise<{ resource: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req);
    const r = getResource((await ctx.params).resource);
    const sp = new URL(req.url).searchParams;
    const filters: Record<string, string> = {};
    for (const f of r.filters) { const v = sp.get(f.name); if (v) filters[f.name] = v; }
    return json(await list(r, {
      page: Math.max(1, Number(sp.get('page')) || 1),
      pageSize: Math.min(100, Math.max(5, Number(sp.get('pageSize')) || 20)),
      q: (sp.get('q') || '').trim().slice(0, 100) || undefined,
      filters,
    }, s.admin.role));
  } catch (e) { return handle(e); }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req);
    const r = getResource((await ctx.params).resource);
    const rec = await create(r, await readJson(req), s.admin.id, s.admin.role);
    await logActivity(s.admin.id, 'created', r.key, rec.id, `Added ${r.singular.toLowerCase()} “${titleOf(r, rec)}”`);
    return json(rec, 201);
  } catch (e) { return handle(e); }
}
