import type { Express, Request, Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { z } from "zod";
import * as schema from "@shared/schema";
import {
  publicSiteSettings,
  staticPages,
  type FooterQuickLink,
} from "@shared/schema";
import { db } from "./db";
import { getRequestLanguage } from "./utils/i18n";

const ADMIN_TOKEN = process.env.SAAS_ADMIN_TOKEN;
const ALLOWED_PAGE_SLUGS = ["privacy-policy", "tos"] as const;

const quickLinkSchema = z.object({
  id: z.string().min(1),
  labelEn: z.string().trim().default(""),
  labelAr: z.string().trim().default(""),
  href: z.string().trim().min(1),
  enabled: z.boolean().default(true),
  visibleOnCentral: z.boolean().default(true),
  visibleOnTenant: z.boolean().default(true),
  order: z.number().int().default(0),
});

const siteSettingsSchema = z.object({
  quickLinks: z.array(quickLinkSchema).default([]),
  socialLinks: z.record(z.string(), z.string()).default({}),
  contactEmail: z.string().trim().max(255).default(""),
  contactPhone: z.string().trim().max(255).default(""),
  contactAddress: z.string().trim().max(1000).default(""),
  footerGradientFrom: z.string().trim().max(32).default("#0f172a"),
  footerGradientTo: z.string().trim().max(32).default("#1e293b"),
});

const staticPageSchema = z.object({
  titleEn: z.string().trim().default(""),
  titleAr: z.string().trim().default(""),
  contentEn: z.string().trim().default(""),
  contentAr: z.string().trim().default(""),
});

type StaticPageRow = typeof staticPages.$inferSelect;

const defaultQuickLinks: FooterQuickLink[] = [
  {
    id: "home",
    labelEn: "Home",
    labelAr: "الرئيسية",
    href: "/home",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 1,
  },
  {
    id: "blog",
    labelEn: "Blog",
    labelAr: "المدونة",
    href: "/blog",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 2,
  },
  {
    id: "courses",
    labelEn: "Courses",
    labelAr: "الدورات",
    href: "/courses",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 3,
  },
  {
    id: "store",
    labelEn: "Store",
    labelAr: "المتجر",
    href: "/store",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 4,
  },
  {
    id: "ads",
    labelEn: "Ads",
    labelAr: "الإعلانات",
    href: "/ads",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 5,
  },
  {
    id: "signup",
    labelEn: "Sign up",
    labelAr: "إنشاء حساب",
    href: "/signup",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 6,
  },
  {
    id: "become-tenant",
    labelEn: "Become a tenant",
    labelAr: "كن مستأجرا",
    href: "/saas",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: false,
    order: 7,
  },
  {
    id: "privacy",
    labelEn: "Privacy Policy",
    labelAr: "سياسة الخصوصية",
    href: "/privacy-policy",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 8,
  },
  {
    id: "tos",
    labelEn: "Terms of Service",
    labelAr: "شروط الخدمة",
    href: "/tos",
    enabled: true,
    visibleOnCentral: true,
    visibleOnTenant: true,
    order: 9,
  },
];

const defaultSettings = {
  quickLinks: defaultQuickLinks,
  socialLinks: {
    facebook: "",
    instagram: "",
    x: "",
    linkedin: "",
    youtube: "",
    tiktok: "",
  },
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  footerGradientFrom: "#0f172a",
  footerGradientTo: "#1e293b",
};

const getLocalizedMessage = (req: Request, key: string): string => {
  const language = getRequestLanguage(req, "en");
  const messages: Record<string, { en: string; ar: string }> = {
    adminRequired: {
      en: "Admin access required.",
      ar: "يجب تسجيل الدخول كمسؤول.",
    },
    tenantRequired: {
      en: "Tenant context required.",
      ar: "هذا المسار يتطلب نطاق مستأجر.",
    },
    invalidPayload: {
      en: "Invalid payload.",
      ar: "بيانات غير صالحة.",
    },
    invalidSlug: {
      en: "Unsupported page slug.",
      ar: "معرف الصفحة غير مدعوم.",
    },
    fetchFailed: {
      en: "Failed to load public content settings.",
      ar: "فشل تحميل إعدادات المحتوى العام.",
    },
    updateFailed: {
      en: "Failed to update public content settings.",
      ar: "فشل تحديث إعدادات المحتوى العام.",
    },
  };
  return messages[key]?.[language] || messages.fetchFailed.en;
};

const isCentralAdmin = (req: Request): boolean => {
  const user = (req.user as any) || (req.session as any)?.user;
  if (user?.role === "admin" || user?.role === "super_admin") {
    return true;
  }
  return Boolean(ADMIN_TOKEN && req.headers["x-saas-admin-token"] === ADMIN_TOKEN);
};

const isTenantAdmin = (req: Request): boolean => {
  const user = (req.user as any) || (req.session as any)?.user;
  return user?.role === "admin" || user?.role === "tenant_admin" || user?.role === "super_admin";
};

const resolveTenantDb = (req: Request) => {
  const tenantPool = (req as any).tenantPool as any;
  if (!tenantPool) return null;
  return drizzle(tenantPool, { schema });
};

const findPublicSiteSettings = async (siteDb: any) => {
  try {
    const [existing] = await siteDb.select().from(publicSiteSettings).limit(1);
    return existing || null;
  } catch (error: any) {
    if (error?.code === "42P01") {
      return null;
    }
    throw error;
  }
};

const getOrCreateSiteSettings = async (siteDb: any) => {
  const existing = await findPublicSiteSettings(siteDb);
  if (existing) return existing;
  const [created] = await siteDb.insert(publicSiteSettings).values(defaultSettings).returning();
  return created;
};

const getOrCreateStaticPages = async (siteDb: any): Promise<StaticPageRow[]> => {
  const current = await siteDb
    .select()
    .from(staticPages)
    .where(inArray(staticPages.slug, [...ALLOWED_PAGE_SLUGS]));

  const existingBySlug = new Map(current.map((page: any) => [page.slug, page]));
  const missing = ALLOWED_PAGE_SLUGS.filter((slug) => !existingBySlug.has(slug));

  for (const slug of missing) {
    const [created] = await siteDb
      .insert(staticPages)
      .values({ slug, titleEn: "", titleAr: "", contentEn: "", contentAr: "" })
      .returning();
    existingBySlug.set(slug, created);
  }

  return ALLOWED_PAGE_SLUGS
    .map((slug) => existingBySlug.get(slug))
    .filter((page): page is StaticPageRow => Boolean(page));
};

const normalizeQuickLinks = (links: FooterQuickLink[]) =>
  [...links]
    .filter((link) => link.id !== "contact" && link.href !== "/contact")
    .sort((a, b) => a.order - b.order)
    .map((link) => ({
      ...link,
      href: link.href.trim() || "/",
      labelEn: link.labelEn.trim(),
      labelAr: link.labelAr.trim(),
    }));

const mergeQuickLinksWithDefaults = (links: FooterQuickLink[]) => {
  const normalized = normalizeQuickLinks(links);
  const byId = new Map(normalized.map((link) => [link.id, link]));

  for (const fallback of defaultQuickLinks) {
    if (!byId.has(fallback.id)) {
      byId.set(fallback.id, fallback);
    }
  }

  return normalizeQuickLinks(Array.from(byId.values()));
};

const filterLinksForScope = (links: FooterQuickLink[], isTenantScope: boolean) => {
  const sorted = normalizeQuickLinks(links);
  return sorted.filter((link) => {
    if (!link.enabled) return false;
    if (isTenantScope) return link.visibleOnTenant;
    return link.visibleOnCentral;
  });
};

const resolveReadableSettings = async (req: Request) => {
  const tenantDb = resolveTenantDb(req);
  const siteDb = tenantDb || db;
  const settings = await getOrCreateSiteSettings(siteDb);
  const pages = await getOrCreateStaticPages(siteDb);
  const isTenantScope = Boolean(tenantDb);

  const parsedSettings = siteSettingsSchema.parse(settings);
  const mergedQuickLinks = mergeQuickLinksWithDefaults(parsedSettings.quickLinks);

  return {
    settings: {
      ...parsedSettings,
      quickLinks: filterLinksForScope(mergedQuickLinks, isTenantScope),
    },
    allSettings: {
      ...parsedSettings,
      quickLinks: mergedQuickLinks,
    },
    pages,
  };
};

export function registerPublicContentRoutes(app: Express) {
  app.get("/api/public/site-settings", async (req: Request, res: Response) => {
    try {
      const { settings } = await resolveReadableSettings(req);
      res.json({ settings });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to fetch public settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "fetchFailed") });
    }
  });

  app.get("/api/public/pages/:slug", async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || "").trim();
      if (!ALLOWED_PAGE_SLUGS.includes(slug as any)) {
        return res.status(400).json({ message: getLocalizedMessage(req, "invalidSlug") });
      }

      const tenantDb = resolveTenantDb(req);
      const siteDb = tenantDb || db;
      const pages = await getOrCreateStaticPages(siteDb);
      const page = pages.find((entry) => entry.slug === slug);
      if (!page) {
        return res.status(404).json({ message: getLocalizedMessage(req, "fetchFailed") });
      }
      return res.json({ page });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to fetch page:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "fetchFailed") });
    }
  });

  app.get("/api/admin/public-content", async (req: Request, res: Response) => {
    if ((req as any).tenantPool) {
      return res.status(403).json({ message: getLocalizedMessage(req, "adminRequired") });
    }
    if (!isCentralAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    try {
      const settings = siteSettingsSchema.parse(await getOrCreateSiteSettings(db));
      const pages = await getOrCreateStaticPages(db);
      res.json({ settings: { ...settings, quickLinks: mergeQuickLinksWithDefaults(settings.quickLinks) }, pages });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to fetch central admin content:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "fetchFailed") });
    }
  });

  app.put("/api/admin/public-content/settings", async (req: Request, res: Response) => {
    if ((req as any).tenantPool) {
      return res.status(403).json({ message: getLocalizedMessage(req, "adminRequired") });
    }
    if (!isCentralAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    const parsed = siteSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: getLocalizedMessage(req, "invalidPayload"),
        errors: parsed.error.issues,
      });
    }

    try {
      const current = await getOrCreateSiteSettings(db);
      const [updated] = await db
        .update(publicSiteSettings)
        .set({
          quickLinks: mergeQuickLinksWithDefaults(parsed.data.quickLinks),
          socialLinks: parsed.data.socialLinks,
          contactEmail: parsed.data.contactEmail,
          contactPhone: parsed.data.contactPhone,
          contactAddress: parsed.data.contactAddress,
          footerGradientFrom: parsed.data.footerGradientFrom,
          footerGradientTo: parsed.data.footerGradientTo,
          updatedByUserId: ((req.user as any)?.id ?? (req.session as any)?.user?.id ?? null),
          updatedAt: new Date(),
        })
        .where(eq(publicSiteSettings.id, current.id))
        .returning();

      res.json({ settings: siteSettingsSchema.parse(updated) });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to update central settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "updateFailed") });
    }
  });

  app.put("/api/admin/public-content/pages/:slug", async (req: Request, res: Response) => {
    if ((req as any).tenantPool) {
      return res.status(403).json({ message: getLocalizedMessage(req, "adminRequired") });
    }
    if (!isCentralAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    const slug = String(req.params.slug || "").trim();
    if (!ALLOWED_PAGE_SLUGS.includes(slug as any)) {
      return res.status(400).json({ message: getLocalizedMessage(req, "invalidSlug") });
    }

    const parsed = staticPageSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: getLocalizedMessage(req, "invalidPayload"),
        errors: parsed.error.issues,
      });
    }

    try {
      const pages = await getOrCreateStaticPages(db);
      const page = pages.find((entry) => entry.slug === slug);
      if (!page) {
        return res.status(404).json({ message: getLocalizedMessage(req, "fetchFailed") });
      }

      const [updated] = await db
        .update(staticPages)
        .set({
          titleEn: parsed.data.titleEn,
          titleAr: parsed.data.titleAr,
          contentEn: parsed.data.contentEn,
          contentAr: parsed.data.contentAr,
          updatedByUserId: ((req.user as any)?.id ?? (req.session as any)?.user?.id ?? null),
          updatedAt: new Date(),
        })
        .where(eq(staticPages.id, page.id))
        .returning();

      res.json({ page: updated });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to update central page:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "updateFailed") });
    }
  });

  app.get("/api/tenant/public-content", async (req: Request, res: Response) => {
    const tenantDb = resolveTenantDb(req);
    if (!tenantDb) {
      return res.status(400).json({ message: getLocalizedMessage(req, "tenantRequired") });
    }
    if (!isTenantAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    try {
      const settings = siteSettingsSchema.parse(await getOrCreateSiteSettings(tenantDb));
      const pages = await getOrCreateStaticPages(tenantDb);
      res.json({ settings: { ...settings, quickLinks: mergeQuickLinksWithDefaults(settings.quickLinks) }, pages });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to fetch tenant admin content:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "fetchFailed") });
    }
  });

  app.put("/api/tenant/public-content/settings", async (req: Request, res: Response) => {
    const tenantDb = resolveTenantDb(req);
    if (!tenantDb) {
      return res.status(400).json({ message: getLocalizedMessage(req, "tenantRequired") });
    }
    if (!isTenantAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    const parsed = siteSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: getLocalizedMessage(req, "invalidPayload"),
        errors: parsed.error.issues,
      });
    }

    try {
      const current = await getOrCreateSiteSettings(tenantDb);
      const [updated] = await tenantDb
        .update(publicSiteSettings)
        .set({
          quickLinks: mergeQuickLinksWithDefaults(parsed.data.quickLinks),
          socialLinks: parsed.data.socialLinks,
          contactEmail: parsed.data.contactEmail,
          contactPhone: parsed.data.contactPhone,
          contactAddress: parsed.data.contactAddress,
          footerGradientFrom: parsed.data.footerGradientFrom,
          footerGradientTo: parsed.data.footerGradientTo,
          updatedByUserId: ((req.user as any)?.id ?? (req.session as any)?.user?.id ?? null),
          updatedAt: new Date(),
        })
        .where(eq(publicSiteSettings.id, current.id))
        .returning();

      res.json({ settings: siteSettingsSchema.parse(updated) });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to update tenant settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "updateFailed") });
    }
  });

  app.put("/api/tenant/public-content/pages/:slug", async (req: Request, res: Response) => {
    const tenantDb = resolveTenantDb(req);
    if (!tenantDb) {
      return res.status(400).json({ message: getLocalizedMessage(req, "tenantRequired") });
    }
    if (!isTenantAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    const slug = String(req.params.slug || "").trim();
    if (!ALLOWED_PAGE_SLUGS.includes(slug as any)) {
      return res.status(400).json({ message: getLocalizedMessage(req, "invalidSlug") });
    }

    const parsed = staticPageSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({
        message: getLocalizedMessage(req, "invalidPayload"),
        errors: parsed.error.issues,
      });
    }

    try {
      const pages = await getOrCreateStaticPages(tenantDb);
      const page = pages.find((entry) => entry.slug === slug);
      if (!page) {
        return res.status(404).json({ message: getLocalizedMessage(req, "fetchFailed") });
      }

      const [updated] = await tenantDb
        .update(staticPages)
        .set({
          titleEn: parsed.data.titleEn,
          titleAr: parsed.data.titleAr,
          contentEn: parsed.data.contentEn,
          contentAr: parsed.data.contentAr,
          updatedByUserId: ((req.user as any)?.id ?? (req.session as any)?.user?.id ?? null),
          updatedAt: new Date(),
        })
        .where(eq(staticPages.id, page.id))
        .returning();

      res.json({ page: updated });
    } catch (error) {
      console.error("[PUBLIC-CONTENT] Failed to update tenant page:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "updateFailed") });
    }
  });
}
