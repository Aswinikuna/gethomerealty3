// Fast first gate for the admin. It only checks that a session cookie exists;
// the session itself is verified against the database by the (panel) layout and
// by requireAdmin() in every /api/admin handler.
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ADMIN = ['/admin/login', '/admin/forgot-password', '/admin/reset-password'];
const COOKIES = ['__Host-ghr_admin', 'ghr_admin'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = COOKIES.some((c) => req.cookies.has(c));

  if (pathname.startsWith('/api/admin')) {
    return hasSession ? NextResponse.next() : NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  }
  if (pathname === '/admin' || pathname === '/admin/') {
    return NextResponse.redirect(new URL(hasSession ? '/admin/dashboard' : '/admin/login', req.url));
  }
  if (PUBLIC_ADMIN.some((p) => pathname === p)) return NextResponse.next();
  if (!hasSession) {
    const url = new URL('/admin/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'] };
