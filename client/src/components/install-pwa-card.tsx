import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Share, MoreVertical, Plus } from "lucide-react";
import { useInstallPWA } from "@/hooks/use-install-pwa";

export function InstallPWACard() {
  const { isInstallable, isInstalled, installApp } = useInstallPWA();
  const [open, setOpen] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isInstalled) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Mobile App Installed
          </CardTitle>
          <CardDescription>
            GuardTrack is installed on your device
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleInstallClick = () => {
    if (isInstallable) {
      // Android/Desktop: Direct install
      installApp();
    } else {
      // iOS or browser without install support: Show instructions
      setOpen(true);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Install Mobile App
        </CardTitle>
        <CardDescription>
          {isAndroid && "Tap below to install GuardTrack on your phone"}
          {isIOS && "Add GuardTrack to your home screen"}
          {!isAndroid && !isIOS && "Install GuardTrack as a desktop app"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleInstallClick} 
          className="w-full" 
          data-testid="button-install-pwa"
        >
          <Download className="h-4 w-4 mr-2" />
          {isAndroid && isInstallable && "Install App"}
          {isAndroid && !isInstallable && "Install App"}
          {isIOS && "How to Install"}
          {!isAndroid && !isIOS && "Install App"}
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install GuardTrack App</DialogTitle>
              <DialogDescription>
                Follow these steps to install GuardTrack on your device
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {isIOS && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">For iPhone/iPad:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Tap the <Share className="inline h-4 w-4 mx-1" /> (Share) button at the bottom</li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" to confirm</li>
                    <li>Find GuardTrack on your home screen</li>
                  </ol>
                </div>
              )}
              {isAndroid && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">For Android:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Tap the <MoreVertical className="inline h-4 w-4 mx-1" /> (Menu) button in Chrome</li>
                    <li>Select "Add to Home screen" or "Install app"</li>
                    <li>Tap "Install" to confirm</li>
                    <li>Find GuardTrack on your home screen</li>
                  </ol>
                </div>
              )}
              {!isIOS && !isAndroid && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">For Desktop (Chrome/Edge):</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Click the <Plus className="inline h-4 w-4 mx-1" /> icon in the address bar</li>
                    <li>Or use Menu → "Install GuardTrack"</li>
                    <li>Click "Install" to add to your desktop</li>
                  </ol>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
