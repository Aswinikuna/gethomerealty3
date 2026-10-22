import { z } from 'zod';
import { AMENITY_ICONS, type Field, type Resource } from './resources';

/** http(s) URLs, or site-relative paths like "/uploads/x.webp", "assets/img/x.png", "contact.html#form". */
export function isSafeUrl(v: string, allowContact = false) {
  if (!v) return true;
  if (/[\s<>"'`\\]/.test(v)) return false;
  if (/^https?:\/\/[^/]+/i.test(v)) return true;
  if (allowContact && /^(mailto:|tel:)/i.test(v)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//')) return false; // javascript:, data:, protocol-relative…
  return /^[\w\-./#?=&%~+]+$/.test(v);
}

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
/** Optional short text inside a structured list item ('' when empty). */
const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || '');
/** A JSON list column: missing → []. */
const list = (item: z.ZodTypeAny, max: number) => z.preprocess((v) => (v == null ? [] : v), z.array(item).max(max));

export const url = (allowContact = false) =>
  z.preprocess(emptyToNull, z.string().trim().max(2000)
    .refine((v) => isSafeUrl(v, allowContact), 'Enter a full https:// link or a site path.').nullable());

function fieldSchema(f: Field): z.ZodTypeAny {
  let s: z.ZodTypeAny;
  switch (f.type) {
    case 'text':
    case 'slug':
      s = z.preprocess(emptyToNull, z.string().trim().max(f.maxLength ?? 300).nullable());
      if (f.type === 'slug') {
        s = z.preprocess(emptyToNull, z.string().trim().toLowerCase().max(80)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only.').nullable());
      }
      break;
    case 'textarea':
      s = z.preprocess(emptyToNull, z.string().max(f.maxLength ?? 10000).nullable());
      break;
    case 'number': {
      let n = z.number({ error: 'Enter a number.' });
      if (f.integer) n = n.int('Whole numbers only.');
      if (f.min != null) n = n.min(f.min);
      if (f.max != null) n = n.max(f.max);
      s = z.preprocess((v) => (v === '' || v == null ? null : typeof v === 'string' ? Number(v) : v), n.nullable());
      break;
    }
    case 'rating':
      s = z.preprocess((v) => (typeof v === 'string' ? Number(v) : v), z.number().int().min(1).max(5));
      break;
    case 'select': {
      const values = (f.options || []).map((o) => o.value) as [string, ...string[]];
      s = z.preprocess((v) => (f.default !== undefined && (v === undefined || v === null || v === '') ? f.default : emptyToNull(v)),
        z.enum(values, { error: 'Choose an option.' }).nullable());
      break;
    }
    case 'bool':
      s = z.boolean().optional(); // omitted → column default
      break;
    case 'image':
    case 'file':
    case 'url':
      s = url();
      break;
    case 'email':
      s = z.preprocess(emptyToNull, z.email('Enter a valid email.').max(200).nullable());
      break;
    case 'tel':
      s = z.preprocess(emptyToNull, z.string().trim().max(30).regex(/^[+\d][\d\s\-().]{5,}$/, 'Enter a valid phone number.').nullable());
      break;
    case 'date':
      s = z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').nullable());
      break;
    case 'pairs':
      s = list(z.object({
        label: z.string().trim().min(1, 'Label is required.').max(80),
        value: z.string().trim().min(1, 'Value is required.').max(600),
      }), 80);
      break;
    case 'floorplans':
      s = list(z.object({
        image: url(),
        bhk: opt(60), size: opt(60), carpet: opt(60), tower: opt(80), facing: opt(40), description: opt(500),
      }).refine((f) => f.image || f.bhk || f.size, 'Add an image, BHK or size.'), 60);
      break;
    case 'amenityItems':
      s = list(z.object({
        title: z.string().trim().min(1, 'Title is required.').max(100),
        icon: z.enum(['', ...AMENITY_ICONS] as [string, ...string[]]).catch('').default(''),
        image: url(), description: opt(400),
        configs: opt(80),   // "3 BHK, 4 BHK" — empty = every home
      }), 150);
      break;
    case 'connectivity':
      s = list(z.object({
        place: z.string().trim().min(1, 'Place is required.').max(120),
        time: opt(40),
        category: z.string().trim().max(60).optional().transform((v) => v || ''),
      }), 60);
      break;
    case 'faqs':
      s = z.preprocess((v) => (v == null ? [] : v), z.array(z.object({
        q: z.string().trim().min(1, 'Question is required.').max(300),
        a: z.string().trim().min(1, 'Answer is required.').max(3000),
      })).max(30));
      break;
    case 'tags':
      s = z.preprocess((v) => (v == null ? [] : v), z.array(z.string().trim().min(1).max(120)).max(60));
      break;
  }
  if (f.required) {
    s = s.refine((v: unknown) => v !== null && v !== undefined && v !== '', `${f.label} is required.`);
  }
  return s;
}

const imageItem = z.object({ url: url().refine((v) => !!v, 'Missing image URL.'), alt: z.string().trim().max(200).nullish() });

export function resourceSchema(r: Resource, partial: boolean) {
  const shape: Record<string, z.ZodTypeAny> = {};
  // Omitted = not provided (column default / unchanged). Required fields must be present on create.
  // A field with a default can be omitted on create (the default is applied).
  for (const f of r.fields) shape[f.name] = partial || !f.required ? fieldSchema(f).optional() : f.default !== undefined ? fieldSchema(f).optional().transform((v) => v ?? f.default) : fieldSchema(f);
  if (r.galleries?.length) {
    const g: Record<string, z.ZodTypeAny> = {};
    for (const gal of r.galleries) g[gal.name] = z.array(imageItem).max(gal.max).optional();
    shape.galleries = z.object(g).optional();
  }
  return z.object(shape).strip();
}

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item';
}
