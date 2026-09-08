import { getCentralPool } from './centralDb';

export interface SaasAuditActor {
  id?: string | number | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface SaasAuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityName?: string | null;
  actor?: SaasAuditActor | null;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  internalNotes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SaasAuditLogRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  reason: string | null;
  internal_notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface SaasAuditListFilters {
  search?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function writeSaasAdminAuditLog(input: SaasAuditInput): Promise<SaasAuditLogRow> {
  const pool = getCentralPool();
  const actorName = input.actor?.username || input.actor?.email || null;
  const result = await pool.query<SaasAuditLogRow>(
    `INSERT INTO saas_admin_audit_logs (
      action, entity_type, entity_id, entity_name,
      actor_id, actor_name, actor_role,
      previous_state, new_state, reason, internal_notes, metadata
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8::jsonb, $9::jsonb, $10, $11, COALESCE($12::jsonb, '{}'::jsonb)
    )
    RETURNING *`,
    [
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.entityName ?? null,
      input.actor?.id != null ? String(input.actor.id) : null,
      actorName,
      input.actor?.role ?? null,
      input.previousState ? JSON.stringify(input.previousState) : null,
      input.newState ? JSON.stringify(input.newState) : null,
      input.reason ?? null,
      input.internalNotes ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
  return result.rows[0];
}

export async function listSaasAdminAuditLogs(filters: SaasAuditListFilters = {}) {
  const pool = getCentralPool();
  const values: Array<string | number> = [];
  const where: string[] = [];

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    const idx = values.length;
    where.push(
      `(LOWER(COALESCE(entity_name, '')) LIKE $${idx}
        OR LOWER(COALESCE(actor_name, '')) LIKE $${idx}
        OR LOWER(COALESCE(reason, '')) LIKE $${idx}
        OR LOWER(action) LIKE $${idx})`
    );
  }
  if (filters.action) {
    values.push(filters.action);
    where.push(`action = $${values.length}`);
  }
  if (filters.entityType) {
    values.push(filters.entityType);
    where.push(`entity_type = $${values.length}`);
  }
  if (filters.entityId) {
    values.push(filters.entityId);
    where.push(`entity_id = $${values.length}`);
  }
  if (filters.actorId) {
    values.push(filters.actorId);
    where.push(`actor_id = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    where.push(`created_at >= $${values.length}::timestamptz`);
  }
  if (filters.to) {
    values.push(filters.to);
    where.push(`created_at <= $${values.length}::timestamptz`);
  }

  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const offset = Math.max(filters.offset ?? 0, 0);
  values.push(limit, offset);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [dataResult, countResult] = await Promise.all([
    pool.query<SaasAuditLogRow>(
      `SELECT * FROM saas_admin_audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    ),
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM saas_admin_audit_logs ${whereClause}`,
      values.slice(0, values.length - 2)
    ),
  ]);

  return {
    logs: dataResult.rows,
    total: countResult.rows[0]?.total ?? 0,
    limit,
    offset,
  };
}
