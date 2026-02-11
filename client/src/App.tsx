// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_auth_all_persistance
import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { BackgroundProvider } from "@/components/background-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { TrialBanner } from "@/components/trial-banner";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing-page";
import AuthPage from "@/pages/auth-page";
import RegisterPage from "@/pages/register-page";
import TrialRegistrationPage from "@/pages/trial-registration";
import GuardDashboard from "@/pages/guard-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import GuardApp from "@/pages/guard-app";
import SettingsPage from "@/pages/settings-page";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import InstallPage from "@/pages/install-page";

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

function isMobileDevice(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android/.test(ua);
}

function InstallGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const blockedPages = ['/login', '/auth', '/register', '/register-trial', '/forgot-password', '/reset-password'];

  const shouldBlock = blockedPages.includes(location) && !isStandalone() && isMobileDevice();

  useEffect(() => {
    if (shouldBlock) {
      setLocation('/install');
    }
  }, [shouldBlock, setLocation]);

  if (shouldBlock) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();

  return (
    <>
      <TrialBanner user={user} />
      <InstallGate>
        <Switch>
          <Route path="/install" component={InstallPage} />
          <Route path="/login" component={AuthPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/register-trial" component={TrialRegistrationPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <ProtectedRoute path="/settings" component={SettingsPage} />
          <Route path="/guard/app" component={GuardApp} />
          <ProtectedRoute path="/guard-dashboard" component={GuardDashboard} />
          {user && (user.role === 'admin' || user.role === 'super_admin') ? (
            <ProtectedRoute path="/" component={AdminDashboard} />
          ) : user ? (
            <ProtectedRoute path="/" component={GuardDashboard} />
          ) : (
            <Route path="/" component={LandingPage} />
          )}
          <Route component={NotFound} />
        </Switch>
      </InstallGate>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <BackgroundProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </AuthProvider>
        </BackgroundProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
