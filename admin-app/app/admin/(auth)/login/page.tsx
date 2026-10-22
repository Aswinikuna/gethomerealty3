import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/AuthForms';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect('/admin/dashboard');
  const { next } = await searchParams;
  return <LoginForm next={typeof next === 'string' ? next : null} />;
}
