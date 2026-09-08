import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const writeSaasAdminAuditLog = vi.fn();

vi.mock('../saas/centralDb', () => ({
  getCentralPool: () => ({ query }),
}));

vi.mock('../saas/auditService', () => ({
  writeSaasAdminAuditLog,
}));

describe('suspendPlatform happy path', () => {
  beforeEach(() => {
    query.mockReset();
    writeSaasAdminAuditLog.mockReset();
  });

  it('updates status, stores reason, and writes audit log', async () => {
    const existing = {
      id: '11111111-1111-1111-1111-111111111111',
      subdomain: 'acme',
      company_name: 'Acme',
      status: 'active',
    };
    const updated = {
      ...existing,
      status: 'suspended',
      suspended_at: new Date('2026-09-08T00:00:00Z'),
      suspension_reason: 'Contract dispute',
    };

    query
      .mockResolvedValueOnce({ rows: [existing] })
      .mockResolvedValueOnce({ rows: [updated] });
    writeSaasAdminAuditLog.mockResolvedValue({ id: 'audit-1' });

    const { suspendPlatform } = await import('../saas/platformControlService');
    const result = await suspendPlatform({
      tenantId: existing.id,
      reason: 'Contract dispute',
      internalNotes: 'Owner contacted',
      actor: { id: 9, username: 'root', role: 'super_admin' },
    });

    expect(result.status).toBe('suspended');
    expect(query).toHaveBeenCalledTimes(2);
    expect(writeSaasAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform.suspended',
        entityType: 'platform',
        entityId: existing.id,
        reason: 'Contract dispute',
        internalNotes: 'Owner contacted',
      })
    );
  });

  it('reactivates a suspended platform back to active', async () => {
    const existing = {
      id: '22222222-2222-2222-2222-222222222222',
      subdomain: 'beta',
      company_name: 'Beta',
      status: 'suspended',
      previous_status: 'active',
    };
    const updated = { ...existing, status: 'active', suspended_at: null, suspension_reason: null };

    query
      .mockResolvedValueOnce({ rows: [existing] })
      .mockResolvedValueOnce({ rows: [updated] });
    writeSaasAdminAuditLog.mockResolvedValue({ id: 'audit-2' });

    const { reactivatePlatform } = await import('../saas/platformControlService');
    const result = await reactivatePlatform({
      tenantId: existing.id,
      actor: { id: 9, username: 'root', role: 'super_admin' },
    });

    expect(result.status).toBe('active');
    expect(writeSaasAdminAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform.reactivated' })
    );
  });
});
