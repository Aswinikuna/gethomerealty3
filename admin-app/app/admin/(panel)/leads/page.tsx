import { Suspense } from 'react';
import { LeadsList } from '@/components/Leads';

export const metadata = { title: 'Leads' };

export default function LeadsPage() {
  return <Suspense><LeadsList /></Suspense>;
}
