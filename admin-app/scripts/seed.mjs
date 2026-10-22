// One-time import of the content that is currently hard-coded in the public site
// (../assets/js/data.js, main.js, index.html, about.html) into the database, so
// the admin panel starts with exactly what the site shows today.
//
// Idempotent: each table/section is filled only while it is still empty, so it
// never overwrites edits made in the admin. Also creates the first admin from
// ADMIN_EMAIL / ADMIN_PASSWORD when no admin exists yet.
import './env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import bcrypt from 'bcryptjs';
import { getDb, migrate } from '../lib/db-core.mjs';
import { importProjectSlides } from './project-slides.mjs';

const ROOT = path.resolve(process.cwd(), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const db = await getDb();
await migrate(db);
const isEmpty = async (table) => Number((await db.query(`select count(*)::int as n from ${table}`))[0].n) === 0;
const log = (...a) => console.log('seed:', ...a);

// ---------- load the site's data layer ----------
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(read('assets/js/data.js'), ctx);
const { GHR_PROPERTIES, GHR_DEVELOPERS, GHR_IMAGES } = ctx.window.GHR;

// ---------- admin ----------
if (await isEmpty('admins')) {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || '';
  if (email && pw.length >= 12 && pw !== 'change-me-to-a-long-passphrase') {
    await db.query('insert into admins (email, name, password_hash) values ($1, $2, $3)',
      [email, process.env.ADMIN_NAME || 'Administrator', await bcrypt.hash(pw, 12)]);
    log(`admin ${email} created`);
  } else {
    log('no admin created — set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars), then run `npm run admin:create`');
  }
}

// ---------- projects (the map directory) ----------
if (await isEmpty('projects')) {
  const dash = (v) => (v && v !== '—' && v !== '—' ? v : null);
  await db.tx(async (q) => {
    let order = 0;
    for (const d of GHR_DEVELOPERS) {
      const extra = {};
      for (const k of ['scale', 'exp', 'phone', 'phoneDisp', 'website']) if (dash(d[k])) extra[k] = d[k];
      const [{ id }] = await q.query(
        `insert into projects (slug, name, developer, city, location, starting_price, price_from, property_type,
           unit_sizes, bedrooms, possession, brochure_url, lat, lng, status, is_published, display_order, extra)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'selling',true,$15,$16::jsonb) returning id`,
        [d.id, d.name, dash(d.developer), d.city, dash(d.area), dash(d.rate), d.rateLow || null, d.kind || null,
          dash(d.sizes), dash(d.config), dash(d.status), d.brochure || null, d.lat ?? null, d.lng ?? null,
          order++, JSON.stringify(extra)]);
      const imgs = GHR_IMAGES[d.id] || [];
      for (let i = 0; i < imgs.length; i++) {
        if (i === 0) await q.query('update projects set main_image = $1 where id = $2', [imgs[0], id]);
        else await q.query('insert into project_images (project_id, kind, url, sort_order) values ($1, $2, $3, $4)', [id, 'gallery', imgs[i], i]);
      }
    }
  });
  // The homepage "Featured Properties" collage, as currently hard-coded in index.html.
  const feat = (read('index.html').match(/const featIds=\[([^\]]*)\]/) || [])[1] || '';
  const ids = [...feat.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (let i = 0; i < ids.length; i++) await db.query(
    `update projects set is_featured = true, extra = extra || jsonb_build_object('featured_rank', $2::int) where slug = $1`, [ids[i], i]);
  log(`${GHR_DEVELOPERS.length} projects imported (${ids.length} featured)`);
}

// ---------- properties (sample listings from data.js) ----------
if (await isEmpty('properties')) {
  const province = { Hyderabad: 'Telangana', Visakhapatnam: 'Andhra Pradesh' };
  for (let i = 0; i < GHR_PROPERTIES.length; i++) {
    const p = GHR_PROPERTIES[i];
    const lease = p.deal === 'Lease';
    const status = p.status === 'sold' ? (lease ? 'leased' : 'sold') : (lease ? 'for_rent' : 'for_sale');
    const n = Number(String(p.size || '').replace(/[^\d.]/g, '')) || null;
    const sqft = n == null ? null : /sq\.?\s*yd/i.test(p.size) ? Math.round(n * 9) : Math.round(n);
    await db.query(
      `insert into properties (slug, title, address, city, province, country, price, currency, price_label,
         property_type, bedrooms, bathrooms, parking, sqft, description, lat, lng, status, is_featured, display_order)
       values ($1,$2,$3,$4,$5,'India',$6,'INR',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [p.id, p.name, p.area, p.city, province[p.city] || null, p.price, p.priceLabel, p.type,
        p.beds || null, p.baths || null, p.parking || null, sqft, p.desc, p.lat, p.lng, status, p.tag === 'Featured', i]);
  }
  log(`${GHR_PROPERTIES.length} listings imported from data.js (these are the site's sample listings — review or delete them in the admin)`);
}

// ---------- agents (about.html team) ----------
if (await isEmpty('agents')) {
  const src = (read('about.html').match(/const team=(\[[\s\S]*?\]);/) || [])[1];
  const team = src ? vm.runInNewContext(src) : [];
  for (let i = 0; i < team.length; i++) {
    const m = team[i];
    const email = !m.mail ? null : m.mail.includes('@') ? m.mail : `${m.mail}@gethomerealty.ca`;
    await db.query(
      `insert into agents (name, designation, photo, phone, email, bio, service_areas, display_order)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
      [m.name, m.role, m.photo || null, m.phone || null, email, m.bio || null, JSON.stringify(m.at ? [m.at] : []), i]);
  }
  log(`${team.length} agents imported from about.html`);
}

// ---------- homepage sections ----------
const sections = {
  hero: {
    location_text: 'Canada · Hyderabad · Visakhapatnam',
    heading: 'FIND YOUR\nDREAM\nHOME',
    description: 'Trusted real estate guidance for buying, selling, investing and leasing across Canada, Hyderabad & Visakhapatnam.',
    button_text: 'DISCOVER PROPERTIES',
    button_url: 'services.html',
    image: '',
  },
  topbar: {
    phone: '+91 99632 06933',
    whatsapp: '919963206933',
    email: 'india@gethomerealty.ca',
    location_text: 'Canada · Hyderabad · Visakhapatnam',
  },
  navigation: {
    items: [
      { label: 'Home', href: 'index.html' },
      { label: 'About Us', href: 'about.html' },
      { label: 'Services', href: 'services.html' },
      { label: 'Buyers', href: 'buyers.html' },
      { label: 'Sellers', href: 'sellers.html' },
      { label: 'Investors', href: 'investors.html' },
      { label: 'Join Our Brokerage', href: 'join.html' },
      { label: 'Contact', href: 'contact.html' },
    ],
  },
  about: {
    heading: 'A professional brokerage, end to end',
    short_description: 'Get Home Realty is a professional real estate brokerage helping clients with buying, selling, leasing, investing, pre-construction and complete property services. We pair local market knowledge with a disciplined, transparent process.',
    company_description: 'Our advisors work across three regions, bringing international standards of service to fast-growing markets in Hyderabad and Visakhapatnam.',
    image: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=900&q=80',
  },
  seo: {
    seo_title: 'Get Home Realty | Real Estate in Hyderabad & Visakhapatnam',
    meta_description: 'Explore trusted real estate opportunities, projects, properties and investment options with Get Home Realty in Hyderabad, Visakhapatnam and Canada.',
    focus_keyword: 'real estate hyderabad',
    secondary_keywords: ['real estate visakhapatnam', 'pre-construction projects', 'property investment'],
    canonical_url: '', og_title: '', og_description: '', og_image: '', image_alt_text: '',
    is_indexed: true, is_followed: true,
  },
  stats: {
    items: [
      { value: '1,200+', label: 'Families Served' },
      { value: '3', label: 'Regions Covered' },
      { value: '₹600 Cr+', label: 'Property Value Handled' },
      { value: '4.9/5', label: 'Client Rating' },
    ],
  },
};
// The about lead paragraph is truncated above only if the page changed — prefer the live text.
const aboutLead = (read('about.html').match(/<p class="lead" style="margin-top:1rem">([\s\S]*?)<\/p>/) || [])[1];
if (aboutLead) sections.about.short_description = aboutLead.replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').trim();
for (const [section, content] of Object.entries(sections)) {
  const r = await db.query('insert into homepage_content (section, content) values ($1, $2::jsonb) on conflict do nothing returning section', [section, JSON.stringify(content)]);
  if (r.length) log(`homepage section "${section}" seeded`);
}

// ---------- location pages ----------
// Hyderabad & Visakhapatnam use the site's own copy for those cities (index.html);
// GTA cities start as unpublished drafts until real local content is written.
if (await isEmpty('locations')) {
  const locs = [
    { slug: 'hyderabad', name: 'Hyderabad', pub: true, intro: 'Explore residential homes, apartments, villas, plots and investment opportunities across Hyderabad’s fastest-growing corridors.' },
    { slug: 'visakhapatnam', name: 'Visakhapatnam', pub: true, intro: 'Find sea-facing apartments, villas, plots and high-yield investments along Vizag’s coast and emerging IT belt.' },
    { slug: 'mississauga', name: 'Mississauga', pub: false, intro: '' },
    { slug: 'toronto', name: 'Toronto', pub: false, intro: '' },
  ];
  for (let i = 0; i < locs.length; i++) {
    const l = locs[i];
    await db.query(
      `insert into locations (slug, name, heading, intro, match_cities, is_published, display_order)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7) on conflict (slug) do nothing`,
      [l.slug, l.name, `Real Estate in ${l.name}`, l.intro || null, JSON.stringify([l.name]), l.pub, i]);
  }
  log('location pages seeded (Hyderabad, Visakhapatnam published; Mississauga, Toronto as drafts)');
}

// ---------- contact, social, settings ----------
await db.query(
  `insert into contact_details (id, canada_phone, india_phone, whatsapp, email, offices, business_hours)
   values (1, '', '+91 99632 06933', '919963206933', 'india@gethomerealty.ca', $1::jsonb, 'Open 24/7')
   on conflict do nothing`,
  [JSON.stringify([{ label: 'Hyderabad', address: 'Louis Philippe Serilingampally, 4th Floor, 356 Old Mumbai Highway, Serilingampally (M), Telangana' }])]);

const social = {
  instagram: 'https://www.instagram.com/get_home_realty_india/',
  facebook: 'https://www.facebook.com/GetHomeRealty',
  youtube: 'https://www.youtube.com/@gethomerealty7461',
  linkedin: '',
  whatsapp: 'https://wa.me/919963206933',
  x: '',
};
for (const [platform, url] of Object.entries(social)) {
  await db.query('insert into social_links (platform, url) values ($1, $2) on conflict do nothing', [platform, url]);
}

const index = read('index.html');
const settings = {
  site_name: 'Get Home Realty',
  logo: '',
  favicon: '',
  seo_title: ((index.match(/<title>([^<]*)<\/title>/) || [])[1] || '').replace(/&amp;/g, '&'),
  seo_description: (index.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '',
  google_analytics_id: '',
  facebook_pixel_id: '',
  default_contact_email: 'india@gethomerealty.ca',
};
for (const [key, value] of Object.entries(settings)) {
  await db.query('insert into settings (key, value) values ($1, $2) on conflict do nothing', [key, value]);
}
log('contact details, social links and settings ready');

// ---------- project presentation slides (from data.js; fills empty fields only) ----------
await importProjectSlides(db, ctx.window.GHR, log);

await db.close();
