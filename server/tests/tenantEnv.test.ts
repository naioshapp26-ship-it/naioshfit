import { afterEach, describe, expect, it } from 'vitest';
import {
  applyTenantEnvDefaults,
  deriveEncryptionKeyFromSessionSecret,
  resolveTenantEncryptionKey,
} from '../saas/tenantEnv';

describe('tenantEnv encryption auto-config', () => {
  const keys = [
    'TENANT_DB_ENCRYPTION_KEY',
    'TENANT_DATABASE_URL_TEMPLATE',
    'SESSION_SECRET',
    'DATABASE_URL',
    'SAAS_AUTO_TENANT_ENV',
    'NODE_ENV',
  ] as const;
  const snapshot: Record<string, string | undefined> = {};

  for (const key of keys) snapshot[key] = process.env[key];

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key]!;
    }
  });

  it('derives encryption key from SESSION_SECRET when missing', () => {
    delete process.env.TENANT_DB_ENCRYPTION_KEY;
    process.env.SESSION_SECRET = 'a-very-long-session-secret-value';
    process.env.SAAS_AUTO_TENANT_ENV = '1';
    applyTenantEnvDefaults();
    expect(process.env.TENANT_DB_ENCRYPTION_KEY).toBeTruthy();
    expect(process.env.TENANT_DB_ENCRYPTION_KEY).toBe(deriveEncryptionKeyFromSessionSecret());
    expect(resolveTenantEncryptionKey()).toHaveLength(64);
  });

  it('keeps an explicitly configured encryption key', () => {
    process.env.TENANT_DB_ENCRYPTION_KEY = 'explicit-key-value';
    process.env.SESSION_SECRET = 'a-very-long-session-secret-value';
    applyTenantEnvDefaults();
    expect(resolveTenantEncryptionKey()).toBe('explicit-key-value');
  });
});
