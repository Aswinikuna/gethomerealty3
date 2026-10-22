import { z } from 'zod';
import { assertSameOrigin, burnTime, createSession, LOCK_MINUTES, MAX_FAILED_LOGINS, verifyPassword } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { clientIp, fail, handle, json, readJson } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';
import { logActivity } from '@/lib/activity';

const Body = z.object({
  email: z.email('Enter a valid email address.').max(200).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(1, 'Enter your password.').max(200),
});
const BAD = 'Incorrect email or password.';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = clientIp(req);
    if (!rateLimit(`login:${ip}`, 10, 60_000)) return fail(429, 'Too many attempts. Wait a minute and try again.');
    const { email, password } = Body.parse(await readJson(req, 4096));

    const admin = await one('select id, password_hash, is_active, locked_until > now() as locked, failed_logins from admins where email = $1', [email]);
    if (!admin || !admin.is_active) { await burnTime(password); return fail(401, BAD); }
    if (admin.locked) return fail(423, `Too many failed attempts. This account is locked for up to ${LOCK_MINUTES} minutes.`);

    if (!(await verifyPassword(password, admin.password_hash))) {
      const fails = admin.failed_logins + 1;
      if (fails >= MAX_FAILED_LOGINS) {
        await q(`update admins set failed_logins = 0, locked_until = now() + make_interval(mins => $2) where id = $1`, [admin.id, LOCK_MINUTES]);
        await logActivity(admin.id, 'locked', 'admins', admin.id, `Account locked after ${MAX_FAILED_LOGINS} failed sign-ins (IP ${ip})`);
        return fail(423, `Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes.`);
      }
      await q('update admins set failed_logins = $2 where id = $1', [admin.id, fails]);
      return fail(401, BAD);
    }

    await q('update admins set failed_logins = 0, locked_until = null, last_login_at = now() where id = $1', [admin.id]);
    await createSession(admin.id, ip, req.headers.get('user-agent') || '');
    await logActivity(admin.id, 'login', 'admins', admin.id, 'Signed in');
    return json({ ok: true });
  } catch (e) { return handle(e); }
}
