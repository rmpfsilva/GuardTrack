import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, RefreshCw, CheckCircle } from "lucide-react";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { detectBrowser, getInstallInstructions } from "@/lib/browser-detect";
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
  const browser = detectBrowser();
  const instructions = getInstallInstructions(browser);

  if (isInstalled) {
    return null; // Don't show button if already installed
  }

  // If browser supports native install prompt, use it
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

  // Show browser-specific instructions dialog
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
  );
}
