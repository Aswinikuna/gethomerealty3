// Signed-in admin changes their own password. Requires the current password;
// every other session for the account is signed out.
import { z } from 'zod';
import { currentSessionId, hashPassword, passwordProblem, requireAdmin, verifyPassword } from '@/lib/auth';
import { one, tx } from '@/lib/db';
import { clientIp, fail, handle, json, readJson } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';
import { logActivity } from '@/lib/activity';

const Body = z.object({ current: z.string().min(1, 'Enter your current password.').max(200), next: z.string().max(200) });

export async function POST(req: Request) {
  try {
    const s = await requireAdmin(req);
    if (!rateLimit(`chpw:${s.admin.id}:${clientIp(req)}`, 5, 15 * 60_000)) return fail(429, 'Too many attempts. Try again in 15 minutes.');
    const { current, next } = Body.parse(await readJson(req, 4096));
    const row = await one('select password_hash from admins where id = $1', [s.admin.id]);
    if (!row || !(await verifyPassword(current, row.password_hash))) {
      return fail(422, 'Your current password is incorrect.', { fields: { current: 'Your current password is incorrect.' } });
    }
    const problem = passwordProblem(next);
    if (problem) return fail(422, problem, { fields: { next: problem } });
    if (await verifyPassword(next, row.password_hash)) {
      return fail(422, 'Choose a password different from the current one.', { fields: { next: 'Choose a password different from the current one.' } });
    }
    const hash = await hashPassword(next);
    const keep = await currentSessionId();
    await tx(async (t) => {
      await t.query('update admins set password_hash = $2, failed_logins = 0, locked_until = null, updated_at = now() where id = $1', [s.admin.id, hash]);
      await t.query('delete from sessions where admin_id = $1 and id <> $2', [s.admin.id, keep ?? '']);
      await t.query('delete from password_resets where admin_id = $1', [s.admin.id]);
    });
    await logActivity(s.admin.id, 'password_changed', 'admins', s.admin.id, 'Password changed');
    return json({ ok: true });
  } catch (e) { return handle(e); }
}
