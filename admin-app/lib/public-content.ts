// What the public website reads. Only published/active/approved records, and only
// the fields the pages render — never internal data (leads, notes, admin info).
import { q, type Row } from './db';
import { formatMoney } from './resources';
import { readSingleton } from './singletons';

// Explicit allow-lists. Internal columns (builder_price, brokerage_price) are never
// selected here, so they cannot reach the public payload even by mistake.
const PROJECT_COLS = `id, slug, name, developer, city, location, starting_price, public_price, currency, price_from,
  property_type, unit_sizes, bedrooms, possession, project_scale, main_image, brochure_url, video_url,
  lat, lng, status, is_featured, extra`;
const PROPERTY_COLS = `id, slug, title, address, city, province, country, postal_code, price, currency, price_label,
  property_type, bedrooms, bathrooms, parking, sqft, description, features, main_image, video_url, map_url,
  lat, lng, mls_number, status, is_featured`;

const n = (v: unknown) => (v == null ? null : Number(v));

function projectOut(p: Row, imgs: Row[]) {
  const extra = (p.extra || {}) as Record<string, any>;
  const gallery = imgs.filter((i) => i.kind === 'gallery').map((i) => i.url);
  return {
    id: p.slug, name: p.name, developer: p.developer || '—', city: p.city || '', area: p.location || '',
    lat: n(p.lat), lng: n(p.lng), rateLow: n(p.price_from) || 0,
    rate: p.starting_price || (p.public_price ? `Starting from ${formatMoney(p.public_price, p.currency)}` : 'On request'),
    sizes: p.unit_sizes || 'On request',
    scale: p.project_scale || extra.scale || '—', exp: extra.exp || '—', status: p.possession || '—',
    config: p.bedrooms || '', kind: p.property_type || undefined, brochure: p.brochure_url || undefined,
    phone: extra.phone || '', phoneDisp: extra.phoneDisp || '', website: extra.website || '',
    salesStatus: p.status, featured: p.is_featured, featuredRank: extra.featured_rank ?? null,
    video: p.video_url || '',
    images: [p.main_image, ...gallery].filter(Boolean),
  };
}

async function projects(where: string) {
  const rows = await q(`select ${PROJECT_COLS} from projects where is_published ${where} order by display_order, id`);
  if (!rows.length) return [];
  const imgs = await q(
    `select project_id, kind, url, alt from project_images where project_id = any($1::int[]) order by sort_order, id`,
    [rows.map((r) => r.id)]);
  const byId = new Map<number, Row[]>();
  for (const i of imgs) byId.set(i.project_id, [...(byId.get(i.project_id) || []), i]);
  return rows.map((p) => projectOut(p, byId.get(p.id) || []));
}

async function properties() {
  const rows = await q(`select ${PROPERTY_COLS} from properties where is_active order by display_order, id desc limit 500`);
  const imgs = rows.length
    ? await q('select property_id, url from property_images where property_id = any($1::int[]) order by sort_order, id', [rows.map((r) => r.id)])
    : [];
  return rows.map((p) => ({
    id: p.slug, name: p.title, address: p.address || '', city: p.city || '', area: p.address || p.city || '',
    province: p.province || '', country: p.country || '', postal: p.postal_code || '',
    type: p.property_type || 'Other',
    deal: p.status === 'for_rent' || p.status === 'leased' ? 'Lease' : 'Buy',
    statusKey: p.status, status: p.status === 'sold' || p.status === 'leased' ? 'sold' : 'available',
    price: n(p.price) || 0, currency: p.currency, priceLabel: p.price_label || (p.price ? formatMoney(p.price, p.currency) : ''),
    beds: p.bedrooms || 0, baths: n(p.bathrooms) || 0, parking: p.parking || 0,
    size: p.sqft ? `${Number(p.sqft).toLocaleString('en-IN')} sq.ft` : '',
    desc: p.description || '', features: p.features || [], mls: p.mls_number || '',
    lat: n(p.lat), lng: n(p.lng), map: p.map_url || '', video: p.video_url || '',
    tag: p.is_featured ? 'Featured' : '', featured: p.is_featured,
    image: p.main_image || '', images: [p.main_image, ...imgs.filter((i) => i.property_id === p.id).map((i) => i.url)].filter(Boolean),
  }));
}

export async function publicContent(withSets: Set<string>) {
  const [homepage, contact, social, settings, reviews, videos, agents, featured, propCount, projCount] = await Promise.all([
    readSingleton('homepage'), readSingleton('contact'), readSingleton('social'), readSingleton('settings'),
    q(`select client_name as name, rating, review_text as text, client_image as image, location,
              to_char(review_date, 'YYYY-MM-DD') as date
         from reviews where is_approved and is_active order by display_order, id desc limit 24`),
    q(`select slug, title, youtube_url as youtube, instagram_url as instagram, thumbnail, description, category
         from videos where is_active order by display_order, id desc limit 24`),
    q(`select name, designation, photo, phone, email, whatsapp, bio, languages, service_areas as areas,
              instagram, facebook, linkedin, youtube
         from agents where is_active order by display_order, id limit 48`),
    projects(`and is_featured`),
    q('select count(*)::int as n from properties'),
    q('select count(*)::int as n from projects'),
  ]);
  featured.sort((a, b) => (a.featuredRank ?? 1e9) - (b.featuredRank ?? 1e9));
  return {
    v: 1,
    // SEO values are rendered into page source server-side; keywords etc. stay internal.
    homepage: { ...homepage, seo: undefined }, contact, social,
    settings: {
      site_name: settings.site_name, logo: settings.logo, favicon: settings.favicon,
      ga: settings.google_analytics_id, pixel: settings.facebook_pixel_id,
    },
    reviews, videos, agents,
    featuredProjects: featured.slice(0, 12),
    // null = this table is empty, so the page keeps its built-in content.
    properties: withSets.has('properties') ? (propCount[0].n ? await properties() : null) : undefined,
    projects: withSets.has('projects') ? (projCount[0].n ? await projects('') : null) : undefined,
  };
}
