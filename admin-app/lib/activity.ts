import { q } from './db';

export async function logActivity(adminId: number | null, action: string, entity: string, entityId: string | number | null, summary: string) {
  try {
    await q('insert into activity_log (admin_id, action, entity, entity_id, summary) values ($1,$2,$3,$4,$5)',
      [adminId, action, entity, entityId == null ? null : String(entityId), summary.slice(0, 300)]);
  } catch (e) { console.error('activity log failed', e); }
}
