import { useEffect, useMemo, useRef, useState } from "react";
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { getYouTubeEmbedUrl, isYouTubeUrl } from "@/lib/youtube-utils";

export type CarouselMediaItem = {
  id?: string;
  url: string;
  type: "image" | "video";
};

type NormalizedCarouselMediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return trimmed;
};

const looksLikeVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url) || isYouTubeUrl(url);
const looksLikeImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|ico)(\?|#|$)/i.test(url);

type MediaCarouselProps = {
  items: CarouselMediaItem[];
  className?: string;
  mediaClassName?: string;
  isRTL?: boolean;
  showDots?: boolean;
  showArrows?: boolean;
  loop?: boolean;
  autoPlayMs?: number;
  pauseOnHover?: boolean;
  onSlideChange?: (index: number) => void;
  videoControls?: boolean;
  videoPlayerControls?: boolean;
  emptyLabel?: string;
};

export function MediaCarousel({
  items,
  className,
  mediaClassName,
  isRTL = false,
  showDots = true,
  showArrows = true,
  loop = true,
  autoPlayMs = 4500,
  pauseOnHover = true,
  onSlideChange,
  videoControls = false,
  videoPlayerControls = false,
  emptyLabel,
}: MediaCarouselProps) {
  const playVideoSafely = (videoElement: HTMLVideoElement) => {
    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Ignore autoplay rejections and rely on canplay/user interaction as fallback.
      });
    }
  };

  const normalizedItems = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .map((item, index) => {
          if (!item || typeof item.url !== "string") return null;
          const url = normalizeUrl(item.url);
          if (!url) return null;
          const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `slide-${index}-${url}`;
          const inferredType = looksLikeVideoUrl(url)
            ? "video"
            : looksLikeImageUrl(url)
              ? "image"
              : item.type === "video"
                ? "video"
                : "image";
          return {
            id,
            url,
            type: inferredType,
          } as NormalizedCarouselMediaItem;
        })
        .filter((item): item is NormalizedCarouselMediaItem => Boolean(item)),
    [items],
  );

  const hasVideoSlides = normalizedItems.some((item) => item.type === "video");
  const effectiveLoop = hasVideoSlides ? false : loop;

  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    if (!api) return;

    const handleSelect = () => {
      const selected = api.selectedScrollSnap();
      setActiveIndex(selected);
      onSlideChange?.(selected);
    };

    handleSelect();
    api.on("select", handleSelect);
    api.on("reInit", handleSelect);

    return () => {
      api.off("select", handleSelect);
      api.off("reInit", handleSelect);
    };
  }, [api, onSlideChange]);

  useEffect(() => {
    if (!api || normalizedItems.length <= 1 || autoPlayMs <= 0 || isPaused || videoControls) return;

    const timer = window.setInterval(() => {
      api.scrollNext();
    }, autoPlayMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [api, autoPlayMs, isPaused, normalizedItems.length, videoControls]);

  useEffect(() => {
    if (activeIndex > normalizedItems.length - 1) {
      setActiveIndex(0);
      onSlideChange?.(0);
    }
  }, [activeIndex, normalizedItems.length, onSlideChange]);

  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, normalizedItems.length);
  }, [normalizedItems.length]);

  useEffect(() => {
    if (videoControls) return;

    const rafId = window.requestAnimationFrame(() => {
      normalizedItems.forEach((item, index) => {
        if (item.type !== "video" || isYouTubeUrl(item.url)) return;

        const videoElement = videoRefs.current[index];
        if (!videoElement) return;

        if (index === activeIndex) {
          videoElement.muted = true;
          try {
            videoElement.currentTime = 0;
          } catch {
            // Ignore seeks that fail before metadata is fully available.
          }
          playVideoSafely(videoElement);
          videoElement.addEventListener(
            "canplay",
            () => {
              if (index === activeIndex) {
                playVideoSafely(videoElement);
              }
            },
            { once: true },
          );
          return;
        }

        videoElement.pause();
        try {
          videoElement.currentTime = 0;
        } catch {
          // Ignore seeks on inactive slides when metadata is not ready yet.
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [activeIndex, normalizedItems, videoControls]);

  if (normalizedItems.length === 0) {
    return (
      <div className={cn("flex h-full min-h-[220px] items-center justify-center rounded-xl border bg-muted/20", className)}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Megaphone className="h-6 w-6" />
          <span className="text-sm">{emptyLabel || (isRTL ? "لا توجد وسائط" : "No media")}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("relative h-full", className)}
      onMouseEnter={() => {
        if (pauseOnHover) setIsPaused(true);
      }}
      onMouseLeave={() => {
        if (pauseOnHover) setIsPaused(false);
      }}
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: effectiveLoop, align: "start", direction: isRTL ? "rtl" : "ltr" }}
        className="h-full w-full"
      >
        <CarouselContent className="ml-0 h-full">
          {normalizedItems.map((item, index) => (
            <CarouselItem key={item.id} className="pl-0 h-full">
              <div className="h-full w-full">
                {item.type === "video" ? (
                  isYouTubeUrl(item.url) ? (
                    <iframe
                      src={getYouTubeEmbedUrl(item.url)}
                      title={isRTL ? `فيديو ${index + 1}` : `Video ${index + 1}`}
                      className={cn(
                        "h-full w-full border-0",
                        videoPlayerControls ? "pointer-events-auto" : "pointer-events-none md:pointer-events-auto",
                        mediaClassName,
                      )}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  ) : (
                    <video
                      ref={(element) => {
                        videoRefs.current[index] = element;
                      }}
                      src={item.url}
                      controls={videoControls || videoPlayerControls}
                      muted
                      playsInline
                      preload={videoPlayerControls ? "auto" : index === activeIndex ? "auto" : "metadata"}
                      autoPlay={index === activeIndex}
                      loop
                      onLoadedMetadata={(event) => {
                        if (index !== activeIndex) return;
                        event.currentTarget.muted = true;
                        playVideoSafely(event.currentTarget);
                      }}
                      onCanPlay={(event) => {
                        if (index !== activeIndex) return;
                        event.currentTarget.muted = true;
                        playVideoSafely(event.currentTarget);
                      }}
                      className={cn("h-full w-full object-cover", mediaClassName)}
                    />
                  )
                ) : (
                  <img
                    src={item.url}
                    alt={isRTL ? `وسيط ${index + 1}` : `Media ${index + 1}`}
                    className={cn("h-full w-full object-cover", mediaClassName)}
                  />
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {showArrows && normalizedItems.length > 1 ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="absolute left-3 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/65"
            onClick={(event) => {
              event.stopPropagation();
              api?.scrollPrev();
            }}
            aria-label={isRTL ? "السابق" : "Previous"}
          >
            {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="absolute right-3 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full bg-black/45 text-white hover:bg-black/65"
            onClick={(event) => {
              event.stopPropagation();
              api?.scrollNext();
            }}
            aria-label={isRTL ? "التالي" : "Next"}
          >
            {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </>
      ) : null}

      {showDots && normalizedItems.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1">
          {normalizedItems.map((_, index) => (
            <button
              key={index}
              type="button"
              className={cn(
                "h-2.5 w-2.5 rounded-full transition",
                activeIndex === index ? "bg-white" : "bg-white/45 hover:bg-white/70",
              )}
              onClick={(event) => {
                event.stopPropagation();
                api?.scrollTo(index);
              }}
              aria-label={isRTL ? `اذهب إلى الشريحة ${index + 1}` : `Go to slide ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
