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
import RentSystemCTA from "@/components/saas/RentSystemCTA";

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
    "rounded-full border border-[#E5E5E5] bg-white/90 px-3 py-1.5 text-[#8B0000] backdrop-blur-md transition-all hover:bg-[#F5F5F5] hover:scale-[1.02] shadow-sm";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/home");
  };

  return (
    <>
      {includeSpacer && <div className="h-[72px]" aria-hidden="true" />}
      <div className={cn(
        "fixed left-0 right-0 z-40 border-b border-white/10 bg-black/35 backdrop-blur-md",
        hasAnnouncementBar ? "top-11" : "top-0"
      )}>
        <div className={cn(
          "container mx-auto px-4 py-4 flex items-center justify-between",
          isRTL && "flex-row-reverse"
        )}>
          <a href="/home#top" className="text-white font-semibold flex items-center gap-2">
            <img
              src={logoUrl}
              alt="Brand logo"
              className="h-8 w-auto"
              onError={(event) => {
                event.currentTarget.src = DEFAULT_LOGO_ASSET;
              }}
            />
            <span>NaioshFit</span>
          </a>
          <div className={cn("hidden md:flex items-center gap-2 text-sm", isRTL && "flex-row-reverse")}>
            <a href="/home#top" className={navLinkClass}>{t("home")}</a>
            <a href="/home#features" className={navLinkClass}>{t("whyChooseNaioshFit")}</a>
            <a href="/home#pricing" className={navLinkClass}>{t("pricing")}</a>
            <Link href="/courses" className={navLinkClass}>{t("courses")}</Link>
            <Link href="/blog" className={navLinkClass}>{t("blog")}</Link>
            <Link href="/store" className={navLinkClass}>{t("store")}</Link>
            <Link href="/ads" className={navLinkClass}>{t("ads") || "Ads"}</Link>
            <RentSystemCTA size="sm" variant="header" />
          </div>
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <div className="md:hidden">
              <RentSystemCTA size="sm" variant="header" />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleBack}
              className="h-9 px-3 rounded-full border border-white/25 bg-black/35 text-white hover:bg-black/50 hover:text-white"
              title={isRTL ? "رجوع" : "Back"}
              aria-label={isRTL ? "رجوع" : "Back"}
            >
              <BackIcon className="h-4 w-4" />
              <span>{isRTL ? "رجوع" : "Back"}</span>
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
              className="h-9 w-9 rounded-full border border-white/25 bg-black/35 text-white hover:bg-black/50 hover:text-white"
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
                "rounded-full h-9 px-4 transition-all border border-[#E5E5E5]",
                isLoggedIn
                  ? "bg-white/90 text-[#8B0000] hover:bg-[#F5F5F5]"
                  : "bg-white text-[#8B0000] hover:bg-[#F5F5F5] shadow-sm"
              )}
              title={isLoggedIn ? t("dashboard") : t("login")}
              aria-label={isLoggedIn ? t("dashboard") : t("login")}
            >
              <ActionIcon className="h-4 w-4" />
              <span>{isLoggedIn ? t("dashboard") : t("login")}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
