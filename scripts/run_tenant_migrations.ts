import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';

const { Pool } = pg;

function getSslConfig(connectionString: string): pg.PoolConfig['ssl'] {
  const needsSsl = /sslmode=require/.test(connectionString) || /railway\.app|\.proxy\.rlwy\.net|\.rlwy\.net/i.test(connectionString) || process.env.NODE_ENV === 'production';
  if (!needsSsl) return undefined;

  const allowSelfSigned = process.env.TENANT_DB_SSL_ALLOW_SELF_SIGNED === '1' || /railway\.app|\.proxy\.rlwy\.net|\.rlwy\.net/i.test(connectionString);
  if (allowSelfSigned) {
    return {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    } as any;
  }

  return { rejectUnauthorized: true } as any;
}

async function main() {
  const connectionString = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('TENANT_DATABASE_URL (or DATABASE_URL) must be set to run tenant migrations.');
  }

  const migrationsDir = path.resolve(process.cwd(), 'saas', 'migrations', 'tenant');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Tenant migrations directory not found at ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[Tenant Migrations] No migration files found.');
    return;
  }

  const config = parseConnectionString(connectionString);
  config.ssl = getSslConfig(connectionString);

  const pool = new Pool(config as pg.PoolConfig);

  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf-8').trim();
      if (!sql) continue;

      console.log(`[Tenant Migrations] Running ${file}...`);
      await pool.query(sql);
    }

    console.log('[Tenant Migrations] Completed successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Tenant Migrations] Failed:', err);
  process.exit(1);
});
