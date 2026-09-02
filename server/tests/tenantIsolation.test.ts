import { afterEach, describe, expect, it } from 'vitest';
import { getTenantIsolationMode } from '../saas/tenantConnection';

describe('getTenantIsolationMode', () => {
  const original = process.env.SAAS_TENANT_ISOLATION;

  afterEach(() => {
    if (original === undefined) delete process.env.SAAS_TENANT_ISOLATION;
    else process.env.SAAS_TENANT_ISOLATION = original;
  });

  it('defaults to schema when unset', () => {
    delete process.env.SAAS_TENANT_ISOLATION;
    expect(getTenantIsolationMode()).toBe('schema');
  });

  it('accepts explicit database mode', () => {
    process.env.SAAS_TENANT_ISOLATION = 'database';
    expect(getTenantIsolationMode()).toBe('database');
  });

  it('treats other values as schema', () => {
    process.env.SAAS_TENANT_ISOLATION = 'schema';
    expect(getTenantIsolationMode()).toBe('schema');
  });
});
