import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { getPostgresSslConfig } from '@shared/dbUrl';
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
    try {
      await centralSchemaPromise;
      return;
    } catch {
      centralSchemaPromise = null;
    }
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
        const benign =
          error?.code === '42P07' ||
          error?.code === '42710' ||
          error?.message?.includes('already exists');
        if (!benign) {
          console.error(`[CENTRAL DB] Migration failed: ${file}`, error?.message || error);
          throw error;
        }
      }

      await pool.query(
        'INSERT INTO central_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [file]
      );
    }
  })();

  try {
    await centralSchemaPromise;
  } catch (error) {
    centralSchemaPromise = null;
    throw error;
  }
}

export function getCentralPool(): pg.Pool {
  if (centralPool) {
    return centralPool;
  }

  const url = getCentralDatabaseUrl();
  if (!url) {
    throw new Error('CENTRAL_DATABASE_URL or DATABASE_URL must be set for the central database.');
  }

  centralPool = new Pool({
    connectionString: url,
    ssl: getPostgresSslConfig(url),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  centralPool.on('error', (err) => {
    console.error('[CENTRAL DB] Pool error:', err);
  });

  return centralPool;
}
