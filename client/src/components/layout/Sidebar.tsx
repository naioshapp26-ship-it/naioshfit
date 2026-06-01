import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { performSimpleLogout } from "@/lib/simpleLogout";
import { useLanguage } from "@/context/LanguageContext";
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from "@/context/BrandingContext";
import { isGuestUser } from "@/lib/guest-utils";
import { isPlatformAdminRole, isTenantManagerRole } from "@shared/roleAccess";
import {
  HomeIcon,
  UtensilsCrossedIcon,
  DumbbellIcon,
  LineChartIcon,
  StoreIcon,
  Settings2Icon,
  LogOutIcon,
  User,
  FolderOpenIcon,
  Shield,
  Package,
  CreditCard,
  Building2,
  Sparkles,
  Bell,
  FileText,
  Bot,
  Users as UsersIcon,
  BookOpen,
  Wallet,
  Hash,
  Megaphone,
  Layers,
  ShieldCheck,
  Bug,
  Newspaper,
  Apple,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar = () => {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { settings: branding } = useBranding();
  const isGuest = isGuestUser(user);
  const isAdmin = isPlatformAdminRole(user?.role);
  const isSuperAdmin = isTenantManagerRole(user?.role);
  const isCoach = user?.role === 'coach';
  const isGym = user?.role === 'gym';
  const isUser = user?.role === 'user';
  const firstName = typeof (user as any)?.firstName === 'string' ? (user as any).firstName : '';
  const lastName = typeof (user as any)?.lastName === 'string' ? (user as any).lastName : '';
  const isRTL = language === 'ar';
  const isTenantSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length > 2 && parts[0] !== "www") {
      return true;
    }
    return false;
  }, []);
  const logoUrl = resolveBrandAsset(branding.logoUrl, DEFAULT_LOGO_ASSET);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();

    // Use the simple logout function for reliable logout
    performSimpleLogout();
  };

  // Define tabs to hide for admin users
  const adminHiddenTabs = [
    "/dashboard",
    "/nutrition",
    "/workouts",
    "/progress",
    "/store",
    "/orders",
    "/supplements",
    "/alerts",
    "/payments",
    "/courses",
    "/coach",
    "/gym"
  ];

  const navItems: NavItem[] = [
    ...(!isAdmin ? [
      {
        href: "/dashboard",
        label: t("dashboard"),
        icon: <HomeIcon className="w-5 h-5" />,
      },
    ] : []),
    // Coach page link for coaches - placed right after dashboard
    ...(isCoach && !isAdmin
      ? [
          {
            href: "/coach",
            label: "Coach",
            icon: <User className="w-5 h-5" />,
          },
        ]
      : []),
    ...(!isAdmin ? [
      {
        href: "/nutrition",
        label: t("nutrition"),
        icon: <UtensilsCrossedIcon className="w-5 h-5" />,
      },
      {
        href: "/workouts",
        label: t("workouts"),
        icon: <DumbbellIcon className="w-5 h-5" />,
      },
      {
        href: "/progress",
        label: t("progress"),
        icon: <LineChartIcon className="w-5 h-5" />,
      },
    ] : []),
    {
      href: "/profile",
      label: t("profile"),
      icon: <User className="w-5 h-5" />,
    },
    ...(!isAdmin ? [
      {
        href: "/store",
        label: t("store"),
        icon: <StoreIcon className="w-5 h-5" />,
      },
      ...(!isGuest ? [
        {
          href: "/orders",
          label: t("orders"),
          icon: <Package className="w-5 h-5" />,
        },
      ] : []),
      {
        href: "/courses",
        label: t("courses"),
        icon: <BookOpen className="w-5 h-5" />,
      },
    ] : []),
    // Manage Courses for coaches - placed right after courses
    ...(isCoach && !isAdmin
      ? [
          {
            href: "/manage-courses",
            label: t("manageCourses"),
            icon: <BookOpen className="w-5 h-5" />,
          },
        ]
      : []),
    ...((isUser || isCoach) && !isAdmin
      ? [
          {
            href: "/supplements",
            label: t("supplements"),
            icon: <Sparkles className="w-5 h-5" />,
          },
          {
            href: "/alerts",
            label: t("alerts"),
            icon: <Bell className="w-5 h-5" />,
          },
          {
            href: "/files-reports",
            label: t("files"),
            icon: <FileText className="w-5 h-5" />,
          },
          {
            href: "/ai-assistant",
            label: t("aiAssistant"),
            icon: <Bot className="w-5 h-5" />,
          },
          {
            href: "/community",
            label: t("community"),
            icon: <UsersIcon className="w-5 h-5" />,
          },
        ]
      : []),
    {
      href: "/blog",
      label: t("blog"),
      icon: <Newspaper className="w-5 h-5" />,
    },
    ...(!isAdmin
      ? [
          {
            href: "/food-search",
            label: t("foodSearch") || "Food Search",
            icon: <Apple className="w-5 h-5" />,
          },
        ]
      : []),
    ...(!isAdmin && !isGuest ? [
      {
        href: "/settings?tab=billing",
        label: t("billing"),
        icon: <CreditCard className="w-5 h-5" />,
      },
    ] : []),
    // Content Library - only for admins and coaches
    ...(isAdmin || isCoach
      ? [
          {
            href: "/content-library",
            label: t("contentLibrary"),
            icon: <FolderOpenIcon className="w-5 h-5" />,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/taxonomy",
            label: t("taxonomy"),
            icon: <Hash className="w-5 h-5" />,
          },
          {
            href: "/ads-courses",
            label: t("adsCourses"),
            icon: <Megaphone className="w-5 h-5" />,
          },
          {
            href: "/manage-courses",
            label: t("manageCourses"),
            icon: <BookOpen className="w-5 h-5" />,
          },
          {
            href: "/manage-orders",
            label: t("manageOrders"),
            icon: <Package className="w-5 h-5" />,
          },
          ...(isSuperAdmin && !isTenantSubdomain
            ? [
                {
                  href: "/tenant",
                  label: t("tenantOps"),
                  icon: <Layers className="w-5 h-5" />,
                },
              ]
            : []),
          {
            href: "/security",
            label: t("security"),
            icon: <ShieldCheck className="w-5 h-5" />,
          },
        ]
      : []),
    // Gym HQ link for gym owners only (not admins)
    ...(isGym && !isAdmin
      ? [
          {
            href: "/gym",
            label: t("gymHQ"),
            icon: <Building2 className="w-5 h-5" />,
          },
        ]
      : []),
    // Admin page link - only for admin role
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: t("admin"),
            icon: <Shield className="w-5 h-5" />,
          },
        ]
      : []),
  ];

  return (
    <aside className={cn(
      "hidden lg:flex lg:flex-col w-64 relative overflow-hidden shadow-lg",
      "bg-gradient-to-b from-[hsl(var(--brand-sidebar-bg))] via-[hsl(var(--brand-sidebar-bg-2))] to-[hsl(var(--brand-sidebar-bg-3))]",
      "text-[hsl(var(--brand-sidebar-fg))]",
      "sticky top-0 h-screen",
      isRTL ? "text-right" : "text-left"
    )}>
      <div className="p-5 border-b border-[hsl(var(--brand-sidebar-border))] relative z-10">
        <h1 className="text-xl font-semibold">
          <Link
            href="/home#top"
            className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}
          >
            <img
              src={logoUrl}
              alt="Naiosh Fit Logo"
              className="h-10 w-auto"
              onError={(event) => {
                event.currentTarget.src = DEFAULT_LOGO_ASSET;
              }}
            />
            <span className="text-[hsl(var(--brand-sidebar-fg))] font-bold">NaioshFit</span>
          </Link>
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Logout Button - First Item */}
        <Button
          variant="ghost"
          onClick={handleLogout}
          data-sidebar-link="true"
          className={cn(
            "w-full px-6 py-3 text-[hsl(var(--brand-sidebar-fg))] hover:bg-[hsl(var(--brand-sidebar-hover))] border-transparent flex items-center gap-3",
            "justify-start transition-all duration-200",
            isRTL ? "border-r-4 hover:border-r-4" : "border-l-4 hover:border-l-4"
          )}
        >
          <LogOutIcon className="h-5 w-5" />
          <span className="font-medium">{t("logout")}</span>
        </Button>

        {navItems
          .filter((item) => item.href !== "/ai-assistant") // Remove AI Assistant from menu
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-sidebar-link="true"
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-[hsl(var(--brand-sidebar-fg))] hover:bg-[hsl(var(--brand-sidebar-hover))] border-transparent transition-all duration-200 opacity-90",
                isRTL ? "justify-start text-right" : "justify-start text-left",
                isRTL ? "border-r-4" : "border-l-4",
                location === item.href &&
                  `text-[hsl(var(--brand-sidebar-fg))] bg-[hsl(var(--brand-sidebar-hover))] ${isRTL ? "border-r-4" : "border-l-4"} border-[hsl(var(--brand-sidebar-border))] font-semibold opacity-100`,
              )}
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}

        {!isTenantSubdomain && (
          <button
            onClick={() => {
              // Open the technical issue widget
              const widget = document.querySelector('[data-technical-issue-trigger]') as HTMLButtonElement;
              if (widget) widget.click();
            }}
            data-sidebar-link="true"
            className={cn(
              "w-full flex items-center gap-3 px-6 py-3 text-[hsl(var(--brand-sidebar-fg))] hover:bg-[hsl(var(--brand-sidebar-hover))] border-transparent transition-all duration-200 opacity-90",
              isRTL ? "justify-start text-right" : "justify-start text-left",
              isRTL ? "border-r-4" : "border-l-4"
            )}
          >
            <Bug className="h-5 w-5" />
            <span className="font-medium">{t("reportTechnicalIssue")}</span>
          </button>
        )}

      </nav>
      <div className="p-4 border-t border-[hsl(var(--brand-sidebar-border))] bg-[hsl(var(--brand-sidebar-hover))]">
        {/* User info */}
        <div className={cn("flex items-center", isRTL && "flex-row-reverse text-right")}>
          <div className={cn("h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-[hsl(var(--brand-sidebar-fg))] font-semibold", isRTL ? "ml-3" : "mr-3")}>
            {firstName.charAt(0)}
            {lastName.charAt(0)}
          </div>
          <div>
            <h3 className="font-medium text-[hsl(var(--brand-sidebar-fg))]">
              {firstName} {lastName}
            </h3>
            <p className="text-sm text-[hsl(var(--brand-sidebar-fg))] opacity-70">
              {user?.role === 'coach'
                ? 'Coach'
                : user?.role === 'gym'
                  ? 'Gym Owner'
                  : isAdmin
                    ? 'Admin'
                    : isGuest
                      ? 'Guest Preview'
                      : 'Premium Member'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
