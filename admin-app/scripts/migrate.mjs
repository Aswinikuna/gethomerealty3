import './env.mjs';
import { getDb, migrate } from '../lib/db-core.mjs';

const db = await getDb();
await migrate(db);
console.log(`migrate: schema applied (${db.kind})`);
await db.close();
