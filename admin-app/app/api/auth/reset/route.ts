import { z } from 'zod';
import { assertSameOrigin, hashPassword, passwordProblem, sha256 } from '@/lib/auth';
import { one, tx } from '@/lib/db';
import { clientIp, fail, handle, json, readJson } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';
import { logActivity } from '@/lib/activity';

const Body = z.object({ token: z.string().min(20).max(200), password: z.string().max(200) });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000)) return fail(429, 'Too many requests. Try again later.');
    const { token, password } = Body.parse(await readJson(req, 4096));
    const problem = passwordProblem(password);
    if (problem) return fail(422, problem, { fields: { password: problem } });
    const reset = await one('select admin_id from password_resets where id = $1 and used_at is null and expires_at > now()', [sha256(token)]);
    if (!reset) return fail(400, 'This reset link is invalid or has expired. Request a new one.');
    const hash = await hashPassword(password);
    await tx(async (t) => {
      await t.query('update admins set password_hash = $2, failed_logins = 0, locked_until = null, updated_at = now() where id = $1', [reset.admin_id, hash]);
      await t.query('update password_resets set used_at = now() where id = $1', [sha256(token)]);
      await t.query('delete from sessions where admin_id = $1', [reset.admin_id]); // sign out everywhere
    });
    await logActivity(reset.admin_id, 'password_reset', 'admins', reset.admin_id, 'Password reset by email link');
    return json({ ok: true });
  } catch (e) { return handle(e); }
}
