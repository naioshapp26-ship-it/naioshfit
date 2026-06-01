import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';

const { Pool } = pg;

export type TenantIsolationMode = 'database' | 'schema';

export function getTenantIsolationMode(): TenantIsolationMode {
  const raw = (process.env.SAAS_TENANT_ISOLATION || '').trim().toLowerCase();
  return raw === 'schema' ? 'schema' : 'database';
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

function getSslConfig(connectionString: string): pg.PoolConfig['ssl'] {
  const needsSsl =
    /sslmode=require/.test(connectionString) ||
    /railway\.app|\.proxy\.rlwy\.net|\.rlwy\.net/i.test(connectionString);
  if (!needsSsl) {
    return undefined;
  }

  const allowSelfSigned =
    /railway\.app|\.proxy\.rlwy\.net|\.rlwy\.net/i.test(connectionString) ||
    process.env.TENANT_DB_SSL_ALLOW_SELF_SIGNED === '1' ||
    process.env.CENTRAL_DB_SSL_ALLOW_SELF_SIGNED === '1' ||
    process.env.DB_SSL_ALLOW_SELF_SIGNED === '1';

  if (allowSelfSigned) {
    return {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
    };
  }

  return { rejectUnauthorized: true };
}

export function createTenantPool(databaseUrl: string): pg.Pool {
  const { connectionString, schema } = parseTenantConnection(databaseUrl);
  const config = parseConnectionString(connectionString);
  config.ssl = getSslConfig(connectionString);

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
