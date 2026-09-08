import type { Express, Request, Response } from 'express';
import { fetchTenantDetails, fetchTenantList, fetchTenantPayments, refundTenantPayment, updateTenantDetails } from './adminService';
import { provisionTenant, getProvisioningStatus, dropTenantDatabase, runTenantMigrations } from './provisioningService';
import { getCentralPool } from './centralDb';
import { decryptTenantDatabaseUrl } from './dbManager';
import type { TenantRecord } from './types';
import { isValidSubdomain, normalizeSubdomain } from './validation';
import { isTenantManagerRole } from '@shared/roleAccess';
import { listSaasAdminAuditLogs, writeSaasAdminAuditLog } from './auditService';
import {
  disablePlatform,
  fetchSuperAdminDashboard,
  listPlatformAdmins,
  reactivatePlatform,
  suspendPlatform,
} from './platformControlService';

const ADMIN_TOKEN = process.env.SAAS_ADMIN_TOKEN;
const UNIQUE_VIOLATION_CODE = '23505';

function resolveAdminUser(req: Request): { id?: string | number; username?: string; email?: string; role?: string } | null {
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

  if (isTenantManagerRole(user?.role)) {
    return true;
  }

  if (ADMIN_TOKEN && req.headers['x-saas-admin-token'] === ADMIN_TOKEN) {
    return true;
  }

  res.status(user ? 403 : 401).json({ message: 'Super admin access required.' });
  return false;
}

function actorFromRequest(req: Request) {
  const user = resolveAdminUser(req);
  if (user) return user;
  if (ADMIN_TOKEN && req.headers['x-saas-admin-token'] === ADMIN_TOKEN) {
    return { id: 'token', username: 'saas-admin-token', role: 'super_admin' };
  }
  return null;
}

export function registerSaasAdminRoutes(app: Express) {
  app.get('/api/admin/saas/dashboard', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const dashboard = await fetchSuperAdminDashboard();
      res.json(dashboard);
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to load dashboard:', error);
      res.status(500).json({ message: 'Failed to load dashboard.', error: error.message });
    }
  });

  app.get('/api/admin/saas/audit-logs', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const result = await listSaasAdminAuditLogs({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        action: typeof req.query.action === 'string' ? req.query.action : undefined,
        entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
        entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
        actorId: typeof req.query.actorId === 'string' ? req.query.actorId : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to list audit logs:', error);
      res.status(500).json({ message: 'Failed to list audit logs.', error: error.message });
    }
  });

  app.get('/api/admin/saas/users', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const result = await listPlatformAdmins({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        tenantId: typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to list users:', error);
      res.status(500).json({ message: 'Failed to list users.', error: error.message });
    }
  });

  app.get('/api/admin/saas/tenants', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    try {
      const { search, status, productType, limit, offset } = req.query;
      const result = await fetchTenantList({
        search: typeof search === 'string' ? search : undefined,
        status: typeof status === 'string' ? status : undefined,
        productType: typeof productType === 'string' ? productType : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
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
      const [payments, logs, audits] = await Promise.all([
        fetchTenantPayments(req.params.tenantId, 10, 0).catch(() => ({ payments: [], total: 0 })),
        getProvisioningStatus(req.params.tenantId).catch(() => []),
        listSaasAdminAuditLogs({ entityType: 'platform', entityId: req.params.tenantId, limit: 20 }).catch(() => ({ logs: [], total: 0 })),
      ]);
      res.json({
        tenant,
        payments: payments.payments,
        provisioningLogs: logs,
        auditLogs: audits.logs,
        relatedEntities: {
          incubators: [],
          branches: [],
          offices: [],
          freelancers: [],
          visitors: [],
          supervisoryAuthorities: [],
          note: 'Organization hierarchy entities are not modeled in this codebase; platforms map to SaaS tenants.',
        },
      });
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

    const { subdomain, companyName, adminEmail, adminName, adminPhone, adminPassword, subscriptionPlan, productType } = req.body || {};
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

      if (productType) {
        const pool = getCentralPool();
        await pool.query('UPDATE tenants SET product_type = $1 WHERE id = $2', [String(productType), tenant.id]);
        (tenant as any).product_type = String(productType);
      }

      await writeSaasAdminAuditLog({
        action: 'platform.created',
        entityType: 'platform',
        entityId: tenant.id,
        entityName: tenant.company_name || tenant.subdomain,
        actor: actorFromRequest(req),
        newState: { status: tenant.status, subdomain: tenant.subdomain, product_type: productType || null },
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

  app.post('/api/admin/saas/tenants/:tenantId/suspend', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const tenant = await suspendPlatform({
        tenantId: req.params.tenantId,
        reason: req.body?.reason,
        internalNotes: req.body?.internalNotes,
        actor: actorFromRequest(req),
      });
      res.json({ tenant });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to suspend platform:', error);
      const message = error?.message || 'Failed to suspend platform.';
      if (message.includes('not found')) return res.status(404).json({ message });
      if (message.includes('required')) return res.status(400).json({ message });
      res.status(500).json({ message });
    }
  });

  app.post('/api/admin/saas/tenants/:tenantId/reactivate', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const tenant = await reactivatePlatform({
        tenantId: req.params.tenantId,
        reason: req.body?.reason,
        internalNotes: req.body?.internalNotes,
        actor: actorFromRequest(req),
      });
      res.json({ tenant });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to reactivate platform:', error);
      const message = error?.message || 'Failed to reactivate platform.';
      if (message.includes('not found')) return res.status(404).json({ message });
      res.status(500).json({ message });
    }
  });

  app.post('/api/admin/saas/tenants/:tenantId/disable', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const tenant = await disablePlatform({
        tenantId: req.params.tenantId,
        reason: req.body?.reason,
        internalNotes: req.body?.internalNotes,
        actor: actorFromRequest(req),
      });
      res.json({ tenant });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to disable platform:', error);
      const message = error?.message || 'Failed to disable platform.';
      if (message.includes('not found')) return res.status(404).json({ message });
      if (message.includes('required')) return res.status(400).json({ message });
      res.status(500).json({ message });
    }
  });

  app.patch('/api/admin/saas/tenants/:tenantId/status', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { status, reason, internalNotes } = req.body || {};
    if (!status) {
      return res.status(400).json({ message: 'Status is required.' });
    }

    try {
      const actor = actorFromRequest(req);
      let tenant: TenantRecord;
      if (status === 'suspended') {
        tenant = await suspendPlatform({
          tenantId: req.params.tenantId,
          reason: reason || 'Status updated to suspended',
          internalNotes,
          actor,
        });
      } else if (status === 'disabled') {
        tenant = await disablePlatform({
          tenantId: req.params.tenantId,
          reason: reason || 'Status updated to disabled',
          internalNotes,
          actor,
        });
      } else if (status === 'active') {
        tenant = await reactivatePlatform({
          tenantId: req.params.tenantId,
          reason,
          internalNotes,
          actor,
        });
      } else {
        const pool = getCentralPool();
        const existing = await pool.query<TenantRecord>('SELECT * FROM tenants WHERE id = $1', [req.params.tenantId]);
        if (!existing.rows[0]) {
          return res.status(404).json({ message: 'Tenant not found.' });
        }
        const result = await pool.query<TenantRecord>(
          'UPDATE tenants SET previous_status = status, status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [status, req.params.tenantId]
        );
        tenant = result.rows[0];
        await writeSaasAdminAuditLog({
          action: 'platform.status_changed',
          entityType: 'platform',
          entityId: tenant.id,
          entityName: tenant.company_name || tenant.subdomain,
          actor,
          previousState: { status: existing.rows[0].status },
          newState: { status: tenant.status },
          reason: reason || null,
          internalNotes: internalNotes || null,
        });
      }
      res.json({ tenant });
    } catch (error: any) {
      console.error('[SAAS] Failed to update tenant status:', error);
      const message = error?.message || 'Failed to update tenant status.';
      if (message.includes('required')) return res.status(400).json({ message });
      res.status(500).json({ message });
    }
  });

  app.patch('/api/admin/saas/tenants/:tenantId', async (req: Request, res: Response) => {
    if (!requireSuperAdmin(req, res)) return;

    const { companyName, subscriptionPlan, status, productType } = req.body || {};
    if (!companyName && subscriptionPlan === undefined && !status && productType === undefined) {
      return res.status(400).json({ message: 'No fields provided to update.' });
    }

    try {
      const pool = getCentralPool();
      const before = await pool.query<TenantRecord>('SELECT * FROM tenants WHERE id = $1', [req.params.tenantId]);
      if (!before.rows[0]) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }

      let updated = await updateTenantDetails(req.params.tenantId, {
        companyName: companyName ? String(companyName) : undefined,
        subscriptionPlan: subscriptionPlan === '' ? null : subscriptionPlan,
        status: status ? String(status) : undefined,
      });

      if (productType !== undefined) {
        const result = await pool.query<TenantRecord>(
          'UPDATE tenants SET product_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [productType ? String(productType) : null, req.params.tenantId]
        );
        updated = result.rows[0];
      }

      if (!updated) {
        return res.status(404).json({ message: 'Tenant not found.' });
      }

      await writeSaasAdminAuditLog({
        action: 'platform.updated',
        entityType: 'platform',
        entityId: updated.id,
        entityName: updated.company_name || updated.subdomain,
        actor: actorFromRequest(req),
        previousState: {
          company_name: before.rows[0].company_name,
          subscription_plan: before.rows[0].subscription_plan,
          status: before.rows[0].status,
          product_type: before.rows[0].product_type,
        },
        newState: {
          company_name: updated.company_name,
          subscription_plan: updated.subscription_plan,
          status: updated.status,
          product_type: updated.product_type,
        },
      });

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

      if (req.query.hardDelete === 'true' || req.body?.hardDelete === true) {
        await pool.query('DELETE FROM tenants WHERE id = $1', [req.params.tenantId]);
        let databaseDropped = false;
        if (tenant.database_name) {
          try {
            await dropTenantDatabase(tenant.database_name);
            databaseDropped = true;
          } catch (dropError: any) {
            console.error('[SAAS ADMIN] Failed to drop tenant database:', dropError);
          }
        }
        await writeSaasAdminAuditLog({
          action: 'platform.hard_deleted',
          entityType: 'platform',
          entityId: tenant.id,
          entityName: tenant.company_name || tenant.subdomain,
          actor: actorFromRequest(req),
          previousState: { status: tenant.status },
          newState: { deleted: true, databaseDropped },
        });
        return res.json({
          deleted: true,
          databaseDropped,
          message: databaseDropped ? undefined : 'Tenant deleted, but database could not be dropped.',
        });
      }

      const result = await pool.query<TenantRecord>(
        `UPDATE tenants SET previous_status = status, status = 'deleted', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [req.params.tenantId]
      );
      await writeSaasAdminAuditLog({
        action: 'platform.soft_deleted',
        entityType: 'platform',
        entityId: tenant.id,
        entityName: tenant.company_name || tenant.subdomain,
        actor: actorFromRequest(req),
        previousState: { status: tenant.status },
        newState: { status: 'deleted' },
        reason: req.body?.reason || null,
      });
      res.json({ tenant: result.rows[0], softDeleted: true });
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
      const pool = getCentralPool();
      const result = await pool.query<TenantRecord>('SELECT * FROM tenants WHERE status != $1', ['deleted']);
      const tenants = result.rows;

      const results: Array<{ tenantId: string; subdomain: string; status: string; error?: string }> = [];

      for (const tenant of tenants) {
        try {
          const databaseUrl = await decryptTenantDatabaseUrl(tenant.database_url_encrypted);
          await runTenantMigrations(databaseUrl);
          results.push({ tenantId: tenant.id, subdomain: tenant.subdomain, status: 'success' });
        } catch (err: any) {
          results.push({ tenantId: tenant.id, subdomain: tenant.subdomain, status: 'failed', error: err.message });
        }
      }

      const failed = results.filter((r) => r.status === 'failed');
      res.json({
        results,
        successCount: results.length - failed.length,
        failedCount: failed.length,
      });
    } catch (error: any) {
      console.error('[SAAS ADMIN] Failed to run all migrations:', error);
      res.status(500).json({ message: 'Failed to run migrations for all tenants.', error: error.message });
    }
  });
}
