import { Link } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import BackButton from "@/components/navigation/BackButton";

interface PublicHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  backButtonClassName?: string;
  stickyTopClassName?: string;
  sticky?: boolean;
}

export default function PublicHeader({
  title,
  subtitle,
  backHref = "/home",
  backButtonClassName,
  stickyTopClassName = "top-11",
  sticky = true,
}: PublicHeaderProps) {
  const { t } = useLanguage();
  const headerLinkClass =
    "inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur transition-colors hover:bg-white/20 hover:border-white/60 hover:text-white";

  return (
    <div className={`${sticky ? `sticky ${stickyTopClassName}` : "relative"} z-40 overflow-hidden rounded-2xl border border-[#5a1b1b] bg-gradient-to-br from-[#7c2525] via-[#6b2020] to-[#5a1b1b] text-white`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(220,38,38,0.25),_transparent_55%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.18),_transparent_50%)]" />
      <div className="relative px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <BackButton
              fallbackHref={backHref}
              className={backButtonClassName || "border-white/20 bg-[#5a1b1b] hover:bg-[#4a1515]"}
            />
            <h1 className="text-3xl md:text-4xl font-semibold">{title}</h1>
            {subtitle ? <p className="text-white/70">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/courses" className={headerLinkClass}>
              {t("courses")}
            </Link>
            <Link href="/blog" className={headerLinkClass}>
              {t("blog")}
            </Link>
            <Link href="/store" className={headerLinkClass}>
              {t("store")}
            </Link>
            <Link href="/ads" className={headerLinkClass}>
              {t("ads") || "Ads"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
