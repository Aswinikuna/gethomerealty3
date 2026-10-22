import { requireAdmin } from '@/lib/auth';
import { handle, HttpError, json, readJson } from '@/lib/http';
import { readSingleton, SINGLETONS, writeSingleton, type SingletonName } from '@/lib/singletons';
import { logActivity } from '@/lib/activity';

type Ctx = { params: Promise<{ name: string }> };
const LABEL: Record<SingletonName, string> = { homepage: 'Homepage', contact: 'Contact details', social: 'Social media links', settings: 'Settings' };

async function nameOf(ctx: Ctx): Promise<SingletonName> {
  const { name } = await ctx.params;
  if (!Object.prototype.hasOwnProperty.call(SINGLETONS, name)) throw new HttpError(404, 'Not found.');
  return name as SingletonName;
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireAdmin(req);
    return json(await readSingleton(await nameOf(ctx)));
  } catch (e) { return handle(e); }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const name = await nameOf(ctx);
    const s = await requireAdmin(req, name === 'settings' ? { role: 'admin' } : {});
    const saved = await writeSingleton(name, await readJson(req, 128 * 1024), s.admin.id);
    await logActivity(s.admin.id, 'updated', name, null, `${LABEL[name]} updated`);
    return json(saved);
  } catch (e) { return handle(e); }
}
