import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { handle, HttpError, json, readJson } from '@/lib/http';
import { getLead } from '@/lib/leads';
import { logActivity } from '@/lib/activity';

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ note: z.string().trim().min(1, 'Write a note first.').max(5000) });

export async function POST(req: Request, ctx: Ctx) {
  try {
    const s = await requireAdmin(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Not found.');
    const { note } = Body.parse(await readJson(req, 16 * 1024));
    const lead = await getLead(id);
    await q('insert into lead_notes (lead_id, admin_id, note) values ($1, $2, $3)', [id, s.admin.id, note]);
    await q('update leads set updated_at = now() where id = $1', [id]);
    await logActivity(s.admin.id, 'noted', 'leads', id, `Note added to lead “${lead.name}”`);
    return json(await getLead(id), 201);
  } catch (e) { return handle(e); }
}
