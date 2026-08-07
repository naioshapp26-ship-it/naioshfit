import type { Express, Request, Response } from 'express';
import { fetchTenantDetails, fetchTenantList, fetchTenantPayments, refundTenantPayment, updateTenantDetails } from './adminService';
import { provisionTenant, getProvisioningStatus, dropTenantDatabase, runTenantMigrations } from './provisioningService';
import { getCentralPool } from './centralDb';
import { decryptTenantDatabaseUrl } from './dbManager';
import type { TenantRecord } from './types';
import { isValidSubdomain, normalizeSubdomain } from './validation';
import { isTenantManagerRole } from '@shared/roleAccess';

const ADMIN_TOKEN = process.env.SAAS_ADMIN_TOKEN;
const UNIQUE_VIOLATION_CODE = '23505';

function resolveAdminUser(req: Request): { id?: string | number; username?: string; role?: string } | null {
  const user = req.user as any;
  if (user) return user;
  const sessionUser = (req.session as any)?.user;
  if (sessionUser) return sessionUser;
  return null;
}

function requireSuperAdmin(req: Request, res: Response): boolean {
  if ((req as any).tenant || (req as any).tenantPool) {
    res.status(403).json({ message: 'Tenant context not allowed for SaaS admin.' });
    return false;
  }

  const user = resolveAdminUser(req);
  console.log('[SAAS ADMIN] Auth check - user:', user ? { id: user.id, username: user.username, role: user.role } : 'none');
  console.log('[SAAS ADMIN] Admin token present:', !!ADMIN_TOKEN);
  console.log('[SAAS ADMIN] Request header token:', req.headers['x-saas-admin-token']);

  if (isTenantManagerRole(user?.role)) {
    console.log('[SAAS ADMIN] Access granted via user role');
    return true;
  }

  if (ADMIN_TOKEN && req.headers['x-saas-admin-token'] === ADMIN_TOKEN) {
    console.log('[SAAS ADMIN] Access granted via admin token');
    return true;
  }

  console.log('[SAAS ADMIN] Access denied');
  res.status(user ? 403 : 401).json({ message: 'Super admin access required.' });
  return false;
}

export function registerSaasAdminRoutes(app: Express) {
  app.get('/api/admin/saas/tenants', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      console.log('[SAAS ADMIN] Fetching tenant list with filters:', req.query);
      const { search, status, limit, offset } = req.query;
      const result = await fetchTenantList({
        search: typeof search === 'string' ? search : undefined,
        status: typeof status === 'string' ? status : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
      console.log('[SAAS ADMIN] Found tenants:', result.tenants.length, 'Total:', result.total);
      res.json(result);
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to list tenants:', error);
      res.status(500).json({ message: 'Failed to list tenants.', error: error.message });
    }
  });

  app.get('/api/admin/saas/tenants/:tenantId', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      const tenant = await fetchTenantDetails(req.params.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }
      res.json({ tenant });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to fetch tenant details:', error);
      res.status(500).json({ message: 'Failed to fetch tenant details.' });
    }
  });

  app.get('/api/admin/saas/tenants/:tenantId/payments', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      const { limit, offset } = req.query;
      const result = await fetchTenantPayments(
        req.params.tenantId,
        limit ? Number(limit) : undefined,
        offset ? Number(offset) : undefined
      );
      res.json(result);
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to fetch tenant payments:', error);
      res.status(500).json({ message: 'Failed to fetch tenant payments.' });
    }
  });

  app.post('/api/admin/saas/tenants/:tenantId/payments/:paymentId/refund', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      const payment = await refundTenantPayment(req.params.tenantId, req.params.paymentId);
      res.json({ payment });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to refund payment:', error);
      const message = error?.message || 'Failed to refund payment.';
      if (message.toLowerCase().includes('not found')) {
        return res.status(404).json({ message });
      }
      res.status(400).json({ message });
    }
  });

  app.post('/api/admin/saas/tenants', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { subdomain, companyName, adminEmail, adminName, adminPhone, adminPassword, subscriptionPlan } = req.body || {};
    if (!subdomain || !companyName || !adminEmail || !adminName || !adminPhone || !adminPassword) {
      return res.status(400).json({ message: 'Missing tenant fields.' });
    }

    const normalizedSubdomain = normalizeSubdomain(subdomain);
    if (!normalizedSubdomain || !isValidSubdomain(normalizedSubdomain)) {
      return res.status(400).json({ message: 'Invalid tenant subdomain.' });
    }

    try {
      const tenant = await provisionTenant({
        subdomain: normalizedSubdomain,
        companyName,
        adminEmail,
        adminName,
        adminPhone,
        adminPassword,
        subscriptionPlan,
      });
      const logs = await getProvisioningStatus(tenant.id);
      res.status(201).json({ tenant, logs });
    } catch (error: any) {
      console.error('[SAAS] Failed to create tenant:', error);
      if (error?.code === UNIQUE_VIOLATION_CODE) {
        return res.status(409).json({ message: 'Tenant subdomain already exists.' });
      }
      res.status(500).json({ message: 'Failed to create tenant.' });
    }
  });

  app.patch('/api/admin/saas/tenants/:tenantId/status', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    try {
      const pool = getCentralPool();
      const result = await pool.query<TenantRecord>(
        'UPDATE tenants SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.tenantId]
      );
      const tenant = result.rows[0];
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }
      res.json({ tenant });
    } catch (error: any) {
      console.error('[SAAS] Failed to update tenant status:', error);
      res.status(500).json({ message: 'Failed to update tenant status.' });
    }
  });

  app.patch('/api/admin/saas/tenants/:tenantId', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { companyName, subscriptionPlan, status } = req.body || {};
    if (!companyName && subscriptionPlan === undefined && !status) {
      return res.status(400).json({ message: 'No fields provided to update.' });
    }

    try {
      const updated = await updateTenantDetails(req.params.tenantId, {
        companyName: companyName ? String(companyName) : undefined,
        subscriptionPlan: subscriptionPlan === '' ? null : subscriptionPlan,
        status: status ? String(status) : undefined,
      });

      if (!updated) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }

      res.json({ tenant: updated });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to update tenant:', error);
      res.status(500).json({ message: 'Failed to update tenant.' });
    }
  });

  app.delete('/api/admin/saas/tenants/:tenantId', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      const pool = getCentralPool();
      const existing = await pool.query<TenantRecord>(
        'SELECT * FROM tenants WHERE id = $1',
        [req.params.tenantId]
      );
      const tenant = existing.rows[0];
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }

      await pool.query('DELETE FROM tenants WHERE id = $1', [req.params.tenantId]);

      if (tenant.database_name) {
        try {
          await dropTenantDatabase(tenant.database_name);
        } catch (dropError: any) {
          console.error('[SAAS ADMIN] Failed to drop tenant database:', dropError);
          return res.status(200).json({ deleted: true, databaseDropped: false, message: 'Tenant deleted, but database could not be dropped.' });
        }
      }

      res.json({ deleted: true, databaseDropped: Boolean(tenant.database_name) });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to delete tenant:', error);
      res.status(500).json({ message: 'Failed to delete tenant.' });
    }
  });

  app.get('/api/admin/saas/tenants/:tenantId/provisioning-logs', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      const logs = await getProvisioningStatus(req.params.tenantId);
      res.json({ logs });
    } catch (error: any) {
      console.error('[SAAS] Failed to fetch provisioning logs:', error);
      res.status(500).json({ message: 'Failed to fetch provisioning logs.' });
    }
  });

  app.post('/api/admin/saas/tenants/:tenantId/run-migrations', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      console.log('[SAAS ADMIN] Running migrations for tenant:', req.params.tenantId);
      const pool = getCentralPool();
      const result = await pool.query<TenantRecord>(
        'SELECT * FROM tenants WHERE id = $1',
        [req.params.tenantId]
      );
      const tenant = result.rows[0];
      
      if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }

      if (!tenant.database_url_encrypted) {
        return res.status(400).json({ message: 'Tenant database URL not found.' });
      }

      const databaseUrl = await decryptTenantDatabaseUrl(tenant.database_url_encrypted);
      await runTenantMigrations(databaseUrl);
      
      res.json({ success: true, message: 'Migrations completed successfully.' });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to run migrations:', error);
      res.status(500).json({ message: 'Failed to run migrations.', error: error.message });
    }
  });

  app.post('/api/admin/saas/tenants/run-all-migrations', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      console.log('[SAAS ADMIN] Running migrations for all tenants');
      const pool = getCentralPool();
      const result = await pool.query<TenantRecord>('SELECT * FROM tenants WHERE status != $1', ['deleted']);
      const tenants = result.rows;

      const results: Array<{ tenantId: string; subdomain: string; status: string; error?: string }> = [];

      for (const tenant of tenants) {
        try {
          const databaseUrl = await decryptTenantDatabaseUrl(tenant.database_url_encrypted);
          await runTenantMigrations(databaseUrl);
          results.push({ tenantId: tenant.id, subdomain: tenant.subdomain, status: 'success' });
          console.log('[SAAS ADMIN] Migrations completed for tenant:', tenant.subdomain);
        } catch (err: any) {
          results.push({ tenantId: tenant.id, subdomain: tenant.subdomain, status: 'failed', error: err.message });
          console.error('[SAAS ADMIN] Migrations failed for tenant:', tenant.subdomain, err);
        }
      }

      const failed = results.filter((r) => r.status === 'failed');
      res.json({
        success: failed.length === 0,
        message: `Migrations completed: ${results.length - failed.length}/${results.length} tenants succeeded.`,
        results,
      });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to run all-tenant migrations:', error);
      res.status(500).json({ message: 'Failed to run migrations.', error: error.message });
    }
  });
}
