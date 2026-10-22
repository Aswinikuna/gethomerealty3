// Imports the presentation content each project already has in ../assets/js/data.js
// (GHR_DETAILS) into the editable project fields, so the admin shows — and can
// change — what the website already displays. Only fills fields that are still
// empty; never overwrites admin edits. Safe to run repeatedly (part of db:seed).

const SITE_PLAN = /site plan|master ?plan|layout plan/i;

/** "3 BHK · 1,730 sq.ft · east facing" → structured fields. */
function parsePlanLabel(label) {
  const t = String(label || '');
  const bhk = (t.match(/(prime\s+)?\d(?:\.\d)?\s*bhk|studio|villa|penthouse|duplex/i) || [''])[0].replace(/\s+/g, ' ').replace(/bhk/i, 'BHK').replace(/^prime/i, 'Prime');
  const size = (t.match(/[\d,]+(?:\s*[–-]\s*[\d,]+)?\s*sq\.?\s*(?:ft|yd)/i) || [''])[0].replace(/sq\.?\s*ft/i, 'sq.ft');
  const facing = (t.match(/\b(north|south|east|west)(?:[- ](east|west))?(?=[- ]facing)/i) || [''])[0];
  const tower = (t.match(/towers?\s+([A-Z](?:\s*(?:,|&|–|-)\s*[A-Z])*)/) || [])[1] || '';
  const cap = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  return { bhk, size, facing: cap(facing.toLowerCase()), tower, description: bhk || size ? '' : t };
}

/** Add carpet area / tower from the builder's unit table when one row matches. */
function enrich(plan, x) {
  // Only a specific unit (type + size) can be matched to one table row.
  if (!x.unitHead || !x.unitRows || !plan.bhk || !plan.size) return plan;
  const col = (re) => x.unitHead.findIndex((h) => re.test(h));
  const iType = 0, iFacing = col(/facing/i), iTower = col(/tower/i), iCarpet = col(/carpet/i), iSize = col(/saleable|built|size/i);
  const num = (s) => String(s || '').replace(/[^\d]/g, '');
  const row = x.unitRows.find((r) =>
    (!plan.bhk || String(r[iType]).toLowerCase() === plan.bhk.toLowerCase()) &&
    (iSize < 0 || !plan.size || num(r[iSize]) === num(plan.size.split(/[–-]/)[0])) &&
    (iFacing < 0 || !plan.facing || String(r[iFacing]).toLowerCase() === plan.facing.toLowerCase()));
  if (!row) return plan;
  return {
    ...plan,
    carpet: plan.carpet || (iCarpet >= 0 && row[iCarpet] ? `${row[iCarpet]} sq.ft` : ''),
    tower: plan.tower || (iTower >= 0 ? String(row[iTower] || '') : ''),
  };
}

function flatAmenities(a) {
  if (!a) return [];
  if (Array.isArray(a)) return a.flatMap((x) => (Array.isArray(x) ? flatAmenities(x[1]) : typeof x === 'string' ? [x] : []));
  return Object.values(a).flatMap(flatAmenities);
}

export async function importProjectSlides(db, GHR, log) {
  const details = GHR.GHR_DETAILS || {};
  const rows = await db.query(`select id, slug, description, details, floor_plans, amenity_items, amenities, master_plan_image,
    connectivity, project_scale, extra from projects`);
  let touched = 0;
  for (const p of rows) {
    const x = details[p.slug] || {};
    const set = {};
    if (!p.description && x.tagline) set.description = x.tagline;
    if (!p.project_scale && p.extra?.scale) set.project_scale = p.extra.scale;
    if (!(p.details || []).length) {
      const facts = [...(x.facts || []), ...(x.facts2 || [])].filter((f) => Array.isArray(f) && f[0] && f[1] && !/^(locality|location)$/i.test(f[0]));
      if (facts.length) set.details = facts.map(([label, value]) => ({ label: String(label).slice(0, 80), value: String(value).slice(0, 600) }));
    }
    const legacyPlans = await db.query(`select url, alt from project_images where project_id = $1 and kind = 'floorplan' order by sort_order, id`, [p.id]);
    const plans = [...legacyPlans.map((r) => [r.alt || '', r.url]), ...(x.plans || [])].filter((pl) => pl && pl[1]);
    if (!p.master_plan_image) {
      const site = plans.find((pl) => SITE_PLAN.test(pl[0]));
      if (site) set.master_plan_image = site[1];
    }
    if (!(p.floor_plans || []).length) {
      const fp = plans.filter((pl) => !SITE_PLAN.test(pl[0])).map(([label, image]) => {
        const parsed = parsePlanLabel(label);
        return enrich({ image, carpet: '', ...parsed, description: parsed.description.slice(0, 500) }, x);
      });
      if (fp.length) set.floor_plans = fp.slice(0, 60);
    }
    if (!(p.amenity_items || []).length) {
      const list = [...new Set([...(p.amenities || []), ...flatAmenities(x.amenities)])].filter(Boolean);
      if (list.length) set.amenity_items = list.slice(0, 150).map((title) => ({ title: String(title).slice(0, 100), icon: '', image: '', description: '' }));
    }
    if (!(p.connectivity || []).length && (x.location || []).length) {
      set.connectivity = x.location.filter((l) => l && l[0]).slice(0, 60).map(([place, time]) => ({ place: String(place).slice(0, 120), time: String(time || '').slice(0, 40), category: '' }));
    }
    const keys = Object.keys(set);
    if (!keys.length && !legacyPlans.length) continue;
    await db.tx(async (t) => {
      if (keys.length) {
        const json = new Set(['details', 'floor_plans', 'amenity_items', 'connectivity']);
        await t.query(`update projects set ${keys.map((k, i) => `${k} = $${i + 2}${json.has(k) ? '::jsonb' : ''}`).join(', ')} where id = $1`,
          [p.id, ...keys.map((k) => (json.has(k) ? JSON.stringify(set[k]) : set[k]))]);
      }
      // Floor plans now live in projects.floor_plans; the old image-list rows were copied above.
      if (legacyPlans.length) await t.query(`delete from project_images where project_id = $1 and kind = 'floorplan'`, [p.id]);
    });
    touched++;
  }
  log(`project slides: imported existing content into ${touched} project(s)`);
}
