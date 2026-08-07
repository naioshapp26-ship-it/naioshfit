import { Link } from "wouter";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, LayoutDashboard, Moon, Sun, UserRound } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from "@/context/BrandingContext";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PublicTopNavProps {
  includeSpacer?: boolean;
  hasAnnouncementBar?: boolean;
}

export default function PublicTopNav({ includeSpacer = true, hasAnnouncementBar = true }: PublicTopNavProps) {
  const { t, language } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { settings: branding } = useBranding();
  const isRTL = language === "ar";
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);
  const isLoggedIn = Boolean(user);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const ActionIcon = isLoggedIn ? LayoutDashboard : UserRound;
  const navLinkClass =
    "rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-white transition-colors hover:bg-black/50 hover:text-white";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/home");
  };

  return (
    <>
      {includeSpacer && <div className="h-[64px] md:h-[72px]" aria-hidden="true" />}
      <div className={cn(
        "fixed left-0 right-0 z-40 border-b border-white/10 bg-black/35 backdrop-blur-md",
        hasAnnouncementBar ? "top-11" : "top-0"
      )}>
        <div className={cn(
          "container mx-auto px-3 md:px-4 py-2.5 md:py-4 min-h-[64px] md:min-h-[72px] flex items-center justify-between gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <a href="/home#top" className="text-white font-semibold flex items-center gap-2 shrink-0 min-w-0">
            <img
              src={logoUrl}
              alt="Brand logo"
              className="h-7 md:h-8 w-auto"
              onError={(event) => {
                event.currentTarget.src = DEFAULT_LOGO_ASSET;
              }}
            />
            <span className="hidden sm:inline truncate">NaioshFit</span>
          </a>
          <div className={cn("hidden md:flex items-center gap-2 text-sm", isRTL && "flex-row-reverse")}>
            <a href="/home#top" className={navLinkClass}>{t("home")}</a>
            <a href="/home#features" className={navLinkClass}>{t("whyChooseNaioshFit")}</a>
            <a href="/home#pricing" className={navLinkClass}>{t("pricing")}</a>
            <Link href="/courses" className={navLinkClass}>{t("courses")}</Link>
            <Link href="/blog" className={navLinkClass}>{t("blog")}</Link>
            <Link href="/store" className={navLinkClass}>{t("store")}</Link>
            <Link href="/ads" className={navLinkClass}>{t("ads") || "Ads"}</Link>
          </div>
          <div className={cn("flex items-center gap-1.5 md:gap-2 shrink-0", isRTL && "flex-row-reverse")}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleBack}
              className="h-9 px-2 md:px-3 rounded-full border border-white/25 bg-black/35 text-white hover:bg-black/50 hover:text-white"
              title={isRTL ? "رجوع" : "Back"}
              aria-label={isRTL ? "رجوع" : "Back"}
            >
              <BackIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{isRTL ? "رجوع" : "Back"}</span>
            </Button>

            <LanguageToggle
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-white/25 bg-black/35 text-white hover:bg-black/50 hover:text-white"
            />

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              className="hidden sm:inline-flex h-9 w-9 rounded-full border border-white/25 bg-black/35 text-white hover:bg-black/50 hover:text-white"
              title={theme === "dark" ? (isRTL ? "الوضع الفاتح" : "Light mode") : (isRTL ? "الوضع الداكن" : "Dark mode")}
              aria-label={theme === "dark" ? (isRTL ? "الوضع الفاتح" : "Light mode") : (isRTL ? "الوضع الداكن" : "Dark mode")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              type="button"
              variant={isLoggedIn ? "outline" : "default"}
              size="sm"
              onClick={() => navigate(isLoggedIn ? "/dashboard" : "/auth")}
              className={cn(
                "rounded-full h-9 px-2.5 sm:px-4 transition-all",
                isLoggedIn
                  ? "border-white/40 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                  : "bg-gradient-to-r from-red-600 to-orange-500 text-white hover:brightness-110 shadow-lg ring-1 ring-red-300/50"
              )}
              title={isLoggedIn ? t("dashboard") : t("login")}
              aria-label={isLoggedIn ? t("dashboard") : t("login")}
            >
              <ActionIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{isLoggedIn ? t("dashboard") : t("login")}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
