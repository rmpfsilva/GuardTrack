import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Plus, Megaphone, Trash2, Users, Calendar, Clock, Check, X, ChevronDown, ChevronUp, User, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Notice, type NoticeApplication, type NoticeApplicationWithDetails } from "@shared/schema";
import { z } from "zod";

const NOTICE_ROLES = [
  { value: "guard", label: "Guard" },
  { value: "steward", label: "Steward" },
  { value: "supervisor", label: "Supervisor" },
  { value: "call_out", label: "Call Out" },
] as const;

// Form schema for the UI (converts date + time strings to timestamps for backend)
const formSchema = z.object({
  type: z.string().min(1, "Type is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  siteId: z.string().nullable().optional(),
  workingRole: z.string().nullable().optional(),
  spotsAvailable: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NoticeBoardManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "overtime",
      title: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      siteId: null,
      workingRole: null,
      spotsAvailable: null,
      expiresAt: null,
    },
  });

  // Fetch notices
  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["/api/notices"],
    refetchInterval: 30000,
  });

  // Fetch applications for notices (includes user details)
  const { data: applications = [] } = useQuery<NoticeApplicationWithDetails[]>({
    queryKey: ["/api/notice-applications"],
    refetchInterval: 30000,
  });

  // Create notice mutation
  const createNoticeMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      // Convert form data to API format
      const { date, startTime, endTime, expiresAt, ...rest } = data;
      
      // Combine date + time into timestamps
      const startDateTime = new Date(`${date}T${startTime}`);
      const endDateTime = new Date(`${date}T${endTime}`);
      const expiresAtDate = expiresAt ? new Date(`${expiresAt}T23:59:59`) : null;

      const payload = {
        ...rest,
        startTime: startDateTime,
        endTime: endDateTime,
        expiresAt: expiresAtDate,
        siteId: null,
        workingRole: selectedRoles.length === 1 ? selectedRoles[0] : (selectedRoles.length > 0 ? selectedRoles[0] : null),
        requiredRoles: selectedRoles.length > 0 ? selectedRoles : null,
        spotsAvailable: data.spotsAvailable || null,
      };

      return await apiRequest("POST", "/api/notices", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setSelectedRoles([]);
      toast({
        title: "Success",
        description: "Notice posted successfully! Notifications sent to all guards.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete notice mutation
  const deleteNoticeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/notices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notice-applications"] });
      toast({
        title: "Success",
        description: "Notice deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const reviewApplicationMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) => {
      return await apiRequest("PATCH", `/api/notice-applications/${id}`, { status, reviewNotes: reviewNotes || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notice-applications"] });
      setReviewNotes({});
      toast({
        title: "Success",
        description: "Application updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    createNoticeMutation.mutate(data);
  };

  const getApplicationCount = (noticeId: string) => {
    return applications.filter(app => app.noticeId === noticeId).length;
  };

  const getApplicationsForNotice = (noticeId: string) => {
    return applications.filter(app => app.noticeId === noticeId);
  };

  const getNoticeTypeLabel = (type: string) => {
    switch (type) {
      case "overtime":
        return { label: "Overtime", variant: "default" as const };
      case "event":
        return { label: "Event", variant: "secondary" as const };
      default:
        return { label: type, variant: "outline" as const };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading notices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Notice Board
          </h2>
          <p className="text-muted-foreground">Post overtime opportunities and events for guards</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-notice">
              <Plus className="h-4 w-4 mr-2" />
              Post Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Post New Notice</DialogTitle>
              <DialogDescription>
                Create a new overtime opportunity or event notice. All guards will be notified.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notice Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-notice-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="overtime">Overtime Opportunity</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="announcement">Announcement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Weekend Overtime Available" data-testid="input-notice-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Provide details about the opportunity or event..."
                          rows={4}
                          data-testid="input-notice-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-notice-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-notice-start-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-notice-end-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Required Roles (Optional)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {NOTICE_ROLES.map((role) => (
                        <div key={role.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`role-${role.value}`}
                            checked={selectedRoles.includes(role.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRoles([...selectedRoles, role.value]);
                              } else {
                                setSelectedRoles(selectedRoles.filter(r => r !== role.value));
                              }
                            }}
                            data-testid={`checkbox-role-${role.value}`}
                          />
                          <Label htmlFor={`role-${role.value}`} className="text-sm font-normal cursor-pointer">{role.label}</Label>
                        </div>
                      ))}
                    </div>
                    {selectedRoles.length === 0 && (
                      <p className="text-xs text-muted-foreground">No roles selected = open to any role</p>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="spotsAvailable"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spots Available (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="e.g., 3"
                            data-testid="input-notice-spots"
                          />
                        </FormControl>
                        <FormDescription>
                          Number of positions available
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expires On (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                          data-testid="input-notice-expires"
                        />
                      </FormControl>
                      <FormDescription>
                        Date when this notice should no longer be visible
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-notice"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createNoticeMutation.isPending}
                    data-testid="button-submit-notice"
                  >
                    {createNoticeMutation.isPending ? "Posting..." : "Post Notice"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {notices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No notices posted yet. Create your first notice to notify guards about overtime opportunities or events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {notices.map((notice) => {
            const typeInfo = getNoticeTypeLabel(notice.type);
            const applicantCount = getApplicationCount(notice.id);

            return (
              <Card key={notice.id} data-testid={`card-notice-${notice.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{notice.title}</CardTitle>
                        <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                        {!notice.isActive && <Badge variant="outline">Inactive</Badge>}
                      </div>
                      <CardDescription className="whitespace-pre-wrap">{notice.description}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteNoticeMutation.mutate(notice.id)}
                      disabled={deleteNoticeMutation.isPending}
                      data-testid={`button-delete-notice-${notice.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    {notice.startTime && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(notice.startTime), "MMM dd, yyyy")}</span>
                      </div>
                    )}
                    {notice.startTime && notice.endTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(notice.startTime), "HH:mm")} - {format(new Date(notice.endTime), "HH:mm")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span data-testid={`text-applicant-count-${notice.id}`}>
                        {applicantCount} {applicantCount === 1 ? "applicant" : "applicants"}
                      </span>
                    </div>
                  </div>
                  {(notice.workingRole || (notice as any).requiredRoles || notice.spotsAvailable) && (
                    <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-sm">
                      {(() => {
                        const roles = (notice as any).requiredRoles as string[] | null;
                        if (roles && roles.length > 0) {
                          return (
                            <span className="flex items-center gap-1 flex-wrap">
                              <span className="text-muted-foreground">Roles:</span>
                              {roles.map(r => (
                                <Badge key={r} variant="outline" className="capitalize text-xs">{NOTICE_ROLES.find(nr => nr.value === r)?.label || r}</Badge>
                              ))}
                            </span>
                          );
                        } else if (notice.workingRole) {
                          return (
                            <span>
                              <span className="text-muted-foreground">Role:</span> <span className="font-medium capitalize">{notice.workingRole}</span>
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {notice.spotsAvailable && (
                        <span>
                          <span className="text-muted-foreground">Spots:</span> <span className="font-medium">{notice.spotsAvailable}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {applicantCount > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedNotice(expandedNotice === notice.id ? null : notice.id)}
                        className="gap-1 px-0"
                        data-testid={`button-toggle-applicants-${notice.id}`}
                      >
                        <Users className="h-4 w-4" />
                        View {applicantCount} {applicantCount === 1 ? "Applicant" : "Applicants"}
                        {expandedNotice === notice.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>

                      {expandedNotice === notice.id && (
                        <div className="mt-3 space-y-3">
                          {getApplicationsForNotice(notice.id).map((app) => {
                            const statusColor = app.status === 'accepted' ? 'default' : app.status === 'rejected' ? 'destructive' : 'secondary';
                            return (
                              <Card key={app.id} data-testid={`card-application-${app.id}`}>
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex items-center gap-1">
                                          <User className="h-4 w-4 text-muted-foreground" />
                                          <span className="font-medium" data-testid={`text-applicant-name-${app.id}`}>
                                            {app.user?.firstName || app.user?.username || 'Unknown'} {app.user?.lastName || ''}
                                          </span>
                                        </div>
                                        <Badge variant={statusColor} className="capitalize text-xs" data-testid={`badge-application-status-${app.id}`}>
                                          {app.status}
                                        </Badge>
                                        {app.user?.role && (
                                          <Badge variant="outline" className="capitalize text-xs">{app.user.role}</Badge>
                                        )}
                                      </div>
                                      {app.user?.email && (
                                        <p className="text-xs text-muted-foreground mt-1">{app.user.email}</p>
                                      )}
                                      {app.user?.phone && (
                                        <p className="text-xs text-muted-foreground">{app.user.phone}</p>
                                      )}
                                      {app.message && (
                                        <p className="text-sm mt-2 bg-muted/50 p-2 rounded-md" data-testid={`text-application-message-${app.id}`}>
                                          {app.message}
                                        </p>
                                      )}
                                      {app.createdAt && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Applied: {format(new Date(app.createdAt), "MMM dd, yyyy HH:mm")}
                                        </p>
                                      )}
                                      {app.reviewNotes && (
                                        <p className="text-xs text-muted-foreground mt-1 italic">
                                          Review note: {app.reviewNotes}
                                        </p>
                                      )}
                                    </div>

                                    {app.status === 'pending' && (
                                      <div className="flex flex-col gap-2 shrink-0">
                                        <div className="flex gap-1">
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => reviewApplicationMutation.mutate({
                                              id: app.id,
                                              status: 'accepted',
                                              reviewNotes: reviewNotes[app.id] || undefined,
                                            })}
                                            disabled={reviewApplicationMutation.isPending}
                                            data-testid={`button-accept-application-${app.id}`}
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => reviewApplicationMutation.mutate({
                                              id: app.id,
                                              status: 'rejected',
                                              reviewNotes: reviewNotes[app.id] || undefined,
                                            })}
                                            disabled={reviewApplicationMutation.isPending}
                                            data-testid={`button-reject-application-${app.id}`}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <Input
                                          placeholder="Note (optional)"
                                          value={reviewNotes[app.id] || ''}
                                          onChange={(e) => setReviewNotes({ ...reviewNotes, [app.id]: e.target.value })}
                                          className="text-xs"
                                          data-testid={`input-review-note-${app.id}`}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
