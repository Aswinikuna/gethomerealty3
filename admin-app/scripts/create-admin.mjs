// Create or reset an admin account from the environment:
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run admin:create
import './env.mjs';
import bcrypt from 'bcryptjs';
import { getDb, migrate } from '../lib/db-core.mjs';

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = process.env.ADMIN_NAME || 'Administrator';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Set ADMIN_EMAIL to a valid email.'); process.exit(1); }
if (password.length < 12 || password === 'change-me-to-a-long-passphrase') {
  console.error('Set ADMIN_PASSWORD to at least 12 characters (and not the example value).'); process.exit(1);
}
const db = await getDb();
await migrate(db);
const hash = await bcrypt.hash(password, 12);
const [row] = await db.query(
  `insert into admins (email, name, password_hash) values ($1, $2, $3)
   on conflict (email) do update set password_hash = excluded.password_hash, failed_logins = 0,
     locked_until = null, is_active = true, updated_at = now()
   returning id, (xmax = 0) as created`, [email, name, hash]);
await db.query('delete from sessions where admin_id = $1', [row.id]);
console.log(`${row.created ? 'Created' : 'Reset password for'} admin ${email}`);
await db.close();
