// Database connection shared by the Next.js app and the CLI scripts.
//
//   DATABASE_URL=postgres://…   → real PostgreSQL (Supabase in production)
//   DATABASE_URL unset          → embedded PostgreSQL (PGlite) in ./.data/pglite
//
// Only one PGlite instance may own the data directory, so the handle is cached on
// globalThis (Next dev can load this module more than once per process). Don't run
// the seed/migrate scripts while `npm run dev` is running against PGlite.
import path from 'node:path';
import fs from 'node:fs';

const KEY = Symbol.for('ghr.db');

/**
 * @typedef {{ query: (text: string, params?: unknown[]) => Promise<any[]> }} Queryable
 * @typedef {Queryable & {
 *   kind: 'postgres' | 'pglite',
 *   exec: (text: string) => Promise<unknown>,
 *   tx: <T>(fn: (q: Queryable) => Promise<T>) => Promise<T>,
 *   close: () => Promise<void>,
 * }} Db
 */

/** @returns {Promise<Db>} */
export function getDb() {
  const g = /** @type {any} */ (globalThis);
  if (!g[KEY]) g[KEY] = connect().catch((e) => { g[KEY] = undefined; throw e; });
  return g[KEY];
}

async function connect() {
  const url = process.env.DATABASE_URL || '';
  if (/^postgres(ql)?:\/\//.test(url)) {
    const postgres = (await import('postgres')).default;
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const ssl = process.env.DATABASE_SSL === 'disable' || local ? false : 'require';
    // prepare:false — required by Supabase's transaction pooler (pgbouncer).
    const sql = postgres(url, { max: Number(process.env.DATABASE_POOL || 5), ssl, prepare: false, idle_timeout: 20 });
    const wrap = (s) => ({ query: (text, params = []) => s.unsafe(text, /** @type {any[]} */ (params)).then((r) => [...r]) });
    return {
      kind: 'postgres',
      ...wrap(sql),
      exec: (text) => sql.unsafe(text),
      tx: (fn) => sql.begin((t) => fn(wrap(t))),
      close: () => sql.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = url.startsWith('pglite:') ? url.slice(7) : path.join(process.cwd(), '.data', 'pglite');
  fs.mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    kind: 'pglite',
    query: async (text, params = []) => (await db.query(text, /** @type {any[]} */ (params))).rows,
    exec: (text) => db.exec(text),
    tx: (fn) => db.transaction((t) => fn({ query: async (text, params = []) => (await t.query(text, /** @type {any[]} */ (params))).rows })),
    close: () => db.close(),
  };
}

/** Apply db/schema.sql (idempotent). */
export async function migrate(db) {
  const file = path.join(process.cwd(), 'db', 'schema.sql');
  await db.exec(fs.readFileSync(file, 'utf8'));
}
