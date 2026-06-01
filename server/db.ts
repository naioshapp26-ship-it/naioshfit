import * as schema from "@shared/schema";
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set.');
}

// Always use node-postgres to avoid WebSocket driver issues (works for Neon & Railway).
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
const { Pool } = pg;

const needsSSL = /sslmode=require/.test(DATABASE_URL);

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

(async () => {
  try {
    await db.execute(sql`select 1 as up`);
    try {
      const url = new URL(DATABASE_URL);
      console.log('[DB] Connected using node-postgres. Host:', url.host);
    } catch {
      console.log('[DB] Connected using node-postgres.');
    }
  } catch (err) {
    console.error('[DB] Connectivity check failed:', err);
  }
})();