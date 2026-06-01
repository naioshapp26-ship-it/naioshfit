import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

type TopBarAnnouncement = {
  id: number;
  title_en: string;
  title_ar: string;
  sort_order: number;
};

const SESSION_DISMISS_KEY = "public_announcement_bar_hidden";

export default function PublicAnnouncementBar() {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  });

  const { data = [] } = useQuery<TopBarAnnouncement[]>({
    queryKey: ["top-bar-announcements"],
    queryFn: async () => {
      const response = await fetch("/api/announcements/top-bar", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load announcements");
      }
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: 1,
  });

  const items = useMemo(() => {
    const normalized = Array.isArray(data) ? data : [];
    return normalized.filter((item) => (item.title_en || item.title_ar));
  }, [data]);

  if (isHidden || items.length === 0) {
    return null;
  }

  const marqueeItems = [...items, ...items];

  return (
    <>
      <div className="h-11" aria-hidden="true" />
      <div
        className="fixed top-0 left-0 right-0 z-50 border-b border-black/10"
        style={{
          backgroundColor: "hsl(var(--announcement-bar-bg))",
          color: "hsl(var(--announcement-bar-fg))",
        }}
      >
        <div className="group relative flex h-11 items-center overflow-hidden px-4">
          <div
            className={cn(
              "announcement-marquee-track flex min-w-max items-center gap-8 whitespace-nowrap pr-10",
              isRTL ? "announcement-marquee-rtl" : "announcement-marquee-ltr",
            )}
          >
            {marqueeItems.map((item, index) => {
              const text = isRTL ? (item.title_ar || item.title_en) : (item.title_en || item.title_ar);
              return (
                <span
                  key={`${item.id}-${index}`}
                  className="announcement-marquee-item text-sm font-medium tracking-wide opacity-95 transition-opacity hover:opacity-100"
                >
                  {text}
                </span>
              );
            })}
          </div>

          <button
            type="button"
            aria-label={isRTL ? "إخفاء شريط الإعلانات" : "Hide announcement bar"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/10 p-1 text-current transition-colors hover:bg-black/20"
            onClick={() => {
              setIsHidden(true);
              if (typeof window !== "undefined") {
                sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
              }
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
