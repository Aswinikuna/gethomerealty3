import { notFound } from 'next/navigation';
import { LeadView } from '@/components/Leads';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'Lead' };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const s = await getSession();
  return <LeadView id={Number(id)} canDelete={s?.admin.role === 'admin'} />;
}
