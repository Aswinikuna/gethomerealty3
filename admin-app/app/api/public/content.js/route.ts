// GET /api/public/content.js[?with=projects,properties]
// A tiny script that sets window.GHR_CMS. Loaded by every public page right after
// data.js; when it's unavailable (e.g. the site opened as static files) the pages
// simply keep their built-in content. Cached at the CDN for a minute.
import { publicContent } from '@/lib/public-content';

export const dynamic = 'force-dynamic';

const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);

/** JSON that is safe inside a script: no "</script>" breakouts, no raw line separators. */
function scriptSafeJson(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
}

export async function GET(req: Request) {
  const sets = new Set((new URL(req.url).searchParams.get('with') || '').split(',').filter((s) => s === 'projects' || s === 'properties'));
  try {
    const body = `window.GHR_CMS=${scriptSafeJson(await publicContent(sets))};`;
    return new Response(body, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    console.error('public content failed', e);
    // Fall back to the page's built-in content rather than breaking the site.
    return new Response('/* content unavailable */', { status: 200, headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' } });
  }
}
