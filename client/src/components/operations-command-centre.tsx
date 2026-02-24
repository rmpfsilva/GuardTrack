import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { format } from "date-fns";
import {
  Activity, Calendar, Clock, MapPin, Users, FileText,
  CalendarOff, Receipt, Share2, Megaphone, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LocationDisplay } from "@/components/location-display";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import type { CheckInWithDetails, LeaveRequestWithDetails, JobShareWithDetails } from "@shared/schema";

interface DashboardStats {
  activeGuards: number;
  totalSites: number;
  totalGuards: number;
  weeklyHours: number;
}

interface OperationsCommandCentreProps {
  onNavigate: (tab: string) => void;
}

export default function OperationsCommandCentre({ onNavigate }: OperationsCommandCentreProps) {
  const { user, isAdmin } = useAuth();
  const { hasTabAccess } = usePlanFeatures();
  const isCompanyAdmin = isAdmin && user?.role !== 'super_admin';

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: recentActivity = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/admin/recent-activity"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: activeCheckIns = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/admin/active-check-ins"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: pendingLeave = [] } = useQuery<LeaveRequestWithDetails[]>({
    queryKey: ["/api/leave-requests/pending"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: pendingBreaks = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/breaks/pending"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: pendingOvertime = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/overtime/pending"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: receivedJobShares = [] } = useQuery<JobShareWithDetails[]>({
    queryKey: ["/api/job-shares/received"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: staffInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/staff-invoices"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const pendingInvoices = staffInvoices.filter((inv: any) => inv.status === 'submitted');
  const pendingInvoiceValue = pendingInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.totalAmount || '0'), 0);
  const pendingApprovals = pendingBreaks.length + pendingOvertime.length;
  const pendingJobShareCount = receivedJobShares.filter((j: any) => j.status === 'pending').length;

  const actionCards = [
    {
      show: pendingLeave.length > 0 && hasTabAccess('leave'),
      label: "Pending Leave",
      count: pendingLeave.length,
      description: "Awaiting approval",
      icon: CalendarOff,
      tab: "leave",
      testId: "action-pending-leave",
    },
    {
      show: pendingInvoices.length > 0,
      label: "Staff Invoices",
      count: pendingInvoices.length,
      description: "Awaiting review",
      icon: Receipt,
      tab: "staff-invoices",
      testId: "action-pending-invoices",
    },
    {
      show: pendingApprovals > 0 && hasTabAccess('approvals'),
      label: "Approvals",
      count: pendingApprovals,
      description: "Breaks & overtime",
      icon: Clock,
      tab: "approvals",
      testId: "action-pending-approvals",
    },
    {
      show: pendingJobShareCount > 0 && hasTabAccess('job-sharing'),
      label: "Job Shares",
      count: pendingJobShareCount,
      description: "Pending requests",
      icon: Share2,
      tab: "job-sharing",
      testId: "action-pending-jobshares",
    },
  ].filter(card => card.show);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-command-centre-title">Operations Command Centre</h1>
        <p className="text-muted-foreground mt-1">Live overview of workforce, shifts and network activity.</p>
      </div>

      {actionCards.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Priority Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {actionCards.map((card) => (
              <Card
                key={card.tab}
                className="hover-elevate cursor-pointer"
                onClick={() => onNavigate(card.tab)}
                data-testid={card.testId}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{card.label}</p>
                      <p className="text-2xl font-bold">{card.count}</p>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </div>
                    <div className="p-2 rounded-md bg-accent/50">
                      <card.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Live Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Active Now</p>
                  <p className="text-3xl font-bold text-chart-2" data-testid="metric-active-guards">
                    {stats?.activeGuards || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">On duty</p>
                </div>
                <div className="p-2 rounded-md bg-accent/50">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Shifts Today</p>
                  <p className="text-3xl font-bold" data-testid="metric-total-sites">
                    {stats?.totalSites || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Active locations</p>
                </div>
                <div className="p-2 rounded-md bg-accent/50">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Weekly Hours</p>
                  <p className="text-3xl font-bold" data-testid="metric-weekly-hours">
                    {stats?.weeklyHours ? Number(stats.weeklyHours).toFixed(1) : "0.0"}
                  </p>
                  <p className="text-xs text-muted-foreground">This week</p>
                </div>
                <div className="p-2 rounded-md bg-accent/50">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Pending Value</p>
                  <p className="text-3xl font-bold" data-testid="metric-pending-value">
                    £{pendingInvoiceValue.toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Invoice total</p>
                </div>
                <div className="p-2 rounded-md bg-accent/50">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Calendar className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest check-in/check-out events</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 8).map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="p-3 rounded-md border border-border text-sm"
                    data-testid={`activity-${checkIn.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {checkIn.user.firstName} {checkIn.user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {checkIn.site.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          In: {format(new Date(checkIn.checkInTime), "MMM d, HH:mm")}
                          {checkIn.checkOutTime && ` · Out: ${format(new Date(checkIn.checkOutTime), "HH:mm")}`}
                        </p>
                      </div>
                      <Badge variant={checkIn.status === 'active' ? 'default' : 'secondary'}>
                        {checkIn.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Activity className="h-5 w-5" />
              Currently On Duty
            </CardTitle>
            <CardDescription>Employees actively checked in</CardDescription>
          </CardHeader>
          <CardContent>
            {activeCheckIns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No employees on duty</p>
            ) : (
              <div className="space-y-3">
                {activeCheckIns.slice(0, 8).map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="p-3 rounded-md border border-border"
                    data-testid={`on-duty-${checkIn.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={checkIn.user.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {checkIn.user.firstName?.[0]}{checkIn.user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {checkIn.user.firstName} {checkIn.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {checkIn.site.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="default" className="bg-chart-2">Active</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(checkIn.checkInTime), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {user?.role !== 'super_admin' && (
        <UpgradePrompt />
      )}
    </div>
  );
}