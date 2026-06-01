import { useAuth } from "@/hooks/use-auth";
import { Bell, Shield, Download, Smartphone } from "lucide-react";
import LanguageToggle from '@/components/i18n/LanguageToggle';
import GuideButton from '@/components/ui/guide-button';
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/components/PWAInstallPrompt";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import BackButton from "@/components/navigation/BackButton";
import { isPlatformAdminRole } from "@shared/roleAccess";

export const DesktopHeader = () => {
  const { user } = useAuth();
  const { install, isInstallable, isInstalled } = usePWAInstall();
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const firstName = typeof (user as any)?.firstName === "string" ? (user as any).firstName : "";
  const lastName = typeof (user as any)?.lastName === "string" ? (user as any).lastName : "";

  return (
    <header className={cn(
      "hidden lg:flex sticky top-0 z-40 shadow-sm py-3 px-6 justify-between items-center border-b",
      "bg-[hsl(var(--brand-header-bg))] text-[hsl(var(--brand-header-fg))] border-[hsl(var(--border))]",
      "backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--brand-header-bg)/0.9)]",
      isRTL && "flex-row-reverse"
    )}>
      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
        <BackButton fallbackHref="/dashboard" className="h-9 px-4" />
        <GuideButton />
        <LanguageToggle />
      </div>
      <div className={cn("flex items-center", isRTL && "flex-row-reverse")}>
        {isPlatformAdminRole(user?.role) && (
          <Link href="/admin">
            <Button 
              variant="outline" 
              size="sm" 
              className={cn(
                "bg-accent text-accent-foreground hover:bg-accent/90 border-accent",
                isRTL ? "ml-4" : "mr-4"
              )}
            >
              <Shield className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
              Admin
            </Button>
          </Link>
        )}
        
        {/* PWA Install Button - Always Available */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            if (isInstallable && !isInstalled) {
              install();
            } else {
              // Show platform-specific installation instructions with direct links
              const currentUrl = window.location.href;
              const message = `تثبيت تطبيق Naiosh Fit:\n\n🖥️ على الكمبيوتر:\nالرابط: ${currentUrl}\n• Chrome: اضغط على أيقونة التثبيت في شريط العناوين\n• Edge: قائمة ← "تطبيقات" ← "تثبيت هذا الموقع كتطبيق"\n\n📱 على Android:\nالرابط: ${currentUrl}\n• افتح الرابط في Chrome\n• اضغط "إضافة إلى الشاشة الرئيسية"\n\n🍎 على iPhone/iPad:\nالرابط: ${currentUrl}\n• افتح الرابط في Safari\n• اضغط زر "مشاركة" ← "إضافة إلى الشاشة الرئيسية"`;
              
              // Copy link to clipboard and show instructions
              navigator.clipboard?.writeText(currentUrl);
              alert(message + '\n\n✅ تم نسخ الرابط إلى الحافظة');
            }
          }}
          className={cn(
            "bg-primary text-primary-foreground hover:bg-primary/90 border-primary",
            isRTL ? "ml-4" : "mr-4"
          )}
        >
          <Download className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
          تثبيت التطبيق
        </Button>
        
        <button className={cn("text-[hsl(var(--brand-header-fg))] hover:text-primary", isRTL ? "ml-4" : "mr-4")}>
          <Bell className="h-6 w-6" />
        </button>
        <div className={cn(
          "h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold",
          isRTL ? "mr-4" : "ml-4"
        )}>
          {firstName.charAt(0)}{lastName.charAt(0)}
        </div>
      </div>
    </header>
  );
};

export default DesktopHeader;