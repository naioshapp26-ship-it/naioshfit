import { getCentralPool } from './centralDb';
import type { SaasRbacRole } from '@shared/enterpriseSaas';

export async function userHasPermission(
  roleKey: SaasRbacRole | string,
  permissionKey: string,
): Promise<boolean> {
  const pool = getCentralPool();
  const { rows } = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM saas_roles r
      JOIN saas_role_permissions rp ON rp.role_id = r.id
      JOIN saas_permissions p ON p.id = rp.permission_id
      WHERE r.key = $1 AND p.key = $2
    ) AS allowed`,
    [roleKey, permissionKey],
  );
  return Boolean(rows[0]?.allowed);
}

export async function getRolePermissions(roleKey: string): Promise<string[]> {
  const pool = getCentralPool();
  const { rows } = await pool.query<{ key: string }>(
    `SELECT p.key FROM saas_roles r
     JOIN saas_role_permissions rp ON rp.role_id = r.id
     JOIN saas_permissions p ON p.id = rp.permission_id
     WHERE r.key = $1`,
    [roleKey],
  );
  return rows.map((r) => r.key);
}

export function requirePermission(permissionKey: string) {
  return async (req: any, res: any, next: any) => {
    const role = req.user?.role ?? 'customer';
    if (role === 'super_admin') return next();

    try {
      const allowed = await userHasPermission(role, permissionKey);
      if (!allowed) {
        return res.status(403).json({ message: 'Insufficient permissions.' });
      }
      return next();
    } catch (error) {
      console.error('[RBAC] Permission check failed:', error);
      return res.status(500).json({ message: 'Permission check failed.' });
    }
  };
}
