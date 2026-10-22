import { notFound, agentPage } from '@/lib/seo/pages';
import { seoContext } from '@/lib/seo/head';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return notFound(await seoContext(req));
  return agentPage(req, slug);
}
