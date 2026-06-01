import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { z } from "zod";
import * as schema from "@shared/schema";
import { brandingSettings } from "@shared/schema";
import { db } from "./db";
import { getRequestLanguage } from "./utils/i18n";

const ADMIN_TOKEN = process.env.SAAS_ADMIN_TOKEN;

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "Invalid color format");

const assetUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\//i.test(value), "Invalid URL format");

const heroMediaItemSchema = z.object({
  url: assetUrlSchema,
  type: z.enum(["image", "video"]),
});

const brandingSettingsSchema = z.object({
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  announcementBarBackgroundColor: hexColorSchema,
  announcementBarTextColor: hexColorSchema,
  headerBackgroundColor: hexColorSchema,
  sidebarBackgroundColor: hexColorSchema,
  sidebarHoverColor: hexColorSchema,
  badgeBackgroundColor: hexColorSchema,
  logoUrl: assetUrlSchema.default(""),
  faviconUrl: assetUrlSchema.default(""),
  heroMediaItems: z.array(heroMediaItemSchema).default([]),
  heroBackgroundType: z.enum(["image", "video"]).default("image"),
  heroBackgroundUrl: assetUrlSchema.default(""),
  heroBackgroundVideoUrl: assetUrlSchema.default(""),
  heroTitle: z.string().trim().max(160, "Hero title is too long").default(""),
  heroSubtitle: z.string().trim().max(280, "Hero subtitle is too long").default(""),
  statsCourses: z.number().int().min(0).default(0),
  statsCoaches: z.number().int().min(0).default(0),
  statsUsers: z.number().int().min(0).default(0),
  statsWorkoutsCompleted: z.number().int().min(0).default(0),
  statsNutritionPlans: z.number().int().min(0).default(0),
  statsMealsLogged: z.number().int().min(0).default(0),
  showHeroSection: z.boolean().default(true),
  showFeaturesSection: z.boolean().default(true),
  showPricingSection: z.boolean().default(true),
  showCtaSection: z.boolean().default(true),
});

type BrandingPayload = z.infer<typeof brandingSettingsSchema>;
type BrandingRow = typeof brandingSettings.$inferSelect;

const defaultBrandingSettings: Omit<BrandingRow, "id" | "createdAt" | "updatedAt"> = {
  primaryColor: "#dc2626",
  secondaryColor: "#f3f4f6",
  accentColor: "#f97316",
  announcementBarBackgroundColor: "#111827",
  announcementBarTextColor: "#ffffff",
  headerBackgroundColor: "#ffffff",
  sidebarBackgroundColor: "#7c2525",
  sidebarHoverColor: "#4a1616",
  badgeBackgroundColor: "#dc2626",
  logoUrl: "",
  faviconUrl: "",
  heroMediaItems: [],
  heroBackgroundType: "image",
  heroBackgroundUrl: "",
  heroBackgroundVideoUrl: "",
  heroTitle: "",
  heroSubtitle: "",
  statsCourses: 0,
  statsCoaches: 0,
  statsUsers: 0,
  statsWorkoutsCompleted: 0,
  statsNutritionPlans: 0,
  statsMealsLogged: 0,
  showHeroSection: true,
  showFeaturesSection: true,
  showPricingSection: true,
  showCtaSection: true,
  updatedByUserId: null,
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
      en: "Invalid branding settings payload.",
      ar: "بيانات إعدادات الهوية البصرية غير صالحة.",
    },
    fetchFailed: {
      en: "Failed to load branding settings.",
      ar: "فشل تحميل إعدادات الهوية البصرية.",
    },
    updateFailed: {
      en: "Failed to update branding settings.",
      ar: "فشل تحديث إعدادات الهوية البصرية.",
    },
  };
  return messages[key]?.[language] || messages.fetchFailed.en;
};

const normalizeHex = (value: string): string => value.trim().toLowerCase();
const normalizeText = (value: string): string => value.trim();

const normalizeHeroMediaItems = (items: BrandingPayload["heroMediaItems"]) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const url = normalizeText(item.url);
      if (!url) return null;
      return {
        url,
        type: item.type === "video" ? "video" : "image",
      } as { url: string; type: "image" | "video" };
    })
    .filter((item): item is { url: string; type: "image" | "video" } => Boolean(item));
};

const normalizeBrandingPayload = (payload: BrandingPayload): BrandingPayload => ({
  primaryColor: normalizeHex(payload.primaryColor),
  secondaryColor: normalizeHex(payload.secondaryColor),
  accentColor: normalizeHex(payload.accentColor),
  announcementBarBackgroundColor: normalizeHex(payload.announcementBarBackgroundColor),
  announcementBarTextColor: normalizeHex(payload.announcementBarTextColor),
  headerBackgroundColor: normalizeHex(payload.headerBackgroundColor),
  sidebarBackgroundColor: normalizeHex(payload.sidebarBackgroundColor),
  sidebarHoverColor: normalizeHex(payload.sidebarHoverColor),
  badgeBackgroundColor: normalizeHex(payload.badgeBackgroundColor),
  logoUrl: normalizeText(payload.logoUrl),
  faviconUrl: normalizeText(payload.faviconUrl),
  heroMediaItems: normalizeHeroMediaItems(payload.heroMediaItems),
  heroBackgroundType: payload.heroBackgroundType,
  heroBackgroundUrl: normalizeText(payload.heroBackgroundUrl),
  heroBackgroundVideoUrl: normalizeText(payload.heroBackgroundVideoUrl),
  heroTitle: normalizeText(payload.heroTitle),
  heroSubtitle: normalizeText(payload.heroSubtitle),
  statsCourses: payload.statsCourses,
  statsCoaches: payload.statsCoaches,
  statsUsers: payload.statsUsers,
  statsWorkoutsCompleted: payload.statsWorkoutsCompleted,
  statsNutritionPlans: payload.statsNutritionPlans,
  statsMealsLogged: payload.statsMealsLogged,
  showHeroSection: payload.showHeroSection,
  showFeaturesSection: payload.showFeaturesSection,
  showPricingSection: payload.showPricingSection,
  showCtaSection: payload.showCtaSection,
});

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

const findBrandingSettings = async (brandingDb: any): Promise<BrandingRow | null> => {
  try {
    const [existing] = await brandingDb.select().from(brandingSettings).limit(1);
    return existing || null;
  } catch (error: any) {
    if (error?.code === "42P01") {
      return null;
    }
    throw error;
  }
};

const getOrCreateBrandingSettings = async (brandingDb: any): Promise<BrandingRow> => {
  const existing = await findBrandingSettings(brandingDb);
  if (existing) return existing;
  const [created] = await brandingDb.insert(brandingSettings).values(defaultBrandingSettings).returning();
  return created;
};

const updateBrandingSettings = async (
  brandingDb: any,
  payload: BrandingPayload,
  updatedByUserId?: number,
): Promise<BrandingRow> => {
  const current = await getOrCreateBrandingSettings(brandingDb);
  const normalized = normalizeBrandingPayload(payload);

  const [updated] = await brandingDb
    .update(brandingSettings)
    .set({
      primaryColor: normalized.primaryColor,
      secondaryColor: normalized.secondaryColor,
      accentColor: normalized.accentColor,
      announcementBarBackgroundColor: normalized.announcementBarBackgroundColor,
      announcementBarTextColor: normalized.announcementBarTextColor,
      headerBackgroundColor: normalized.headerBackgroundColor,
      sidebarBackgroundColor: normalized.sidebarBackgroundColor,
      sidebarHoverColor: normalized.sidebarHoverColor,
      badgeBackgroundColor: normalized.badgeBackgroundColor,
      logoUrl: normalized.logoUrl,
      faviconUrl: normalized.faviconUrl,
      heroMediaItems: normalized.heroMediaItems,
      heroBackgroundType: normalized.heroBackgroundType,
      heroBackgroundUrl: normalized.heroBackgroundUrl,
      heroBackgroundVideoUrl: normalized.heroBackgroundVideoUrl,
      heroTitle: normalized.heroTitle,
      heroSubtitle: normalized.heroSubtitle,
      statsCourses: normalized.statsCourses,
      statsCoaches: normalized.statsCoaches,
      statsUsers: normalized.statsUsers,
      statsWorkoutsCompleted: normalized.statsWorkoutsCompleted,
      statsNutritionPlans: normalized.statsNutritionPlans,
      statsMealsLogged: normalized.statsMealsLogged,
      showHeroSection: normalized.showHeroSection,
      showFeaturesSection: normalized.showFeaturesSection,
      showPricingSection: normalized.showPricingSection,
      showCtaSection: normalized.showCtaSection,
      updatedByUserId: updatedByUserId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(brandingSettings.id, current.id))
    .returning();

  return updated;
};

const getResolvedBrandingSettings = async (req: Request): Promise<BrandingRow> => {
  const tenantDb = resolveTenantDb(req);
  if (!tenantDb) {
    return getOrCreateBrandingSettings(db);
  }
  return getOrCreateBrandingSettings(tenantDb);
};

export function registerBrandingRoutes(app: Express) {
  app.get("/api/branding", async (req: Request, res: Response) => {
    try {
      const settings = await getResolvedBrandingSettings(req);
      res.json({ settings });
    } catch (error) {
      console.error("[BRANDING] Failed to fetch resolved branding settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "fetchFailed") });
    }
  });

  app.get("/api/admin/branding", async (req: Request, res: Response) => {
    if ((req as any).tenantPool) {
      return res.status(403).json({ message: getLocalizedMessage(req, "adminRequired") });
    }
    if (!isCentralAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    try {
      const settings = await getOrCreateBrandingSettings(db);
      res.json({ settings });
    } catch (error) {
      console.error("[BRANDING] Failed to fetch central branding settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "fetchFailed") });
    }
  });

  app.put("/api/admin/branding", async (req: Request, res: Response) => {
    if ((req as any).tenantPool) {
      return res.status(403).json({ message: getLocalizedMessage(req, "adminRequired") });
    }
    if (!isCentralAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    const parsed = brandingSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: getLocalizedMessage(req, "invalidPayload") });
    }

    try {
      const currentUser = req.user as any;
      const updated = await updateBrandingSettings(db, parsed.data, currentUser?.id);
      res.json({ settings: updated });
    } catch (error) {
      console.error("[BRANDING] Failed to update central branding settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "updateFailed") });
    }
  });

  app.get("/api/tenant/branding", async (req: Request, res: Response) => {
    const tenantDb = resolveTenantDb(req);
    if (!tenantDb) {
      return res.status(400).json({ message: getLocalizedMessage(req, "tenantRequired") });
    }
    if (!isTenantAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    try {
      const settings = await getResolvedBrandingSettings(req);
      res.json({ settings });
    } catch (error) {
      console.error("[BRANDING] Failed to fetch tenant branding settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "fetchFailed") });
    }
  });

  app.put("/api/tenant/branding", async (req: Request, res: Response) => {
    const tenantDb = resolveTenantDb(req);
    if (!tenantDb) {
      return res.status(400).json({ message: getLocalizedMessage(req, "tenantRequired") });
    }
    if (!isTenantAdmin(req)) {
      return res.status(req.user ? 403 : 401).json({ message: getLocalizedMessage(req, "adminRequired") });
    }

    const parsed = brandingSettingsSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ message: getLocalizedMessage(req, "invalidPayload") });
    }

    try {
      const currentUser = req.user as any;
      const updated = await updateBrandingSettings(tenantDb, parsed.data, currentUser?.id);
      res.json({ settings: updated });
    } catch (error) {
      console.error("[BRANDING] Failed to update tenant branding settings:", error);
      res.status(500).json({ message: getLocalizedMessage(req, "updateFailed") });
    }
  });
}
