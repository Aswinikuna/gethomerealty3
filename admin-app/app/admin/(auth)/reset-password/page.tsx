import { ResetForm } from '@/components/AuthForms';

export const metadata = { title: 'Reset password' };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === 'string' ? token : ''} />;
}
