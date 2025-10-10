import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, RefreshCw, CheckCircle } from "lucide-react";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { detectBrowser, getInstallInstructions } from "@/lib/browser-detect";

export function InstallPWACard() {
  const { isInstallable, isInstalled, installApp } = useInstallPWA();
  const [open, setOpen] = useState(false);
  const browser = detectBrowser();
  const instructions = getInstallInstructions(browser);

  if (isInstalled) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Mobile App Installed
          </CardTitle>
          <CardDescription>
            GuardTrack is installed and will update automatically
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleInstallClick = () => {
    if (isInstallable) {
      // Browser supports native install prompt
      installApp();
    } else {
      // Show browser-specific instructions
      setOpen(true);
    }
  };

  const getButtonText = () => {
    if (browser.isIOS) return "How to Install";
    if (isInstallable) return "Install App";
    return "Install App";
  };

  const getCardDescription = () => {
    if (browser.isIOS) {
      return "Add GuardTrack to your home screen for quick access";
    }
    if (browser.name === 'firefox') {
      return "Get quick access to GuardTrack";
    }
    if (browser.isAndroid) {
      return "Install GuardTrack for quick access and offline use";
    }
    return "Install GuardTrack as a desktop app";
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Install Mobile App
        </CardTitle>
        <CardDescription>
          {getCardDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleInstallClick} 
          className="w-full" 
          data-testid="button-install-pwa"
        >
          <Download className="h-4 w-4 mr-2" />
          {getButtonText()}
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Install GuardTrack App</DialogTitle>
              <DialogDescription>
                Install GuardTrack for quick access and a better experience
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Installation Instructions */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">{instructions.title}</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  {instructions.steps.map((step, index) => (
                    <li key={index} className="leading-relaxed">{step}</li>
                  ))}
                </ol>
                {instructions.note && (
                  <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
                    💡 {instructions.note}
                  </p>
                )}
              </div>

              {/* App Updates Information */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <RefreshCw className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Automatic Updates</h4>
                    <p className="text-xs text-muted-foreground">
                      Once installed, GuardTrack automatically updates in the background. You'll always have the latest features without needing to reinstall.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">Works Offline</h4>
                    <p className="text-xs text-muted-foreground">
                      The installed app works even without internet connection, syncing data when you're back online.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
