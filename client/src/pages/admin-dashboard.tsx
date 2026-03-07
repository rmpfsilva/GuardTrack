import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures, AdminTab } from "@/hooks/use-plan-features";
import { format } from "date-fns";
import {
  Users, MapPin, Clock, Activity, Calendar, Settings, Mail, RefreshCw,
  LayoutDashboard, UserCog, CalendarOff, CheckSquare, ClipboardEdit, Megaphone,
  Handshake, Share2, Receipt, CreditCard, BarChart3, MessageSquare,
  Building2, AlertTriangle, FileText, DollarSign, Shield, LogOut, Smartphone
} from "lucide-react";
import { useLocation } from "wouter";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationSettingsButton } from "@/components/notification-settings-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LocationDisplay } from "@/components/location-display";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import type { Site, CheckInWithDetails, User, Company, LeaveRequestWithDetails, SupportMessage, ErrorLog, CompanyPartnershipWithDetails, JobShareWithDetails } from "@shared/schema";
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
import { useBackground } from "@/components/background-provider";
import NoticeBoardManagement from "@/components/notice-board-management";
import CompanyPartnerships from "@/components/company-partnerships";
import JobSharing from "@/components/job-sharing";
import ClientManagement from "@/components/client-management";
import ClientUsageReports from "@/components/client-usage-reports";
import SupportMessages from "@/components/support-messages";
import CompanySupportMessages from "@/components/company-support-messages";
import SubscriptionBilling from "@/components/subscription-billing";
import InvoiceManagement from "@/components/invoice-management";
import CompanyInvoices from "@/components/company-invoices";
import ErrorLogs from "@/components/error-logs";
import { PlanManagement } from "@/components/plan-management";
import PlatformSettings from "@/components/platform-settings";
import SuperAdminUserManagement from "@/components/super-admin-user-management";
import AuthActivityLogs from "@/components/auth-activity-logs";
import SuperAdminCreateUser from "@/components/super-admin-create-user";
import StaffInvoiceManagement from "@/components/staff-invoice-management";
import { CompanyStripeSettings } from "@/components/stripe-connect-settings";
import { XeroSettings } from "@/components/xero-connect-settings";
import OperationsCommandCentre from "@/components/operations-command-centre";
import { AppInstallSettings } from "@/components/app-install-settings";

export default function AdminDashboard() {
  const { user, isLoading: authLoading, isAdmin, logoutMutation } = useAuth();
  const { toast } = useToast();
  const { hasTabAccess, getAccessibleTabs, planTier, isLoading: planLoading } = usePlanFeatures();
  const { hasCustomBackground } = useBackground();
  const [, setLocation] = useLocation();
  const [editingCheckIn, setEditingCheckIn] = useState<CheckInWithDetails | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };
  const [activeTab, setActiveTab] = useState<string>(user?.role === 'super_admin' ? 'clients' : 'overview');
  const [jobSharingLastSeen, setJobSharingLastSeen] = useState<Date>(() => {
    const stored = localStorage.getItem('jobSharingLastSeen');
    return stored ? new Date(stored) : new Date(0);
  });

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'super_admin' && activeTab === 'overview') {
        setActiveTab('clients');
      }
    }
  }, [authLoading, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const xero = params.get('xero');
    if (tab) {
      setActiveTab(tab);
    }
    if (xero === 'connected') {
      toast({ title: "Xero Connected", description: "Your Xero account has been connected successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/xero/status"] });
    } else if (xero === 'error') {
      toast({ title: "Xero Connection Failed", description: "There was an error connecting your Xero account. Please try again.", variant: "destructive" });
    }
    if (tab || xero) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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

  const isCompanyAdmin = isAdmin && user?.role !== 'super_admin';
  
  const { data: recentActivity = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/admin/recent-activity"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: userCompany } = useQuery<Company>({
    queryKey: ['/api/companies', user?.companyId],
    queryFn: async () => {
      if (!user?.companyId) throw new Error('No company ID');
      const res = await fetch(`/api/companies/${user.companyId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch company');
      return res.json();
    },
    enabled: !!user?.companyId && isAdmin && user?.role !== 'super_admin',
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

  const { data: supportMessages = [] } = useQuery<SupportMessage[]>({
    queryKey: ["/api/super-admin/support-messages"],
    enabled: !!user && user?.role === 'super_admin',
    refetchInterval: 30000,
  });

  const { data: errorLogs = [] } = useQuery<ErrorLog[]>({
    queryKey: ["/api/super-admin/error-logs"],
    enabled: !!user && user?.role === 'super_admin',
    refetchInterval: 30000,
  });

  const { data: receivedPartnerships = [] } = useQuery<CompanyPartnershipWithDetails[]>({
    queryKey: ["/api/partnerships/received"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: receivedJobShares = [] } = useQuery<JobShareWithDetails[]>({
    queryKey: ["/api/job-shares/received"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const { data: offeredJobShares = [] } = useQuery<JobShareWithDetails[]>({
    queryKey: ["/api/job-shares/offered"],
    enabled: !!user && isCompanyAdmin,
    refetchInterval: 30000,
  });

  const tabHasNew = (tabValue: string): boolean => {
    if (activeTab === tabValue) return false;
    
    switch (tabValue) {
      case 'leave':
        return pendingLeave.length > 0;
      case 'approvals':
        return pendingBreaks.length > 0 || pendingOvertime.length > 0;
      case 'messages':
        return supportMessages.filter(m => !m.isRead).length > 0;
      case 'error-logs':
        return errorLogs.filter(e => !e.isResolved).length > 0;
      case 'partnerships':
        return receivedPartnerships.filter(p => p.status === 'pending').length > 0;
      case 'job-sharing': {
        const hasPendingReceived = receivedJobShares.filter(j => j.status === 'pending').length > 0;
        const hasUnseenAccepted = offeredJobShares.filter(j => {
          if (j.status !== 'accepted' || !j.reviewedAt) return false;
          const reviewedAt = new Date(j.reviewedAt);
          return reviewedAt > jobSharingLastSeen;
        }).length > 0;
        return hasPendingReceived || hasUnseenAccepted;
      }
      default:
        return false;
    }
  };

  if (authLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <img src={guardTrackLogo} alt="GuardTrack" className="h-16 mx-auto mb-4 animate-pulse" />
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

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'job-sharing') {
      const now = new Date();
      setJobSharingLastSeen(now);
      localStorage.setItem('jobSharingLastSeen', now.toISOString());
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OperationsCommandCentre onNavigate={handleTabChange} />;
      case 'billing':
        return (
          <div className="space-y-6">
            <CompanyStripeSettings />
            <XeroSettings />
            <BillingReports />
          </div>
        );
      case 'company-invoices':
        return <CompanyInvoices />;
      case 'reports':
        return <AdvancedReports />;
      case 'schedule':
        return <ScheduleManagement />;
      case 'guards':
        return <GuardDirectory />;
      case 'users':
        return <UserManagement />;
      case 'invitations':
        return <InvitationManagement />;
      case 'manual':
        return <AdminCheckInControl />;
      case 'sites':
        return <SiteManagement />;
      case 'leave':
        return <AdminLeaveManagement />;
      case 'approvals':
        return <AdminApprovals />;
      case 'notices':
        return <NoticeBoardManagement />;
      case 'partnerships':
        return <CompanyPartnerships />;
      case 'job-sharing':
        return <JobSharing />;
      case 'staff-invoices':
        return <StaffInvoiceManagement />;
      case 'clients':
        return <ClientManagement />;
      case 'all-users':
        return <SuperAdminUserManagement />;
      case 'plans':
        return <PlanManagement />;
      case 'usage-reports':
        return <ClientUsageReports />;
      case 'subscription-billing':
        return <SubscriptionBilling />;
      case 'invoices':
        return <InvoiceManagement />;
      case 'messages':
        return <SupportMessages />;
      case 'auth-activity':
        return (
          <div className="space-y-6">
            <SuperAdminCreateUser />
            <AuthActivityLogs />
          </div>
        );
      case 'error-logs':
        return <ErrorLogs />;
      case 'platform-settings':
        return <PlatformSettings />;
      case 'activity':
        return (
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
                      className="p-4 rounded-lg border border-border hover-elevate space-y-2"
                      data-testid={`full-activity-${checkIn.id}`}
                    >
                      <div className="flex items-center justify-between">
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
                      <LocationDisplay 
                        latitude={checkIn.latitude}
                        longitude={checkIn.longitude}
                        className="text-xs"
                        showLabel={false}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 'support':
        return (
          <div className="space-y-6">
            <CompanySupportMessages />
          </div>
        );
      case 'app-install':
        return <AppInstallSettings />;
      default:
        return null;
    }
  };

  const renderSidebarItem = (value: string, label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <SidebarMenuItem key={value}>
      <SidebarMenuButton
        data-active={activeTab === value}
        data-testid={`tab-${value}`}
        tooltip={label}
        onClick={() => handleTabChange(value)}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        {tabHasNew(value) && (
          <span className="ml-auto h-2 w-2 rounded-full bg-destructive flex-shrink-0" />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className={`flex h-screen w-full ${hasCustomBackground ? 'bg-transparent' : 'bg-background'}`}>
        <Sidebar collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-1">
              <img src={guardTrackLogo} alt="GuardTrack" className="h-7 w-7 flex-shrink-0" data-testid="img-company-logo" />
              <span className="text-sm font-semibold truncate group-data-[collapsible=icon]:hidden">
                {user.role === 'super_admin' ? 'Platform Admin' : (userCompany?.name || 'GuardTrack')}
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent>
            {user.role === 'super_admin' ? (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Shield className="h-4 w-4 mr-2" />
                    Platform
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {renderSidebarItem('clients', 'Clients', Building2)}
                      {renderSidebarItem('all-users', 'Users', Users)}
                      {renderSidebarItem('plans', 'Plans', CreditCard)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Communication
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {renderSidebarItem('messages', 'Messages', MessageSquare)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Finance
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {renderSidebarItem('subscription-billing', 'Billing', CreditCard)}
                      {renderSidebarItem('invoices', 'Invoices', FileText)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {renderSidebarItem('usage-reports', 'Usage Reports', BarChart3)}
                      {renderSidebarItem('auth-activity', 'Auth Logs', Shield)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Settings className="h-4 w-4 mr-2" />
                    System
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {renderSidebarItem('invitations', 'Invites', Mail)}
                      {renderSidebarItem('error-logs', 'Error Logs', AlertTriangle)}
                      {renderSidebarItem('platform-settings', 'Settings', Settings)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            ) : (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Command Centre
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {hasTabAccess('overview') && renderSidebarItem('overview', 'Overview', LayoutDashboard)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Users className="h-4 w-4 mr-2" />
                    Workforce
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {hasTabAccess('guards') && renderSidebarItem('guards', 'Employees', Users)}
                      {hasTabAccess('users') && renderSidebarItem('users', 'Users', UserCog)}
                      {hasTabAccess('leave') && renderSidebarItem('leave', 'Leave', CalendarOff)}
                      {hasTabAccess('invitations') && renderSidebarItem('invitations', 'Invites', Mail)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Calendar className="h-4 w-4 mr-2" />
                    Operations
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {hasTabAccess('schedule') && renderSidebarItem('schedule', 'Schedule', Calendar)}
                      {hasTabAccess('sites') && renderSidebarItem('sites', 'Sites', MapPin)}
                      {hasTabAccess('approvals') && renderSidebarItem('approvals', 'Approvals', CheckSquare)}
                      {hasTabAccess('manual') && renderSidebarItem('manual', 'Manual', ClipboardEdit)}
                      {hasTabAccess('notices') && renderSidebarItem('notices', 'Notices', Megaphone)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Handshake className="h-4 w-4 mr-2" />
                    Network
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {hasTabAccess('partnerships') && renderSidebarItem('partnerships', 'Partnerships', Handshake)}
                      {hasTabAccess('job-sharing') && renderSidebarItem('job-sharing', 'Job Sharing', Share2)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Finance
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {renderSidebarItem('staff-invoices', 'Staff Invoices', Receipt)}
                      {renderSidebarItem('company-invoices', 'Invoices', FileText)}
                      {hasTabAccess('billing') && renderSidebarItem('billing', 'Billing', CreditCard)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Insights
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {hasTabAccess('reports') && renderSidebarItem('reports', 'Reports', BarChart3)}
                      {hasTabAccess('activity') && renderSidebarItem('activity', 'Activity', Activity)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                  <SidebarGroupLabel>
                    <Settings className="h-4 w-4 mr-2" />
                    System
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem key="settings-link">
                        <SidebarMenuButton
                          data-testid="tab-settings"
                          tooltip="Settings"
                          onClick={() => setLocation('/settings')}
                        >
                          <Settings className="h-4 w-4" />
                          <span>Settings</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      {renderSidebarItem('app-install', 'App Install', Smartphone)}
                      {renderSidebarItem('support', 'Support', MessageSquare)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "Admin"} />
                <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium truncate">{user.firstName || user.email}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
              </div>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-testid="button-logout"
                  tooltip="Log Out"
                  onClick={async () => {
                    await logoutMutation.mutateAsync();
                    setLocation('/auth');
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="border-b border-border sticky top-0 bg-muted z-50 h-14 flex items-center justify-between gap-2 px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="text-sm font-semibold hidden sm:inline">Operations Command Centre</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-admin"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <NotificationSettingsButton variant="ghost" size="icon" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-avatar-menu">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "Admin"} />
                      <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={async () => {
                      await logoutMutation.mutateAsync();
                      setLocation('/auth');
                    }}
                    data-testid="button-logout-header"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            {renderContent()}
          </main>
        </div>
      </div>

      <EditCheckInDialog
        checkIn={editingCheckIn}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingCheckIn(null);
        }}
      />
    </SidebarProvider>
  );
}
