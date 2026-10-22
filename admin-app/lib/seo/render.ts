// Server-side HTML for the public site.
//  • Existing pages (index.html, about.html …) are served unchanged except for the
//    generated SEO <head> block.
//  • New SEO pages (/properties/…, /projects/… etc.) use the same assets, header,
//    footer, scripts and CSS classes as the existing pages — no new design.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { esc, headHtml, type PageMeta, type SeoContext } from './head';

export const PAGE_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
const TEMPLATE_DIR = path.join(process.cwd(), 'site-pages');

/** The static site's pages (copied in by scripts/sync-site.mjs). */
export function sitePages(): string[] {
  try { return fs.readdirSync(TEMPLATE_DIR).filter((f) => /^[\w-]+\.html$/.test(f)); } catch { return []; }
}

export function readTemplate(name: string): string | null {
  if (!/^[\w-]+\.html$/.test(name)) return null;
  try { return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8'); } catch { return null; }
}

/** Title / description the page was written with (used as its SEO defaults). */
export function templateDefaults(html: string) {
  const dec = (s: string) => s.replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&rsquo;/g, '’').replace(/&quot;/g, '"');
  return {
    title: dec((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || ''),
    description: dec((html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || ''),
    h1: dec(((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
  };
}

/** Replace a page's own SEO tags with the generated block. */
export function injectHead(html: string, head: string) {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="(description|keywords|robots)"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '');
  return stripped.replace(/(<meta name="viewport"[^>]*>)/i, `$1\n${head}`);
}

export function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': PAGE_CACHE, 'X-Content-Type-Options': 'nosniff' },
  });
}

/** Full page in the site's chrome. `<base href="/">` keeps the shared relative nav links working on nested URLs. */
export function shell(ctx: SeoContext, meta: PageMeta, body: string, opts: { page?: string } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
${headHtml(ctx, meta)}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/styles.css">
</head>
<body data-page="${esc(opts.page || '')}">
<div data-gh-header></div>
<main id="main">
${body}
</main>
<div data-gh-footer></div>
<script src="/assets/js/data.js"></script>
<script src="/api/public/content.js"></script>
<script src="/assets/js/cms.js"></script>
<script src="/assets/js/main.js"></script>
</body>
</html>`;
}

// ---------- small HTML helpers (all text escaped) ----------
export const PIN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
export const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5L19 7"/></svg>';

/** Site-root path for a stored media URL ("assets/x.webp" → "/assets/x.webp"). */
export const media = (u: string | null | undefined) => (!u ? '' : /^(https?:)?\/\//.test(u) || u.startsWith('/') ? u : `/${u}`);

export function img(src: string, alt: string, opts: { w?: number; h?: number; eager?: boolean; cls?: string; style?: string } = {}) {
  return `<img${opts.cls ? ` class="${opts.cls}"` : ''} src="${esc(media(src))}" alt="${esc(alt)}" width="${opts.w || 1200}" height="${opts.h || 800}"` +
    ` ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="this.remove()"` +
    ` style="${opts.style ?? 'width:100%;height:100%;object-fit:cover;display:block'}">`;
}

/** Photo gallery in the site's `.gallery` style, with the grid adapted to 1–5 images so no tiles are left empty. */
export function galleryHtml(images: { url: string; alt: string }[]) {
  const ims = images.slice(0, 5);
  if (!ims.length) return '';
  const n = ims.length;
  const grid = n === 1 ? 'grid-template-columns:1fr;grid-template-rows:auto' : n <= 3 ? 'grid-template-columns:2fr 1fr' : '';
  return `<div class="gallery" style="margin-top:1rem;${grid}">${ims.map((im, i) => {
    const span = n === 2 && i === 1 ? ' style="grid-row:span 2"' : n === 4 && i === 3 ? ' style="grid-column:span 2"' : '';
    return `<div class="g${i === 0 ? ' main' : ''}"${span}>${img(im.url, im.alt, { eager: i === 0, w: i ? 600 : 1200, h: i ? 400 : 800 })}</div>`;
  }).join('')}</div>`;
}

/** Plain text → paragraphs; "## " lines become sub-headings. */
export function richText(text: string | null | undefined, headingTag = 'h2') {
  return String(text || '').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((b) =>
    b.startsWith('## ')
      ? `<${headingTag} class="h3" style="margin:1.8rem 0 .6rem">${esc(b.slice(3))}</${headingTag}>`
      : `<p style="margin:0 0 1rem;color:var(--slate)">${esc(b).replace(/\n/g, '<br>')}</p>`).join('\n');
}

export function breadcrumbHtml(items: { name: string; url?: string }[], light = false) {
  const style = light ? '' : ' style="color:var(--slate)"';
  return `<nav class="breadcrumb"${style} aria-label="Breadcrumb">${items.map((it, i) =>
    (i ? '<span>/</span>' : '') + (it.url ? `<a href="${esc(it.url)}"${style}>${esc(it.name)}</a>` : `<span aria-current="page">${esc(it.name)}</span>`)).join('')}</nav>`;
}

/** Card in the site's existing `.prop` style, linking to a clean URL. */
export function card(c: { href: string; title: string; image?: string; alt?: string; badge?: string; place?: string; text?: string; meta?: string }) {
  return `<article class="prop">
  <a class="prop-media" href="${esc(c.href)}" tabindex="-1" aria-hidden="true">${c.image ? img(c.image, c.alt || c.title, { w: 640, h: 440, cls: 'prop-media-bg', style: 'width:100%;height:100%;object-fit:cover' }) : ''}${c.badge ? `<span class="prop-badge">${esc(c.badge)}</span>` : ''}</a>
  <div class="prop-body">
    ${c.place ? `<div class="prop-addr">${PIN}<span>${esc(c.place)}</span></div>` : ''}
    <h3 style="font-size:1.08rem;margin:.35rem 0 .3rem"><a href="${esc(c.href)}">${esc(c.title)}</a></h3>
    ${c.meta ? `<div class="prop-type">${esc(c.meta)}</div>` : ''}
    ${c.text ? `<p class="prop-desc">${esc(c.text)}</p>` : ''}
    <div class="prop-actions"><a class="btn btn--sm" href="${esc(c.href)}">View Details</a></div>
  </div>
</article>`;
}

/** Enquiry form wired to /api/public/leads by main.js, tagged with what it's about. */
export function enquiryForm(o: { refType?: 'property' | 'project'; refId?: string; source: string; inquiry: string; placeholder: string; success: string }) {
  return `<form class="gh-form"${o.refType ? ` data-ref-type="${o.refType}" data-ref-id="${esc(o.refId)}"` : ''} data-source="${esc(o.source)}" data-inquiry="${esc(o.inquiry)}">
      <div class="form-success">${esc(o.success)}</div>
      <div class="field"><label for="ef-name">Name <span class="req">*</span></label><input id="ef-name" class="input" type="text" autocomplete="name" required><span class="err-msg">Required.</span></div>
      <div class="field"><label for="ef-phone">Phone <span class="req">*</span></label><input id="ef-phone" class="input" type="tel" autocomplete="tel" required><span class="err-msg">Enter a valid phone.</span></div>
      <div class="field"><label for="ef-email">Email <span class="req">*</span></label><input id="ef-email" class="input" type="email" autocomplete="email" required><span class="err-msg">Enter a valid email.</span></div>
      <div class="field"><label for="ef-msg">Message</label><textarea id="ef-msg" class="textarea" placeholder="${esc(o.placeholder)}"></textarea></div>
      <button class="btn btn--block" type="submit">Send Inquiry</button>
    </form>`;
}

// ---------- the static site's rich project details (GHR_DETAILS in data.js) ----------
let siteData: { mtime: number; data: any } | null = null;
/** data.js evaluated in a sandbox (it's our own file), cached until it changes. */
export function staticSiteData(): { GHR_DETAILS: Record<string, any>; GHR_IMAGES: Record<string, string[]> } {
  const file = path.join(process.cwd(), 'public', 'assets', 'js', 'data.js');
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (!siteData || siteData.mtime !== mtime) {
      const sandbox: any = { window: {} };
      vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { timeout: 2000 });
      siteData = { mtime, data: sandbox.window.GHR };
    }
    return siteData.data;
  } catch {
    return { GHR_DETAILS: {}, GHR_IMAGES: {} };
  }
}
