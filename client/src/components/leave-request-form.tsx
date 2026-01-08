import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Info, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeaveRequestWithDetails } from "@shared/schema";

const leaveRequestFormSchema = z.object({
  startDate: z.date({
    required_error: "Start date is required",
  }),
  endDate: z.date({
    required_error: "End date is required",
  }),
  reason: z.string().optional(),
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});

type LeaveRequestFormValues = z.infer<typeof leaveRequestFormSchema>;

export default function LeaveRequestForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const { toast } = useToast();

  const form = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestFormSchema),
    defaultValues: {
      reason: "",
    },
  });

  const { data: myLeaveRequests = [] } = useQuery<LeaveRequestWithDetails[]>({
    queryKey: ["/api/leave-requests/my"],
  });

  const createLeaveRequestMutation = useMutation({
    mutationFn: async (data: LeaveRequestFormValues) => {
      return await apiRequest("POST", "/api/leave-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/my"] });
      toast({
        title: "Leave Request Submitted",
        description: "Your leave request has been submitted for approval.",
      });
      setIsOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Submit",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLeaveRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/leave-requests/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests/my"] });
      toast({
        title: "Request Deleted",
        description: "Your leave request has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Delete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: LeaveRequestFormValues) => {
    createLeaveRequestMutation.mutate(values);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content - Leave Requests */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Annual Leave</h2>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-request-leave">
                <Plus className="h-4 w-4 mr-2" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Request Annual Leave</DialogTitle>
                <DialogDescription>
                  Submit a request for time off. Admin will review and approve.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                                data-testid="input-start-date"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : "Pick a date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                                data-testid="input-end-date"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "PPP") : "Pick a date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter the reason for your leave request..."
                            {...field}
                            data-testid="input-leave-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createLeaveRequestMutation.isPending}
                      data-testid="button-submit-leave"
                    >
                      {createLeaveRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {myLeaveRequests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  No leave requests yet. Click "Request Leave" to submit one.
                </p>
              </CardContent>
            </Card>
          ) : (
            myLeaveRequests.map((request) => (
              <Card key={request.id} data-testid={`leave-request-${request.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                        {format(new Date(request.endDate), "MMM d, yyyy")}
                      </CardTitle>
                      <CardDescription>
                        {request.reason || "No reason provided"}
                      </CardDescription>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
                {request.status === "pending" && (
                  <CardContent>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteLeaveRequestMutation.mutate(request.id)}
                      disabled={deleteLeaveRequestMutation.isPending}
                      data-testid={`button-delete-leave-${request.id}`}
                    >
                      Cancel Request
                    </Button>
                  </CardContent>
                )}
                {request.status === "rejected" && request.reviewNotes && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Reason for rejection: </span>
                      {request.reviewNotes}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Side Information - Guidelines (Collapsible) */}
      <div className="lg:col-span-1">
        <Card className="sticky top-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Holiday Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground text-xs">
              Submit leave requests for approval. Plan ahead for best results.
            </p>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-between"
              onClick={() => setShowGuidelines(!showGuidelines)}
              data-testid="button-toggle-guidelines"
            >
              <span className="text-xs">{showGuidelines ? 'Hide details' : 'Learn more about leave policies'}</span>
              {showGuidelines ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showGuidelines && (
              <div className="space-y-4 pt-2 border-t animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Types of Leave</h4>
                  <ul className="space-y-1.5 text-muted-foreground text-xs">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>Annual Leave:</strong> Pre-planned vacation days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>Sick Leave:</strong> Time off due to illness</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>Personal Days:</strong> Days for personal matters</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span><strong>Unpaid Leave:</strong> Extended time off without pay</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Key Reminders</h4>
                  <ul className="space-y-1.5 text-muted-foreground text-xs">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Submit requests as early as possible</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Approval depends on team schedules</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Ensure sufficient leave balance</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
