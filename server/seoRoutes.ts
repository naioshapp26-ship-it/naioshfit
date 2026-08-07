import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import { seoSettings } from '@shared/schema';
import { db } from './db';
import { getRequestLanguage } from './utils/i18n';

const ADMIN_TOKEN = process.env.SAAS_ADMIN_TOKEN;

const seoSettingsSchema = z.object({
  titleTemplate: z.string().trim().optional(),
  titleTemplateEn: z.string().trim().min(1),
  titleTemplateAr: z.string().trim().min(1),
  metaDescription: z.string().trim().optional(),
  metaDescriptionEn: z.string().trim().min(1),
  metaDescriptionAr: z.string().trim().min(1),
  metaKeywordsEn: z.string().trim().optional().nullable(),
  metaKeywordsAr: z.string().trim().optional().nullable(),
  metaAuthor: z.string().trim().optional().nullable(),
  metaViewport: z.string().trim().optional().nullable(),
  ogTitle: z.string().trim().optional().nullable(),
  ogTitleEn: z.string().trim().optional().nullable(),
  ogTitleAr: z.string().trim().optional().nullable(),
  ogDescription: z.string().trim().optional().nullable(),
  ogDescriptionEn: z.string().trim().optional().nullable(),
  ogDescriptionAr: z.string().trim().optional().nullable(),
  ogImageUrl: z.string().trim().url().optional().nullable(),
  ogType: z.string().trim().optional().nullable(),
  ogSiteName: z.string().trim().optional().nullable(),
  ogLocale: z.string().trim().optional().nullable(),
  ogLocaleAlternates: z.array(z.string().trim()).optional(),
  twitterTitle: z.string().trim().optional().nullable(),
  twitterTitleEn: z.string().trim().optional().nullable(),
  twitterTitleAr: z.string().trim().optional().nullable(),
  twitterDescription: z.string().trim().optional().nullable(),
  twitterDescriptionEn: z.string().trim().optional().nullable(),
  twitterDescriptionAr: z.string().trim().optional().nullable(),
  twitterImageUrl: z.string().trim().url().optional().nullable(),
  twitterCardType: z.string().trim().optional().nullable(),
  twitterSite: z.string().trim().optional().nullable(),
  twitterCreator: z.string().trim().optional().nullable(),
  facebookTitleEn: z.string().trim().optional().nullable(),
  facebookTitleAr: z.string().trim().optional().nullable(),
  facebookDescriptionEn: z.string().trim().optional().nullable(),
  facebookDescriptionAr: z.string().trim().optional().nullable(),
  facebookImageUrl: z.string().trim().url().optional().nullable(),
  instagramTitleEn: z.string().trim().optional().nullable(),
  instagramTitleAr: z.string().trim().optional().nullable(),
  instagramDescriptionEn: z.string().trim().optional().nullable(),
  instagramDescriptionAr: z.string().trim().optional().nullable(),
  instagramImageUrl: z.string().trim().url().optional().nullable(),
  xTitleEn: z.string().trim().optional().nullable(),
  xTitleAr: z.string().trim().optional().nullable(),
  xDescriptionEn: z.string().trim().optional().nullable(),
  xDescriptionAr: z.string().trim().optional().nullable(),
  xImageUrl: z.string().trim().url().optional().nullable(),
  facebookUrl: z.string().trim().url().optional().nullable(),
  instagramUrl: z.string().trim().url().optional().nullable(),
  xUrl: z.string().trim().url().optional().nullable(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  canonicalBaseUrl: z.string().trim().url().optional().nullable(),
  hreflangMap: z.record(z.string(), z.string().url()).optional(),
  sitemapIncludes: z.array(z.string()).optional(),
  sitemapExcludes: z.array(z.string()).optional(),
});

type SeoSettingsPayload = z.infer<typeof seoSettingsSchema>;

type SeoSettingsRow = typeof seoSettings.$inferSelect;

const defaultSeoSettings: Omit<SeoSettingsRow, 'id' | 'createdAt' | 'updatedAt'> = {
  titleTemplate: 'Naiosh Fit',
  titleTemplateEn: 'Naiosh Fit | {page}',
  titleTemplateAr: 'نايوش فيت | {page}',
  metaDescription: 'تطبيق شامل لتتبع اللياقة البدنية والتمارين والتغذية ومراقبة التقدم',
  metaDescriptionEn: 'All-in-one fitness, workouts, nutrition, and progress tracking.',
  metaDescriptionAr: 'تطبيق شامل لتتبع اللياقة البدنية والتمارين والتغذية ومراقبة التقدم',
  metaKeywordsEn: null,
  metaKeywordsAr: null,
  metaAuthor: null,
  metaViewport: null,
  ogTitle: 'Naiosh Fit',
  ogTitleEn: 'Naiosh Fit',
  ogTitleAr: 'نايوش فيت',
  ogDescription: 'تطبيق شامل لتتبع اللياقة البدنية والتمارين والتغذية ومراقبة التقدم',
  ogDescriptionEn: 'All-in-one fitness, workouts, nutrition, and progress tracking.',
  ogDescriptionAr: 'تطبيق شامل لتتبع اللياقة البدنية والتمارين والتغذية ومراقبة التقدم',
  ogImageUrl: '/naioshfit-logo-new.png?v=2',
  ogType: 'website',
  ogSiteName: 'Naiosh Fit',
  ogLocale: null,
  ogLocaleAlternates: [],
  twitterTitle: 'Naiosh Fit',
  twitterTitleEn: 'Naiosh Fit',
  twitterTitleAr: 'نايوش فيت',
  twitterDescription: 'تطبيق شامل لتتبع اللياقة البدنية والتمارين والتغذية ومراقبة التقدم',
  twitterDescriptionEn: 'All-in-one fitness, workouts, nutrition, and progress tracking.',
  twitterDescriptionAr: 'تطبيق شامل لتتبع اللياقة البدنية والتمارين والتغذية ومراقبة التقدم',
  twitterImageUrl: '/naioshfit-logo-new.png?v=2',
  twitterCardType: 'summary_large_image',
  twitterSite: null,
  twitterCreator: null,
  facebookTitleEn: null,
  facebookTitleAr: null,
  facebookDescriptionEn: null,
  facebookDescriptionAr: null,
  facebookImageUrl: null,
  instagramTitleEn: null,
  instagramTitleAr: null,
  instagramDescriptionEn: null,
  instagramDescriptionAr: null,
  instagramImageUrl: null,
  xTitleEn: null,
  xTitleAr: null,
  xDescriptionEn: null,
  xDescriptionAr: null,
  xImageUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  xUrl: null,
  robotsIndex: true,
  robotsFollow: true,
  canonicalBaseUrl: null,
  hreflangMap: {},
  sitemapIncludes: [],
  sitemapExcludes: [],
};

const getLocalizedMessage = (req: Request, key: string): string => {
  const language = getRequestLanguage(req, 'en');
  const messages: Record<string, { en: string; ar: string }> = {
    adminRequired: {
      en: 'Admin access required.',
      ar: 'يجب تسجيل الدخول كمسؤول.',
    },
    tenantRequired: {
      en: 'Tenant context required.',
      ar: 'هذا المسار يتطلب نطاق مستأجر.',
    },
    invalidPayload: {
      en: 'Invalid SEO settings payload.',
      ar: 'بيانات اعدادات تحسين محركات البحث غير صالحة.',
    },
    notFound: {
      en: 'SEO settings not found.',
      ar: 'اعدادات تحسين محركات البحث غير موجودة.',
    },
    fetchFailed: {
      en: 'Failed to load SEO settings.',
      ar: 'فشل تحميل اعدادات تحسين محركات البحث.',
    },
    updateFailed: {
      en: 'Failed to update SEO settings.',
      ar: 'فشل تحديث اعدادات تحسين محركات البحث.',
    },
  };
  return messages[key]?.[language] || messages.fetchFailed.en;
};

const normalizeSeoPayload = (payload: SeoSettingsPayload): SeoSettingsPayload => {
  const normalizeNullable = (value?: string | null) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  return {
    ...payload,
    titleTemplate: normalizeNullable(payload.titleTemplate) || payload.titleTemplateEn,
    metaDescription: normalizeNullable(payload.metaDescription) || payload.metaDescriptionEn,
    metaKeywordsEn: normalizeNullable(payload.metaKeywordsEn),
    metaKeywordsAr: normalizeNullable(payload.metaKeywordsAr),
    metaAuthor: normalizeNullable(payload.metaAuthor),
    metaViewport: normalizeNullable(payload.metaViewport),
    ogTitle: normalizeNullable(payload.ogTitle),
    ogTitleEn: normalizeNullable(payload.ogTitleEn),
    ogTitleAr: normalizeNullable(payload.ogTitleAr),
    ogDescription: normalizeNullable(payload.ogDescription),
    ogDescriptionEn: normalizeNullable(payload.ogDescriptionEn),
    ogDescriptionAr: normalizeNullable(payload.ogDescriptionAr),
    ogImageUrl: normalizeNullable(payload.ogImageUrl),
    ogType: normalizeNullable(payload.ogType),
    ogSiteName: normalizeNullable(payload.ogSiteName),
    ogLocale: normalizeNullable(payload.ogLocale),
    ogLocaleAlternates: payload.ogLocaleAlternates || [],
    twitterTitle: normalizeNullable(payload.twitterTitle),
    twitterTitleEn: normalizeNullable(payload.twitterTitleEn),
    twitterTitleAr: normalizeNullable(payload.twitterTitleAr),
    twitterDescription: normalizeNullable(payload.twitterDescription),
    twitterDescriptionEn: normalizeNullable(payload.twitterDescriptionEn),
    twitterDescriptionAr: normalizeNullable(payload.twitterDescriptionAr),
    twitterImageUrl: normalizeNullable(payload.twitterImageUrl),
    twitterCardType: normalizeNullable(payload.twitterCardType),
    twitterSite: normalizeNullable(payload.twitterSite),
    twitterCreator: normalizeNullable(payload.twitterCreator),
    facebookTitleEn: normalizeNullable(payload.facebookTitleEn),
    facebookTitleAr: normalizeNullable(payload.facebookTitleAr),
    facebookDescriptionEn: normalizeNullable(payload.facebookDescriptionEn),
    facebookDescriptionAr: normalizeNullable(payload.facebookDescriptionAr),
    facebookImageUrl: normalizeNullable(payload.facebookImageUrl),
    instagramTitleEn: normalizeNullable(payload.instagramTitleEn),
    instagramTitleAr: normalizeNullable(payload.instagramTitleAr),
    instagramDescriptionEn: normalizeNullable(payload.instagramDescriptionEn),
    instagramDescriptionAr: normalizeNullable(payload.instagramDescriptionAr),
    instagramImageUrl: normalizeNullable(payload.instagramImageUrl),
    xTitleEn: normalizeNullable(payload.xTitleEn),
    xTitleAr: normalizeNullable(payload.xTitleAr),
    xDescriptionEn: normalizeNullable(payload.xDescriptionEn),
    xDescriptionAr: normalizeNullable(payload.xDescriptionAr),
    xImageUrl: normalizeNullable(payload.xImageUrl),
    facebookUrl: normalizeNullable(payload.facebookUrl),
    instagramUrl: normalizeNullable(payload.instagramUrl),
    xUrl: normalizeNullable(payload.xUrl),
    canonicalBaseUrl: normalizeNullable(payload.canonicalBaseUrl),
    hreflangMap: payload.hreflangMap || {},
    sitemapIncludes: payload.sitemapIncludes || [],
    sitemapExcludes: payload.sitemapExcludes || [],
  };
};

const isCentralAdmin = (req: Request): boolean => {
  const user = (req.user as any) || (req.session as any)?.user;
  if (user?.role === 'admin' || user?.role === 'super_admin') {
    return true;
  }
  return Boolean(ADMIN_TOKEN && req.headers['x-saas-admin-token'] === ADMIN_TOKEN);
};

const isTenantAdmin = (req: Request): boolean => {
  const user = (req.user as any) || (req.session as any)?.user;
  return user?.role === 'admin' || user?.role === 'tenant_admin' || user?.role === 'super_admin';
};

const resolveTenantDb = (req: Request) => {
  const tenantPool = (req as any).tenantPool as any;
  if (!tenantPool) return null;
  return drizzle(tenantPool, { schema });
};

const getOrCreateSeoSettings = async (seoDb: any): Promise<SeoSettingsRow> => {
  const [existing] = await seoDb.select().from(seoSettings).limit(1);
  if (existing) return existing;
  const [created] = await seoDb.insert(seoSettings).values(defaultSeoSettings).returning();
  return created;
};

const CENTRAL_PLATFORM_TITLE_EN = 'Naiosh Fit';
const CENTRAL_PLATFORM_TITLE_AR = 'نايوش فيت';

/**
 * When a tenant's SEO settings still contain the central-platform default title
 * ("Naiosh Fit" / "نايوش فيت"), substitute the tenant's own company name so the
 * browser tab and social previews reflect the tenant's brand, not the central platform.
 */
const substituteDefaultTitlesForTenant = (settings: SeoSettingsRow, companyName: string): SeoSettingsRow => {
  const isDefault = (value: string | null | undefined) =>
    value === CENTRAL_PLATFORM_TITLE_EN || value === CENTRAL_PLATFORM_TITLE_AR;

  const isDefaultTemplate = (value: string | null | undefined) =>
    value === `${CENTRAL_PLATFORM_TITLE_EN} | {page}` ||
    value === `${CENTRAL_PLATFORM_TITLE_AR} | {page}` ||
    isDefault(value);

  const replaceTemplate = (value: string | null | undefined, separator: string): string | null => {
    if (!value) return value ?? null;
    if (value === `${CENTRAL_PLATFORM_TITLE_EN} | {page}`) return `${companyName}${separator}{page}`;
    if (value === `${CENTRAL_PLATFORM_TITLE_AR} | {page}`) return `${companyName}${separator}{page}`;
    if (isDefault(value)) return companyName;
    return value;
  };

  return {
    ...settings,
    titleTemplate: isDefault(settings.titleTemplate) ? companyName : settings.titleTemplate,
    titleTemplateEn: isDefaultTemplate(settings.titleTemplateEn) ? replaceTemplate(settings.titleTemplateEn, ' | ') : settings.titleTemplateEn,
    titleTemplateAr: isDefaultTemplate(settings.titleTemplateAr) ? replaceTemplate(settings.titleTemplateAr, ' | ') : settings.titleTemplateAr,
    ogTitle: isDefault(settings.ogTitle) ? companyName : settings.ogTitle,
    ogTitleEn: isDefault(settings.ogTitleEn) ? companyName : settings.ogTitleEn,
    ogTitleAr: isDefault(settings.ogTitleAr) ? companyName : settings.ogTitleAr,
    ogSiteName: isDefault(settings.ogSiteName) ? companyName : settings.ogSiteName,
    twitterTitle: isDefault(settings.twitterTitle) ? companyName : settings.twitterTitle,
    twitterTitleEn: isDefault(settings.twitterTitleEn) ? companyName : settings.twitterTitleEn,
    twitterTitleAr: isDefault(settings.twitterTitleAr) ? companyName : settings.twitterTitleAr,
  };
};

const updateSeoSettings = async (seoDb: any, payload: SeoSettingsPayload): Promise<SeoSettingsRow> => {
  const current = await getOrCreateSeoSettings(seoDb);
  const normalized = normalizeSeoPayload(payload);
  const [updated] = await seoDb
    .update(seoSettings)
    .set({
      titleTemplate: normalized.titleTemplate,
      titleTemplateEn: normalized.titleTemplateEn,
      titleTemplateAr: normalized.titleTemplateAr,
      metaDescription: normalized.metaDescription,
      metaDescriptionEn: normalized.metaDescriptionEn,
      metaDescriptionAr: normalized.metaDescriptionAr,
      metaKeywordsEn: normalized.metaKeywordsEn,
      metaKeywordsAr: normalized.metaKeywordsAr,
      metaAuthor: normalized.metaAuthor,
      metaViewport: normalized.metaViewport,
      ogTitle: normalized.ogTitle,
      ogTitleEn: normalized.ogTitleEn,
      ogTitleAr: normalized.ogTitleAr,
      ogDescription: normalized.ogDescription,
      ogDescriptionEn: normalized.ogDescriptionEn,
      ogDescriptionAr: normalized.ogDescriptionAr,
      ogImageUrl: normalized.ogImageUrl,
      ogType: normalized.ogType,
      ogSiteName: normalized.ogSiteName,
      ogLocale: normalized.ogLocale,
      ogLocaleAlternates: normalized.ogLocaleAlternates || [],
      twitterTitle: normalized.twitterTitle,
      twitterTitleEn: normalized.twitterTitleEn,
      twitterTitleAr: normalized.twitterTitleAr,
      twitterDescription: normalized.twitterDescription,
      twitterDescriptionEn: normalized.twitterDescriptionEn,
      twitterDescriptionAr: normalized.twitterDescriptionAr,
      twitterImageUrl: normalized.twitterImageUrl,
      twitterCardType: normalized.twitterCardType,
      twitterSite: normalized.twitterSite,
      twitterCreator: normalized.twitterCreator,
      facebookTitleEn: normalized.facebookTitleEn,
      facebookTitleAr: normalized.facebookTitleAr,
      facebookDescriptionEn: normalized.facebookDescriptionEn,
      facebookDescriptionAr: normalized.facebookDescriptionAr,
      facebookImageUrl: normalized.facebookImageUrl,
      instagramTitleEn: normalized.instagramTitleEn,
      instagramTitleAr: normalized.instagramTitleAr,
      instagramDescriptionEn: normalized.instagramDescriptionEn,
      instagramDescriptionAr: normalized.instagramDescriptionAr,
      instagramImageUrl: normalized.instagramImageUrl,
      xTitleEn: normalized.xTitleEn,
      xTitleAr: normalized.xTitleAr,
      xDescriptionEn: normalized.xDescriptionEn,
      xDescriptionAr: normalized.xDescriptionAr,
      xImageUrl: normalized.xImageUrl,
      facebookUrl: normalized.facebookUrl,
      instagramUrl: normalized.instagramUrl,
      xUrl: normalized.xUrl,
      robotsIndex: normalized.robotsIndex ?? current.robotsIndex,
      robotsFollow: normalized.robotsFollow ?? current.robotsFollow,
      canonicalBaseUrl: normalized.canonicalBaseUrl,
      hreflangMap: normalized.hreflangMap || {},
      sitemapIncludes: normalized.sitemapIncludes || [],
      sitemapExcludes: normalized.sitemapExcludes || [],
      updatedAt: new Date(),
    })
    .where(eq(seoSettings.id, current.id))
    .returning();
  return updated;
};

const getBaseUrl = (req: Request, settings: SeoSettingsRow): string => {
  if (settings.canonicalBaseUrl) {
    return settings.canonicalBaseUrl.replace(/\/$/, '');
  }
  const host = req.headers.host?.split(':')[0];
  const protocol = req.protocol || 'https';
  return host ? `${protocol}://${host}` : '';
};

const buildRobots = (settings: SeoSettingsRow, baseUrl: string): string => {
  const lines: string[] = ['User-agent: *'];
  if (!settings.robotsIndex) {
    lines.push('Disallow: /');
  } else {
    lines.push('Allow: /');
  }
  if (baseUrl) {
    lines.push(`Sitemap: ${baseUrl}/sitemap.xml`);
  }
  return lines.join('\n');
};

const buildSitemap = (baseUrl: string, settings: SeoSettingsRow): string => {
  const staticRoutes = [
    '/',
    '/blog',
    '/contact',
    '/signup',
    '/auth',
    '/privacy-policy',
    '/tos',
    '/terms-of-service',
  ];

  const includes = settings.sitemapIncludes || [];
  const excludes = new Set(settings.sitemapExcludes || []);

  const allRoutes = [...staticRoutes, ...includes]
    .map((route) => route.startsWith('http') ? route : `${baseUrl}${route.startsWith('/') ? '' : '/'}${route}`)
    .filter((route) => !excludes.has(route) && !excludes.has(route.replace(baseUrl, '')));

  const uniqueRoutes = Array.from(new Set(allRoutes));
  const urlEntries = uniqueRoutes.map((route) => `  <url>\n    <loc>${route}</loc>\n  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urlEntries}\n` +
    `</urlset>`;
};

export function registerSeoRoutes(app: Express) {
  app.get('/api/seo', async (req: Request, res: Response) => {
    try {
      const tenantDb = resolveTenantDb(req);
      const seoDb = tenantDb || db;
      let settings = await getOrCreateSeoSettings(seoDb);
      // For tenant subdomain requests, replace any un-customised central-platform
      // titles ("Naiosh Fit") with the tenant's own company name.
      const tenant = (req as any).tenant as { company_name?: string } | undefined;
      const companyName = tenant?.company_name;
      if (companyName && tenantDb) {
        settings = substituteDefaultTitlesForTenant(settings, companyName);
      }
      res.json({ settings });
    } catch (error) {
      console.error('[SEO] Failed to fetch public SEO settings:', error);
      res.status(500).json({ message: getLocalizedMessage(req, 'fetchFailed') });
    }
  });

  app.get('/api/admin/seo', async (req: Request, res: Response) => {
    if ((req as any).tenantPool) {
      return res.status(403).json({ message: getLocalizedMessage(req, 'adminRequired') });
    }
    if (!isCentralAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, 'adminRequired') });
    }

    try {
      const settings = await getOrCreateSeoSettings(db);
      res.json({ settings });
    } catch (error) {
      console.error('[SEO] Failed to fetch central SEO settings:', error);
      res.status(500).json({ message: getLocalizedMessage(req, 'fetchFailed') });
    }
  });

  app.put('/api/admin/seo', async (req: Request, res: Response) => {
    if ((req as any).tenantPool) {
      return res.status(403).json({ message: getLocalizedMessage(req, 'adminRequired') });
    }
    if (!isCentralAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, 'adminRequired') });
    }

    const parsed = seoSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: getLocalizedMessage(req, 'invalidPayload') });
    }

    try {
      const updated = await updateSeoSettings(db, parsed.data);
      res.json({ settings: updated });
    } catch (error) {
      console.error('[SEO] Failed to update central SEO settings:', error);
      res.status(500).json({ message: getLocalizedMessage(req, 'updateFailed') });
    }
  });

  app.get('/api/tenant/seo', async (req: Request, res: Response) => {
    const tenantDb = resolveTenantDb(req);
    if (!tenantDb) {
      return res.status(400).json({ message: getLocalizedMessage(req, 'tenantRequired') });
    }
    if (!isTenantAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, 'adminRequired') });
    }

    try {
      const settings = await getOrCreateSeoSettings(tenantDb);
      res.json({ settings });
    } catch (error) {
      console.error('[SEO] Failed to fetch tenant SEO settings:', error);
      res.status(500).json({ message: getLocalizedMessage(req, 'fetchFailed') });
    }
  });

  app.put('/api/tenant/seo', async (req: Request, res: Response) => {
    const tenantDb = resolveTenantDb(req);
    if (!tenantDb) {
      return res.status(400).json({ message: getLocalizedMessage(req, 'tenantRequired') });
    }
    if (!isTenantAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, 'adminRequired') });
    }

    const parsed = seoSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: getLocalizedMessage(req, 'invalidPayload') });
    }

    try {
      const updated = await updateSeoSettings(tenantDb, parsed.data);
      res.json({ settings: updated });
    } catch (error) {
      console.error('[SEO] Failed to update tenant SEO settings:', error);
      res.status(500).json({ message: getLocalizedMessage(req, 'updateFailed') });
    }
  });

  app.get('/robots.txt', async (req: Request, res: Response) => {
    try {
      const tenantDb = resolveTenantDb(req);
      const seoDb = tenantDb || db;
      const settings = await getOrCreateSeoSettings(seoDb);
      const baseUrl = getBaseUrl(req, settings);
      const robots = buildRobots(settings, baseUrl);
      res.type('text/plain').send(robots);
    } catch (error) {
      console.error('[SEO] Failed to render robots.txt:', error);
      res.status(500).type('text/plain').send('User-agent: *\nDisallow: /');
    }
  });

  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    try {
      const tenantDb = resolveTenantDb(req);
      const seoDb = tenantDb || db;
      const settings = await getOrCreateSeoSettings(seoDb);
      const baseUrl = getBaseUrl(req, settings);
      const sitemap = buildSitemap(baseUrl, settings);
      res.type('application/xml').send(sitemap);
    } catch (error) {
      console.error('[SEO] Failed to render sitemap.xml:', error);
      res.status(500).type('application/xml').send('');
    }
  });
}
