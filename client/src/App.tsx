import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/dashboard";
import Nutrition from "@/pages/nutrition";
import Workouts from "@/pages/workouts";
import Progress from "@/pages/progress";
import Store from "@/pages/store";
import ProductDetail from "@/pages/ProductDetail";
import Orders from "@/pages/orders";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";
import BlogPage from "@/pages/blog";
import Auth from "@/pages/auth";
import NotFound from "@/pages/not-found";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfService from "@/pages/tos";
import ContentLibrary from './pages/ContentLibrary';
import AdminDashboard from './pages/admin';
import CoachPage from './pages/coach';
import Messages from './pages/messages';
import SignUpPage from './pages/signup';
import ResetPasswordPage from './pages/reset';
import GymDashboard from './pages/gym';
import Home from './pages/home';
import { useState, useEffect } from "react";
import { isPlatformAdminRole } from "@shared/roleAccess";

function AuthenticatedRoutes() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  console.log('Current location:', location);

  // Redirect admin users from root to /admin
  useEffect(() => {
    if (isPlatformAdminRole(user?.role) && (location === '/' || location === '/dashboard')) {
      setLocation('/admin');
    }
  }, [location, user, setLocation]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/nutrition" component={Nutrition} />
        <Route path="/workouts" component={Workouts} />
        <Route path="/progress" component={Progress} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile" component={Profile} />
        <Route path="/content-library" component={ContentLibrary} />
  <Route path="/admin" component={AdminDashboard} />
  <Route path="/coach" component={CoachPage} />
          <Route path="/gym" component={GymDashboard} />
        <Route path="/messages" component={Messages} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  const auth = useAuth();
  const { user, loading } = auth;
  const [isInitialized, setIsInitialized] = useState(false);
  const [location] = useLocation();

  console.log('[App] Current location:', location, 'User:', user ? 'logged in' : 'not logged in', 'Loading:', loading);

  useEffect(() => {
    // Mark as initialized after the first render
    if (!isInitialized && !loading) {
      setIsInitialized(true);
    }
  }, [loading, isInitialized]);

  // Only show loading on initial load, not during authentication state changes
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Toaster />
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <Switch>
          <Route path="/auth">
            <Auth />
          </Route>
          <Route path="/privacy-policy">
            <PrivacyPolicy />
          </Route>
          <Route path="/tos">
            <TermsOfService />
          </Route>
          <Route path="/terms-of-service">
            <TermsOfService />
          </Route>
          <Route path="/signup">
            <SignUpPage />
          </Route>
          <Route path="/home">
            <Home />
          </Route>
          <Route path="/reset">
            <ResetPasswordPage />
          </Route>
          <Route path="/product/:id">
            <Layout><ProductDetail /></Layout>
          </Route>
          <Route path="/store">
            <Layout><Store /></Layout>
          </Route>
          <Route path="/blog">
            <Layout><BlogPage /></Layout>
          </Route>
          <Route path="/orders">
            <Layout><Orders /></Layout>
          </Route>
          <Route path="/*">
            {user ? <AuthenticatedRoutes /> : <Home />}
          </Route>
        </Switch>
      )}
    </TooltipProvider>
  );
}

export default App;
