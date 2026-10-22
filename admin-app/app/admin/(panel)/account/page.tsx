import ChangePassword from '@/components/ChangePassword';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'My account' };

export default async function AccountPage() {
  const s = await getSession();
  return <ChangePassword email={s?.admin.email ?? ''} />;
}
