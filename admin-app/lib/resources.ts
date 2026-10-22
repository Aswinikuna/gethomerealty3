// Field definitions for every CRUD section of the admin. Shared by the API
// (validation + SQL column whitelist) and the UI (forms, tables, filters).
// Adding a field here = add the column in db/schema.sql + one entry below.

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'select' | 'bool' | 'image' | 'file'
  | 'url' | 'email' | 'tel' | 'date' | 'tags' | 'rating' | 'slug' | 'faqs'
  | 'pairs' | 'floorplans' | 'amenityItems' | 'connectivity';

export interface Option { value: string; label: string }

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  section: string;
  required?: boolean;
  options?: Option[];
  help?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  maxLength?: number;
  /** Internal-only: returned by admin endpoints to role "admin" only, never published. */
  confidential?: boolean;
  /** Value used when the field is omitted or empty (select fields). */
  default?: string;
  /** Grid width in the form (of 6 columns). */
  span?: 2 | 3 | 4 | 6;
}

export interface Gallery {
  name: string;
  label: string;
  table: string;
  fk: string;
  /** project_images.kind value, when one table holds several galleries. */
  kind?: string;
  section: string;
  help?: string;
  max: number;
}

export interface Column {
  field: string;
  label: string;
  kind?: 'image' | 'title' | 'money' | 'badge' | 'date' | 'rating' | 'text' | 'pricing';
  /** Column shows internal pricing — hidden from non-admin roles. */
  confidential?: boolean;
}

export interface Resource {
  key: string;
  table: string;
  label: string;
  singular: string;
  description: string;
  titleField: string;
  slugFrom?: string;
  fields: Field[];
  galleries?: Gallery[];
  toggles: { field: string; label: string; on: string; off: string }[];
  search: string[];
  filters: { name: string; label: string; options: Option[] }[];
  columns: Column[];
  order: string;
  sections: string[];
  /** Show sections as tabs instead of one long page. */
  tabs?: boolean;
  /** Public SEO page for this resource (clean URL + SEO panel in the editor). */
  seo?: { kind: SeoKind; path: string; publishedField: string };
}

export type SeoKind = 'property' | 'project' | 'agent' | 'video' | 'location';

/**
 * The reusable SEO field set (same columns on every page-bearing table).
 * `only` limits it for resources that need a subset (videos).
 */
export function seoFields(only?: string[]): Field[] {
  const all: Field[] = [
    { name: 'seo_title', label: 'SEO title', type: 'text', section: 'SEO', maxLength: 120, span: 6 },
    { name: 'meta_description', label: 'Meta description', type: 'textarea', section: 'SEO', maxLength: 320, span: 6 },
    { name: 'focus_keyword', label: 'Focus keyword', type: 'text', section: 'SEO', maxLength: 80, span: 3, placeholder: '3 bhk apartment kokapet' },
    { name: 'secondary_keywords', label: 'Secondary keywords', type: 'tags', section: 'SEO', span: 3 },
    { name: 'canonical_url', label: 'Canonical URL', type: 'url', section: 'SEO', span: 6, help: 'Leave empty to use this page’s own clean URL (recommended).' },
    { name: 'og_title', label: 'Social share title (OG)', type: 'text', section: 'SEO', maxLength: 120, span: 3, help: 'Up to ~60 characters. Defaults to the SEO title.' },
    { name: 'og_image', label: 'Social share image (OG)', type: 'image', section: 'SEO', span: 3, help: 'Defaults to the main image.' },
    { name: 'og_description', label: 'Social share description (OG)', type: 'textarea', section: 'SEO', maxLength: 300, span: 6, help: 'Up to ~200 characters. Defaults to the meta description.' },
    { name: 'image_alt_text', label: 'Main image alt text', type: 'text', section: 'SEO', maxLength: 160, span: 6, help: 'Describe the image for search engines and screen readers.' },
    { name: 'is_indexed', label: 'Index (show in search results)', type: 'bool', section: 'SEO', span: 3 },
    { name: 'is_followed', label: 'Follow links', type: 'bool', section: 'SEO', span: 3 },
  ];
  return only ? all.filter((f) => only.includes(f.name)) : all;
}

/** Names of the fields that live in the SEO panel's own inputs (title/description with counters). */
export const SEO_PANEL_FIELDS = ['seo_title', 'meta_description'];

const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export const PROPERTY_STATUS = opts(['for_sale', 'For Sale'], ['for_rent', 'For Rent'], ['sold', 'Sold'], ['leased', 'Leased']);
export const AVAILABILITY = opts(['on_request', 'On request'], ['available', 'Available'], ['limited', 'Limited availability'], ['sold_out', 'Sold out']);
export const CONNECTIVITY_CATEGORIES = ['Offices & IT hubs', 'Schools', 'Hospitals', 'Shopping', 'Metro / ORR / highways', 'Airport', 'Landmarks'];
/** Icon keys offered for amenities (rendered on the public site by maps.js). Empty = picked from the title. */
export const AMENITY_ICONS = ['pool', 'gym', 'clubhouse', 'games', 'sports', 'kids', 'garden', 'track', 'hall', 'yoga', 'spa', 'security', 'parking', 'power', 'shop', 'water'];
export const PROJECT_STATUS = opts(['upcoming', 'Upcoming'], ['selling', 'Selling'], ['sold_out', 'Sold Out']);
export const PROPERTY_TYPES = opts(
  ['Apartment', 'Apartment'], ['Condo', 'Condo'], ['Detached House', 'Detached House'], ['Semi-Detached', 'Semi-Detached'],
  ['Townhouse', 'Townhouse'], ['Villa', 'Villa'], ['Plot', 'Plot'], ['Commercial', 'Commercial'], ['Other', 'Other']);
const CURRENCIES = opts(['INR', 'INR ₹'], ['CAD', 'CAD $'], ['USD', 'USD $']);
const CITIES_HINT = 'e.g. Hyderabad, Visakhapatnam, Mississauga';

export const RESOURCES: Record<string, Resource> = {
  properties: {
    key: 'properties', table: 'properties', label: 'Properties', singular: 'Property',
    description: 'Listings shown on the website. Only active listings are public.',
    titleField: 'title', slugFrom: 'title',
    sections: ['Basics', 'Pricing', 'Location', 'Details', 'Media', 'Visibility', 'SEO'],
    seo: { kind: 'property', path: '/properties/', publishedField: 'is_active' },
    fields: [
      { name: 'title', label: 'Property title', type: 'text', section: 'Basics', required: true, maxLength: 160, span: 6 },
      { name: 'slug', label: 'URL slug', type: 'slug', section: 'Basics', help: 'Page address: /properties/<slug>. Generated from the title when left blank; your edits are kept.', span: 3 },
      { name: 'status', label: 'Status', type: 'select', section: 'Basics', required: true, options: PROPERTY_STATUS, span: 3 },
      { name: 'property_type', label: 'Property type', type: 'select', section: 'Basics', options: PROPERTY_TYPES, span: 3 },
      { name: 'mls_number', label: 'MLS® number', type: 'text', section: 'Basics', maxLength: 40, span: 3 },
      { name: 'currency', label: 'Currency', type: 'select', section: 'Pricing', options: CURRENCIES, span: 2 },
      { name: 'builder_price', label: 'Builder price', type: 'number', section: 'Pricing', min: 0, max: 1e12, confidential: true, help: 'Internal — never shown on the website.', span: 2 },
      { name: 'brokerage_price', label: 'Brokerage price', type: 'number', section: 'Pricing', min: 0, max: 1e12, confidential: true, help: 'Internal — never shown on the website.', span: 2 },
      { name: 'price', label: 'Public display price', type: 'number', section: 'Pricing', min: 0, max: 1e12, help: 'The only price visitors see.', span: 3 },
      { name: 'price_label', label: 'Public price text (optional)', type: 'text', section: 'Pricing', maxLength: 60, placeholder: 'Starting from ₹1.75 Cr', help: 'Shown instead of the number when set.', span: 3 },
      { name: 'address', label: 'Property address', type: 'text', section: 'Location', maxLength: 200, span: 6 },
      { name: 'city', label: 'City', type: 'text', section: 'Location', maxLength: 80, placeholder: CITIES_HINT, span: 2 },
      { name: 'province', label: 'Province / State', type: 'text', section: 'Location', maxLength: 80, span: 2 },
      { name: 'postal_code', label: 'Postal code', type: 'text', section: 'Location', maxLength: 20, span: 2 },
      { name: 'country', label: 'Country', type: 'text', section: 'Location', maxLength: 60, span: 2 },
      { name: 'lat', label: 'Latitude', type: 'number', section: 'Location', min: -90, max: 90, span: 2 },
      { name: 'lng', label: 'Longitude', type: 'number', section: 'Location', min: -180, max: 180, span: 2 },
      { name: 'map_url', label: 'Google Maps link', type: 'url', section: 'Location', placeholder: 'https://maps.google.com/…', span: 6 },
      { name: 'bedrooms', label: 'Bedrooms', type: 'number', section: 'Details', min: 0, max: 50, integer: true, span: 2 },
      { name: 'bathrooms', label: 'Bathrooms', type: 'number', section: 'Details', min: 0, max: 50, span: 2 },
      { name: 'parking', label: 'Parking', type: 'number', section: 'Details', min: 0, max: 100, integer: true, span: 2 },
      { name: 'sqft', label: 'Square footage', type: 'number', section: 'Details', min: 0, max: 10_000_000, integer: true, span: 2 },
      { name: 'description', label: 'Description', type: 'textarea', section: 'Details', maxLength: 10000, span: 6 },
      { name: 'features', label: 'Features', type: 'tags', section: 'Details', help: 'Press Enter after each feature.', span: 6 },
      { name: 'main_image', label: 'Main image', type: 'image', section: 'Media', span: 6 },
      { name: 'video_url', label: 'Property video URL', type: 'url', section: 'Media', placeholder: 'https://youtube.com/…', span: 6 },
      { name: 'is_active', label: 'Active (visible on website)', type: 'bool', section: 'Visibility', span: 2 },
      { name: 'is_featured', label: 'Featured', type: 'bool', section: 'Visibility', span: 2 },
      { name: 'display_order', label: 'Display order', type: 'number', section: 'Visibility', integer: true, min: -100000, max: 100000, help: 'Lower numbers show first.', span: 2 },
      ...seoFields(),
    ],
    galleries: [{ name: 'gallery', label: 'Gallery images', table: 'property_images', fk: 'property_id', section: 'Media', max: 40 }],
    toggles: [
      { field: 'is_active', label: 'Active', on: 'Active', off: 'Inactive' },
      { field: 'is_featured', label: 'Featured', on: 'Featured', off: '—' },
    ],
    search: ['title', 'address', 'city', 'mls_number'],
    filters: [
      { name: 'status', label: 'Status', options: PROPERTY_STATUS },
      { name: 'is_active', label: 'Visibility', options: opts(['true', 'Active'], ['false', 'Inactive']) },
    ],
    columns: [
      { field: 'main_image', label: '', kind: 'image' },
      { field: 'title', label: 'Property', kind: 'title' },
      { field: 'city', label: 'City' },
      { field: 'price', label: 'Public price', kind: 'money' },
      { field: 'brokerage_price', label: 'Builder / Brokerage', kind: 'pricing', confidential: true },
      { field: 'status', label: 'Status', kind: 'badge' },
    ],
    order: 'display_order asc, id desc',
  },

  projects: {
    key: 'projects', table: 'projects', label: 'Projects', singular: 'Project',
    description: 'Pre-construction / developer projects plotted on the Hyderabad and Visakhapatnam maps.',
    titleField: 'name', slugFrom: 'name',
    // One tab per slide of the public project popup, then media / visibility / SEO.
    sections: ['Overview', 'Project Features', 'Project Details', 'Floor Plans', 'Amenities', 'Master Plan',
      'Location & Connectivity', 'Availability / WhatsApp', 'Gallery & Media', 'Visibility', 'SEO'],
    tabs: true,
    seo: { kind: 'project', path: '/projects/', publishedField: 'is_published' },
    fields: [
      // 1 — Overview
      { name: 'name', label: 'Project name', type: 'text', section: 'Overview', required: true, maxLength: 160, span: 3 },
      { name: 'developer', label: 'Developer', type: 'text', section: 'Overview', maxLength: 160, span: 3 },
      { name: 'slug', label: 'URL slug', type: 'slug', section: 'Overview', help: 'Page address: /projects/<slug> (also the map’s ?project= link). Your edits are kept.', span: 2 },
      { name: 'status', label: 'Sales status', type: 'select', section: 'Overview', required: true, options: PROJECT_STATUS, span: 2 },
      { name: 'possession', label: 'Construction status / possession', type: 'text', section: 'Overview', maxLength: 80, placeholder: 'Under construction · Possession Feb 2028', help: 'Shown as the status and possession tags.', span: 2 },
      { name: 'description', label: 'Short project description', type: 'textarea', section: 'Overview', maxLength: 10000, span: 6, help: 'The first paragraph visitors read on the Overview slide.' },
      { name: 'main_image', label: 'Main project image', type: 'image', section: 'Overview', span: 6 },
      // 2 — Features
      { name: 'property_type', label: 'Property type', type: 'select', section: 'Project Features', options: PROPERTY_TYPES, span: 2 },
      { name: 'bedrooms', label: 'Configuration', type: 'text', section: 'Project Features', maxLength: 80, placeholder: '2, 3 & 4 BHK', span: 2 },
      { name: 'unit_sizes', label: 'Built-up area', type: 'text', section: 'Project Features', maxLength: 120, placeholder: '1,380–4,595 sq.ft', span: 2 },
      { name: 'project_scale', label: 'Project scale', type: 'text', section: 'Project Features', maxLength: 160, placeholder: '6 towers · 38 & 42 floors · 1,782 homes · 12.1 acres', span: 6 },
      { name: 'currency', label: 'Currency', type: 'select', section: 'Project Features', options: CURRENCIES, span: 2 },
      { name: 'builder_price', label: 'Builder price', type: 'number', section: 'Project Features', min: 0, max: 1e12, confidential: true, help: 'Internal — never shown on the website.', span: 2 },
      { name: 'brokerage_price', label: 'Brokerage price', type: 'number', section: 'Project Features', min: 0, max: 1e12, confidential: true, help: 'Internal — never shown on the website.', span: 2 },
      { name: 'public_price', label: 'Public display price', type: 'number', section: 'Project Features', min: 0, max: 1e12, help: 'Shown as “Starting from …”. The only price visitors see.', span: 2 },
      { name: 'starting_price', label: 'Public price text (optional)', type: 'text', section: 'Project Features', maxLength: 80, placeholder: '₹1.33 – 4.55 Cr', help: 'Shown instead of the number when set.', span: 2 },
      { name: 'price_from', label: 'Rate per sq.ft (map filter)', type: 'number', section: 'Project Features', min: 0, max: 1e12, span: 2 },
      // 3 — Details
      { name: 'details', label: 'Project details', type: 'pairs', section: 'Project Details', span: 6,
        help: 'RERA number, land area, towers, floors, homes, open space, clubhouse, amenity floor, specifications… one row each.' },
      // 4 — Floor plans
      { name: 'floor_plans', label: 'Floor plans', type: 'floorplans', section: 'Floor Plans', span: 6 },
      // 5 — Amenities
      { name: 'amenity_items', label: 'Amenities', type: 'amenityItems', section: 'Amenities', span: 6 },
      // 6 — Master plan
      { name: 'master_plan_image', label: 'Master plan / site plan', type: 'image', section: 'Master Plan', span: 6, help: 'Visitors can zoom into it.' },
      { name: 'master_plan_notes', label: 'Layout notes', type: 'textarea', section: 'Master Plan', maxLength: 3000, span: 6,
        placeholder: 'Six towers around a central landscaped court\nMain entry & exit on the Kokapet–Neopolis road\nClubhouse at the centre of the site',
        help: 'One point per line — tower layout, entry/exit, clubhouse, open spaces, internal roads, landscape zones.' },
      // 7 — Location
      { name: 'city', label: 'City', type: 'text', section: 'Location & Connectivity', required: true, maxLength: 80, help: 'Hyderabad and Visakhapatnam projects appear on that city’s map.', span: 2 },
      { name: 'location', label: 'Location / area', type: 'text', section: 'Location & Connectivity', maxLength: 120, placeholder: 'Kokapet', span: 4 },
      { name: 'lat', label: 'Latitude', type: 'number', section: 'Location & Connectivity', min: -90, max: 90, help: 'Locality-level only.', span: 2 },
      { name: 'lng', label: 'Longitude', type: 'number', section: 'Location & Connectivity', min: -180, max: 180, span: 2 },
      { name: 'map_url', label: 'Map link', type: 'url', section: 'Location & Connectivity', span: 2 },
      { name: 'connectivity', label: 'Nearby & connectivity', type: 'connectivity', section: 'Location & Connectivity', span: 6 },
      // 8 — Availability
      { name: 'availability_status', label: 'Current availability', type: 'select', section: 'Availability / WhatsApp', required: true, default: 'on_request', options: AVAILABILITY, span: 3 },
      { name: 'availability_note', label: 'Public availability note', type: 'text', section: 'Availability / WhatsApp', maxLength: 200, placeholder: 'East-facing 3 BHKs in towers B–E', span: 3 },
      { name: 'availability_internal_notes', label: 'Internal inventory notes', type: 'textarea', section: 'Availability / WhatsApp', maxLength: 5000, confidential: true, span: 6,
        help: 'Admins only — never shown on the website.' },
      // media / visibility
      { name: 'brochure_url', label: 'Brochure PDF', type: 'file', section: 'Gallery & Media', span: 3 },
      { name: 'video_url', label: 'Video URL', type: 'url', section: 'Gallery & Media', span: 3 },
      { name: 'is_published', label: 'Published', type: 'bool', section: 'Visibility', span: 2 },
      { name: 'is_featured', label: 'Featured on homepage', type: 'bool', section: 'Visibility', span: 2 },
      { name: 'display_order', label: 'Display order', type: 'number', section: 'Visibility', integer: true, min: -100000, max: 100000, span: 2 },
      ...seoFields(),
    ],
    galleries: [
      { name: 'gallery', label: 'Gallery images', table: 'project_images', fk: 'project_id', kind: 'gallery', section: 'Gallery & Media', max: 40, help: 'Only this project’s own images — never borrowed or stock photos. Shown on the Overview slide.' },
    ],
    toggles: [
      { field: 'is_published', label: 'Published', on: 'Published', off: 'Draft' },
      { field: 'is_featured', label: 'Featured', on: 'Featured', off: '—' },
    ],
    search: ['name', 'developer', 'location', 'city'],
    filters: [
      { name: 'city', label: 'City', options: opts(['Hyderabad', 'Hyderabad'], ['Visakhapatnam', 'Visakhapatnam']) },
      { name: 'status', label: 'Status', options: PROJECT_STATUS },
      { name: 'is_published', label: 'Visibility', options: opts(['true', 'Published'], ['false', 'Draft']) },
    ],
    columns: [
      { field: 'main_image', label: '', kind: 'image' },
      { field: 'name', label: 'Project', kind: 'title' },
      { field: 'location', label: 'Location' },
      { field: 'public_price', label: 'Public price', kind: 'money' },
      { field: 'brokerage_price', label: 'Builder / Brokerage', kind: 'pricing', confidential: true },
      { field: 'status', label: 'Status', kind: 'badge' },
    ],
    order: 'display_order asc, id asc',
  },

  videos: {
    key: 'videos', table: 'videos', label: 'Videos', singular: 'Video',
    description: 'Video links shown on the homepage. Only active videos are public.',
    titleField: 'title', slugFrom: 'title', sections: ['Video', 'SEO'],
    seo: { kind: 'video', path: '/videos/', publishedField: 'is_active' },
    fields: [
      { name: 'title', label: 'Video title', type: 'text', section: 'Video', required: true, maxLength: 160, span: 4 },
      { name: 'slug', label: 'URL slug', type: 'slug', section: 'Video', help: '/videos/<slug>', span: 2 },
      { name: 'youtube_url', label: 'YouTube URL', type: 'url', section: 'Video', span: 3 },
      { name: 'instagram_url', label: 'Instagram URL', type: 'url', section: 'Video', span: 3 },
      { name: 'thumbnail', label: 'Thumbnail', type: 'image', section: 'Video', help: 'Optional — YouTube videos use their own thumbnail when empty.', span: 6 },
      { name: 'description', label: 'Short description', type: 'textarea', section: 'Video', maxLength: 600, span: 6 },
      { name: 'category', label: 'Category', type: 'text', section: 'Video', maxLength: 60, placeholder: 'Project tour, Market update…', span: 2 },
      { name: 'display_order', label: 'Display order', type: 'number', section: 'Video', integer: true, min: -100000, max: 100000, span: 2 },
      { name: 'is_active', label: 'Active', type: 'bool', section: 'Video', span: 2 },
      { name: 'publish_date', label: 'Upload / publish date', type: 'date', section: 'Video', span: 3 },
      { name: 'duration', label: 'Duration', type: 'text', section: 'Video', maxLength: 12, placeholder: '4:13', help: 'm:ss or h:mm:ss', span: 3 },
      { name: 'transcript', label: 'Transcript or summary', type: 'textarea', section: 'Video', maxLength: 20000, span: 6 },
      ...seoFields(['seo_title', 'meta_description', 'image_alt_text', 'is_indexed']).map((f) =>
        f.name === 'image_alt_text' ? { ...f, label: 'Thumbnail alt text' } : f),
    ],
    toggles: [{ field: 'is_active', label: 'Active', on: 'Active', off: 'Inactive' }],
    search: ['title', 'category'],
    filters: [{ name: 'is_active', label: 'Visibility', options: opts(['true', 'Active'], ['false', 'Inactive']) }],
    columns: [
      { field: 'thumbnail', label: '', kind: 'image' },
      { field: 'title', label: 'Video', kind: 'title' },
      { field: 'category', label: 'Category' },
    ],
    order: 'display_order asc, id desc',
  },

  reviews: {
    key: 'reviews', table: 'reviews', label: 'Reviews', singular: 'Review',
    description: 'Client reviews. A review is public only when approved and active.',
    titleField: 'client_name', sections: ['Review'],
    fields: [
      { name: 'client_name', label: 'Client name', type: 'text', section: 'Review', required: true, maxLength: 120, span: 3 },
      { name: 'rating', label: 'Rating', type: 'rating', section: 'Review', required: true, span: 3 },
      { name: 'review_text', label: 'Review text', type: 'textarea', section: 'Review', required: true, maxLength: 3000, span: 6 },
      { name: 'client_image', label: 'Client image', type: 'image', section: 'Review', span: 6 },
      { name: 'location', label: 'Location', type: 'text', section: 'Review', maxLength: 120, span: 3 },
      { name: 'review_date', label: 'Date', type: 'date', section: 'Review', span: 3 },
      { name: 'is_approved', label: 'Approved', type: 'bool', section: 'Review', span: 2 },
      { name: 'is_active', label: 'Active', type: 'bool', section: 'Review', span: 2 },
      { name: 'display_order', label: 'Display order', type: 'number', section: 'Review', integer: true, min: -100000, max: 100000, span: 2 },
    ],
    toggles: [
      { field: 'is_approved', label: 'Approved', on: 'Approved', off: 'Pending' },
      { field: 'is_active', label: 'Active', on: 'Active', off: 'Hidden' },
    ],
    search: ['client_name', 'review_text', 'location'],
    filters: [{ name: 'is_approved', label: 'Approval', options: opts(['true', 'Approved'], ['false', 'Pending']) }],
    columns: [
      { field: 'client_image', label: '', kind: 'image' },
      { field: 'client_name', label: 'Client', kind: 'title' },
      { field: 'rating', label: 'Rating', kind: 'rating' },
      { field: 'review_date', label: 'Date', kind: 'date' },
    ],
    order: 'display_order asc, id desc',
  },

  agents: {
    key: 'agents', table: 'agents', label: 'Agents', singular: 'Agent',
    description: 'Advisors shown in “Meet your advisors” on the About page.',
    titleField: 'name', slugFrom: 'name', sections: ['Profile', 'Contact', 'Social', 'SEO'],
    seo: { kind: 'agent', path: '/agents/', publishedField: 'is_active' },
    fields: [
      { name: 'name', label: 'Agent name', type: 'text', section: 'Profile', required: true, maxLength: 120, span: 2 },
      { name: 'designation', label: 'Designation', type: 'text', section: 'Profile', maxLength: 120, span: 2 },
      { name: 'slug', label: 'URL slug', type: 'slug', section: 'Profile', help: '/agents/<slug>', span: 2 },
      { name: 'photo', label: 'Profile photo', type: 'image', section: 'Profile', span: 6 },
      { name: 'bio', label: 'Bio', type: 'textarea', section: 'Profile', maxLength: 3000, span: 6 },
      { name: 'languages', label: 'Languages', type: 'tags', section: 'Profile', span: 3 },
      { name: 'service_areas', label: 'Service areas', type: 'tags', section: 'Profile', span: 3 },
      { name: 'is_active', label: 'Active', type: 'bool', section: 'Profile', span: 2 },
      { name: 'display_order', label: 'Display order', type: 'number', section: 'Profile', integer: true, min: -100000, max: 100000, span: 2 },
      { name: 'phone', label: 'Phone', type: 'tel', section: 'Contact', span: 2 },
      { name: 'whatsapp', label: 'WhatsApp', type: 'tel', section: 'Contact', span: 2 },
      { name: 'email', label: 'Email', type: 'email', section: 'Contact', span: 2 },
      { name: 'instagram', label: 'Instagram', type: 'url', section: 'Social', span: 3 },
      { name: 'facebook', label: 'Facebook', type: 'url', section: 'Social', span: 3 },
      { name: 'linkedin', label: 'LinkedIn', type: 'url', section: 'Social', span: 3 },
      { name: 'youtube', label: 'YouTube', type: 'url', section: 'Social', span: 3 },
      ...seoFields(['seo_title', 'meta_description', 'canonical_url', 'og_title', 'og_description', 'og_image', 'image_alt_text', 'is_indexed'])
        .map((f) => (f.name === 'image_alt_text' ? { ...f, label: 'Profile image alt text' } : f)),
    ],
    toggles: [{ field: 'is_active', label: 'Active', on: 'Active', off: 'Inactive' }],
    search: ['name', 'designation', 'email'],
    filters: [{ name: 'is_active', label: 'Visibility', options: opts(['true', 'Active'], ['false', 'Inactive']) }],
    columns: [
      { field: 'photo', label: '', kind: 'image' },
      { field: 'name', label: 'Agent', kind: 'title' },
      { field: 'designation', label: 'Designation' },
      { field: 'phone', label: 'Phone' },
    ],
    order: 'display_order asc, id asc',
  },

  locations: {
    key: 'locations', table: 'locations', label: 'Locations', singular: 'Location page',
    description: 'Service-area pages at /real-estate/<city>. Write unique content for each — avoid copying text between cities.',
    titleField: 'name', slugFrom: 'name', sections: ['Page', 'Content', 'SEO'],
    seo: { kind: 'location', path: '/real-estate/', publishedField: 'is_published' },
    fields: [
      { name: 'name', label: 'Location name', type: 'text', section: 'Page', required: true, maxLength: 80, span: 2 },
      { name: 'slug', label: 'URL slug', type: 'slug', section: 'Page', help: '/real-estate/<slug>', span: 2 },
      { name: 'is_published', label: 'Published', type: 'bool', section: 'Page', span: 2 },
      { name: 'heading', label: 'Main heading (H1)', type: 'text', section: 'Page', maxLength: 120, span: 6, placeholder: 'Real Estate in Hyderabad' },
      { name: 'match_cities', label: 'Listings from these cities', type: 'tags', section: 'Page', help: 'Properties, projects and agents whose city / service area matches appear on the page. Defaults to the location name.', span: 6 },
      { name: 'hero_image', label: 'Hero image', type: 'image', section: 'Page', span: 6 },
      { name: 'display_order', label: 'Display order', type: 'number', section: 'Page', integer: true, min: -100000, max: 100000, span: 2 },
      { name: 'intro', label: 'Description', type: 'textarea', section: 'Content', maxLength: 1500, span: 6, help: 'Short introduction under the heading.' },
      { name: 'market_content', label: 'Local market content', type: 'textarea', section: 'Content', maxLength: 20000, span: 6, help: 'Separate paragraphs with a blank line. A line starting with "## " becomes a sub-heading.' },
      { name: 'faqs', label: 'FAQs', type: 'faqs', section: 'Content', span: 6, help: 'Shown on the page and published as FAQPage structured data.' },
      ...seoFields(),
    ],
    toggles: [{ field: 'is_published', label: 'Published', on: 'Published', off: 'Draft' }],
    search: ['name', 'heading'],
    filters: [{ name: 'is_published', label: 'Visibility', options: opts(['true', 'Published'], ['false', 'Draft']) }],
    columns: [
      { field: 'hero_image', label: '', kind: 'image' },
      { field: 'name', label: 'Location', kind: 'title' },
      { field: 'heading', label: 'Heading' },
    ],
    order: 'display_order asc, id asc',
  },
};

export const LEAD_STATUS = opts(
  ['new', 'New'], ['contacted', 'Contacted'], ['follow_up', 'Follow Up'],
  ['qualified', 'Qualified'], ['closed', 'Closed'], ['lost', 'Lost']);

export const labelOf = (options: Option[] | undefined, v: unknown) =>
  options?.find((o) => o.value === String(v))?.label ?? String(v ?? '');

/** Fields a non-admin role may never read or write. */
export const confidentialFields = (r: Resource) => r.fields.filter((f) => f.confidential).map((f) => f.name);

/** ₹1.75 Cr / ₹13 Lakhs / ₹45,000 for INR; $899,000 for CAD/USD. */
export function formatMoney(n: number | null | undefined, currency = 'INR') {
  if (n == null || Number.isNaN(Number(n))) return '';
  const v = Number(n), neg = v < 0 ? '-' : '', a = Math.abs(v);
  if (currency === 'INR') {
    const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, '');
    if (a >= 1e7) return `${neg}₹${trim(a / 1e7)} Cr`;
    if (a >= 1e5) return `${neg}₹${trim(a / 1e5)} Lakhs`;
    return `${neg}₹${a.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
  return `${neg}${currency === 'USD' ? 'US$' : '$'}${a.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
}

/** Builder − Brokerage, and that difference as a % of the builder price. */
export function priceSpread(builder: unknown, brokerage: unknown) {
  const has = (v: unknown) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
  if (!has(builder) || !has(brokerage)) return null;
  const b = Number(builder), diff = b - Number(brokerage);
  return { diff, pct: b > 0 ? (diff / b) * 100 : null };
}
