import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { handle, HttpError, json, readJson } from '@/lib/http';
import { getLead } from '@/lib/leads';
import { LEAD_STATUS, labelOf } from '@/lib/resources';
import { logActivity } from '@/lib/activity';

type Ctx = { params: Promise<{ id: string }> };

async function leadId(ctx: Ctx) {
  const n = Number((await ctx.params).id);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Not found.');
  return n;
}
const Patch = z.object({ status: z.enum(LEAD_STATUS.map((s) => s.value) as [string, ...string[]]) });

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);
    return json(await getLead(await leadId(ctx)));
  } catch (e) { return handle(e); }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req);
    const id = await leadId(ctx);
    const { status } = Patch.parse(await readJson(req, 2048));
    const lead = await getLead(id);
    await q('update leads set status = $2, updated_at = now() where id = $1', [id, status]);
    await logActivity(s.admin.id, 'updated', 'leads', id, `Lead “${lead.name}” → ${labelOf(LEAD_STATUS, status)}`);
    return json(await getLead(id));
  } catch (e) { return handle(e); }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req, { role: 'admin' });
    const id = await leadId(ctx);
    const lead = await getLead(id);
    await q('delete from leads where id = $1', [id]);
    await logActivity(s.admin.id, 'deleted', 'leads', id, `Deleted lead “${lead.name}”`);
    return json({ ok: true });
  } catch (e) { return handle(e); }
}
