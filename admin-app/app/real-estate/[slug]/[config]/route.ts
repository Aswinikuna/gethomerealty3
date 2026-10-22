import { configLocationPage, notFound } from '@/lib/seo/pages';
import { seoContext } from '@/lib/seo/head';

export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; config: string }> }) {
  const { slug, config } = await ctx.params;
  if (!SLUG.test(slug) || !SLUG.test(config)) return notFound(await seoContext(req));
  return configLocationPage(req, slug, config);
}
