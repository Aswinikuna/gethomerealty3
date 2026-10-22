// The existing public pages (index.html, about.html …), served with the SEO <head>
// rendered into the page source.
import { one } from '@/lib/db';
import { notFound, staticPage } from '@/lib/seo/pages';
import { seoContext } from '@/lib/seo/head';
import { sitePages } from '@/lib/seo/render';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params;
  if (!sitePages().includes(page)) return notFound(await seoContext(req));
  // Old query-string listing URLs → their clean, indexable address.
  if (page === 'property-detail.html') {
    const id = new URL(req.url).searchParams.get('id');
    if (id) {
      const p = await one('select slug from properties where slug = $1 and is_active', [id]);
      if (p) return Response.redirect(new URL(`/properties/${p.slug}`, req.url), 301);
    }
  }
  return staticPage(req, page);
}
