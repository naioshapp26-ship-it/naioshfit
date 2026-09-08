import { describe, expect, it } from 'vitest';
import {
  isPlatformAdminRole,
  isSuperAdminRole,
  isTenantManagerRole,
} from '@shared/roleAccess';

describe('roleAccess', () => {
  it('treats admin and super_admin as platform admins', () => {
    expect(isPlatformAdminRole('admin')).toBe(true);
    expect(isPlatformAdminRole('super_admin')).toBe(true);
    expect(isPlatformAdminRole('coach')).toBe(false);
    expect(isPlatformAdminRole(undefined)).toBe(false);
  });

  it('allows central admin and super_admin for tenant/platform management', () => {
    expect(isTenantManagerRole('super_admin')).toBe(true);
    expect(isTenantManagerRole('admin')).toBe(true);
    expect(isTenantManagerRole('tenant_admin')).toBe(false);
    expect(isTenantManagerRole('coach')).toBe(false);
  });

  it('identifies super admin role correctly', () => {
    expect(isSuperAdminRole('super_admin')).toBe(true);
    expect(isSuperAdminRole('admin')).toBe(false);
    expect(isSuperAdminRole(null)).toBe(false);
  });
});
