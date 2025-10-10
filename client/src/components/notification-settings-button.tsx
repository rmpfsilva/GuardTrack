import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NotificationSettingsButtonProps {
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function NotificationSettingsButton({
  variant = "ghost",
  size = "sm",
  className = "",
}: NotificationSettingsButtonProps) {
  const {
    permission,
    isSubscribed,
    isLoading,
    isSupported,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  const getTooltipText = () => {
    if (!isSubscribed && permission === "denied") {
      return "Notifications blocked - enable in browser settings";
    }
    if (isSubscribed) {
      return "Disable notifications";
    }
    return "Enable notifications for new opportunities";
  };

  const isDisabled = permission === "denied" || isLoading;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={isDisabled}
          className={className}
          data-testid="button-notification-settings"
        >
          {isSubscribed ? (
            <Bell className="h-4 w-4" />
          ) : (
            <BellOff className="h-4 w-4" />
          )}
          {size !== "icon" && (
            <span className="ml-2">
              {isSubscribed ? "Notifications On" : "Enable Notifications"}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  );
}
