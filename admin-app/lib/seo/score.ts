// A plain, explainable SEO checklist. Every check is something we can actually
// verify from the record — no invented metrics. Score = share of checks passed.
import { LIMITS } from './suggest';

export interface Check { label: string; ok: boolean; hint?: string }
export interface ScoreResult { checks: Check[]; passed: number; total: number; grade: 'Poor' | 'Needs improvement' | 'Good' }

const words = (s: unknown) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;
const has = (s: unknown) => String(s ?? '').trim().length > 0;
const contains = (hay: unknown, needle: string) => !!needle && String(hay ?? '').toLowerCase().includes(needle.toLowerCase());

export function scoreSeo(opts: {
  rec: Record<string, any>;
  h1: string;
  body: string;                 // main page text (description, bio, market content…)
  mainImage?: string | null;
  galleryAlts?: (string | null | undefined)[];
  slug?: string;
  duplicates: number;
  internalLinks: boolean;      // the page template adds related links for this kind
  minWords: number;
}): ScoreResult {
  const { rec } = opts;
  const t = String(rec.seo_title ?? '').trim(), d = String(rec.meta_description ?? '').trim();
  const kw = String(rec.focus_keyword ?? '').trim();
  const checks: Check[] = [
    { label: 'SEO title set', ok: has(t), hint: 'Add an SEO title (or apply the suggestion).' },
    { label: `SEO title ${LIMITS.title.min}–${LIMITS.title.max} characters`, ok: t.length >= LIMITS.title.min && t.length <= LIMITS.title.max, hint: `Currently ${t.length}.` },
    { label: 'Meta description set', ok: has(d) },
    { label: `Meta description ${LIMITS.description.min}–${LIMITS.description.max} characters`, ok: d.length >= LIMITS.description.min && d.length <= LIMITS.description.max, hint: `Currently ${d.length}.` },
    { label: 'Focus keyword set', ok: has(kw) },
    { label: 'Focus keyword in title and description', ok: has(kw) && contains(t, kw) && contains(d, kw), hint: 'Use the exact phrase naturally in both.' },
    { label: 'Page has an H1 heading', ok: has(opts.h1) },
    { label: 'Clean URL slug', ok: opts.slug === undefined || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(opts.slug || ''), hint: 'Lowercase words separated by dashes.' },
  ];
  if (opts.mainImage !== undefined) {
    checks.push({ label: 'Main image has alt text', ok: !opts.mainImage || has(rec.image_alt_text), hint: 'Fill “Main image alt text”.' });
    checks.push({ label: 'Social share (OG) image available', ok: has(rec.og_image) || has(opts.mainImage) });
  }
  if (opts.galleryAlts && opts.galleryAlts.length) {
    const missing = opts.galleryAlts.filter((a) => !has(a)).length;
    checks.push({ label: 'Gallery images have alt text', ok: missing === 0, hint: `${missing} image(s) without a caption / alt text.` });
  }
  checks.push({ label: `Content length (${opts.minWords}+ words)`, ok: words(opts.body) >= opts.minWords, hint: `Currently ${words(opts.body)} words.` });
  checks.push({ label: 'Related internal links on the page', ok: opts.internalLinks });
  checks.push({ label: 'No duplicate title, description or slug', ok: opts.duplicates === 0 });
  const passed = checks.filter((c) => c.ok).length;
  const ratio = passed / checks.length;
  return { checks, passed, total: checks.length, grade: ratio >= 0.8 ? 'Good' : ratio >= 0.5 ? 'Needs improvement' : 'Poor' };
}
