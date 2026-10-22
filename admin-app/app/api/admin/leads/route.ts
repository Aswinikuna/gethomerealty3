import { requireAdmin } from '@/lib/auth';
import { handle, json } from '@/lib/http';
import { leadFilters, listLeads } from '@/lib/leads';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const sp = new URL(req.url).searchParams;
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize')) || 25));
    return json(await listLeads(leadFilters(sp), page, pageSize));
  } catch (e) { return handle(e); }
}
