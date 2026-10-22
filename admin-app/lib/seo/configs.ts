// Per-configuration (2 BHK / 3 BHK …) data for a project, built only from its own
// floor plans and the builder's unit table — the same rules as the popup's BHK
// filter in assets/js/maps.js. Used by the /projects/<slug>/<config> and
// /real-estate/<city>/<config> SEO pages.
import type { Row } from '../db';

/** "Prime 3 BHK · east facing" → "3 BHK"; '' when it isn't a unit type. */
export function bhkKey(s: unknown): string {
  const t = String(s || ''), m = t.match(/(\d(?:\.\d)?)\s*bhk/i);
  if (m) return `${m[1]} BHK`;
  if (/studio/i.test(t)) return 'Studio';
  if (/villa/i.test(t)) return 'Villa';
  if (/plot/i.test(t)) return 'Plot';
  return '';
}

/** "3 BHK" → "3-bhk", "2.5 BHK" → "2-5-bhk", "Villa" → "villa". */
export const configSlug = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Inverse of configSlug for the URL; '' if it isn't a configuration. */
export function keyFromSlug(slug: string): string {
  const m = slug.match(/^(\d)(?:-(\d))?-bhk$/);
  if (m) return `${m[1]}${m[2] ? `.${m[2]}` : ''} BHK`;
  return ({ studio: 'Studio', villa: 'Villa', plot: 'Plot' } as Record<string, string>)[slug] || '';
}

/** Keys named in a configuration text such as "2, 3 & 4 BHK". */
export function keysFromText(text: unknown): string[] {
  return String(text || '').split(/,|&|·|\/|\band\b/)
    .map((s) => s.trim()).map((s) => (/^\d(\.\d)?$/.test(s) ? `${s} BHK` : s)).map(bhkKey).filter(Boolean);
}

export const sortKeys = (keys: string[]) =>
  [...new Set(keys)].sort((a, b) => (parseFloat(a) || 99) - (parseFloat(b) || 99) || a.localeCompare(b));

export interface ConfigData {
  key: string;
  slug: string;
  plans: Row[];                 // floor plans of this configuration
  head: string[];               // unit-table header
  rows: string[][];             // unit-table rows of this configuration
  facts: { sizes: string; carpet: string; towers: string; facing: string; price: string };
}

const uniq = (a: unknown[]) => [...new Set(a.map((v) => String(v ?? '').trim()).filter(Boolean))];
const num = (v: string) => { const m = v.replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
function area(vals: unknown[]) {
  const u = uniq(vals).map((v) => (/sq/i.test(v) ? v : `${v} sq.ft`));
  if (!u.length) return '';
  const n = u.map(num);
  if (n.some(isNaN)) return u.join(' · ');
  const lo = Math.min(...n), hi = Math.max(...n), f = (v: number) => v.toLocaleString('en-IN');
  return lo === hi ? `${f(lo)} sq.ft` : `${f(lo)} – ${f(hi)} sq.ft`;
}
function money(vals: unknown[]) {
  const u = uniq(vals);
  if (u.length < 2) return u[0] || '';
  const val = (v: string) => { const n = num(v); return /cr/i.test(v) ? n * 1e7 : /l(akh|ac)?/i.test(v) ? n * 1e5 : n; };
  const s = u.slice().sort((a, b) => val(a) - val(b));
  return `${s[0]} – ${s[s.length - 1]}`;
}

/**
 * Configurations a project has real per-configuration data for (≥1 floor plan or
 * unit-table row). `det` is the project's GHR_DETAILS entry (may be {}).
 */
export function projectConfigs(p: Row, det: Row): ConfigData[] {
  const plans: Row[] = p.floor_plans || [];
  const head: string[] = det.unitHead || [];
  const rows: string[][] = det.unitRows || [];
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const iSize = col(/saleable|built|size/i), iCarpet = col(/carpet/i), iTower = col(/tower/i), iFacing = col(/facing/i),
    iPrice = col(/price|base|cost|amount|₹/i);
  const keys = sortKeys([...plans.map((f) => bhkKey(f.bhk || f.description)), ...rows.map((r) => bhkKey(r[0]))].filter(Boolean));
  return keys.map((key) => {
    const kp = plans.filter((f) => bhkKey(f.bhk || f.description) === key);
    const kr = rows.filter((r) => bhkKey(r[0]) === key);
    return {
      key, slug: configSlug(key), plans: kp, head, rows: kr,
      facts: {
        sizes: area([...kp.map((f) => f.size), ...(iSize >= 0 ? kr.map((r) => r[iSize]) : [])]),
        carpet: area([...kp.map((f) => f.carpet), ...(iCarpet >= 0 ? kr.map((r) => r[iCarpet]) : [])]),
        towers: uniq([...kp.map((f) => f.tower), ...(iTower >= 0 ? kr.map((r) => r[iTower]) : [])]).join(' · '),
        facing: uniq([...kp.map((f) => f.facing), ...(iFacing >= 0 ? kr.map((r) => r[iFacing]) : [])]).join(' · '),
        price: iPrice >= 0 ? money(kr.map((r) => r[iPrice])) : '',
      },
    };
  });
}

/** Every configuration a project offers: detailed ones plus those only named in its configuration text. */
export function offeredKeys(p: Row, det: Row): string[] {
  return sortKeys([...projectConfigs(p, det).map((c) => c.key), ...keysFromText(p.bedrooms)]);
}
