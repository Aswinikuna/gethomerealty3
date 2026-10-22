// Receives every enquiry form on the public site. Anonymous, so: allowed origins
// only, honeypot, per-IP rate limit, strict validation and size caps.
//
// Origins: the site served by this app (same origin) always works. Pages served
// from somewhere else (a separate static host, or a local preview such as VS Code
// Live Server) may post here only if listed in PUBLIC_FORM_ORIGINS; in development
// any localhost / 127.0.0.1 page is allowed too.
import { one, q } from '@/lib/db';
import { clientIp, fail, handle, HttpError, json, readJson } from '@/lib/http';
import { PublicLead } from '@/lib/leads';
import { rateLimit } from '@/lib/ratelimit';

const DEV = process.env.NODE_ENV !== 'production';
const LISTED = (process.env.PUBLIC_FORM_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

/** The calling page's origin if it may submit, '' for same-origin/no-origin requests; throws otherwise. */
function formOrigin(req: Request): string {
  const origin = req.headers.get('origin');
  if (!origin) return '';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  let o: URL | null = null;
  try { o = new URL(origin); } catch { /* "null" (file://) or garbage */ }
  if (o && o.host === host) return '';
  if (LISTED.includes(origin)) return origin;
  if (DEV && (origin === 'null' || (o && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(o.hostname)))) return origin;
  throw new HttpError(403, 'Cross-site request blocked.');
}

function withCors(res: Response, origin: string) {
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

/** CORS preflight for pages hosted on an allowed other origin. */
export async function OPTIONS(req: Request) {
  try {
    const origin = formOrigin(req);
    const res = new Response(null, { status: 204 });
    if (origin) {
      res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      res.headers.set('Access-Control-Max-Age', '86400');
    }
    return withCors(res, origin);
  } catch (e) { return handle(e); }
}

export async function POST(req: Request) {
  let origin = '';
  try {
    origin = formOrigin(req);
    const ip = clientIp(req);
    if (!rateLimit(`lead:${ip}`, 6, 10 * 60_000)) return withCors(fail(429, 'Too many submissions from this connection — please try again in a few minutes.'), origin);
    const d = PublicLead.parse(await readJson(req, 32 * 1024));
    if (d.website) return withCors(json({ ok: true }), origin); // bot: pretend it worked

    let propertyId: number | null = null, projectId: number | null = null, refLabel: string | null = null;
    if (d.reference?.type === 'property') {
      const p = await one('select id, title from properties where slug = $1', [d.reference.id]);
      if (p) { propertyId = p.id; refLabel = `Property: ${p.title}`; }
    } else if (d.reference?.type === 'project') {
      const p = await one('select id, name from projects where slug = $1', [d.reference.id]);
      if (p) { projectId = p.id; refLabel = `Project: ${p.name}`; }
    }
    await q(
      `insert into leads (name, phone, email, message, inquiry_type, property_id, project_id, reference_label, source, details, ip, user_agent)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
      [d.name, d.phone, d.email, d.message, d.inquiry_type, propertyId, projectId, refLabel, d.source,
        JSON.stringify(d.details || {}), ip, (req.headers.get('user-agent') || '').slice(0, 300)]);
    return withCors(json({ ok: true }, 201), origin);
  } catch (e) { return withCors(handle(e), origin); }
}
