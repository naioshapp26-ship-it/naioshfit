import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import { normalizePostgresConnection } from '@shared/dbUrl';

const { Pool } = pg;

export type TenantIsolationMode = 'database' | 'schema';

export function getTenantIsolationMode(): TenantIsolationMode {
  const raw = (process.env.SAAS_TENANT_ISOLATION || '').trim().toLowerCase();
  if (raw === 'schema') return 'schema';
  if (raw === 'database') return 'database';
  const base = process.env.DATABASE_URL || process.env.CENTRAL_DATABASE_URL || '';
  if (/\.railway\.internal/i.test(base)) {
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
  const config = parseConnectionString(connectionString);
  config.ssl = ssl;

  const pool = new Pool({
    ...config,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  } as pg.PoolConfig);

  if (schema) {
    pool.on('connect', (client) => {
      client.query(`SET search_path TO "${schema}", public`).catch((error) => {
        console.error('[SAAS] Failed to set tenant search_path:', schema, error);
      });
    });
  }

  return pool;
}
