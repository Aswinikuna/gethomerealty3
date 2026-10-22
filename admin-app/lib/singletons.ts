// Homepage sections, contact details, social links and site settings — the
// "one of each" content, as opposed to the list-type resources in resources.ts.
import { z } from 'zod';
import { q, tx } from './db';
import { deleteUploads } from './storage';
import { url } from './validate';

const text = (max: number) => z.string().trim().max(max).default('');
const optEmail = z.union([z.literal(''), z.email('Enter a valid email.').max(200)]).default('');
const tel = z.string().trim().max(30).refine((v) => !v || /^[+\d][\d\s\-().]{5,}$/.test(v), 'Enter a valid phone number.').default('');
const link = (allowContact = false) => url(allowContact).transform((v) => v ?? '').default('');

export const HomepageSchema = z.object({
  hero: z.object({
    location_text: text(120),
    heading: text(120),
    description: text(600),
    button_text: text(40),
    button_url: link(true),
    image: link(),
  }),
  topbar: z.object({
    phone: tel,
    whatsapp: tel,
    email: optEmail,
    location_text: text(120),
  }),
  navigation: z.object({
    items: z.array(z.object({
      label: z.string().trim().min(1, 'Label is required.').max(40),
      href: url(true).refine((v) => !!v, 'Link is required.'),
    })).max(12),
  }),
  about: z.object({
    heading: text(160),
    short_description: text(1500),
    company_description: text(5000),
    image: link(),
  }),
  stats: z.object({
    items: z.array(z.object({ value: z.string().trim().min(1).max(20), label: z.string().trim().min(1).max(60) })).max(6),
  }),
  seo: z.object({
    seo_title: text(120),
    meta_description: text(320),
    focus_keyword: text(80),
    secondary_keywords: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    canonical_url: link(),
    og_title: text(120),
    og_description: text(300),
    og_image: link(),
    image_alt_text: text(160),
    is_indexed: z.boolean().default(true),
    is_followed: z.boolean().default(true),
  }),
});
export type Homepage = z.infer<typeof HomepageSchema>;
export const HOMEPAGE_SECTIONS = Object.keys(HomepageSchema.shape) as (keyof Homepage)[];

export const ContactSchema = z.object({
  canada_phone: tel,
  india_phone: tel,
  whatsapp: tel,
  email: optEmail,
  offices: z.array(z.object({ label: z.string().trim().max(60), address: z.string().trim().min(1, 'Address is required.').max(300) })).max(6),
  business_hours: text(200),
});

export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'youtube', 'linkedin', 'whatsapp', 'x'] as const;
export const SocialSchema = z.object(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, link()])) as Record<(typeof SOCIAL_PLATFORMS)[number], ReturnType<typeof link>>);

export const ROBOTS_OPTIONS = ['index,follow', 'index,nofollow', 'noindex,follow', 'noindex,nofollow'] as const;

export const SettingsSchema = z.object({
  site_name: text(80),
  logo: link(),
  favicon: link(),
  seo_title: text(120),            // Default SEO title
  seo_description: text(320),      // Default meta description
  default_og_title: text(120),
  default_og_description: text(300),
  default_og_image: link(),
  default_twitter_image: link(),
  canonical_base_url: z.string().trim().max(200)
    .refine((v) => !v || /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(v.replace(/\/+$/, '')), 'Use the site address, e.g. https://www.gethomerealty.ca')
    .transform((v) => v.replace(/\/+$/, '')).default(''),
  default_robots: z.enum(ROBOTS_OPTIONS).catch('index,follow').default('index,follow'),
  google_site_verification: z.string().trim().max(120).refine((v) => !v || /^[\w-]+$/.test(v), 'Paste only the content="…" code.').default(''),
  bing_site_verification: z.string().trim().max(120).refine((v) => !v || /^[\w-]+$/.test(v), 'Paste only the content="…" code.').default(''),
  google_analytics_id: z.string().trim().max(30).refine((v) => !v || /^(G|GT|AW)-[A-Z0-9]{4,}$/.test(v), 'Looks like G-XXXXXXX.').default(''),
  facebook_pixel_id: z.string().trim().max(20).refine((v) => !v || /^\d{6,20}$/.test(v), 'Digits only.').default(''),
  default_contact_email: optEmail,
});

export const SINGLETONS = {
  homepage: HomepageSchema,
  contact: ContactSchema,
  social: SocialSchema,
  settings: SettingsSchema,
} as const;
export type SingletonName = keyof typeof SINGLETONS;

/** Read with defaults filled in, so the forms and the public site always get a complete shape. */
export async function readSingleton(name: SingletonName): Promise<any> {
  if (name === 'homepage') {
    const rows = await q('select section, content from homepage_content');
    const raw: Record<string, unknown> = { navigation: { items: [] }, stats: { items: [] } };
    for (const r of rows) raw[r.section] = r.content;
    for (const s of HOMEPAGE_SECTIONS) raw[s] ??= {};
    return HomepageSchema.parse(raw);
  }
  if (name === 'contact') {
    const row = (await q('select canada_phone, india_phone, whatsapp, email, offices, business_hours from contact_details where id = 1'))[0] || { offices: [] };
    const clean = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? (k === 'offices' ? [] : '')]));
    return ContactSchema.parse(clean);
  }
  if (name === 'social') {
    const rows = await q('select platform, url from social_links');
    return SocialSchema.parse(Object.fromEntries(rows.map((r) => [r.platform, r.url])));
  }
  const rows = await q('select key, value from settings');
  return SettingsSchema.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function writeSingleton(name: SingletonName, input: unknown, adminId: number) {
  const data: any = SINGLETONS[name].parse(input);
  const before = await readSingleton(name);
  await tx(async (t) => {
    if (name === 'homepage') {
      for (const s of HOMEPAGE_SECTIONS) {
        await t.query(
          `insert into homepage_content (section, content, updated_at, updated_by) values ($1, $2::jsonb, now(), $3)
           on conflict (section) do update set content = excluded.content, updated_at = now(), updated_by = excluded.updated_by`,
          [s, JSON.stringify(data[s]), adminId]);
      }
    } else if (name === 'contact') {
      await t.query(
        `insert into contact_details (id, canada_phone, india_phone, whatsapp, email, offices, business_hours, updated_at)
         values (1, $1, $2, $3, $4, $5::jsonb, $6, now())
         on conflict (id) do update set canada_phone = excluded.canada_phone, india_phone = excluded.india_phone,
           whatsapp = excluded.whatsapp, email = excluded.email, offices = excluded.offices,
           business_hours = excluded.business_hours, updated_at = now()`,
        [data.canada_phone, data.india_phone, data.whatsapp, data.email, JSON.stringify(data.offices), data.business_hours]);
    } else {
      const table = name === 'social' ? 'social_links' : 'settings';
      const [k, v] = name === 'social' ? ['platform', 'url'] : ['key', 'value'];
      for (const [key, value] of Object.entries(data)) {
        await t.query(
          `insert into ${table} (${k}, ${v}, updated_at) values ($1, $2, now())
           on conflict (${k}) do update set ${v} = excluded.${v}, updated_at = now()`, [key, value]);
      }
    }
  });
  const after = await readSingleton(name);
  // Images replaced or removed here (hero, about, logo, favicon) are deleted unless still used elsewhere.
  const urlsIn = (o: unknown): string[] => (typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(urlsIn) : []);
  const kept = new Set(urlsIn(after));
  await deleteUploads(urlsIn(before).filter((u) => !kept.has(u)));
  return after;
}
