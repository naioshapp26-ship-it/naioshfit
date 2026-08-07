import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { performSimpleLogout } from "@/lib/simpleLogout";
import { useLanguage } from "@/context/LanguageContext";
import { DEFAULT_LOGO_ASSET, resolveBrandAsset, useBranding } from "@/context/BrandingContext";
import { isPlatformAdminRole, isTenantManagerRole } from "@shared/roleAccess";
import LanguageToggle from '@/components/i18n/LanguageToggle';
import GuideButton from '@/components/ui/guide-button';
import { usePWAInstall } from "@/components/PWAInstallPrompt";
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import {
  HomeIcon,
  UtensilsCrossedIcon,
  DumbbellIcon,
  LineChartIcon,
  StoreIcon,
  MessageSquareIcon,
  XIcon,
  MenuIcon,
  Settings2Icon,
  LogOutIcon,
  User,
  FolderOpenIcon,
  Shield,
  Package,
  ShoppingCart,
  Download,
  Smartphone,
  UserCheck, // Imported UserCheck icon
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

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export const MobileNav = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { settings: branding } = useBranding();
  const { install, isInstallable, isInstalled } = usePWAInstall();
  const isAdmin = isPlatformAdminRole(user?.role);
  const isSuperAdmin = isTenantManagerRole(user?.role);
  const isCoach = user?.role === 'coach';
  const isGym = user?.role === 'gym';
  const isUser = user?.role === 'user';
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
    e.stopPropagation();

    // Use the simple logout function for reliable logout
    performSimpleLogout();
  };

  // Check if user is an admin or coach
  const isAdminCoach =
    isPlatformAdminRole(user?.role) ||
    user?.role === "coach" ||
    user?.username === "admin";

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
        icon: <HomeIcon className="w-6 h-6" />,
      },
    ] : []),
    // Coach page link for coaches - placed right after dashboard
    ...(isCoach && !isAdmin
      ? [
          {
            href: "/coach",
            label: "Coach",
            icon: <UserCheck className="w-6 h-6" />,
          },
        ]
      : []),
    ...(!isAdmin ? [
      {
        href: "/nutrition",
        label: t("nutrition"),
        icon: <UtensilsCrossedIcon className="w-6 h-6" />,
      },
      {
        href: "/workouts",
        label: t("workouts"),
        icon: <DumbbellIcon className="w-6 h-6" />,
      },
      {
        href: "/progress",
        label: t("progress"),
        icon: <LineChartIcon className="w-6 h-6" />,
      },
    ] : []),
    {
      href: "/profile",
      label: t("profile"),
      icon: <User className="w-6 h-6" />,
    },
    ...(!isAdmin ? [
      {
        href: "/store",
        label: t("store"),
        icon: <StoreIcon className="w-6 h-6" />,
      },
      {
        href: "/cart",
        label: t("cart"),
        icon: <ShoppingCart className="w-6 h-6" />,
      },
      {
        href: "/orders",
        label: t("orders"),
        icon: <Package className="w-6 h-6" />,
      },
      {
        href: "/courses",
        label: t("courses"),
        icon: <BookOpen className="w-6 h-6" />,
      },
    ] : []),
    // Manage Courses for coaches - placed right after courses
    ...(isCoach && !isAdmin
      ? [
          {
            href: "/manage-courses",
            label: t("manageCourses"),
            icon: <BookOpen className="w-6 h-6" />,
          },
        ]
      : []),
    ...((isUser || isCoach) && !isAdmin
      ? [
          {
            href: "/supplements",
            label: t("supplements"),
            icon: <Sparkles className="w-6 h-6" />,
          },
          {
            href: "/alerts",
            label: t("alerts"),
            icon: <Bell className="w-6 h-6" />,
          },
          {
            href: "/files-reports",
            label: t("files"),
            icon: <FileText className="w-6 h-6" />,
          },
          {
            href: "/ai-assistant",
            label: t("aiAssistant"),
            icon: <Bot className="w-6 h-6" />,
          },
          {
            href: "/community",
            label: t("community"),
            icon: <UsersIcon className="w-6 h-6" />,
          },
        ]
      : []),
    {
      href: "/blog",
      label: t("blog"),
      icon: <Newspaper className="w-6 h-6" />,
    },
    ...(!isAdmin
      ? [
          {
            href: "/food-search",
            label: t("foodSearch") || "Food Search",
            icon: <Apple className="w-6 h-6" />,
          },
        ]
      : []),
    // Content Library - only for admins and coaches
    ...(isAdmin || isCoach
      ? [
          {
            href: "/content-library",
            label: t("contentLibrary"),
            icon: <FolderOpenIcon className="w-6 h-6" />,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            href: "/taxonomy",
            label: t("taxonomy"),
            icon: <Hash className="w-6 h-6" />,
          },
          {
            href: "/ads-courses",
            label: t("adsCourses"),
            icon: <Megaphone className="w-6 h-6" />,
          },
          {
            href: "/manage-courses",
            label: t("manageCourses"),
            icon: <BookOpen className="w-6 h-6" />,
          },
          {
            href: "/manage-orders",
            label: t("manageOrders"),
            icon: <Package className="w-6 h-6" />,
          },
          ...(isSuperAdmin && !isTenantSubdomain
            ? [
                {
                  href: "/tenant",
                  label: t("tenantOps"),
                  icon: <Layers className="w-6 h-6" />,
                },
              ]
            : []),
          {
            href: "/security",
            label: t("security"),
            icon: <ShieldCheck className="w-6 h-6" />,
          },
        ]
      : []),
    // Gym dashboard link for gym owners only (not admins)
    ...(isGym && !isAdmin
      ? [
          {
            href: "/gym",
            label: t("gymHQ"),
            icon: <Building2 className="w-6 h-6" />,
          },
        ]
      : []),
    // Admin page link - only for admin role
    ...(isAdmin
      ? [
          {
            href: "/admin",
            label: t("admin"),
            icon: <Shield className="w-6 h-6" />,
          },
        ]
      : []),
    {
      href: "/settings",
      label: t("settings"),
      icon: <Settings2Icon className="w-6 h-6" />,
    },
  ];

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Touch handlers for swipe to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;

    const currentTouch = e.touches[0].clientX;
    setCurrentX(currentTouch);

    const diffX = currentTouch - startX;

    // Only start dragging if we're swiping toward the edge of the menu
    const shouldStartDrag = isRTL ? diffX > 30 : diffX < -30;
    if (shouldStartDrag && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startX === null || currentX === null) return;

    const endX = e.changedTouches[0].clientX;
    const diffX = endX - startX;
    const threshold = isRTL ? 100 : -100; // Swipe toward edge threshold

    if ((isRTL ? diffX > threshold : diffX < threshold) && isDragging) {
      setMobileMenuOpen(false);
    }

    setStartX(null);
    setCurrentX(null);
    setIsDragging(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className={cn(
        "lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur shadow-sm py-2 px-3 flex items-center justify-between min-h-[60px] safe-area-padding",
        isRTL && "flex-row-reverse"
      )}>
        <div className={cn("flex items-center", isRTL && "flex-row-reverse")}>
          <button
            onClick={toggleMobileMenu}
            className={cn(
              "text-gray-700 p-2 rounded-lg hover:bg-gray-100 touch-manipulation min-h-[48px] min-w-[48px] flex items-center justify-center",
              isRTL ? "ml-4" : "mr-4"
            )}
          >
            <MenuIcon className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-semibold flex items-center gap-2 min-w-0">
            <img
              src={logoUrl}
              alt="Naiosh Fit Logo"
              className="h-8 w-auto shrink-0"
              onError={(event) => {
                event.currentTarget.src = DEFAULT_LOGO_ASSET;
              }}
            />
            <span className="text-primary font-bold hidden sm:inline truncate">NaioshFit</span>
          </h1>
        </div>
        <div className={cn("flex items-center gap-1", isRTL && "flex-row-reverse")}>
          <div className="hidden sm:block">
            <GuideButton variant="outline" size="sm" />
          </div>
          <LanguageToggle variant="outline" size="sm" />
          <div className={cn(
            "h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-xs",
            isRTL ? "mr-1" : "ml-1"
          )}>
            {user?.firstName?.[0]}
            {user?.lastName?.[0]}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 bg-gray-800 bg-opacity-50 z-50 transition-opacity duration-300 ease-in-out",
          mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setMobileMenuOpen(false);
          }
        }}
      >
        <div
          className={cn(
            "bg-white w-80 max-w-[85vw] h-full overflow-y-auto transition-transform duration-300 ease-in-out transform touch-pan-y scrollbar-hide safe-area-padding relative overflow-hidden absolute top-0",
            isRTL 
              ? (mobileMenuOpen ? "translate-x-0 right-0" : "translate-x-full right-0")
              : (mobileMenuOpen ? "translate-x-0 left-0" : "-translate-x-full left-0")
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform:
              isDragging && currentX && startX
                ? isRTL 
                  ? `translateX(${Math.max(0, currentX - startX)}px)`
                  : `translateX(${Math.min(0, currentX - startX)}px)`
                : undefined,
          }}
        >
          <AnimatedBackground position="absolute" className="opacity-30" />
          <div className="p-4 border-b flex items-center justify-between relative z-10">
            <h2 className="text-xl font-semibold flex items-center">
              <img
                src={logoUrl}
                alt="Naiosh Fit Logo"
                className="h-10 w-auto"
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_LOGO_ASSET;
                }}
              />
            </h2>
            <button onClick={toggleMobileMenu} className="text-gray-700">
              <XIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="py-4">
            {/* Logout Button - First Item */}
            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-4 px-6 py-5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 mx-3 touch-manipulation text-base font-medium min-h-[56px] active:scale-95 w-full",
                isRTL ? "flex-row-reverse text-right" : "text-left"
              )}
            >
              <span className="w-7 text-center text-xl flex items-center justify-center">
                <LogOutIcon className="h-6 w-6" />
              </span>
              <span className={cn("flex-1", isRTL ? "text-right" : "text-left")}>{t("logout")}</span>
            </button>

            {navItems
              .filter((item) => item.href !== "/ai-assistant") // Remove AI Assistant from menu
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-4 px-6 py-5 text-gray-700 hover:text-primary hover:bg-accent rounded-xl transition-all duration-200 mx-3 touch-manipulation text-base font-medium min-h-[56px] active:scale-95",
                    isRTL ? "flex-row-reverse text-right" : "text-left",
                    location === item.href && (
                      isRTL 
                        ? "text-primary bg-accent border-r-4 border-primary"
                        : "text-primary bg-accent border-l-4 border-primary"
                    ),
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="w-7 text-center text-xl flex items-center justify-center">
                    {item.icon}
                  </span>
                  <span className={cn("flex-1", isRTL ? "text-right" : "text-left")}>{item.label}</span>
                </Link>
              ))}

            {!isTenantSubdomain && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  // Open the technical issue widget
                  const widget = document.querySelector('[data-technical-issue-trigger]') as HTMLButtonElement;
                  if (widget) widget.click();
                }}
                className={cn(
                  "flex items-center gap-4 px-6 py-5 text-gray-700 hover:text-primary hover:bg-accent rounded-xl transition-all duration-200 mx-3 touch-manipulation text-base font-medium min-h-[56px] active:scale-95 w-full",
                  isRTL ? "flex-row-reverse text-right" : "text-left"
                )}
              >
                <span className="w-7 text-center text-xl flex items-center justify-center">
                  <Bug className="h-6 w-6" />
                </span>
                <span className={cn("flex-1", isRTL ? "text-right" : "text-left")}>{t("reportTechnicalIssue")}</span>
              </button>
            )}

            {/* PWA Install Button - Always Available */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (isInstallable && !isInstalled) {
                  install();
                } else {
                  // Show platform-specific installation instructions with direct links
                  const currentUrl = window.location.href;
                  const message = `تثبيت تطبيق Naiosh Fit:\n\n🖥️ على الكمبيوتر:\nالرابط: ${currentUrl}\n• Chrome: اضغط على أيقونة التثبيت في شريط العناوين\n• Edge: قائمة ← "تطبيقات" ← "تثبيت هذا الموقع كتطبيق"\n\n📱 على Android:\nالرابط: ${currentUrl}\n• افتح الرابط في Chrome\n• اضغط "إضافة إلى الشاشة الرئيسية"\n\n🍎 على iPhone/iPad:\nالرابط: ${currentUrl}\n• افتح الرابط في Safari\n• اضغط زر "مشاركة" ← "إضافة إلى الشاشة الرئيسية"`;

                  // Copy link to clipboard and show instructions
                  navigator.clipboard?.writeText(currentUrl);
                  alert(message + "\n\n✅ تم نسخ الرابط إلى الحافظة");
                }
              }}
              className="flex items-center gap-4 px-6 py-5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-xl transition-all duration-200 mx-3 touch-manipulation text-base font-medium min-h-[56px] active:scale-95"
            >
              <span className="w-7 text-center text-xl flex items-center justify-center">
                <Download className="h-6 w-6" />
              </span>
              <span className="flex-1">تثبيت التطبيق</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {!isAdmin ? (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-3 flex justify-around safe-area-inset-bottom shadow-lg">
          <Link
            href="/dashboard"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/dashboard" || location === "/"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <HomeIcon className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("home")}</span>
          </Link>
          <Link
            href="/nutrition"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/nutrition"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <UtensilsCrossedIcon className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("nutrition")}</span>
          </Link>
          <Link
            href="/workouts"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/workouts"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <DumbbellIcon className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("workouts")}</span>
          </Link>
          <Link
            href="/progress"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/progress"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <LineChartIcon className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("progress")}</span>
          </Link>
          <Link
            href="/store"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/store"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <StoreIcon className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("store")}</span>
          </Link>
        </nav>
      ) : (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-3 flex justify-around safe-area-inset-bottom shadow-lg">
          <Link
            href="/admin"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/admin"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <Shield className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("admin")}</span>
          </Link>
          <Link
            href="/profile"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/profile"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <User className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("profile")}</span>
          </Link>
          <Link
            href="/settings"
            className={cn(
              "flex flex-col items-center p-3 rounded-xl touch-manipulation transition-all duration-200 min-w-[60px] min-h-[60px] active:scale-95",
              location === "/settings"
                ? "text-primary bg-primary/10 scale-110 shadow-sm"
                : "text-gray-500 hover:text-primary hover:bg-gray-100 hover:scale-105",
            )}
          >
            <Settings2Icon className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{t("settings")}</span>
          </Link>
        </nav>
      )}
    </>
  );
};

export default MobileNav;
