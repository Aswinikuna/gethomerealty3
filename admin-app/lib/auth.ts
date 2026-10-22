// Admin authentication: bcrypt passwords, opaque DB-backed sessions in an
// httpOnly cookie, and a per-session CSRF token for every state-changing request.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { one, q } from './db';
import { HttpError } from './http';

const PROD = process.env.NODE_ENV === 'production';
/** `__Host-` pins the cookie to this exact origin over HTTPS (production only). */
export const SESSION_COOKIE = PROD ? '__Host-ghr_admin' : 'ghr_admin';
export const SESSION_HOURS = 12;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export interface AdminUser { id: number; email: string; name: string; role: 'admin' | 'editor' }
export interface Session { admin: AdminUser; csrf: string }

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;
export const burnTime = async (pw: string) => bcrypt.compare(pw, await (dummyHash ??= bcrypt.hash(randomToken(), 12)));

export function passwordProblem(pw: string): string | null {
  if (pw.length < 12) return 'Use at least 12 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[^A-Za-z]/.test(pw)) return 'Mix letters with numbers or symbols.';
  return null;
}

export async function createSession(adminId: number, ip: string, ua: string) {
  const token = randomToken();
  const csrf = randomToken(24);
  await q(
    `insert into sessions (id, admin_id, csrf_token, expires_at, ip, user_agent)
     values ($1, $2, $3, now() + make_interval(hours => $4), $5, $6)`,
    [sha256(token), adminId, csrf, SESSION_HOURS, ip, ua.slice(0, 300)]);
  // Opportunistic cleanup of expired sessions.
  await q('delete from sessions where expires_at < now()');
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: PROD, sameSite: 'lax', path: '/', maxAge: SESSION_HOURS * 3600,
  });
}

/** Current admin session (memoised per request), or null. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const row = await one(
    `select a.id, a.email, a.name, a.role, s.csrf_token
       from sessions s join admins a on a.id = s.admin_id
      where s.id = $1 and s.expires_at > now() and a.is_active`, [sha256(token)]);
  if (!row) return null;
  return { admin: { id: row.id, email: row.email, name: row.name, role: row.role }, csrf: row.csrf_token };
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q('delete from sessions where id = $1', [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Reject cross-site requests: the Origin (when sent) must be this host. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return; // same-origin GETs and some older browsers omit it; CSRF token still required
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  let originHost = '';
  try { originHost = new URL(origin).host; } catch { /* invalid */ }
  if (!host || originHost !== host) throw new HttpError(403, 'Cross-site request blocked.');
}

/**
 * Guard for /api/admin route handlers: valid session, and for anything other than
 * GET/HEAD a same-origin request carrying the session's CSRF token.
 */
export async function requireAdmin(req: Request, opts: { role?: 'admin' } = {}): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Please sign in again.');
  if (!['GET', 'HEAD'].includes(req.method)) {
    assertSameOrigin(req);
    const sent = req.headers.get('x-csrf-token') || '';
    if (!safeEqual(sent, s.csrf)) throw new HttpError(403, 'Security token expired — reload the page and try again.');
  }
  if (opts.role === 'admin' && s.admin.role !== 'admin') throw new HttpError(403, 'Only administrators can do this.');
  return s;
}

/** Database id of the current session (to keep it signed in when revoking the others). */
export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}
