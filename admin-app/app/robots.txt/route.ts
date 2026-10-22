// robots.txt — keeps crawlers out of the admin and private APIs. /api/public stays
// crawlable because the pages load their content from it when rendered.
import { seoContext } from '@/lib/seo/head';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await seoContext(req);
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/admin/',
    'Disallow: /api/auth/',
    '',
    `Sitemap: ${ctx.base}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' } });
}
