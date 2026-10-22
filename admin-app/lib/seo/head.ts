// Builds the SEO <head> block (title, description, robots, canonical, Open Graph,
// Twitter/X, verification, JSON-LD) that is rendered into public page source.
import { readSingleton } from '../singletons';

export const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** JSON for a <script type="application/ld+json"> block — cannot break out of the tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export interface SeoContext {
  base: string;
  settings: Record<string, any>;
  homepage: Record<string, any>;
  contact: Record<string, any>;
  social: Record<string, any>;
  abs: (u: string | null | undefined) => string;
}

/** Global SEO settings + helpers for one request. */
export async function seoContext(req: Request): Promise<SeoContext> {
  const [settings, homepage, contact, social] = await Promise.all([
    readSingleton('settings'), readSingleton('homepage'), readSingleton('contact'), readSingleton('social'),
  ]);
  const base = String(settings.canonical_base_url || process.env.SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
  const abs = (u: string | null | undefined) => {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return `${base}/${u.replace(/^\/+/, '')}`;
  };
  return { base, settings, homepage, contact, social, abs };
}

/** Site-wide robots setting wins over page flags (e.g. "noindex" on a staging site). */
export function robotsFor(ctx: SeoContext, indexed = true, followed = true) {
  const global = String(ctx.settings.default_robots || 'index,follow');
  const index = indexed && !global.startsWith('noindex');
  const follow = followed && !global.endsWith('nofollow');
  return [index ? 'index' : 'noindex', follow ? 'follow' : 'nofollow', ...(index ? ['max-image-preview:large'] : [])].join(', ');
}

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;      // absolute
  robots: string;
  ogType?: 'website' | 'article' | 'profile' | 'video.other';
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;       // any form; made absolute
  ogImageAlt?: string;
  jsonld?: object[];
}

export function headHtml(ctx: SeoContext, m: PageMeta) {
  const s = ctx.settings;
  const siteName = s.site_name || 'Get Home Realty';
  const ogTitle = m.ogTitle || m.title;
  const ogDesc = m.ogDescription || m.description;
  const ogImage = ctx.abs(m.ogImage || s.default_og_image || s.logo || '/assets/img/ghr-logo-header.png');
  const twImage = ctx.abs(m.ogImage || s.default_twitter_image || s.default_og_image || s.logo || '/assets/img/ghr-logo-header.png');
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}">`,
    `<meta name="robots" content="${esc(m.robots)}">`,
    `<link rel="canonical" href="${esc(m.canonical)}">`,
    `<meta property="og:site_name" content="${esc(siteName)}">`,
    `<meta property="og:type" content="${esc(m.ogType || 'website')}">`,
    `<meta property="og:title" content="${esc(ogTitle)}">`,
    `<meta property="og:description" content="${esc(ogDesc)}">`,
    `<meta property="og:url" content="${esc(m.canonical)}">`,
    `<meta property="og:image" content="${esc(ogImage)}">`,
    m.ogImageAlt ? `<meta property="og:image:alt" content="${esc(m.ogImageAlt)}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(ogTitle)}">`,
    `<meta name="twitter:description" content="${esc(ogDesc)}">`,
    `<meta name="twitter:image" content="${esc(twImage)}">`,
    s.google_site_verification ? `<meta name="google-site-verification" content="${esc(s.google_site_verification)}">` : '',
    s.bing_site_verification ? `<meta name="msvalidate.01" content="${esc(s.bing_site_verification)}">` : '',
    // Site icon: the square GHR logo (Settings → Favicon overrides the small one)
    s.favicon ? `<link rel="icon" href="${esc(ctx.abs(s.favicon))}">` : '<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/ghr-icon-32.png">',
    '<link rel="icon" type="image/png" sizes="192x192" href="/assets/img/ghr-icon-192.png">',
    '<link rel="apple-touch-icon" href="/assets/img/ghr-icon-180.png">',
    ...(m.jsonld || []).map((j) => `<script type="application/ld+json">${jsonLd(j)}</script>`),
  ];
  return tags.filter(Boolean).join('\n');
}
