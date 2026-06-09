import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import { normalizePostgresConnection } from '@shared/dbUrl';

const { Pool } = pg;

export type TenantIsolationMode = 'database' | 'schema';

function isRailwayHosted(): boolean {
  return Boolean(
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_SERVICE_ID ||
    process.env.RAILWAY_PROJECT_ID,
  );
}

function isRailwayDatabaseUrl(url: string): boolean {
  return /\.railway\.internal|\.proxy\.rlwy\.net|\.rlwy\.net|railway\.app/i.test(url);
}

export function getTenantIsolationMode(): TenantIsolationMode {
  const raw = (process.env.SAAS_TENANT_ISOLATION || '').trim().toLowerCase();
  if (raw === 'schema') return 'schema';
  if (raw === 'database') return 'database';

  // Railway Postgres: schema-per-tenant on the shared DB (avoids SSL issues with tenant_* databases)
  if (isRailwayHosted()) {
    return 'schema';
  }

  const base = process.env.DATABASE_URL || process.env.CENTRAL_DATABASE_URL || '';
  if (isRailwayDatabaseUrl(base)) {
    return 'schema';
  }

  return 'database';
}

export function parseTenantConnection(databaseUrl: string): {
  connectionString: string;
  schema?: string;
} {
  try {
    const url = new URL(databaseUrl);
    const schema = url.searchParams.get('tenant_schema') || undefined;
    url.searchParams.delete('tenant_schema');
    return { connectionString: url.toString(), schema };
  } catch {
    return { connectionString: databaseUrl };
  }
}

export function renderTenantDatabaseUrl(databaseName: string): string {
  const mode = getTenantIsolationMode();
  if (mode === 'schema') {
    const baseUrl =
      process.env.DATABASE_URL ||
      process.env.CENTRAL_DATABASE_URL ||
      process.env.PROVISIONING_ADMIN_DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL is required for schema-based tenant isolation.');
    }
    const url = new URL(baseUrl);
    url.searchParams.set('tenant_schema', databaseName);
    return url.toString();
  }

  const template = process.env.TENANT_DATABASE_URL_TEMPLATE;
  if (!template) {
    throw new Error('TENANT_DATABASE_URL_TEMPLATE must be set for database tenant isolation.');
  }
  return template.replace('{db}', databaseName);
}

export function createTenantPool(databaseUrl: string): pg.Pool {
  const { connectionString: rawConnection, schema } = parseTenantConnection(databaseUrl);
  const { connectionString, ssl } = normalizePostgresConnection(rawConnection);
  const config = parseConnectionString(connectionString) as pg.PoolConfig & { sslmode?: string };
  delete config.sslmode;

  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: ssl ?? false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ...(schema ? { options: `-c search_path=${schema},public` } : {}),
  });

  if (schema) {
    pool.on('connect', (client) => {
      void client.query(`SET search_path TO "${schema}", public`);
    });
  }

  return pool;
}
