import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles, ArrowUpRight, Calendar, MapPin, FileText, Bell, Users, Briefcase, Clock, DollarSign, Activity } from "lucide-react";
import { usePlanFeatures, type AdminTab } from "@/hooks/use-plan-features";
import { useAuth } from "@/hooks/use-auth";

const TAB_DISPLAY_INFO: Record<AdminTab, { label: string; description: string; icon: typeof Lock }> = {
  'overview': { label: 'Overview', description: 'Dashboard overview', icon: Activity },
  'guards': { label: 'Guards', description: 'Guard management', icon: Users },
  'reports': { label: 'Reports', description: 'View reports', icon: FileText },
  'users': { label: 'Users', description: 'User management', icon: Users },
  'schedule': { label: 'Schedule', description: 'Shift scheduling', icon: Calendar },
  'sites': { label: 'Sites', description: 'Site management', icon: MapPin },
  'leave': { label: 'Leave', description: 'Leave requests', icon: Clock },
  'invitations': { label: 'Invites', description: 'User invitations', icon: Users },
  'manual': { label: 'Manual', description: 'Manual check-ins', icon: Clock },
  'approvals': { label: 'Approvals', description: 'Approve overtime & breaks', icon: FileText },
  'notices': { label: 'Notices', description: 'Notice board', icon: Bell },
  'partnerships': { label: 'Partnerships', description: 'Company partnerships', icon: Briefcase },
  'job-sharing': { label: 'Job Sharing', description: 'Share jobs with partners', icon: Users },
  'billing': { label: 'Billing', description: 'Billing & invoices', icon: DollarSign },
  'activity': { label: 'Activity', description: 'Activity logs', icon: Activity },
};

export function UpgradePrompt() {
  const { user } = useAuth();
  const { planName, planTier, getLockedTabs, getNextPlanUpgrade } = usePlanFeatures();

  if (user?.role === 'super_admin' || planTier === 'pro') {
    return null;
  }

  const lockedTabs = getLockedTabs();
  const nextUpgrade = getNextPlanUpgrade();

  if (lockedTabs.length === 0 || !nextUpgrade) {
    return null;
  }

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5" data-testid="card-upgrade-prompt">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Unlock More Features</CardTitle>
        </div>
        <CardDescription>
          You're on the <Badge variant="secondary" className="mx-1">{planName || 'Starter'}</Badge> plan. 
          Upgrade to access additional tools and features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lockedTabs.slice(0, 6).map((tab) => {
            const info = TAB_DISPLAY_INFO[tab];
            const Icon = info.icon;
            return (
              <div 
                key={tab}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border/50"
                data-testid={`locked-feature-${tab}`}
              >
                <div className="p-2 rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{info.label}</span>
                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{info.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {lockedTabs.length > 6 && (
          <p className="text-sm text-muted-foreground text-center">
            +{lockedTabs.length - 6} more features available
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t">
          <div>
            <p className="font-medium">Upgrade to {nextUpgrade.name}</p>
            <p className="text-sm text-muted-foreground">Starting at {nextUpgrade.price}</p>
          </div>
          <Button className="gap-2" data-testid="button-upgrade-plan">
            View Plans
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompactUpgradePrompt() {
  const { user } = useAuth();
  const { planName, planTier, getLockedTabs, getNextPlanUpgrade } = usePlanFeatures();

  if (user?.role === 'super_admin' || planTier === 'pro') {
    return null;
  }

  const lockedTabs = getLockedTabs();
  const nextUpgrade = getNextPlanUpgrade();

  if (lockedTabs.length === 0 || !nextUpgrade) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20" data-testid="compact-upgrade-prompt">
      <div className="flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">
            {lockedTabs.length} features locked
          </p>
          <p className="text-xs text-muted-foreground">
            Upgrade to {nextUpgrade.name} for {nextUpgrade.price}
          </p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0" data-testid="button-upgrade-compact">
        Upgrade
        <ArrowUpRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
