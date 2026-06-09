import { getCentralPool } from './centralDb';

export type AuditLogInput = {
  tenantId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const pool = getCentralPool();
    await pool.query(
      `INSERT INTO saas_audit_logs
        (tenant_id, actor_email, actor_role, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.tenantId ?? null,
        input.actorEmail ?? null,
        input.actorRole ?? null,
        input.action,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.ipAddress ?? null,
        input.userAgent ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch (error) {
    console.error('[AUDIT] Failed to write audit log:', error);
  }
}

export async function listAuditLogs(options: { tenantId?: string; limit?: number } = {}) {
  const pool = getCentralPool();
  const limit = Math.min(options.limit ?? 50, 200);

  if (options.tenantId) {
    const { rows } = await pool.query(
      `SELECT * FROM saas_audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [options.tenantId, limit],
    );
    return rows;
  }

  const { rows } = await pool.query(
    `SELECT * FROM saas_audit_logs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}
