import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Megaphone, Calendar, Clock, MapPin, Send, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notice, NoticeApplication, Site } from "@shared/schema";

export default function GuardNoticeBoard() {
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch notices
  const { data: notices = [], isLoading } = useQuery<Notice[]>({
    queryKey: ["/api/notices"],
  });

  // Fetch sites for location display
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  // Fetch user's applications
  const { data: myApplications = [] } = useQuery<NoticeApplication[]>({
    queryKey: ["/api/notice-applications/my"],
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: async (noticeId: string) => {
      return await apiRequest("POST", "/api/notice-applications", { noticeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notice-applications/my"] });
      toast({
        title: "Success",
        description: "Your application has been submitted!",
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

  // Withdraw application mutation
  const withdrawMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return await apiRequest("DELETE", `/api/notice-applications/${applicationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notice-applications/my"] });
      toast({
        title: "Success",
        description: "Application withdrawn successfully",
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

  const hasApplied = (noticeId: string) => {
    return myApplications.some(app => app.noticeId === noticeId);
  };

  const getApplication = (noticeId: string) => {
    return myApplications.find(app => app.noticeId === noticeId);
  };

  const getSiteName = (siteId: string | null) => {
    if (!siteId) return null;
    const site = sites.find(s => s.id === siteId);
    return site?.name || null;
  };

  const getNoticeTypeInfo = (type: string) => {
    switch (type) {
      case "overtime":
        return { label: "Overtime", variant: "default" as const, color: "text-blue-600 dark:text-blue-400" };
      case "event":
        return { label: "Event", variant: "secondary" as const, color: "text-green-600 dark:text-green-400" };
      default:
        return { label: type, variant: "outline" as const, color: "text-muted-foreground" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Loading opportunities...</p>
        </CardContent>
      </Card>
    );
  }

  // Filter active notices
  const activeNotices = notices.filter(n => n.isActive);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Notice Board
        </CardTitle>
        <CardDescription>Available overtime opportunities and events</CardDescription>
      </CardHeader>
      <CardContent>
        {activeNotices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No opportunities available at the moment. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeNotices.map((notice) => {
              const typeInfo = getNoticeTypeInfo(notice.type);
              const application = getApplication(notice.id);
              const applied = hasApplied(notice.id);
              const siteName = getSiteName(notice.siteId);

              return (
                <div
                  key={notice.id}
                  className="p-4 rounded-lg border border-border hover-elevate"
                  data-testid={`card-notice-${notice.id}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{notice.title}</h3>
                        <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                        {applied && application && getStatusBadge(application.status)}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notice.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 text-sm">
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
                    {siteName && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{siteName}</span>
                      </div>
                    )}
                  </div>

                  {(notice.workingRole || notice.spotsAvailable) && (
                    <div className="mb-4 flex gap-4 text-sm">
                      {notice.workingRole && (
                        <span>
                          <span className="text-muted-foreground">Role:</span>{" "}
                          <span className="font-medium capitalize">{notice.workingRole}</span>
                        </span>
                      )}
                      {notice.spotsAvailable && (
                        <span>
                          <span className="text-muted-foreground">Spots:</span>{" "}
                          <span className="font-medium">{notice.spotsAvailable}</span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    {!applied ? (
                      <Button
                        size="sm"
                        onClick={() => applyMutation.mutate(notice.id)}
                        disabled={applyMutation.isPending}
                        data-testid={`button-apply-${notice.id}`}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Apply Now
                      </Button>
                    ) : (
                      <>
                        {application?.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => application && withdrawMutation.mutate(application.id)}
                            disabled={withdrawMutation.isPending}
                            data-testid={`button-withdraw-${notice.id}`}
                          >
                            Withdraw Application
                          </Button>
                        )}
                        {application?.status === "approved" && (
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                            ✓ You're assigned to this {notice.type}
                          </p>
                        )}
                        {application?.status === "rejected" && (
                          <p className="text-sm text-muted-foreground">
                            Your application was not selected
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
