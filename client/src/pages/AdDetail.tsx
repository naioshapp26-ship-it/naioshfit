import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import PublicHeader from "@/components/layout/PublicHeader";
import { MediaCarousel } from "@/components/media/MediaCarousel";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/use-auth";

type AdMediaItem = {
  url: string;
  type: "image" | "video";
};

type PublicAdDetail = {
  id: number;
  title: string | null;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  campaign_type: "offer" | "educational" | "event" | "general";
  category_name_en?: string | null;
  category_name_ar?: string | null;
  media_urls?: AdMediaItem[] | string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
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

export default function AdDetailPage() {
  const [, params] = useRoute("/ads/:id");
  const adId = params?.id ? Number.parseInt(params.id, 10) : null;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const isRTL = language === "ar";
  const showPublicHeader = !user;

  const { data: ad, isLoading } = useQuery<PublicAdDetail>({
    queryKey: ["public-ad-detail", adId],
    queryFn: async () => {
      const response = await fetch(`/api/ads/public/${adId}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load ad details");
      }
      return response.json();
    },
    enabled: !!adId,
  });

  const title = isRTL ? (ad?.title_ar || ad?.title || "") : (ad?.title || ad?.title_ar || "");
  const description = isRTL ? (ad?.description_ar || ad?.description || "") : (ad?.description || ad?.description_ar || "");
  const mediaItems = useMemo(() => normalizeMediaItems(ad?.media_urls), [ad?.media_urls]);

  return (
    <div className="space-y-6 p-4 lg:p-8 min-h-screen bg-gradient-to-b from-slate-200 via-gray-100 to-white" dir={isRTL ? "rtl" : "ltr"}>
      {showPublicHeader ? (
        <PublicHeader
          title={t("ads") || (isRTL ? "الإعلانات" : "Ads")}
          subtitle={isRTL ? "تفاصيل الإعلان" : "Ad details"}
          backButtonClassName="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/60"
        />
      ) : null}

      <div>
        <Button variant="outline" className="rounded-full" onClick={() => navigate("/ads")}>
          <ArrowLeft className="h-4 w-4" />
          <span className="ms-2">{isRTL ? "العودة إلى الإعلانات" : "Back to Ads"}</span>
        </Button>
      </div>

      {isLoading ? (
        <Card className="animate-pulse">
          <CardContent className="p-0">
            <div className="h-64 bg-slate-200" />
            <div className="p-6 space-y-3">
              <div className="h-7 bg-slate-200 rounded w-1/2" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-5/6" />
            </div>
          </CardContent>
        </Card>
      ) : !ad ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{isRTL ? "لم يتم العثور على الإعلان" : "Ad not found"}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              <div className="bg-slate-100 border-b lg:border-b-0 lg:border-e border-border">
                <MediaCarousel
                  items={mediaItems}
                  isRTL={isRTL}
                  showDots
                  showArrows
                  loop
                  autoPlayMs={4200}
                  pauseOnHover
                  mediaClassName="h-full min-h-[280px] w-full object-cover"
                  className="h-full min-h-[280px]"
                  emptyLabel={isRTL ? "بدون وسائط" : "No media"}
                />
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{ad.campaign_type}</Badge>
                  <Badge variant="outline">{isRTL ? (ad.category_name_ar || "بدون فئة") : (ad.category_name_en || "Uncategorized")}</Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{title}</h1>
                {description ? <p className="text-muted-foreground leading-relaxed">{description}</p> : null}
                {(ad.start_date || ad.end_date) ? (
                  <div className="pt-2 text-sm text-muted-foreground space-y-1">
                    {ad.start_date ? (
                      <p>{isRTL ? "يبدأ:" : "Starts:"} {new Date(ad.start_date).toLocaleDateString(language === "ar" ? "ar" : "en")}</p>
                    ) : null}
                    {ad.end_date ? (
                      <p>{isRTL ? "ينتهي:" : "Ends:"} {new Date(ad.end_date).toLocaleDateString(language === "ar" ? "ar" : "en")}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
