import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FolderOpen, Upload, Download, Eye, Archive, Trash2, Search,
  File, FileText, Image, ArchiveRestore, Plus, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { User, CompanyDocument } from "@shared/schema";

const CATEGORIES = [
  "Contract", "Policy", "Procedure/SOP", "Certificate/Licence",
  "ID Document", "Risk Assessment", "Incident Report", "Payroll/Finance", "Other",
];

const VIEWABLE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType?: string | null }) {
  if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mimeType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function DocumentLibrary() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    name: "", category: "Other", employeeId: "", notes: "",
  });

  const { data: documents = [], isLoading } = useQuery<CompanyDocument[]>({
    queryKey: ["/api/admin/documents", showArchived ? "archived" : "active"],
    queryFn: () =>
      fetch(`/api/admin/documents?showArchived=${showArchived}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/guards"],
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("name", uploadForm.name || selectedFile.name);
      fd.append("category", uploadForm.category);
      if (uploadForm.employeeId) fd.append("employeeId", uploadForm.employeeId);
      if (uploadForm.notes) fd.append("notes", uploadForm.notes);
      const res = await fetch("/api/admin/documents/upload", {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadForm({ name: "", category: "Other", employeeId: "", notes: "" });
      toast({ title: "Document uploaded" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Upload failed", description: e.message }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/documents/${id}/archive`, { method: "PATCH", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Document archived" });
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/documents/${id}/unarchive`, { method: "PATCH", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Document restored" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/documents/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      setDeleteId(null);
      toast({ title: "Document deleted" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter(d => {
      const empName = employees.find(e => e.id === d.employeeId);
      const nameStr = `${empName?.firstName || ""} ${empName?.lastName || ""}`.toLowerCase();
      const matchSearch = !q || (d.originalName || "").toLowerCase().includes(q) || nameStr.includes(q);
      const matchCat = categoryFilter === "all" || d.category === categoryFilter;
      const matchEmp = employeeFilter === "all" || d.employeeId === employeeFilter;
      return matchSearch && matchCat && matchEmp;
    });
  }, [documents, employees, search, categoryFilter, employeeFilter]);

  const getEmployeeName = (id?: string | null) => {
    if (!id) return <span className="text-muted-foreground italic">Company-wide</span>;
    const e = employees.find(u => u.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "—";
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Document Library</h2>
          <p className="text-muted-foreground text-sm">Central store for company and employee documents</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} data-testid="button-upload-document">
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by filename or employee…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-documents"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44" data-testid="select-doc-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-44" data-testid="select-doc-employee">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            <SelectItem value="company">Company-wide</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" data-testid="toggle-show-archived" />
          <Label htmlFor="show-archived" className="text-sm cursor-pointer">Show Archived</Label>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              No documents found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden lg:table-cell">Employee</TableHead>
                    <TableHead className="hidden lg:table-cell">Size</TableHead>
                    <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(doc => (
                    <TableRow key={doc.id} data-testid={`row-doc-${doc.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileTypeIcon mimeType={doc.fileType} />
                          <span className="font-medium text-sm truncate max-w-48">{doc.originalName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{getEmployeeName(doc.employeeId)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatBytes(doc.fileSize)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {doc.uploadedAt ? format(new Date(doc.uploadedAt), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={doc.status === "archived" ? "secondary" : "default"} className="text-xs">
                          {doc.status === "archived" ? "Archived" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {VIEWABLE_TYPES.includes(doc.fileType || "") && (
                            <Button size="icon" variant="ghost" title="View"
                              onClick={() => window.open(`/api/admin/documents/${doc.id}/download`, "_blank")}
                              data-testid={`button-view-doc-${doc.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Download"
                            onClick={() => window.open(`/api/admin/documents/${doc.id}/download`, "_blank")}
                            data-testid={`button-download-doc-${doc.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                          {doc.status === "active" ? (
                            <Button size="icon" variant="ghost" title="Archive"
                              onClick={() => archiveMutation.mutate(doc.id)}
                              data-testid={`button-archive-doc-${doc.id}`}>
                              <Archive className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" title="Restore"
                              onClick={() => unarchiveMutation.mutate(doc.id)}
                              data-testid={`button-restore-doc-${doc.id}`}>
                              <ArchiveRestore className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Delete"
                            onClick={() => setDeleteId(doc.id)}
                            data-testid={`button-delete-doc-${doc.id}`}>
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

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-upload-document">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* File picker */}
            <div
              className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover-elevate"
              onClick={() => fileInputRef.current?.click()}
              data-testid="drop-zone-file"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSelectedFile(f);
                    setUploadForm(prev => ({ ...prev, name: f.name }));
                  }
                }}
                data-testid="input-file-upload"
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileTypeIcon mimeType={selectedFile.type} />
                  <span className="text-sm font-medium">{selectedFile.name}</span>
                  <Button
                    size="icon" variant="ghost"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select a file</p>
                  <p className="text-xs text-muted-foreground">PDF, Word, Excel, images — max 50 MB</p>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Document Name</Label>
              <Input
                value={uploadForm.name}
                onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Display name for this document"
                data-testid="input-doc-name"
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={uploadForm.category} onValueChange={v => setUploadForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-upload-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Link to Employee <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={uploadForm.employeeId} onValueChange={v => setUploadForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger data-testid="select-upload-employee"><SelectValue placeholder="Company-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Company-wide</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={uploadForm.notes}
                onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Any additional notes…"
                data-testid="input-doc-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || uploadMutation.isPending}
              data-testid="button-confirm-upload"
            >
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              data-testid="button-confirm-delete-doc"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
