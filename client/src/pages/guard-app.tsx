import { useEffect, useState, useRef } from "react";
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
  CheckCircle2, XCircle, Download, X, Share, Smartphone, ExternalLink, Youtube, Mail, Copy, RefreshCw, DollarSign
} from "lucide-react";
import { useLocation } from "wouter";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import MySchedule from "@/components/my-schedule";
import LeaveRequestForm from "@/components/leave-request-form";
import GuardNoticeBoard from "@/components/guard-notice-board";
import GuardInvoices from "@/components/guard-invoices";
import { GuardStripeSettings } from "@/components/stripe-connect-settings";
import { useBackground } from "@/components/background-provider";
import { useFeatureAccess, type FeatureName } from "@/hooks/use-feature-access";
import type { Site, CheckInWithDetails, Break, LeaveRequest, GuardAppTab } from "@shared/schema";
import { Shield, Briefcase, Settings as SettingsIcon } from "lucide-react";

type TabType = string;

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Calendar,
  FileText,
  Bell,
  User,
  Shield,
  Clock,
  MapPin,
  Briefcase,
  DollarSign,
  Settings: SettingsIcon,
};

function getTabIcon(iconName: string) {
  const IconComponent = iconMap[iconName] || Home;
  return <IconComponent className="h-5 w-5" />;
}

export default function GuardApp() {
  const { user, isLoading: authLoading, logoutMutation, loginMutation } = useAuth();
  const { toast } = useToast();
  const { isInstallable, isInstalled, isIOS, isAndroid, installApp, hasPrompt, promptShown } = useInstallPWA();
  const { hasCustomBackground } = useBackground();
  const { hasFeature, hasFullAccess } = useFeatureAccess();
  const [, setLocation] = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("guard");
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied" | "unavailable">("pending");
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showInstallOverlay, setShowInstallOverlay] = useState(true);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Check sessionStorage after mount to avoid SSR issues
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setInstallDismissed(sessionStorage.getItem('pwa-install-dismissed') === 'true');
    }
  }, []);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else if (hasPrompt) {
      const installed = await installApp();
      if (installed) {
        setShowInstallOverlay(false);
      }
    }
  };

  const handleDismissInstall = () => {
    setShowInstallOverlay(false);
    setInstallDismissed(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    }
  };

  const shouldShowInstallOverlay = isInstallable && !isInstalled && showInstallOverlay && !installDismissed;

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Company lookup state
  const [companyCode, setCompanyCode] = useState("");
  const [resolvedCompany, setResolvedCompany] = useState<{ id: string; name: string; companyId: string } | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  // Lookup company when code changes (display only — no longer needed for login)
  useEffect(() => {
    const trimmedCode = companyCode.trim();
    if (trimmedCode.length >= 3) {
      setLookupPending(true);
      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/companies/lookup/${encodeURIComponent(trimmedCode)}`);
          if (response.ok) {
            const company = await response.json();
            setResolvedCompany(company);
          } else {
            setResolvedCompany(null);
          }
        } catch {
          setResolvedCompany(null);
        } finally {
          setLookupPending(false);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setResolvedCompany(null);
    }
  }, [companyCode]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    const requestLocationPermission = async () => {
      try {
        const permResult = await navigator.permissions?.query({ name: "geolocation" });
        if (permResult) {
          setLocationStatus(permResult.state === "granted" ? "granted" : permResult.state === "denied" ? "denied" : "pending");

          permResult.onchange = () => {
            setLocationStatus(permResult.state === "granted" ? "granted" : permResult.state === "denied" ? "denied" : "pending");
          };

          if (permResult.state === "prompt") {
            navigator.geolocation.getCurrentPosition(
              () => setLocationStatus("granted"),
              () => setLocationStatus("denied"),
              { enableHighAccuracy: false, timeout: 10000 }
            );
          }
        } else {
          navigator.geolocation.getCurrentPosition(
            () => setLocationStatus("granted"),
            () => setLocationStatus("denied"),
            { enableHighAccuracy: false, timeout: 10000 }
          );
        }
      } catch {
        setLocationStatus("pending");
      }
    };

    requestLocationPermission();
  }, []);

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!user,
  });

  const { data: activeCheckIn, isLoading: checkInLoading } = useQuery<CheckInWithDetails | null>({
    queryKey: ["/api/check-ins/active"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: activeBreak } = useQuery<Break | null>({
    queryKey: ["/api/breaks/active"],
    enabled: !!user && !!activeCheckIn,
    refetchInterval: 30000,
  });

  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests/my"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch configurable tabs
  const { data: guardTabs = [] } = useQuery<GuardAppTab[]>({
    queryKey: ["/api/guard-app-tabs"],
    enabled: !!user,
  });

  // Get visible tabs sorted by order with role and feature filtering
  const visibleTabs = guardTabs
    .filter(tab => {
      // Must be active
      if (!tab.isActive) return false;
      
      // Check role visibility
      const userRole = user?.role || 'guard';
      if (tab.roleVisibility && tab.roleVisibility.length > 0) {
        if (!tab.roleVisibility.includes(userRole)) return false;
      }
      
      // Check feature gate (if tab has a feature gate, user must have that feature)
      if (tab.featureGate) {
        if (!hasFullAccess && !hasFeature(tab.featureGate as FeatureName)) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      const orderA = parseInt(a.sortOrder) || 0;
      const orderB = parseInt(b.sortOrder) || 0;
      return orderA - orderB;
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
    mutationFn: async ({ checkInId, latitude, longitude }: { checkInId: string; latitude?: string; longitude?: string }) => {
      return await apiRequest("PATCH", `/api/check-ins/${checkInId}/checkout`, { latitude, longitude });
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
        (error) => {
          console.warn("Geolocation error on check-in:", error.message);
          toast({
            title: "Location Unavailable",
            description: "Check-in will proceed without location data. Please enable location access in your device settings.",
            variant: "destructive",
          });
          checkInMutation.mutate({ siteId: selectedSiteId, workingRole: selectedRole });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      checkInMutation.mutate({ siteId: selectedSiteId, workingRole: selectedRole });
    }
  };

  const handleCheckOut = () => {
    if (!activeCheckIn) return;
    const checkInId = activeCheckIn.id;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          checkOutMutation.mutate({
            checkInId,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });
        },
        (error) => {
          console.warn("Geolocation error on check-out:", error.message);
          checkOutMutation.mutate({ checkInId });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      checkOutMutation.mutate({ checkInId });
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
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        endBreakMutation.mutate({ breakId: activeBreak.id });
      }
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest('POST', '/api/user/change-password', data);
    },
    onSuccess: () => {
      toast({ title: "Password Changed", description: "Your password has been updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to change password", variant: "destructive" });
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Guards always login to a company, so companyId is required
    loginMutation.mutate({ 
      email: loginEmail,
      password: loginPassword,
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
        {/* Full-screen Install Overlay */}
        {shouldShowInstallOverlay && (
          <div 
            className="fixed inset-0 z-50 bg-gradient-to-b from-primary via-primary/95 to-primary/90 flex flex-col items-center justify-center p-6"
            data-testid="overlay-install-pwa"
          >
            <div className="max-w-sm w-full text-center text-white space-y-6">
              <div className="animate-pulse">
                <div className="h-24 w-24 mx-auto rounded-2xl bg-white/20 flex items-center justify-center shadow-lg">
                  <img src={guardTrackLogo} alt="GuardTrack" className="h-16 w-16" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Install GuardTrack</h1>
                <p className="text-lg text-white/90">
                  Get the best experience with the mobile app
                </p>
              </div>

              <div className="space-y-3 text-left bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Quick check-in & check-out</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Bell className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Push notifications for updates</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Works offline</span>
                </div>
              </div>

              {isIOS ? (
                <div className="space-y-4">
                  <Button 
                    size="lg"
                    variant="secondary"
                    className="w-full text-lg py-6"
                    onClick={() => setShowIOSInstructions(true)}
                    data-testid="button-install-overlay"
                  >
                    <Share className="h-5 w-5 mr-2" />
                    How to Install
                  </Button>
                  
                  {showIOSInstructions && (
                    <div className="bg-white text-foreground rounded-xl p-4 text-left">
                      <p className="font-semibold mb-3">To install on iPhone/iPad:</p>
                      <ol className="text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                          <span>Tap the <Share className="h-4 w-4 inline" /> Share button</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                          <span>Tap "Add to Home Screen"</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                          <span>Tap "Add" to install</span>
                        </li>
                      </ol>
                      <div className="mt-4 pt-3 border-t">
                        <a 
                          href="https://www.youtube.com/watch?v=QpFbExFHXe0" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm"
                          data-testid="link-ios-video-overlay"
                        >
                          <Youtube className="h-5 w-5" />
                          Watch Video Tutorial
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button 
                  size="lg"
                  variant="secondary"
                  className="w-full text-lg py-6"
                  onClick={handleInstallClick}
                  data-testid="button-install-overlay"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Install App
                </Button>
              )}

              <button
                onClick={handleDismissInstall}
                className="text-white/70 text-sm hover:text-white underline"
                data-testid="button-skip-install"
              >
                Continue to web version
              </button>
            </div>
          </div>
        )}

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

          {/* iOS Install Video Link - Always Visible for Sharing */}
          <Card className="w-full max-w-sm mb-6 border-white/20 bg-white/10 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">
                  <Youtube className="h-5 w-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-white">iPhone Install Guide</p>
                  <p className="text-xs text-white/70">Video tutorial for adding to home screen</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a 
                  href="https://www.youtube.com/watch?v=QpFbExFHXe0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full"
                    data-testid="button-watch-ios-video"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Watch
                  </Button>
                </a>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => {
                    navigator.clipboard.writeText("https://www.youtube.com/watch?v=QpFbExFHXe0");
                    toast({ title: "Link copied!", description: "Video link copied to clipboard" });
                  }}
                  data-testid="button-copy-ios-video"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => {
                    const subject = encodeURIComponent("How to Install GuardTrack on iPhone");
                    const body = encodeURIComponent("Watch this video to learn how to install the GuardTrack app on your iPhone:\n\nhttps://www.youtube.com/watch?v=QpFbExFHXe0\n\nThen visit the app at: " + window.location.origin + "/guard/app");
                    window.open(`mailto:?subject=${subject}&body=${body}`);
                  }}
                  data-testid="button-email-ios-video"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardContent>
          </Card>

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
                        <div className="mt-4 pt-3 border-t space-y-2">
                          <a 
                            href="https://www.youtube.com/watch?v=QpFbExFHXe0" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm"
                            data-testid="link-ios-video-card"
                          >
                            <Youtube className="h-5 w-5" />
                            Watch Video Tutorial
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
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
                  <Label htmlFor="companyCode">Company ID</Label>
                  <div className="relative">
                    <Input
                      id="companyCode"
                      type="text"
                      placeholder="e.g., DEMO999"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                      data-testid="input-guard-company-code"
                    />
                    {lookupPending && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {resolvedCompany ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {resolvedCompany.name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Enter your Company ID to sign in
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email or username</Label>
                  <Input
                    id="email"
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Enter your email or username"
                    required
                    data-testid="input-guard-email"
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

  const defaultNavItems = [
    { key: 'home', label: 'Home', icon: 'Home' },
    { key: 'schedule', label: 'Schedule', icon: 'Calendar' },
    { key: 'leave', label: 'Annual Leave', icon: 'FileText' },
    { key: 'notices', label: 'Notice Board', icon: 'Bell' },
    { key: 'invoices', label: 'Invoices', icon: 'DollarSign' },
    { key: 'settings', label: 'Settings', icon: 'Settings' },
  ];

  const navItems = visibleTabs.length > 0
    ? [
        ...visibleTabs.map(tab => ({ key: tab.tabKey, label: tab.label, icon: tab.icon })),
        ...(!visibleTabs.some(t => t.tabKey === 'invoices') ? [{ key: 'invoices', label: 'Invoices', icon: 'DollarSign' }] : []),
        ...(!visibleTabs.some(t => t.tabKey === 'settings') ? [{ key: 'settings', label: 'Settings', icon: 'Settings' }] : []),
      ]
    : defaultNavItems;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    const currentIndex = navItems.findIndex(item => item.key === activeTab);
    if (currentIndex === -1) return;
    if (deltaX < 0) {
      const nextIndex = (currentIndex + 1) % navItems.length;
      setActiveTab(navItems[nextIndex].key);
    } else {
      const prevIndex = (currentIndex - 1 + navItems.length) % navItems.length;
      setActiveTab(navItems[prevIndex].key);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <p className="text-muted-foreground">Hello,</p>
              <h2 className="text-2xl font-bold" data-testid="text-user-name">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-sm text-muted-foreground">{format(currentTime, "EEEE, MMMM d, yyyy • h:mm a")}</p>
            </div>

            {locationStatus === "denied" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Location access is denied. Check-ins may not include location data.
                </AlertDescription>
              </Alert>
            )}

            {activeCheckIn ? (
              <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
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
              <CardContent className="flex items-center justify-between p-4 gap-2">
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
              <CardContent className="flex items-center justify-between p-4 gap-2">
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
              <CardContent className="flex items-center justify-between p-4 gap-2">
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

            {(user.role === 'admin' || user.role === 'super_admin') && (
              <Card 
                className="cursor-pointer hover-elevate border-primary/30"
                onClick={() => setLocation('/')}
                data-testid="card-admin-dashboard"
              >
                <CardContent className="flex items-center justify-between p-4 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-medium">Admin Dashboard</span>
                      <p className="text-xs text-muted-foreground">Access full management</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            )}
          </div>
        );
      case 'schedule':
        return (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-bold">My Schedule</h2>
              {(user as any)?.isMultiCompany && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Across {(user as any)?.memberships?.length || 0} Companies
                </p>
              )}
            </div>
            <MySchedule />
          </div>
        );
      case 'leave':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Leave Requests</h2>
            <LeaveRequestForm />
            {leaveRequests.length > 0 && (
              <div className="space-y-3 mt-6">
                <h3 className="font-semibold text-muted-foreground">Your Requests</h3>
                {leaveRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
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
          </div>
        );
      case 'notices':
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">Notice Board</h2>
            <GuardNoticeBoard />
          </div>
        );
      case 'invoices':
        return (
          <div>
            <h2 className="text-xl font-bold mb-4">My Invoices</h2>
            <GuardInvoices />
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">Settings</h2>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium" data-testid="text-profile-name">{user.firstName} {user.lastName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="font-medium" data-testid="text-profile-username">{user.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="font-medium capitalize" data-testid="text-profile-role">{user.role}</p>
                  </div>
                  {user.email && (
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="font-medium" data-testid="text-profile-email">{user.email}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <GuardStripeSettings />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="currentPwd">Current Password</Label>
                    <Input
                      id="currentPwd"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      data-testid="input-current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPwd">New Password</Label>
                    <Input
                      id="newPwd"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      data-testid="input-new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPwd">Confirm New Password</Label>
                    <Input
                      id="confirmPwd"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      data-testid="input-confirm-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={changePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    {changePasswordMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Change Password
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="pt-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center py-12 text-muted-foreground">
            <p>Select a section from the menu.</p>
          </div>
        );
    }
  };

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className={`flex h-screen w-full ${hasCustomBackground ? 'bg-transparent' : 'bg-background'}`}>
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={guardTrackLogo} alt="GuardTrack" className="h-8 w-8 shrink-0" />
              <div className="overflow-hidden">
                <p className="font-bold text-sm truncate" data-testid="text-sidebar-company">{company?.name || 'GuardTrack'}</p>
                <p className="text-xs text-muted-foreground truncate">{format(currentTime, "EEE, MMM d")}</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const IconComponent = iconMap[item.icon] || Home;
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          onClick={() => setActiveTab(item.key)}
                          isActive={activeTab === item.key}
                          tooltip={item.label}
                          data-testid={`nav-${item.key}`}
                        >
                          <IconComponent className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {(user.role === 'admin' || user.role === 'super_admin') && (
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setLocation('/')}
                        tooltip="Admin Dashboard"
                        data-testid="nav-admin-dashboard"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin Dashboard</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">{user.role}</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4 py-3 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-primary-foreground" data-testid="button-sidebar-toggle" />
                <h1 className="text-lg font-bold truncate" data-testid="text-company-name">{company?.name || 'GuardTrack'}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-primary-foreground"
                  data-testid="button-refresh-guard"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
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
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Download className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Install GuardTrack</p>
                    <p className="text-xs text-muted-foreground">Quick access from home screen</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={installApp} data-testid="button-install-pwa">
                    Install
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => setShowInstallBanner(false)}
                    data-testid="button-dismiss-install"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <main
            className="flex-1 overflow-auto p-4 pb-24"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            data-testid="main-swipe-area"
          >
            {renderContent()}
          </main>

          {/* Bottom Navigation Bar — always visible for one-tap navigation */}
          <nav className="sticky bottom-0 z-50 bg-background border-t border-border" data-testid="bottom-nav">
            <div className="flex overflow-x-auto scrollbar-none">
              {navItems.map((item) => {
                const IconComponent = iconMap[item.icon] || Home;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`flex-1 min-w-[56px] flex flex-col items-center justify-center py-2 px-1 gap-0.5 border-t-2 transition-colors ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid={`bottom-nav-${item.key}`}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-[10px] leading-tight text-center line-clamp-1 max-w-[54px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </SidebarProvider>
  );
}
