import { z } from 'zod';
import { assertSameOrigin, randomToken, sha256 } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { clientIp, fail, handle, json, readJson } from '@/lib/http';
import { sendMail } from '@/lib/mail';
import { rateLimit } from '@/lib/ratelimit';

const Body = z.object({ email: z.email('Enter a valid email address.').max(200).transform((s) => s.trim().toLowerCase()) });
// Same answer whether or not the email exists, so the form can't be used to discover accounts.
const DONE = { ok: true, message: 'If that email belongs to an admin account, a reset link is on its way. It expires in 1 hour.' };

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000)) return fail(429, 'Too many requests. Try again later.');
    const { email } = Body.parse(await readJson(req, 2048));
    const admin = await one('select id, name from admins where email = $1 and is_active', [email]);
    if (admin) {
      const token = randomToken();
      await q('delete from password_resets where admin_id = $1 or expires_at < now()', [admin.id]);
      await q(`insert into password_resets (id, admin_id, expires_at) values ($1, $2, now() + interval '1 hour')`, [sha256(token), admin.id]);
      const base = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
      await sendMail(email, 'Reset your Get Home Realty admin password',
        `Hi ${admin.name || 'there'},\n\nUse this link to choose a new password for the Get Home Realty admin panel:\n\n` +
        `${base}/admin/reset-password?token=${token}\n\nThe link expires in 1 hour and works once. ` +
        `If you didn't ask for this, you can ignore this email — your password stays the same.`);
    }
    return json(DONE);
  } catch (e) { return handle(e); }
}
