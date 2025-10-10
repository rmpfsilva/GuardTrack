import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { Calendar as CalendarIcon, Check, X, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { LeaveRequestWithDetails } from "@shared/schema";

export default function AdminLeaveManagement() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestWithDetails | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: pendingRequests = [], isLoading: pendingLoading } = useQuery<LeaveRequestWithDetails[]>({
    queryKey: ["/api/leave-requests/pending"],
  });

  const { data: allRequests = [], isLoading: allLoading } = useQuery<LeaveRequestWithDetails[]>({
    queryKey: ["/api/leave-requests"],
  });

  const { data: upcomingLeave = [] } = useQuery<LeaveRequestWithDetails[]>({
    queryKey: ["/api/leave-requests/upcoming"],
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/leave-requests/${id}`, {
        status,
        reviewNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/upcoming"] });
      toast({
        title: "Request Reviewed",
        description: `Leave request has been ${reviewAction}.`,
      });
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Review",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openReviewDialog = (request: LeaveRequestWithDetails, action: "approved" | "rejected") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes("");
    setReviewDialogOpen(true);
  };

  const handleReview = () => {
    if (!selectedRequest) return;
    reviewMutation.mutate({
      id: selectedRequest.id,
      status: reviewAction,
      notes: reviewNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const getLeaveForDate = (date: Date) => {
    return upcomingLeave.filter(leave => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      return isWithinInterval(date, { start, end });
    });
  };

  const renderCalendar = () => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="border rounded-lg p-4">
        <div className="text-center mb-4">
          <h3 className="font-semibold text-lg">{format(today, 'MMMM yyyy')}</h3>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const leaveOnDay = getLeaveForDate(day);
            const isCurrentMonth = day.getMonth() === today.getMonth();
            const isToday = isSameDay(day, today);
            
            return (
              <div
                key={idx}
                className={`
                  relative aspect-square flex flex-col items-center justify-center text-sm rounded-md
                  ${!isCurrentMonth ? 'text-muted-foreground/40' : ''}
                  ${isToday ? 'bg-primary text-primary-foreground font-bold' : ''}
                  ${leaveOnDay.length > 0 && !isToday ? 'bg-blue-100 dark:bg-blue-900' : ''}
                `}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <span>{format(day, 'd')}</span>
                {leaveOnDay.length > 0 && (
                  <span className="absolute bottom-1 text-xs font-semibold">
                    {leaveOnDay.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900"></div>
            <span>Leave period</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-primary"></div>
            <span>Today</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Annual Leave Management</h2>
        <p className="text-muted-foreground">Review and approve leave requests from your team</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            Upcoming Leave
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {pendingLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading requests...</p>
              </CardContent>
            </Card>
          ) : pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No pending leave requests</p>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <Card key={request.id} data-testid={`pending-request-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {request.user.firstName} {request.user.lastName}
                      </CardTitle>
                      <CardDescription>
                        {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                        {format(new Date(request.endDate), "MMM d, yyyy")} (
                        {calculateDays(request.startDate as any, request.endDate as any)} days)
                      </CardDescription>
                      {request.reason && (
                        <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => openReviewDialog(request, "approved")}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-approve-${request.id}`}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openReviewDialog(request, "rejected")}
                      disabled={reviewMutation.isPending}
                      data-testid={`button-reject-${request.id}`}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-3 mt-4">
          {upcomingLeave.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No upcoming approved leave in the next 30 days
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5" />
                      Leave Summary
                    </CardTitle>
                    <CardDescription>Approved leave for the next 30 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{upcomingLeave.length}</div>
                    <p className="text-sm text-muted-foreground">team members on leave</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Leave Calendar</CardTitle>
                    <CardDescription>Visual overview of leave periods</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderCalendar()}
                  </CardContent>
                </Card>
              </div>
              {upcomingLeave.map((request) => (
                <Card key={request.id} data-testid={`upcoming-leave-${request.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {request.user.firstName} {request.user.lastName}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                          {format(new Date(request.endDate), "MMM d, yyyy")} (
                          {calculateDays(request.startDate as any, request.endDate as any)} days)
                        </CardDescription>
                        {request.reason && (
                          <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                        )}
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-3 mt-4">
          {allLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading requests...</p>
              </CardContent>
            </Card>
          ) : allRequests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No leave requests</p>
              </CardContent>
            </Card>
          ) : (
            allRequests.map((request) => (
              <Card key={request.id} data-testid={`all-request-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {request.user.firstName} {request.user.lastName}
                      </CardTitle>
                      <CardDescription>
                        {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                        {format(new Date(request.endDate), "MMM d, yyyy")} (
                        {calculateDays(request.startDate as any, request.endDate as any)} days)
                      </CardDescription>
                      {request.reason && (
                        <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
                      )}
                      {request.reviewNotes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <span className="font-medium">Review notes: </span>
                          {request.reviewNotes}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approved" ? "Approve" : "Reject"} Leave Request
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <>
                  {selectedRequest.user.firstName} {selectedRequest.user.lastName} -{" "}
                  {format(new Date(selectedRequest.startDate), "MMM d, yyyy")} to{" "}
                  {format(new Date(selectedRequest.endDate), "MMM d, yyyy")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="review-notes">
                {reviewAction === "rejected" ? "Rejection reason (required)" : "Notes (optional)"}
              </Label>
              <Textarea
                id="review-notes"
                placeholder={
                  reviewAction === "rejected"
                    ? "Please provide a reason for rejection..."
                    : "Add any notes about this approval..."
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                data-testid="input-review-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={reviewMutation.isPending || (reviewAction === "rejected" && !reviewNotes)}
              variant={reviewAction === "approved" ? "default" : "destructive"}
              data-testid="button-confirm-review"
            >
              {reviewMutation.isPending
                ? "Processing..."
                : reviewAction === "approved"
                ? "Approve"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
