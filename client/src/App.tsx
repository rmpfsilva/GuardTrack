// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_auth_all_persistance
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
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

function Router() {
  const { user } = useAuth();

  return (
    <>
      <TrialBanner user={user} />
      <Switch>
        <Route path="/login" component={AuthPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/register-trial" component={TrialRegistrationPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <ProtectedRoute path="/settings" component={SettingsPage} />
        <ProtectedRoute path="/guard/app" component={GuardApp} />
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
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
