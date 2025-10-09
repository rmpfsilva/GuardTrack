// Referenced from blueprint:javascript_log_in_with_replit
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import GuardDashboard from "@/pages/guard-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import AccessDenied from "@/pages/access-denied";

function Router() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  return (
    <Switch>
      <Route path="/access-denied" component={AccessDenied} />
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          {isAdmin ? (
            <Route path="/" component={AdminDashboard} />
          ) : (
            <Route path="/" component={GuardDashboard} />
          )}
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
