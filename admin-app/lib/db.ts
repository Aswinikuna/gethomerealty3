import { getDb, migrate } from './db-core.mjs';

export type Row = Record<string, any>;
export interface Queryable { query: (text: string, params?: unknown[]) => Promise<Row[]> }

const g = globalThis as unknown as { __ghrMigrated?: Promise<void> };

/** The shared database handle. Embedded PGlite (local dev) migrates itself on first use. */
export async function db() {
  if (process.env.VERCEL && !/^postgres/.test(process.env.DATABASE_URL || '')) {
    throw new Error('DATABASE_URL must point at PostgreSQL (Supabase) in production.');
  }
  const d = await getDb();
  if (d.kind === 'pglite') {
    g.__ghrMigrated ??= migrate(d);
    await g.__ghrMigrated;
  }
  return d;
}

export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await db()).query(text, params);
}

export async function one(text: string, params: unknown[] = []): Promise<Row | null> {
  return (await q(text, params))[0] ?? null;
}

export async function tx<T>(fn: (t: Queryable) => Promise<T>): Promise<T> {
  return (await db()).tx(fn as any) as Promise<T>;
}

/** Make DB rows JSON-safe: Dates → ISO strings, bigint → number. */
export function plain<T = Row>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? Number(v) : v;
  }
  return out as T;
}
