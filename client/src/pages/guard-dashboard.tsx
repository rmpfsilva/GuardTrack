import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  Clock, 
  MapPin, 
  LogOut, 
  LogIn, 
  Calendar, 
  Settings, 
  Coffee, 
  Info,
  CalendarDays,
  Timer,
  Palmtree,
  Bell,
  ChevronRight,
  Loader2,
  User
} from "lucide-react";
import { Link, useLocation } from "wouter";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationSettingsButton } from "@/components/notification-settings-button";
import { Skeleton } from "@/components/ui/skeleton";
import MySchedule from "@/components/my-schedule";
import LeaveRequestForm from "@/components/leave-request-form";
import GuardNoticeBoard from "@/components/guard-notice-board";
import type { Site, CheckIn, CheckInWithDetails, Break } from "@shared/schema";

interface MonthlyHoursData {
  hours: number;
  year: number;
  month: number;
}

interface LeaveBalanceData {
  usedDays: number;
  pendingDays: number;
  totalEntitlement: number;
  year: number;
}

export default function GuardDashboard() {
  const { user, isLoading: authLoading, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("guard");

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
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!user,
  });

  const { data: activeCheckIn, isLoading: checkInLoading } = useQuery<CheckInWithDetails | null>({
    queryKey: ["/api/check-ins/active"],
    enabled: !!user,
  });

  const { data: recentCheckIns = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/check-ins/my-recent"],
    enabled: !!user,
  });

  const { data: activeBreak } = useQuery<Break | null>({
    queryKey: ["/api/breaks/active"],
    enabled: !!user && !!activeCheckIn,
  });

  const { data: monthlyHours, isLoading: hoursLoading } = useQuery<MonthlyHoursData>({
    queryKey: ["/api/user/monthly-hours"],
    enabled: !!user,
  });

  const { data: leaveBalance, isLoading: leaveLoading } = useQuery<LeaveBalanceData>({
    queryKey: ["/api/user/leave-balance"],
    enabled: !!user,
  });

  // Fetch company name for the header (using guard-safe endpoint)
  const { data: company } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/companies/my-company"],
    queryFn: async () => {
      const res = await fetch('/api/companies/my-company', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.companyId,
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: { siteId: string; latitude?: string; longitude?: string; workingRole?: string }) => {
      return await apiRequest("POST", "/api/check-ins", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/my-recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/monthly-hours"] });
      toast({
        title: "Checked In",
        description: "You have successfully checked in to your shift.",
      });
      setSelectedSiteId("");
      setSelectedRole("guard");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Check-In Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (checkInId: string) => {
      return await apiRequest("PATCH", `/api/check-ins/${checkInId}/checkout`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/my-recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/monthly-hours"] });
      toast({
        title: "Checked Out",
        description: "You have successfully checked out from your shift.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Check-Out Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startBreakMutation = useMutation({
    mutationFn: async (data: { latitude?: string; longitude?: string }) => {
      return await apiRequest("POST", "/api/breaks/start", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breaks/active"] });
      toast({
        title: "Break Started",
        description: "Your break has been recorded. Remember, breaks are unpaid.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Break Start Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const endBreakMutation = useMutation({
    mutationFn: async (data: { breakId: string; latitude?: string; longitude?: string }) => {
      return await apiRequest("PATCH", `/api/breaks/${data.breakId}/end`, {
        latitude: data.latitude,
        longitude: data.longitude,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/breaks/active"] });
      toast({
        title: "Break Ended",
        description: "Welcome back! Your break time has been recorded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Break End Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCheckIn = () => {
    if (!selectedSiteId) {
      toast({
        title: "Site Required",
        description: "Please select a site before checking in.",
        variant: "destructive",
      });
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkInMutation.mutate({
            siteId: selectedSiteId,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
            workingRole: selectedRole,
          });
        },
        (error) => {
          toast({
            title: "Location Access Denied",
            description: "Checking in without location verification.",
            variant: "default",
          });
          checkInMutation.mutate({ siteId: selectedSiteId, workingRole: selectedRole });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast({
        title: "Location Not Supported",
        description: "Your device doesn't support location services.",
        variant: "default",
      });
      checkInMutation.mutate({ siteId: selectedSiteId, workingRole: selectedRole });
    }
  };

  const handleCheckOut = () => {
    if (activeCheckIn) {
      checkOutMutation.mutate(activeCheckIn.id);
    }
  };

  const handleStartBreak = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          startBreakMutation.mutate({
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });
        },
        () => {
          startBreakMutation.mutate({});
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      startBreakMutation.mutate({});
    }
  };

  const handleEndBreak = () => {
    if (!activeBreak) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          endBreakMutation.mutate({
            breakId: activeBreak.id,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });
        },
        () => {
          endBreakMutation.mutate({ breakId: activeBreak.id });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      endBreakMutation.mutate({ breakId: activeBreak.id });
    }
  };

  if (authLoading || !user) {
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
    return user.email?.[0]?.toUpperCase() || "U";
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getMonthName = (month: number) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  };

  const remainingLeave = leaveBalance ? leaveBalance.totalEntitlement - leaveBalance.usedDays : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-muted z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={guardTrackLogo} alt="GuardTrack" className="h-8" data-testid="img-company-logo" />
            <span className="text-lg font-semibold" data-testid="text-company-name">{company?.name || 'GuardTrack'}</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationSettingsButton variant="ghost" size="icon" />
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
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
              onClick={async () => {
                await logoutMutation.mutateAsync();
                setLocation('/auth');
              }}
              data-testid="button-logout"
            >
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
              <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-welcome-message">
                {getGreeting()}, {user.firstName || 'there'}!
              </h1>
              <p className="text-muted-foreground">
                {format(currentTime, "EEEE, MMMM d, yyyy")} | <span className="font-mono">{format(currentTime, "HH:mm")}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card data-testid="card-monthly-hours">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Monthly Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hoursLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <p className="text-3xl font-bold" data-testid="text-monthly-hours">
                    {(monthlyHours?.hours ?? 0).toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    hours in {monthlyHours ? getMonthName(monthlyHours.month) : getMonthName(currentTime.getMonth() + 1)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-leave-balance">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Palmtree className="h-4 w-4" />
                Annual Leave
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaveLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <p className="text-3xl font-bold" data-testid="text-leave-remaining">
                    {remainingLeave}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    days remaining of {leaveBalance?.totalEntitlement || 28}
                    {leaveBalance && leaveBalance.pendingDays > 0 && (
                      <span className="text-amber-600 dark:text-amber-400"> ({leaveBalance.pendingDays} pending)</span>
                    )}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-upcoming-events">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-muted-foreground italic" data-testid="text-no-events">
                No upcoming events
              </p>
              <p className="text-sm text-muted-foreground">
                Events will appear here
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeCheckIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              {activeCheckIn ? "Currently On Duty" : "Start Your Shift"}
            </CardTitle>
            <CardDescription>
              {activeCheckIn 
                ? `Checked in at ${activeCheckIn.site.name}` 
                : "Select a site and check in to begin your shift"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeCheckIn ? (
              <>
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">{activeCheckIn.site.name}</p>
                    <p className="text-sm text-muted-foreground">{activeCheckIn.site.address}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Checked in at {format(new Date(activeCheckIn.checkInTime), "HH:mm")}
                    </p>
                  </div>
                  <Badge variant="default" className="bg-chart-2">Active</Badge>
                </div>
                <Button 
                  onClick={handleCheckOut}
                  disabled={checkOutMutation.isPending}
                  className="w-full h-14 text-lg"
                  variant="destructive"
                  data-testid="button-check-out"
                >
                  {checkOutMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking Out...
                    </>
                  ) : "Check Out"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Site</label>
                  <Select 
                    value={selectedSiteId} 
                    onValueChange={setSelectedSiteId}
                    disabled={sitesLoading}
                  >
                    <SelectTrigger className="h-12" data-testid="select-site">
                      <SelectValue placeholder="Choose a site..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id} data-testid={`select-option-${site.id}`}>
                          {site.name} - {site.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Working Role</label>
                  <Select 
                    value={selectedRole} 
                    onValueChange={setSelectedRole}
                  >
                    <SelectTrigger className="h-12" data-testid="select-role">
                      <SelectValue placeholder="Choose your role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guard" data-testid="select-option-guard">
                        Guard
                      </SelectItem>
                      <SelectItem value="steward" data-testid="select-option-steward">
                        Steward
                      </SelectItem>
                      <SelectItem value="supervisor" data-testid="select-option-supervisor">
                        Supervisor
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Location Sharing:</strong> When you check in, check out, or manage breaks, your device location will be shared with the company for shift verification and attendance tracking purposes.
                  </AlertDescription>
                </Alert>

                <Button 
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending || !selectedSiteId}
                  className="w-full h-14 text-lg"
                  data-testid="button-check-in"
                >
                  {checkInMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Checking In...
                    </>
                  ) : "Check In"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {activeCheckIn && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coffee className="h-5 w-5" />
                Break Management
              </CardTitle>
              <CardDescription>
                Unpaid breaks are tracked separately from your shift hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeBreak ? (
                <>
                  <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <Coffee className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-900 dark:text-amber-100">On Break</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        Started at {format(new Date(activeBreak.breakStartTime), "HH:mm")}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        Break time is not included in your paid hours
                      </p>
                    </div>
                    <Badge className="bg-amber-500">Break</Badge>
                  </div>
                  <Button 
                    onClick={handleEndBreak}
                    disabled={endBreakMutation.isPending}
                    className="w-full h-12"
                    variant="default"
                    data-testid="button-end-break"
                  >
                    {endBreakMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ending Break...
                      </>
                    ) : "End Break"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      You can take a break anytime during your shift. Break time will be automatically deducted from your total hours.
                    </p>
                  </div>
                  <Button 
                    onClick={handleStartBreak}
                    disabled={startBreakMutation.isPending}
                    className="w-full h-12"
                    variant="outline"
                    data-testid="button-start-break"
                  >
                    {startBreakMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting Break...
                      </>
                    ) : "Start Break"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <MySchedule />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <LeaveRequestForm />
            </CardContent>
          </Card>
        </div>

        <GuardNoticeBoard />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Shifts
            </CardTitle>
            <CardDescription>Your latest check-in activity</CardDescription>
          </CardHeader>
          <CardContent>
            {checkInLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : recentCheckIns.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-muted-foreground">No recent shifts</p>
                <p className="text-sm text-muted-foreground mt-1">Your shift history will appear here once you check in</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCheckIns.slice(0, 5).map((checkIn) => (
                  <div 
                    key={checkIn.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover-elevate"
                    data-testid={`shift-${checkIn.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="font-medium text-sm">{checkIn.site.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(checkIn.checkInTime), "MMM d, HH:mm")}
                          {checkIn.checkOutTime && ` - ${format(new Date(checkIn.checkOutTime), "HH:mm")}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={checkIn.status === 'active' ? 'default' : 'secondary'}>
                      {checkIn.status}
                    </Badge>
                  </div>
                ))}
                {recentCheckIns.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    Showing 5 of {recentCheckIns.length} recent shifts
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
