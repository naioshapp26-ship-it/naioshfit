import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Search } from "lucide-react";
import { useLocation } from "wouter";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MediaCarousel } from "@/components/media/MediaCarousel";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/use-auth";

type MarketingCategory = {
  id: number;
  name_en: string;
  name_ar: string;
  slug: string;
  is_active: boolean;
  display_order: number;
};

type AdMediaItem = {
  url: string;
  type: "image" | "video";
};

type PublicAd = {
  id: number;
  title: string | null;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  campaign_type: "offer" | "educational" | "event" | "general";
  category_id: number | null;
  category_name_en?: string | null;
  category_name_ar?: string | null;
  media_urls?: AdMediaItem[] | string | null;
  start_date?: string | null;
  end_date?: string | null;
};

const normalizeMediaItems = (input: unknown): AdMediaItem[] => {
  const raw = typeof input === "string"
    ? (() => {
        try {
          const value = JSON.parse(input);
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      })()
    : (Array.isArray(input) ? input : []);

  const isVideoUrl = (url: string) => /(youtube\.com|youtu\.be|\.(mp4|webm|ogg|mov|m4v)(\?|#|$))/i.test(url);
  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|ico)(\?|#|$)/i.test(url);

  return raw
    .map((item) => {
      if (typeof item === "string") {
        const normalized = item.trim();
        if (!normalized) return null;
        const type = isVideoUrl(normalized) ? "video" : isImageUrl(normalized) ? "image" : "image";
        return { url: normalized, type } as AdMediaItem;
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
      const explicitType =
        candidate.type === "video" || candidate.mediaType === "video"
          ? "video"
          : candidate.type === "image" || candidate.mediaType === "image"
            ? "image"
            : null;
      const inferredType = isVideoUrl(rawUrl) ? "video" : isImageUrl(rawUrl) ? "image" : null;
      const type = (explicitType || inferredType || "image") as "image" | "video";
      return { url: rawUrl, type } as AdMediaItem;
    })
    .filter((item): item is AdMediaItem => Boolean(item));
};

export default function AdsPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isRTL = language === "ar";
  const showPublicHeader = !user;

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: categories = [] } = useQuery<MarketingCategory[]>({
    queryKey: ["ads-page-categories"],
    queryFn: async () => {
      const response = await fetch("/api/ads-management/categories", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load categories");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: ads = [], isLoading } = useQuery<PublicAd[]>({
    queryKey: ["public-ads", search, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      params.set("limit", "48");

      const response = await fetch(`/api/ads/public?${params.toString()}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load ads");
      }
      return response.json();
    },
    staleTime: 60 * 1000,
  });

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );

  return (
    <div className="space-y-6 p-4 lg:p-8 min-h-screen bg-gradient-to-b from-slate-200 via-gray-100 to-white" dir={isRTL ? "rtl" : "ltr"}>
      {showPublicHeader ? (
        <PublicHeader
          title={t("ads") || (isRTL ? "الإعلانات" : "Ads")}
          subtitle={isRTL ? "استكشف أحدث الحملات والعروض الإعلانية" : "Explore active ad campaigns and promotions"}
          backButtonClassName="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/60"
          sticky={false}
        />
      ) : (
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{t("ads") || (isRTL ? "الإعلانات" : "Ads")}</h1>
          <p className="text-muted-foreground">
            {isRTL ? "استكشف أحدث الحملات والعروض الإعلانية" : "Explore active ad campaigns and promotions"}
          </p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <Label>{t("search") || (isRTL ? "بحث" : "Search")}</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute top-1/2 -translate-y-1/2 left-3 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={isRTL ? "ابحث في الإعلانات" : "Search ads"}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{isRTL ? "الفئة" : "Category"}</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "كل الفئات" : "All categories"}</SelectItem>
                  {activeCategories.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {isRTL ? category.name_ar : category.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-0">
                <div className="h-44 bg-slate-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-slate-200 rounded" />
                  <div className="h-4 bg-slate-200 rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : ads.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{isRTL ? "لا توجد إعلانات مطابقة" : "No ads match your filters"}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => {
            const title = isRTL ? (ad.title_ar || ad.title || "") : (ad.title || ad.title_ar || "");
            const description = isRTL ? (ad.description_ar || ad.description || "") : (ad.description || ad.description_ar || "");
            const media = normalizeMediaItems(ad.media_urls);
            const adHref = `/ads/${ad.id}`;

            return (
              <Card
                key={ad.id}
                className="overflow-hidden border border-slate-200"
                role="button"
                tabIndex={0}
                onClick={() => navigate(adHref)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(adHref);
                  }
                }}
              >
                <CardContent className="p-0">
                  <div className="h-44 bg-slate-100 border-b border-slate-200 overflow-hidden">
                    <MediaCarousel
                      items={media}
                      isRTL={isRTL}
                      showDots
                      showArrows
                      loop
                      autoPlayMs={4200}
                      pauseOnHover
                      mediaClassName="h-full w-full object-cover"
                      className="h-full"
                      emptyLabel={isRTL ? "بدون وسائط" : "No media"}
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{ad.campaign_type}</Badge>
                      <Badge variant="outline">{isRTL ? (ad.category_name_ar || "بدون فئة") : (ad.category_name_en || "Uncategorized")}</Badge>
                    </div>
                    <h2 className="font-semibold text-lg leading-snug line-clamp-2">{title}</h2>
                    {description ? (
                      <p className="text-sm text-muted-foreground line-clamp-3">{description}</p>
                    ) : null}
                    {(ad.start_date || ad.end_date) ? (
                      <div className="pt-1 text-xs text-muted-foreground">
                        {ad.start_date ? (
                          <p>{isRTL ? "يبدأ:" : "Starts:"} {new Date(ad.start_date).toLocaleDateString()}</p>
                        ) : null}
                        {ad.end_date ? (
                          <p>{isRTL ? "ينتهي:" : "Ends:"} {new Date(ad.end_date).toLocaleDateString()}</p>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(adHref);
                        }}
                      >
                        {isRTL ? "عرض التفاصيل" : "View Details"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
