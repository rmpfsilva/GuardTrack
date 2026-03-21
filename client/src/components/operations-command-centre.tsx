import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

import { format } from "date-fns";
import {
  Activity, Calendar, MapPin, Users,
  ChevronDown, ChevronUp,
  ShieldAlert, ShieldCheck, ShieldOff, CheckCircle2,
  Pencil
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CheckInWithDetails, LeaveRequestWithDetails, JobShareWithDetails } from "@shared/schema";

interface DashboardStats {
  activeGuards: number;
  totalSites: number;
  totalGuards: number;
  weeklyHours: number;
}

interface LicenceAlertEmployee {
  id: string;
  name: string;
  role: string;
  siaNumber: string | null;
  siaExpiryDate: string;
  daysRemaining: number;
  daysOverdue?: number;
}

interface LicenceAlerts {
  expired: LicenceAlertEmployee[];
  expiring60: LicenceAlertEmployee[];
  expiring90: LicenceAlertEmployee[];
  valid: LicenceAlertEmployee[];
  stats: {
    expired: number;
    expiring60: number;
    expiring90: number;
    valid: number;
    totalSiaEmployees: number;
    totalEmployees: number;
    activeSites: number;
  };
}

interface ShiftAtRisk {
  shiftId: string;
  shiftDate: string;
  site: string;
  employeeId: string;
  employeeName: string;
  licenceExpiry: string;
  daysUntilExpiry: number;
  riskLevel: "expired" | "expiring_soon";
}

interface OperationsCommandCentreProps {
  onNavigate: (tab: string) => void;
}

function LicenceTable({
  employees,
  type,
  onUpdateLicence,
}: {
  employees: LicenceAlertEmployee[];
  type: "expired" | "expiring60" | "expiring90";
  onUpdateLicence: (employeeId: string) => void;
}) {
  if (employees.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
        {type === "expired" ? "No expired licences" : "None expiring in this window"}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-xs">
            <th className="text-left pb-2 pr-3 font-medium">Name</th>
            <th className="text-left pb-2 pr-3 font-medium hidden sm:table-cell">Type</th>
            <th className="text-left pb-2 pr-3 font-medium hidden md:table-cell">SIA Number</th>
            <th className="text-left pb-2 pr-3 font-medium">Expiry Date</th>
            <th className="text-left pb-2 pr-3 font-medium">
              {type === "expired" ? "Days Overdue" : "Days Left"}
            </th>
            <th className="text-left pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-3 font-medium">{emp.name}</td>
              <td className="py-2 pr-3 hidden sm:table-cell capitalize">{emp.role}</td>
              <td className="py-2 pr-3 hidden md:table-cell font-mono text-xs">
                {emp.siaNumber || "—"}
              </td>
              <td className="py-2 pr-3">
                <span
                  className={
                    type === "expired"
                      ? "text-red-600 dark:text-red-400 font-medium"
                      : type === "expiring60"
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : "text-yellow-600 dark:text-yellow-500 font-medium"
                  }
                >
                  {format(new Date(emp.siaExpiryDate), "dd MMM yyyy")}
                </span>
              </td>
              <td className="py-2 pr-3">
                {type === "expired" ? (
                  <Badge variant="destructive" className="text-xs">
                    {emp.daysOverdue}d overdue
                  </Badge>
                ) : (
                  <span
                    className={
                      type === "expiring60"
                        ? "text-amber-600 dark:text-amber-400 font-medium"
                        : "text-yellow-600 dark:text-yellow-500 font-medium"
                    }
                  >
                    {emp.daysRemaining}d
                  </span>
                )}
              </td>
              <td className="py-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateLicence(emp.id)}
                  data-testid={`button-update-licence-${emp.id}`}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Update
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OperationsCommandCentre({ onNavigate }: OperationsCommandCentreProps) {
  const { user, isAdmin } = useAuth();
  const isCompanyAdmin = isAdmin && user?.role !== "super_admin";

  const [expiredExpanded, setExpiredExpanded] = useState(true);
  const [expiring60Expanded, setExpiring60Expanded] = useState(true);
  const [expiring90Expanded, setExpiring90Expanded] = useState(false);

  const expiredRef = useRef<HTMLDivElement>(null);
  const expiring60Ref = useRef<HTMLDivElement>(null);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: licenceAlerts } = useQuery<LicenceAlerts>({
    queryKey: ["/api/admin/licence-alerts"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 60000,
  });

  const { data: shiftsAtRisk = [] } = useQuery<ShiftAtRisk[]>({
    queryKey: ["/api/admin/shifts-at-risk"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 60000,
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

  const pendingInvoices = staffInvoices.filter((inv: any) => inv.status === "submitted");
  const pendingInvoiceValue = pendingInvoices.reduce(
    (sum: number, inv: any) => sum + parseFloat(inv.totalAmount || "0"),
    0
  );

  const handleUpdateLicence = (employeeId: string) => {
    onNavigate("guards");
  };

  const ls = licenceAlerts?.stats;

  return (
    <div className="space-y-8">
      {/* Title + date */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-command-centre-title">
            Operations Command Centre
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(new Date(), "EEEE, d MMMM yyyy")} · Live workforce intelligence
          </p>
        </div>
      </div>

      {/* Section 1 — Licence Alert KPI Cards */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          SIA Licence Status
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Expired */}
          <Card
            className="cursor-pointer hover-elevate border-red-500/30 bg-red-50/50 dark:bg-red-950/20"
            onClick={() => {
              setExpiredExpanded(true);
              setTimeout(() => expiredRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
            }}
            data-testid="card-licences-expired"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Expired</p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{ls?.expired ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Immediate action</p>
                </div>
                <ShieldOff className="h-5 w-5 text-red-500 mt-1 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Expiring ≤ 60 days */}
          <Card
            className="cursor-pointer hover-elevate border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
            onClick={() => {
              setExpiring60Expanded(true);
              setTimeout(() => expiring60Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
            }}
            data-testid="card-licences-expiring60"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Within 60 Days</p>
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{ls?.expiring60 ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Renew soon</p>
                </div>
                <ShieldAlert className="h-5 w-5 text-amber-500 mt-1 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Expiring 61–90 days */}
          <Card
            className="cursor-pointer hover-elevate border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20"
            onClick={() => {
              setExpiring90Expanded(true);
              setTimeout(() => {
                document.getElementById("expiring90-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 100);
            }}
            data-testid="card-licences-expiring90"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">61–90 Days</p>
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">{ls?.expiring90 ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Plan ahead</p>
                </div>
                <ShieldAlert className="h-5 w-5 text-yellow-500 mt-1 shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* All valid */}
          <Card className="hover-elevate border-green-500/30 bg-green-50/50 dark:bg-green-950/20" data-testid="card-licences-valid">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">All Valid</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{ls?.valid ?? "—"}</p>
                  <p className="text-xs text-muted-foreground mt-1">90+ days remaining</p>
                </div>
                <ShieldCheck className="h-5 w-5 text-green-500 mt-1 shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 2 — Expired Licences */}
      <div ref={expiredRef} className="space-y-2">
        <button
          className="w-full flex items-center justify-between group"
          onClick={() => setExpiredExpanded((p) => !p)}
          data-testid="toggle-expired-section"
        >
          <h2 className="text-base font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
            <ShieldOff className="h-5 w-5" />
            Expired Licences
            {(ls?.expired ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-1">{ls?.expired}</Badge>
            )}
          </h2>
          {expiredExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {expiredExpanded && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <LicenceTable
                employees={licenceAlerts?.expired ?? []}
                type="expired"
                onUpdateLicence={handleUpdateLicence}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section 3 — Expiring Soon (side by side) */}
      <div ref={expiring60Ref} className="space-y-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Expiring Soon
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* Within 60 days */}
          <div>
            <button
              className="w-full flex items-center justify-between mb-2 group"
              onClick={() => setExpiring60Expanded((p) => !p)}
              data-testid="toggle-expiring60-section"
            >
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                Within 60 Days
                {(ls?.expiring60 ?? 0) > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs" variant="outline">{ls?.expiring60}</Badge>
                )}
              </h3>
              {expiring60Expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {expiring60Expanded && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <LicenceTable
                    employees={licenceAlerts?.expiring60 ?? []}
                    type="expiring60"
                    onUpdateLicence={handleUpdateLicence}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* 61–90 days */}
          <div id="expiring90-section">
            <button
              className="w-full flex items-center justify-between mb-2 group"
              onClick={() => setExpiring90Expanded((p) => !p)}
              data-testid="toggle-expiring90-section"
            >
              <h3 className="text-sm font-semibold text-yellow-600 dark:text-yellow-500 flex items-center gap-2">
                61–90 Days
                {(ls?.expiring90 ?? 0) > 0 && (
                  <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-xs" variant="outline">{ls?.expiring90}</Badge>
                )}
              </h3>
              {expiring90Expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {expiring90Expanded && (
              <Card>
                <CardContent className="pt-4 pb-4">
                  <LicenceTable
                    employees={licenceAlerts?.expiring90 ?? []}
                    type="expiring90"
                    onUpdateLicence={handleUpdateLicence}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Section 4 — Upcoming Shifts with Licence Issues */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Upcoming Shifts with Licence Issues
          <span className="text-xs text-muted-foreground font-normal">(next 14 days)</span>
        </h2>
        <Card>
          <CardContent className="pt-4 pb-4">
            {shiftsAtRisk.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                No upcoming shifts affected by licence issues
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs">
                      <th className="text-left pb-2 pr-3 font-medium">Shift Date</th>
                      <th className="text-left pb-2 pr-3 font-medium">Site</th>
                      <th className="text-left pb-2 pr-3 font-medium">Employee</th>
                      <th className="text-left pb-2 pr-3 font-medium hidden md:table-cell">Licence Expiry</th>
                      <th className="text-left pb-2 pr-3 font-medium hidden sm:table-cell">Days</th>
                      <th className="text-left pb-2 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftsAtRisk.map((shift) => (
                      <tr key={shift.shiftId} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 font-medium whitespace-nowrap">
                          {format(new Date(shift.shiftDate), "EEE d MMM")}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground truncate max-w-[120px]">{shift.site}</td>
                        <td className="py-2 pr-3 font-medium">{shift.employeeName}</td>
                        <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground whitespace-nowrap">
                          {format(new Date(shift.licenceExpiry), "dd MMM yyyy")}
                        </td>
                        <td className="py-2 pr-3 hidden sm:table-cell">
                          {shift.riskLevel === "expired" ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">{Math.abs(shift.daysUntilExpiry)}d overdue</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">{shift.daysUntilExpiry}d left</span>
                          )}
                        </td>
                        <td className="py-2">
                          {shift.riskLevel === "expired" ? (
                            <Badge variant="destructive" className="text-xs" data-testid={`badge-risk-expired-${shift.shiftId}`}>Expired</Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs" variant="outline" data-testid={`badge-risk-expiring-${shift.shiftId}`}>Expiring</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 5 — Workforce + Site Overview Cards */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          Workforce & Site Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Card className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Employees</p>
              <p className="text-2xl font-bold" data-testid="metric-total-employees">
                {ls?.totalEmployees ?? stats?.totalGuards ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">All company staff</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">SIA Licensed</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="metric-sia-licensed">
                {ls ? ls.expiring60 + ls.expiring90 + ls.valid : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Valid SIA licences</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Active Sites</p>
              <p className="text-2xl font-bold" data-testid="metric-active-sites">
                {ls?.activeSites ?? stats?.totalSites ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Operational locations</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">On Duty Now</p>
              <p className="text-2xl font-bold text-chart-2" data-testid="metric-active-guards">
                {stats?.activeGuards ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Active check-ins</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Shifts Today</p>
              <p className="text-2xl font-bold" data-testid="metric-total-sites">
                {stats?.totalSites ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Active locations</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Weekly Hours</p>
              <p className="text-2xl font-bold" data-testid="metric-weekly-hours">
                {stats?.weeklyHours ? Number(stats.weeklyHours).toFixed(1) : "0.0"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">This week</p>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Pending Value</p>
              <p className="text-2xl font-bold" data-testid="metric-pending-value">
                £{pendingInvoiceValue.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Invoice total</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 6 — Recent Activity + Currently On Duty */}
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
                        <p className="text-xs text-muted-foreground truncate">{checkIn.site.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          In: {format(new Date(checkIn.checkInTime), "MMM d, HH:mm")}
                          {checkIn.checkOutTime && ` · Out: ${format(new Date(checkIn.checkOutTime), "HH:mm")}`}
                        </p>
                      </div>
                      <Badge variant={checkIn.status === "active" ? "default" : "secondary"}>
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

    </div>
  );
}
