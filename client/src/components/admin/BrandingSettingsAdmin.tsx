import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MediaUpload } from "@/components/ui/media-upload";
import { MediaGalleryManager, type MediaGalleryItem } from "@/components/media/MediaGalleryManager";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { DEFAULT_LOGO_ASSET, resolveBrandAsset } from "@/context/BrandingContext";

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
  heroMediaItems: MediaGalleryItem[];
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

type BrandingColorKey =
  | "primaryColor"
  | "secondaryColor"
  | "accentColor"
  | "announcementBarBackgroundColor"
  | "announcementBarTextColor"
  | "headerBackgroundColor"
  | "sidebarBackgroundColor"
  | "sidebarHoverColor"
  | "badgeBackgroundColor";

type BrandingAssetKey = "logoUrl" | "faviconUrl";
type BrandingSectionToggleKey = "showHeroSection" | "showFeaturesSection" | "showPricingSection" | "showCtaSection";
type BrandingStatKey =
  | "statsCourses"
  | "statsCoaches"
  | "statsUsers"
  | "statsWorkoutsCompleted"
  | "statsNutritionPlans"
  | "statsMealsLogged";

const defaultSettings: BrandingSettings = {
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

const isHexColor = (value: string) => /^#([0-9a-fA-F]{6})$/.test(value.trim());
const isAssetUrl = (value: string) => {
  const normalized = value.trim();
  return normalized === "" || normalized.startsWith("/") || /^https?:\/\//i.test(normalized);
};

const normalizeHex = (value: string) => value.trim().toLowerCase();
const normalizeText = (value: string) => value.trim();

const normalizeMediaItemsForDraft = (input: unknown): MediaGalleryItem[] => {
  const raw = Array.isArray(input) ? input : [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rawUrl = typeof (item as any).url === "string" ? (item as any).url.trim() : "";
      const normalizedUrl = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
      const type = (item as any).type === "video" ? "video" : "image";
      return { url: normalizedUrl, type } as MediaGalleryItem;
    })
    .filter((item): item is MediaGalleryItem => Boolean(item));
};

const normalizeMediaItemsForSave = (input: unknown): MediaGalleryItem[] => {
  return normalizeMediaItemsForDraft(input).filter((item) => Boolean(item.url.trim()));
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHex(hex).replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

const getReadableText = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.5 ? "#111827" : "#ffffff";
};

export default function BrandingSettingsAdmin() {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const isTenantSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    return parts.length > 2 && parts[0] !== "www";
  }, []);

  const endpointBase = isTenantSubdomain ? "/api/tenant/branding" : "/api/admin/branding";

  const [form, setForm] = useState<BrandingSettings>(defaultSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: [endpointBase],
    queryFn: async () => {
      const response = await apiRequest("GET", endpointBase);
      return response.json();
    },
  });

  useEffect(() => {
    const settings: BrandingSettings | undefined = data?.settings;
    if (!settings) return;
    setForm({
      primaryColor: settings.primaryColor || defaultSettings.primaryColor,
      secondaryColor: settings.secondaryColor || defaultSettings.secondaryColor,
      accentColor: settings.accentColor || defaultSettings.accentColor,
      announcementBarBackgroundColor: settings.announcementBarBackgroundColor || defaultSettings.announcementBarBackgroundColor,
      announcementBarTextColor: settings.announcementBarTextColor || defaultSettings.announcementBarTextColor,
      headerBackgroundColor: settings.headerBackgroundColor || defaultSettings.headerBackgroundColor,
      sidebarBackgroundColor: settings.sidebarBackgroundColor || defaultSettings.sidebarBackgroundColor,
      sidebarHoverColor: settings.sidebarHoverColor || defaultSettings.sidebarHoverColor,
      badgeBackgroundColor: settings.badgeBackgroundColor || defaultSettings.badgeBackgroundColor,
      logoUrl: settings.logoUrl || defaultSettings.logoUrl,
      faviconUrl: settings.faviconUrl || defaultSettings.faviconUrl,
      heroMediaItems: normalizeMediaItemsForDraft((settings as any).heroMediaItems),
      heroBackgroundType: settings.heroBackgroundType === "video" ? "video" : "image",
      heroBackgroundUrl: settings.heroBackgroundUrl || defaultSettings.heroBackgroundUrl,
      heroBackgroundVideoUrl: settings.heroBackgroundVideoUrl || defaultSettings.heroBackgroundVideoUrl,
      heroTitle: settings.heroTitle || defaultSettings.heroTitle,
      heroSubtitle: settings.heroSubtitle || defaultSettings.heroSubtitle,
      statsCourses: Number.isFinite(Number(settings.statsCourses)) ? Math.max(0, Number(settings.statsCourses)) : defaultSettings.statsCourses,
      statsCoaches: Number.isFinite(Number(settings.statsCoaches)) ? Math.max(0, Number(settings.statsCoaches)) : defaultSettings.statsCoaches,
      statsUsers: Number.isFinite(Number(settings.statsUsers)) ? Math.max(0, Number(settings.statsUsers)) : defaultSettings.statsUsers,
      statsWorkoutsCompleted: Number.isFinite(Number(settings.statsWorkoutsCompleted)) ? Math.max(0, Number(settings.statsWorkoutsCompleted)) : defaultSettings.statsWorkoutsCompleted,
      statsNutritionPlans: Number.isFinite(Number(settings.statsNutritionPlans)) ? Math.max(0, Number(settings.statsNutritionPlans)) : defaultSettings.statsNutritionPlans,
      statsMealsLogged: Number.isFinite(Number(settings.statsMealsLogged)) ? Math.max(0, Number(settings.statsMealsLogged)) : defaultSettings.statsMealsLogged,
      showHeroSection: settings.showHeroSection ?? defaultSettings.showHeroSection,
      showFeaturesSection: settings.showFeaturesSection ?? defaultSettings.showFeaturesSection,
      showPricingSection: settings.showPricingSection ?? defaultSettings.showPricingSection,
      showCtaSection: settings.showCtaSection ?? defaultSettings.showCtaSection,
    });
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: BrandingSettings) => {
      const response = await apiRequest("PUT", endpointBase, payload);
      return response.json();
    },
    onSuccess: (payload) => {
      if (payload?.settings) {
        setForm(payload.settings);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("branding:updated", { detail: payload.settings }));
        }
      }
      toast({
        title: t("settingsSaved") || "Settings saved",
        description: t("brandingSaved") || "Branding colors were updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("error") || "Error",
        description: error.message || (t("brandingSaveFailed") || "Failed to save branding settings."),
        variant: "destructive",
      });
    },
  });

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const entries: Array<[BrandingColorKey, string]> = [
      ["primaryColor", t("brandingPrimaryColor") || "Primary color"],
      ["secondaryColor", t("brandingSecondaryColor") || "Secondary color"],
      ["accentColor", t("brandingAccentColor") || "Accent color"],
      ["announcementBarBackgroundColor", t("brandingAnnouncementBarBackground") || "Announcement bar background"],
      ["announcementBarTextColor", t("brandingAnnouncementBarText") || "Announcement bar text"],
      ["headerBackgroundColor", t("brandingHeaderBackground") || "Header background"],
      ["sidebarBackgroundColor", t("brandingSidebarBackground") || "Sidebar background"],
      ["sidebarHoverColor", t("brandingSidebarHover") || "Sidebar hover"],
      ["badgeBackgroundColor", t("brandingBadgeColor") || "Badge color"],
    ];

    for (const [key, label] of entries) {
      if (!isHexColor(form[key])) {
        nextErrors[key] = (t("brandingColorInvalid") || "{field} must be a valid HEX color.").replace("{field}", label);
      }
    }

    const assetEntries: Array<[BrandingAssetKey, string]> = [
      ["logoUrl", t("brandingLogo") || "Logo"],
      ["faviconUrl", t("brandingFavicon") || "Favicon"],
    ];

    for (const [key, label] of assetEntries) {
      const value = form[key];
      if (!isAssetUrl(value)) {
        nextErrors[key] = (t("brandingAssetUrlInvalid") || "{field} must be a valid URL or relative path.").replace("{field}", label);
      }
    }

    const statEntries: Array<[BrandingStatKey, string]> = [
      ["statsCourses", t("statsCourses") || "Courses"],
      ["statsCoaches", t("statsCoaches") || "Coaches"],
      ["statsUsers", t("statsUsers") || "Users"],
      ["statsWorkoutsCompleted", t("statsWorkoutsCompleted") || "Workouts Completed"],
      ["statsNutritionPlans", t("statsNutritionPlans") || "Nutrition Plans"],
      ["statsMealsLogged", t("statsMealsLogged") || "Meals Logged"],
    ];

    for (const [key, label] of statEntries) {
      if (!Number.isFinite(Number(form[key])) || Number(form[key]) < 0) {
        nextErrors[key] = (t("brandingStatInvalid") || "{field} must be a positive number.").replace("{field}", label);
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSave = () => {
    if (!validate()) {
      toast({
        title: t("error") || "Error",
        description: t("brandingFixValidation") || "Please fix color validation errors before saving.",
        variant: "destructive",
      });
      return;
    }

    const heroMediaItems = normalizeMediaItemsForSave(form.heroMediaItems);
    const firstMediaItem = heroMediaItems[0];
    const firstImage = heroMediaItems.find((item) => item.type === "image");
    const firstVideo = heroMediaItems.find((item) => item.type === "video");

    updateMutation.mutate({
      primaryColor: normalizeHex(form.primaryColor),
      secondaryColor: normalizeHex(form.secondaryColor),
      accentColor: normalizeHex(form.accentColor),
      announcementBarBackgroundColor: normalizeHex(form.announcementBarBackgroundColor),
      announcementBarTextColor: normalizeHex(form.announcementBarTextColor),
      headerBackgroundColor: normalizeHex(form.headerBackgroundColor),
      sidebarBackgroundColor: normalizeHex(form.sidebarBackgroundColor),
      sidebarHoverColor: normalizeHex(form.sidebarHoverColor),
      badgeBackgroundColor: normalizeHex(form.badgeBackgroundColor),
      logoUrl: normalizeText(form.logoUrl),
      faviconUrl: normalizeText(form.faviconUrl),
      heroMediaItems,
      heroBackgroundType: firstMediaItem?.type || "image",
      heroBackgroundUrl: firstImage?.url || (firstMediaItem?.type === "image" ? firstMediaItem.url : ""),
      heroBackgroundVideoUrl: firstVideo?.url || (firstMediaItem?.type === "video" ? firstMediaItem.url : ""),
      heroTitle: normalizeText(form.heroTitle),
      heroSubtitle: normalizeText(form.heroSubtitle),
      statsCourses: Math.max(0, Number(form.statsCourses) || 0),
      statsCoaches: Math.max(0, Number(form.statsCoaches) || 0),
      statsUsers: Math.max(0, Number(form.statsUsers) || 0),
      statsWorkoutsCompleted: Math.max(0, Number(form.statsWorkoutsCompleted) || 0),
      statsNutritionPlans: Math.max(0, Number(form.statsNutritionPlans) || 0),
      statsMealsLogged: Math.max(0, Number(form.statsMealsLogged) || 0),
      showHeroSection: form.showHeroSection,
      showFeaturesSection: form.showFeaturesSection,
      showPricingSection: form.showPricingSection,
      showCtaSection: form.showCtaSection,
    });
  };

  const colorFields: Array<{ key: BrandingColorKey; label: string }> = [
    { key: "primaryColor", label: t("brandingPrimaryColor") || "Primary color" },
    { key: "secondaryColor", label: t("brandingSecondaryColor") || "Secondary color" },
    { key: "accentColor", label: t("brandingAccentColor") || "Accent color" },
    { key: "announcementBarBackgroundColor", label: t("brandingAnnouncementBarBackground") || "Announcement bar background" },
    { key: "announcementBarTextColor", label: t("brandingAnnouncementBarText") || "Announcement bar text" },
    { key: "headerBackgroundColor", label: t("brandingHeaderBackground") || "Header background" },
    { key: "sidebarBackgroundColor", label: t("brandingSidebarBackground") || "Sidebar background" },
    { key: "sidebarHoverColor", label: t("brandingSidebarHover") || "Sidebar hover" },
    { key: "badgeBackgroundColor", label: t("brandingBadgeColor") || "Badge color" },
  ];

  const sectionToggles: Array<{ key: BrandingSectionToggleKey; label: string; description: string }> = [
    {
      key: "showHeroSection",
      label: t("brandingShowHero") || "Show hero section",
      description: t("brandingShowHeroDesc") || "Display the top hero banner on the home page.",
    },
    {
      key: "showFeaturesSection",
      label: t("brandingShowFeatures") || "Show features section",
      description: t("brandingShowFeaturesDesc") || "Display the features cards section.",
    },
    {
      key: "showPricingSection",
      label: t("brandingShowPricing") || "Show pricing section",
      description: t("brandingShowPricingDesc") || "Display public bundle and subscription pricing section.",
    },
    {
      key: "showCtaSection",
      label: t("brandingShowCta") || "Show CTA section",
      description: t("brandingShowCtaDesc") || "Display the final call-to-action section.",
    },
  ];

  const previewLogoUrl = resolveBrandAsset(form.logoUrl, DEFAULT_LOGO_ASSET);
  const previewHeroTitle = form.heroTitle.trim() || `${t("transformYourBody")} ${t("elevateYourLife")}`;
  const previewHeroSubtitle = form.heroSubtitle.trim() || (t("allInOnePlatform") || "");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("brandingTitle") || "Branding"}</CardTitle>
        <CardDescription>
          {t("brandingDescription") || "Customize your platform colors and keep your brand identity consistent across buttons, links, icons, headers, sidebar, and badges."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 rounded bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {colorFields.map((field) => {
                const value = form[field.key];
                return (
                  <div key={field.key} className="space-y-2">
                    <Label>{field.label}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={isHexColor(value) ? value : "#000000"}
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                          setErrors((prev) => ({ ...prev, [field.key]: "" }));
                        }}
                        className="h-10 w-16 p-1"
                      />
                      <Input
                        value={value}
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                        }}
                        placeholder="#000000"
                      />
                    </div>
                    {errors[field.key] && <p className="text-sm text-red-600">{errors[field.key]}</p>}
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">{t("brandingAssetsTitle") || "Brand assets"}</h3>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <MediaUpload
                    label={t("brandingLogo") || "Logo"}
                    value={form.logoUrl}
                    onChange={(url) => {
                      setForm((prev) => ({ ...prev, logoUrl: url }));
                      setErrors((prev) => ({ ...prev, logoUrl: "" }));
                    }}
                    accept="image/*"
                    mediaType="image"
                    placeholder="https://..."
                  />
                  {errors.logoUrl && <p className="text-sm text-red-600">{errors.logoUrl}</p>}
                </div>

                <div className="space-y-2">
                  <MediaUpload
                    label={t("brandingFavicon") || "Favicon"}
                    value={form.faviconUrl}
                    onChange={(url) => {
                      setForm((prev) => ({ ...prev, faviconUrl: url }));
                      setErrors((prev) => ({ ...prev, faviconUrl: "" }));
                    }}
                    accept="image/*"
                    mediaType="image"
                    placeholder="https://..."
                  />
                  {errors.faviconUrl && <p className="text-sm text-red-600">{errors.faviconUrl}</p>}
                </div>
              </div>

              <MediaGalleryManager
                label={t("brandingHeroBackground") || (language === "ar" ? "وسائط الهيرو" : "Hero media gallery")}
                items={form.heroMediaItems}
                onChange={(items) => setForm((prev) => ({ ...prev, heroMediaItems: items }))}
                isRTL={language === "ar"}
                addButtonLabel={language === "ar" ? "إضافة وسيط" : "Add media item"}
                emptyText={language === "ar" ? "لا توجد وسائط للهيرو" : "No hero media items yet"}
              />
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">{t("brandingStatsTitle") || "Homepage statistics"}</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { key: "statsCourses", label: t("statsCourses") || "Courses" },
                  { key: "statsCoaches", label: t("statsCoaches") || "Coaches" },
                  { key: "statsUsers", label: t("statsUsers") || "Users" },
                  { key: "statsWorkoutsCompleted", label: t("statsWorkoutsCompleted") || "Workouts Completed" },
                  { key: "statsNutritionPlans", label: t("statsNutritionPlans") || "Nutrition Plans" },
                  { key: "statsMealsLogged", label: t("statsMealsLogged") || "Meals Logged" },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>{field.label}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={String(form[field.key as BrandingStatKey])}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setForm((prev) => ({
                          ...prev,
                          [field.key]: Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : 0,
                        }));
                        setErrors((prev) => ({ ...prev, [field.key]: "" }));
                      }}
                    />
                    {errors[field.key] && <p className="text-sm text-red-600">{errors[field.key]}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">{t("brandingHeroContentTitle") || "Hero content"}</h3>

              <div className="space-y-2">
                <Label>{t("brandingHeroTitle") || "Hero title"}</Label>
                <Input
                  value={form.heroTitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, heroTitle: event.target.value }))}
                  placeholder={t("transformYourBody") || "Transform your body"}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("brandingHeroSubtitle") || "Hero subtitle"}</Label>
                <Input
                  value={form.heroSubtitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, heroSubtitle: event.target.value }))}
                  placeholder={t("allInOnePlatform") || "All in one fitness platform"}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">{t("brandingHomeSectionsTitle") || "Home sections visibility"}</h3>
              {sectionToggles.map((toggle) => (
                <div key={toggle.key} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{toggle.label}</p>
                    <p className="text-xs text-gray-600">{toggle.description}</p>
                  </div>
                  <Switch
                    checked={Boolean(form[toggle.key])}
                    onCheckedChange={(value) => {
                      setForm((prev) => ({ ...prev, [toggle.key]: value }));
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">{t("brandingPreview") || "Live preview"}</h3>
              <div
                className="rounded-md p-3 border"
                style={{ backgroundColor: form.headerBackgroundColor, color: getReadableText(form.headerBackgroundColor) }}
              >
                {t("brandingHeaderExample") || "Header example"}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <img
                  src={previewLogoUrl}
                  alt="Brand logo"
                  className="h-10 w-auto rounded-sm border bg-white px-2 py-1"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_LOGO_ASSET;
                  }}
                />
                <Button style={{ backgroundColor: form.primaryColor, color: getReadableText(form.primaryColor) }}>
                  {t("brandingButtonPreview") || "Primary button"}
                </Button>
                <a href="#" style={{ color: form.primaryColor }} className="underline text-sm">
                  {t("brandingLinkPreview") || "Link preview"}
                </a>
                <Badge style={{ backgroundColor: form.badgeBackgroundColor, color: getReadableText(form.badgeBackgroundColor) }}>
                  {t("brandingBadgePreview") || "Badge"}
                </Badge>
                <span style={{ color: form.accentColor }} className="text-sm font-medium">
                  {t("brandingHighlightPreview") || "Accent highlight"}
                </span>
              </div>
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="text-sm font-semibold">{previewHeroTitle}</p>
                {previewHeroSubtitle && (
                  <p className="mt-1 text-xs text-muted-foreground">{previewHeroSubtitle}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {language === "ar" ? `عدد الوسائط: ${form.heroMediaItems.length}` : `Media items: ${form.heroMediaItems.length}`}
                </p>
              </div>
              <div
                className="rounded-md px-3 py-2 text-sm"
                style={{
                  backgroundColor: form.sidebarBackgroundColor,
                  color: getReadableText(form.sidebarBackgroundColor),
                }}
              >
                {t("brandingSidebarPreview") || "Sidebar background"}
                <div
                  className="mt-2 rounded px-2 py-1"
                  style={{
                    backgroundColor: form.sidebarHoverColor,
                    color: getReadableText(form.sidebarHoverColor),
                  }}
                >
                  {t("brandingSidebarHoverPreview") || "Sidebar hover item"}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending
                  ? (t("saving") || "Saving...")
                  : (t("saveBranding") || "Save branding")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
