import { requireAdmin } from '@/lib/auth';
import { handle } from '@/lib/http';
import { exportLeadsCsv, leadFilters } from '@/lib/leads';
import { logActivity } from '@/lib/activity';

export async function GET(req: Request) {
  try {
    const s = await requireAdmin(req);
    const csv = await exportLeadsCsv(leadFilters(new URL(req.url).searchParams));
    await logActivity(s.admin.id, 'exported', 'leads', null, 'Exported leads to CSV');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ghr-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) { return handle(e); }
}
