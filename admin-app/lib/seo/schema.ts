// schema.org JSON-LD built only from real database values. No ratings or reviews
// are ever emitted (we don't publish aggregate review data), and optional
// properties are omitted rather than filled with placeholders.
import type { SeoContext } from './head';

type Obj = Record<string, any>;
/** Drop empty values so the markup never carries blanks. */
export function compact<T extends Obj>(o: T): T {
  const out: Obj = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  return out as T;
}

const id = (ctx: SeoContext, frag: string) => `${ctx.base}/#${frag}`;

export function organization(ctx: SeoContext) {
  const s = ctx.settings, c = ctx.contact, so = ctx.social;
  const phones = [c.india_phone, c.canada_phone].filter(Boolean);
  return compact({
    '@context': 'https://schema.org', '@type': 'Organization', '@id': id(ctx, 'organization'),
    name: s.site_name || 'Get Home Realty', url: `${ctx.base}/`,
    // Google prefers a square logo (≥112px) for the organisation
    logo: ctx.abs('/assets/img/ghr-icon-512.png'),
    email: c.email || undefined,
    sameAs: [so.facebook, so.instagram, so.youtube, so.linkedin, so.x].filter(Boolean),
    contactPoint: phones.map((telephone: string) => ({ '@type': 'ContactPoint', telephone, contactType: 'sales', email: c.email || undefined })),
  });
}

export function brokerage(ctx: SeoContext, areas: string[]) {
  const s = ctx.settings, c = ctx.contact;
  const office = (c.offices || [])[0];
  return compact({
    '@context': 'https://schema.org', '@type': 'RealEstateAgent', '@id': id(ctx, 'brokerage'),
    name: s.site_name || 'Get Home Realty', url: `${ctx.base}/`,
    image: ctx.abs('/assets/img/ghr-icon-512.png'),
    telephone: c.india_phone || c.canada_phone || undefined,
    email: c.email || undefined,
    address: office?.address ? { '@type': 'PostalAddress', streetAddress: office.address } : undefined,
    areaServed: areas.map((name) => ({ '@type': 'City', name })),
    parentOrganization: { '@id': id(ctx, 'organization') },
  });
}

export function website(ctx: SeoContext) {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite', '@id': id(ctx, 'website'),
    url: `${ctx.base}/`, name: ctx.settings.site_name || 'Get Home Realty', publisher: { '@id': id(ctx, 'organization') },
  };
}

export function webPage(ctx: SeoContext, p: { url: string; name: string; description: string; image?: string; type?: string; breadcrumb?: boolean }) {
  return compact({
    '@context': 'https://schema.org', '@type': p.type || 'WebPage', '@id': `${p.url}#webpage`,
    url: p.url, name: p.name, description: p.description,
    isPartOf: { '@id': id(ctx, 'website') },
    primaryImageOfPage: p.image ? { '@type': 'ImageObject', url: ctx.abs(p.image) } : undefined,
    breadcrumb: p.breadcrumb === false ? undefined : { '@id': `${p.url}#breadcrumb` },
  });
}

export function breadcrumbs(pageUrl: string, items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

export function faqPage(pageUrl: string, faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org', '@type': 'FAQPage', '@id': `${pageUrl}#faq`,
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

/** "4:13" / "1:02:03" → ISO 8601 "PT4M13S". Returns undefined if unparseable. */
export function isoDuration(d: string | null | undefined) {
  const m = String(d || '').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (!m) return /^PT[\dHMS]+$/.test(String(d || '')) ? String(d) : undefined;
  const [h, mi, s] = [Number(m[1] || 0), Number(m[2]), Number(m[3])];
  return `PT${h ? `${h}H` : ''}${mi ? `${mi}M` : ''}${s || (!h && !mi) ? `${s}S` : ''}`;
}

export function videoObject(ctx: SeoContext, v: Obj, pageUrl: string, thumb: string) {
  const yt = String(v.youtube_url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return compact({
    '@context': 'https://schema.org', '@type': 'VideoObject', '@id': `${pageUrl}#video`,
    name: v.seo_title || v.title, description: v.meta_description || v.description || v.title,
    thumbnailUrl: thumb ? [ctx.abs(thumb)] : undefined,
    uploadDate: v.publish_date || undefined,
    duration: isoDuration(v.duration),
    contentUrl: v.youtube_url || v.instagram_url || undefined,
    embedUrl: yt ? `https://www.youtube.com/embed/${yt[1]}` : undefined,
    transcript: v.transcript || undefined,
    publisher: { '@id': id(ctx, 'organization') },
  });
}

export function agentPerson(ctx: SeoContext, a: Obj, pageUrl: string) {
  return compact({
    '@context': 'https://schema.org', '@type': 'Person', '@id': `${pageUrl}#person`,
    name: a.name, jobTitle: a.designation || 'Real Estate Agent', url: pageUrl,
    image: a.photo ? ctx.abs(a.photo) : undefined, telephone: a.phone || undefined, email: a.email || undefined,
    knowsLanguage: a.languages || [], areaServed: (a.service_areas || []).map((name: string) => ({ '@type': 'Place', name })),
    sameAs: [a.instagram, a.facebook, a.linkedin, a.youtube].filter(Boolean),
    worksFor: { '@id': id(ctx, 'brokerage') },
  });
}

/** Listing markup; an Offer is added only when a public price exists. */
export function propertyListing(ctx: SeoContext, p: Obj, pageUrl: string, images: string[]) {
  return compact({
    '@context': 'https://schema.org', '@type': 'RealEstateListing', '@id': `${pageUrl}#listing`,
    name: p.title, url: pageUrl, description: p.description || undefined,
    image: images.map((u) => ctx.abs(u)),
    datePosted: p.created_at ? String(p.created_at).slice(0, 10) : undefined,
    offers: p.price && !['sold', 'leased'].includes(p.status) ? {
      '@type': 'Offer', price: Number(p.price), priceCurrency: p.currency || 'INR',
      availability: 'https://schema.org/InStock', businessFunction: p.status === 'for_rent' ? 'http://purl.org/goodrelations/v1#LeaseOut' : 'http://purl.org/goodrelations/v1#Sell',
    } : undefined,
    contentLocation: compact({
      '@type': 'Place', name: [p.address, p.city].filter(Boolean).join(', ') || undefined,
      address: compact({ '@type': 'PostalAddress', streetAddress: p.address || undefined, addressLocality: p.city || undefined, addressRegion: p.province || undefined, postalCode: p.postal_code || undefined, addressCountry: p.country || undefined }),
      geo: p.lat != null && p.lng != null ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } : undefined,
    }),
  });
}

export function projectPlace(ctx: SeoContext, p: Obj, pageUrl: string, images: string[]) {
  return compact({
    '@context': 'https://schema.org', '@type': /apartment/i.test(p.property_type || '') ? 'ApartmentComplex' : 'Residence', '@id': `${pageUrl}#place`,
    name: p.name, url: pageUrl, description: p.description || undefined,
    image: images.map((u) => ctx.abs(u)),
    address: compact({ '@type': 'PostalAddress', addressLocality: [p.location, p.city].filter(Boolean).join(', ') || undefined }),
    geo: p.lat != null && p.lng != null ? { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng } : undefined,
    amenityFeature: (p.amenities || []).slice(0, 40).map((name: string) => ({ '@type': 'LocationFeatureSpecification', name, value: true })),
  });
}
