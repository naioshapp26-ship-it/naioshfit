import React, { useContext } from "react";
import { Button } from "@/components/ui/button";
import { Languages, Moon, Sun } from "lucide-react";
import { ThemeContext } from "@/context/ThemeContext";
import { LanguageContext, useLanguage } from "@/context/LanguageContext";
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from "@/context/BrandingContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { isGuestUser } from "@/lib/guest-utils";

type FooterQuickLink = {
  id: string;
  labelEn: string;
  labelAr: string;
  href: string;
};

type PublicSiteSettings = {
  quickLinks: FooterQuickLink[];
  socialLinks: Record<string, string>;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerGradientFrom: string;
  footerGradientTo: string;
};

const defaultSiteSettings: PublicSiteSettings = {
  quickLinks: [
    { id: "home", labelEn: "Home", labelAr: "الرئيسية", href: "/home" },
    { id: "blog", labelEn: "Blog", labelAr: "المدونة", href: "/blog" },
    { id: "courses", labelEn: "Courses", labelAr: "الدورات", href: "/courses" },
    { id: "store", labelEn: "Store", labelAr: "المتجر", href: "/store" },
    { id: "ads", labelEn: "Ads", labelAr: "الإعلانات", href: "/ads" },
    { id: "signup", labelEn: "Sign up", labelAr: "إنشاء حساب", href: "/signup" },
    { id: "become-tenant", labelEn: "Become a tenant", labelAr: "كن مستأجرا", href: "/saas" },
    { id: "privacy", labelEn: "Privacy Policy", labelAr: "سياسة الخصوصية", href: "/privacy-policy" },
    { id: "tos", labelEn: "Terms of Service", labelAr: "شروط الخدمة", href: "/tos" },
  ],
  socialLinks: { facebook: "", instagram: "", x: "", linkedin: "", youtube: "", tiktok: "" },
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  footerGradientFrom: "#0f172a",
  footerGradientTo: "#1e293b",
};

const Footer: React.FC = () => {
  const themeContext = useContext(ThemeContext);
  const languageContext = useContext(LanguageContext);
  const { t } = useLanguage();
  const { settings: branding } = useBranding();
  const { user } = useAuth();
  const isLoggedIn = !!user && !isGuestUser(user);

  const [localTheme, setLocalTheme] = React.useState<"light" | "dark">("light");
  const [localLanguage, setLocalLanguage] = React.useState<"en" | "ar">("en");

  const language = languageContext?.language || localLanguage;
  const theme = themeContext?.theme || localTheme;
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);

  const { data } = useQuery({
    queryKey: ["/api/public/site-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/public/site-settings");
      return response.json();
    },
  });

  const siteSettings: PublicSiteSettings = {
    ...defaultSiteSettings,
    ...(data?.settings || {}),
    socialLinks: {
      ...defaultSiteSettings.socialLinks,
      ...(data?.settings?.socialLinks || {}),
    },
    quickLinks: (data?.settings?.quickLinks || defaultSiteSettings.quickLinks)
      .filter((link) => !(isLoggedIn && link.id === "signup")),
  };

  const toggleLanguage =
    languageContext?.toggleLanguage ||
    (() => {
      const newLanguage = localLanguage === "en" ? "ar" : "en";
      setLocalLanguage(newLanguage);
      if (typeof window !== "undefined") {
        document.documentElement.setAttribute(
          "dir",
          newLanguage === "ar" ? "rtl" : "ltr",
        );
        document.documentElement.setAttribute("lang", newLanguage);
        localStorage.setItem("language", newLanguage);
      }
    });

  const toggleTheme =
    themeContext?.toggleTheme ||
    (() => {
      const nextTheme = localTheme === "light" ? "dark" : "light";
      setLocalTheme(nextTheme);
      if (typeof window !== "undefined") {
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
        localStorage.setItem("theme", nextTheme);
      }
    });

  React.useEffect(() => {
    if (!themeContext && typeof window !== "undefined") {
      const storedTheme = localStorage.getItem("theme") as
        | "light"
        | "dark"
        | null;
      if (storedTheme) {
        setLocalTheme(storedTheme);
        document.documentElement.classList.toggle(
          "dark",
          storedTheme === "dark",
        );
      }
    }
  }, [themeContext]);

  React.useEffect(() => {
    if (!languageContext && typeof window !== "undefined") {
      const storedLanguage = localStorage.getItem("language") as
        | "en"
        | "ar"
        | null;
      if (storedLanguage) {
        setLocalLanguage(storedLanguage);
        document.documentElement.setAttribute(
          "dir",
          storedLanguage === "ar" ? "rtl" : "ltr",
        );
      }
    }
  }, [languageContext]);

  return (
    <footer
      className="border-t text-slate-100 p-6"
      style={{
        background: `linear-gradient(135deg, ${siteSettings.footerGradientFrom}, ${siteSettings.footerGradientTo})`,
      }}
    >
      <div className="max-w-7xl mx-auto grid gap-6 md:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Naioshfit"
            className="h-6 w-auto"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = DEFAULT_LOGO_ASSET;
            }}
          />
          <div className="text-sm text-slate-200">
            © 2026 Naiosh Fit. {t("allRightsReserved")}.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className={cn(
              "rounded-full border px-3",
              theme === "light"
                ? "bg-red-900 border-red-800 text-white hover:bg-red-800"
                : "bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
            )}
          >
            <Languages className="h-4 w-4" />
            {language === "en" ? "العربية" : "English"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="rounded-full border border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700"
            title={theme === "dark" ? (language === "ar" ? "الوضع الفاتح" : "Light mode") : (language === "ar" ? "الوضع الداكن" : "Dark mode")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === "dark" ? (language === "ar" ? "فاتح" : "Light") : (language === "ar" ? "داكن" : "Dark")}</span>
          </Button>
        </div>
        </div>

        <div>
          <div className="mb-2">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold">
              {language === "ar" ? "روابط سريعة" : "Quick Links"}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            {siteSettings.quickLinks.map((link) => (
              <a key={link.id} href={link.href} className="block text-slate-200 hover:text-white underline-offset-2 hover:underline">
                {language === "ar" ? link.labelAr || link.labelEn : link.labelEn || link.labelAr}
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold">
              {language === "ar" ? "تواصل" : "Contact"}
            </span>
          </div>
          <div className="space-y-1 text-sm text-slate-200">
            {siteSettings.contactEmail ? <div>{siteSettings.contactEmail}</div> : null}
            {siteSettings.contactPhone ? <div>{siteSettings.contactPhone}</div> : null}
            {siteSettings.contactAddress ? <div>{siteSettings.contactAddress}</div> : null}
          </div>
        </div>

        <div>
          <div className="mb-2">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-semibold">
              {language === "ar" ? "السوشيال ميديا" : "Social"}
            </span>
          </div>
          <div className="space-y-1 text-sm">
            {Object.entries(siteSettings.socialLinks)
              .filter(([, value]) => !!value)
              .map(([key, value]) => (
                <a key={key} href={value} target="_blank" rel="noreferrer" className="block text-slate-200 hover:text-white underline-offset-2 hover:underline">
                  {key}
                </a>
              ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
