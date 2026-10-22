// Browsers and crawlers request /favicon.ico by default — point them at the site icon.
import { readSingleton } from '@/lib/singletons';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let target = '/assets/img/ghr-icon-32.png';
  try { const s = await readSingleton('settings'); if (s.favicon) target = s.favicon; } catch { /* keep default */ }
  const res = Response.redirect(new URL(target, req.url), 302);
  return new Response(null, { status: 302, headers: { Location: res.headers.get('Location')!, 'Cache-Control': 'public, max-age=86400' } });
}
