import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  Clock, MapPin, LogIn, LogOut, Calendar, Bell, User, 
  Home, Coffee, FileText, ChevronRight, Loader2, AlertCircle,
  CheckCircle2, XCircle, Download, X, Share, Smartphone
} from "lucide-react";
import { useLocation } from "wouter";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MySchedule from "@/components/my-schedule";
import LeaveRequestForm from "@/components/leave-request-form";
import GuardNoticeBoard from "@/components/guard-notice-board";
import type { Site, CheckInWithDetails, Break, LeaveRequest } from "@shared/schema";

type TabType = "home" | "schedule" | "leave" | "notices";

export default function GuardApp() {
  const { user, isLoading: authLoading, logoutMutation, loginMutation } = useAuth();
  const { toast } = useToast();
  const { isInstallable, isInstalled, isIOS, isAndroid, installApp } = useInstallPWA();
  const [, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("guard");
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied" | "unavailable">("pending");
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginCompanyId, setLoginCompanyId] = useState<string>("");
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Fetch companies for login dropdown
  type LoginCompany = { id: string; name: string; companyId: string };
  const { data: loginCompanies = [], isLoading: companiesLoading } = useQuery<LoginCompany[]>({
    queryKey: ["/api/companies/for-login"],
    enabled: !user, // Only fetch when not logged in
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.permissions?.query({ name: "geolocation" }).then((result) => {
        setLocationStatus(result.state === "granted" ? "granted" : result.state === "denied" ? "denied" : "pending");
      });
    } else {
      setLocationStatus("unavailable");
    }
  }, []);

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!user,
  });

  const { data: activeCheckIn, isLoading: checkInLoading } = useQuery<CheckInWithDetails | null>({
    queryKey: ["/api/check-ins/active"],
    enabled: !!user,
  });

  const { data: activeBreak } = useQuery<Break | null>({
    queryKey: ["/api/breaks/active"],
    enabled: !!user && !!activeCheckIn,
  });

  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests/my"],
    enabled: !!user,
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: { siteId: string; latitude?: string; longitude?: string; workingRole?: string }) => {
      return await apiRequest("POST", "/api/check-ins", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/my-recent"] });
      toast({
        title: "Checked In",
        description: "You have successfully checked in.",
      });
      setSelectedSiteId("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/auth";
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
      toast({
        title: "Checked Out",
        description: "You have successfully checked out.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        window.location.href = "/auth";
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
        description: "Your break has been recorded.",
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
        description: "Welcome back!",
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
        description: "Please select a site.",
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
        () => {
          checkInMutation.mutate({ siteId: selectedSiteId, workingRole: selectedRole });
        },
        { timeout: 5000 }
      );
    } else {
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
        { timeout: 5000 }
      );
    } else {
      startBreakMutation.mutate({});
    }
  };

  const handleEndBreak = () => {
    if (activeBreak) {
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
          { timeout: 5000 }
        );
      } else {
        endBreakMutation.mutate({ breakId: activeBreak.id });
      }
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Guards always login to a company, so companyId is required
    loginMutation.mutate({ 
      username: loginUsername, 
      password: loginPassword, 
      companyId: loginCompanyId || null 
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show login page when not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1e3a5f] via-[#2d4a6f] to-background flex flex-col">
        {/* Header */}
        <header className="bg-primary text-primary-foreground px-4 py-6 shadow-lg">
          <div className="flex flex-col items-center gap-3">
            <img src={guardTrackLogo} alt="GuardTrack" className="h-16 w-16" />
            <div className="text-center">
              <h1 className="text-2xl font-bold">GuardTrack</h1>
              <p className="text-sm opacity-90">Security Guard Management</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center p-4 overflow-auto">
          {/* App Info Section */}
          <div className="w-full max-w-sm mb-6 text-center text-white/90">
            <p className="text-sm leading-relaxed">
              The complete mobile app for security guards to manage shifts, 
              track attendance, and stay connected with your team.
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="w-full max-w-sm mb-6 grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-white" />
              <p className="text-xs font-medium text-white">Check In/Out</p>
              <p className="text-xs text-white/70">GPS verified attendance</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
              <Calendar className="h-6 w-6 mx-auto mb-2 text-white" />
              <p className="text-xs font-medium text-white">View Schedule</p>
              <p className="text-xs text-white/70">See your shifts & rota</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
              <FileText className="h-6 w-6 mx-auto mb-2 text-white" />
              <p className="text-xs font-medium text-white">Leave Requests</p>
              <p className="text-xs text-white/70">Request time off easily</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
              <Bell className="h-6 w-6 mx-auto mb-2 text-white" />
              <p className="text-xs font-medium text-white">Notifications</p>
              <p className="text-xs text-white/70">Stay updated on notices</p>
            </div>
          </div>

          {/* PWA Install Section */}
          {isInstallable && !isInstalled && (
            <Card className="w-full max-w-sm mb-6 border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Install GuardTrack App</p>
                    <p className="text-xs text-muted-foreground">
                      {isIOS ? "Add to your home screen for quick access" : "Install for offline access & notifications"}
                    </p>
                  </div>
                </div>
                
                {isIOS ? (
                  <div className="mt-4">
                    <Button 
                      className="w-full" 
                      onClick={() => setShowIOSInstructions(!showIOSInstructions)}
                      data-testid="button-ios-install-instructions"
                    >
                      <Share className="h-4 w-4 mr-2" />
                      How to Install
                    </Button>
                    
                    {showIOSInstructions && (
                      <div className="mt-4 p-4 bg-background rounded-lg border">
                        <p className="font-medium text-sm mb-3">To install on iPhone/iPad:</p>
                        <ol className="text-sm space-y-2 text-muted-foreground">
                          <li className="flex items-start gap-2">
                            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                            <span>Tap the <Share className="h-4 w-4 inline" /> Share button in Safari</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                            <span>Scroll down and tap "Add to Home Screen"</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                            <span>Tap "Add" to install the app</span>
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button 
                    className="w-full mt-4" 
                    onClick={installApp}
                    data-testid="button-install-pwa-login"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Install App
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Already installed badge */}
          {isInstalled && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>App installed on your device</span>
            </div>
          )}

          {/* Login Form */}
          <Card className="w-full max-w-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-xl text-center">Sign In</CardTitle>
              <CardDescription className="text-center">
                Enter your credentials to access your shifts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Your Company</Label>
                  <Select
                    value={loginCompanyId}
                    onValueChange={setLoginCompanyId}
                  >
                    <SelectTrigger 
                      id="company"
                      data-testid="select-guard-company"
                      className="w-full"
                    >
                      <SelectValue placeholder={companiesLoading ? "Loading..." : "Select your company"} />
                    </SelectTrigger>
                    <SelectContent>
                      {loginCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                    data-testid="input-guard-username"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    data-testid="input-guard-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-guard-login"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground mt-4">
                Contact your administrator if you need an account
              </p>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="p-4 text-center text-xs text-muted-foreground">
          GuardTrack Security Management System
        </footer>
      </div>
    );
  }

  const userInitials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'G';

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={guardTrackLogo} alt="GuardTrack" className="h-8 w-8" />
            <div>
              <h1 className="text-lg font-bold">GuardTrack</h1>
              <p className="text-xs opacity-80">{format(currentTime, "EEE, MMM d • h:mm a")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border-2 border-primary-foreground/30">
              <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-sm">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {isInstallable && !isInstalled && showInstallBanner && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Install GuardTrack</p>
                <p className="text-xs text-muted-foreground">Quick access from home screen</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={installApp}
                data-testid="button-install-pwa"
              >
                Install
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8"
                onClick={() => setShowInstallBanner(false)}
                data-testid="button-dismiss-install"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto pb-20">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="h-full">
          <div className="p-4">
              <TabsContent value="home" className="mt-0 space-y-4">
                <div className="text-center mb-4">
                  <p className="text-muted-foreground">Hello,</p>
                  <h2 className="text-2xl font-bold" data-testid="text-user-name">
                    {user.firstName} {user.lastName}
                  </h2>
                </div>

                {locationStatus === "denied" && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Location access is denied. Check-ins may not include location data.
                    </AlertDescription>
                  </Alert>
                )}

                {activeCheckIn ? (
                  <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          Currently Checked In
                        </CardTitle>
                        {activeBreak && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <Coffee className="h-3 w-3 mr-1" /> On Break
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{activeCheckIn.site?.name || "Unknown Site"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Since {format(new Date(activeCheckIn.checkInTime), "h:mm a")}</span>
                      </div>

                      {activeBreak ? (
                        <Button 
                          onClick={handleEndBreak}
                          disabled={endBreakMutation.isPending}
                          className="w-full h-14 text-lg"
                          variant="secondary"
                          data-testid="button-end-break"
                        >
                          {endBreakMutation.isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          ) : (
                            <Coffee className="h-5 w-5 mr-2" />
                          )}
                          End Break
                        </Button>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <Button 
                            onClick={handleStartBreak}
                            disabled={startBreakMutation.isPending}
                            variant="outline"
                            className="h-14"
                            data-testid="button-start-break"
                          >
                            {startBreakMutation.isPending ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <>
                                <Coffee className="h-5 w-5 mr-2" />
                                Break
                              </>
                            )}
                          </Button>
                          <Button 
                            onClick={handleCheckOut}
                            disabled={checkOutMutation.isPending}
                            variant="destructive"
                            className="h-14"
                            data-testid="button-check-out"
                          >
                            {checkOutMutation.isPending ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <>
                                <LogOut className="h-5 w-5 mr-2" />
                                Check Out
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                        Not Checked In
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Site</label>
                        <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                          <SelectTrigger data-testid="select-site">
                            <SelectValue placeholder="Choose your site" />
                          </SelectTrigger>
                          <SelectContent>
                            {sites.map((site) => (
                              <SelectItem key={site.id} value={site.id}>
                                {site.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Your Role</label>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="guard">Guard</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="steward">Steward</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        onClick={handleCheckIn}
                        disabled={checkInMutation.isPending || !selectedSiteId}
                        className="w-full h-16 text-xl font-bold"
                        data-testid="button-check-in"
                      >
                        {checkInMutation.isPending ? (
                          <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        ) : (
                          <LogIn className="h-6 w-6 mr-2" />
                        )}
                        CHECK IN
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setActiveTab("schedule")}
                  data-testid="card-quick-schedule"
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">View My Schedule</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setActiveTab("notices")}
                  data-testid="card-quick-notices"
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Bell className="h-5 w-5 text-amber-600" />
                      </div>
                      <span className="font-medium">Notice Board</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setActiveTab("leave")}
                  data-testid="card-quick-leave"
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <span className="font-medium">Leave Requests</span>
                        {leaveRequests.filter(r => r.status === 'pending').length > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {leaveRequests.filter(r => r.status === 'pending').length} pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>

                <Button 
                  variant="ghost" 
                  className="w-full text-muted-foreground"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </TabsContent>

              <TabsContent value="schedule" className="mt-0">
                <h2 className="text-xl font-bold mb-4">My Schedule</h2>
                <MySchedule />
              </TabsContent>

              <TabsContent value="leave" className="mt-0 space-y-4">
                <h2 className="text-xl font-bold mb-4">Leave Requests</h2>
                <LeaveRequestForm />
                
                {leaveRequests.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <h3 className="font-semibold text-muted-foreground">Your Requests</h3>
                    {leaveRequests.map((request) => (
                      <Card key={request.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">Leave Request</span>
                            <Badge variant={
                              request.status === 'approved' ? 'default' :
                              request.status === 'rejected' ? 'destructive' : 'secondary'
                            }>
                              {request.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(request.startDate), "MMM d")} - {format(new Date(request.endDate), "MMM d, yyyy")}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notices" className="mt-0">
                <h2 className="text-xl font-bold mb-4">Notice Board</h2>
                <GuardNoticeBoard />
              </TabsContent>
            </div>

          <TabsList className="fixed bottom-0 left-0 right-0 h-16 grid grid-cols-4 rounded-none border-t bg-background shadow-lg z-50">
            <TabsTrigger 
              value="home" 
              className="flex flex-col gap-1 h-full data-[state=active]:bg-primary/10"
              data-testid="tab-home"
            >
              <Home className="h-5 w-5" />
              <span className="text-xs">Home</span>
            </TabsTrigger>
            <TabsTrigger 
              value="schedule" 
              className="flex flex-col gap-1 h-full data-[state=active]:bg-primary/10"
              data-testid="tab-schedule"
            >
              <Calendar className="h-5 w-5" />
              <span className="text-xs">Schedule</span>
            </TabsTrigger>
            <TabsTrigger 
              value="leave" 
              className="flex flex-col gap-1 h-full data-[state=active]:bg-primary/10"
              data-testid="tab-leave"
            >
              <FileText className="h-5 w-5" />
              <span className="text-xs">Leave</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notices" 
              className="flex flex-col gap-1 h-full data-[state=active]:bg-primary/10"
              data-testid="tab-notices"
            >
              <Bell className="h-5 w-5" />
              <span className="text-xs">Notices</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </main>
    </div>
  );
}
