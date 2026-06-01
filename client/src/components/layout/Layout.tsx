import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import DesktopHeader from './DesktopHeader';
import TranslationBanner from '@/components/i18n/TranslationBanner';
import Footer from './Footer';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import { TechnicalIssueWidget } from '@/components/ui/technical-issue-widget';
import { AiAssistantFloatingButton } from '@/components/ui/ai-assistant-floating-button';
import { useLocation } from "wouter";
import { useAuth } from '@/hooks/use-auth';
import { isGuestUser } from '@/lib/guest-utils';
import { GuestModeBanner } from '@/components/guest/GuestModeBanner';
import BackButton from '@/components/navigation/BackButton';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [location] = useLocation();
  const isSaasSignup = location.startsWith("/saas");
  const isRTL = language === "ar";
  const isGuest = isGuestUser(user);

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      data-layout-shell="true"
      className={cn(
        "layout-shell min-h-screen flex flex-col",
        "lg:flex-row",
        "bg-gradient-to-b from-slate-200 via-gray-100 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800",
        isRTL ? "text-right" : "text-left"
      )}
    >
      {!isSaasSignup && <MobileNav key={`mobile-nav-${language}`} />}
      {!isSaasSignup && (
        <div className="layout-sidebar lg:order-1">
          <Sidebar />
        </div>
      )}
      <div
        className={cn(
          "layout-content flex-1 flex flex-col lg:order-2",
          "bg-transparent",
          isRTL ? "text-right" : "text-left"
        )}
      >
        {isGuest && <GuestModeBanner />}
        {/* Translation Warning Banner (appears only if not dismissed) */}
        {!isSaasSignup && <TranslationBanner />}
        {!isSaasSignup && <DesktopHeader />}
        <main className="flex-1 overflow-x-hidden pb-16 lg:pb-0">
          {!isSaasSignup && (
            <div className="px-4 pt-4 lg:hidden">
              <BackButton fallbackHref="/dashboard" className="h-9 px-4" />
            </div>
          )}
          {children}
        </main>
        {!isSaasSignup && <Footer />}
      </div>
      {/* Floating buttons */}
      {!isSaasSignup && <TechnicalIssueWidget />}
      {!isSaasSignup && <AiAssistantFloatingButton />}
    </div>
  );
};

export default Layout;
