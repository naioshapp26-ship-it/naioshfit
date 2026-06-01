import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";

type FooterQuickLink = {
  id: string;
  labelEn: string;
  labelAr: string;
  href: string;
  enabled: boolean;
  visibleOnCentral: boolean;
  visibleOnTenant: boolean;
  order: number;
};

type SiteSettings = {
  quickLinks: FooterQuickLink[];
  socialLinks: Record<string, string>;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerGradientFrom: string;
  footerGradientTo: string;
};

type StaticPage = {
  id: number;
  slug: "privacy-policy" | "tos";
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
};

const defaultSettings: SiteSettings = {
  quickLinks: [],
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

const slugOptions: Array<StaticPage["slug"]> = ["privacy-policy", "tos"];

const slugLabel: Record<StaticPage["slug"], string> = {
  "privacy-policy": "Privacy Policy",
  tos: "Terms of Service",
};

export default function PublicContentManager() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const isTenantSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    return parts.length > 2 && parts[0] !== "www";
  }, []);

  const endpointBase = isTenantSubdomain ? "/api/tenant/public-content" : "/api/admin/public-content";

  const [settingsForm, setSettingsForm] = useState<SiteSettings>(defaultSettings);
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [activeSlug, setActiveSlug] = useState<StaticPage["slug"]>("privacy-policy");
  const [pageForm, setPageForm] = useState<Pick<StaticPage, "titleEn" | "titleAr" | "contentEn" | "contentAr">>({
    titleEn: "",
    titleAr: "",
    contentEn: "",
    contentAr: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: [endpointBase],
    queryFn: async () => {
      const response = await apiRequest("GET", endpointBase);
      return response.json();
    },
  });

  useEffect(() => {
    if (!data) return;
    setSettingsForm({
      ...defaultSettings,
      ...(data.settings || {}),
      socialLinks: {
        ...defaultSettings.socialLinks,
        ...(data.settings?.socialLinks || {}),
      },
      quickLinks: [...(data.settings?.quickLinks || [])].sort((a: FooterQuickLink, b: FooterQuickLink) => a.order - b.order),
    });
    setPages(data.pages || []);
  }, [data]);

  useEffect(() => {
    const current = pages.find((page) => page.slug === activeSlug);
    if (!current) return;
    setPageForm({
      titleEn: current.titleEn || "",
      titleAr: current.titleAr || "",
      contentEn: current.contentEn || "",
      contentAr: current.contentAr || "",
    });
  }, [pages, activeSlug]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: SiteSettings) => {
      const response = await apiRequest("PUT", `${endpointBase}/settings`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم حفظ إعدادات الفوتر." : "Footer settings were saved.",
      });
      queryClient.invalidateQueries({ queryKey: [endpointBase] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/site-settings"] });
    },
    onError: (error: any) => {
      toast({
        title: language === "ar" ? "فشل الحفظ" : "Save failed",
        description: error?.message || (language === "ar" ? "تعذر حفظ الإعدادات." : "Could not save settings."),
        variant: "destructive",
      });
    },
  });

  const savePageMutation = useMutation({
    mutationFn: async (payload: typeof pageForm) => {
      const response = await apiRequest("PUT", `${endpointBase}/pages/${activeSlug}`, payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم حفظ محتوى الصفحة." : "Page content was saved.",
      });
      queryClient.invalidateQueries({ queryKey: [endpointBase] });
      queryClient.invalidateQueries({ queryKey: [`/api/public/pages/${activeSlug}`] });
    },
    onError: (error: any) => {
      toast({
        title: language === "ar" ? "فشل الحفظ" : "Save failed",
        description: error?.message || (language === "ar" ? "تعذر حفظ الصفحة." : "Could not save page."),
        variant: "destructive",
      });
    },
  });

  const updateQuickLink = (id: string, patch: Partial<FooterQuickLink>) => {
    setSettingsForm((prev) => ({
      ...prev,
      quickLinks: prev.quickLinks.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    }));
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading content settings...</div>;
  }

  return (
    <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <Tabs defaultValue="appearance" className="space-y-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className={`flex w-full ${isArabic ? "justify-end" : "justify-start"}`}>
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="appearance">{language === "ar" ? "المظهر" : "Appearance"}</TabsTrigger>
            <TabsTrigger value="quick-links">{language === "ar" ? "الروابط السريعة" : "Quick Links"}</TabsTrigger>
            <TabsTrigger value="contact-social">{language === "ar" ? "التواصل والسوشيال" : "Contact & Social"}</TabsTrigger>
            <TabsTrigger value="pages">{language === "ar" ? "الصفحات العامة" : "Public Pages"}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "مظهر الفوتر" : "Footer Appearance"}</CardTitle>
              <CardDescription>
                {isTenantSubdomain
                  ? (language === "ar" ? "تعديلات نطاق المستأجر الحالي فقط." : "Changes apply only to this tenant subdomain.")
                  : (language === "ar" ? "تعديلات النطاق المركزي فقط." : "Changes apply only to the central domain.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "لون بداية التدرج" : "Gradient Start"}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settingsForm.footerGradientFrom || "#0f172a"}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, footerGradientFrom: e.target.value }))}
                      className="h-10 w-16 p-1"
                    />
                    <Input
                      value={settingsForm.footerGradientFrom}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, footerGradientFrom: e.target.value }))}
                      placeholder="#0f172a"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "لون نهاية التدرج" : "Gradient End"}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settingsForm.footerGradientTo || "#1e293b"}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, footerGradientTo: e.target.value }))}
                      className="h-10 w-16 p-1"
                    />
                    <Input
                      value={settingsForm.footerGradientTo}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, footerGradientTo: e.target.value }))}
                      placeholder="#1e293b"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={() => saveSettingsMutation.mutate(settingsForm)} disabled={saveSettingsMutation.isPending}>
                {saveSettingsMutation.isPending
                  ? (language === "ar" ? "جار الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ إعدادات الفوتر" : "Save Footer Settings")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick-links">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "روابط الفوتر" : "Footer Quick Links"}</CardTitle>
              <CardDescription>{language === "ar" ? "تحكم بترتيب ورؤية روابط الفوتر." : "Manage link labels, order, and visibility by scope."}</CardDescription>
            </CardHeader>
            <CardContent className={`space-y-6 ${isArabic ? "text-right" : ""}`}>
              <div className="space-y-4">
                {settingsForm.quickLinks.map((link) => (
                  <div key={link.id} className="rounded-lg border p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={link.labelEn}
                        onChange={(e) => updateQuickLink(link.id, { labelEn: e.target.value })}
                        placeholder="Label (EN)"
                      />
                      <Input
                        value={link.labelAr}
                        onChange={(e) => updateQuickLink(link.id, { labelAr: e.target.value })}
                        placeholder="Label (AR)"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={link.href}
                        onChange={(e) => updateQuickLink(link.id, { href: e.target.value })}
                        placeholder="/path"
                      />
                      <Input
                        type="number"
                        value={link.order}
                        onChange={(e) => updateQuickLink(link.id, { order: Number(e.target.value) || 0 })}
                        placeholder="Order"
                      />
                    </div>
                    <div className={`flex flex-wrap gap-6 ${isArabic ? "justify-end" : ""}`}>
                      <div className="flex items-center gap-2">
                        <Switch checked={link.enabled} onCheckedChange={(value) => updateQuickLink(link.id, { enabled: value })} />
                        <Label>{language === "ar" ? "مفعل" : "Enabled"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={link.visibleOnCentral}
                          onCheckedChange={(value) => updateQuickLink(link.id, { visibleOnCentral: value })}
                        />
                        <Label>{language === "ar" ? "ظاهر في المركزي" : "Visible on central"}</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={link.visibleOnTenant}
                          onCheckedChange={(value) => updateQuickLink(link.id, { visibleOnTenant: value })}
                        />
                        <Label>{language === "ar" ? "ظاهر في المستأجر" : "Visible on tenant"}</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={() => saveSettingsMutation.mutate(settingsForm)} disabled={saveSettingsMutation.isPending}>
                {saveSettingsMutation.isPending
                  ? (language === "ar" ? "جار الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ إعدادات الفوتر" : "Save Footer Settings")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact-social">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "التواصل والسوشيال" : "Contact & Social"}</CardTitle>
              <CardDescription>{language === "ar" ? "عدل بيانات التواصل وروابط السوشيال." : "Update contact details and social links shown in the footer."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "بريد الدعم" : "Support Email"}</Label>
                  <Input
                    value={settingsForm.contactEmail}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="support@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الهاتف / واتساب" : "Phone / WhatsApp"}</Label>
                  <Input
                    value={settingsForm.contactPhone}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "العنوان" : "Address"}</Label>
                  <Input
                    value={settingsForm.contactAddress}
                    onChange={(e) => setSettingsForm((prev) => ({ ...prev, contactAddress: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {Object.keys(settingsForm.socialLinks).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">{key}</Label>
                    <Input
                      value={settingsForm.socialLinks[key] || ""}
                      onChange={(e) => setSettingsForm((prev) => ({
                        ...prev,
                        socialLinks: {
                          ...prev.socialLinks,
                          [key]: e.target.value,
                        },
                      }))}
                      placeholder={`https://${key}.com/...`}
                    />
                  </div>
                ))}
              </div>

              <Button onClick={() => saveSettingsMutation.mutate(settingsForm)} disabled={saveSettingsMutation.isPending}>
                {saveSettingsMutation.isPending
                  ? (language === "ar" ? "جار الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ إعدادات الفوتر" : "Save Footer Settings")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "تعديل الصفحات العامة" : "Public Pages"}</CardTitle>
              <CardDescription>{language === "ar" ? "عدل صفحات الخصوصية والشروط." : "Edit Privacy Policy and Terms pages."}</CardDescription>
            </CardHeader>
            <CardContent className={`space-y-4 ${isArabic ? "text-right" : ""}`}>
              <div className={`flex w-full ${isArabic ? "justify-end" : "justify-start"}`}>
                <div className="flex flex-wrap gap-2">
                  {slugOptions.map((slug) => (
                    <Button
                      key={slug}
                      type="button"
                      variant={activeSlug === slug ? "default" : "outline"}
                      onClick={() => setActiveSlug(slug)}
                    >
                      {slugLabel[slug]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title (EN)</Label>
                  <Input value={pageForm.titleEn} onChange={(e) => setPageForm((prev) => ({ ...prev, titleEn: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Title (AR)</Label>
                  <Input value={pageForm.titleAr} onChange={(e) => setPageForm((prev) => ({ ...prev, titleAr: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Content (EN)</Label>
                  <Textarea
                    value={pageForm.contentEn}
                    onChange={(e) => setPageForm((prev) => ({ ...prev, contentEn: e.target.value }))}
                    rows={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content (AR)</Label>
                  <Textarea
                    value={pageForm.contentAr}
                    onChange={(e) => setPageForm((prev) => ({ ...prev, contentAr: e.target.value }))}
                    rows={10}
                  />
                </div>
              </div>

              <Button onClick={() => savePageMutation.mutate(pageForm)} disabled={savePageMutation.isPending}>
                {savePageMutation.isPending
                  ? (language === "ar" ? "جار الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ الصفحة" : "Save Page")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
