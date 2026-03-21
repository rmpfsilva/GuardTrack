import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, addDays, isAfter, isBefore } from "date-fns";
import {
  Users, Search, Download, Upload, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface GuardWithStats extends User {
  weeklyHours: number;
  totalShifts: number;
  isCurrentlyActive: boolean;
}

interface GuardDirectoryProps {
  onViewProfile?: (userId: string) => void;
}

const SIA_ROLES = ["guard", "supervisor"];
const PAGE_SIZE = 50;

const ROLE_LABELS: Record<string, string> = {
  guard: "SIA",
  steward: "Steward",
  supervisor: "Supervisor",
  admin: "Admin",
};

function getSiaStatus(expiry: Date | string | null | undefined) {
  if (!expiry) return null;
  const exp = new Date(expiry);
  const now = new Date();
  const in60 = addDays(now, 60);
  if (isBefore(exp, now)) return "expired";
  if (isBefore(exp, in60)) return "expiring";
  return "valid";
}

function ExpiryBadge({ expiry, role }: { expiry: Date | string | null | undefined; role: string }) {
  if (!SIA_ROLES.includes(role)) return <span className="text-muted-foreground text-sm">N/A</span>;
  if (!expiry) return <span className="text-muted-foreground text-sm">N/A</span>;
  const status = getSiaStatus(expiry);
  const formatted = format(new Date(expiry), "dd MMM yyyy");
  if (status === "expired") return <span className="text-destructive font-medium text-sm">{formatted}</span>;
  if (status === "expiring") return <span className="text-amber-600 dark:text-amber-400 font-medium text-sm">{formatted}</span>;
  return <span className="text-sm">{formatted}</span>;
}

function StatusBadge({ expiry, role, isActivated }: { expiry: Date | string | null | undefined; role: string; isActivated: boolean }) {
  if (!isActivated) return <Badge variant="secondary">Inactive</Badge>;
  if (!SIA_ROLES.includes(role)) return <Badge variant="outline">Active</Badge>;
  if (!expiry) return <Badge variant="outline">No SIA</Badge>;
  const status = getSiaStatus(expiry);
  const exp = new Date(expiry);
  const now = new Date();
  if (status === "expired") {
    const daysOver = Math.floor((now.getTime() - exp.getTime()) / 86400000);
    return <Badge className="bg-destructive text-destructive-foreground">{daysOver}d overdue</Badge>;
  }
  if (status === "expiring") {
    const daysLeft = Math.floor((exp.getTime() - now.getTime()) / 86400000);
    return <Badge className="bg-amber-500 text-white">{daysLeft}d left</Badge>;
  }
  return <Badge className="bg-green-600 text-white">Valid</Badge>;
}

export default function GuardDirectory({ onViewProfile }: GuardDirectoryProps) {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<"name" | "expiry" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    id: "", firstName: "", lastName: "", email: "", role: "guard",
    siaNumber: "", siaExpiryDate: "", stewardId: "", stewardIdExpiryDate: "",
  });

  const { data: guards = [], isLoading } = useQuery<GuardWithStats[]>({
    queryKey: ["/api/admin/guards"],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditOpen(false);
      toast({ title: "Employee updated" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteId(null);
      toast({ title: "Employee removed" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const openEdit = (g: GuardWithStats) => {
    setEditForm({
      id: g.id,
      firstName: g.firstName || "",
      lastName: g.lastName || "",
      email: g.email || "",
      role: g.role,
      siaNumber: g.siaNumber || "",
      siaExpiryDate: g.siaExpiryDate ? format(new Date(g.siaExpiryDate), "yyyy-MM-dd") : "",
      stewardId: g.stewardId || "",
      stewardIdExpiryDate: g.stewardIdExpiryDate ? format(new Date(g.stewardIdExpiryDate), "yyyy-MM-dd") : "",
    });
    setEditOpen(true);
  };

  const handleSave = () => {
    const payload: any = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      role: editForm.role,
      siaNumber: editForm.siaNumber || null,
      siaExpiryDate: editForm.siaExpiryDate || null,
      stewardId: editForm.stewardId || null,
      stewardIdExpiryDate: editForm.stewardIdExpiryDate || null,
    };
    updateMutation.mutate({ id: editForm.id, data: payload });
  };

  const toggleSort = (field: "name" | "expiry" | "status") => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return guards.filter(g => {
      const name = `${g.firstName || ""} ${g.lastName || ""}`.toLowerCase();
      const sia = (g.siaNumber || "").toLowerCase();
      const uname = (g.username || "").toLowerCase();
      const matchSearch = !q || name.includes(q) || sia.includes(q) || uname.includes(q);
      const matchType = typeFilter === "all" || g.role === typeFilter;
      const matchStatus = statusFilter === "all"
        || (statusFilter === "active" && g.isActivated)
        || (statusFilter === "inactive" && !g.isActivated);
      return matchSearch && matchType && matchStatus;
    });
  }, [guards, search, typeFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      } else if (sortField === "expiry") {
        const da = a.siaExpiryDate ? new Date(a.siaExpiryDate).getTime() : 0;
        const db_ = b.siaExpiryDate ? new Date(b.siaExpiryDate).getTime() : 0;
        cmp = da - db_;
      } else if (sortField === "status") {
        const order = { expired: 0, expiring: 1, valid: 2, null: 3 };
        const sa = getSiaStatus(a.siaExpiryDate) || "null";
        const sb = getSiaStatus(b.siaExpiryDate) || "null";
        cmp = (order[sa as keyof typeof order] ?? 3) - (order[sb as keyof typeof order] ?? 3);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const rows = [
      ["ID", "First Name", "Last Name", "Email", "Type", "SIA Number", "SIA Expiry", "Status"],
      ...sorted.map(g => [
        g.username,
        g.firstName || "",
        g.lastName || "",
        g.email || "",
        ROLE_LABELS[g.role] || g.role,
        g.siaNumber || "",
        g.siaExpiryDate ? format(new Date(g.siaExpiryDate), "dd/MM/yyyy") : "",
        g.isActivated ? "Active" : "Inactive",
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "employees.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const SortButton = ({ field, label }: { field: "name" | "expiry" | "status"; label: string }) => (
    <button
      className="flex items-center gap-1 font-medium hover:text-foreground text-muted-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Employees</h2>
          <p className="text-muted-foreground text-sm">
            Total: {guards.length} employee{guards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="default" onClick={exportCsv} data-testid="button-export-employees">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="default" data-testid="button-upload-csv">
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, name or SIA number…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
            data-testid="input-search-employees"
          />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="guard">SIA</SelectItem>
            <SelectItem value="steward">Steward</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">Loading employees…</div>
          ) : paginated.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No employees found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">ID</TableHead>
                    <TableHead><SortButton field="name" label="Name" /></TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">SIA #</TableHead>
                    <TableHead className="hidden md:table-cell">
                      <SortButton field="expiry" label="Expiry" />
                    </TableHead>
                    <TableHead><SortButton field="status" label="Status" /></TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(guard => (
                    <TableRow
                      key={guard.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onViewProfile?.(guard.id)}
                      data-testid={`row-employee-${guard.id}`}
                    >
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {guard.username}
                      </TableCell>
                      <TableCell>
                        <button
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                          onClick={e => { e.stopPropagation(); onViewProfile?.(guard.id); }}
                          data-testid={`link-employee-name-${guard.id}`}
                        >
                          {guard.firstName} {guard.lastName}
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{ROLE_LABELS[guard.role] || guard.role}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {SIA_ROLES.includes(guard.role) ? (guard.siaNumber || <span className="text-muted-foreground/50">N/A</span>) : <span className="text-muted-foreground/50">N/A</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <ExpiryBadge expiry={guard.siaExpiryDate} role={guard.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge expiry={guard.siaExpiryDate} role={guard.role} isActivated={guard.isActivated} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(guard)}
                            data-testid={`button-edit-employee-${guard.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(guard.id)}
                            data-testid={`button-delete-employee-${guard.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button size="icon" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-edit-employee">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-edit-first-name" />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-edit-last-name" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Email</Label>
              <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} data-testid="input-edit-email" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Role / Type</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guard">Security Guard (SIA)</SelectItem>
                  <SelectItem value="steward">Steward</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {SIA_ROLES.includes(editForm.role) && (
              <>
                <div className="space-y-1">
                  <Label>SIA Number</Label>
                  <Input value={editForm.siaNumber} onChange={e => setEditForm(f => ({ ...f, siaNumber: e.target.value }))} data-testid="input-edit-sia-number" />
                </div>
                <div className="space-y-1">
                  <Label>SIA Expiry</Label>
                  <Input type="date" value={editForm.siaExpiryDate} onChange={e => setEditForm(f => ({ ...f, siaExpiryDate: e.target.value }))} data-testid="input-edit-sia-expiry" />
                </div>
              </>
            )}
            {editForm.role === "steward" && (
              <>
                <div className="space-y-1">
                  <Label>Steward ID</Label>
                  <Input value={editForm.stewardId} onChange={e => setEditForm(f => ({ ...f, stewardId: e.target.value }))} data-testid="input-edit-steward-id" />
                </div>
                <div className="space-y-1">
                  <Label>Steward ID Expiry</Label>
                  <Input type="date" value={editForm.stewardIdExpiryDate} onChange={e => setEditForm(f => ({ ...f, stewardIdExpiryDate: e.target.value }))} data-testid="input-edit-steward-expiry" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-employee">
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this employee and all their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-employee"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
