import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  fallbackHref?: string;
  size?: "sm" | "default" | "lg" | "icon";
}

export default function BackButton({
  className,
  fallbackHref = "/home",
  size = "sm",
}: BackButtonProps) {
  const { language } = useLanguage();
  const [, navigate] = useLocation();
  const isRTL = language === "ar";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.back();

      // Some browser/history flows keep the same route (e.g. logout -> /auth).
      // In that case, fall back to an explicit route so the button never appears broken.
      window.setTimeout(() => {
        const nextUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (nextUrl === currentUrl) {
          navigate(fallbackHref);
        }
      }, 150);
      return;
    }

    navigate(fallbackHref);
  };

  return (
    <Button
      type="button"
      size={size}
      onClick={handleBack}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-red-950/40 bg-red-900 px-4 text-white shadow-sm transition-colors hover:bg-red-950",
        className
      )}
      aria-label={isRTL ? "رجوع" : "Back"}
    >
      <ArrowLeft className={cn("h-4 w-4", isRTL && "rotate-180")} />
      <span>{isRTL ? "رجوع" : "Back"}</span>
    </Button>
  );
}