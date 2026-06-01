import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import { apiRequest } from "@/lib/queryClient";

interface SeoSettings {
  titleTemplate: string;
  titleTemplateEn: string;
  titleTemplateAr: string;
  metaDescription: string;
  metaDescriptionEn: string;
  metaDescriptionAr: string;
  metaKeywordsEn: string | null;
  metaKeywordsAr: string | null;
  metaAuthor: string | null;
  metaViewport: string | null;
  ogTitle: string | null;
  ogTitleEn: string | null;
  ogTitleAr: string | null;
  ogDescription: string | null;
  ogDescriptionEn: string | null;
  ogDescriptionAr: string | null;
  ogImageUrl: string | null;
  ogType: string | null;
  ogSiteName: string | null;
  ogLocale: string | null;
  ogLocaleAlternates: string[];
  twitterTitle: string | null;
  twitterTitleEn: string | null;
  twitterTitleAr: string | null;
  twitterDescription: string | null;
  twitterDescriptionEn: string | null;
  twitterDescriptionAr: string | null;
  twitterImageUrl: string | null;
  twitterCardType: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;
  facebookTitleEn: string | null;
  facebookTitleAr: string | null;
  facebookDescriptionEn: string | null;
  facebookDescriptionAr: string | null;
  facebookImageUrl: string | null;
  instagramTitleEn: string | null;
  instagramTitleAr: string | null;
  instagramDescriptionEn: string | null;
  instagramDescriptionAr: string | null;
  instagramImageUrl: string | null;
  xTitleEn: string | null;
  xTitleAr: string | null;
  xDescriptionEn: string | null;
  xDescriptionAr: string | null;
  xImageUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  xUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  canonicalBaseUrl: string | null;
  hreflangMap: Record<string, string>;
  sitemapIncludes: string[];
  sitemapExcludes: string[];
}

type HreflangEntry = { locale: string; url: string };

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const toTextList = (items: string[]) => items.join("\n");

const fromTextList = (value: string) => value
  .split("\n")
  .map((item) => item.trim())
  .filter((item) => item.length > 0);

export const SeoSettingsPanel = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const isTenantSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    return parts.length > 2 && parts[0] !== "www";
  }, []);

  const endpointBase = isTenantSubdomain ? "/api/tenant/seo" : "/api/admin/seo";

  const [form, setForm] = useState<SeoSettings>({
    titleTemplate: "",
    titleTemplateEn: "",
    titleTemplateAr: "",
    metaDescription: "",
    metaDescriptionEn: "",
    metaDescriptionAr: "",
    metaKeywordsEn: "",
    metaKeywordsAr: "",
    metaAuthor: "",
    metaViewport: "",
    ogTitle: "",
    ogTitleEn: "",
    ogTitleAr: "",
    ogDescription: "",
    ogDescriptionEn: "",
    ogDescriptionAr: "",
    ogImageUrl: "",
    ogType: "",
    ogSiteName: "",
    ogLocale: "",
    ogLocaleAlternates: [],
    twitterTitle: "",
    twitterTitleEn: "",
    twitterTitleAr: "",
    twitterDescription: "",
    twitterDescriptionEn: "",
    twitterDescriptionAr: "",
    twitterImageUrl: "",
    twitterCardType: "",
    twitterSite: "",
    twitterCreator: "",
    facebookTitleEn: "",
    facebookTitleAr: "",
    facebookDescriptionEn: "",
    facebookDescriptionAr: "",
    facebookImageUrl: "",
    instagramTitleEn: "",
    instagramTitleAr: "",
    instagramDescriptionEn: "",
    instagramDescriptionAr: "",
    instagramImageUrl: "",
    xTitleEn: "",
    xTitleAr: "",
    xDescriptionEn: "",
    xDescriptionAr: "",
    xImageUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    xUrl: "",
    robotsIndex: true,
    robotsFollow: true,
    canonicalBaseUrl: "",
    hreflangMap: {},
    sitemapIncludes: [],
    sitemapExcludes: [],
  });

  const [hreflangEntries, setHreflangEntries] = useState<HreflangEntry[]>([{ locale: "", url: "" }]);
  const [sitemapIncludesText, setSitemapIncludesText] = useState("");
  const [sitemapExcludesText, setSitemapExcludesText] = useState("");
  const [contentLocale, setContentLocale] = useState<"en" | "ar">("en");
  const [socialLocale, setSocialLocale] = useState<"en" | "ar">("en");
  const [ogLocaleAlternatesText, setOgLocaleAlternatesText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: [endpointBase],
    queryFn: async () => {
      const response = await apiRequest("GET", endpointBase);
      return response.json();
    },
  });

  useEffect(() => {
    const settings: SeoSettings | undefined = data?.settings;
    if (!settings) return;
    setForm(settings);
    setHreflangEntries(
      Object.entries(settings.hreflangMap || {}).map(([locale, url]) => ({ locale, url }))
        .concat([{ locale: "", url: "" }])
    );
    setSitemapIncludesText(toTextList(settings.sitemapIncludes || []));
    setSitemapExcludesText(toTextList(settings.sitemapExcludes || []));
    setOgLocaleAlternatesText(toTextList(settings.ogLocaleAlternates || []));
  }, [data]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.titleTemplateEn.trim()) {
      nextErrors.titleTemplateEn = t("seoTitleEnRequired");
    }
    if (!form.titleTemplateAr.trim()) {
      nextErrors.titleTemplateAr = t("seoTitleArRequired");
    }
    if (!form.metaDescriptionEn.trim()) {
      nextErrors.metaDescriptionEn = t("seoDescriptionEnRequired");
    }
    if (!form.metaDescriptionAr.trim()) {
      nextErrors.metaDescriptionAr = t("seoDescriptionArRequired");
    }

    const urlFields: Array<{ key: keyof SeoSettings; value: string | null; label: string }> = [
      { key: "ogImageUrl", value: form.ogImageUrl, label: t("seoOgImage") },
      { key: "twitterImageUrl", value: form.twitterImageUrl, label: t("seoTwitterImage") },
      { key: "facebookImageUrl", value: form.facebookImageUrl, label: t("seoFacebookImage") },
      { key: "instagramImageUrl", value: form.instagramImageUrl, label: t("seoInstagramImage") },
      { key: "xImageUrl", value: form.xImageUrl, label: t("seoXImage") },
      { key: "facebookUrl", value: form.facebookUrl, label: t("seoFacebookUrl") },
      { key: "instagramUrl", value: form.instagramUrl, label: t("seoInstagramUrl") },
      { key: "xUrl", value: form.xUrl, label: t("seoXUrl") },
      { key: "canonicalBaseUrl", value: form.canonicalBaseUrl, label: t("seoCanonicalBase") },
    ];

    urlFields.forEach(({ key, value, label }) => {
      if (value && value.trim() && !isValidUrl(value)) {
        nextErrors[key] = t("seoUrlInvalid").replace("{field}", label);
      }
    });

    hreflangEntries.forEach((entry, index) => {
      if ((entry.locale || entry.url) && (!entry.locale || !entry.url)) {
        nextErrors[`hreflang-${index}`] = t("seoHreflangInvalid");
      }
      if (entry.url && !isValidUrl(entry.url)) {
        nextErrors[`hreflang-${index}`] = t("seoUrlInvalid").replace("{field}", t("seoHreflangUrl"));
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: SeoSettings = {
        ...form,
        titleTemplate: form.titleTemplateEn || form.titleTemplate,
        metaDescription: form.metaDescriptionEn || form.metaDescription,
        hreflangMap: hreflangEntries
          .filter((entry) => entry.locale && entry.url)
          .reduce((acc, entry) => {
            acc[entry.locale.trim()] = entry.url.trim();
            return acc;
          }, {} as Record<string, string>),
        sitemapIncludes: fromTextList(sitemapIncludesText),
        sitemapExcludes: fromTextList(sitemapExcludesText),
        ogLocaleAlternates: fromTextList(ogLocaleAlternatesText),
      };

      const response = await apiRequest("PUT", endpointBase, payload);
      return response.json();
    },
    onSuccess: (payload) => {
      if (payload?.settings) {
        setForm(payload.settings);
      }
      toast({
        title: t("seoSaveSuccessTitle"),
        description: t("seoSaveSuccessDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("seoSaveErrorTitle"),
        description: error?.message || t("seoSaveErrorDesc"),
        variant: "destructive",
      });
    },
  });

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    updateMutation.mutate();
  };

  const updateHreflangEntry = (index: number, key: keyof HreflangEntry, value: string) => {
    setHreflangEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const addHreflangEntry = () => {
    setHreflangEntries((prev) => [...prev, { locale: "", url: "" }]);
  };

  const removeHreflangEntry = (index: number) => {
    setHreflangEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <CardTitle className="text-gray-900">{t("seoSettingsTitle")}</CardTitle>
        <CardDescription className="text-gray-600">{t("seoSettingsSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="general">{t("seoTabGeneral")}</TabsTrigger>
              <TabsTrigger value="social">{t("seoTabSocial")}</TabsTrigger>
              <TabsTrigger value="indexing">{t("seoTabIndexing")}</TabsTrigger>
              <TabsTrigger value="canonical">{t("seoTabCanonical")}</TabsTrigger>
              <TabsTrigger value="sitemap">{t("seoTabSitemap")}</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Tabs value={contentLocale} onValueChange={(value) => setContentLocale(value as "en" | "ar")}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="en">{t("seoLanguageEn")}</TabsTrigger>
                  <TabsTrigger value="ar">{t("seoLanguageAr")}</TabsTrigger>
                </TabsList>
                <TabsContent value="en" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="titleTemplateEn">{t("seoTitleTemplate")}</Label>
                    <Input
                      id="titleTemplateEn"
                      value={form.titleTemplateEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, titleTemplateEn: e.target.value }))}
                      placeholder={t("seoTitlePlaceholder")}
                    />
                    {errors.titleTemplateEn && (
                      <p className="text-sm text-red-600">{errors.titleTemplateEn}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metaDescriptionEn">{t("seoDescription")}</Label>
                    <Textarea
                      id="metaDescriptionEn"
                      value={form.metaDescriptionEn}
                      onChange={(e) => setForm((prev) => ({ ...prev, metaDescriptionEn: e.target.value }))}
                      placeholder={t("seoDescriptionPlaceholder")}
                    />
                    {errors.metaDescriptionEn && (
                      <p className="text-sm text-red-600">{errors.metaDescriptionEn}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metaKeywordsEn">{t("seoKeywords")}</Label>
                    <Textarea
                      id="metaKeywordsEn"
                      value={form.metaKeywordsEn ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, metaKeywordsEn: e.target.value }))}
                      placeholder={t("seoKeywordsPlaceholder")}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="ar" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="titleTemplateAr">{t("seoTitleTemplate")}</Label>
                    <Input
                      id="titleTemplateAr"
                      value={form.titleTemplateAr}
                      onChange={(e) => setForm((prev) => ({ ...prev, titleTemplateAr: e.target.value }))}
                      placeholder={t("seoTitlePlaceholder")}
                    />
                    {errors.titleTemplateAr && (
                      <p className="text-sm text-red-600">{errors.titleTemplateAr}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metaDescriptionAr">{t("seoDescription")}</Label>
                    <Textarea
                      id="metaDescriptionAr"
                      value={form.metaDescriptionAr}
                      onChange={(e) => setForm((prev) => ({ ...prev, metaDescriptionAr: e.target.value }))}
                      placeholder={t("seoDescriptionPlaceholder")}
                    />
                    {errors.metaDescriptionAr && (
                      <p className="text-sm text-red-600">{errors.metaDescriptionAr}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metaKeywordsAr">{t("seoKeywords")}</Label>
                    <Textarea
                      id="metaKeywordsAr"
                      value={form.metaKeywordsAr ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, metaKeywordsAr: e.target.value }))}
                      placeholder={t("seoKeywordsPlaceholder")}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="metaAuthor">{t("seoAuthor")}</Label>
                  <Input
                    id="metaAuthor"
                    value={form.metaAuthor ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, metaAuthor: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metaViewport">{t("seoViewport")}</Label>
                  <Input
                    id="metaViewport"
                    value={form.metaViewport ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, metaViewport: e.target.value }))}
                    placeholder={t("seoViewportPlaceholder")}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              <Tabs value={socialLocale} onValueChange={(value) => setSocialLocale(value as "en" | "ar")}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="en">{t("seoLanguageEn")}</TabsTrigger>
                  <TabsTrigger value="ar">{t("seoLanguageAr")}</TabsTrigger>
                </TabsList>
                <TabsContent value="en" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ogTitleEn">{t("seoOgTitle")}</Label>
                      <Input
                        id="ogTitleEn"
                        value={form.ogTitleEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, ogTitleEn: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitterTitleEn">{t("seoTwitterTitle")}</Label>
                      <Input
                        id="twitterTitleEn"
                        value={form.twitterTitleEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, twitterTitleEn: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ogDescriptionEn">{t("seoOgDescription")}</Label>
                      <Textarea
                        id="ogDescriptionEn"
                        value={form.ogDescriptionEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, ogDescriptionEn: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitterDescriptionEn">{t("seoTwitterDescription")}</Label>
                      <Textarea
                        id="twitterDescriptionEn"
                        value={form.twitterDescriptionEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, twitterDescriptionEn: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="facebookTitleEn">{t("seoFacebookTitle")}</Label>
                      <Input
                        id="facebookTitleEn"
                        value={form.facebookTitleEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, facebookTitleEn: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagramTitleEn">{t("seoInstagramTitle")}</Label>
                      <Input
                        id="instagramTitleEn"
                        value={form.instagramTitleEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, instagramTitleEn: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="facebookDescriptionEn">{t("seoFacebookDescription")}</Label>
                      <Textarea
                        id="facebookDescriptionEn"
                        value={form.facebookDescriptionEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, facebookDescriptionEn: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagramDescriptionEn">{t("seoInstagramDescription")}</Label>
                      <Textarea
                        id="instagramDescriptionEn"
                        value={form.instagramDescriptionEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, instagramDescriptionEn: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="xTitleEn">{t("seoXTitle")}</Label>
                      <Input
                        id="xTitleEn"
                        value={form.xTitleEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, xTitleEn: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="xDescriptionEn">{t("seoXDescription")}</Label>
                      <Textarea
                        id="xDescriptionEn"
                        value={form.xDescriptionEn ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, xDescriptionEn: e.target.value }))}
                      />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="ar" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ogTitleAr">{t("seoOgTitle")}</Label>
                      <Input
                        id="ogTitleAr"
                        value={form.ogTitleAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, ogTitleAr: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitterTitleAr">{t("seoTwitterTitle")}</Label>
                      <Input
                        id="twitterTitleAr"
                        value={form.twitterTitleAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, twitterTitleAr: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ogDescriptionAr">{t("seoOgDescription")}</Label>
                      <Textarea
                        id="ogDescriptionAr"
                        value={form.ogDescriptionAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, ogDescriptionAr: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitterDescriptionAr">{t("seoTwitterDescription")}</Label>
                      <Textarea
                        id="twitterDescriptionAr"
                        value={form.twitterDescriptionAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, twitterDescriptionAr: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="facebookTitleAr">{t("seoFacebookTitle")}</Label>
                      <Input
                        id="facebookTitleAr"
                        value={form.facebookTitleAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, facebookTitleAr: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagramTitleAr">{t("seoInstagramTitle")}</Label>
                      <Input
                        id="instagramTitleAr"
                        value={form.instagramTitleAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, instagramTitleAr: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="facebookDescriptionAr">{t("seoFacebookDescription")}</Label>
                      <Textarea
                        id="facebookDescriptionAr"
                        value={form.facebookDescriptionAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, facebookDescriptionAr: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagramDescriptionAr">{t("seoInstagramDescription")}</Label>
                      <Textarea
                        id="instagramDescriptionAr"
                        value={form.instagramDescriptionAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, instagramDescriptionAr: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="xTitleAr">{t("seoXTitle")}</Label>
                      <Input
                        id="xTitleAr"
                        value={form.xTitleAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, xTitleAr: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="xDescriptionAr">{t("seoXDescription")}</Label>
                      <Textarea
                        id="xDescriptionAr"
                        value={form.xDescriptionAr ?? ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, xDescriptionAr: e.target.value }))}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ogImageUrl">{t("seoOgImage")}</Label>
                  <Input
                    id="ogImageUrl"
                    value={form.ogImageUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, ogImageUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.ogImageUrl && (
                    <p className="text-sm text-red-600">{errors.ogImageUrl}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitterImageUrl">{t("seoTwitterImage")}</Label>
                  <Input
                    id="twitterImageUrl"
                    value={form.twitterImageUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, twitterImageUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.twitterImageUrl && (
                    <p className="text-sm text-red-600">{errors.twitterImageUrl}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="facebookImageUrl">{t("seoFacebookImage")}</Label>
                  <Input
                    id="facebookImageUrl"
                    value={form.facebookImageUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, facebookImageUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.facebookImageUrl && (
                    <p className="text-sm text-red-600">{errors.facebookImageUrl}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramImageUrl">{t("seoInstagramImage")}</Label>
                  <Input
                    id="instagramImageUrl"
                    value={form.instagramImageUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, instagramImageUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.instagramImageUrl && (
                    <p className="text-sm text-red-600">{errors.instagramImageUrl}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xImageUrl">{t("seoXImage")}</Label>
                  <Input
                    id="xImageUrl"
                    value={form.xImageUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, xImageUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.xImageUrl && (
                    <p className="text-sm text-red-600">{errors.xImageUrl}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="ogType">{t("seoOgType")}</Label>
                  <Input
                    id="ogType"
                    value={form.ogType ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, ogType: e.target.value }))}
                    placeholder="website"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ogSiteName">{t("seoOgSiteName")}</Label>
                  <Input
                    id="ogSiteName"
                    value={form.ogSiteName ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, ogSiteName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ogLocale">{t("seoOgLocale")}</Label>
                  <Input
                    id="ogLocale"
                    value={form.ogLocale ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, ogLocale: e.target.value }))}
                    placeholder="en_US"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ogLocaleAlternates">{t("seoOgLocaleAlternates")}</Label>
                <Textarea
                  id="ogLocaleAlternates"
                  value={ogLocaleAlternatesText}
                  onChange={(e) => setOgLocaleAlternatesText(e.target.value)}
                  placeholder={t("seoLocaleAlternatesPlaceholder")}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="twitterCardType">{t("seoTwitterCardType")}</Label>
                  <Input
                    id="twitterCardType"
                    value={form.twitterCardType ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, twitterCardType: e.target.value }))}
                    placeholder="summary_large_image"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitterSite">{t("seoTwitterSite")}</Label>
                  <Input
                    id="twitterSite"
                    value={form.twitterSite ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, twitterSite: e.target.value }))}
                    placeholder="@yourbrand"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitterCreator">{t("seoTwitterCreator")}</Label>
                  <Input
                    id="twitterCreator"
                    value={form.twitterCreator ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, twitterCreator: e.target.value }))}
                    placeholder="@creator"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="facebookUrl">{t("seoFacebookUrl")}</Label>
                  <Input
                    id="facebookUrl"
                    value={form.facebookUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, facebookUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.facebookUrl && (
                    <p className="text-sm text-red-600">{errors.facebookUrl}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramUrl">{t("seoInstagramUrl")}</Label>
                  <Input
                    id="instagramUrl"
                    value={form.instagramUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, instagramUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.instagramUrl && (
                    <p className="text-sm text-red-600">{errors.instagramUrl}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xUrl">{t("seoXUrl")}</Label>
                  <Input
                    id="xUrl"
                    value={form.xUrl ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, xUrl: e.target.value }))}
                    placeholder="https://"
                  />
                  {errors.xUrl && (
                    <p className="text-sm text-red-600">{errors.xUrl}</p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="indexing" className="space-y-4">
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium text-gray-900">{t("seoRobotsIndex")}</p>
                  <p className="text-sm text-gray-600">{t("seoRobotsIndexDesc")}</p>
                </div>
                <Switch
                  checked={form.robotsIndex}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, robotsIndex: value }))}
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-4">
                <div>
                  <p className="font-medium text-gray-900">{t("seoRobotsFollow")}</p>
                  <p className="text-sm text-gray-600">{t("seoRobotsFollowDesc")}</p>
                </div>
                <Switch
                  checked={form.robotsFollow}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, robotsFollow: value }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="canonical" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="canonicalBaseUrl">{t("seoCanonicalBase")}</Label>
                <Input
                  id="canonicalBaseUrl"
                  value={form.canonicalBaseUrl ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, canonicalBaseUrl: e.target.value }))}
                  placeholder="https://"
                />
                {errors.canonicalBaseUrl && (
                  <p className="text-sm text-red-600">{errors.canonicalBaseUrl}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("seoHreflangTitle")}</Label>
                <p className="text-sm text-gray-600">{t("seoHreflangDesc")}</p>
                <div className="space-y-3">
                  {hreflangEntries.map((entry, index) => (
                    <div key={`${entry.locale}-${index}`} className="grid gap-2 md:grid-cols-[1fr_2fr_auto] items-center">
                      <Input
                        value={entry.locale}
                        placeholder="en"
                        onChange={(e) => updateHreflangEntry(index, "locale", e.target.value)}
                      />
                      <Input
                        value={entry.url}
                        placeholder="https://"
                        onChange={(e) => updateHreflangEntry(index, "url", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeHreflangEntry(index)}
                        disabled={hreflangEntries.length <= 1}
                      >
                        {t("seoRemove")}
                      </Button>
                      {errors[`hreflang-${index}`] && (
                        <p className="text-sm text-red-600 md:col-span-3">{errors[`hreflang-${index}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={addHreflangEntry}>
                  {t("seoAddHreflang")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="sitemap" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sitemapIncludes">{t("seoSitemapIncludes")}</Label>
                <Textarea
                  id="sitemapIncludes"
                  value={sitemapIncludesText}
                  onChange={(e) => setSitemapIncludesText(e.target.value)}
                  placeholder={t("seoSitemapPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sitemapExcludes">{t("seoSitemapExcludes")}</Label>
                <Textarea
                  id="sitemapExcludes"
                  value={sitemapExcludesText}
                  onChange={(e) => setSitemapExcludesText(e.target.value)}
                  placeholder={t("seoSitemapExcludePlaceholder")}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {isTenantSubdomain ? t("seoTenantScope") : t("seoCentralScope")}
            </p>
            <Button type="submit" disabled={isLoading || updateMutation.isPending}>
              {updateMutation.isPending ? t("saving") : t("saveChanges")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
