import { redirect } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { getSession } from '@/lib/auth';
import { one } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  const row = await one(`select count(*)::int as n from leads where status = 'new'`);
  return (
    <AdminShell admin={session.admin} csrf={session.csrf} newLeads={row?.n ?? 0}>
      {children}
    </AdminShell>
  );
}
