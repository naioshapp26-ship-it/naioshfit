import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MediaGalleryManager } from "@/components/media/MediaGalleryManager";

type MarketingCategory = {
  id: number;
  name_en: string;
  name_ar: string;
  slug: string;
  is_active: boolean;
  display_order: number;
};

type AdCampaign = {
  id: number;
  title: string | null;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  campaign_type: "offer" | "educational" | "event" | "general";
  status: "draft" | "active" | "paused" | "completed" | "archived";
  start_date: string | null;
  end_date: string | null;
  category_id: number | null;
  category_name_en?: string | null;
  category_name_ar?: string | null;
  media_urls?: Array<{ url: string; type: "image" | "video" }> | string | null;
};

type AdMediaItem = {
  url: string;
  type: "image" | "video";
};

type AnnouncementItem = {
  id: number;
  title_en: string;
  title_ar: string;
  category_id: number | null;
  category_name_en?: string | null;
  category_name_ar?: string | null;
  status: "active" | "inactive";
  enabled: boolean;
  show_in_top_bar: boolean;
  sort_order: number;
  updated_at?: string;
};

type AdFormState = {
  title: string;
  title_ar: string;
  description: string;
  description_ar: string;
  category_id: string;
  campaign_type: "offer" | "educational" | "event" | "general";
  status: "draft" | "active" | "paused";
  start_date: string;
  end_date: string;
  media_items: AdMediaItem[];
};

const normalizeMediaItemsForDraft = (input: unknown): AdMediaItem[] => {
  const parsed = typeof input === "string"
    ? (() => {
        try {
          const value = JSON.parse(input);
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })()
    : (Array.isArray(input) ? input : []);

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const rawUrl = typeof (item as any).url === "string" ? (item as any).url.trim() : "";
      const type = (item as any).type === "video" ? "video" : "image";
      return { url: rawUrl, type } as AdMediaItem;
    })
    .filter((item): item is AdMediaItem => Boolean(item));
};

const normalizeMediaItemsForSave = (input: unknown): AdMediaItem[] => {
  return normalizeMediaItemsForDraft(input).filter((item) => Boolean(item.url.trim()));
};

type AnnouncementFormState = {
  titleEn: string;
  titleAr: string;
  categoryId: string;
  status: "active" | "inactive";
  enabled: boolean;
  showInTopBar: boolean;
  sortOrder: string;
};

type CategoryFormState = {
  nameEn: string;
  nameAr: string;
  slug: string;
  isActive: boolean;
  displayOrder: string;
};

const toDateTimeLocalValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toUtcIso = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const emptyAdForm = (): AdFormState => ({
  title: "",
  title_ar: "",
  description: "",
  description_ar: "",
  category_id: "none",
  campaign_type: "general",
  status: "active",
  start_date: "",
  end_date: "",
  media_items: [],
});

const emptyAnnouncementForm = (): AnnouncementFormState => ({
  titleEn: "",
  titleAr: "",
  categoryId: "none",
  status: "active",
  enabled: true,
  showInTopBar: true,
  sortOrder: "0",
});

const emptyCategoryForm = (): CategoryFormState => ({
  nameEn: "",
  nameAr: "",
  slug: "",
  isActive: true,
  displayOrder: "0",
});

interface AdsManagementPanelProps {
  compact?: boolean;
}

export default function AdsManagementPanel({ compact }: AdsManagementPanelProps) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isRTL = language === "ar";

  const [adsSearch, setAdsSearch] = useState("");
  const [adsCategoryFilter, setAdsCategoryFilter] = useState<string>("all");
  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AdCampaign | null>(null);

  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MarketingCategory | null>(null);
  const [viewingCategory, setViewingCategory] = useState<MarketingCategory | null>(null);

  const [adForm, setAdForm] = useState<AdFormState>(emptyAdForm());
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(emptyAnnouncementForm());
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm());

  const { data: categories = [] } = useQuery<MarketingCategory[]>({
    queryKey: ["ads-management-categories", "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ads-management/categories?includeInactive=true");
      return response.json();
    },
  });

  const { data: ads = [], isLoading: isAdsLoading } = useQuery<AdCampaign[]>({
    queryKey: ["ads-management-ads"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/ads");
      return response.json();
    },
  });

  const { data: announcements = [], isLoading: isAnnouncementsLoading } = useQuery<AnnouncementItem[]>({
    queryKey: ["ads-management-announcements"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/announcements");
      return response.json();
    },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["ads-management-ads"] });
    queryClient.invalidateQueries({ queryKey: ["ads-management-announcements"] });
    queryClient.invalidateQueries({ queryKey: ["ads-management-categories"] });
    queryClient.invalidateQueries({ queryKey: ["active-ads"] });
    queryClient.invalidateQueries({ queryKey: ["public-ads"] });
    queryClient.invalidateQueries({ queryKey: ["top-bar-announcements"] });
    queryClient.invalidateQueries({ queryKey: ["home-latest-ads"] });
  };

  const adSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: adForm.title.trim(),
        title_ar: adForm.title_ar.trim() || null,
        description: adForm.description.trim() || null,
        description_ar: adForm.description_ar.trim() || null,
        category_id: adForm.category_id === "none" ? null : Number(adForm.category_id),
        campaign_type: adForm.campaign_type,
        status: adForm.status,
        start_date: toUtcIso(adForm.start_date),
        end_date: toUtcIso(adForm.end_date),
        media_urls: normalizeMediaItemsForSave(adForm.media_items),
      };
      if (editingAd) {
        await apiRequest("PUT", `/api/admin/ads/${editingAd.id}`, payload);
        return;
      }
      await apiRequest("POST", "/api/admin/ads", payload);
    },
    onSuccess: () => {
      refreshAll();
      setAdDialogOpen(false);
      setEditingAd(null);
      setAdForm(emptyAdForm());
      toast({ title: t("success") || "Success", description: isRTL ? "تم حفظ الإعلان بنجاح" : "Ad saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: t("error") || "Error", description: error.message, variant: "destructive" });
    },
  });

  const adDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/ads/${id}`);
    },
    onSuccess: () => {
      refreshAll();
      toast({ title: t("success") || "Success", description: isRTL ? "تم حذف الإعلان" : "Ad deleted" });
    },
    onError: (error: Error) => {
      toast({ title: t("error") || "Error", description: error.message, variant: "destructive" });
    },
  });

  const announcementSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        titleEn: announcementForm.titleEn.trim(),
        titleAr: announcementForm.titleAr.trim(),
        categoryId: announcementForm.categoryId === "none" ? null : Number(announcementForm.categoryId),
        status: announcementForm.status,
        enabled: announcementForm.enabled,
        showInTopBar: announcementForm.showInTopBar,
        sortOrder: Number.parseInt(announcementForm.sortOrder || "0", 10) || 0,
      };
      if (editingAnnouncement) {
        await apiRequest("PUT", `/api/admin/announcements/${editingAnnouncement.id}`, payload);
        return;
      }
      await apiRequest("POST", "/api/admin/announcements", payload);
    },
    onSuccess: () => {
      refreshAll();
      setAnnouncementDialogOpen(false);
      setEditingAnnouncement(null);
      setAnnouncementForm(emptyAnnouncementForm());
      toast({ title: t("success") || "Success", description: isRTL ? "تم حفظ عنصر الشريط" : "Announcement saved" });
    },
    onError: (error: Error) => {
      toast({ title: t("error") || "Error", description: error.message, variant: "destructive" });
    },
  });

  const announcementDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/announcements/${id}`);
    },
    onSuccess: () => {
      refreshAll();
      toast({ title: t("success") || "Success", description: isRTL ? "تم حذف عنصر الشريط" : "Announcement deleted" });
    },
    onError: (error: Error) => {
      toast({ title: t("error") || "Error", description: error.message, variant: "destructive" });
    },
  });

  const categorySaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nameEn: categoryForm.nameEn.trim(),
        nameAr: categoryForm.nameAr.trim(),
        slug: categoryForm.slug.trim() || undefined,
        isActive: categoryForm.isActive,
        displayOrder: Number.parseInt(categoryForm.displayOrder || "0", 10) || 0,
      };
      if (editingCategory) {
        await apiRequest("PUT", `/api/admin/ads-management/categories/${editingCategory.id}`, payload);
        return;
      }
      await apiRequest("POST", "/api/admin/ads-management/categories", payload);
    },
    onSuccess: () => {
      refreshAll();
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm(emptyCategoryForm());
      toast({ title: t("success") || "Success", description: isRTL ? "تم حفظ الفئة" : "Category saved" });
    },
    onError: (error: Error) => {
      toast({ title: t("error") || "Error", description: error.message, variant: "destructive" });
    },
  });

  const categoryDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/ads-management/categories/${id}`);
    },
    onSuccess: () => {
      refreshAll();
      toast({ title: t("success") || "Success", description: isRTL ? "تم حذف الفئة" : "Category deleted" });
    },
    onError: (error: Error) => {
      toast({ title: t("error") || "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredAds = useMemo(() => {
    const needle = adsSearch.trim().toLowerCase();
    return ads.filter((ad) => {
      const matchesSearch = !needle || `${ad.title || ""} ${ad.title_ar || ""} ${ad.description || ""} ${ad.description_ar || ""}`.toLowerCase().includes(needle);
      if (!matchesSearch) return false;
      if (adsCategoryFilter === "all") return true;
      return String(ad.category_id || "none") === adsCategoryFilter;
    });
  }, [ads, adsSearch, adsCategoryFilter]);

  const activeCategories = categories.filter((category) => category.is_active);

  const openCreateAd = () => {
    setEditingAd(null);
    setAdForm(emptyAdForm());
    setAdDialogOpen(true);
  };

  const openEditAd = (ad: AdCampaign) => {
    const mediaItems = normalizeMediaItemsForDraft(ad.media_urls);
    setEditingAd(ad);
    setAdForm({
      title: ad.title || "",
      title_ar: ad.title_ar || "",
      description: ad.description || "",
      description_ar: ad.description_ar || "",
      category_id: ad.category_id ? String(ad.category_id) : "none",
      campaign_type: ad.campaign_type || "general",
      status: ad.status === "paused" ? "paused" : ad.status === "draft" ? "draft" : "active",
      start_date: toDateTimeLocalValue(ad.start_date),
      end_date: toDateTimeLocalValue(ad.end_date),
      media_items: mediaItems,
    });
    setAdDialogOpen(true);
  };

  const openCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm(emptyAnnouncementForm());
    setAnnouncementDialogOpen(true);
  };

  const openEditAnnouncement = (announcement: AnnouncementItem) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      titleEn: announcement.title_en || "",
      titleAr: announcement.title_ar || "",
      categoryId: announcement.category_id ? String(announcement.category_id) : "none",
      status: announcement.status,
      enabled: Boolean(announcement.enabled),
      showInTopBar: Boolean(announcement.show_in_top_bar),
      sortOrder: String(announcement.sort_order ?? 0),
    });
    setAnnouncementDialogOpen(true);
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm());
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (category: MarketingCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      nameEn: category.name_en,
      nameAr: category.name_ar,
      slug: category.slug,
      isActive: Boolean(category.is_active),
      displayOrder: String(category.display_order ?? 0),
    });
    setCategoryDialogOpen(true);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t("adsCoursesTitle") || (isRTL ? "إدارة الإعلانات" : "Ads Management")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ads" className="w-full">
          <TabsList className="grid grid-cols-3 w-full" dir={isRTL ? "rtl" : "ltr"}>
            <TabsTrigger value="ads">{isRTL ? "الإعلانات" : "Ads"}</TabsTrigger>
            <TabsTrigger value="announcements">{isRTL ? "شريط الإعلانات" : "Announcement Bar"}</TabsTrigger>
            <TabsTrigger value="categories">{isRTL ? "إدارة الفئات" : "Manage Categories"}</TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="mt-4 space-y-4" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="grid w-full md:max-w-3xl gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{isRTL ? "بحث" : "Search"}</Label>
                  <Input value={adsSearch} onChange={(e) => setAdsSearch(e.target.value)} placeholder={isRTL ? "ابحث في الإعلانات" : "Search ads"} />
                </div>
                <div className="space-y-1">
                  <Label>{isRTL ? "الفئة" : "Category"}</Label>
                  <Select value={adsCategoryFilter} onValueChange={setAdsCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRTL ? "كل الفئات" : "All Categories"}</SelectItem>
                      {activeCategories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {isRTL ? category.name_ar : category.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!compact && (
                <Button onClick={openCreateAd}>{isRTL ? "إضافة إعلان" : "Add Ad"}</Button>
              )}
            </div>

            {isAdsLoading ? (
              <p className="text-sm text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</p>
            ) : filteredAds.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد إعلانات" : "No ads found"}</p>
            ) : (
              <div className="space-y-2">
                {filteredAds.map((ad) => (
                  <div key={ad.id} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{isRTL ? ad.title_ar || ad.title : ad.title || ad.title_ar}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{ad.status}</Badge>
                          <Badge variant="outline">{ad.campaign_type}</Badge>
                          <span>{isRTL ? (ad.category_name_ar || "بدون فئة") : (ad.category_name_en || "Uncategorized")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditAd(ad)}>{isRTL ? "تعديل" : "Edit"}</Button>
                        <Button size="sm" variant="destructive" onClick={() => adDeleteMutation.mutate(ad.id)}>{isRTL ? "حذف" : "Delete"}</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="announcements" className="mt-4 space-y-4" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{isRTL ? "عناصر الشريط العلوي المعروضة للزوار" : "Top bar items shown to public visitors"}</p>
              <Button onClick={openCreateAnnouncement}>{isRTL ? "إضافة عنصر" : "Add Item"}</Button>
            </div>

            {isAnnouncementsLoading ? (
              <p className="text-sm text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</p>
            ) : announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد عناصر" : "No announcement items"}</p>
            ) : (
              <div className="space-y-2">
                {announcements.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{isRTL ? item.title_ar : item.title_en}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge>
                          <Badge variant={item.enabled ? "default" : "secondary"}>{item.enabled ? (isRTL ? "مفعل" : "Enabled") : (isRTL ? "معطل" : "Disabled")}</Badge>
                          <Badge variant={item.show_in_top_bar ? "default" : "outline"}>{item.show_in_top_bar ? (isRTL ? "ظاهر بالأعلى" : "Top Bar") : (isRTL ? "غير ظاهر" : "Hidden")}</Badge>
                          <span>{isRTL ? (item.category_name_ar || "بدون فئة") : (item.category_name_en || "Uncategorized")}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditAnnouncement(item)}>{isRTL ? "تعديل" : "Edit"}</Button>
                        <Button size="sm" variant="destructive" onClick={() => announcementDeleteMutation.mutate(item.id)}>{isRTL ? "حذف" : "Delete"}</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories" className="mt-4 space-y-4" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{isRTL ? "فئات مشتركة للإعلانات والتنبيهات" : "Shared categories for ads and announcements"}</p>
              <Button onClick={openCreateCategory}>{isRTL ? "إضافة" : "Add"}</Button>
            </div>

            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isRTL ? "لا توجد فئات" : "No categories"}</p>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="rounded-lg border p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{isRTL ? category.name_ar : category.name_en}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{category.slug}</span>
                          <Badge variant={category.is_active ? "default" : "secondary"}>{category.is_active ? (isRTL ? "نشطة" : "Active") : (isRTL ? "غير نشطة" : "Inactive")}</Badge>
                          <span>{isRTL ? `الترتيب: ${category.display_order}` : `Order: ${category.display_order}`}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setViewingCategory(category)}>{isRTL ? "عرض" : "View"}</Button>
                        <Button size="sm" variant="outline" onClick={() => openEditCategory(category)}>{isRTL ? "تعديل" : "Edit"}</Button>
                        <Button size="sm" variant="destructive" onClick={() => categoryDeleteMutation.mutate(category.id)}>{isRTL ? "حذف" : "Delete"}</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={adDialogOpen} onOpenChange={setAdDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingAd ? (isRTL ? "تعديل إعلان" : "Edit Ad") : (isRTL ? "إضافة إعلان" : "Add Ad")}</DialogTitle>
            <DialogDescription>{isRTL ? "إدارة بيانات الحملة الإعلانية" : "Manage ad campaign details"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isRTL ? "العنوان (إنجليزي)" : "Title (EN)"}</Label>
                <Input value={adForm.title} onChange={(e) => setAdForm((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "العنوان (عربي)" : "Title (AR)"}</Label>
                <Input value={adForm.title_ar} onChange={(e) => setAdForm((prev) => ({ ...prev, title_ar: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isRTL ? "الوصف (إنجليزي)" : "Description (EN)"}</Label>
                <Textarea value={adForm.description} onChange={(e) => setAdForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "الوصف (عربي)" : "Description (AR)"}</Label>
                <Textarea value={adForm.description_ar} onChange={(e) => setAdForm((prev) => ({ ...prev, description_ar: e.target.value }))} rows={3} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{isRTL ? "الفئة" : "Category"}</Label>
                <Select value={adForm.category_id} onValueChange={(value) => setAdForm((prev) => ({ ...prev, category_id: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{isRTL ? "بدون فئة" : "Uncategorized"}</SelectItem>
                    {activeCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>{isRTL ? category.name_ar : category.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "نوع الحملة" : "Campaign Type"}</Label>
                <Select value={adForm.campaign_type} onValueChange={(value) => setAdForm((prev) => ({ ...prev, campaign_type: value as AdFormState["campaign_type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">{isRTL ? "عام" : "General"}</SelectItem>
                    <SelectItem value="offer">{isRTL ? "عرض" : "Offer"}</SelectItem>
                    <SelectItem value="educational">{isRTL ? "تعليمي" : "Educational"}</SelectItem>
                    <SelectItem value="event">{isRTL ? "حدث" : "Event"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "الحالة" : "Status"}</Label>
                <Select value={adForm.status} onValueChange={(value) => setAdForm((prev) => ({ ...prev, status: value as AdFormState["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{isRTL ? "نشطة" : "Active"}</SelectItem>
                    <SelectItem value="draft">{isRTL ? "مسودة" : "Draft"}</SelectItem>
                    <SelectItem value="paused">{isRTL ? "متوقفة" : "Paused"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isRTL ? "تاريخ البدء" : "Start date"}</Label>
                <Input type="datetime-local" value={adForm.start_date} onChange={(e) => setAdForm((prev) => ({ ...prev, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "تاريخ الانتهاء" : "End date"}</Label>
                <Input type="datetime-local" value={adForm.end_date} onChange={(e) => setAdForm((prev) => ({ ...prev, end_date: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <MediaGalleryManager
                label={isRTL ? "معرض الوسائط" : "Media gallery"}
                items={adForm.media_items}
                onChange={(items) => setAdForm((prev) => ({ ...prev, media_items: items }))}
                isRTL={isRTL}
                addButtonLabel={isRTL ? "إضافة وسيط" : "Add media item"}
                emptyText={isRTL ? "لا توجد وسائط لهذا الإعلان" : "No media items for this ad"}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAdDialogOpen(false)}>{t("cancel") || (isRTL ? "إلغاء" : "Cancel")}</Button>
              <Button onClick={() => adSaveMutation.mutate()} disabled={adSaveMutation.isPending}>{adSaveMutation.isPending ? (t("saving") || (isRTL ? "جار الحفظ..." : "Saving...")) : (t("save") || (isRTL ? "حفظ" : "Save"))}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={announcementDialogOpen} onOpenChange={setAnnouncementDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? (isRTL ? "تعديل عنصر" : "Edit Item") : (isRTL ? "إضافة عنصر" : "Add Item")}</DialogTitle>
            <DialogDescription>{isRTL ? "عنصر لشريط الإعلانات العلوي" : "Announcement bar item"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{isRTL ? "العنوان (إنجليزي)" : "Title (EN)"}</Label>
              <Input value={announcementForm.titleEn} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, titleEn: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{isRTL ? "العنوان (عربي)" : "Title (AR)"}</Label>
              <Input value={announcementForm.titleAr} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, titleAr: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>{isRTL ? "الفئة" : "Category"}</Label>
                <Select value={announcementForm.categoryId} onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, categoryId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{isRTL ? "بدون فئة" : "Uncategorized"}</SelectItem>
                    {activeCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>{isRTL ? category.name_ar : category.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "الحالة" : "Status"}</Label>
                <Select value={announcementForm.status} onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, status: value as AnnouncementFormState["status"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{isRTL ? "نشطة" : "Active"}</SelectItem>
                    <SelectItem value="inactive">{isRTL ? "غير نشطة" : "Inactive"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "ترتيب العرض" : "Sort order"}</Label>
                <Input type="number" value={announcementForm.sortOrder} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, sortOrder: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>{isRTL ? "مفعل" : "Enabled"}</Label>
                <Switch checked={announcementForm.enabled} onCheckedChange={(checked) => setAnnouncementForm((prev) => ({ ...prev, enabled: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>{isRTL ? "إظهار في الشريط العلوي" : "Show in top bar"}</Label>
                <Switch checked={announcementForm.showInTopBar} onCheckedChange={(checked) => setAnnouncementForm((prev) => ({ ...prev, showInTopBar: checked }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setAnnouncementDialogOpen(false)}>{t("cancel") || (isRTL ? "إلغاء" : "Cancel")}</Button>
              <Button onClick={() => announcementSaveMutation.mutate()} disabled={announcementSaveMutation.isPending}>{announcementSaveMutation.isPending ? (t("saving") || (isRTL ? "جار الحفظ..." : "Saving...")) : (t("save") || (isRTL ? "حفظ" : "Save"))}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-xl" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{editingCategory ? (isRTL ? "تعديل فئة" : "Edit Category") : (isRTL ? "إضافة فئة" : "Add Category")}</DialogTitle>
            <DialogDescription>{isRTL ? "فئة مشتركة للإعلانات والتنبيهات" : "Shared category for ads and announcements"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (EN)"}</Label>
                <Input value={categoryForm.nameEn} onChange={(e) => setCategoryForm((prev) => ({ ...prev, nameEn: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "الاسم (عربي)" : "Name (AR)"}</Label>
                <Input value={categoryForm.nameAr} onChange={(e) => setCategoryForm((prev) => ({ ...prev, nameAr: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{isRTL ? "الرمز" : "Slug"}</Label>
                <Input value={categoryForm.slug} onChange={(e) => setCategoryForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder={isRTL ? "اختياري" : "Optional"} />
              </div>
              <div className="space-y-1">
                <Label>{isRTL ? "ترتيب العرض" : "Display order"}</Label>
                <Input type="number" value={categoryForm.displayOrder} onChange={(e) => setCategoryForm((prev) => ({ ...prev, displayOrder: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>{isRTL ? "نشطة" : "Active"}</Label>
              <Switch checked={categoryForm.isActive} onCheckedChange={(checked) => setCategoryForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>{t("cancel") || (isRTL ? "إلغاء" : "Cancel")}</Button>
              <Button onClick={() => categorySaveMutation.mutate()} disabled={categorySaveMutation.isPending}>{categorySaveMutation.isPending ? (t("saving") || (isRTL ? "جار الحفظ..." : "Saving...")) : (t("save") || (isRTL ? "حفظ" : "Save"))}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingCategory} onOpenChange={(open) => !open && setViewingCategory(null)}>
        <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "عرض الفئة" : "View Category"}</DialogTitle>
          </DialogHeader>
          {viewingCategory && (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">{isRTL ? "الاسم (إنجليزي): " : "Name (EN): "}</span>{viewingCategory.name_en}</p>
              <p><span className="font-medium">{isRTL ? "الاسم (عربي): " : "Name (AR): "}</span>{viewingCategory.name_ar}</p>
              <p><span className="font-medium">{isRTL ? "الرمز: " : "Slug: "}</span>{viewingCategory.slug}</p>
              <p><span className="font-medium">{isRTL ? "الحالة: " : "Status: "}</span>{viewingCategory.is_active ? (isRTL ? "نشطة" : "Active") : (isRTL ? "غير نشطة" : "Inactive")}</p>
              <p><span className="font-medium">{isRTL ? "الترتيب: " : "Order: "}</span>{viewingCategory.display_order}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
