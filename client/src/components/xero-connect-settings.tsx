import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, ExternalLink, Loader2, Unlink } from "lucide-react";
import { SiXero } from "react-icons/si";
import { format } from "date-fns";

interface XeroConfiguredResponse {
  configured: boolean;
}

interface XeroStatusResponse {
  connected: boolean;
  tenantName?: string;
  connectedAt?: string;
}

export function XeroSettings() {
  const { toast } = useToast();

  const { data: xeroConfigured } = useQuery<XeroConfiguredResponse>({
    queryKey: ["/api/xero/configured"],
    retry: false,
  });

  const { data: status, isLoading } = useQuery<XeroStatusResponse>({
    queryKey: ["/api/xero/status"],
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/connect");
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to connect to Xero", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/disconnect");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Xero disconnected", description: "Your Xero account has been disconnected." });
      queryClient.invalidateQueries({ queryKey: ["/api/xero/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to disconnect Xero", variant: "destructive" });
    },
  });

  const isPlatformConfigured = xeroConfigured?.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <SiXero className="h-5 w-5" />
          Xero Accounting
        </CardTitle>
        <CardDescription>Connect your Xero account to sync staff invoices for payroll management</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking connection status...
          </div>
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium" data-testid="text-xero-connected">Connected to Xero</p>
                <p className="text-xs text-muted-foreground">
                  Organisation: {status.tenantName || "Unknown"}
                  {status.connectedAt && ` | Connected ${format(new Date(status.connectedAt), "dd MMM yyyy")}`}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Approved and paid staff invoices can be synced to Xero as bills from the Staff Invoices tab.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              data-testid="button-disconnect-xero"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4 mr-2" />
              )}
              Disconnect Xero
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted">
              <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Xero not connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isPlatformConfigured
                    ? "Connect your Xero account to automatically sync staff invoices as bills for payroll processing."
                    : "Xero integration will be available once the platform administrator configures the Xero API keys."}
                </p>
              </div>
            </div>
            <Button
              disabled={!isPlatformConfigured || connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
              data-testid="button-connect-xero"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Connect Xero Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
