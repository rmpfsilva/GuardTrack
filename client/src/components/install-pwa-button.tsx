import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, Check, Share, MoreVertical, Plus } from "lucide-react";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { cn } from "@/lib/utils";

interface InstallPWAButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  showIcon?: boolean;
}

export function InstallPWAButton({ 
  variant = "outline", 
  size = "default",
  className,
  showIcon = true 
}: InstallPWAButtonProps) {
  const { isInstallable, isInstalled, installApp } = useInstallPWA();
  const [open, setOpen] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isInstalled) {
    return null; // Don't show button if already installed
  }

  if (isInstallable) {
    return (
      <Button 
        variant={variant}
        size={size}
        onClick={installApp}
        className={className}
        data-testid="button-install-app"
      >
        {showIcon && <Download className="h-4 w-4 mr-2" />}
        Install App
      </Button>
    );
  }

  // Show instructions dialog for browsers that don't support the install prompt
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant}
          size={size}
          className={className}
          data-testid="button-install-instructions"
        >
          {showIcon && <Download className="h-4 w-4 mr-2" />}
          Install App
        </Button>
      </DialogTrigger>
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
                <li>Tap the <MoreVertical className="inline h-4 w-4 mx-1" /> (Menu) button</li>
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
  );
}
