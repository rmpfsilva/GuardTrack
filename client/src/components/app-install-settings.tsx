import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Smartphone, Copy, Check, Eye, MousePointerClick, Link2, QrCode } from "lucide-react";

function QRCodeDisplay({ url }: { url: string }) {
  const encoded = encodeURIComponent(url);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}&bgcolor=ffffff&color=1d4ed8&margin=10`;
  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src={qrUrl}
        alt="QR Code for install link"
        className="w-36 h-36 rounded-lg border border-border"
        data-testid="img-install-qr-code"
      />
      <p className="text-xs text-muted-foreground text-center">Scan with mobile device to open install page</p>
    </div>
  );
}

export function AppInstallSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: company, isLoading } = useQuery<any>({
    queryKey: ['/api/companies/my-company'],
    enabled: !!user,
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest('PATCH', `/api/companies/${company?.id}/force-install`, { forceInstallEnabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/my-company'] });
      toast({ title: "Setting updated" });
    },
    onError: () => {
      toast({ title: "Failed to update setting", variant: "destructive" });
    },
  });

  if (isLoading || !company) return null;

  const installUrl = `${window.location.origin}/install/${company.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(installUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Install link copied" });
  };

  return (
    <Card data-testid="card-app-install-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          App Installation
        </CardTitle>
        <CardDescription>
          Share this link with your guards to install the GuardTrack app on their device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <QRCodeDisplay url={installUrl} />

          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Install Link
              </Label>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 text-xs font-mono bg-muted rounded-md px-3 py-2 truncate border border-border"
                  data-testid="text-install-link"
                >
                  {installUrl}
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="button-copy-install-link"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link directly, post it in WhatsApp groups, or print the QR code for staff.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <Label className="font-medium text-sm" htmlFor="force-install-toggle">
                  Force Install Before Login
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mobile users must install the app before they can log in.
                </p>
              </div>
              <Switch
                id="force-install-toggle"
                checked={company.forceInstallEnabled ?? false}
                onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                disabled={toggleMutation.isPending}
                data-testid="switch-force-install"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Page Views</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-pwa-page-views">
              {company.pwaPageViews ?? 0}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
            <div className="flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Install Clicks</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-pwa-install-clicks">
              {company.pwaInstallClicks ?? 0}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/20 border border-border space-y-1">
          <p className="text-xs font-medium">How guards install:</p>
          <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
            <li>Open the install link on their mobile device</li>
            <li>Follow the on-screen instructions (3 taps on Android, 3 taps on iOS)</li>
            <li>Open GuardTrack from their home screen and log in</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
