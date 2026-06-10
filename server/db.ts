import * as schema from "@shared/schema";
import { sql } from 'drizzle-orm';
import { normalizePostgresConnection } from '@shared/dbUrl';
import { parse as parseConnectionString } from 'pg-connection-string';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set.');
}

// Always use node-postgres to avoid WebSocket driver issues (works for Neon & Railway).
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
const { Pool } = pg;

const { connectionString: normalizedUrl, ssl } = normalizePostgresConnection(DATABASE_URL);
const parsed = parseConnectionString(normalizedUrl) as pg.PoolConfig & { sslmode?: string };
delete parsed.sslmode;

export const pool = new Pool({
  host: parsed.host,
  port: parsed.port,
  user: parsed.user,
  password: parsed.password,
  database: parsed.database,
  ssl: ssl ?? false,
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