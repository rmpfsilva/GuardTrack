import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PendingBreak {
  id: string;
  userId: string;
  checkInId: string;
  breakStartTime: Date;
  breakEndTime: Date;
  reason: string;
  approvalStatus: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  checkIn: {
    id: string;
    checkInTime: Date;
    checkOutTime: Date | null;
  };
  site: {
    id: string;
    name: string;
  };
}

interface PendingOvertime {
  id: string;
  checkInId: string;
  userId: string;
  scheduledEndTime: Date;
  actualEndTime: Date;
  overtimeMinutes: number;
  reason: string;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  site: {
    id: string;
    name: string;
  };
}

export default function AdminApprovals() {
  const { toast } = useToast();

  // Fetch pending breaks
  const { data: pendingBreaks = [], refetch: refetchBreaks } = useQuery<PendingBreak[]>({
    queryKey: ["/api/admin/approvals/breaks"],
  });

  // Fetch pending overtime
  const { data: pendingOvertime = [], refetch: refetchOvertime } = useQuery<PendingOvertime[]>({
    queryKey: ["/api/admin/approvals/overtime"],
  });

  // Approve break mutation
  const approveBreakMutation = useMutation({
    mutationFn: async (breakId: string) => {
      return apiRequest(`/api/admin/approvals/breaks/${breakId}/approve`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Break Approved",
        description: "Extended break has been approved and recorded.",
      });
      refetchBreaks();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject break mutation
  const rejectBreakMutation = useMutation({
    mutationFn: async (breakId: string) => {
      return apiRequest(`/api/admin/approvals/breaks/${breakId}/reject`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Break Rejected",
        description: "Extended break has been rejected.",
      });
      refetchBreaks();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Approve overtime mutation
  const approveOvertimeMutation = useMutation({
    mutationFn: async (overtimeId: string) => {
      return apiRequest(`/api/admin/approvals/overtime/${overtimeId}/approve`, {
        method: "POST",
        body: { notes: "Approved by admin" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Overtime Approved",
        description: "Overtime hours will be added to payable hours.",
      });
      refetchOvertime();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject overtime mutation
  const rejectOvertimeMutation = useMutation({
    mutationFn: async (overtimeId: string) => {
      return apiRequest(`/api/admin/approvals/overtime/${overtimeId}/reject`, {
        method: "POST",
        body: { notes: "Rejected by admin" },
      });
    },
    onSuccess: () => {
      toast({
        title: "Overtime Rejected",
        description: "Payable hours capped at scheduled end time + 30 min buffer.",
      });
      refetchOvertime();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const calculateBreakDuration = (start: Date, end: Date) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <Tabs defaultValue="breaks" className="space-y-6">
      <TabsList>
        <TabsTrigger value="breaks" data-testid="tab-pending-breaks">
          Extended Breaks ({pendingBreaks.length})
        </TabsTrigger>
        <TabsTrigger value="overtime" data-testid="tab-pending-overtime">
          Overtime ({pendingOvertime.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="breaks" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Extended Breaks Pending Approval</CardTitle>
            <CardDescription>
              Employees took breaks longer than 1 hour. Review and approve or reject extended break records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingBreaks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending break approvals</p>
            ) : (
              <div className="space-y-3">
                {pendingBreaks.map((breakItem) => (
                  <div
                    key={breakItem.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-4"
                    data-testid={`pending-break-${breakItem.id}`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {breakItem.user.firstName} {breakItem.user.lastName}
                        </p>
                        <Badge variant="outline">{breakItem.site.name}</Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Break Duration: {calculateBreakDuration(breakItem.breakStartTime, breakItem.breakEndTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(breakItem.breakStartTime), "MMM d, HH:mm")} - {format(new Date(breakItem.breakEndTime), "HH:mm")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm font-medium">Reason:</p>
                        <p className="text-sm text-muted-foreground italic">{breakItem.reason}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => approveBreakMutation.mutate(breakItem.id)}
                        disabled={approveBreakMutation.isPending}
                        data-testid={`button-approve-break-${breakItem.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectBreakMutation.mutate(breakItem.id)}
                        disabled={rejectBreakMutation.isPending}
                        data-testid={`button-reject-break-${breakItem.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="overtime" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Overtime Requests Pending Approval</CardTitle>
            <CardDescription>
              Guards worked more than 30 minutes past their scheduled shift end time. Approve to pay overtime hours, or reject to cap at scheduled end + 30 min buffer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingOvertime.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending overtime approvals</p>
            ) : (
              <div className="space-y-3">
                {pendingOvertime.map((overtime) => (
                  <div
                    key={overtime.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-4"
                    data-testid={`pending-overtime-${overtime.id}`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {overtime.user.firstName} {overtime.user.lastName}
                        </p>
                        <Badge variant="outline">{overtime.site.name}</Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Overtime: {overtime.overtimeMinutes} minutes ({(overtime.overtimeMinutes / 60).toFixed(1)}h)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Scheduled: {format(new Date(overtime.scheduledEndTime), "HH:mm")} → Actual: {format(new Date(overtime.actualEndTime), "HH:mm")}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm font-medium">Reason:</p>
                        <p className="text-sm text-muted-foreground italic">{overtime.reason}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => approveOvertimeMutation.mutate(overtime.id)}
                        disabled={approveOvertimeMutation.isPending}
                        data-testid={`button-approve-overtime-${overtime.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectOvertimeMutation.mutate(overtime.id)}
                        disabled={rejectOvertimeMutation.isPending}
                        data-testid={`button-reject-overtime-${overtime.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
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
  );
}
