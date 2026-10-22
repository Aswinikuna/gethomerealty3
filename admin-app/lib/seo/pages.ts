// Server-rendered public SEO pages. Only published/active records, only public
// columns (internal prices, notes and drafts never reach these queries).
import { q, plain, type Row } from '../db';
import { formatMoney, PROJECT_STATUS, PROPERTY_STATUS, labelOf } from '../resources';
import { esc, headHtml, robotsFor, seoContext, type PageMeta, type SeoContext } from './head';
import {
  breadcrumbHtml, card, CHECK, galleryHtml, enquiryForm, htmlResponse, img, injectHead, media, PIN, readTemplate,
  richText, shell, staticSiteData, templateDefaults,
} from './render';
import { agentPerson, breadcrumbs, brokerage, compact, faqPage, organization, projectPlace, propertyListing, videoObject, webPage, website } from './schema';
import { clip, DESC_MAX, firstFit, suggestSeo, TITLE_MAX, type SuggestKind } from './suggest';
import { bhkKey, configSlug, keyFromSlug, offeredKeys, projectConfigs, sortKeys, type ConfigData } from './configs';

const SEO_COLS = 'seo_title, meta_description, canonical_url, focus_keyword, og_title, og_description, og_image, image_alt_text, is_indexed, is_followed';
const PROPERTY_COLS = `id, slug, title, address, city, province, country, postal_code, price, currency, price_label, property_type,
  bedrooms, bathrooms, parking, sqft, description, features, main_image, video_url, map_url, lat, lng, mls_number, status,
  created_at, updated_at, ${SEO_COLS}`;
const PROJECT_COLS = `id, slug, name, developer, city, location, starting_price, public_price, currency, property_type, unit_sizes,
  bedrooms, possession, description, amenities, amenity_items, details, floor_plans, connectivity, master_plan_image, master_plan_notes,
  project_scale, main_image, brochure_url, video_url, map_url, lat, lng, status, extra, created_at, updated_at, ${SEO_COLS}`;
const AGENT_COLS = `id, slug, name, designation, photo, phone, email, whatsapp, bio, languages, service_areas, instagram, facebook,
  linkedin, youtube, updated_at, ${SEO_COLS}`;
const LOCATION_COLS = `id, slug, name, heading, intro, market_content, faqs, match_cities, hero_image, updated_at, ${SEO_COLS}`;
const VIDEO_COLS = `id, slug, title, youtube_url, instagram_url, thumbnail, description, category, publish_date, duration, transcript,
  updated_at, seo_title, meta_description, image_alt_text, is_indexed`;

const MAP_PAGES: Record<string, string> = { hyderabad: '/hyderabad.html', visakhapatnam: '/visakhapatnam.html' };

/** Page metadata from a record's SEO fields, falling back to generated suggestions. */
function metaFor(ctx: SeoContext, kind: SuggestKind, rec: Row, path: string, extra: Partial<PageMeta>): PageMeta {
  const sug = suggestSeo(kind, rec);
  const canonical = rec.canonical_url ? ctx.abs(rec.canonical_url) : `${ctx.base}${path}`;
  return {
    title: rec.seo_title || sug.seo_title,
    description: rec.meta_description || sug.meta_description,
    canonical,
    robots: robotsFor(ctx, rec.is_indexed !== false, rec.is_followed !== false),
    ogTitle: rec.og_title || undefined,
    ogDescription: rec.og_description || undefined,
    ...extra,
    ogImage: rec.og_image || extra.ogImage,
    ogImageAlt: rec.image_alt_text || extra.ogImageAlt,
  };
}

async function publishedAreas(): Promise<string[]> {
  const rows = await q('select name from locations where is_published order by display_order, id');
  return rows.length ? rows.map((r) => r.name) : ['Hyderabad', 'Visakhapatnam'];
}

/** Published location page covering a city, for "area" links. */
async function locationFor(city: string | null | undefined) {
  if (!city) return null;
  return (await q(
    `select slug, name from locations where is_published and (lower(name) = lower($1)
       or exists (select 1 from jsonb_array_elements_text(match_cities) x where lower(x) = lower($1))) order by display_order limit 1`, [city]))[0] || null;
}

type Crumb = { name: string; url?: string };
const home = (ctx: SeoContext): Crumb => ({ name: 'Home', url: `${ctx.base}/` });
/** Visible breadcrumb: Home links to the homepage file, the last item is the current page. */
const crumbLinks = (crumbs: Crumb[]) => crumbs.map((c, i) => ({ name: c.name, url: i === 0 ? '/index.html' : i < crumbs.length - 1 ? c.url : undefined }));
const crumbsLd = (ctx: SeoContext, meta: PageMeta, items: { name: string; url?: string }[]) =>
  breadcrumbs(meta.canonical, items.map((i) => ({ name: i.name, url: i.url ? (i.url.startsWith('http') ? i.url : `${ctx.base}${i.url}`) : meta.canonical })));

export function notFound(ctx: SeoContext, what = 'page') {
  const meta: PageMeta = { title: 'Page not found | Get Home Realty', description: `This ${what} isn’t available.`, canonical: `${ctx.base}/`, robots: 'noindex, follow' };
  return htmlResponse(shell(ctx, meta, `<section class="section"><div class="wrap" style="text-align:center;padding-top:calc(var(--header-h) + 20px)">
    <h1 class="h2">This ${esc(what)} isn’t available</h1>
    <p class="lead" style="margin:1rem auto 2rem">It may have been sold, removed or renamed.</p>
    <a class="btn" href="/index.html">Go to the homepage</a> <a class="btn btn--ghost" href="/contact.html">Contact us</a>
  </div></section>`), 404);
}

// ---------------------------------------------------------------- properties
export async function propertyPage(req: Request, slug: string) {
  const ctx = await seoContext(req);
  const row = (await q(`select ${PROPERTY_COLS} from properties where slug = $1 and is_active`, [slug]))[0];
  if (!row) return notFound(ctx, 'property');
  const p = plain(row);
  const gallery = (await q('select url, alt from property_images where property_id = $1 order by sort_order, id limit 12', [p.id]));
  const images = [p.main_image ? { url: p.main_image, alt: p.image_alt_text || `${p.title} — main image` } : null,
    ...gallery.map((g, i) => ({ url: g.url, alt: g.alt || `${p.title} — photo ${i + 2}` }))].filter(Boolean) as { url: string; alt: string }[];
  const place = [p.address, p.city].filter(Boolean).join(', ');
  const price = p.price_label || (p.price ? formatMoney(p.price, p.currency) : '');
  const status = labelOf(PROPERTY_STATUS, p.status);
  const loc = await locationFor(p.city);
  const similar = await q(
    `select slug, title, address, city, main_image, image_alt_text, price, currency, price_label, property_type, status
       from properties where is_active and id <> $1 and lower(coalesce(city,'')) = lower($2) order by is_featured desc, display_order, id desc limit 3`,
    [p.id, p.city || '']);
  const path = `/properties/${p.slug}`;
  const meta = metaFor(ctx, 'property', p, path, { ogType: 'website', ogImage: p.main_image, ogImageAlt: images[0]?.alt });
  const crumbs: Crumb[] = [home(ctx), ...(loc ? [{ name: `Real estate in ${loc.name}`, url: `/real-estate/${loc.slug}` }] : []), { name: p.title }];
  meta.jsonld = [
    webPage(ctx, { url: meta.canonical, name: meta.title, description: meta.description, image: p.main_image }),
    crumbsLd(ctx, meta, crumbs),
    propertyListing(ctx, p, meta.canonical, images.map((i) => i.url)),
  ];
  const specs: [string, unknown][] = [['Price', price], ['Type', p.property_type], ['Bedrooms', p.bedrooms], ['Bathrooms', p.bathrooms],
    ['Parking', p.parking], ['Size', p.sqft ? `${Number(p.sqft).toLocaleString('en-IN')} sq.ft` : ''], ['MLS®', p.mls_number]];
  const body = `
<section class="section section--tight" style="padding-top:calc(var(--header-h) - 40px)"><div class="wrap">
  ${breadcrumbHtml(crumbLinks(crumbs))}
  ${galleryHtml(images)}
</div></section>
<section class="section section--tight"><div class="wrap detail-grid">
  <div>
    <span class="pill">${esc(status)}</span>
    <h1 class="h1" style="margin:.6rem 0 .4rem">${esc(p.title)}</h1>
    ${place ? `<p class="prop-addr" style="font-size:1rem">${PIN}<span>${esc(place)}</span></p>` : ''}
    <div class="spec-grid">${specs.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 0)
      .map(([k, v]) => `<div class="s"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
    ${p.description ? `<h2 class="h3" style="margin-bottom:.6rem">Description</h2>${richText(p.description, 'h3')}` : ''}
    ${(p.features || []).length ? `<h2 class="h3" style="margin:2rem 0 .9rem">Key features</h2><ul class="feature-list">${p.features.map((f: string) => `<li>${CHECK}${esc(f)}</li>`).join('')}</ul>` : ''}
    ${p.video_url ? `<p style="margin-top:1.4rem"><a class="btn btn--ghost btn--sm" href="${esc(p.video_url)}" target="_blank" rel="noopener">Watch the property video</a></p>` : ''}
    ${p.map_url ? `<p style="margin-top:.8rem"><a href="${esc(p.map_url)}" target="_blank" rel="noopener">View location on Google Maps</a></p>` : ''}
  </div>
  <aside class="detail-side">
    ${price ? `<p class="muted" style="margin:0">${p.status === 'for_rent' ? 'Rent' : 'Price'}</p><p class="h3" style="margin:.2rem 0 1rem">${esc(price)}</p>` : ''}
    <h2 class="h3" style="font-size:1.15rem;margin-bottom:1rem">Request details</h2>
    ${enquiryForm({ refType: 'property', refId: p.slug, source: 'Property page', inquiry: 'Property enquiry', placeholder: 'I’d like to view this property…', success: 'Thanks — an advisor will reach out to arrange your showing.' })}
    ${loc ? `<p style="margin:1.2rem 0 0"><a href="/real-estate/${esc(loc.slug)}">More real estate in ${esc(loc.name)} →</a></p>` : ''}
    <p style="margin:.5rem 0 0"><a href="/contact.html">Contact an agent →</a></p>
  </aside>
</div></section>
${similar.length ? `<section class="section section--mist"><div class="wrap">
  <div class="section-head"><p class="eyebrow">You may also like</p><h2 class="h2">Similar properties${p.city ? ` in ${esc(p.city)}` : ''}</h2></div>
  <div class="grid cols-3 card-list">${similar.map((s) => card({ href: `/properties/${s.slug}`, title: s.title, image: s.main_image, alt: s.image_alt_text,
    badge: labelOf(PROPERTY_STATUS, s.status), place: [s.address, s.city].filter(Boolean).join(', '),
    meta: [s.property_type, s.price_label || (s.price ? formatMoney(s.price, s.currency) : '')].filter(Boolean).join(' · ') })).join('')}</div>
</div></section>` : ''}`;
  return htmlResponse(shell(ctx, meta, body, { page: 'property-detail.html' }));
}

// ---------------------------------------------------------------- projects
export async function projectPage(req: Request, slug: string) {
  const ctx = await seoContext(req);
  const row = (await q(`select ${PROJECT_COLS} from projects where slug = $1 and is_published`, [slug]))[0];
  if (!row) return notFound(ctx, 'project');
  const p = plain(row);
  const det = staticSiteData().GHR_DETAILS?.[p.slug] || {};
  const cfgLinks = projectConfigs(p, det).map((c) => ({ href: `/projects/${p.slug}/${c.slug}`, label: `${c.key} floor plans & price` }));
  const imgs = await q(`select kind, url, alt from project_images where project_id = $1 order by sort_order, id`, [p.id]);
  const named = `${p.name}${p.city && !p.name.toLowerCase().includes(String(p.city).toLowerCase()) ? `, ${p.city}` : ''}`;
  const images = [p.main_image ? { url: p.main_image, alt: p.image_alt_text || `${named} — project image` } : null,
    ...imgs.filter((i) => i.kind === 'gallery').map((g, i) => ({ url: g.url, alt: g.alt || `${named} — photo ${i + 2}` }))].filter(Boolean) as { url: string; alt: string }[];
  const plans: { url: string; alt: string }[] = (p.floor_plans || []).filter((f: Row) => f.image).map((f: Row) => ({
    url: f.image, alt: [p.name, f.bhk, f.size, f.facing && `${f.facing} facing`, 'floor plan'].filter(Boolean).join(' — ') }));
  if (!plans.length) for (const pl of det.plans || []) if (pl && pl[1]) plans.push({ url: pl[1], alt: `${p.name} — ${pl[0] || 'floor plan'}` });
  const description = p.description || det.tagline || '';
  const amenities: string[] = (p.amenity_items || []).length ? p.amenity_items.map((a: Row) => a.title)
    : (p.amenities && p.amenities.length ? p.amenities : Array.isArray(det.amenities) ? det.amenities.flat(2).filter((a: unknown) => typeof a === 'string') : []);
  const facts: [string, string][] = (p.details || []).length ? p.details.map((d: Row) => [d.label, d.value])
    : (det.facts || []).filter((f: unknown[]) => Array.isArray(f) && f[0] && f[1]);
  const connectivity: [string, string][] = (p.connectivity || []).length ? p.connectivity.map((c: Row) => [c.place, c.time])
    : (det.location || []).filter((l: unknown[]) => Array.isArray(l) && l[0]);
  const price = p.starting_price || (p.public_price ? `Starting from ${formatMoney(p.public_price, p.currency)}` : '');
  const loc = await locationFor(p.city);
  const mapPage = MAP_PAGES[String(p.city || '').toLowerCase()];
  const [related, props] = await Promise.all([
    q(`select slug, name, location, city, main_image, image_alt_text, starting_price, public_price, currency, status from projects
        where is_published and id <> $1 and lower(coalesce(city,'')) = lower($2) order by is_featured desc, display_order, id limit 6`, [p.id, p.city || '']),
    q(`select slug, title, address, city, main_image, image_alt_text, price, currency, price_label, property_type, status from properties
        where is_active and lower(coalesce(city,'')) = lower($1) order by is_featured desc, display_order, id desc limit 3`, [p.city || '']),
  ]);
  const path = `/projects/${p.slug}`;
  const meta = metaFor(ctx, 'project', p, path, { ogImage: p.main_image, ogImageAlt: images[0]?.alt });
  const crumbs: Crumb[] = [home(ctx), ...(loc ? [{ name: `Real estate in ${loc.name}`, url: `/real-estate/${loc.slug}` }] : []), { name: p.name }];
  meta.jsonld = [
    webPage(ctx, { url: meta.canonical, name: meta.title, description: meta.description, image: p.main_image }),
    crumbsLd(ctx, meta, crumbs),
    projectPlace(ctx, { ...p, description, amenities }, meta.canonical, images.map((i) => i.url)),
  ];
  const ex = (p.extra || {}) as Row;
  const specs: [string, unknown][] = [['Developer', p.developer], ['Location', [p.location, p.city].filter(Boolean).join(', ')],
    ['Price', price], ['Configuration', p.bedrooms], ['Unit sizes', p.unit_sizes], ['Possession', p.possession],
    ['Status', labelOf(PROJECT_STATUS, p.status)], ['Project scale', p.project_scale || ex.scale]];
  const body = `
<section class="section section--tight" style="padding-top:calc(var(--header-h) - 40px)"><div class="wrap">
  ${breadcrumbHtml(crumbLinks(crumbs))}
  ${galleryHtml(images)}
</div></section>
<section class="section section--tight"><div class="wrap detail-grid">
  <div>
    <span class="pill">${esc(labelOf(PROJECT_STATUS, p.status))}</span>
    <h1 class="h1" style="margin:.6rem 0 .4rem">${esc(p.name)}</h1>
    <p class="prop-addr" style="font-size:1rem">${PIN}<span>${esc([p.location, p.city].filter(Boolean).join(', '))}${p.developer ? ` · by ${esc(p.developer)}` : ''}</span></p>
    <div class="spec-grid">${specs.filter(([, v]) => v && v !== '—').map(([k, v]) => `<div class="s"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
    ${cfgLinks.length ? `<h2 class="h3" style="margin:0 0 .4rem">Configurations</h2>${chipLinks(cfgLinks)}<div style="height:1.4rem"></div>` : ''}
    ${description ? `<h2 class="h3" style="margin-bottom:.6rem">About ${esc(p.name)}</h2>${richText(description, 'h3')}` : ''}
    ${facts.length ? `<h2 class="h3" style="margin:2rem 0 .9rem">Project details</h2><div class="spec-grid">${facts.map(([k, v]) => `<div class="s"><small>${esc(k)}</small><b style="font-size:1rem">${esc(v)}</b></div>`).join('')}</div>` : ''}
    ${amenities.length ? `<h2 class="h3" style="margin:2rem 0 .9rem">Amenities</h2><ul class="feature-list">${amenities.map((a) => `<li>${CHECK}${esc(a)}</li>`).join('')}</ul>` : ''}
    ${plans.length ? `<h2 class="h3" style="margin:2rem 0 .9rem">Floor plans</h2><div class="grid cols-2" style="gap:1rem">${plans.slice(0, 12).map((pl) =>
      `<figure style="margin:0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:#fff">${img(pl.url, pl.alt, { w: 800, h: 600, style: 'width:100%;height:auto;display:block' })}<figcaption class="muted" style="padding:.6rem .9rem;font-size:.85rem">${esc(pl.alt)}</figcaption></figure>`).join('')}</div>` : ''}
    ${p.master_plan_image ? `<h2 class="h3" style="margin:2rem 0 .9rem">Master plan</h2><figure style="margin:0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:#fff">${img(p.master_plan_image, `${p.name} master plan`, { w: 1200, h: 900, style: 'width:100%;height:auto;display:block' })}</figure>${richText(p.master_plan_notes)}` : ''}
    ${connectivity.length ? `<h2 class="h3" style="margin:2rem 0 .9rem">Location &amp; connectivity</h2><div class="spec-grid">${connectivity.map(([k, v]) => `<div class="s"><small>${esc(k)}</small><b style="font-size:1rem">${esc(v || '')}</b></div>`).join('')}</div>` : ''}
    <p style="margin-top:1.6rem;display:flex;gap:.6rem;flex-wrap:wrap">
      ${mapPage ? `<a class="btn btn--ghost btn--sm" href="${mapPage}?project=${esc(p.slug)}">View on the ${esc(p.city)} map</a>` : ''}
      ${p.brochure_url ? `<a class="btn btn--ghost btn--sm" href="${esc(media(p.brochure_url))}" target="_blank" rel="noopener">Download brochure (PDF)</a>` : ''}
      ${p.video_url ? `<a class="btn btn--ghost btn--sm" href="${esc(p.video_url)}" target="_blank" rel="noopener">Watch project video</a>` : ''}
    </p>
  </div>
  <aside class="detail-side">
    ${price ? `<p class="muted" style="margin:0">Price</p><p class="h3" style="margin:.2rem 0 1rem">${esc(price)}</p>` : ''}
    <h2 class="h3" style="font-size:1.15rem;margin-bottom:1rem">Get pricing &amp; availability</h2>
    ${enquiryForm({ refType: 'project', refId: p.slug, source: 'Project page', inquiry: 'Project enquiry', placeholder: 'Please share the latest price sheet…', success: 'Thanks — our projects desk will be in touch shortly.' })}
    ${loc ? `<p style="margin:1.2rem 0 0"><a href="/real-estate/${esc(loc.slug)}">More real estate in ${esc(loc.name)} →</a></p>` : ''}
  </aside>
</div></section>
${related.length ? `<section class="section section--mist"><div class="wrap">
  <div class="section-head"><p class="eyebrow">Related projects</p><h2 class="h2">More projects in ${esc(p.city)}</h2></div>
  <div class="grid cols-3 card-list">${related.map((r) => card({ href: `/projects/${r.slug}`, title: r.name, image: r.main_image, alt: r.image_alt_text,
    badge: labelOf(PROJECT_STATUS, r.status), place: [r.location, r.city].filter(Boolean).join(', '),
    meta: r.starting_price || (r.public_price ? `Starting from ${formatMoney(r.public_price, r.currency)}` : '') })).join('')}</div>
</div></section>` : ''}
${props.length ? `<section class="section"><div class="wrap">
  <div class="section-head"><p class="eyebrow">Related properties</p><h2 class="h2">Homes for sale &amp; rent in ${esc(p.city)}</h2></div>
  <div class="grid cols-3 card-list">${props.map((s) => card({ href: `/properties/${s.slug}`, title: s.title, image: s.main_image, alt: s.image_alt_text,
    badge: labelOf(PROPERTY_STATUS, s.status), place: [s.address, s.city].filter(Boolean).join(', '),
    meta: [s.property_type, s.price_label || (s.price ? formatMoney(s.price, s.currency) : '')].filter(Boolean).join(' · ') })).join('')}</div>
</div></section>` : ''}`;
  return htmlResponse(shell(ctx, meta, body, { page: 'services.html' }));
}

// ---------------------------------------------------------------- agents
export async function agentPage(req: Request, slug: string) {
  const ctx = await seoContext(req);
  const row = (await q(`select ${AGENT_COLS} from agents where slug = $1 and is_active`, [slug]))[0];
  if (!row) return notFound(ctx, 'agent profile');
  const a = plain(row);
  const areas: string[] = a.service_areas || [];
  const areaLinks = await Promise.all(areas.map(async (ar) => ({ name: ar, loc: await locationFor(ar.split(',')[0].trim()) })));
  const path = `/agents/${a.slug}`;
  const meta = metaFor(ctx, 'agent', a, path, { ogType: 'profile', ogImage: a.photo, ogImageAlt: a.image_alt_text || `${a.name}, ${a.designation || 'real estate agent'}` });
  const crumbs = [home(ctx), { name: 'About us', url: '/about.html' }, { name: a.name }];
  meta.jsonld = [webPage(ctx, { url: meta.canonical, name: meta.title, description: meta.description, image: a.photo, type: 'ProfilePage' }),
    crumbsLd(ctx, meta, crumbs), agentPerson(ctx, a, meta.canonical)];
  const wa = String(a.whatsapp || '').replace(/\D/g, '');
  const initials = String(a.name).split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  const body = `
<section class="section" style="padding-top:calc(var(--header-h) - 20px)"><div class="wrap">
  ${breadcrumbHtml([{ name: 'Home', url: '/index.html' }, { name: 'About us', url: '/about.html' }, { name: a.name }])}
  <div class="split" style="align-items:start;margin-top:1rem">
    <div style="max-width:420px;aspect-ratio:1;border-radius:var(--radius);overflow:hidden;background:var(--mist)">${a.photo
      ? img(a.photo, meta.ogImageAlt || a.name, { eager: true, w: 800, h: 800 })
      : `<div class="photo photo--initials" aria-hidden="true" style="height:100%;display:grid;place-items:center;font-size:4rem;font-weight:700;color:var(--red)">${esc(initials)}</div>`}</div>
    <div>
      <p class="eyebrow">${esc(a.designation || 'Real Estate Agent')}</p>
      <h1 class="h1" style="margin:.4rem 0 1rem">${esc(a.name)}</h1>
      ${richText(a.bio)}
      <div class="spec-grid">
        ${areas.length ? `<div class="s"><small>Service areas</small><b style="font-size:1rem">${areaLinks.map((x) => x.loc ? `<a href="/real-estate/${esc(x.loc.slug)}">${esc(x.name)}</a>` : esc(x.name)).join(', ')}</b></div>` : ''}
        ${(a.languages || []).length ? `<div class="s"><small>Languages</small><b style="font-size:1rem">${esc(a.languages.join(', '))}</b></div>` : ''}
        ${a.phone ? `<div class="s"><small>Phone</small><b style="font-size:1rem"><a href="tel:${esc(String(a.phone).replace(/\s/g, ''))}">${esc(a.phone)}</a></b></div>` : ''}
        ${a.email ? `<div class="s"><small>Email</small><b style="font-size:1rem"><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></b></div>` : ''}
      </div>
      <p style="display:flex;gap:.6rem;flex-wrap:wrap">
        ${wa ? `<a class="btn btn--sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp ${esc(String(a.name).split(' ')[0])}</a>` : ''}
        <a class="btn btn--ghost btn--sm" href="/contact.html">Contact Get Home Realty</a>
        ${[['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube']].filter(([k]) => a[k])
          .map(([k, l]) => `<a class="btn btn--ghost btn--sm" href="${esc(a[k])}" target="_blank" rel="noopener me">${l}</a>`).join('')}
      </p>
    </div>
  </div>
</div></section>`;
  return htmlResponse(shell(ctx, meta, body, { page: 'about.html' }));
}

// ---------------------------------------------------------------- locations
export async function locationPage(req: Request, slug: string) {
  const ctx = await seoContext(req);
  const row = (await q(`select ${LOCATION_COLS} from locations where slug = $1 and is_published`, [slug]))[0];
  if (!row) return notFound(ctx, 'page');
  const l = plain(row);
  const terms: string[] = ((l.match_cities || []).length ? l.match_cities : [l.name]).map((s: string) => s.toLowerCase());
  const likes = terms.map((t) => `%${t.replace(/[\\%_]/g, (m) => '\\' + m)}%`);
  const [props, projects, agents] = await Promise.all([
    q(`select slug, title, address, city, main_image, image_alt_text, price, currency, price_label, property_type, status from properties
        where is_active and lower(coalesce(city,'')) = any($1) order by is_featured desc, display_order, id desc limit 6`, [terms]),
    q(`select slug, name, location, city, main_image, image_alt_text, starting_price, public_price, currency, status from projects
        where is_published and lower(coalesce(city,'')) = any($1) order by is_featured desc, display_order, id limit 9`, [terms]),
    q(`select slug, name, designation, photo, image_alt_text from agents where is_active and exists (
        select 1 from jsonb_array_elements_text(service_areas) x where lower(x) like any($1)) order by display_order, id limit 8`, [likes]),
  ]);
  const projectCount = Number((await q(`select count(*)::int n from projects where is_published and lower(coalesce(city,'')) = any($1)`, [terms]))[0].n);
  const path = `/real-estate/${l.slug}`;
  const meta = metaFor(ctx, 'location', l, path, { ogImage: l.hero_image });
  const h1 = l.heading || `Real Estate in ${l.name}`;
  const crumbs = [home(ctx), { name: h1 }];
  const faqs = (l.faqs || []).filter((f: Row) => f.q && f.a);
  meta.jsonld = [webPage(ctx, { url: meta.canonical, name: meta.title, description: meta.description, image: l.hero_image }), crumbsLd(ctx, meta, crumbs),
    ...(faqs.length ? [faqPage(meta.canonical, faqs)] : [])];
  const mapPage = MAP_PAGES[l.slug];
  const byConfig = await locationConfigLinks(l);
  const body = `
<section class="hero hero--compact hero--page"${l.hero_image ? '' : ' style="background:var(--ink)"'}>
  ${l.hero_image ? `<div class="hero-bg" style="background-image:url('${esc(media(l.hero_image))}')"></div>` : ''}
  <div class="wrap hero-inner">
    ${breadcrumbHtml([{ name: 'Home', url: '/index.html' }, { name: h1 }], true)}
    <h1 class="h1">${esc(h1)}</h1>
    ${l.intro ? `<p class="lead">${esc(l.intro)}</p>` : ''}
  </div>
</section>
${l.market_content ? `<section class="section"><div class="wrap" style="max-width:860px">
  <p class="eyebrow">Local market</p><h2 class="h2" style="margin-bottom:1rem">The ${esc(l.name)} property market</h2>
  ${richText(l.market_content, 'h3')}
</div></section>` : ''}
${byConfig.length ? `<section class="section section--tight"><div class="wrap">
  <p class="eyebrow">Browse by configuration</p><h2 class="h3" style="margin:.2rem 0 .4rem">Homes in ${esc(l.name)} by BHK</h2>
  ${chipLinks(byConfig.map((x) => ({ ...x, label: `${x.label} in ${l.name}` })))}
</div></section>` : ''}
${projects.length ? `<section class="section section--mist"><div class="wrap">
  <div class="section-head" style="display:flex;justify-content:space-between;align-items:end;gap:1rem;flex-wrap:wrap;max-width:none">
    <div><p class="eyebrow">Featured projects</p><h2 class="h2">New projects in ${esc(l.name)}</h2></div>
    ${mapPage ? `<a class="btn btn--ghost" href="${mapPage}">See all ${projectCount} on the map</a>` : ''}
  </div>
  <div class="grid cols-3 card-list">${projects.map((r) => card({ href: `/projects/${r.slug}`, title: r.name, image: r.main_image, alt: r.image_alt_text,
    badge: labelOf(PROJECT_STATUS, r.status), place: [r.location, r.city].filter(Boolean).join(', '),
    meta: r.starting_price || (r.public_price ? `Starting from ${formatMoney(r.public_price, r.currency)}` : '') })).join('')}</div>
</div></section>` : ''}
${props.length ? `<section class="section"><div class="wrap">
  <div class="section-head"><p class="eyebrow">Featured properties</p><h2 class="h2">Properties in ${esc(l.name)}</h2></div>
  <div class="grid cols-3 card-list">${props.map((s) => card({ href: `/properties/${s.slug}`, title: s.title, image: s.main_image, alt: s.image_alt_text,
    badge: labelOf(PROPERTY_STATUS, s.status), place: [s.address, s.city].filter(Boolean).join(', '),
    meta: [s.property_type, s.price_label || (s.price ? formatMoney(s.price, s.currency) : '')].filter(Boolean).join(' · ') })).join('')}</div>
</div></section>` : ''}
${agents.length ? `<section class="section section--mist"><div class="wrap">
  <div class="section-head"><p class="eyebrow">Local advisors</p><h2 class="h2">Agents serving ${esc(l.name)}</h2></div>
  <div class="grid cols-4">${agents.map((a) => `<article class="card" style="text-align:center">
    <div style="width:96px;height:96px;margin:0 auto 1rem;border-radius:50%;overflow:hidden;background:var(--mist)">${a.photo ? img(a.photo, a.image_alt_text || a.name, { w: 192, h: 192 }) : ''}</div>
    <h3 style="font-size:1.05rem"><a href="/agents/${esc(a.slug)}">${esc(a.name)}</a></h3>
    ${a.designation ? `<p class="muted" style="margin:.3rem 0 0;font-size:.9rem">${esc(a.designation)}</p>` : ''}</article>`).join('')}</div>
</div></section>` : ''}
${faqs.length ? `<section class="section"><div class="wrap" style="max-width:860px">
  <p class="eyebrow">FAQs</p><h2 class="h2" style="margin-bottom:1.2rem">Questions about buying in ${esc(l.name)}</h2>
  ${faqs.map((f: Row) => `<details class="card" style="margin-bottom:.8rem"><summary style="cursor:pointer;font-weight:600">${esc(f.q)}</summary><div style="margin-top:.8rem">${richText(f.a)}</div></details>`).join('')}
</div></section>` : ''}
<section class="section"><div class="wrap"><div class="cta-band">
  <h2 class="h2">Looking for property in ${esc(l.name)}?</h2>
  <p>Talk to a Get Home Realty advisor for a shortlist that fits your budget and timeline.</p>
  <div class="btns"><a class="btn btn--light" href="/contact.html">Contact Get Home Realty</a></div>
</div></div></section>`;
  return htmlResponse(shell(ctx, meta, body, { page: mapPage ? mapPage.slice(1) : 'services.html' }));
}

// ---------------------------------------------------------------- videos
export async function videoPage(req: Request, slug: string) {
  const ctx = await seoContext(req);
  const row = (await q(`select ${VIDEO_COLS} from videos where slug = $1 and is_active`, [slug]))[0];
  if (!row) return notFound(ctx, 'video');
  const v = plain(row);
  if (v.publish_date) v.publish_date = String(v.publish_date).slice(0, 10);
  const yt = String(v.youtube_url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  const thumb = v.thumbnail || (yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : '');
  const path = `/videos/${v.slug}`;
  const meta = metaFor(ctx, 'video', v, path, { ogType: 'video.other', ogImage: thumb, ogImageAlt: v.image_alt_text || `${v.title} — video thumbnail` });
  const crumbs = [home(ctx), { name: v.title }];
  meta.jsonld = [webPage(ctx, { url: meta.canonical, name: meta.title, description: meta.description, image: thumb }), crumbsLd(ctx, meta, crumbs),
    videoObject(ctx, v, meta.canonical, thumb)];
  const others = await q('select slug, title, thumbnail, youtube_url, image_alt_text, description from videos where is_active and id <> $1 order by display_order, id desc limit 3', [v.id]);
  const body = `
<section class="section" style="padding-top:calc(var(--header-h) - 20px)"><div class="wrap" style="max-width:960px">
  ${breadcrumbHtml([{ name: 'Home', url: '/index.html' }, { name: v.title }])}
  ${v.category ? `<p class="eyebrow">${esc(v.category)}</p>` : ''}
  <h1 class="h2" style="margin:.4rem 0 1.2rem">${esc(v.title)}</h1>
  ${yt ? `<div style="position:relative;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden;background:#000">
    <iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="${esc(v.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe></div>`
    : thumb ? `<a href="${esc(v.instagram_url || '#')}" target="_blank" rel="noopener" style="display:block;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden">${img(thumb, v.image_alt_text || `${v.title} — video thumbnail`, { eager: true })}</a>` : ''}
  <p class="muted" style="margin-top:.8rem">${[v.publish_date ? `Published ${esc(new Date(v.publish_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))}` : '', v.duration ? `Duration ${esc(v.duration)}` : ''].filter(Boolean).join(' · ')}</p>
  ${v.description ? richText(v.description) : ''}
  ${v.instagram_url && !yt ? `<p><a class="btn btn--sm" href="${esc(v.instagram_url)}" target="_blank" rel="noopener">Watch on Instagram</a></p>` : ''}
  ${v.transcript ? `<h2 class="h3" style="margin:2rem 0 .8rem">Transcript</h2>${richText(v.transcript, 'h3')}` : ''}
</div></section>
${others.length ? `<section class="section section--mist"><div class="wrap">
  <div class="section-head"><p class="eyebrow">Watch next</p><h2 class="h2">More videos</h2></div>
  <div class="grid cols-3 card-list">${others.map((o) => {
    const oy = String(o.youtube_url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
    return card({ href: `/videos/${o.slug}`, title: o.title, image: o.thumbnail || (oy ? `https://i.ytimg.com/vi/${oy[1]}/hqdefault.jpg` : ''), alt: o.image_alt_text, text: clip(o.description || '', 120) });
  }).join('')}</div>
</div></section>` : ''}`;
  return htmlResponse(shell(ctx, meta, body, { page: 'index.html' }));
}

// ---------------------------------------------------------------- existing static pages
const PAGE_NAMES: Record<string, string> = {
  'about.html': 'About us', 'services.html': 'Services', 'hyderabad.html': 'Hyderabad', 'visakhapatnam.html': 'Visakhapatnam',
  'buyers.html': 'Buyers', 'sellers.html': 'Sellers', 'investors.html': 'Investors', 'join.html': 'Join our brokerage',
  'contact.html': 'Contact', 'blog.html': 'Blog',
};
/** Legacy template that renders arbitrary listings client-side — never indexed; real listings live at /properties/<slug>. */
const NOINDEX_PAGES = new Set(['property-detail.html']);

export async function staticPage(req: Request, name: string) {
  const html = readTemplate(name);
  const ctx = await seoContext(req);
  if (!html) return notFound(ctx);
  const d = templateDefaults(html);
  let meta: PageMeta;
  if (name === 'index.html') {
    const s = ctx.homepage.seo || {};
    const canonical = s.canonical_url ? ctx.abs(s.canonical_url) : `${ctx.base}/`;
    meta = {
      title: s.seo_title || ctx.settings.seo_title || d.title,
      description: s.meta_description || ctx.settings.seo_description || d.description,
      canonical, robots: robotsFor(ctx, s.is_indexed !== false, s.is_followed !== false),
      ogTitle: s.og_title || ctx.settings.default_og_title || undefined,
      ogDescription: s.og_description || ctx.settings.default_og_description || undefined,
      ogImage: s.og_image || ctx.homepage.hero?.image || undefined, ogImageAlt: s.image_alt_text || undefined,
    };
    meta.jsonld = [organization(ctx), website(ctx), brokerage(ctx, await publishedAreas()),
      webPage(ctx, { url: canonical, name: meta.title, description: meta.description, breadcrumb: false })];
  } else {
    const canonical = `${ctx.base}/${name}`;
    meta = {
      title: d.title, description: d.description || ctx.settings.seo_description, canonical,
      robots: robotsFor(ctx, !NOINDEX_PAGES.has(name), true),
    };
    const crumbs = [home(ctx), { name: PAGE_NAMES[name] || d.h1 || d.title }];
    meta.jsonld = [webPage(ctx, { url: canonical, name: meta.title, description: meta.description }), crumbsLd(ctx, meta, crumbs),
      ...(name === 'contact.html' ? [brokerage(ctx, await publishedAreas())] : [])];
  }
  return htmlResponse(injectHead(html, headHtml(ctx, meta)));
}


// ---------------------------------------------------------------- configuration pages (2 BHK / 3 BHK …)
/** Location terms for matching a location page's projects. */
const termsOf = (l: Row) => ((l.match_cities || []).length ? l.match_cities : [l.name]).map((s: string) => s.toLowerCase());

/** Configurations with ≥ MIN_LISTED projects in a location — enough to justify a listing page. */
const MIN_LISTED = 2;
async function locationConfigIndex(l: Row) {
  const rows = await q(`select ${PROJECT_COLS} from projects where is_published and lower(coalesce(city,'')) = any($1) order by is_featured desc, display_order, id`, [termsOf(l)]);
  const details = staticSiteData().GHR_DETAILS || {};
  const byKey = new Map<string, { p: Row; c?: ConfigData }[]>();
  for (const r of rows) {
    const p = plain(r), det = details[p.slug] || {}, cfgs = projectConfigs(p, det);
    for (const k of offeredKeys(p, det)) byKey.set(k, [...(byKey.get(k) || []), { p, c: cfgs.find((c) => c.key === k) }]);
  }
  const keys = sortKeys([...byKey.keys()]).filter((k) => (byKey.get(k) || []).length >= MIN_LISTED);
  return { byKey, keys };
}

const chipLinks = (items: { href: string; label: string; active?: boolean }[]) =>
  `<div class="chips" style="margin:.4rem 0 0">${items.map((i) => i.active
    ? `<span class="chip is-active" aria-current="page">${esc(i.label)}</span>`
    : `<a class="chip" href="${esc(i.href)}">${esc(i.label)}</a>`).join('')}</div>`;

function unitTable(head: string[], rows: string[][]) {
  if (!rows.length) return '';
  return `<div class="pm-tablewrap"><table class="pm-table"><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/** /projects/<slug>/<config> — one configuration of one project. */
export async function configProjectPage(req: Request, slug: string, cslug: string) {
  const ctx = await seoContext(req);
  const key = keyFromSlug(cslug);
  const row = key ? (await q(`select ${PROJECT_COLS} from projects where slug = $1 and is_published`, [slug]))[0] : null;
  if (!row) return notFound(ctx, 'page');
  const p = plain(row);
  const det = staticSiteData().GHR_DETAILS?.[p.slug] || {};
  const cfgs = projectConfigs(p, det);
  const c = cfgs.find((x) => x.key === key);
  if (!c) return notFound(ctx, 'page');           // no real data for this configuration → no page
  const loc = await locationFor(p.city);
  const place = [p.location, p.city].filter(Boolean).join(', ');
  const f = c.facts;
  const path = `/projects/${p.slug}/${c.slug}`;
  const canonical = `${ctx.base}${path}`;
  const title = firstFit(TITLE_MAX, `${key} in ${p.name} ${p.location || p.city || ''} | Floor Plans & Price`.replace(/\s+\|/, ' |'),
    `${key} in ${p.name} | Floor Plans & Price`, `${key} in ${p.name} | Get Home Realty`, `${key} in ${p.name}`);
  const description = firstFit(DESC_MAX,
    `${key} homes in ${p.name}${p.developer ? ` by ${p.developer}` : ''}, ${place}${f.sizes ? ` — ${f.sizes}` : ''}. See ${key} floor plans, carpet areas, towers and pricing from Get Home Realty.`,
    `${key} homes in ${p.name}, ${place}${f.sizes ? ` — ${f.sizes}` : ''}. See ${key} floor plans, sizes and pricing from Get Home Realty.`,
    `${key} homes in ${p.name}, ${place}. Floor plans, sizes and pricing from Get Home Realty.`);
  const meta: PageMeta = {
    title, description, canonical, robots: robotsFor(ctx, p.is_indexed !== false, p.is_followed !== false),
    ogImage: c.plans.find((x) => x.image)?.image || p.main_image, ogImageAlt: `${p.name} ${key} floor plan`,
  };
  const crumbs: Crumb[] = [home(ctx), ...(loc ? [{ name: `Real estate in ${loc.name}`, url: `/real-estate/${loc.slug}` }] : []),
    { name: p.name, url: `/projects/${p.slug}` }, { name: key }];
  const plans = c.plans.filter((x) => x.image);
  const bedrooms = parseFloat(key) || undefined;
  meta.jsonld = [
    webPage(ctx, { url: canonical, name: title, description, image: meta.ogImage }),
    crumbsLd(ctx, meta, crumbs),
    compact({
      '@context': 'https://schema.org', '@type': /apartment/i.test(p.property_type || '') ? 'ApartmentComplex' : 'Residence',
      '@id': `${ctx.base}/projects/${p.slug}#place`, name: p.name, url: `${ctx.base}/projects/${p.slug}`,
      address: compact({ '@type': 'PostalAddress', addressLocality: place || undefined }),
      accommodationFloorPlan: c.plans.map((x) => compact({
        '@type': 'FloorPlan', name: [p.name, key, x.size, x.facing && `${x.facing} facing`].filter(Boolean).join(' — '),
        numberOfBedrooms: bedrooms,
        floorSize: /^[\d,]+\s*sq/i.test(String(x.size || '')) ? { '@type': 'QuantitativeValue', value: Number(String(x.size).replace(/[^\d]/g, '')), unitCode: 'FTK' } : undefined,
        layoutImage: x.image ? ctx.abs(x.image) : undefined,
      })),
    }),
  ];
  // amenities: every shared one, plus those limited to this configuration
  const amen = ((p.amenity_items || []) as Row[]).filter((a) => {
    const only = String(a.configs || '').split(/[,;&/]|\band\b/).map((s) => bhkKey(s.trim())).filter(Boolean);
    return !only.length || only.includes(key);
  });
  const glance: [string, string][] = ([['Sizes', f.sizes], ['Carpet area', f.carpet], ['Towers', f.towers], ['Facing', f.facing],
    ['Price (builder price sheet)', f.price], ['Possession', p.possession || ''], ['Floor plans', plans.length ? String(plans.length) : '']] as [string, string][])
    .filter(([, v]) => v);
  const intro = [`${p.name}${p.developer ? ` by ${p.developer}` : ''} in ${place} offers ${key} homes`,
    f.sizes ? ` of ${f.sizes}` : '', f.carpet ? ` (carpet ${f.carpet})` : '', f.towers ? ` in towers ${f.towers}` : '',
    f.facing ? `, ${f.facing.replace(' · ', ' and ')} facing` : '', '.'].join('');
  const others = cfgs.map((x) => ({ href: `/projects/${p.slug}/${x.slug}`, label: x.key, active: x.key === key }));
  const body = `
<section class="section section--tight" style="padding-top:calc(var(--header-h) - 40px)">
<div class="wrap">${breadcrumbHtml(crumbLinks(crumbs))}</div>
<div class="wrap detail-grid" style="margin-top:1.4rem">
  <div>
    <span class="pill">${esc(key)}</span>
    <h1 class="h1" style="margin:.6rem 0 .4rem">${esc(key)} Homes in ${esc(p.name)}</h1>
    <p class="prop-addr" style="font-size:1rem">${PIN}<span>${esc(place)}${p.developer ? ` · by ${esc(p.developer)}` : ''}</span></p>
    <p style="margin:1rem 0;color:var(--slate)">${esc(intro)}</p>
    ${glance.length ? `<div class="spec-grid">${glance.map(([k, v]) => `<div class="s"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
    ${others.length > 1 ? `<h2 class="h3" style="margin:1.6rem 0 .4rem">Other configurations</h2>${chipLinks(others)}` : ''}
    ${plans.length ? `<h2 class="h3" style="margin:2rem 0 .9rem">${esc(key)} floor plans</h2><div class="grid cols-2" style="gap:1rem">${plans.map((x) => {
      const alt = [p.name, key, x.size, x.facing && `${x.facing} facing`, 'floor plan'].filter(Boolean).join(' — ');
      const cap = [x.size, x.carpet && `carpet ${x.carpet}`, x.tower && `tower ${x.tower}`, x.facing && `${x.facing} facing`].filter(Boolean).join(' · ');
      return `<figure style="margin:0;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:#fff">${img(x.image, alt, { w: 800, h: 600, style: 'width:100%;height:auto;display:block' })}<figcaption class="muted" style="padding:.6rem .9rem;font-size:.85rem"><b style="color:var(--ink)">${esc(x.bhk || key)}</b>${cap ? ` · ${esc(cap)}` : ''}${x.description ? `<br>${esc(x.description)}` : ''}</figcaption></figure>`;
    }).join('')}</div>` : ''}
    ${c.rows.length ? `<h2 class="h3" style="margin:2rem 0 .9rem">${esc(key)} units</h2>${unitTable(c.head, c.rows)}<p class="muted" style="font-size:.82rem;margin-top:.5rem">From the builder’s published price sheet; prices and availability change — confirm with our team.</p>` : ''}
    ${amen.length ? `<h2 class="h3" style="margin:2rem 0 .9rem">Amenities for ${esc(key)} residents</h2><ul class="feature-list">${amen.map((a) => `<li>${CHECK}${esc(a.title)}</li>`).join('')}</ul>` : ''}
    <p style="margin-top:1.6rem;display:flex;gap:.6rem;flex-wrap:wrap">
      <a class="btn btn--ghost btn--sm" href="/projects/${esc(p.slug)}">All about ${esc(p.name)}</a>
      ${loc ? `<a class="btn btn--ghost btn--sm" href="/real-estate/${esc(loc.slug)}/${esc(c.slug)}">${esc(key)} homes in ${esc(loc.name)}</a>` : ''}
    </p>
  </div>
  <aside class="detail-side">
    ${f.price ? `<p class="muted" style="margin:0">${esc(key)} price</p><p class="h3" style="margin:.2rem 0 1rem">${esc(f.price)}</p>` : ''}
    <h2 class="h3" style="font-size:1.15rem;margin-bottom:1rem">Check ${esc(key)} availability</h2>
    ${enquiryForm({ refType: 'project', refId: p.slug, source: 'Configuration page', inquiry: `${key} enquiry`, placeholder: `Please share available ${key} units and the latest price sheet…`, success: 'Thanks — our projects desk will be in touch shortly.' })}
  </aside>
</div></section>`;
  return htmlResponse(shell(ctx, meta, body, { page: 'services.html' }));
}

/** /real-estate/<location>/<config> — every project offering one configuration in a location. */
export async function configLocationPage(req: Request, lslug: string, cslug: string) {
  const ctx = await seoContext(req);
  const key = keyFromSlug(cslug);
  const lrow = key ? (await q(`select ${LOCATION_COLS} from locations where slug = $1 and is_published`, [lslug]))[0] : null;
  if (!lrow) return notFound(ctx, 'page');
  const l = plain(lrow);
  const { byKey, keys } = await locationConfigIndex(l);
  const list = byKey.get(key) || [];
  if (list.length < MIN_LISTED) return notFound(ctx, 'page');   // too few projects for a useful page
  const detailed = list.filter((x) => x.c).length;
  const path = `/real-estate/${l.slug}/${cslug}`;
  const canonical = `${ctx.base}${path}`;
  const kind = /villa|plot/i.test(key) ? `${key}s` : `${key} Flats & Apartments`;
  const title = firstFit(TITLE_MAX, `${kind} in ${l.name} | New Projects`, `${kind} in ${l.name}`, `${key} in ${l.name} | Get Home Realty`);
  const description = firstFit(DESC_MAX,
    `Compare ${list.length} new projects with ${key} homes in ${l.name} — sizes, floor plans, possession and pricing, with local advice from Get Home Realty.`,
    `Compare ${list.length} projects with ${key} homes in ${l.name}: sizes, floor plans and pricing from Get Home Realty.`);
  const meta: PageMeta = { title, description, canonical, robots: robotsFor(ctx, l.is_indexed !== false, l.is_followed !== false), ogImage: l.hero_image || list.find((x) => x.p.main_image)?.p.main_image };
  const h1 = `${kind} in ${l.name}`;
  const crumbs: Crumb[] = [home(ctx), { name: l.heading || `Real estate in ${l.name}`, url: `/real-estate/${l.slug}` }, { name: h1 }];
  meta.jsonld = [
    webPage(ctx, { url: canonical, name: title, description, type: 'CollectionPage' }),
    crumbsLd(ctx, meta, crumbs),
    { '@context': 'https://schema.org', '@type': 'ItemList', '@id': `${canonical}#list`, numberOfItems: list.length,
      itemListElement: list.map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ctx.base}/projects/${x.p.slug}${x.c ? `/${x.c.slug}` : ''}`, name: x.p.name })) },
  ];
  const cards = list.map(({ p, c }) => card({
    href: `/projects/${p.slug}${c ? `/${c.slug}` : ''}`, title: p.name, image: p.main_image, alt: p.image_alt_text || `${p.name}, ${p.location || l.name}`,
    badge: labelOf(PROJECT_STATUS, p.status), place: [p.location, p.city].filter(Boolean).join(', '),
    meta: c?.facts.sizes ? `${key} · ${c.facts.sizes}` : [p.bedrooms, p.unit_sizes].filter(Boolean).join(' · '),
    text: [p.possession && p.possession !== '—' ? p.possession : '', c?.facts.price ? `${key}: ${c.facts.price}` : (p.starting_price || '')].filter(Boolean).join(' · '),
  })).join('');
  const mapPage = MAP_PAGES[l.slug];
  const body = `
<section class="hero hero--compact hero--page"${l.hero_image ? '' : ' style="background:var(--ink)"'}>
  ${l.hero_image ? `<div class="hero-bg" style="background-image:url('${esc(media(l.hero_image))}')"></div>` : ''}
  <div class="wrap hero-inner">
    ${breadcrumbHtml(crumbLinks(crumbs), true)}
    <h1 class="h1">${esc(h1)}</h1>
    <p class="lead">${esc(`${list.length} new projects in ${l.name} offer ${key} homes${detailed ? ` — ${detailed} with ${key} floor plans and unit details` : ''}.`)}</p>
  </div>
</section>
<section class="section"><div class="wrap">
  ${keys.length > 1 ? `<p class="eyebrow">Browse by configuration</p>${chipLinks(keys.map((k) => ({ href: `/real-estate/${l.slug}/${configSlug(k)}`, label: k, active: k === key })))}` : ''}
  <div class="grid cols-3 card-list" style="margin-top:1.6rem">${cards}</div>
  <p style="margin-top:1.6rem;display:flex;gap:.6rem;flex-wrap:wrap">
    <a class="btn btn--ghost btn--sm" href="/real-estate/${esc(l.slug)}">All real estate in ${esc(l.name)}</a>
    ${mapPage ? `<a class="btn btn--ghost btn--sm" href="${mapPage}">See every project on the ${esc(l.name)} map</a>` : ''}
  </p>
</div></section>
<section class="section"><div class="wrap"><div class="cta-band">
  <h2 class="h2">Looking for a ${esc(key)} in ${esc(l.name)}?</h2>
  <p>Tell us your budget and preferred area — we’ll shortlist ${esc(key)} options and arrange site visits.</p>
  <div class="btns"><a class="btn btn--light" href="/contact.html">Contact Get Home Realty</a></div>
</div></div></section>`;
  return htmlResponse(shell(ctx, meta, body, { page: mapPage ? mapPage.slice(1) : 'services.html' }));
}

/** Configuration pages to list in the sitemap (published + indexable only). */
export async function configSitemapPaths(): Promise<{ path: string; lastmod?: string }[]> {
  const out: { path: string; lastmod?: string }[] = [];
  const details = staticSiteData().GHR_DETAILS || {};
  const projects = await q(`select ${PROJECT_COLS} from projects where is_published and is_indexed and (canonical_url is null or canonical_url = '')`);
  for (const r of projects) {
    const p = plain(r);
    for (const c of projectConfigs(p, details[p.slug] || {})) out.push({ path: `/projects/${p.slug}/${c.slug}`, lastmod: String(p.updated_at || '').slice(0, 10) || undefined });
  }
  const locs = await q(`select ${LOCATION_COLS} from locations where is_published and is_indexed`);
  for (const r of locs) {
    const l = plain(r);
    for (const k of (await locationConfigIndex(l)).keys) out.push({ path: `/real-estate/${l.slug}/${configSlug(k)}` });
  }
  return out;
}

/** "Browse by configuration" links for a location page (only configurations that have a listing page). */
export async function locationConfigLinks(l: Row) {
  const { keys } = await locationConfigIndex(l);
  return keys.map((k) => ({ href: `/real-estate/${l.slug}/${configSlug(k)}`, label: k }));
}
