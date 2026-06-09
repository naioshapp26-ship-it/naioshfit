import crypto from 'crypto';
import { getTenantIsolationMode } from './tenantConnection';

const DEV_ENCRYPTION_KEY_FALLBACK = 'dev-tenant-encryption-key';

export function deriveTemplateFromDatabaseUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.pathname = '/{db}';
    if (/\.railway\.internal/i.test(url.hostname)) {
      url.searchParams.delete('sslmode');
      url.searchParams.delete('ssl');
      url.searchParams.delete('sslrootcert');
      url.searchParams.delete('sslcert');
      url.searchParams.delete('sslkey');
    }
    return url.toString().replace('%7Bdb%7D', '{db}');
  } catch {
    return null;
  }
}

export function deriveEncryptionKeyFromSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 16 || secret === 'change-me-to-a-long-random-string') {
    return null;
  }
  return crypto
    .createHash('sha256')
    .update(`naioshfit-tenant-encryption:v1:${secret}`)
    .digest('hex');
}

/** Fill missing tenant SaaS env vars from DATABASE_URL / SESSION_SECRET (Railway-friendly). */
export function applyTenantEnvDefaults(): void {
  if (process.env.SAAS_AUTO_TENANT_ENV === '0') {
    return;
  }

  if (!process.env.TENANT_DATABASE_URL_TEMPLATE?.trim()) {
    const derived = deriveTemplateFromDatabaseUrl(
      process.env.DATABASE_URL || process.env.CENTRAL_DATABASE_URL,
    );
    if (derived) {
      process.env.TENANT_DATABASE_URL_TEMPLATE = derived;
      console.log('[SAAS] Auto-configured TENANT_DATABASE_URL_TEMPLATE from DATABASE_URL');
    }
  }

  if (!process.env.TENANT_DB_ENCRYPTION_KEY?.trim()) {
    const derived = deriveEncryptionKeyFromSessionSecret();
    if (derived) {
      process.env.TENANT_DB_ENCRYPTION_KEY = derived;
      console.log('[SAAS] Auto-configured TENANT_DB_ENCRYPTION_KEY from SESSION_SECRET');
    }
  }
}

export function resolveTenantEncryptionKey(): string {
  applyTenantEnvDefaults();
  const key = process.env.TENANT_DB_ENCRYPTION_KEY?.trim();
  if (key) return key;

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SAAS] Using development tenant encryption key fallback.');
    return DEV_ENCRYPTION_KEY_FALLBACK;
  }

  throw new Error('TENANT_DB_ENCRYPTION_KEY must be set for multi-tenant provisioning.');
}

export function resolveTenantDatabaseTemplate(): string {
  applyTenantEnvDefaults();
  const template = process.env.TENANT_DATABASE_URL_TEMPLATE?.trim();
  if (template) return template;

  if (getTenantIsolationMode() === 'schema') {
    const base = process.env.DATABASE_URL || process.env.CENTRAL_DATABASE_URL;
    if (base) {
      return deriveTemplateFromDatabaseUrl(base) || base;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const fallback = deriveTemplateFromDatabaseUrl(
      process.env.CENTRAL_DATABASE_URL || process.env.DATABASE_URL,
    );
    if (fallback) return fallback;
  }

  throw new Error('TENANT_DATABASE_URL_TEMPLATE must be set for multi-tenant provisioning.');
}

export function getTenantProvisioningStatus(): { ready: boolean; missing: string[] } {
  applyTenantEnvDefaults();
  const missing: string[] = [];

  if (!process.env.TENANT_DB_ENCRYPTION_KEY?.trim()) {
    missing.push('TENANT_DB_ENCRYPTION_KEY');
  }

  const needsTemplate = getTenantIsolationMode() === 'database';
  if (needsTemplate && !process.env.TENANT_DATABASE_URL_TEMPLATE?.trim()) {
    missing.push('TENANT_DATABASE_URL_TEMPLATE');
  }

  if (!process.env.DATABASE_URL && !process.env.CENTRAL_DATABASE_URL) {
    missing.push('DATABASE_URL');
  }

  return { ready: missing.length === 0, missing };
}
