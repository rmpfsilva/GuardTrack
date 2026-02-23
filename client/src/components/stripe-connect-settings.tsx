import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";

interface StripeConnectStatusResponse {
  connected: boolean;
  accountId?: string;
}

export function CompanyStripeSettings() {
  const { data: status, isLoading } = useQuery<StripeConnectStatusResponse>({
    queryKey: ["/api/stripe/connect/company/status"],
    retry: false,
  });

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
                  Connect your Stripe account to enable employee invoice payments. This feature will be available once platform payment keys are configured.
                </p>
              </div>
            </div>
            <Button disabled data-testid="button-connect-stripe-company">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Stripe Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GuardStripeSettings() {
  const { data: status, isLoading } = useQuery<StripeConnectStatusResponse>({
    queryKey: ["/api/stripe/connect/guard/status"],
    retry: false,
  });

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
              Connect your payment account to receive invoice payouts. Available once platform payments are configured.
            </p>
            <Button disabled size="sm" data-testid="button-connect-stripe-guard">
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect for Payout
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
