import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type pg from 'pg';

export function resolveAppMigrationsDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'dist', 'migrations'),
    path.resolve(process.cwd(), 'migrations'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return null;
}

/** Run drizzle-kit push with a hard timeout so Railway bootstrap cannot hang forever. */
export function runDrizzlePushWithTimeout(timeoutMs = 240_000): boolean {
  console.log(`[INIT] Running drizzle-kit push (timeout ${timeoutMs}ms)...`);

  const result = spawnSync('npx', ['drizzle-kit', 'push', '--force'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: {
      ...process.env,
      NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? '0',
    },
    cwd: process.cwd(),
    timeout: timeoutMs,
    // drizzle-kit prompts on constraint changes; pipe Enter to accept the default option.
    input: Buffer.from('\n'.repeat(8)),
  });

  if (result.error) {
    console.error('[INIT] drizzle-kit push error:', result.error.message);
    return false;
  }

  if (result.signal === 'SIGTERM') {
    console.error('[INIT] drizzle-kit push timed out');
    return false;
  }

  if (result.status !== 0) {
    console.error('[INIT] drizzle-kit push exited with code', result.status);
    return false;
  }

  return true;
}

async function ensureSchemaMigrationsTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function isBenignMigrationError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const msg = err?.message || String(error);
  return (
    err?.code === '42P07' ||
    err?.code === '42710' ||
    err?.code === '42P01' ||
    msg.includes('already exists') ||
    msg.includes('duplicate')
  );
}

/** Apply tracked SQL migrations after drizzle push (idempotent ALTERs). */
export async function runPendingAppMigrations(pool: pg.Pool): Promise<void> {
  const migrationsDir = resolveAppMigrationsDir();
  if (!migrationsDir) {
    console.warn('[INIT] No app migrations directory found');
    return;
  }

  await ensureSchemaMigrationsTable(pool);

  const executed = await pool
    .query<{ filename: string }>('SELECT filename FROM schema_migrations')
    .then((result) => new Set(result.rows.map((row) => row.filename)));

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (executed.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8').trim();
    if (!sql) {
      continue;
    }

    try {
      console.log('[INIT] Applying SQL migration:', file);
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [
        file,
      ]);
    } catch (error) {
      if (isBenignMigrationError(error)) {
        await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [
          file,
        ]);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[INIT] SQL migration skipped:', file, message);
    }
  }
}

function resolveCoreSchemaSqlPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'dist', 'sql', 'core_app_schema.sql'),
    path.resolve(process.cwd(), 'server', 'sql', 'core_app_schema.sql'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Non-interactive fallback when drizzle-kit push cannot complete on production Postgres. */
export async function applyCoreAppSchema(pool: pg.Pool): Promise<void> {
  const sqlPath = resolveCoreSchemaSqlPath();
  if (!sqlPath) {
    console.warn('[INIT] core_app_schema.sql not found');
    return;
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log('[INIT] Applying core app schema SQL fallback from', sqlPath);
  await pool.query(sql);
}
