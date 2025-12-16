import { useFeatureAccess, FeatureName } from "@/hooks/use-feature-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Crown, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FeatureGateProps {
  feature: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  fallback,
  showUpgradePrompt = true 
}: FeatureGateProps) {
  const { hasFeature, isLoading, isBlocked, planName } = useFeatureAccess();

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (isBlocked) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Access Blocked
          </CardTitle>
          <CardDescription>
            Your company's access has been blocked. Please contact support for assistance.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!hasFeature(feature)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (!showUpgradePrompt) {
      return null;
    }

    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Feature Not Available
          </CardTitle>
          <CardDescription>
            {getFeatureLabel(feature)} is not included in your current plan
            {planName && ` (${planName})`}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" data-testid="button-upgrade-plan">
            <Crown className="h-4 w-4" />
            Upgrade Plan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

interface FeatureCheckProps {
  feature: FeatureName;
  children: React.ReactNode;
}

export function FeatureCheck({ feature, children }: FeatureCheckProps) {
  const { hasFeature, isLoading } = useFeatureAccess();

  if (isLoading) {
    return null;
  }

  if (!hasFeature(feature)) {
    return null;
  }

  return <>{children}</>;
}

interface LimitCheckProps {
  limitType: 'maxSites' | 'maxUsers';
  currentCount: number;
  children: React.ReactNode;
  onLimitReached?: () => void;
}

export function LimitCheck({ limitType, currentCount, children, onLimitReached }: LimitCheckProps) {
  const { checkLimit, isLoading, limits } = useFeatureAccess();

  if (isLoading) {
    return null;
  }

  const withinLimit = checkLimit(limitType, currentCount);
  
  if (!withinLimit) {
    if (onLimitReached) {
      onLimitReached();
    }
    return null;
  }

  return <>{children}</>;
}

function getFeatureLabel(feature: FeatureName): string {
  const labels: Record<FeatureName, string> = {
    userManagement: 'User Management',
    dashboardAccess: 'Dashboard Access',
    reportsViewing: 'Reports & Analytics',
    checkInOut: 'Check In/Out',
    shiftScheduling: 'Shift Scheduling',
    siteManagement: 'Site Management',
    breakTracking: 'Break Tracking',
    overtimeManagement: 'Overtime Management',
    leaveRequests: 'Leave Requests',
    noticeBoard: 'Notice Board',
    pushNotifications: 'Push Notifications',
  };
  return labels[feature] || feature;
}
