import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeMigrationSql } from './migrationSanitizer';

const { Pool } = pg;

let centralPool: pg.Pool | null = null;
let centralSchemaPromise: Promise<void> | null = null;

function sanitizeDatabaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    url.searchParams.delete('sslmode');
    url.searchParams.delete('sslrootcert');
    url.searchParams.delete('sslcert');
    url.searchParams.delete('sslkey');
    return url.toString();
  } catch {
    return raw;
  }
}

function getCentralDatabaseUrl(): string | undefined {
  return sanitizeDatabaseUrl(process.env.CENTRAL_DATABASE_URL || process.env.DATABASE_URL);
}

function resolveCentralMigrationsDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'saas', 'migrations', 'central'),
    path.resolve(process.cwd(), 'dist', 'saas', 'migrations', 'central'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return null;
}

export async function ensureCentralSchema(): Promise<void> {
  if (centralSchemaPromise) {
    return centralSchemaPromise;
  }

  centralSchemaPromise = (async () => {
    const pool = getCentralPool();
    const migrationsDir = resolveCentralMigrationsDir();
    if (!migrationsDir) {
      throw new Error('Central migrations directory not found.');
    }

    await pool.query(
      `CREATE TABLE IF NOT EXISTS central_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT NOW()
      )`
    );

    const appliedResult = await pool.query<{ filename: string }>(
      'SELECT filename FROM central_migrations'
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      const sql = sanitizeMigrationSql(fs.readFileSync(path.join(migrationsDir, file), 'utf-8')).trim();
      if (!sql) {
        continue;
      }

      try {
        await pool.query(sql);
      } catch (error: any) {
        if (error?.code === '42P07' || error?.message?.includes('already exists')) {
          await pool.query(
            'INSERT INTO central_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
          continue;
        }
        throw error;
      }

      await pool.query(
        'INSERT INTO central_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
    }
  })();

  return centralSchemaPromise;
}

export function getCentralPool(): pg.Pool {
  if (centralPool) {
    return centralPool;
  }

  const url = getCentralDatabaseUrl();
  if (!url) {
    throw new Error('CENTRAL_DATABASE_URL or DATABASE_URL must be set for the central database.');
  }

  // Parse the connection string
  const config = parseConnectionString(url);

  // Match db.ts: SSL only when explicitly required (cloud hosts), not for local PostgreSQL
  const needsSSL = /sslmode=require/.test(url) || /railway\.app|\.proxy\.rlwy\.net/i.test(url);
  const allowSelfSigned = /railway\.app|\.proxy\.rlwy\.net/i.test(url) || process.env.CENTRAL_DB_SSL_ALLOW_SELF_SIGNED === '1' || process.env.DB_SSL_ALLOW_SELF_SIGNED === '1';

  // Set SSL configuration
  if (needsSSL) {
    config.ssl = allowSelfSigned ? {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    } : { rejectUnauthorized: true };
  }

  centralPool = new Pool({
    ...config,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  } as pg.PoolConfig);

  centralPool.on('error', (err) => {
    console.error('[CENTRAL DB] Pool error:', err);
  });

  return centralPool;
}
