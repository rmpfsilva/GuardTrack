import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, isBefore, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval } from "date-fns";
import {
  ClipboardList, Plus, ChevronLeft, ChevronRight, Archive, RotateCcw,
  Pencil, Trash2, CheckCircle2, Clock, AlertCircle, XCircle, PauseCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Task {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
  priority: string;
  assignedTo: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "hr", label: "HR" },
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "compliance", label: "Compliance" },
  { value: "recruitment", label: "Recruitment" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function getEffectiveStatus(task: Task): string {
  if (task.status === "completed" || task.status === "cancelled") return task.status;
  if (task.dueDate && isBefore(new Date(task.dueDate), new Date())) return "overdue";
  return task.status;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    in_progress: { label: "In Progress", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
    on_hold: { label: "On Hold", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
    completed: { label: "Completed", className: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
    overdue: { label: "Overdue", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  };
  const cfg = map[status] ?? map.pending;
  return <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    low: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`text-xs ${map[priority] ?? ""} capitalize`}>{priority}</Badge>;
}

interface TaskFormData {
  title: string;
  description: string;
  status: string;
  category: string;
  priority: string;
  assignedTo: string;
  dueDate: string;
  notes: string;
}

const emptyForm = (): TaskFormData => ({
  title: "",
  description: "",
  status: "pending",
  category: "general",
  priority: "medium",
  assignedTo: "",
  dueDate: "",
  notes: "",
});

interface CompanyUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string;
  role: string;
}

export default function TaskManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isStaff = user?.role === "guard" || user?.role === "steward" || user?.role === "supervisor";

  const [activeMainTab, setActiveMainTab] = useState<"active" | "archived">("active");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "status" | "priority" | "assignedTo">("dueDate");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskFormData>(emptyForm());

  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !isStaff,
  });

  const { data: myTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks/my-tasks"],
    enabled: isStaff,
  });

  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: ["/api/company-employees"],
    enabled: !isStaff,
  });

  const tasks = isStaff ? myTasks : allTasks;

  // Month filter
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthTasks = useMemo(() => {
    return tasks.filter((t) => {
      const ref = t.dueDate ? new Date(t.dueDate) : new Date(t.createdAt);
      return isWithinInterval(ref, { start: monthStart, end: monthEnd });
    });
  }, [tasks, monthStart, monthEnd]);

  const activeTasks = monthTasks.filter((t) => !t.isArchived);
  const archivedTasks = monthTasks.filter((t) => t.isArchived);

  const displayTasks = (activeMainTab === "active" ? activeTasks : archivedTasks).filter((t) => {
    const eff = getEffectiveStatus(t);
    if (statusFilter !== "all" && eff !== statusFilter) return false;
    if (assigneeFilter !== "all" && t.assignedTo !== assigneeFilter) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "dueDate") {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (sortBy === "status") return getEffectiveStatus(a).localeCompare(getEffectiveStatus(b));
    if (sortBy === "priority") {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1);
    }
    if (sortBy === "assignedTo") return (a.assigneeName ?? "").localeCompare(b.assigneeName ?? "");
    return 0;
  });

  // KPI counts for current month active tasks
  const kpiTasks = activeTasks;
  const kpis = {
    total: kpiTasks.length,
    pending: kpiTasks.filter((t) => getEffectiveStatus(t) === "pending").length,
    in_progress: kpiTasks.filter((t) => getEffectiveStatus(t) === "in_progress").length,
    on_hold: kpiTasks.filter((t) => getEffectiveStatus(t) === "on_hold").length,
    completed: kpiTasks.filter((t) => t.status === "completed").length,
    cancelled: kpiTasks.filter((t) => t.status === "cancelled").length,
    overdue: kpiTasks.filter((t) => getEffectiveStatus(t) === "overdue").length,
  };

  // Tasks by assignee
  const assigneeCounts = useMemo(() => {
    const map: Record<string, { name: string; count: number; id: string }> = {};
    activeTasks.forEach((t) => {
      if (!t.assignedTo || !t.assigneeName) return;
      if (!map[t.assignedTo]) map[t.assignedTo] = { name: t.assigneeName, count: 0, id: t.assignedTo };
      map[t.assignedTo].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [activeTasks]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => {
      toast({ title: "Task created" });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/tasks/${id}`, data),
    onSuccess: () => {
      toast({ title: "Task updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      closeModal();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, { isArchived: archive }),
    onSuccess: (_, v) => {
      toast({ title: v.archive ? "Task archived" : "Task unarchived" });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingTask(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      category: task.category,
      priority: task.priority,
      assignedTo: task.assignedTo ?? "",
      dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "",
      notes: task.notes ?? "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    setForm(emptyForm());
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      assignedTo: form.assignedTo || null,
      dueDate: form.dueDate || null,
      description: form.description || null,
      notes: form.notes || null,
    };
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Task Manager</h1>
        </div>
        {!isStaff && (
          <Button onClick={openCreate} data-testid="button-add-task">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex gap-2 border-b">
        <Button
          variant={activeMainTab === "active" ? "default" : "ghost"}
          onClick={() => setActiveMainTab("active")}
          data-testid="tab-active-tasks"
        >
          Active Tasks ({activeTasks.length})
        </Button>
        <Button
          variant={activeMainTab === "archived" ? "default" : "ghost"}
          onClick={() => setActiveMainTab("archived")}
          data-testid="tab-archived-tasks"
        >
          <Archive className="h-4 w-4 mr-1.5" />
          Archived ({archivedTasks.length})
        </Button>
      </div>

      {/* Month nav + filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setCurrentMonth((m) => subMonths(m, 1))} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm min-w-[140px] text-center" data-testid="text-current-month">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button size="icon" variant="ghost" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isStaff && (
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-44" data-testid="filter-assignee">
                <SelectValue placeholder="All Assignees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {companyUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* KPI Cards (admin only, active tab) */}
      {!isStaff && activeMainTab === "active" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { label: "Total", value: kpis.total, cls: "text-foreground", testId: "kpi-total" },
            { label: "Pending", value: kpis.pending, cls: "text-amber-600 dark:text-amber-400", testId: "kpi-pending" },
            { label: "In Progress", value: kpis.in_progress, cls: "text-blue-600 dark:text-blue-400", testId: "kpi-in-progress" },
            { label: "On Hold", value: kpis.on_hold, cls: "text-orange-600 dark:text-orange-400", testId: "kpi-on-hold" },
            { label: "Completed", value: kpis.completed, cls: "text-green-600 dark:text-green-400", testId: "kpi-completed" },
            { label: "Cancelled", value: kpis.cancelled, cls: "text-muted-foreground", testId: "kpi-cancelled" },
            { label: "Overdue", value: kpis.overdue, cls: "text-red-600 dark:text-red-400", testId: "kpi-overdue" },
          ].map((k) => (
            <Card key={k.label} className={k.label === "Overdue" ? "border-red-500/30" : ""}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.cls}`} data-testid={k.testId}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tasks by assignee */}
      {!isStaff && activeMainTab === "active" && assigneeCounts.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap text-sm text-muted-foreground">
          {assigneeCounts.map((a, i) => (
            <span key={a.id}>
              <button
                className="font-medium text-foreground hover:text-primary"
                onClick={() => setAssigneeFilter(assigneeFilter === a.id ? "all" : a.id)}
                data-testid={`assignee-filter-${a.id}`}
              >
                {a.name}
              </button>
              <span className="ml-0.5">: {a.count}</span>
              {i < assigneeCounts.length - 1 && <span className="mx-1 text-muted-foreground/40">·</span>}
            </span>
          ))}
        </div>
      )}

      {/* Sort control */}
      {!isStaff && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          {(["dueDate", "status", "priority", "assignedTo"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={sortBy === s ? "default" : "ghost"}
              onClick={() => setSortBy(s)}
              data-testid={`sort-${s}`}
            >
              {s === "dueDate" ? "Due Date" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1).replace(/([A-Z])/g, " $1")}
            </Button>
          ))}
        </div>
      )}

      {/* Task Table */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Loading tasks...</CardContent>
        </Card>
      ) : displayTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>{activeMainTab === "archived" ? "No archived tasks this month" : "No tasks match your filters"}</p>
            {!isStaff && activeMainTab === "active" && (
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />Create First Task
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Task</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Category</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Priority</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Assigned To</th>
                  <th className="text-left p-3 font-medium">Due Date</th>
                  {!isStaff && <th className="text-left p-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayTasks.map((task) => {
                  const eff = getEffectiveStatus(task);
                  const isOverdue = eff === "overdue";
                  return (
                    <tr
                      key={task.id}
                      className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${isOverdue ? "bg-red-50/30 dark:bg-red-950/10" : ""}`}
                      data-testid={`task-row-${task.id}`}
                    >
                      <td className="p-3">
                        <StatusBadge status={eff} />
                      </td>
                      <td className="p-3">
                        <p className="font-medium line-clamp-1">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>
                        )}
                      </td>
                      <td className="p-3 hidden sm:table-cell capitalize text-muted-foreground">
                        {task.category}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="p-3 hidden lg:table-cell text-muted-foreground">
                        {task.assigneeName ?? "—"}
                      </td>
                      <td className="p-3">
                        {task.dueDate ? (
                          <span className={isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                            {format(new Date(task.dueDate), "dd/MM/yyyy")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {!isStaff && (
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(task)}
                              data-testid={`button-edit-task-${task.id}`}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {task.isArchived ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => archiveMutation.mutate({ id: task.id, archive: false })}
                                data-testid={`button-unarchive-task-${task.id}`}
                                title="Unarchive"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => archiveMutation.mutate({ id: task.id, archive: true })}
                                data-testid={`button-archive-task-${task.id}`}
                                title="Archive"
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update task details below." : "Fill in the task details below."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Enter task title"
                data-testid="input-task-title"
              />
            </div>
            <div>
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
                data-testid="input-task-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-task-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assigned To *</Label>
                <Select value={form.assignedTo || "unassigned"} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v === "unassigned" ? "" : v }))}>
                  <SelectTrigger data-testid="select-task-assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">— Unassigned —</SelectItem>
                    {companyUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="task-due">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                data-testid="input-task-due-date"
              />
            </div>
            <div>
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
                rows={2}
                data-testid="input-task-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-task">
              {isPending ? "Saving..." : editingTask ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
