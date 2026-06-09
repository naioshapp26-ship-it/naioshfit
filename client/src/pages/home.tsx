import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity, Utensils, TrendingUp, Users, ShieldCheck, Sparkles, WalletCards, BookOpen, UserRoundCheck, Dumbbell, Salad } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { GuestRoleSelectionModal } from "@/components/guest/GuestRoleSelectionModal";
import { MediaCarousel, type CarouselMediaItem } from "@/components/media/MediaCarousel";
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from "@/context/BrandingContext";
import RentSystemCTA from "@/components/saas/RentSystemCTA";

interface PublicBundlePrice {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
}

interface PublicSaasPlanPrice {
  key: string;
  name: string;
  amount: number | null;
  currency: string | null;
  interval: string | null;
}

interface HomeAdMediaItem {
  url: string;
  type: "image" | "video";
}

interface HomePublicAd {
  id: number;
  title: string | null;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  campaign_type: "offer" | "educational" | "event" | "general";
  category_name_en?: string | null;
  category_name_ar?: string | null;
  media_urls?: HomeAdMediaItem[] | string | null;
}

interface HomeBlogPost {
  id: number;
  title: string;
  titleAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  content: string;
  contentAr?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  typeMetadata?: {
    coverMediaUrl?: string;
    coverMediaType?: "image" | "video";
  } | null;
}

interface HomeCourse {
  id: number;
  title: string;
  titleAr?: string | null;
  price?: number | null;
  currency?: string | null;
  isFree?: boolean | null;
  thumbnailUrl?: string | null;
  enrollmentCount?: number | null;
  averageRating?: number | null;
  createdAt?: string | null;
  instructor?: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
}

const normalizeMediaItems = (input: unknown): HomeAdMediaItem[] => {
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
        return { url: normalized, type } as HomeAdMediaItem;
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
      return { url: rawUrl, type } as HomeAdMediaItem;
    })
    .filter((item): item is HomeAdMediaItem => Boolean(item));
};

function AnimatedCount({
  value,
  duration = 1200,
}: {
  value: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Number(value) || 0);
    let rafId = 0;
    let startedAt = 0;

    const tick = (timestamp: number) => {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min((timestamp - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(target * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    setDisplayValue(0);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [value, duration]);

  return (
    <span>
      {new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(displayValue)}
    </span>
  );
}

export default function Home() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { settings: branding } = useBranding();
  const isRTL = language === 'ar';
  const isAuthenticated = Boolean(user);
  const [bundlePrices, setBundlePrices] = useState<PublicBundlePrice[]>([]);
  const [subscriptionPrices, setSubscriptionPrices] = useState<PublicSaasPlanPrice[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [isGuestRoleModalOpen, setIsGuestRoleModalOpen] = useState(false);
  const [activeHeroMediaIndex, setActiveHeroMediaIndex] = useState(0);

  const { data: latestAds = [] } = useQuery<HomePublicAd[]>({
    queryKey: ["home-latest-ads"],
    queryFn: async () => {
      const response = await fetch("/api/ads/public?limit=4", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch public ads");
      }
      return response.json();
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data: latestArticles = [], isLoading: latestArticlesLoading } = useQuery<HomeBlogPost[]>({
    queryKey: ["home-latest-articles", language],
    queryFn: async () => {
      const response = await fetch("/api/content?type=blog&visibility=public&sort=newest&limit=4", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch latest blog posts");
      }
      const data = await response.json();
      return Array.isArray(data?.items) ? data.items : [];
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data: popularCoursesData = [], isLoading: popularCoursesLoading } = useQuery<HomeCourse[]>({
    queryKey: ["home-popular-courses"],
    queryFn: async () => {
      const response = await fetch("/api/courses?status=published", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch popular courses");
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  // Detect if we're on a tenant subdomain
  const isTenantSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    // If we have a subdomain (more than 2 parts), and it's not 'www', it's a tenant
    if (parts.length > 2 && parts[0] !== 'www') {
      return true;
    }
    return false;
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  useEffect(() => {
    let active = true;

    const loadPricing = async () => {
      try {
        const [bundleResponse, planResponse] = await Promise.all([
          fetch('/api/credits/public-bundles').then(async (response) => {
            if (!response.ok) return { bundles: [] };
            return response.json();
          }),
          fetch('/saas/plan-config').then(async (response) => {
            if (!response.ok) return { plans: [] };
            return response.json();
          }),
        ]);

        if (!active) return;

        setBundlePrices(Array.isArray(bundleResponse?.bundles) ? bundleResponse.bundles : []);
        setSubscriptionPrices(Array.isArray(planResponse?.plans) ? planResponse.plans : []);
      } catch {
        if (!active) return;
        setBundlePrices([]);
        setSubscriptionPrices([]);
      } finally {
        if (active) {
          setPricingLoading(false);
        }
      }
    };

    loadPricing();

    return () => {
      active = false;
    };
  }, []);

  const formatPrice = (amountCents: number | null | undefined, currency: string | null | undefined) => {
    if (amountCents == null || Number.isNaN(Number(amountCents))) return '—';
    const code = (currency || 'USD').toUpperCase();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  };

  const formatContentDate = (value?: string | null) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleDateString(language === "ar" ? "ar" : "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const getArticleExcerpt = (post: HomeBlogPost) => {
    const localizedDescription = isRTL ? (post.descriptionAr || post.description || "") : (post.description || post.descriptionAr || "");
    if (localizedDescription) return localizedDescription;

    const localizedContent = isRTL ? (post.contentAr || post.content || "") : (post.content || post.contentAr || "");
    return stripHtml(localizedContent).slice(0, 130);
  };

  const popularCourses = useMemo(
    () =>
      [...popularCoursesData]
        .sort((a, b) => {
          const enrollmentDiff = Number(b.enrollmentCount || 0) - Number(a.enrollmentCount || 0);
          if (enrollmentDiff !== 0) return enrollmentDiff;
          const ratingDiff = Number(b.averageRating || 0) - Number(a.averageRating || 0);
          if (ratingDiff !== 0) return ratingDiff;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        })
        .slice(0, 6),
    [popularCoursesData]
  );

  const formatCoursePrice = (price: number | null | undefined, currency: string | null | undefined, isFree?: boolean | null) => {
    if (isFree || !(Number(price) > 0)) return isRTL ? "مجاني" : "Free";
    const code = (currency || "USD").toUpperCase();
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(price));
  };

  const getInstructorName = (course: HomeCourse) => {
    const first = course.instructor?.firstName?.trim();
    const last = course.instructor?.lastName?.trim();
    const full = [first, last].filter(Boolean).join(" ").trim();
    return full || course.instructor?.username || (isRTL ? "مدرب NaioshFit" : "NaioshFit Coach");
  };

  type HeroGalleryItem = {
    id: string;
    url: string;
    mediaType: "image" | "video";
    order: number;
  };

  const fallbackHeroImage = "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80";
  const heroGalleryItems = (Array.isArray(branding.heroMediaItems) ? branding.heroMediaItems : [])
    .map((item: any, index: number) => {
      if (!item || typeof item !== "object") {
        if (typeof item === "string") {
          const raw = item.trim();
          if (!raw) return null;
          const normalized = raw.startsWith("www.") ? `https://${raw}` : raw;
          return {
            id: `hero-media-${index}`,
            url: resolveBrandAsset(normalized, ""),
            mediaType: /youtube\.com|youtu\.be|\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(normalized) ? "video" : "image",
            order: index,
          } as HeroGalleryItem;
        }
        return null;
      }
      const rawUrl =
        typeof item.url === "string"
          ? item.url.trim()
          : typeof item.mediaUrl === "string"
            ? item.mediaUrl.trim()
            : typeof item.src === "string"
              ? item.src.trim()
              : "";
      if (!rawUrl) return null;
      const normalizedUrl = rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl;
      const mediaType =
        item.mediaType === "video" ||
        item.type === "video" ||
        /youtube\.com|youtu\.be|\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(normalizedUrl)
          ? "video"
          : "image";
      const order = Number.isFinite(Number(item.order)) ? Number(item.order) : index;
      const id =
        typeof item.id === "string" && item.id.trim()
          ? `${item.id.trim()}-${index}`
          : `hero-media-${order}-${index}`;
      return {
        id,
        url: resolveBrandAsset(normalizedUrl, ""),
        mediaType,
        order,
      } as HeroGalleryItem;
    })
    .filter((item: HeroGalleryItem | null): item is HeroGalleryItem => Boolean(item))
    .sort((a, b) => a.order - b.order);
  const resolvedHeroGalleryItems: HeroGalleryItem[] = heroGalleryItems.length > 0
    ? heroGalleryItems
    : [{ id: "hero-fallback-0", url: resolveBrandAsset(branding.heroBackgroundUrl, fallbackHeroImage), mediaType: "image", order: 0 }];
  const safeActiveHeroMediaIndex =
    activeHeroMediaIndex >= 0 && activeHeroMediaIndex < resolvedHeroGalleryItems.length
      ? activeHeroMediaIndex
      : 0;
  const activeHeroMedia = resolvedHeroGalleryItems[safeActiveHeroMediaIndex] || resolvedHeroGalleryItems[0];
  const heroCarouselItems: CarouselMediaItem[] = resolvedHeroGalleryItems.map((item) => ({
    id: item.id,
    url: item.url,
    type: item.mediaType,
  }));

  useEffect(() => {
    if (activeHeroMediaIndex > resolvedHeroGalleryItems.length - 1) {
      setActiveHeroMediaIndex(0);
    }
  }, [activeHeroMediaIndex, resolvedHeroGalleryItems.length]);
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);
  const heroTitle = branding.heroTitle.trim();
  const heroSubtitle = branding.heroSubtitle.trim() || t('allInOnePlatform');
  const showHeroSection = branding.showHeroSection;
  const showFeaturesSection = branding.showFeaturesSection;
  const showPricingSection = branding.showPricingSection;
  const showCtaSection = branding.showCtaSection;
  const statsCards = [
    { label: t("statsCourses"), value: branding.statsCourses, icon: BookOpen },
    { label: t("statsCoaches"), value: branding.statsCoaches, icon: UserRoundCheck },
    { label: t("statsUsers"), value: branding.statsUsers, icon: Users },
    { label: t("statsWorkoutsCompleted"), value: branding.statsWorkoutsCompleted, icon: Dumbbell },
    { label: t("statsNutritionPlans"), value: branding.statsNutritionPlans, icon: Utensils },
    { label: t("statsMealsLogged"), value: branding.statsMealsLogged, icon: Salad },
  ];

  const whyChoosePoints = [
    {
      icon: ShieldCheck,
      title: isRTL ? 'تجربة موثوقة' : 'Trusted Experience',
      description: isRTL ? 'دفع آمن وتسعير واضح بدون مفاجآت.' : 'Secure checkout and transparent pricing without surprises.',
    },
    {
      icon: Sparkles,
      title: isRTL ? 'خطة تناسب هدفك' : 'Plan for Every Goal',
      description: isRTL ? 'خطط مرنة سواء كنت مبتدئًا أو محترفًا.' : 'Flexible options whether you are just starting or scaling up.',
    },
    {
      icon: WalletCards,
      title: isRTL ? 'تحكم كامل في الرصيد' : 'Credits with Control',
      description: isRTL ? 'تابع استهلاكك للرصيد بسهولة واختر الباقة الأنسب.' : 'Track your credit usage and choose bundles that match your pace.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hero Section */}
      {showHeroSection && (
      <section id="top" className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-background pt-28 pb-14">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {activeHeroMedia?.mediaType === "video" ? (
            <video
              src={activeHeroMedia.url}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="h-full w-full scale-110 object-cover blur-xl opacity-90"
            />
          ) : (
            <img
              src={activeHeroMedia?.url || fallbackHeroImage}
              alt=""
              aria-hidden="true"
              className="h-full w-full scale-110 object-cover blur-xl opacity-90"
              onError={(event) => {
                event.currentTarget.src = fallbackHeroImage;
              }}
            />
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 bg-black/5" />

        <motion.div
          className="relative z-20 container mx-auto px-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <motion.div
              variants={itemVariants}
              className={isRTL ? "lg:order-1 text-right" : "lg:order-1 text-left"}
            >
              <div className={isRTL ? "flex justify-end mb-8" : "flex justify-start mb-8"}>
                <img
                  src={logoUrl}
                  alt="NaioshFit Logo"
                  className="h-24 w-auto"
                  loading="eager"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_LOGO_ASSET;
                  }}
                />
              </div>

              <motion.h1
                className="text-[calc(1.525rem+3.1vw)] font-bold text-white mb-6 leading-tight"
                variants={itemVariants}
              >
                {heroTitle ? (
                  <span className="whitespace-pre-line">{heroTitle}</span>
                ) : (
                  <>
                    {t('transformYourBody')}
                    <br />
                    <span className="text-primary">{t('elevateYourLife')}</span>
                  </>
                )}
              </motion.h1>

              <motion.p
                className={isRTL
                  ? "text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl"
                  : "text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl"}
                variants={itemVariants}
              >
                {heroSubtitle}
              </motion.p>

              <motion.div className="flex flex-col gap-4" variants={itemVariants}>
                <div className={isRTL ? "flex flex-col sm:flex-row-reverse sm:flex-wrap gap-4 sm:justify-end" : "flex flex-col sm:flex-row sm:flex-wrap gap-4"}>
                  {isAuthenticated ? (
                    <Link href="/courses">
                      <Button size="lg" className="text-lg px-8 py-6 rounded-full">
                        {t('courses')} {isRTL ? <ArrowRight className="mr-2 h-5 w-5 rotate-180" /> : <ArrowRight className="ml-2 h-5 w-5" />}
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/signup">
                      <Button size="lg" className="text-lg px-8 py-6 rounded-full animate-pulse">
                        {t('getStarted')} {isRTL ? <ArrowRight className="mr-2 h-5 w-5 rotate-180" /> : <ArrowRight className="ml-2 h-5 w-5" />}
                      </Button>
                    </Link>
                  )}
                  {!isTenantSubdomain && (
                    <RentSystemCTA size="lg" className="shadow-[0_0_40px_rgba(255,255,255,0.25)]" />
                  )}
                  {!isTenantSubdomain && (
                    <Link href="/saas">
                      <Button
                        variant="secondary"
                        size="lg"
                        className="text-lg px-8 py-6 rounded-full bg-white/90 text-[#8B0000] border border-[#E5E5E5] hover:bg-[#F5F5F5]"
                      >
                        {t('becomeTenant')}
                      </Button>
                    </Link>
                  )}
                  {isAuthenticated ? (
                    <Link href="/dashboard">
                      <Button variant="outline" size="lg" className="text-lg px-8 py-6 rounded-full bg-black/30 backdrop-blur-sm border-white/20 text-white hover:bg-black/40">
                        {t('dashboard')}
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/auth?mode=login">
                      <Button variant="outline" size="lg" className="text-lg px-8 py-6 rounded-full bg-black/30 backdrop-blur-sm border-white/20 text-white hover:bg-black/40">
                        {t('login')}
                      </Button>
                    </Link>
                  )}
                </div>

                {!isAuthenticated && (
                  <div className={isRTL ? "flex justify-end" : "flex justify-start"}>
                    <Button
                      size="lg"
                      className="text-lg px-8 py-6 rounded-full bg-red-900 hover:bg-red-800 text-white"
                      onClick={() => setIsGuestRoleModalOpen(true)}
                    >
                      {isRTL ? "الدخول كزائر" : "Continue as Guest"}
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="lg:order-2"
            >
              <div className="relative w-full">
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
                  {activeHeroMedia?.mediaType === "video" ? (
                    <div className="h-full w-full bg-black/35" />
                  ) : (
                    <img
                      src={activeHeroMedia?.url || fallbackHeroImage}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full scale-110 object-cover blur-2xl opacity-45"
                    />
                  )}
                </div>

                <div className="relative w-full aspect-video max-h-[72vh] overflow-hidden rounded-[2rem] border border-white/15 bg-black/40 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                  <MediaCarousel
                    items={heroCarouselItems}
                    isRTL={isRTL}
                    showDots
                    showArrows
                    loop
                    autoPlayMs={4500}
                    pauseOnHover
                    onSlideChange={setActiveHeroMediaIndex}
                    videoPlayerControls
                    mediaClassName="h-full w-full bg-black object-contain"
                    className="h-full"
                    emptyLabel={isRTL ? "لا توجد وسائط" : "No media"}
                  />
                </div>
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-t from-black/35 via-transparent to-black/10" />
              </div>
            </motion.div>
          </div>
        </motion.div>
        <GuestRoleSelectionModal open={isGuestRoleModalOpen} onOpenChange={setIsGuestRoleModalOpen} />
      </section>
      )}

      <section className="py-14 bg-gradient-to-b from-background to-slate-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {statsCards.map((item, index) => (
              <motion.div
                key={item.label + index}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.14 }}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-[0_14px_32px_rgba(24,24,27,0.12)] dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="mb-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-3xl md:text-4xl font-black text-zinc-900 leading-none dark:text-zinc-100">
                  <AnimatedCount value={Number(item.value || 0)} duration={1100} />
                </p>
                <p className="mt-2 text-xs md:text-sm text-zinc-500 dark:text-zinc-300">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      {showFeaturesSection && (
      <section id="features" className="py-24 bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-[#5a1b1b] bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-center mb-16 px-6 py-10 md:px-10 md:py-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
            <h2 className="relative z-10 text-3xl md:text-4xl font-bold mb-4 text-white">{t('whyChooseNaioshFit')}</h2>
            <p className="relative z-10 text-white/90 text-lg max-w-2xl mx-auto">
              {t('toolsToSucceed')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Activity className="h-10 w-10 text-primary" />,
                title: t('smartWorkouts'),
                description: t('smartWorkoutsDesc'),
              },
              {
                icon: <Utensils className="h-10 w-10 text-primary" />,
                title: t('nutritionTracking'),
                description: t('nutritionTrackingDesc'),
              },
              {
                icon: <TrendingUp className="h-10 w-10 text-primary" />,
                title: t('progressAnalytics'),
                description: t('progressAnalyticsDesc'),
              },
              {
                icon: <Users className="h-10 w-10 text-primary" />,
                title: t('communitySupport'),
                description: t('communitySupportDesc'),
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="soft-card p-6 rounded-2xl bg-card border border-border"
              >
                <div className="mb-4 p-3 bg-primary/10 rounded-xl w-fit">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Latest Articles Section */}
      <section id="latest-articles" className="py-24 bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-[#5a1b1b] bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-center mb-12 px-6 py-10 md:px-10 md:py-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
            <h2 className="relative z-10 text-3xl md:text-4xl font-bold mb-4 text-white">
              {isRTL ? "أحدث المقالات" : "Latest Articles"}
            </h2>
            <p className="relative z-10 text-white/90 text-lg max-w-2xl mx-auto">
              {isRTL ? "اكتشف أحدث النصائح والتحديثات من فريق NaioshFit." : "Discover the latest tips and updates from NaioshFit."}
            </p>
          </motion.div>

          {latestArticlesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="soft-card rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                  <div className="h-44 bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-1/3 bg-muted rounded" />
                    <div className="h-5 w-5/6 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-4/5 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : latestArticles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {latestArticles.map((post, index) => {
                  const postTitle = isRTL ? (post.titleAr || post.title || "") : (post.title || post.titleAr || "");
                  const excerpt = getArticleExcerpt(post);
                  const coverUrl = typeof post.typeMetadata?.coverMediaUrl === "string" ? post.typeMetadata.coverMediaUrl : "";
                  const publishDate = formatContentDate(post.publishedAt || post.createdAt);
                  const postHref = `/blog?post=${post.id}`;

                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: index * 0.08 }}
                      className="soft-card rounded-2xl border border-border bg-card overflow-hidden"
                    >
                      <Link href={postHref} className="block h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                        <div className="h-44 border-b border-border bg-muted/40 overflow-hidden">
                          {coverUrl ? (
                            <img src={coverUrl} alt={postTitle || "article"} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-white flex items-center justify-center text-muted-foreground text-sm">
                              {isRTL ? "بدون صورة" : "No image"}
                            </div>
                          )}
                        </div>
                        <div className="p-5 space-y-3">
                          <p className="text-xs text-muted-foreground">{publishDate}</p>
                          <h3 className="text-lg font-semibold leading-snug line-clamp-2">{postTitle}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-3">{excerpt}</p>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-10 text-center">
                <Link href="/blog">
                  <Button size="lg" className="rounded-full px-8 group">
                    {isRTL ? "عرض كل المقالات" : "View All Articles"}
                    <ArrowRight className="h-4 w-4 ms-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* Popular Courses Section */}
      <section id="popular-courses" className="py-24 bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-[#5a1b1b] bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-center mb-12 px-6 py-10 md:px-10 md:py-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
            <h2 className="relative z-10 text-3xl md:text-4xl font-bold mb-4 text-white">
              {isRTL ? "الدورات الأكثر شيوعًا" : "Popular Courses"}
            </h2>
            <p className="relative z-10 text-white/90 text-lg max-w-2xl mx-auto">
              {isRTL ? "تعلّم من أفضل الدورات المتاحة الآن." : "Learn from our most popular published courses."}
            </p>
          </motion.div>

          {popularCoursesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="soft-card rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
                  <div className="h-48 bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-2/3 bg-muted rounded" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                    <div className="h-5 w-1/3 bg-muted rounded" />
                    <div className="h-10 w-28 bg-muted rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : popularCourses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {popularCourses.map((course, index) => {
                  const title = isRTL ? (course.titleAr || course.title || "") : (course.title || course.titleAr || "");
                  const instructorName = getInstructorName(course);
                  const priceText = formatCoursePrice(course.price, course.currency, course.isFree);
                  const courseHref = `/courses/${course.id}`;

                  return (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: index * 0.08 }}
                      className="soft-card rounded-2xl border border-border bg-card overflow-hidden cursor-pointer focus-within:ring-2 focus-within:ring-primary/60"
                      onClick={() => navigate(courseHref)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(courseHref);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="h-48 border-b border-border bg-muted/40 overflow-hidden">
                        {course.thumbnailUrl ? (
                          <img src={course.thumbnailUrl} alt={title || "course"} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-white flex items-center justify-center text-muted-foreground text-sm">
                            {isRTL ? "بدون صورة" : "No image"}
                          </div>
                        )}
                      </div>

                      <div className="p-5 space-y-3">
                        <h3 className="text-lg font-semibold leading-snug line-clamp-2">{title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t("instructor")}: {instructorName}
                        </p>
                        <p className="text-base font-semibold text-primary">{priceText}</p>
                        <Button
                          size="sm"
                          className="rounded-full px-5"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(courseHref);
                          }}
                        >
                          {isRTL ? "اشترك" : "Enroll"}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-10 text-center">
                <Link href="/courses">
                  <Button size="lg" className="rounded-full px-8 group">
                    {isRTL ? "تصفح كل الدورات" : "Browse All Courses"}
                    <ArrowRight className="h-4 w-4 ms-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {latestAds.length > 0 && (
      <section id="ads" className="py-24 bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-[#5a1b1b] bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-center mb-12 px-6 py-10 md:px-10 md:py-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
            <h2 className="relative z-10 text-3xl md:text-4xl font-bold mb-4 text-white">{isRTL ? 'إعلانات مميزة' : 'Featured Ads'}</h2>
            <p className="relative z-10 text-white/90 text-lg max-w-2xl mx-auto">
              {isRTL ? 'اكتشف أحدث الحملات والعروض المميزة.' : 'Discover featured and latest active ad campaigns.'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {latestAds.slice(0, 4).map((ad, index) => {
              const title = isRTL ? (ad.title_ar || ad.title || '') : (ad.title || ad.title_ar || '');
              const description = isRTL ? (ad.description_ar || ad.description || '') : (ad.description || ad.description_ar || '');
              const media = normalizeMediaItems(ad.media_urls);
              const adHref = `/ads/${ad.id}`;

              return (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="soft-card rounded-2xl overflow-hidden border border-border bg-card cursor-pointer focus-within:ring-2 focus-within:ring-primary/60"
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
                  <div className="h-44 bg-slate-100 border-b border-border overflow-hidden">
                    <MediaCarousel
                      items={media}
                      isRTL={isRTL}
                      showDots
                      showArrows
                      loop
                      autoPlayMs={4200}
                      pauseOnHover
                      videoControls={false}
                      videoPlayerControls
                      mediaClassName="h-full w-full object-cover"
                      className="h-full"
                      emptyLabel={isRTL ? 'بدون وسائط' : 'No media'}
                    />
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{ad.campaign_type}</div>
                    <h3 className="text-xl font-semibold line-clamp-2">{title}</h3>
                    {description ? (
                      <p className="text-muted-foreground text-sm line-clamp-3">{description}</p>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(adHref);
                      }}
                    >
                      {isRTL ? 'عرض التفاصيل' : 'View Details'}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link href="/ads">
              <Button size="lg" className="rounded-full px-8">
                {isRTL ? 'استكشف كل الإعلانات' : 'Explore All Ads'}
              </Button>
            </Link>
          </div>
        </div>
      </section>
      )}

      {/* Pricing Section */}
      {showPricingSection && (
      <section id="pricing" className="py-24 bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        </div>
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-[#5a1b1b] bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-center mb-10 px-6 py-10 md:px-10 md:py-12"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
            <h2 className="relative z-10 text-3xl md:text-4xl font-bold mb-4 text-white">{t('pricingSectionTitle')}</h2>
            <p className="relative z-10 text-white/90 text-lg max-w-2xl mx-auto">{t('pricingSectionSubtitle')}</p>
          </motion.div>

          <div className={`grid grid-cols-1 ${isTenantSubdomain ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-8`}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="soft-card p-6 rounded-3xl bg-card border border-border"
            >
              <h3 className="text-2xl font-semibold mb-4">{t('bundlePrices')}</h3>
              {pricingLoading ? (
                <p className="text-muted-foreground">...</p>
              ) : bundlePrices.length ? (
                <div className="space-y-3">
                  {bundlePrices.slice(0, 6).map((bundle, index) => (
                    <motion.div
                      key={bundle.id}
                      initial={{ opacity: 0, x: isRTL ? -16 : 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: index * 0.06 }}
                      className="flex items-center justify-between rounded-xl border border-border p-4 bg-background/80 hover:bg-background transition-colors"
                    >
                      <div>
                        <p className="font-medium text-base">{bundle.name}</p>
                        <p className="text-sm text-muted-foreground">{bundle.credits} {t('creditsUnit')}</p>
                      </div>
                      <p className="font-semibold text-primary">{formatPrice(bundle.price_cents, bundle.currency)}</p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">{t('noBundlePrices')}</p>
              )}
            </motion.div>

            {!isTenantSubdomain && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="soft-card p-6 rounded-3xl bg-card border border-border"
              >
                <h3 className="text-2xl font-semibold mb-4">{t('subscriptionPrices')}</h3>
                {pricingLoading ? (
                  <p className="text-muted-foreground">...</p>
                ) : subscriptionPrices.length ? (
                  <div className="space-y-3">
                    {subscriptionPrices.slice(0, 6).map((plan, index) => (
                      <motion.div
                        key={plan.key}
                        initial={{ opacity: 0, x: isRTL ? 16 : -16 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35, delay: index * 0.06 }}
                        className="flex items-center justify-between rounded-xl border border-border p-4 bg-background/80 hover:bg-background transition-colors"
                      >
                        <div>
                          <p className="font-medium text-base">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">{plan.key}</p>
                        </div>
                        <p className="font-semibold text-primary">
                          {formatPrice(plan.amount, plan.currency)}
                          {plan.interval ? ` / ${plan.interval}` : ''}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('noSubscriptionPrices')}</p>
                )}
              </motion.div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {whyChoosePoints.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.12 + index * 0.08 }}
                  className="soft-card rounded-2xl border border-border bg-card/90 p-5"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>
      )}

      {/* CTA Section */}
      {showCtaSection && (
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-sky-50 to-background dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 z-0" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl border border-[#5a1b1b] bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-white px-6 py-12 md:px-10 md:py-14 shadow-2xl"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div className="relative z-10 text-center md:text-start">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">{t('readyToStart')}</h2>
                <p className="text-lg md:text-xl text-white/90 max-w-2xl">{t('joinThousands')}</p>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="relative z-10 flex justify-center"
              >
                <Link href="/signup">
                  <Button size="lg" className="text-base md:text-lg px-9 py-6 rounded-full bg-[#fff8f3] text-[#6b2020] hover:bg-[#fff1e8] dark:bg-[#fff8f3] dark:text-[#6b2020] dark:hover:bg-[#fff1e8] shadow-xl transition-all hover:scale-105">
                    {t('joinNowFree')}
                  </Button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
      )}

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="flex items-center gap-2">
                <img
                  src={logoUrl}
                  alt="NaioshFit Logo"
                  className="h-8 w-auto"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = DEFAULT_LOGO_ASSET;
                  }}
                />
                <h3 className="text-2xl font-bold text-primary">NaioshFit</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-2">© 2026 NaioshFit. {t('allRightsReserved')}</p>
            </div>
            <div className="flex gap-6">
              <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('privacyPolicy')}
              </Link>
              <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                {t('termsOfService')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}