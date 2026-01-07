import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Check, AlertTriangle, Clock, Sparkles, Info } from 'lucide-react';
import { useState } from 'react';

interface PlanFeatures {
  userManagement: boolean;
  dashboardAccess: boolean;
  reportsViewing: boolean;
  checkInOut: boolean;
  shiftScheduling: boolean;
  siteManagement: boolean;
  breakTracking: boolean;
  overtimeManagement: boolean;
  leaveRequests: boolean;
  noticeBoard: boolean;
  pushNotifications: boolean;
}

interface PlanLimits {
  maxSites: number | null;
  maxUsers: number | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  features: PlanFeatures;
  limits: PlanLimits;
}

interface PlanSummary {
  company: {
    id: string;
    companyId: string;
    name: string;
  };
  subscription: {
    status: 'trial' | 'full' | 'expired';
    trialEndDate: string | null;
    trialDaysRemaining: number | null;
    billingStartDate: string | null;
  };
  currentPlan: SubscriptionPlan | null;
}

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  userManagement: 'User Management',
  dashboardAccess: 'Dashboard Access',
  reportsViewing: 'Reports & Analytics',
  checkInOut: 'Check-in/Check-out',
  shiftScheduling: 'Shift Scheduling',
  siteManagement: 'Site Management',
  breakTracking: 'Break Tracking',
  overtimeManagement: 'Overtime Management',
  leaveRequests: 'Leave Requests',
  noticeBoard: 'Notice Board',
  pushNotifications: 'Push Notifications',
};

export function PlanSummaryCard() {
  const [showPlansDialog, setShowPlansDialog] = useState(false);

  const { data: planSummary, isLoading } = useQuery<PlanSummary>({
    queryKey: ['/api/company/plan-summary'],
  });

  const { data: allPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription-plans'],
  });

  if (isLoading) {
    return (
      <Card data-testid="card-plan-summary">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!planSummary) {
    return null;
  }

  const { subscription, currentPlan } = planSummary;
  const isTrial = subscription.status === 'trial';
  const isExpired = subscription.status === 'expired';
  const isFull = subscription.status === 'full';

  const getStatusBadge = () => {
    if (isExpired) {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Expired</Badge>;
    }
    if (isTrial) {
      return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"><Clock className="h-3 w-3" /> Trial</Badge>;
    }
    return <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><Check className="h-3 w-3" /> Active</Badge>;
  };

  return (
    <>
      <Card data-testid="card-plan-summary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Subscription Plan
            </CardTitle>
            {getStatusBadge()}
          </div>
          <CardDescription>
            {currentPlan ? currentPlan.name : 'No plan selected'}
            {isTrial && subscription.trialDaysRemaining !== null && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                ({subscription.trialDaysRemaining} days remaining)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentPlan ? (
            <>
              <div className="text-2xl font-bold">
                £{parseFloat(currentPlan.monthlyPrice).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              {currentPlan.description && (
                <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">Included Features:</p>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  {Object.entries(currentPlan.features)
                    .filter(([_, enabled]) => enabled)
                    .slice(0, 6)
                    .map(([feature]) => (
                      <div key={feature} className="flex items-center gap-1 text-muted-foreground">
                        <Check className="h-3 w-3 text-green-500" />
                        {FEATURE_LABELS[feature as keyof PlanFeatures]}
                      </div>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {isTrial ? 'Trial access with basic features' : 'No subscription plan active'}
              </p>
            </div>
          )}
          
          <Dialog open={showPlansDialog} onOpenChange={setShowPlansDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full" data-testid="button-view-plans">
                <Info className="h-4 w-4 mr-2" />
                View All Plans
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Available Subscription Plans
                </DialogTitle>
                <DialogDescription>
                  Compare plans and features to find the right fit for your organization
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {allPlans?.map((plan) => (
                  <Card 
                    key={plan.id} 
                    className={currentPlan?.id === plan.id ? 'border-primary ring-1 ring-primary' : ''}
                    data-testid={`plan-card-${plan.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        {currentPlan?.id === plan.id && (
                          <Badge variant="secondary">Current</Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold">
                        £{parseFloat(plan.monthlyPrice).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {plan.description && (
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      )}
                      <div className="space-y-1">
                        {Object.entries(plan.features).map(([feature, enabled]) => (
                          <div 
                            key={feature} 
                            className={`flex items-center gap-2 text-sm ${enabled ? '' : 'text-muted-foreground line-through'}`}
                          >
                            <Check className={`h-3 w-3 ${enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                            {FEATURE_LABELS[feature as keyof PlanFeatures]}
                          </div>
                        ))}
                      </div>
                      {plan.limits && (
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                          {plan.limits.maxSites && <p>Max Sites: {plan.limits.maxSites}</p>}
                          {plan.limits.maxUsers && <p>Max Users: {plan.limits.maxUsers}</p>}
                          {!plan.limits.maxSites && !plan.limits.maxUsers && <p>Unlimited sites & users</p>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  To upgrade or change your plan, please contact your account manager or support.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </>
  );
}
