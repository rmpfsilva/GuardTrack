import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Clock, MapPin, LogOut, LogIn, Calendar } from "lucide-react";
import proForceLogo from "@assets/download_1760019684165.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import MySchedule from "@/components/my-schedule";
import type { Site, CheckIn, CheckInWithDetails } from "@shared/schema";

export default function GuardDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("guard");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [user, authLoading, toast]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch sites
  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
    enabled: !!user,
  });

  // Fetch active check-in
  const { data: activeCheckIn, isLoading: checkInLoading } = useQuery<CheckInWithDetails | null>({
    queryKey: ["/api/check-ins/active"],
    enabled: !!user,
  });

  // Fetch recent check-ins
  const { data: recentCheckIns = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/check-ins/my-recent"],
    enabled: !!user,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (data: { siteId: string; latitude?: string; longitude?: string; workingRole?: string }) => {
      return await apiRequest("POST", "/api/check-ins", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/my-recent"] });
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
          window.location.href = "/api/login";
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

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async (checkInId: string) => {
      return await apiRequest("PATCH", `/api/check-ins/${checkInId}/checkout`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/check-ins/my-recent"] });
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
          window.location.href = "/api/login";
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

  const handleCheckIn = () => {
    if (!selectedSiteId) {
      toast({
        title: "Site Required",
        description: "Please select a site before checking in.",
        variant: "destructive",
      });
      return;
    }

    // Request geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success: got location
          checkInMutation.mutate({
            siteId: selectedSiteId,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
            workingRole: selectedRole,
          });
        },
        (error) => {
          // Error or denied: check in without location
          toast({
            title: "Location Access Denied",
            description: "Checking in without location verification.",
            variant: "default",
          });
          checkInMutation.mutate({ siteId: selectedSiteId, workingRole: selectedRole });
        },
        { timeout: 5000 }
      );
    } else {
      // Geolocation not supported: check in without location
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

  if (authLoading || !user) {
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
    return user.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={proForceLogo} alt="ProForce Security" className="h-8" data-testid="img-company-logo" />
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{user.firstName || user.email}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/api/logout'}
              data-testid="button-logout"
            >
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Current Time Display */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground mb-2">Current Time</p>
          <p className="text-4xl font-mono font-semibold" data-testid="text-current-time">
            {format(currentTime, "HH:mm:ss")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {format(currentTime, "EEEE, MMMM d, yyyy")}
          </p>
        </div>

        {/* Quick Action Card */}
        <Card className="mb-8">
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
                  {checkOutMutation.isPending ? "Checking Out..." : "Check Out"}
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
                
                <Button 
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending || !selectedSiteId}
                  className="w-full h-14 text-lg"
                  data-testid="button-check-in"
                >
                  {checkInMutation.isPending ? "Checking In..." : "Check In"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* My Schedule */}
        <Card>
          <CardContent className="p-6">
            <MySchedule />
          </CardContent>
        </Card>

        {/* Recent Shifts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Shifts
            </CardTitle>
            <CardDescription>Your latest check-in activity</CardDescription>
          </CardHeader>
          <CardContent>
            {checkInLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading shifts...</p>
            ) : recentCheckIns.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent shifts</p>
            ) : (
              <div className="space-y-3">
                {recentCheckIns.slice(0, 10).map((checkIn) => (
                  <div 
                    key={checkIn.id} 
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
