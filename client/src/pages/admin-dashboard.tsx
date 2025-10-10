import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Users, MapPin, Clock, Activity, Calendar, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import proForceLogo from "@assets/download_1760019684165.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallPWAButton } from "@/components/install-pwa-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Site, CheckInWithDetails, User } from "@shared/schema";
import SiteManagement from "@/components/site-management";
import GuardDirectory from "@/components/guard-directory";
import ScheduleManagement from "@/components/schedule-management";
import UserManagement from "@/components/user-management";
import BillingReports from "@/components/billing-reports";
import AdminCheckInControl from "@/components/admin-check-in-control";
import EditCheckInDialog from "@/components/edit-check-in-dialog";
import InvitationManagement from "@/components/invitation-management";
import AdminLeaveManagement from "@/components/admin-leave-management";
import AdvancedReports from "@/components/advanced-reports";
import AdminApprovals from "@/components/admin-approvals";

interface DashboardStats {
  activeGuards: number;
  totalSites: number;
  totalGuards: number;
  weeklyHours: number;
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading, isAdmin, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingCheckIn, setEditingCheckIn] = useState<CheckInWithDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500);
    } else if (!authLoading && user && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [user, authLoading, isAdmin, toast]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch dashboard stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent activity
  const { data: recentActivity = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/admin/recent-activity"],
    enabled: !!user && isAdmin,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch active check-ins
  const { data: activeCheckIns = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/admin/active-check-ins"],
    enabled: !!user && isAdmin,
    refetchInterval: 10000,
  });

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img src={proForceLogo} alt="ProForce Security" className="h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "A";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={proForceLogo} alt="ProForce Security" className="h-8" data-testid="img-company-logo" />
            <Badge variant="secondary" className="text-xs">Admin</Badge>
          </div>
          <div className="flex items-center gap-3">
            <InstallPWAButton variant="ghost" size="sm" className="hidden sm:flex" />
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "Admin"} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{user.firstName || user.email}</span>
            </div>
            <Link href="/settings">
              <Button 
                variant="ghost" 
                size="sm"
                data-testid="button-settings"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Settings</span>
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                logoutMutation.mutate(undefined, {
                  onSuccess: () => {
                    setLocation('/auth');
                  }
                });
              }}
              data-testid="button-logout"
            >
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Current Time */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground mb-1">System Time</p>
          <p className="text-2xl font-mono font-semibold">
            {format(currentTime, "HH:mm:ss - EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Guards</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-chart-2" data-testid="stat-active-guards">
                {stats?.activeGuards || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Currently on duty</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sites</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-total-sites">
                {stats?.totalSites || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guards</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-total-guards">
                {stats?.totalGuards || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Registered personnel</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weekly Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-weekly-hours">
                {stats?.weeklyHours ? Number(stats.weeklyHours).toFixed(1) : "0.0"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">This week's total</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="w-full overflow-x-auto pb-2 flex justify-center">
            <TabsList className="inline-flex min-w-min">
              <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm whitespace-nowrap">Overview</TabsTrigger>
              <TabsTrigger value="billing" data-testid="tab-billing" className="text-xs sm:text-sm whitespace-nowrap">Billing</TabsTrigger>
              <TabsTrigger value="reports" data-testid="tab-reports" className="text-xs sm:text-sm whitespace-nowrap">Reports</TabsTrigger>
              <TabsTrigger value="schedule" data-testid="tab-schedule" className="text-xs sm:text-sm whitespace-nowrap">Schedule</TabsTrigger>
              <TabsTrigger value="guards" data-testid="tab-guards" className="text-xs sm:text-sm whitespace-nowrap">Guards</TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users" className="text-xs sm:text-sm whitespace-nowrap">Users</TabsTrigger>
              <TabsTrigger value="invitations" data-testid="tab-invitations" className="text-xs sm:text-sm whitespace-nowrap">Invites</TabsTrigger>
              <TabsTrigger value="manual" data-testid="tab-manual" className="text-xs sm:text-sm whitespace-nowrap">Manual</TabsTrigger>
              <TabsTrigger value="sites" data-testid="tab-sites" className="text-xs sm:text-sm whitespace-nowrap">Sites</TabsTrigger>
              <TabsTrigger value="leave" data-testid="tab-leave" className="text-xs sm:text-sm whitespace-nowrap">Leave</TabsTrigger>
              <TabsTrigger value="approvals" data-testid="tab-approvals" className="text-xs sm:text-sm whitespace-nowrap">Approvals</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity" className="text-xs sm:text-sm whitespace-nowrap">Activity</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Active Check-Ins */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Currently On Duty
                  </CardTitle>
                  <CardDescription>Guards actively checked in</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeCheckIns.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No guards on duty</p>
                  ) : (
                    <div className="space-y-3">
                      {activeCheckIns.map((checkIn) => (
                        <div 
                          key={checkIn.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border"
                          data-testid={`active-checkin-${checkIn.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={checkIn.user.profileImageUrl || undefined} />
                              <AvatarFallback>
                                {checkIn.user.firstName?.[0]}{checkIn.user.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {checkIn.user.firstName} {checkIn.user.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {checkIn.site.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="default" className="bg-chart-2">Active</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(checkIn.checkInTime), "HH:mm")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity Feed */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
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
                      {recentActivity.slice(0, 10).map((checkIn) => (
                        <div 
                          key={checkIn.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border text-sm"
                          data-testid={`activity-${checkIn.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">
                              {checkIn.user.firstName} {checkIn.user.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {checkIn.site.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              In: {format(new Date(checkIn.checkInTime), "MMM d, HH:mm")}
                              {checkIn.checkOutTime && ` • Out: ${format(new Date(checkIn.checkOutTime), "HH:mm")}`}
                            </p>
                          </div>
                          <Badge variant={checkIn.status === 'active' ? 'default' : 'secondary'}>
                            {checkIn.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="billing">
            <BillingReports />
          </TabsContent>

          <TabsContent value="reports">
            <AdvancedReports />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleManagement />
          </TabsContent>

          <TabsContent value="guards">
            <GuardDirectory />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="invitations">
            <InvitationManagement />
          </TabsContent>

          <TabsContent value="manual">
            <AdminCheckInControl />
          </TabsContent>

          <TabsContent value="sites">
            <SiteManagement />
          </TabsContent>

          <TabsContent value="leave">
            <AdminLeaveManagement />
          </TabsContent>

          <TabsContent value="approvals">
            <AdminApprovals />
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>All Activity</CardTitle>
                <CardDescription>Complete check-in and check-out history</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No activity to display</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.map((checkIn) => (
                      <div 
                        key={checkIn.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover-elevate"
                        data-testid={`full-activity-${checkIn.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={checkIn.user.profileImageUrl || undefined} />
                            <AvatarFallback>
                              {checkIn.user.firstName?.[0]}{checkIn.user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {checkIn.user.firstName} {checkIn.user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {checkIn.site.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-mono">
                              {format(new Date(checkIn.checkInTime), "MMM d, HH:mm")}
                              {checkIn.checkOutTime && ` - ${format(new Date(checkIn.checkOutTime), "HH:mm")}`}
                            </p>
                            <Badge variant={checkIn.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                              {checkIn.status}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingCheckIn(checkIn);
                              setIsEditDialogOpen(true);
                            }}
                            data-testid={`button-edit-checkin-${checkIn.id}`}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Check-In Dialog */}
      <EditCheckInDialog
        checkIn={editingCheckIn}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingCheckIn(null);
        }}
      />
    </div>
  );
}
