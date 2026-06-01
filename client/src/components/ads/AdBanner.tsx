import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { MediaCarousel } from '@/components/media/MediaCarousel';

type AdMediaItem = {
  url: string;
  type: 'image' | 'video';
};

const normalizeMediaItems = (input: unknown): AdMediaItem[] => {
  const raw = typeof input === 'string'
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
      if (typeof item === 'string') {
        const normalized = item.trim();
        if (!normalized) return null;
        const type = isVideoUrl(normalized) ? 'video' : isImageUrl(normalized) ? 'image' : 'image';
        return { url: normalized, type } as AdMediaItem;
      }

      if (!item || typeof item !== 'object') return null;
      const candidate = item as any;
      const rawUrl =
        typeof candidate.url === 'string'
          ? candidate.url.trim()
          : typeof candidate.mediaUrl === 'string'
            ? candidate.mediaUrl.trim()
            : typeof candidate.src === 'string'
              ? candidate.src.trim()
              : '';
      if (!rawUrl) return null;
      const explicitType =
        candidate.type === 'video' || candidate.mediaType === 'video'
          ? 'video'
          : candidate.type === 'image' || candidate.mediaType === 'image'
            ? 'image'
            : null;
      const inferredType = isVideoUrl(rawUrl) ? 'video' : isImageUrl(rawUrl) ? 'image' : null;
      return {
        url: rawUrl,
        type: (explicitType || inferredType || 'image') as 'image' | 'video',
      } as AdMediaItem;
    })
    .filter((item): item is AdMediaItem => Boolean(item));
};

interface Ad {
  id: number;
  title: string;
  title_ar?: string;
  description?: string;
  description_ar?: string;
  campaign_type: 'offer' | 'educational' | 'event' | 'general';
  start_date?: string;
  end_date?: string;
  media_urls?: AdMediaItem[] | string | null;
}

export const AdBanner: React.FC = () => {
  const { language } = useLanguage();
  const [dismissedAds, setDismissedAds] = React.useState<number[]>(() => {
    const stored = localStorage.getItem('dismissedAds');
    return stored ? JSON.parse(stored) : [];
  });

  const { data: ads = [], isLoading } = useQuery<Ad[]>({
    queryKey: ['active-ads'],
    queryFn: async () => {
      const response = await fetch('/api/ads/active');
      if (!response.ok) {
        throw new Error('Failed to fetch ads');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const handleDismiss = (adId: number) => {
    const newDismissed = [...dismissedAds, adId];
    setDismissedAds(newDismissed);
    localStorage.setItem('dismissedAds', JSON.stringify(newDismissed));
  };

  if (isLoading) {
    return null;
  }

  const visibleAds = ads.filter(ad => !dismissedAds.includes(ad.id));

  if (visibleAds.length === 0) {
    return null;
  }

  const getCampaignColor = (type: string) => {
    switch (type) {
      case 'offer':
        return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-900/30 dark:to-emerald-900/30 dark:border-green-700/40';
      case 'educational':
        return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/30 dark:to-indigo-900/30 dark:border-blue-700/40';
      case 'event':
        return 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 dark:from-purple-900/30 dark:to-pink-900/30 dark:border-purple-700/40';
      default:
        return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200 dark:from-zinc-800/80 dark:to-zinc-700/80 dark:border-zinc-600';
    }
  };

  const getCampaignIcon = (type: string) => {
    const iconClass = type === 'offer' ? 'text-green-600 dark:text-green-300'
      : type === 'educational' ? 'text-blue-600 dark:text-blue-300'
      : type === 'event' ? 'text-purple-600 dark:text-purple-300'
      : 'text-gray-600 dark:text-zinc-300';
    
    return <Megaphone className={`w-5 h-5 ${iconClass}`} />;
  };

  return (
    <div className="space-y-3 mb-6">
      {visibleAds.map((ad) => {
        const title = language === 'ar' ? (ad.title_ar || ad.title) : (ad.title || ad.title_ar);
        const description = language === 'ar' ? (ad.description_ar || ad.description) : (ad.description || ad.description_ar);
        
        // Determine if we should display RTL based on content
        const hasArabic = !!(ad.title_ar || ad.description_ar);
        const hasEnglish = !!(ad.title || ad.description);
        const showBothLanguages = hasArabic && hasEnglish
          && (ad.title_ar && ad.title ? ad.title_ar !== ad.title : !!(ad.description_ar && ad.description));

        return (
          <Card 
            key={ad.id} 
            className={`${getCampaignColor(ad.campaign_type)} border-2 shadow-sm hover:shadow-md transition-shadow`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {getCampaignIcon(ad.campaign_type)}
                </div>
                
                <div className="flex-1 min-w-0" dir={hasArabic ? 'rtl' : 'ltr'}>
                  <div className="mb-3 h-40 overflow-hidden rounded-lg border border-black/10 bg-black/5">
                    <MediaCarousel
                      items={normalizeMediaItems(ad.media_urls)}
                      isRTL={language === 'ar'}
                      showDots
                      showArrows
                      loop
                      autoPlayMs={4200}
                      pauseOnHover
                      mediaClassName="h-full w-full object-cover"
                      className="h-full"
                      emptyLabel={language === 'ar' ? 'بدون وسائط' : 'No media'}
                    />
                  </div>

                  {showBothLanguages ? (
                    // Display both languages
                    <div className="space-y-2">
                      {ad.title_ar && (
                        <div dir="rtl">
                          <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-base sm:text-lg">
                            {ad.title_ar}
                          </h3>
                          {ad.description_ar && (
                            <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1">
                              {ad.description_ar}
                            </p>
                          )}
                        </div>
                      )}
                      {ad.title && (
                        <div dir="ltr">
                          <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-base sm:text-lg">
                            {ad.title}
                          </h3>
                          {ad.description && (
                            <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1">
                              {ad.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Display single language
                    <>
                      <h3 className="font-semibold text-gray-900 dark:text-zinc-100 text-base sm:text-lg">
                        {title}
                      </h3>
                      {description && (
                        <p className="text-sm text-gray-700 dark:text-zinc-300 mt-1">
                          {description}
                        </p>
                      )}
                    </>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-8 w-8 hover:bg-gray-200/50 dark:hover:bg-zinc-700/50"
                  onClick={() => handleDismiss(ad.id)}
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-zinc-300" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
