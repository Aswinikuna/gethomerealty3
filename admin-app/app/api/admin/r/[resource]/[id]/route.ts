import { requireAdmin } from '@/lib/auth';
import { get, getResource, remove, titleOf, update } from '@/lib/crud';
import { handle, HttpError, json, readJson } from '@/lib/http';
import { logActivity } from '@/lib/activity';

type Ctx = { params: Promise<{ resource: string; id: string }> };

async function parse(ctx: Ctx) {
  const { resource, id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Not found.');
  return { r: getResource(resource), id: n };
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req);
    const { r, id } = await parse(ctx);
    return json(await get(r, id, s.admin.role));
  } catch (e) { return handle(e); }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req);
    const { r, id } = await parse(ctx);
    const body = await readJson(req);
    const rec = await update(r, id, body, s.admin.id, s.admin.role);
    const keys = Object.keys(body);
    const toggle = keys.length === 1 && r.toggles.find((t) => t.field === keys[0]);
    const what = toggle ? `${toggle.label}: ${body[keys[0]] ? toggle.on : toggle.off}` : 'Updated';
    await logActivity(s.admin.id, 'updated', r.key, id, `${what} — ${r.singular.toLowerCase()} “${titleOf(r, rec)}”`);
    return json(rec);
  } catch (e) { return handle(e); }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req);
    const { r, id } = await parse(ctx);
    const rec = await remove(r, id);
    await logActivity(s.admin.id, 'deleted', r.key, id, `Deleted ${r.singular.toLowerCase()} “${titleOf(r, rec)}”`);
    return json({ ok: true });
  } catch (e) { return handle(e); }
}
