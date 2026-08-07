import type { Request } from 'express';
import { getCentralPool } from './saas/centralDb';
import { getTenantPool } from './saas/dbManager';

export function normalizeMainDomainHost(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const urlCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const hostname = new URL(urlCandidate).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    const fallbackHost = trimmed
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .split(':')[0]
      .toLowerCase();
    if (!fallbackHost) return null;
    return fallbackHost.startsWith('www.') ? fallbackHost.slice(4) : fallbackHost;
  }
}

/** True when the request host is the main platform (www or apex), not a tenant subdomain. */
export function isMainPlatformHost(req: Pick<Request, 'headers'>): boolean {
  const host = req.headers.host?.split(':')[0].toLowerCase();
  const mainDomain = normalizeMainDomainHost(process.env.MAIN_DOMAIN);
  if (!host || !mainDomain) return true;
  return host === mainDomain || host === `www.${mainDomain}`;
}

/**
 * Resolve tenant DB pool for user/course data.
 * On the main platform host, always use central DB (ignore session tenantId).
 * On tenant subdomains, use req.tenantPool from middleware.
 */
export async function resolveTenantPoolFromRequest(req: any): Promise<any> {
  if (req.tenantPool) return req.tenantPool;

  if (isMainPlatformHost(req)) {
    return undefined;
  }

  const tenantId = req.user?.tenantId || req.session?.user?.tenantId;
  if (!tenantId) return undefined;

  try {
    const centralPool = getCentralPool();
    const result = await centralPool.query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
    const tenant = result.rows[0];
    if (!tenant) return undefined;

    const tenantPool = await getTenantPool(tenant);
    req.tenant = tenant;
    req.tenantPool = tenantPool;
    return tenantPool;
  } catch (error) {
    console.error('[TENANT] Failed to resolve tenant pool from session:', error);
    return undefined;
  }
}
