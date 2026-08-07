import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/context/LanguageContext";

interface SeoSettings {
  titleTemplate: string;
  titleTemplateEn?: string | null;
  titleTemplateAr?: string | null;
  metaDescription: string;
  metaDescriptionEn?: string | null;
  metaDescriptionAr?: string | null;
  metaKeywordsEn?: string | null;
  metaKeywordsAr?: string | null;
  metaAuthor?: string | null;
  metaViewport?: string | null;
  ogTitle: string | null;
  ogTitleEn?: string | null;
  ogTitleAr?: string | null;
  ogDescription: string | null;
  ogDescriptionEn?: string | null;
  ogDescriptionAr?: string | null;
  ogImageUrl: string | null;
  ogType?: string | null;
  ogSiteName?: string | null;
  ogLocale?: string | null;
  ogLocaleAlternates?: string[] | null;
  twitterTitle: string | null;
  twitterTitleEn?: string | null;
  twitterTitleAr?: string | null;
  twitterDescription: string | null;
  twitterDescriptionEn?: string | null;
  twitterDescriptionAr?: string | null;
  twitterImageUrl: string | null;
  twitterCardType?: string | null;
  twitterSite?: string | null;
  twitterCreator?: string | null;
  facebookTitleEn?: string | null;
  facebookTitleAr?: string | null;
  facebookDescriptionEn?: string | null;
  facebookDescriptionAr?: string | null;
  facebookImageUrl?: string | null;
  instagramTitleEn?: string | null;
  instagramTitleAr?: string | null;
  instagramDescriptionEn?: string | null;
  instagramDescriptionAr?: string | null;
  instagramImageUrl?: string | null;
  xTitleEn?: string | null;
  xTitleAr?: string | null;
  xDescriptionEn?: string | null;
  xDescriptionAr?: string | null;
  xImageUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  xUrl?: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  canonicalBaseUrl: string | null;
  hreflangMap: Record<string, string>;
}

const setMetaTag = (selector: string, attribute: "name" | "property", key: string, content: string | null) => {
  if (!content) return;
  let element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
};

const setLinkTag = (selector: string, rel: string, href: string, extra?: Record<string, string>) => {
  let element = document.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => element?.setAttribute(key, value));
  }
};

const toAbsoluteUrl = (value: string, baseUrl: string) => {
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (!baseUrl) return value;
  return value.startsWith("/") ? `${baseUrl}${value}` : `${baseUrl}/${value}`;
};

const buildTitle = (template: string, pageTitle: string | null) => {
  if (!template) return pageTitle || "";
  if (template.includes("{page}")) {
    return template.replace("{page}", pageTitle || "").replace(/\s+\|\s+$/, "").trim();
  }
  return template;
};

export const SeoManager = () => {
  const [location] = useLocation();
  const { t, language } = useLanguage();

  const { data } = useQuery({
    queryKey: ["/api/seo"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/seo");
      return response.json();
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const settings: SeoSettings | undefined = data?.settings;
    if (!settings) return;

    const resolveLocalized = (enValue?: string | null, arValue?: string | null, fallback?: string | null) => {
      const candidate = language === "ar" ? arValue : enValue;
      return candidate || fallback || "";
    };

    const resolvePlatformLocalized = (enValue?: string | null, arValue?: string | null, fallback?: string | null) => {
      return resolveLocalized(enValue, arValue, fallback);
    };

    const baseUrl = settings.canonicalBaseUrl?.replace(/\/$/, "") || window.location.origin;
    const pageTitleMap: Record<string, string> = {
      "/": t("home"),
      "/blog": t("blog"),
      "/privacy-policy": t("privacyPolicy"),
      "/tos": t("termsOfService"),
      "/terms-of-service": t("termsOfService"),
      "/auth": t("signInToYourAccount"),
      "/signup": t("signup"),
    };

    const pageTitle = pageTitleMap[location] || null;
    const titleTemplate = resolveLocalized(settings.titleTemplateEn, settings.titleTemplateAr, settings.titleTemplate);
    const title = buildTitle(titleTemplate, pageTitle);
    if (title) {
      document.title = title;
    }

    const metaDescription = resolveLocalized(settings.metaDescriptionEn, settings.metaDescriptionAr, settings.metaDescription);
    const metaKeywords = resolveLocalized(settings.metaKeywordsEn, settings.metaKeywordsAr, null);

    setMetaTag('meta[name="description"]', "name", "description", metaDescription);
    setMetaTag('meta[name="keywords"]', "name", "keywords", metaKeywords);
    setMetaTag('meta[name="author"]', "name", "author", settings.metaAuthor || null);
    setMetaTag('meta[name="viewport"]', "name", "viewport", settings.metaViewport || null);
    setMetaTag('meta[name="robots"]', "name", "robots", `${settings.robotsIndex ? "index" : "noindex"}, ${settings.robotsFollow ? "follow" : "nofollow"}`);

    const facebookTitle = resolvePlatformLocalized(settings.facebookTitleEn, settings.facebookTitleAr, null);
    const facebookDescription = resolvePlatformLocalized(settings.facebookDescriptionEn, settings.facebookDescriptionAr, null);
    const instagramTitle = resolvePlatformLocalized(settings.instagramTitleEn, settings.instagramTitleAr, null);
    const instagramDescription = resolvePlatformLocalized(settings.instagramDescriptionEn, settings.instagramDescriptionAr, null);
    const ogTitle = resolveLocalized(settings.ogTitleEn, settings.ogTitleAr, settings.ogTitle || title);
    const ogDescription = resolveLocalized(settings.ogDescriptionEn, settings.ogDescriptionAr, settings.ogDescription || metaDescription);

    const ogTitleValue = facebookTitle || instagramTitle || ogTitle || title;
    const ogDescriptionValue = facebookDescription || instagramDescription || ogDescription || metaDescription;
    const ogImageValue = settings.facebookImageUrl || settings.instagramImageUrl || settings.ogImageUrl;

    setMetaTag('meta[property="og:title"]', "property", "og:title", ogTitleValue);
    setMetaTag('meta[property="og:description"]', "property", "og:description", ogDescriptionValue);
    setMetaTag('meta[property="og:image"]', "property", "og:image", ogImageValue ? toAbsoluteUrl(ogImageValue, baseUrl) : null);
    setMetaTag('meta[property="og:type"]', "property", "og:type", settings.ogType || "website");
    setMetaTag('meta[property="og:site_name"]', "property", "og:site_name", settings.ogSiteName || null);

    const ogLocale = settings.ogLocale || (language === "ar" ? "ar_EG" : "en_US");
    setMetaTag('meta[property="og:locale"]', "property", "og:locale", ogLocale);

    document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((node) => node.remove());
    (settings.ogLocaleAlternates || []).forEach((locale) => {
      if (!locale) return;
      const selector = `meta[property="og:locale:alternate"][content="${locale}"]`;
      setMetaTag(selector, "property", "og:locale:alternate", locale);
    });

    const xTitle = resolvePlatformLocalized(settings.xTitleEn, settings.xTitleAr, null);
    const xDescription = resolvePlatformLocalized(settings.xDescriptionEn, settings.xDescriptionAr, null);
    const twitterTitle = resolveLocalized(settings.twitterTitleEn, settings.twitterTitleAr, settings.twitterTitle || title);
    const twitterDescription = resolveLocalized(settings.twitterDescriptionEn, settings.twitterDescriptionAr, settings.twitterDescription || metaDescription);

    const twitterTitleValue = xTitle || twitterTitle || title;
    const twitterDescriptionValue = xDescription || twitterDescription || metaDescription;
    const twitterImageValue = settings.xImageUrl || settings.twitterImageUrl;

    setMetaTag('meta[property="twitter:card"]', "property", "twitter:card", settings.twitterCardType || "summary" );
    setMetaTag('meta[property="twitter:site"]', "property", "twitter:site", settings.twitterSite || null);
    setMetaTag('meta[property="twitter:creator"]', "property", "twitter:creator", settings.twitterCreator || null);
    setMetaTag('meta[property="twitter:title"]', "property", "twitter:title", twitterTitleValue);
    setMetaTag('meta[property="twitter:description"]', "property", "twitter:description", twitterDescriptionValue);
    setMetaTag('meta[property="twitter:image"]', "property", "twitter:image", twitterImageValue ? toAbsoluteUrl(twitterImageValue, baseUrl) : null);

    const canonicalUrl = `${baseUrl}${location}`;
    setLinkTag('link[rel="canonical"]', "canonical", canonicalUrl);

    document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((node) => node.remove());
    Object.entries(settings.hreflangMap || {}).forEach(([locale, url]) => {
      const absolute = toAbsoluteUrl(url, baseUrl);
      setLinkTag(`link[rel="alternate"][hreflang="${locale}"]`, "alternate", absolute, { hreflang: locale });
    });

    document.querySelectorAll('link[rel="me"]').forEach((node) => node.remove());
    [settings.facebookUrl, settings.instagramUrl, settings.xUrl].forEach((link) => {
      if (!link) return;
      setLinkTag(`link[rel="me"][href="${link}"]`, "me", link);
    });
  }, [data, language, location, t]);

  return null;
};
