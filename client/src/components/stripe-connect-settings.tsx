import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";

interface StripeConnectStatusResponse {
  connected: boolean;
  accountId?: string;
}

interface StripeConfiguredResponse {
  configured: boolean;
}

export function CompanyStripeSettings() {
  const { toast } = useToast();

  const { data: stripeConfigured } = useQuery<StripeConfiguredResponse>({
    queryKey: ["/api/stripe/configured"],
    retry: false,
  });

  const { data: status, isLoading } = useQuery<StripeConnectStatusResponse>({
    queryKey: ["/api/stripe/connect/company/status"],
    retry: false,
  });

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/connect/company/onboard");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to start Stripe onboarding", variant: "destructive" });
    },
  });

  const isPlatformConfigured = stripeConfigured?.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Settings
        </CardTitle>
        <CardDescription>Connect your Stripe account to process employee payments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection status...
          </div>
        ) : status?.connected ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium" data-testid="text-stripe-connected">Stripe Connected</p>
              <p className="text-xs text-muted-foreground">Your account is ready to process payments</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted">
              <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Stripe not connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPlatformConfigured
                    ? "Connect your Stripe account to enable employee invoice payments."
                    : "Connect your Stripe account to enable employee invoice payments. This feature will be available once platform payment keys are configured."}
                </p>
              </div>
            </div>
            <Button
              disabled={!isPlatformConfigured || onboardMutation.isPending}
              onClick={() => onboardMutation.mutate()}
              data-testid="button-connect-stripe-company"
            >
              {onboardMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Stripe Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GuardStripeSettings() {
  const { toast } = useToast();

  const { data: stripeConfigured } = useQuery<StripeConfiguredResponse>({
    queryKey: ["/api/stripe/configured"],
    retry: false,
  });

  const { data: status, isLoading } = useQuery<StripeConnectStatusResponse>({
    queryKey: ["/api/stripe/connect/guard/status"],
    retry: false,
  });

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/connect/guard/onboard");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to start Stripe onboarding", variant: "destructive" });
    },
  });

  const isPlatformConfigured = stripeConfigured?.configured;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking...
          </div>
        ) : status?.connected ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium" data-testid="text-guard-stripe-connected">Payout Account Connected</p>
              <p className="text-xs text-muted-foreground">You can receive payments for approved invoices</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {isPlatformConfigured
                ? "Connect your payment account to receive invoice payouts."
                : "Connect your payment account to receive invoice payouts. Available once platform payments are configured."}
            </p>
            <Button
              disabled={!isPlatformConfigured || onboardMutation.isPending}
              onClick={() => onboardMutation.mutate()}
              size="sm"
              data-testid="button-connect-stripe-guard"
            >
              {onboardMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect for Payout
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
