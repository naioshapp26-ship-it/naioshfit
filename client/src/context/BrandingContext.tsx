import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type BrandMediaItem = {
  url: string;
  type: "image" | "video";
};

interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  announcementBarBackgroundColor: string;
  announcementBarTextColor: string;
  headerBackgroundColor: string;
  sidebarBackgroundColor: string;
  sidebarHoverColor: string;
  badgeBackgroundColor: string;
  logoUrl: string;
  faviconUrl: string;
  heroMediaItems: BrandMediaItem[];
  heroBackgroundType: "image" | "video";
  heroBackgroundUrl: string;
  heroBackgroundVideoUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  statsCourses: number;
  statsCoaches: number;
  statsUsers: number;
  statsWorkoutsCompleted: number;
  statsNutritionPlans: number;
  statsMealsLogged: number;
  showHeroSection: boolean;
  showFeaturesSection: boolean;
  showPricingSection: boolean;
  showCtaSection: boolean;
}

interface BrandingContextValue {
  settings: BrandingSettings;
  isLoaded: boolean;
}

const defaultBranding: BrandingSettings = {
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
};

export const DEFAULT_LOGO_ASSET = "/naioshfit-logo-new.png";
export const DEFAULT_FAVICON_ASSET = "/naioshfit-logo-new.png?v=3";

export const resolveBrandAsset = (value: string | null | undefined, fallback: string) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

let manifestBlobUrl: string | null = null;

const BrandingContext = createContext<BrandingContextValue>({
  settings: defaultBranding,
  isLoaded: false,
});

const hexToRgb = (hex: string) => {
  const normalized = hex.trim().replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

const rgbToHsl = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === red) {
      h = ((green - blue) / delta) % 6;
    } else if (max === green) {
      h = (blue - red) / delta + 2;
    } else {
      h = (red - green) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Number((s * 100).toFixed(1)),
    l: Number((l * 100).toFixed(1)),
  };
};

const toHslToken = (hex: string) => {
  const hsl = rgbToHsl(hexToRgb(hex));
  return `${hsl.h} ${hsl.s}% ${hsl.l}%`;
};

const withLightness = (hex: string, delta: number) => {
  const hsl = rgbToHsl(hexToRgb(hex));
  const nextLightness = Math.max(5, Math.min(95, hsl.l + delta));
  return `${hsl.h} ${hsl.s}% ${nextLightness}%`;
};

const getReadableForeground = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? "#111827" : "#ffffff";
};

const setHeadLink = (selector: string, attributes: Record<string, string>) => {
  if (typeof document === "undefined") return;

  let link = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    document.head.appendChild(link);
  }

  for (const [key, value] of Object.entries(attributes)) {
    link.setAttribute(key, value);
  }
};

const applyBrandingAssetsToDocument = async (settings: BrandingSettings) => {
  if (typeof document === "undefined") return;

  const faviconUrl = resolveBrandAsset(settings.faviconUrl, DEFAULT_FAVICON_ASSET);
  setHeadLink('link[rel="icon"]', { rel: "icon", type: "image/png", href: faviconUrl });
  setHeadLink('link[rel="shortcut icon"]', { rel: "shortcut icon", href: faviconUrl });

  const appleTouchIcons = Array.from(document.head.querySelectorAll('link[rel="apple-touch-icon"]')) as HTMLLinkElement[];
  if (appleTouchIcons.length === 0) {
    setHeadLink('link[rel="apple-touch-icon"]', { rel: "apple-touch-icon", href: faviconUrl });
  } else {
    appleTouchIcons.forEach((iconLink) => {
      iconLink.setAttribute("href", faviconUrl);
    });
  }

  const themeMeta = document.head.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", settings.primaryColor);
  }

  const manifestLink = document.head.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (!manifestLink) return;

  const originalHref = manifestLink.dataset.originalHref || manifestLink.getAttribute("href") || "/manifest.json";
  manifestLink.dataset.originalHref = originalHref;

  if (manifestBlobUrl) {
    URL.revokeObjectURL(manifestBlobUrl);
    manifestBlobUrl = null;
  }

  try {
    const response = await fetch(originalHref, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load manifest");
    }

    const manifest = await response.json();
    const iconDefinitions = Array.isArray(manifest?.icons) ? manifest.icons : [];
    const nextIcons = iconDefinitions.length
      ? iconDefinitions.map((icon: any) => ({ ...icon, src: faviconUrl }))
      : [
          { src: faviconUrl, sizes: "192x192", type: "image/png", purpose: "maskable any" },
          { src: faviconUrl, sizes: "512x512", type: "image/png", purpose: "maskable any" },
        ];

    const nextShortcuts = Array.isArray(manifest?.shortcuts)
      ? manifest.shortcuts.map((shortcut: any) => ({
          ...shortcut,
          icons: Array.isArray(shortcut?.icons)
            ? shortcut.icons.map((icon: any) => ({ ...icon, src: faviconUrl }))
            : [{ src: faviconUrl, sizes: "192x192", type: "image/png" }],
        }))
      : manifest?.shortcuts;

    const nextManifest = {
      ...manifest,
      icons: nextIcons,
      shortcuts: nextShortcuts,
      theme_color: settings.primaryColor,
    };

    manifestBlobUrl = URL.createObjectURL(
      new Blob([JSON.stringify(nextManifest)], { type: "application/manifest+json" }),
    );
    manifestLink.href = manifestBlobUrl;
  } catch {
    manifestLink.href = originalHref;
  }
};

const applyBrandingToDocument = (settings: BrandingSettings) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement.style;
  const primaryForeground = getReadableForeground(settings.primaryColor);
  const secondaryForeground = getReadableForeground(settings.secondaryColor);
  const accentForeground = getReadableForeground(settings.accentColor);
  const headerForeground = getReadableForeground(settings.headerBackgroundColor);
  const sidebarForeground = getReadableForeground(settings.sidebarBackgroundColor);
  const badgeForeground = getReadableForeground(settings.badgeBackgroundColor);

  root.setProperty("--primary", toHslToken(settings.primaryColor));
  root.setProperty("--primary-foreground", toHslToken(primaryForeground));
  root.setProperty("--secondary", toHslToken(settings.secondaryColor));
  root.setProperty("--secondary-foreground", toHslToken(secondaryForeground));
  root.setProperty("--accent", toHslToken(settings.accentColor));
  root.setProperty("--accent-foreground", toHslToken(accentForeground));
  root.setProperty("--ring", toHslToken(settings.primaryColor));

  root.setProperty("--sidebar-background", toHslToken(settings.sidebarBackgroundColor));
  root.setProperty("--sidebar-foreground", toHslToken(sidebarForeground));
  root.setProperty("--sidebar-primary", toHslToken(settings.primaryColor));
  root.setProperty("--sidebar-primary-foreground", toHslToken(primaryForeground));
  root.setProperty("--sidebar-accent", toHslToken(settings.sidebarHoverColor));
  root.setProperty("--sidebar-accent-foreground", toHslToken(getReadableForeground(settings.sidebarHoverColor)));
  root.setProperty("--sidebar-border", withLightness(settings.sidebarBackgroundColor, -10));
  root.setProperty("--sidebar-ring", toHslToken(settings.accentColor));

  root.setProperty("--brand-header-bg", toHslToken(settings.headerBackgroundColor));
  root.setProperty("--brand-header-fg", toHslToken(headerForeground));
  root.setProperty("--brand-sidebar-bg", toHslToken(settings.sidebarBackgroundColor));
  root.setProperty("--brand-sidebar-bg-2", withLightness(settings.sidebarBackgroundColor, -7));
  root.setProperty("--brand-sidebar-bg-3", withLightness(settings.sidebarBackgroundColor, -14));
  root.setProperty("--brand-sidebar-hover", toHslToken(settings.sidebarHoverColor));
  root.setProperty("--brand-sidebar-border", withLightness(settings.sidebarBackgroundColor, 14));
  root.setProperty("--brand-sidebar-fg", toHslToken(sidebarForeground));
  root.setProperty("--brand-badge-bg", toHslToken(settings.badgeBackgroundColor));
  root.setProperty("--brand-badge-fg", toHslToken(badgeForeground));
  root.setProperty("--announcement-bar-bg", toHslToken(settings.announcementBarBackgroundColor));
  root.setProperty("--announcement-bar-fg", toHslToken(settings.announcementBarTextColor));

  void applyBrandingAssetsToDocument(settings);
};

const normalizeHeroMediaItems = (input: unknown): BrandMediaItem[] => {
  const items = (() => {
    if (Array.isArray(input)) return input;
    if (typeof input === "string") {
      try {
        const parsed = JSON.parse(input);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  const looksLikeVideo = (url: string) => /(youtube\.com|youtu\.be|\.(mp4|webm|ogg|mov|m4v)(\?|#|$))/i.test(url);
  const looksLikeImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|ico)(\?|#|$)/i.test(url);

  return items
    .map((item) => {
      if (typeof item === "string") {
        const raw = item.trim();
        if (!raw) return null;
        const normalized = raw.startsWith("www.") ? `https://${raw}` : raw;
        const type: "image" | "video" = looksLikeVideo(normalized)
          ? "video"
          : looksLikeImage(normalized)
            ? "image"
            : "image";
        return { url: normalized, type } as BrandMediaItem;
      }

      if (!item || typeof item !== "object") return null;
      const candidate = item as any;
      const rawUrl =
        typeof candidate.url === "string"
          ? candidate.url.trim()
          : typeof candidate.mediaUrl === "string"
            ? candidate.mediaUrl.trim()
            : typeof candidate.src === "string"
              ? candidate.src.trim()
              : "";
      if (!rawUrl) return null;

      const normalizedUrl = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
      const explicitType =
        candidate.type === "video" || candidate.mediaType === "video"
          ? "video"
          : candidate.type === "image" || candidate.mediaType === "image"
            ? "image"
            : null;

      const inferredType = looksLikeVideo(normalizedUrl)
        ? "video"
        : looksLikeImage(normalizedUrl)
          ? "image"
          : null;

      return {
        url: normalizedUrl,
        type: (explicitType || inferredType || "image") as "image" | "video",
      } as BrandMediaItem;
    })
    .filter((item): item is BrandMediaItem => Boolean(item));
};

const coerceBrandingSettings = (input: any): BrandingSettings => ({
  primaryColor: input?.primaryColor || defaultBranding.primaryColor,
  secondaryColor: input?.secondaryColor || defaultBranding.secondaryColor,
  accentColor: input?.accentColor || defaultBranding.accentColor,
  announcementBarBackgroundColor: input?.announcementBarBackgroundColor || defaultBranding.announcementBarBackgroundColor,
  announcementBarTextColor: input?.announcementBarTextColor || defaultBranding.announcementBarTextColor,
  headerBackgroundColor: input?.headerBackgroundColor || defaultBranding.headerBackgroundColor,
  sidebarBackgroundColor: input?.sidebarBackgroundColor || defaultBranding.sidebarBackgroundColor,
  sidebarHoverColor: input?.sidebarHoverColor || defaultBranding.sidebarHoverColor,
  badgeBackgroundColor: input?.badgeBackgroundColor || defaultBranding.badgeBackgroundColor,
  logoUrl: input?.logoUrl || defaultBranding.logoUrl,
  faviconUrl: input?.faviconUrl || defaultBranding.faviconUrl,
  heroMediaItems: normalizeHeroMediaItems(input?.heroMediaItems),
  heroBackgroundType: input?.heroBackgroundType === "video" ? "video" : defaultBranding.heroBackgroundType,
  heroBackgroundUrl: input?.heroBackgroundUrl || defaultBranding.heroBackgroundUrl,
  heroBackgroundVideoUrl: input?.heroBackgroundVideoUrl || defaultBranding.heroBackgroundVideoUrl,
  heroTitle: input?.heroTitle || defaultBranding.heroTitle,
  heroSubtitle: input?.heroSubtitle || defaultBranding.heroSubtitle,
  statsCourses: Number.isFinite(Number(input?.statsCourses)) ? Math.max(0, Number(input.statsCourses)) : defaultBranding.statsCourses,
  statsCoaches: Number.isFinite(Number(input?.statsCoaches)) ? Math.max(0, Number(input.statsCoaches)) : defaultBranding.statsCoaches,
  statsUsers: Number.isFinite(Number(input?.statsUsers)) ? Math.max(0, Number(input.statsUsers)) : defaultBranding.statsUsers,
  statsWorkoutsCompleted: Number.isFinite(Number(input?.statsWorkoutsCompleted)) ? Math.max(0, Number(input.statsWorkoutsCompleted)) : defaultBranding.statsWorkoutsCompleted,
  statsNutritionPlans: Number.isFinite(Number(input?.statsNutritionPlans)) ? Math.max(0, Number(input.statsNutritionPlans)) : defaultBranding.statsNutritionPlans,
  statsMealsLogged: Number.isFinite(Number(input?.statsMealsLogged)) ? Math.max(0, Number(input.statsMealsLogged)) : defaultBranding.statsMealsLogged,
  showHeroSection: input?.showHeroSection ?? defaultBranding.showHeroSection,
  showFeaturesSection: input?.showFeaturesSection ?? defaultBranding.showFeaturesSection,
  showPricingSection: input?.showPricingSection ?? defaultBranding.showPricingSection,
  showCtaSection: input?.showCtaSection ?? defaultBranding.showCtaSection,
});

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<BrandingSettings>(defaultBranding);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    const onBrandingUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<BrandingSettings>;
      const next = coerceBrandingSettings(customEvent.detail);
      if (!next) return;
      setSettings(next);
      applyBrandingToDocument(next);
    };

    window.addEventListener("branding:updated", onBrandingUpdated as EventListener);

    const loadBranding = async () => {
      try {
        const response = await fetch("/api/branding", { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to fetch branding settings");
        }

        const payload = await response.json();
        const nextSettings = coerceBrandingSettings(payload?.settings);

        if (!isActive) return;
        setSettings(nextSettings);
        applyBrandingToDocument(nextSettings);
      } catch {
        if (!isActive) return;
        setSettings(defaultBranding);
        applyBrandingToDocument(defaultBranding);
      } finally {
        if (isActive) {
          setIsLoaded(true);
        }
      }
    };

    loadBranding();

    return () => {
      isActive = false;
      window.removeEventListener("branding:updated", onBrandingUpdated as EventListener);
      if (manifestBlobUrl) {
        URL.revokeObjectURL(manifestBlobUrl);
        manifestBlobUrl = null;
      }
    };
  }, []);

  const value = useMemo(() => ({ settings, isLoaded }), [settings, isLoaded]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);
