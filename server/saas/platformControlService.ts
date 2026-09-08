import { getCentralPool } from './centralDb';
import type { TenantRecord } from './types';
import { writeSaasAdminAuditLog, type SaasAuditActor } from './auditService';

export const PLATFORM_STATUSES = ['active', 'suspended', 'disabled', 'deleted', 'pending_payment'] as const;
export type PlatformStatus = (typeof PLATFORM_STATUSES)[number];

const BLOCKED_STATUSES = new Set(['suspended', 'disabled', 'deleted']);

export function isPlatformAccessBlocked(status: string | null | undefined): boolean {
  return BLOCKED_STATUSES.has(String(status || '').toLowerCase());
}

export interface PlatformLifecycleInput {
  tenantId: string;
  reason: string;
  internalNotes?: string | null;
  actor?: SaasAuditActor | null;
}

function requireReason(reason: string | undefined | null): string {
  const trimmed = String(reason || '').trim();
  if (trimmed.length < 3) {
    throw new Error('A suspension/disable reason of at least 3 characters is required.');
  }
  return trimmed;
}

async function loadTenant(tenantId: string): Promise<TenantRecord | null> {
  const pool = getCentralPool();
  const result = await pool.query<TenantRecord>('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
  return result.rows[0] ?? null;
}

export async function suspendPlatform(input: PlatformLifecycleInput): Promise<TenantRecord> {
  const reason = requireReason(input.reason);
  const pool = getCentralPool();
  const existing = await loadTenant(input.tenantId);
  if (!existing) {
    throw new Error('Tenant not found.');
  }
  if (existing.status === 'deleted') {
    throw new Error('Deleted platforms cannot be suspended.');
  }
  if (existing.status === 'suspended') {
    return existing;
  }

  const result = await pool.query<TenantRecord>(
    `UPDATE tenants SET
       previous_status = status,
       status = 'suspended',
       suspended_at = NOW(),
       suspended_by = $2,
       suspension_reason = $3,
       admin_notes = COALESCE($4, admin_notes),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      input.tenantId,
      input.actor?.id != null ? String(input.actor.id) : (input.actor?.username || input.actor?.email || 'system'),
      reason,
      input.internalNotes?.trim() || null,
    ]
  );
  const updated = result.rows[0];

  await writeSaasAdminAuditLog({
    action: 'platform.suspended',
    entityType: 'platform',
    entityId: updated.id,
    entityName: updated.company_name || updated.subdomain,
    actor: input.actor,
    previousState: { status: existing.status },
    newState: { status: updated.status, suspended_at: updated.suspended_at },
    reason,
    internalNotes: input.internalNotes,
    metadata: { subdomain: updated.subdomain },
  });

  return updated;
}

export async function reactivatePlatform(input: {
  tenantId: string;
  reason?: string | null;
  internalNotes?: string | null;
  actor?: SaasAuditActor | null;
}): Promise<TenantRecord> {
  const pool = getCentralPool();
  const existing = await loadTenant(input.tenantId);
  if (!existing) {
    throw new Error('Tenant not found.');
  }
  if (existing.status === 'deleted') {
    throw new Error('Deleted platforms cannot be reactivated.');
  }
  if (existing.status === 'active') {
    return existing;
  }

  const nextStatus =
    existing.previous_status && existing.previous_status !== 'suspended' && existing.previous_status !== 'disabled'
      ? existing.previous_status
      : 'active';

  const result = await pool.query<TenantRecord>(
    `UPDATE tenants SET
       status = $2,
       previous_status = status,
       suspended_at = NULL,
       suspended_by = NULL,
       suspension_reason = NULL,
       disabled_at = NULL,
       disabled_by = NULL,
       admin_notes = COALESCE($3, admin_notes),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [input.tenantId, nextStatus === 'pending_payment' ? 'active' : 'active', input.internalNotes?.trim() || null]
  );
  const updated = result.rows[0];

  await writeSaasAdminAuditLog({
    action: 'platform.reactivated',
    entityType: 'platform',
    entityId: updated.id,
    entityName: updated.company_name || updated.subdomain,
    actor: input.actor,
    previousState: { status: existing.status },
    newState: { status: updated.status },
    reason: input.reason?.trim() || null,
    internalNotes: input.internalNotes,
    metadata: { subdomain: updated.subdomain },
  });

  return updated;
}

export async function disablePlatform(input: PlatformLifecycleInput): Promise<TenantRecord> {
  const reason = requireReason(input.reason);
  const pool = getCentralPool();
  const existing = await loadTenant(input.tenantId);
  if (!existing) {
    throw new Error('Tenant not found.');
  }
  if (existing.status === 'deleted') {
    throw new Error('Deleted platforms cannot be disabled.');
  }
  if (existing.status === 'disabled') {
    return existing;
  }

  const result = await pool.query<TenantRecord>(
    `UPDATE tenants SET
       previous_status = status,
       status = 'disabled',
       disabled_at = NOW(),
       disabled_by = $2,
       suspension_reason = $3,
       admin_notes = COALESCE($4, admin_notes),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      input.tenantId,
      input.actor?.id != null ? String(input.actor.id) : (input.actor?.username || input.actor?.email || 'system'),
      reason,
      input.internalNotes?.trim() || null,
    ]
  );
  const updated = result.rows[0];

  await writeSaasAdminAuditLog({
    action: 'platform.disabled',
    entityType: 'platform',
    entityId: updated.id,
    entityName: updated.company_name || updated.subdomain,
    actor: input.actor,
    previousState: { status: existing.status },
    newState: { status: updated.status, disabled_at: updated.disabled_at },
    reason,
    internalNotes: input.internalNotes,
    metadata: { subdomain: updated.subdomain },
  });

  return updated;
}

export async function fetchSuperAdminDashboard() {
  const pool = getCentralPool();
  const [statusCounts, adminCount, recentPlatforms, recentAudits] = await Promise.all([
    pool.query<{ status: string; count: number }>(
      `SELECT status, COUNT(*)::int AS count
       FROM tenants
       GROUP BY status`
    ),
    pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM tenant_admins`),
    pool.query(
      `SELECT id, subdomain, company_name, status, subscription_plan, product_type, created_at, updated_at
       FROM tenants
       WHERE status <> 'deleted'
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 8`
    ),
    pool.query(
      `SELECT id, action, entity_type, entity_id, entity_name, actor_name, reason, created_at
       FROM saas_admin_audit_logs
       ORDER BY created_at DESC
       LIMIT 12`
    ).catch(() => ({ rows: [] })),
  ]);

  const byStatus = Object.fromEntries(statusCounts.rows.map((row) => [row.status, row.count]));
  const totalPlatforms = statusCounts.rows.reduce((sum, row) => sum + row.count, 0);

  return {
    totals: {
      platforms: totalPlatforms,
      activePlatforms: byStatus.active || 0,
      suspendedPlatforms: byStatus.suspended || 0,
      disabledPlatforms: byStatus.disabled || 0,
      deletedPlatforms: byStatus.deleted || 0,
      pendingPaymentPlatforms: byStatus.pending_payment || 0,
      tenantAdmins: adminCount.rows[0]?.total ?? 0,
      incubators: 0,
      branches: 0,
      offices: 0,
      freelancers: 0,
      visitors: 0,
      supervisoryAuthorities: 0,
    },
    unsupportedEntities: [
      'incubators',
      'branches',
      'offices',
      'freelancers',
      'visitors_global',
      'supervisory_authorities',
    ],
    recentPlatforms: recentPlatforms.rows,
    recentActions: recentAudits.rows,
  };
}

export async function listPlatformAdmins(filters: {
  search?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}) {
  const pool = getCentralPool();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    const idx = values.length;
    where.push(
      `(LOWER(ta.email) LIKE $${idx}
        OR LOWER(COALESCE(t.company_name, '')) LIKE $${idx}
        OR LOWER(COALESCE(t.subdomain, '')) LIKE $${idx})`
    );
  }
  if (filters.tenantId) {
    values.push(filters.tenantId);
    where.push(`ta.tenant_id = $${values.length}`);
  }

  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  values.push(limit, offset);
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ta.id,
              ta.tenant_id,
              ta.email,
              ta.created_at,
              t.subdomain,
              t.company_name,
              t.status AS platform_status,
              t.product_type
       FROM tenant_admins ta
       LEFT JOIN tenants t ON t.id = ta.tenant_id
       ${whereClause}
       ORDER BY ta.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    ),
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM tenant_admins ta
       LEFT JOIN tenants t ON t.id = ta.tenant_id
       ${whereClause}`,
      values.slice(0, values.length - 2)
    ),
  ]);

  return {
    users: dataResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    limit,
    offset,
  };
}
