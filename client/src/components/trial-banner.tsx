import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Timer, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { User } from "@shared/schema";

interface TrialBannerProps {
  user: User | null | undefined;
}

export function TrialBanner({ user }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Only show for admins and non-super admins
  const shouldCheckTrial = user && (user.role === 'admin') && user.companyId;

  const { data: trialStatus } = useQuery<{ isActive: boolean; daysRemaining: number; status: string }>({
    queryKey: [`/api/companies/${user?.companyId}/trial/status`],
    enabled: !!shouldCheckTrial,
  });

  // Don't show if dismissed or no trial data
  if (dismissed || !trialStatus || !shouldCheckTrial) {
    return null;
  }

  // Don't show for full version users
  if (trialStatus.status === 'full') {
    return null;
  }

  // Show expired trial banner (red, cannot be dismissed)
  if (trialStatus.status === 'expired') {
    return (
      <Alert className="border-destructive bg-destructive/10 rounded-none" data-testid="alert-trial-expired">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-destructive font-medium">
            Your trial has expired. Some features are restricted. Please contact support to upgrade your account.
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Show warning for trials expiring soon (≤3 days, can be dismissed)
  if (trialStatus.status === 'trial' && trialStatus.daysRemaining <= 3) {
    return (
      <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-none" data-testid="alert-trial-expiring">
        <Timer className="h-5 w-5 text-amber-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-amber-900 dark:text-amber-100">
            Your trial expires in {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'day' : 'days'}. 
            Contact support to upgrade before you lose access.
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover-elevate"
            onClick={() => setDismissed(true)}
            data-testid="button-dismiss-trial-warning"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Show info banner for active trials (>3 days, can be dismissed)
  if (trialStatus.status === 'trial' && trialStatus.daysRemaining > 3) {
    return (
      <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded-none" data-testid="alert-trial-active">
        <Timer className="h-5 w-5 text-blue-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-blue-900 dark:text-blue-100">
            Trial period: {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'day' : 'days'} remaining
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover-elevate"
            onClick={() => setDismissed(true)}
            data-testid="button-dismiss-trial-info"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
