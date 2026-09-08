import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPlatformAccessBlocked } from '../saas/platformControlService';
import { isTenantManagerRole, isPlatformAdminRole } from '../../shared/roleAccess';

describe('platform access blocking', () => {
  it('blocks suspended and disabled platforms', () => {
    expect(isPlatformAccessBlocked('suspended')).toBe(true);
    expect(isPlatformAccessBlocked('disabled')).toBe(true);
    expect(isPlatformAccessBlocked('deleted')).toBe(true);
  });

  it('allows active and pending_payment at the helper level', () => {
    expect(isPlatformAccessBlocked('active')).toBe(false);
    expect(isPlatformAccessBlocked('pending_payment')).toBe(false);
  });
});

describe('super admin role gates', () => {
  it('allows central admin and super_admin as tenant managers', () => {
    expect(isTenantManagerRole('super_admin')).toBe(true);
    expect(isTenantManagerRole('admin')).toBe(true);
    expect(isTenantManagerRole('user')).toBe(false);
  });

  it('platform admin includes tenant admin but not regular user', () => {
    expect(isPlatformAdminRole('admin')).toBe(true);
    expect(isPlatformAdminRole('super_admin')).toBe(true);
    expect(isPlatformAdminRole('coach')).toBe(false);
  });
});

describe('suspendPlatform validation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('requires a reason with at least 3 characters', async () => {
    vi.doMock('../saas/centralDb', () => ({
      getCentralPool: () => ({
        query: vi.fn(),
      }),
    }));
    vi.doMock('../saas/auditService', () => ({
      writeSaasAdminAuditLog: vi.fn(),
    }));

    const { suspendPlatform } = await import('../saas/platformControlService');
    await expect(
      suspendPlatform({ tenantId: 't1', reason: 'no' })
    ).rejects.toThrow(/reason/i);
  });
});
