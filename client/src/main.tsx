import { createRoot } from "react-dom/client";
import React from "react";
import "./index.css";

import { PWAInstallProvider } from "@/components/PWAInstallPrompt";

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  const base = import.meta.env.BASE_URL || '/';
  const isRootDeploy = base === '/' || base === '';
  const swUrl = `${base.endsWith('/') ? base : `${base}/`}sw.js`.replace(/\/{2,}/g, '/');

  window.addEventListener('load', async () => {
    try {
      if (!isRootDeploy) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('SW unregistered for non-root deploy:', registration.scope);
        }
        return;
      }

      const registration = await navigator.serviceWorker.register(swUrl, { scope: base || '/' });
      console.log('SW registered:', registration.scope);
    } catch (error) {
      console.warn('SW registration failed:', error);
    }
  });
}

registerServiceWorker();
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { BrandingProvider } from "./context/BrandingContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "@/hooks/use-auth";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout/Layout";
import Footer from "@/components/layout/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SeoManager } from "@/components/seo/SeoManager";
import { checkForAppUpdate } from "@/lib/version";
import { GuestUpgradeModal } from "@/components/guest/GuestUpgradeModal";
import { isGuestUser, shouldBlockGuestRequest, triggerGuestUpgradePrompt } from "@/lib/guest-utils";
import { isPlatformAdminRole } from "@shared/roleAccess";
import PublicAnnouncementBar from "@/components/announcements/PublicAnnouncementBar";
import PublicTopNav from "@/components/layout/PublicTopNav";
import PublicFloatingActions from "@/components/layout/PublicFloatingActions";
import { AiAssistantFloatingButton } from "@/components/ui/ai-assistant-floating-button";

const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
  </div>
);

const createLazyRoute = (
  importer: () => Promise<{ default: React.ComponentType<any> }>
) => {
  const LazyComponent = React.lazy(importer);
  return (props: any) => (
    <React.Suspense fallback={<RouteLoader />}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
};

const Home = createLazyRoute(() => import("@/pages/home"));
const Dashboard = createLazyRoute(() => import("@/pages/dashboard"));
const Nutrition = createLazyRoute(() => import("@/pages/nutrition"));
const Workouts = createLazyRoute(() => import("@/pages/workouts"));
const Progress = createLazyRoute(() => import("@/pages/progress"));
const Store = createLazyRoute(() => import("@/pages/store"));
const ProductDetailPage = createLazyRoute(() => import("@/pages/ProductDetail"));
const CartPage = createLazyRoute(() => import("@/pages/cart"));
const Orders = createLazyRoute(() => import("@/pages/orders"));
const Settings = createLazyRoute(() => import("@/pages/settings"));
const Profile = createLazyRoute(() => import("@/pages/profile"));
const Auth = createLazyRoute(() => import("@/pages/auth"));
const SignUpPage = createLazyRoute(() => import("@/pages/signup"));
const ResetPasswordPage = createLazyRoute(() => import("@/pages/reset"));
const NotFound = createLazyRoute(() => import("@/pages/not-found"));
const PrivacyPolicy = createLazyRoute(() => import("@/pages/privacy-policy"));
const TermsOfService = createLazyRoute(() => import("@/pages/tos"));
const BlogPage = createLazyRoute(() => import("@/pages/blog"));
const ContentLibrary = createLazyRoute(() => import("@/pages/ContentLibrary"));
const AdminDashboard = createLazyRoute(() => import("@/pages/admin"));
const CoachPage = createLazyRoute(() => import("@/pages/coach"));
const GymDashboard = createLazyRoute(() => import("@/pages/gym"));
const Survey = createLazyRoute(() => import("@/pages/survey"));
const EpicsPage = createLazyRoute(() => import("@/pages/epics"));
const SupplementsFeaturePage = createLazyRoute(() => import("@/pages/features/Supplements"));
const AlertsFeaturePage = createLazyRoute(() => import("@/pages/features/Alerts"));
const FilesReportsFeaturePage = createLazyRoute(() => import("@/pages/features/FilesReports"));
const AiAssistantFeaturePage = createLazyRoute(() => import("@/pages/features/AiAssistant"));
const CommunityFeaturePage = createLazyRoute(() => import("@/pages/features/Community"));
const ContentHubFeaturePage = createLazyRoute(() => import("@/pages/features/ContentHub"));
const PaymentsFeaturePage = createLazyRoute(() => import("@/pages/features/Payments"));
const PaymentsSuccessPage = createLazyRoute(() => import("@/pages/payments-success"));
const PaymentsCancelPage = createLazyRoute(() => import("@/pages/payments-cancel"));
const TaxonomyFeaturePage = createLazyRoute(() => import("@/pages/features/Taxonomy"));
const AdsCoursesFeaturePage = createLazyRoute(() => import("@/pages/features/AdsCourses"));
const FoodSearchPage = createLazyRoute(() => import("@/pages/features/FoodSearch"));
const CoursesPage = createLazyRoute(() => import("@/pages/Courses"));
const CourseDetailPage = createLazyRoute(() => import("@/pages/CourseDetail"));
const LessonViewPage = createLazyRoute(() => import("@/pages/LessonView"));
const ManageCoursesPage = createLazyRoute(() => import("@/pages/ManageCourses"));
const ManageOrdersPage = createLazyRoute(() => import("@/pages/ManageOrders"));
const ManageLessonsPage = createLazyRoute(() => import("@/pages/ManageLessons"));
const CertificateViewPage = createLazyRoute(() => import("@/pages/CertificateView"));
const AdsPage = createLazyRoute(() => import("@/pages/ads"));
const AdDetailPage = createLazyRoute(() => import("@/pages/AdDetail"));
const TenantOpsFeaturePage = createLazyRoute(() => import("@/pages/features/TenantOps"));
const SecurityOpsFeaturePage = createLazyRoute(() => import("@/pages/features/SecurityOps"));
const SaasSignupPage = createLazyRoute(() => import("@/pages/saas/TenantOnboardingWizard"));
const TenantDashboardPage = createLazyRoute(() => import("@/pages/tenant-dashboard"));
const SuperAdminDashboardPage = createLazyRoute(() => import("@/pages/super-admin/Dashboard"));

const normalizePathname = (pathname: string) =>
  pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;

// App component defined here to avoid circular dependencies
const App = () => {
  // Run a quick version check on boot and then periodically
  React.useEffect(() => {
    let timer: number | undefined;
    checkForAppUpdate();
    timer = window.setInterval(() => {
      checkForAppUpdate();
    }, 5 * 60 * 1000); // every 5 minutes
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, []);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <PWAInstallProvider>
                  <TooltipProvider>
                    <Toaster />
                    <GuestUpgradeModal />
                    <SeoManager />
                    <AppRoutes />
                  </TooltipProvider>
                </PWAInstallProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </BrandingProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

// Routes component defined separately
const AppRoutes = () => {
  // Use the useAuth hook instead of directly using the context
  const { user, loading } = useAuth();
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [location] = useLocation();
  const [hasStoredUser, setHasStoredUser] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const isGuest = isGuestUser(user);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const stored = localStorage.getItem("guestUser");
        const guestActive = !!stored;
        if (guestActive && shouldBlockGuestRequest(input, init)) {
          triggerGuestUpgradePrompt();
          throw new Error("Guest users cannot perform this action");
        }
      } catch (error) {
        throw error;
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);
  
  // Ensure we're running on the client side
  React.useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setHasStoredUser(!!localStorage.getItem('currentUser'));
    }
  }, []);
  
  React.useEffect(() => {
    // Mark as initialized after the first render
    if (!isInitialized && !loading) {
      setIsInitialized(true);
    }
  }, [loading, isInitialized]);
  
  // Handle client-side routing and authentication redirects
  React.useEffect(() => {
    if (!isClient) return;
    
    if (!user) {
      const storedUser = localStorage.getItem('currentUser');
      const storedGuest = localStorage.getItem('guestUser');
      const pathname = normalizePathname(window.location.pathname);
      if (storedUser && pathname !== '/auth') {
        // User exists in localStorage, we can proceed with rendering the app
        console.log('Retrieved user from localStorage, staying on current page');
        setHasStoredUser(true);
      } else if (!storedUser
        && !storedGuest
        && pathname !== '/'
        && pathname !== '/home'
        && !pathname.startsWith('/ads')
        && !pathname.startsWith('/courses')
        && pathname !== '/store'
        && !pathname.startsWith('/product')
        && pathname !== '/auth' 
        && pathname !== '/login'
        && pathname !== '/signup'
        && pathname !== '/saas'
        && pathname !== '/reset'
        && pathname !== '/privacy-policy'
        && pathname !== '/tos'
        && pathname !== '/terms-of-service'
        && pathname !== '/blog') {
        // No user in context or localStorage, redirect to auth
        window.location.href = '/auth';
      }
    } else if (user && !isGuest && normalizePathname(window.location.pathname) === '/auth') {
      // User is logged in but on auth page, redirect based on role
      if (isPlatformAdminRole(user.role)) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    }
  }, [user, isClient, isGuest]);

  // Show loading during initialization or if not on client
  if (loading || !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  const currentPath = location || (typeof window !== "undefined" ? window.location.pathname : "/");
  const normalizedPath = normalizePathname(currentPath);
  const isHomePage = normalizedPath === '/';
  const isHeroPage = normalizedPath === '/home';
  const isAuthPage = normalizedPath === '/auth';
  const isLoginPage = normalizedPath === '/login';
  const isSignupPage = normalizedPath === '/signup';
  const isSaasSignupPage = normalizedPath === '/saas';
  const isResetPage = normalizedPath === '/reset';
  const isPrivacyPage = currentPath === '/privacy-policy';
  const isTosPage = currentPath === '/tos' || currentPath === '/terms-of-service';
  const isBlogPage = currentPath === '/blog';
  const isCoursesPage = currentPath === '/courses' || currentPath.startsWith('/courses/');
  const isStorePage = currentPath === '/store' || currentPath.startsWith('/product/');
  const isAdsPage = currentPath === '/ads' || currentPath.startsWith('/ads/');
  const showPublicFloatingActions =
    isHomePage ||
    isHeroPage ||
    isAuthPage ||
    isLoginPage ||
    isSignupPage ||
    isSaasSignupPage ||
    isResetPage ||
    isPrivacyPage ||
    isTosPage ||
    isBlogPage ||
    isCoursesPage ||
    isStorePage ||
    isAdsPage;
  const showPublicAnnouncementBar = isHeroPage || isBlogPage || isCoursesPage || isStorePage || isAdsPage || (!user && isHomePage);
  const showPublicTopNav =
    showPublicAnnouncementBar ||
    isAuthPage ||
    isLoginPage ||
    isSignupPage ||
    isSaasSignupPage ||
    isPrivacyPage ||
    isTosPage;

  // Keep reset password outside the authenticated app shell to avoid layout overlays
  // and ensure the email deep-link always lands on a clean, editable form.
  // SaaS tenant signup is always public — never redirect to login or wrap in app shell
  if (isSaasSignupPage) {
    return (
      <>
        <Switch>
          <Route path="/saas">
            {() => <SaasSignupPage />}
          </Route>
          <Route path="/saas/">
            {() => <SaasSignupPage />}
          </Route>
          <Route>
            {() => <SaasSignupPage />}
          </Route>
        </Switch>
      </>
    );
  }

  if (isResetPage) {
    return (
      <>
        <Switch>
          <Route path="/reset">
            {() => <ResetPasswordPage />}
          </Route>
          <Route path="/reset/">
            {() => <ResetPasswordPage />}
          </Route>
          <Route>
            {() => <ResetPasswordPage />}
          </Route>
        </Switch>
        {!isSaasSignupPage && <AiAssistantFloatingButton />}
        {showPublicFloatingActions && <PublicFloatingActions />}
      </>
    );
  }

  if (isGuest && (isAuthPage || isSignupPage)) {
    return (
      <>
        <Switch>
          <Route path="/auth">
            {() => <Auth />}
          </Route>
          <Route path="/signup">
            {() => <SignUpPage />}
          </Route>
          <Route>
            {() => <Home />}
          </Route>
        </Switch>
        {!isSaasSignupPage && <AiAssistantFloatingButton />}
        {showPublicFloatingActions && <PublicFloatingActions />}
      </>
    );
  }
  
  // If no user and not on auth page, show loading until the redirect happens
  if (!user && !isHomePage && !isHeroPage && !isAuthPage && !isLoginPage && !isSignupPage && !isSaasSignupPage && !isResetPage && !isPrivacyPage && !isTosPage && !isBlogPage && !isCoursesPage && !isStorePage && !isAdsPage && !hasStoredUser) {
    return <div>Loading...</div>;
  }
  
  // Show login/signup for non-authenticated users who are on the auth page
  // or when there's definitely no stored user
  if (!user && (isHomePage || isHeroPage || isAuthPage || isLoginPage || isSignupPage || isSaasSignupPage || isResetPage || isPrivacyPage || isTosPage || isBlogPage || isCoursesPage || isStorePage || isAdsPage || !hasStoredUser)) {
    return (
      <>
        {showPublicAnnouncementBar && <PublicAnnouncementBar />}
        {showPublicTopNav && <PublicTopNav includeSpacer={!isHeroPage} hasAnnouncementBar={showPublicAnnouncementBar} />}
        <Switch>
          <Route path="/">
            {() => <Home />}
          </Route>
          <Route path="/home">
            {() => <Home />}
          </Route>
          <Route path="/ads">
            {() => <AdsPage />}
          </Route>
          <Route path="/ads/:id">
            {() => <AdDetailPage />}
          </Route>
          <Route path="/auth">
            {() => <Auth />}
          </Route>
          <Route path="/login">
            {() => <Auth />}
          </Route>
          <Route path="/signup">
            {() => <SignUpPage />}
          </Route>
          <Route path="/reset">
            {() => <ResetPasswordPage />}
          </Route>
          <Route path="/privacy-policy">
            {() => <PrivacyPolicy />}
          </Route>
          <Route path="/blog">
            {() => <BlogPage />}
          </Route>
          <Route path="/store">
            {() => <Store />}
          </Route>
          <Route path="/product/:id">
            {() => <ProductDetailPage />}
          </Route>
          <Route path="/courses/:id">
            {() => <CourseDetailPage />}
          </Route>
          <Route path="/courses">
            {() => <CoursesPage />}
          </Route>
          <Route path="/tos">
            {() => <TermsOfService />}
          </Route>
          <Route path="/terms-of-service">
            {() => <TermsOfService />}
          </Route>
          <Route>
            {() => <Home />}
          </Route>
        </Switch>
        <Footer />
        {!isSaasSignupPage && <AiAssistantFloatingButton />}
        {showPublicFloatingActions && <PublicFloatingActions />}
      </>
    );
  }
  
  // Show app for authenticated users
  // Guarded route component for Content Library
  const ContentLibraryRoute = () => {
    const { user } = useAuth();
    if (isGuestUser(user)) {
      return <NotFound />;
    }
    const isAllowed = user?.role === 'coach' || isPlatformAdminRole(user?.role) || user?.username === 'admin';
    return isAllowed ? <ContentLibrary /> : <NotFound />;
  };

  // Guarded route component for Coach page
  const CoachRoute = () => {
    const { user } = useAuth();
    if (isGuestUser(user) && user.guestPreviewRole !== 'coach') {
      return <NotFound />;
    }
    const isAllowed = user?.role === 'coach' || isPlatformAdminRole(user?.role);
    return isAllowed ? <CoachPage /> : <NotFound />;
  };

  const GymRoute = () => {
    const { user } = useAuth();
    if (isGuestUser(user)) {
      return <NotFound />;
    }
    const isAllowed = user?.role === 'gym' || isPlatformAdminRole(user?.role);
    return isAllowed ? <GymDashboard /> : <NotFound />;
  };

  const GuestBlockedRoute = () => {
    React.useEffect(() => {
      triggerGuestUpgradePrompt();
    }, []);
    if (isGuest) {
      return <Dashboard />;
    }
    return <NotFound />;
  };

  if (isHeroPage) {
    return (
      <>
        {showPublicAnnouncementBar && <PublicAnnouncementBar />}
        {showPublicTopNav && <PublicTopNav includeSpacer={false} hasAnnouncementBar={showPublicAnnouncementBar} />}
        <Home />
        <Footer />
        {!isSaasSignupPage && <AiAssistantFloatingButton />}
        {showPublicFloatingActions && <PublicFloatingActions />}
      </>
    );
  }

  return (
    <>
      {showPublicAnnouncementBar && <PublicAnnouncementBar />}
      {showPublicTopNav && <PublicTopNav includeSpacer={true} hasAnnouncementBar={showPublicAnnouncementBar} />}
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/tenant-dashboard" component={TenantDashboardPage} />
          <Route path="/super-admin" component={SuperAdminDashboardPage} />
          <Route path="/nutrition" component={Nutrition} />
          <Route path="/workouts" component={Workouts} />
          <Route path="/progress" component={Progress} />
          <Route path="/store" component={Store} />
          <Route path="/product/:id" component={ProductDetailPage} />
          <Route path="/ads/:id" component={AdDetailPage} />
          <Route path="/ads" component={AdsPage} />
          <Route path="/cart" component={isGuest ? GuestBlockedRoute : CartPage} />
          <Route path="/orders" component={isGuest ? GuestBlockedRoute : Orders} />
          <Route path="/settings" component={isGuest ? GuestBlockedRoute : Settings} />
          <Route path="/profile" component={Profile} />
          <Route path="/reset" component={ResetPasswordPage} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />
            <Route path="/tos" component={TermsOfService} />
            <Route path="/terms-of-service" component={TermsOfService} />
          <Route path="/blog" component={BlogPage} />
          <Route path="/content-library" component={ContentLibraryRoute} />
          <Route path="/coach" component={CoachRoute} />
          <Route path="/gym" component={isGuest ? GuestBlockedRoute : GymRoute} />
          <Route path="/admin" component={isGuest ? GuestBlockedRoute : AdminDashboard} />
          <Route path="/survey" component={Survey} />
          <Route path="/epics" component={EpicsPage} />
          <Route path="/supplements" component={SupplementsFeaturePage} />
          <Route path="/alerts" component={AlertsFeaturePage} />
          <Route path="/files-reports" component={FilesReportsFeaturePage} />
          <Route path="/ai-assistant" component={AiAssistantFeaturePage} />
          <Route path="/community" component={CommunityFeaturePage} />
          <Route path="/content-hub" component={ContentHubFeaturePage} />
          <Route path="/payments/success" component={PaymentsSuccessPage} />
          <Route path="/payments/cancel" component={PaymentsCancelPage} />
          <Route path="/payments" component={PaymentsFeaturePage} />
          <Route path="/taxonomy" component={TaxonomyFeaturePage} />
          <Route path="/ads-courses" component={AdsCoursesFeaturePage} />
          <Route path="/food-search" component={FoodSearchPage} />
          <Route path="/certificates/:certId" component={CertificateViewPage} />
          <Route path="/courses/:courseId/lessons/:lessonId" component={LessonViewPage} />
          <Route path="/courses/:id" component={CourseDetailPage} />
          <Route path="/courses" component={CoursesPage} />
          <Route path="/manage-courses/:id/lessons" component={ManageLessonsPage} />
          <Route path="/manage-courses" component={ManageCoursesPage} />
          <Route path="/manage-orders" component={ManageOrdersPage} />
          <Route path="/tenant" component={TenantOpsFeaturePage} />
          <Route path="/security" component={SecurityOpsFeaturePage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
      {showPublicFloatingActions && <PublicFloatingActions />}
    </>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
