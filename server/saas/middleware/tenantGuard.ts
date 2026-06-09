import type { Request, Response, NextFunction } from 'express';
import { getCentralPool } from '../centralDb';
import { pool as appPool } from '../../db';
import { writeAuditLog } from '../auditLog';

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

export function createRateLimiter(options: { windowMs: number; max: number; keyPrefix?: string }) {
  const { windowMs, max, keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}:${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    return next();
  };
}

export function sanitizeInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 500);
}

export async function detectTenant(req: Request): Promise<{ tenantId: string | null; subdomain: string | null }> {
  const tenant = (req as any).tenant;
  if (tenant?.id) {
    return { tenantId: tenant.id, subdomain: tenant.subdomain ?? null };
  }
  return { tenantId: null, subdomain: null };
}

export async function validateTenant(req: Request, res: Response, next: NextFunction) {
  const tenant = (req as any).tenant;
  if (!tenant?.id) {
    return next();
  }

  if (tenant.status === 'suspended') {
    return res.status(403).json({ message: 'Tenant is suspended.' });
  }

  if (tenant.status === 'deleted') {
    return res.status(410).json({ message: 'Tenant no longer exists.' });
  }

  if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
    return res.status(402).json({ message: 'Subscription expired.' });
  }

  return next();
}

export function tenantGuard(required = true) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tenantPool = (req as any).tenantPool;
    const tenant = (req as any).tenant;

    if (required && (!tenant || !tenantPool)) {
      return res.status(400).json({ message: 'Tenant context required.' });
    }

    return next();
  };
}

export function auditMiddleware(action: string, resourceType?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function auditJson(body: unknown) {
      if (res.statusCode < 400) {
        const tenant = (req as any).tenant;
        void writeAuditLog({
          tenantId: tenant?.id ?? null,
          actorEmail: (req as any).user?.email ?? sanitizeInput(req.body?.adminEmail),
          actorRole: (req as any).user?.role ?? null,
          action,
          resourceType,
          resourceId: tenant?.id ?? null,
          ipAddress: req.ip,
          userAgent: req.get('user-agent') ?? undefined,
          metadata: { path: req.path, method: req.method },
        });
      }
      return originalJson(body);
    } as typeof res.json;

    return next();
  };
}

export async function checkSubdomainAvailable(subdomain: string): Promise<{ available: boolean; reason?: string }> {
  const query = 'SELECT id FROM tenants WHERE subdomain = $1 LIMIT 1';

  try {
    const pool = getCentralPool();
    const existing = await pool.query(query, [subdomain]);
    if (existing.rows.length > 0) {
      return { available: false, reason: 'taken' };
    }
    return { available: true };
  } catch (centralError) {
    console.warn('[SAAS] Central pool subdomain check failed, trying app pool:', centralError);
    try {
      const existing = await appPool.query(query, [subdomain]);
      if (existing.rows.length > 0) {
        return { available: false, reason: 'taken' };
      }
      return { available: true };
    } catch (fallbackError) {
      console.error('[SAAS] Subdomain check failed on both pools:', fallbackError);
      return { available: false, reason: 'error' };
    }
  }
}
