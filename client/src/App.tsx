// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_auth_all_persistance
import { useEffect, useState } from "react";
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
import { isNativePlatform } from "@/lib/native";
import { useFCMNotifications } from "@/hooks/use-fcm-notifications";
import { useCompanyTheme } from "@/hooks/use-company-theme";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing-page";
import AuthPage from "@/pages/auth-page";
import RegisterPage from "@/pages/register-page";
import ActivatePage from "@/pages/activate-page";
import TrialRegistrationPage from "@/pages/trial-registration";
import GuardDashboard from "@/pages/guard-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import GuardApp from "@/pages/guard-app";
import SettingsPage from "@/pages/settings-page";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import InstallPage from "@/pages/install-page";

function isStandalone(): boolean {
  if (isNativePlatform()) return true;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

function isMobileDevice(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android/.test(ua);
}

function InstallGate({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [forceInstall, setForceInstall] = useState<boolean | null>(null);
  const blockedPages = ['/login', '/auth', '/register', '/activate', '/register-trial', '/forgot-password', '/reset-password'];

  const onBlockedPage = blockedPages.some(p => location === p || location.startsWith(p));
  const alreadyInstalled = isNativePlatform() || isStandalone();
  const onInstallPage = location.startsWith('/install');
  const hasPendingInvite = !!localStorage.getItem('pendingInviteToken');

  // Fetch force-install setting for the company stored in localStorage
  useEffect(() => {
    const companyId = localStorage.getItem('installCompanyId');
    if (!companyId) {
      setForceInstall(false);
      return;
    }
    fetch(`/api/install/company-info/${companyId}`)
      .then(r => r.json())
      .then(data => setForceInstall(data.forceInstallEnabled === true))
      .catch(() => setForceInstall(false));
  }, []);

  // Block when: mobile + not standalone + on auth page + (force install OR pending invite token)
  const shouldBlock =
    !alreadyInstalled &&
    onBlockedPage &&
    !onInstallPage &&
    isMobileDevice() &&
    forceInstall !== null && // wait until setting is fetched
    (forceInstall === true || hasPendingInvite);

  useEffect(() => {
    if (shouldBlock) {
      const companyId = localStorage.getItem('installCompanyId');
      setLocation(companyId ? `/install/${companyId}` : '/install');
    }
  }, [shouldBlock, setLocation]);

  if (shouldBlock) return null;

  return <>{children}</>;
}

function Router() {
  const { user } = useAuth();
  useFCMNotifications(!!user);
  useCompanyTheme();

  return (
    <>
      <TrialBanner user={user} />
      <InstallGate>
        <Switch>
          <Route path="/install/:companyId" component={InstallPage} />
          <Route path="/install" component={InstallPage} />
          <Route path="/login" component={AuthPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/activate" component={ActivatePage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/register-trial" component={TrialRegistrationPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <ProtectedRoute path="/settings" component={SettingsPage} />
          <Route path="/guard/app" component={GuardApp} />
          <ProtectedRoute path="/guard-dashboard" component={GuardApp} />
          {user && (user.role === 'admin' || user.role === 'super_admin') ? (
            <ProtectedRoute path="/" component={AdminDashboard} />
          ) : user ? (
            <ProtectedRoute path="/" component={GuardApp} />
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
