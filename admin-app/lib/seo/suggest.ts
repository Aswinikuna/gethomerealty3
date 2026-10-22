// SEO suggestions generated from a record's own content. Shared by the admin
// editor ("Generate SEO suggestion" — the admin reviews and applies them) and the
// public pages (used as the fallback when a field has been left empty).
import { formatMoney } from '../resources';

export type SuggestKind = 'property' | 'project' | 'agent' | 'video' | 'location' | 'homepage';
export interface Suggestion { seo_title: string; meta_description: string; slug: string; image_alt_text: string }

const BRAND = 'Get Home Realty';
export const TITLE_MAX = 60;
export const DESC_MAX = 160;

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'item';
}

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();
const join = (...p: unknown[]) => p.map(clean).filter(Boolean);

/** Cut at a word boundary, adding "…" only when something was removed. */
export function clip(s: string, max: number) {
  const t = clean(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:.–—-]+$/, '') + '…';
}

/** First option that fits, so titles degrade gracefully instead of being truncated. */
export const firstFit = (max: number, ...options: string[]) => options.map(clean).find((o) => o && o.length <= max) ?? clip(options[options.length - 1], max);

function place(r: Record<string, any>) {
  const area = clean(r.address || r.location);
  const city = clean(r.city);
  return area && city && !area.toLowerCase().includes(city.toLowerCase()) ? `${area}, ${city}` : area || city;
}

export function suggestSeo(kind: SuggestKind, r: Record<string, any>): Suggestion {
  switch (kind) {
    case 'property': {
      const beds = Number(r.bedrooms) > 0 ? (r.currency === 'INR' || !r.currency ? `${r.bedrooms} BHK` : `${r.bedrooms} Bed`) : '';
      const type = clean(r.property_type) || 'Property';
      const where = place(r);
      const what = join(beds, type).join(' ');
      const price = clean(r.price_label) || (r.price ? formatMoney(r.price, r.currency) : '');
      const base = `${what}${where ? ` in ${where}` : ''}`;
      const seo_title = firstFit(TITLE_MAX, `${base} | ${price} | ${BRAND}`, `${base} | ${BRAND}`, `${clean(r.title)} | ${BRAND}`, base);
      const facts = join(beds && `${beds}`, r.bathrooms && `${r.bathrooms} bath`, r.sqft && `${Number(r.sqft).toLocaleString('en-IN')} sq.ft`).join(', ');
      const meta_description = clip(
        `${clean(r.title) || base}${where ? ` in ${where}` : ''}${facts ? ` — ${facts}` : ''}${price ? `, ${price}` : ''}. ` +
        `${clean(r.description) ? clip(r.description, 70) + ' ' : ''}Book a viewing with ${BRAND}.`, DESC_MAX);
      return {
        seo_title, meta_description,
        slug: slugify(join(beds.replace(' ', '-'), type, r.address || r.location, r.city).join(' ')),
        image_alt_text: clip(`${what || clean(r.title)}${where ? ` in ${where}` : ''} — exterior`, 125),
      };
    }
    case 'project': {
      const name = clean(r.name), city = clean(r.city), loc = clean(r.location);
      const dev = clean(r.developer) !== '—' ? clean(r.developer) : '';
      const named = city && !name.toLowerCase().includes(city.toLowerCase()) ? `${name} ${city}` : name;
      return {
        seo_title: firstFit(TITLE_MAX, `${named} | Price, Floor Plans & Details`, `${named} | Price & Details`, `${named} | ${BRAND}`, named),
        // Prefer the fullest sentence that fits, rather than cutting one off mid-way.
        meta_description: firstFit(DESC_MAX,
          `Explore ${named}${dev ? ` by ${dev}` : ''}${loc ? ` in ${loc}` : ''}. View latest pricing, floor plans, amenities, location, availability and project details from ${BRAND}.`,
          `Explore ${named}${loc ? ` in ${loc}` : ''}. View latest pricing, floor plans, amenities, location, availability and project details from ${BRAND}.`,
          `Explore ${named}. View latest pricing, floor plans, amenities, location and project details from ${BRAND}.`,
          `${named}: pricing, floor plans, amenities and availability from ${BRAND}.`),
        slug: slugify(join(name, city && !name.toLowerCase().includes(city.toLowerCase()) ? city : '').join(' ')),
        image_alt_text: clip(`${named}${loc ? `, ${loc}` : ''} — project exterior`, 125),
      };
    }
    case 'agent': {
      const role = clean(r.designation) || 'Real Estate Agent';
      const areas = (r.service_areas || []).map(clean).filter(Boolean);
      return {
        seo_title: firstFit(TITLE_MAX, `${clean(r.name)} | ${role} | ${BRAND}`, `${clean(r.name)} | Real Estate Agent | ${BRAND}`, `${clean(r.name)} | ${BRAND}`),
        meta_description: clip(`${clean(r.name)}, ${role} at ${BRAND}${areas.length ? `, serving ${areas.join(', ')}` : ''}. ` +
          `${clean(r.bio) ? clip(r.bio, 80) + ' ' : ''}Contact ${clean(r.name).split(' ')[0]} for buying, selling or investing advice.`, DESC_MAX),
        slug: slugify(clean(r.name)),
        image_alt_text: `${clean(r.name)}, ${role} at ${BRAND}`,
      };
    }
    case 'video': {
      return {
        seo_title: firstFit(TITLE_MAX, `${clean(r.title)} | ${BRAND}`, clean(r.title)),
        meta_description: clip(clean(r.description) || clean(r.transcript) || `Watch ${clean(r.title)} from ${BRAND}.`, DESC_MAX),
        slug: slugify(clean(r.title)),
        image_alt_text: clip(`${clean(r.title)} — video thumbnail`, 125),
      };
    }
    case 'location': {
      const n = clean(r.name);
      return {
        seo_title: firstFit(TITLE_MAX, `Real Estate in ${n} | Homes, Projects & Advice | ${BRAND}`, `Real Estate in ${n} | ${BRAND}`, `${n} Real Estate`),
        meta_description: clip(clean(r.intro) || `Explore properties, new projects and investment opportunities in ${n} with ${BRAND} — local guidance from shortlist to registration.`, DESC_MAX),
        slug: slugify(n),
        image_alt_text: `${n} skyline and neighbourhoods`,
      };
    }
    default: {
      return {
        seo_title: firstFit(TITLE_MAX, `${BRAND} | Real Estate in Hyderabad & Visakhapatnam`, BRAND),
        meta_description: clip(`Explore trusted real estate opportunities, projects, properties and investment options with ${BRAND} in Hyderabad, Visakhapatnam and Canada.`, DESC_MAX),
        slug: '',
        image_alt_text: `${BRAND} — find your dream home`,
      };
    }
  }
}

export type Tone = 'good' | 'warn' | 'bad';

/** Length feedback: green inside the range, orange too short / missing, red too long. */
export function lengthTone(len: number, min: number, max: number): Tone {
  if (len > max) return 'bad';
  if (len < min) return 'warn';
  return 'good';
}

export const LIMITS = {
  title: { min: 50, max: 60 },
  description: { min: 120, max: 160 },
  og_title: { min: 1, max: 60 },
  og_description: { min: 1, max: 200 },
};
