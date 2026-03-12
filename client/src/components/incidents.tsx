import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Plus, Search, Archive, ArchiveRestore, Trash2,
  Eye, Edit, FileText, Loader2, ExternalLink, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, Clock, XCircle, AlertCircle, Sparkles,
} from "lucide-react";
import type { Issue } from "@shared/schema";

const PRIORITY_COLOURS: Record<string, string> = {
  High: "text-red-600 bg-red-50 border-red-200",
  Medium: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-green-600 bg-green-50 border-green-200",
};

const SEVERITY_COLOURS: Record<string, string> = {
  Critical: "text-red-700 bg-red-100 border-red-300",
  Severe: "text-orange-600 bg-orange-50 border-orange-200",
  Moderate: "text-amber-600 bg-amber-50 border-amber-200",
  Low: "text-green-600 bg-green-50 border-green-200",
};

const STATUS_ICONS: Record<string, any> = {
  Open: AlertCircle,
  "In progress": Clock,
  Resolved: CheckCircle2,
  Closed: XCircle,
  Reopened: RefreshCw,
};

const STATUS_COLOURS: Record<string, string> = {
  Open: "text-red-600 bg-red-50 border-red-200",
  "In progress": "text-blue-600 bg-blue-50 border-blue-200",
  Resolved: "text-green-600 bg-green-50 border-green-200",
  Closed: "text-muted-foreground bg-muted border-muted",
  Reopened: "text-orange-600 bg-orange-50 border-orange-200",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  reportedBy: "",
  assignedTo: "",
  priority: "Medium",
  category: "",
  severity: "Moderate",
  department: "Management",
  status: "Open",
  dueDate: "",
  siteName: "",
  rootCause: "",
  remedialAction: "",
  proposedAction: "",
  comments: "",
};

type FormData = typeof EMPTY_FORM;

function StatCard({ label, value, icon: Icon, colour }: { label: string; value: number; icon: any; colour: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-0.5">{value}</p>
          </div>
          <div className={`p-2 rounded-md ${colour}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IssueForm({
  form, onChange, settings,
}: {
  form: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  settings: any[];
}) {
  const opts = (type: string) => settings.filter(s => s.settingType === type).map(s => s.value);

  return (
    <div className="grid grid-cols-1 gap-4 py-2">
      <div className="space-y-1.5">
        <Label>Title *</Label>
        <Input value={form.title} onChange={e => onChange("title", e.target.value)} placeholder="Brief incident title" data-testid="input-issue-title" />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => onChange("description", e.target.value)} placeholder="Full description of the incident" rows={3} data-testid="input-issue-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Reported By</Label>
          <Input value={form.reportedBy} onChange={e => onChange("reportedBy", e.target.value)} placeholder="Name" data-testid="input-issue-reported-by" />
        </div>
        <div className="space-y-1.5">
          <Label>Assigned To</Label>
          <Input value={form.assignedTo} onChange={e => onChange("assignedTo", e.target.value)} placeholder="Name" data-testid="input-issue-assigned-to" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Site</Label>
          <Input value={form.siteName} onChange={e => onChange("siteName", e.target.value)} placeholder="Site name" data-testid="input-issue-site" />
        </div>
        <div className="space-y-1.5">
          <Label>Due Date</Label>
          <Input type="date" value={form.dueDate} onChange={e => onChange("dueDate", e.target.value)} data-testid="input-issue-due-date" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={v => onChange("priority", v)}>
            <SelectTrigger data-testid="select-issue-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("priority").length ? opts("priority") : ["Low", "Medium", "High"]).map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select value={form.severity} onValueChange={v => onChange("severity", v)}>
            <SelectTrigger data-testid="select-issue-severity"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("severity").length ? opts("severity") : ["Low", "Moderate", "Severe", "Critical"]).map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => onChange("status", v)}>
            <SelectTrigger data-testid="select-issue-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("status").length ? opts("status") : ["Open", "In progress", "Resolved", "Closed"]).map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={form.category} onValueChange={v => onChange("category", v)}>
            <SelectTrigger data-testid="select-issue-category"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {opts("category").map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Select value={form.department} onValueChange={v => onChange("department", v)}>
            <SelectTrigger data-testid="select-issue-department"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(opts("department").length ? opts("department") : ["Management"]).map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Root Cause</Label>
        <Textarea value={form.rootCause} onChange={e => onChange("rootCause", e.target.value)} placeholder="Identified root cause" rows={2} data-testid="input-issue-root-cause" />
      </div>
      <div className="space-y-1.5">
        <Label>Remedial Action Taken</Label>
        <Textarea value={form.remedialAction} onChange={e => onChange("remedialAction", e.target.value)} placeholder="Actions already taken" rows={2} data-testid="input-issue-remedial-action" />
      </div>
      <div className="space-y-1.5">
        <Label>Proposed Corrective Action</Label>
        <Textarea value={form.proposedAction} onChange={e => onChange("proposedAction", e.target.value)} placeholder="Planned future actions" rows={2} data-testid="input-issue-proposed-action" />
      </div>
      <div className="space-y-1.5">
        <Label>Comments</Label>
        <Textarea value={form.comments} onChange={e => onChange("comments", e.target.value)} placeholder="Additional notes" rows={2} data-testid="input-issue-comments" />
      </div>
    </div>
  );
}

function IssueRow({ issue, onEdit, onView, onArchive, onDelete }: {
  issue: Issue;
  onEdit: (i: Issue) => void;
  onView: (i: Issue) => void;
  onArchive: (i: Issue) => void;
  onDelete: (i: Issue) => void;
}) {
  const StatusIcon = STATUS_ICONS[issue.status || "Open"] || AlertCircle;
  const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date() && issue.status !== "Closed" && issue.status !== "Resolved";

  return (
    <div className="flex items-start gap-3 p-4 rounded-md border hover-elevate" data-testid={`row-issue-${issue.id}`}>
      <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${STATUS_COLOURS[issue.status || "Open"]?.split(" ")[0] || "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{issue.issueId}</span>
          {issue.priority && (
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_COLOURS[issue.priority] || ""}`}>
              {issue.priority}
            </span>
          )}
          {issue.severity && (
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SEVERITY_COLOURS[issue.severity] || ""}`}>
              {issue.severity}
            </span>
          )}
          {isOverdue && (
            <span className="text-xs px-1.5 py-0.5 rounded border font-medium text-red-700 bg-red-100 border-red-300">
              Overdue
            </span>
          )}
        </div>
        <p className="font-medium text-sm leading-snug">{issue.title}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {issue.siteName && <span>{issue.siteName}</span>}
          {issue.category && <span>{issue.category}</span>}
          {issue.assignedTo && <span>Assigned: {issue.assignedTo}</span>}
          {issue.dueDate && (
            <span className={isOverdue ? "text-red-600" : ""}>
              Due: {new Date(issue.dueDate).toLocaleDateString('en-GB')}
            </span>
          )}
          <span className={`font-medium ${STATUS_COLOURS[issue.status || "Open"]?.split(" ")[0] || ""}`}>
            {issue.status}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button size="icon" variant="ghost" onClick={() => onView(issue)} title="View" data-testid={`button-view-issue-${issue.id}`}>
          <Eye className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onEdit(issue)} title="Edit" data-testid={`button-edit-issue-${issue.id}`}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onArchive(issue)} title={issue.isArchived ? "Restore" : "Archive"} data-testid={`button-archive-issue-${issue.id}`}>
          {issue.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(issue)} title="Delete" data-testid={`button-delete-issue-${issue.id}`}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export function Incidents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [activeTab, setActiveTab] = useState("active");

  const [createOpen, setCreateOpen] = useState(false);
  const [editIssue, setEditIssue] = useState<Issue | null>(null);
  const [viewIssue, setViewIssue] = useState<Issue | null>(null);
  const [deleteIssue, setDeleteIssue] = useState<Issue | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [reportExpanded, setReportExpanded] = useState(false);

  const { data: issues = [], isLoading } = useQuery<Issue[]>({ queryKey: ["/api/issues"] });
  const { data: archived = [] } = useQuery<Issue[]>({ queryKey: ["/api/issues/archived"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/issues/stats"] });
  const { data: settings = [] } = useQuery<any[]>({ queryKey: ["/api/issue-settings"] });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/issues"] });
    qc.invalidateQueries({ queryKey: ["/api/issues/archived"] });
    qc.invalidateQueries({ queryKey: ["/api/issues/stats"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/issues", data),
    onSuccess: () => { toast({ title: "Incident logged" }); setCreateOpen(false); setForm(EMPTY_FORM); invalidate(); },
    onError: () => toast({ title: "Failed to create incident", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/issues/${id}`, data),
    onSuccess: () => { toast({ title: "Incident updated" }); setEditIssue(null); setForm(EMPTY_FORM); invalidate(); },
    onError: () => toast({ title: "Failed to update incident", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/issues/${id}`),
    onSuccess: () => { toast({ title: "Incident deleted" }); setDeleteIssue(null); invalidate(); },
    onError: () => toast({ title: "Failed to delete incident", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archive }: { id: number; archive: boolean }) =>
      apiRequest("POST", `/api/issues/${id}/${archive ? "archive" : "unarchive"}`, {}),
    onSuccess: (_, { archive }) => {
      toast({ title: archive ? "Incident archived" : "Incident restored" });
      invalidate();
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/issues/${id}/generate-report`, {}),
    onSuccess: (data: any) => {
      toast({ title: "NCR report generated" });
      if (viewIssue) setViewIssue({ ...viewIssue, reportContent: data.report, reportGeneratedAt: new Date() });
      setReportExpanded(true);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Failed to generate report", description: e.message, variant: "destructive" }),
  });

  function openCreate() { setForm(EMPTY_FORM); setCreateOpen(true); }
  function openEdit(issue: Issue) {
    setForm({
      title: issue.title || "",
      description: issue.description || "",
      reportedBy: issue.reportedBy || "",
      assignedTo: issue.assignedTo || "",
      priority: issue.priority || "Medium",
      category: issue.category || "",
      severity: issue.severity || "Moderate",
      department: issue.department || "Management",
      status: issue.status || "Open",
      dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString().split("T")[0] : "",
      siteName: issue.siteName || "",
      rootCause: issue.rootCause || "",
      remedialAction: issue.remedialAction || "",
      proposedAction: issue.proposedAction || "",
      comments: issue.comments || "",
    });
    setEditIssue(issue);
  }

  function formChange(k: keyof FormData, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function submitCreate() {
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    createMutation.mutate({ ...form, issueId: "" });
  }

  function submitEdit() {
    if (!editIssue) return;
    if (!form.title.trim()) return toast({ title: "Title is required", variant: "destructive" });
    updateMutation.mutate({ id: editIssue.id, data: form });
  }

  const displayed = (activeTab === "archived" ? archived : issues).filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.title?.toLowerCase().includes(q) || i.issueId?.toLowerCase().includes(q) || i.siteName?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || i.status === filterStatus;
    const matchPriority = filterPriority === "all" || i.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const statusOpts = ["Open", "In progress", "Resolved", "Closed", "Reopened"];
  const priorityOpts = ["Low", "Medium", "High"];

  return (
    <div className="space-y-6 p-6" data-testid="incidents-section">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Incidents
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Log, track and manage operational incidents</p>
        </div>
        <Button onClick={openCreate} data-testid="button-log-incident">
          <Plus className="h-4 w-4 mr-2" />
          Log Incident
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} icon={FileText} colour="bg-muted text-muted-foreground" />
          <StatCard label="Open" value={stats.open} icon={AlertCircle} colour="bg-red-50 text-red-600" />
          <StatCard label="In Progress" value={stats.inProgress} icon={Clock} colour="bg-blue-50 text-blue-600" />
          <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} colour="bg-amber-50 text-amber-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search incidents…"
            className="pl-8"
            data-testid="input-search-incidents"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36" data-testid="select-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOpts.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36" data-testid="select-filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {priorityOpts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-incidents">
            Active <Badge variant="outline" className="ml-1.5">{issues.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived-incidents">
            Archived <Badge variant="outline" className="ml-1.5">{archived.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search || filterStatus !== "all" || filterPriority !== "all" ? "No incidents match your filters" : "No incidents logged yet"}
              </p>
              {!search && filterStatus === "all" && filterPriority === "all" && (
                <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-2" />Log your first incident
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(i => (
                <IssueRow
                  key={i.id}
                  issue={i}
                  onEdit={openEdit}
                  onView={issue => { setViewIssue(issue); setReportExpanded(false); }}
                  onArchive={issue => archiveMutation.mutate({ id: issue.id, archive: !issue.isArchived })}
                  onDelete={setDeleteIssue}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Archive className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No archived incidents</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(i => (
                <IssueRow
                  key={i.id}
                  issue={i}
                  onEdit={openEdit}
                  onView={issue => { setViewIssue(issue); setReportExpanded(false); }}
                  onArchive={issue => archiveMutation.mutate({ id: issue.id, archive: !issue.isArchived })}
                  onDelete={setDeleteIssue}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log New Incident</DialogTitle>
          </DialogHeader>
          <IssueForm form={form} onChange={formChange} settings={settings} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate} disabled={createMutation.isPending} data-testid="button-submit-incident">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Log Incident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editIssue} onOpenChange={o => !o && setEditIssue(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Incident {editIssue?.issueId}</DialogTitle>
          </DialogHeader>
          <IssueForm form={form} onChange={formChange} settings={settings} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditIssue(null)}>Cancel</Button>
            <Button onClick={submitEdit} disabled={updateMutation.isPending} data-testid="button-save-incident-edit">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewIssue} onOpenChange={o => !o && setViewIssue(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewIssue && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">{viewIssue.issueId}</p>
                    <DialogTitle className="mt-1">{viewIssue.title}</DialogTitle>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {viewIssue.priority && (
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_COLOURS[viewIssue.priority] || ""}`}>
                        {viewIssue.priority}
                      </span>
                    )}
                    {viewIssue.status && (
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_COLOURS[viewIssue.status] || ""}`}>
                        {viewIssue.status}
                      </span>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Site", viewIssue.siteName],
                    ["Category", viewIssue.category],
                    ["Severity", viewIssue.severity],
                    ["Department", viewIssue.department],
                    ["Reported By", viewIssue.reportedBy],
                    ["Assigned To", viewIssue.assignedTo],
                    ["Date Logged", viewIssue.dateLogged ? new Date(viewIssue.dateLogged).toLocaleDateString('en-GB') : null],
                    ["Due Date", viewIssue.dueDate ? new Date(viewIssue.dueDate).toLocaleDateString('en-GB') : null],
                    ["Resolution Date", viewIssue.resolutionDate ? new Date(viewIssue.resolutionDate).toLocaleDateString('en-GB') : null],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k as string}>
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="font-medium">{v}</p>
                    </div>
                  ))}
                </div>

                {viewIssue.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm whitespace-pre-wrap">{viewIssue.description}</p>
                  </div>
                )}
                {viewIssue.rootCause && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Root Cause</p>
                    <p className="text-sm whitespace-pre-wrap">{viewIssue.rootCause}</p>
                  </div>
                )}
                {viewIssue.remedialAction && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Remedial Action</p>
                    <p className="text-sm whitespace-pre-wrap">{viewIssue.remedialAction}</p>
                  </div>
                )}
                {viewIssue.proposedAction && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Proposed Action</p>
                    <p className="text-sm whitespace-pre-wrap">{viewIssue.proposedAction}</p>
                  </div>
                )}
                {viewIssue.comments && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Comments</p>
                    <p className="text-sm whitespace-pre-wrap">{viewIssue.comments}</p>
                  </div>
                )}

                {/* NCR Report section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Non-Conformance Report
                    </p>
                    <div className="flex items-center gap-2">
                      {viewIssue.reportContent && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/issue-report/${viewIssue.issueId}`, "_blank")}
                            data-testid="button-view-public-report"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Share
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReportExpanded(e => !e)}
                          >
                            {reportExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reportMutation.mutate(viewIssue.id)}
                        disabled={reportMutation.isPending}
                        data-testid="button-generate-ncr"
                      >
                        {reportMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        {viewIssue.reportContent ? "Regenerate" : "Generate NCR"}
                      </Button>
                    </div>
                  </div>

                  {viewIssue.reportContent && reportExpanded && (
                    <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {viewIssue.reportContent}
                    </div>
                  )}

                  {!viewIssue.reportContent && (
                    <p className="text-xs text-muted-foreground">
                      Generate an AI-written Non-Conformance Report for this incident to share with clients.
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewIssue(null)}>Close</Button>
                <Button onClick={() => { setViewIssue(null); openEdit(viewIssue); }} data-testid="button-edit-from-view">
                  <Edit className="h-4 w-4 mr-2" />Edit
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteIssue} onOpenChange={o => !o && setDeleteIssue(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete incident?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteIssue?.issueId} — {deleteIssue?.title}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteIssue && deleteMutation.mutate(deleteIssue.id)}
              data-testid="button-confirm-delete-incident"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
