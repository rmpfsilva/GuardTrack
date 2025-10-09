import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserPlus, UserMinus, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { User as UserType, Site, CheckInWithDetails } from "@shared/schema";

export default function AdminCheckInControl() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("guard");
  const [selectedCheckInId, setSelectedCheckInId] = useState<string>("");

  // Fetch all users (guards)
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/admin/guards"],
  });

  // Fetch sites
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  // Fetch active check-ins
  const { data: activeCheckIns = [] } = useQuery<CheckInWithDetails[]>({
    queryKey: ["/api/admin/active-check-ins"],
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async (data: { userId: string; siteId: string; workingRole: string }) => {
      return await apiRequest("POST", "/api/admin/manual-check-in", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-check-ins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "User Checked In",
        description: "Successfully checked in the user.",
      });
      setSelectedUserId("");
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
      return await apiRequest("POST", "/api/admin/manual-check-out", { checkInId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-check-ins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "User Checked Out",
        description: "Successfully checked out the user.",
      });
      setSelectedCheckInId("");
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
    if (!selectedUserId || !selectedSiteId || !selectedRole) {
      toast({
        title: "Missing Information",
        description: "Please select user, site, and role.",
        variant: "destructive",
      });
      return;
    }
    checkInMutation.mutate({ userId: selectedUserId, siteId: selectedSiteId, workingRole: selectedRole });
  };

  const handleCheckOut = () => {
    if (!selectedCheckInId) {
      toast({
        title: "No Check-In Selected",
        description: "Please select an active check-in to close.",
        variant: "destructive",
      });
      return;
    }
    checkOutMutation.mutate(selectedCheckInId);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Manual Check-In */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Manual Check-In
          </CardTitle>
          <CardDescription>Check in a user on their behalf</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-select">Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="user-select" data-testid="select-manual-checkin-user">
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id} data-testid={`select-option-user-${user.id}`}>
                    {user.firstName} {user.lastName} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-select">Select Site</Label>
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
              <SelectTrigger id="site-select" data-testid="select-manual-checkin-site">
                <SelectValue placeholder="Choose a site..." />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id} data-testid={`select-option-site-${site.id}`}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-select">Working Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select" data-testid="select-manual-checkin-role">
                <SelectValue placeholder="Choose role..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="guard" data-testid="select-option-role-guard">Guard</SelectItem>
                <SelectItem value="steward" data-testid="select-option-role-steward">Steward</SelectItem>
                <SelectItem value="supervisor" data-testid="select-option-role-supervisor">Supervisor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending || !selectedUserId || !selectedSiteId}
            className="w-full"
            data-testid="button-manual-checkin"
          >
            {checkInMutation.isPending ? "Checking In..." : "Check In User"}
          </Button>
        </CardContent>
      </Card>

      {/* Manual Check-Out */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserMinus className="h-5 w-5" />
            Manual Check-Out
          </CardTitle>
          <CardDescription>Check out a user on their behalf</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checkin-select">Select Active Check-In</Label>
            <Select value={selectedCheckInId} onValueChange={setSelectedCheckInId}>
              <SelectTrigger id="checkin-select" data-testid="select-manual-checkout">
                <SelectValue placeholder="Choose an active check-in..." />
              </SelectTrigger>
              <SelectContent>
                {activeCheckIns.map((checkIn) => (
                  <SelectItem key={checkIn.id} value={checkIn.id} data-testid={`select-option-checkin-${checkIn.id}`}>
                    {checkIn.user.firstName} {checkIn.user.lastName} - {checkIn.site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCheckInId && activeCheckIns.find(c => c.id === selectedCheckInId) && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{activeCheckIns.find(c => c.id === selectedCheckInId)?.user.firstName} {activeCheckIns.find(c => c.id === selectedCheckInId)?.user.lastName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{activeCheckIns.find(c => c.id === selectedCheckInId)?.site.name}</span>
              </div>
              <Badge variant="default" className="bg-chart-2">Active</Badge>
            </div>
          )}

          <Button 
            onClick={handleCheckOut}
            disabled={checkOutMutation.isPending || !selectedCheckInId}
            className="w-full"
            variant="destructive"
            data-testid="button-manual-checkout"
          >
            {checkOutMutation.isPending ? "Checking Out..." : "Check Out User"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
