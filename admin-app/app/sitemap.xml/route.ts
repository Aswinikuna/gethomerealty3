// Dynamic sitemap: only published, indexable pages, at their canonical URLs.
import { q } from '@/lib/db';
import { esc, seoContext } from '@/lib/seo/head';
import { sitePages } from '@/lib/seo/render';
import { configSitemapPaths } from '@/lib/seo/pages';

export const dynamic = 'force-dynamic';

/** Static pages that should never be listed (legacy templates). */
const EXCLUDE = new Set(['property-detail.html']);

export async function GET(req: Request) {
  const ctx = await seoContext(req);
  const urls: { loc: string; lastmod?: string }[] = [];
  if (String(ctx.settings.default_robots).startsWith('noindex')) {
    return xml('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
  const hp = ctx.homepage.seo || {};
  if (hp.is_indexed !== false) urls.push({ loc: `${ctx.base}/` });
  for (const page of sitePages()) if (page !== 'index.html' && !EXCLUDE.has(page)) urls.push({ loc: `${ctx.base}/${page}` });

  // A record is listed only when public, indexable, and canonical to itself.
  const sets: [string, string, string][] = [
    ['properties', '/properties/', 'is_active'],
    ['projects', '/projects/', 'is_published'],
    ['agents', '/agents/', 'is_active'],
    ['locations', '/real-estate/', 'is_published'],
    ['videos', '/videos/', 'is_active'],
  ];
  const results = await Promise.all(sets.map(([table, , flag]) => q(
    `select slug, updated_at, ${table === 'videos' ? "''" : 'canonical_url'} as canonical_url from ${table}
      where ${flag} and is_indexed and slug is not null order by display_order, id`)));
  sets.forEach(([, prefix], i) => {
    for (const r of results[i]) {
      const loc = `${ctx.base}${prefix}${r.slug}`;
      if (r.canonical_url && ctx.abs(r.canonical_url) !== loc) continue; // canonicalised elsewhere
      urls.push({ loc, lastmod: r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : undefined });
    }
  });

  // per-configuration pages (2 BHK / 3 BHK …) that have real data behind them
  for (const c of await configSitemapPaths()) urls.push({ loc: `${ctx.base}${c.path}`, lastmod: c.lastmod });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
  return xml(body);
}

function xml(body: string) {
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600' } });
}
