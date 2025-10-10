import { Button } from "@/components/ui/button";
import { Download, Check } from "lucide-react";
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

  if (isInstalled) {
    return (
      <Button 
        variant="ghost" 
        size={size}
        className={cn("cursor-default", className)}
        disabled
        data-testid="button-app-installed"
      >
        {showIcon && <Check className="h-4 w-4 mr-2" />}
        App Installed
      </Button>
    );
  }

  if (!isInstallable) {
    return null;
  }

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
