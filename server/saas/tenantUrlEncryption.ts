import { decryptKey, encryptKey, isEncrypted } from '../payment/encryption';
import { applyTenantEnvDefaults } from './tenantEnv';

function requireTenantEncryptionKey(): string {
  applyTenantEnvDefaults();
  const key = process.env.TENANT_DB_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('TENANT_DB_ENCRYPTION_KEY must be set for multi-tenant mode.');
  }
  return key;
}

export function encryptTenantDatabaseUrl(databaseUrl: string): Buffer {
  requireTenantEncryptionKey();
  const encrypted = encryptKey(databaseUrl);
  return Buffer.from(encrypted, 'utf8');
}

export async function decryptTenantDatabaseUrl(encrypted: Buffer): Promise<string> {
  requireTenantEncryptionKey();

  const encoded = encrypted.toString('utf8');
  if (isEncrypted(encoded)) {
    return decryptKey(encoded);
  }

  throw new Error(
    'Tenant database URL uses an unsupported legacy encryption format. Re-provision the tenant or update database_url_encrypted.'
  );
}
