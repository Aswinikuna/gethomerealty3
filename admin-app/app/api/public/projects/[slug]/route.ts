// GET /api/public/projects/<slug> — content for the project presentation popup,
// fetched only when a visitor opens a project. Published projects only, explicit
// public columns only (no builder/brokerage price, no internal inventory notes).
import { q } from '@/lib/db';
import { formatMoney, AVAILABILITY, PROJECT_STATUS, labelOf } from '@/lib/resources';

export const dynamic = 'force-dynamic';

const COLS = `id, slug, name, developer, city, location, description, possession, status, property_type, bedrooms, unit_sizes,
  project_scale, extra, starting_price, public_price, currency, main_image, image_alt_text, brochure_url, video_url, lat, lng,
  details, floor_plans, amenity_items, amenities, master_plan_image, master_plan_notes, connectivity,
  availability_status, availability_note`;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const headers = { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=600', 'X-Content-Type-Options': 'nosniff' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return Response.json({ error: 'Not found' }, { status: 404, headers });
  const p = (await q(`select ${COLS} from projects where slug = $1 and is_published`, [slug]))[0];
  if (!p) return Response.json({ error: 'Not found' }, { status: 404, headers });
  const gallery = await q(`select url, alt from project_images where project_id = $1 and kind = 'gallery' order by sort_order, id limit 12`, [p.id]);
  const extra = (p.extra || {}) as Record<string, any>;
  const amenityItems = (p.amenity_items || []).length
    ? p.amenity_items
    : (p.amenities || []).map((title: string) => ({ title, icon: '', image: '', description: '' }));
  return Response.json({
    id: p.slug, name: p.name, developer: p.developer || '', city: p.city || '', area: p.location || '',
    description: p.description || '', possession: p.possession || '',
    salesStatus: labelOf(PROJECT_STATUS, p.status), propertyType: p.property_type || '',
    configuration: p.bedrooms || '', sizes: p.unit_sizes || '', scale: p.project_scale || extra.scale || '',
    price: p.starting_price || (p.public_price ? `Starting from ${formatMoney(p.public_price, p.currency)}` : ''),
    images: [p.main_image ? { url: p.main_image, alt: p.image_alt_text || p.name } : null,
      ...gallery.map((g) => ({ url: g.url, alt: g.alt || p.name }))].filter(Boolean),
    brochure: p.brochure_url || '', video: p.video_url || '',
    lat: p.lat, lng: p.lng,
    details: p.details || [],
    floorPlans: p.floor_plans || [],
    amenities: amenityItems,
    masterPlan: p.master_plan_image ? { image: p.master_plan_image, notes: String(p.master_plan_notes || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean) } : null,
    connectivity: p.connectivity || [],
    availability: { status: labelOf(AVAILABILITY, p.availability_status), note: p.availability_note || '' },
  }, { headers });
}
