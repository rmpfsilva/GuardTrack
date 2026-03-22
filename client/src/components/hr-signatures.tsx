import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import {
  PenLine, Send, Search, Clock, CheckCircle2, AlertCircle,
  XCircle, Eye, RotateCcw, X, Download, Share2, MapPin, FolderOpen, Plus, Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, CompanyDocument, SignatureRequest, Site } from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────
interface SharedDocRow {
  id: string;
  employeeId: string;
  documentId: string;
  sharedAt: string;
  isActive: boolean;
  removedAt: string | null;
  filename: string;
  originalName: string | null;
  category: string;
  fileType: string | null;
  empFirstName: string | null;
  empLastName: string | null;
}

// ─── Status helpers ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: any }> = {
  pending: { label: "Pending", badge: "bg-amber-500 text-white", icon: Clock },
  signed: { label: "Signed", badge: "bg-green-600 text-white", icon: CheckCircle2 },
  overdue: { label: "Overdue", badge: "bg-destructive text-destructive-foreground", icon: AlertCircle },
  declined: { label: "Declined", badge: "bg-muted text-muted-foreground", icon: XCircle },
};

function StatusBadge({ status, deadline }: { status: string; deadline?: Date | string | null }) {
  const isOverdue = status === "pending" && deadline && isPast(new Date(deadline));
  const eff = isOverdue ? "overdue" : status;
  const cfg = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
  return <Badge className={`${cfg.badge} text-xs`}>{cfg.label}</Badge>;
}

// ─── Admin Signing Modal ─────────────────────────────────────────────────────
function SigningModal({ request, onClose }: { request: SignatureRequest; onClose: () => void }) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current || !lastPos.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { isDrawing.current = false; lastPos.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const signMutation = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not ready");
      const signatureData = canvas.toDataURL("image/png");
      const res = await fetch(`/api/signature-requests/${request.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData }),
        credentials: "include",
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/signature-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-signature-requests"] });
      toast({ title: "Document signed successfully" });
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-signing">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Sign Document
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-md p-3 text-sm">
            <p className="font-medium">{request.documentName || "Document"}</p>
            {request.message && <p className="text-muted-foreground mt-1">{request.message}</p>}
            {request.deadline && (
              <p className="text-xs text-muted-foreground mt-1">
                Deadline: {format(new Date(request.deadline), "dd MMM yyyy")}
              </p>
            )}
          </div>
          <div>
            <Label className="mb-2 block">Sign below using your finger or mouse</Label>
            <canvas
              ref={canvasRef}
              width={560}
              height={200}
              className="w-full border rounded-md bg-white touch-none cursor-crosshair"
              style={{ height: 160 }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
              data-testid="signature-canvas"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clearCanvas} data-testid="button-clear-signature">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => signMutation.mutate()} disabled={signMutation.isPending} data-testid="button-submit-signature">
            {signMutation.isPending ? "Submitting…" : "Submit Signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HrSignatures() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [sendOpen, setSendOpen] = useState(false);
  const [signingRequest, setSigningRequest] = useState<SignatureRequest | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareForm, setShareForm] = useState({ employeeId: "", documentId: "" });
  const [sendForm, setSendForm] = useState({
    type: "signature" as "signature" | "site_document",
    documentId: "", documentName: "", employeeIds: [] as string[],
    deadline: "", message: "", siteId: "",
  });

  const { data: requests = [], isLoading } = useQuery<SignatureRequest[]>({
    queryKey: ["/api/admin/signature-requests"],
  });

  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/guards"],
  });

  const { data: documents = [] } = useQuery<CompanyDocument[]>({
    queryKey: ["/api/admin/documents", "active"],
    queryFn: () => fetch("/api/admin/documents?showArchived=false", { credentials: "include" }).then(r => r.json()),
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/admin/sites"],
  });

  const { data: sharedDocs = [], isLoading: sharedLoading } = useQuery<SharedDocRow[]>({
    queryKey: ["/api/admin/shared-documents"],
  });

  const sendMutation = useMutation({
    mutationFn: () => fetch("/api/admin/signature-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: sendForm.documentId || null,
        documentName: sendForm.documentName,
        employeeIds: sendForm.employeeIds,
        deadline: sendForm.deadline || null,
        message: sendForm.message || null,
        type: sendForm.type,
        siteId: sendForm.type === "site_document" ? (sendForm.siteId || null) : null,
      }),
      credentials: "include",
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/signature-requests"] });
      setSendOpen(false);
      setSendForm({ type: "signature", documentId: "", documentName: "", employeeIds: [], deadline: "", message: "", siteId: "" });
      toast({ title: `Request sent to ${sendForm.employeeIds.length} employee(s)` });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const reminderMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/signature-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
      credentials: "include",
    }).then(r => r.json()),
    onSuccess: () => toast({ title: "Reminder sent (in-app)" }),
  });

  const shareMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/shared-documents", shareForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shared-documents"] });
      setShareDialogOpen(false);
      setShareForm({ employeeId: "", documentId: "" });
      toast({ title: "Document shared with employee" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const removeSharMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/shared-documents/${id}/remove`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/shared-documents"] });
      toast({ title: "Shared document removed" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const name = `${emp?.firstName || ""} ${emp?.lastName || ""}`.toLowerCase();
      const matchSearch = !q || (r.documentName || "").toLowerCase().includes(q) || name.includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchType = typeFilter === "all" || (r as any).type === typeFilter;
      const matchSite = siteFilter === "all" || (r as any).siteId === siteFilter;
      return matchSearch && matchStatus && matchType && matchSite;
    });
  }, [requests, employees, search, statusFilter, typeFilter, siteFilter]);

  const getEmpName = (id: string) => {
    const e = employees.find(u => u.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "—";
  };

  const getSiteName = (id: string | null | undefined) => {
    if (!id) return null;
    const s = sites.find(s => s.id === id);
    return s?.name || null;
  };

  const toggleEmployee = (id: string) => {
    setSendForm(f => ({
      ...f,
      employeeIds: f.employeeIds.includes(id) ? f.employeeIds.filter(x => x !== id) : [...f.employeeIds, id],
    }));
  };

  const activeShared = sharedDocs.filter(d => d.isActive);

  return (
    <div className="space-y-4">
      {signingRequest && (
        <SigningModal request={signingRequest} onClose={() => setSigningRequest(null)} />
      )}

      <Tabs defaultValue="requests">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h2 className="text-2xl font-bold">Signatures</h2>
            <p className="text-muted-foreground text-sm">Document signing and sharing</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShareDialogOpen(true)} data-testid="button-share-document">
              <Share2 className="h-4 w-4 mr-2" />
              Share Document
            </Button>
            <Button onClick={() => setSendOpen(true)} data-testid="button-send-for-signature">
              <Send className="h-4 w-4 mr-2" />
              Send for Signature
            </Button>
          </div>
        </div>

        <TabsList className="mb-4">
          <TabsTrigger value="requests" data-testid="tab-sig-requests">Signature Requests</TabsTrigger>
          <TabsTrigger value="shared" data-testid="tab-sig-shared">
            Shared Documents
            {activeShared.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{activeShared.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Signature Requests Tab ─── */}
        <TabsContent value="requests" className="space-y-4 mt-0">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by document or employee…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-signatures"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36" data-testid="select-sig-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36" data-testid="select-sig-type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="signature">Standard</SelectItem>
                <SelectItem value="site_document">Site Document</SelectItem>
              </SelectContent>
            </Select>
            {sites.length > 0 && (
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-40" data-testid="select-sig-site">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Requests Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <PenLine className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  No signature requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead className="hidden md:table-cell">Sent</TableHead>
                        <TableHead className="hidden md:table-cell">Deadline</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(req => {
                        const r = req as any;
                        const siteName = getSiteName(r.siteId);
                        return (
                          <TableRow key={req.id} data-testid={`row-sig-${req.id}`}>
                            <TableCell className="font-medium text-sm max-w-48">
                              <div className="space-y-1">
                                <p className="truncate">{req.documentName || "Untitled Document"}</p>
                                <div className="flex flex-wrap gap-1">
                                  {r.type === "site_document" && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      <MapPin className="h-2.5 w-2.5 mr-0.5" />
                                      Site Doc
                                    </Badge>
                                  )}
                                  {siteName && (
                                    <span className="text-[10px] text-muted-foreground">{siteName}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{getEmpName(req.employeeId)}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {req.sentAt ? format(new Date(req.sentAt), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {req.deadline ? format(new Date(req.deadline), "dd MMM yyyy") : "—"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={req.status} deadline={req.deadline} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {req.status === "pending" && (
                                  <>
                                    <Button size="sm" variant="outline"
                                      onClick={() => setSigningRequest(req)}
                                      data-testid={`button-sign-${req.id}`}>
                                      Sign
                                    </Button>
                                    <Button size="icon" variant="ghost" title="Send reminder"
                                      onClick={() => reminderMutation.mutate(req.id)}
                                      data-testid={`button-remind-${req.id}`}>
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {req.status === "signed" && req.signatureImagePath && (
                                  <Button size="icon" variant="ghost" title="Download signature"
                                    asChild
                                    data-testid={`button-download-sig-${req.id}`}>
                                    <a href={`/api/admin/signature-requests/${req.id}/download`} download>
                                      <Download className="h-4 w-4" />
                                    </a>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Shared Documents Tab ─── */}
        <TabsContent value="shared" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Permanently Shared Documents
              </CardTitle>
              <Button size="sm" onClick={() => setShareDialogOpen(true)} data-testid="button-share-document-2">
                <Plus className="h-4 w-4 mr-1" />
                Share Document
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {sharedLoading ? (
                <div className="py-12 text-center text-muted-foreground">Loading…</div>
              ) : activeShared.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No documents permanently shared with employees yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Shared With</TableHead>
                        <TableHead className="hidden md:table-cell">Category</TableHead>
                        <TableHead className="hidden md:table-cell">Shared On</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeShared.map(doc => (
                        <TableRow key={doc.id} data-testid={`row-shared-${doc.id}`}>
                          <TableCell className="font-medium text-sm max-w-48 truncate">
                            {doc.originalName || doc.filename}
                          </TableCell>
                          <TableCell className="text-sm">
                            {doc.empFirstName} {doc.empLastName}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground capitalize">
                            {doc.category}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {doc.sharedAt ? format(new Date(doc.sharedAt), "dd MMM yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Remove shared access"
                              onClick={() => removeSharMutation.mutate(doc.id)}
                              disabled={removeSharMutation.isPending}
                              data-testid={`button-remove-shared-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Send for Signature Dialog ─── */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-send-signature">
          <DialogHeader>
            <DialogTitle>Send for Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-1">
              <Label>Request Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={sendForm.type === "signature" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSendForm(f => ({ ...f, type: "signature", siteId: "" }))}
                  data-testid="button-type-standard"
                >
                  <PenLine className="h-4 w-4 mr-1" />
                  Standard Signature
                </Button>
                <Button
                  variant={sendForm.type === "site_document" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSendForm(f => ({ ...f, type: "site_document" }))}
                  data-testid="button-type-site"
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  Site Document
                </Button>
              </div>
            </div>

            {sendForm.type === "site_document" && (
              <div className="space-y-1">
                <Label>Site <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select
                  value={sendForm.siteId || "none"}
                  onValueChange={v => setSendForm(f => ({ ...f, siteId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger data-testid="select-sig-site-send">
                    <SelectValue placeholder="Select site…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific site</SelectItem>
                    {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Document Name</Label>
              <Input
                value={sendForm.documentName}
                onChange={e => setSendForm(f => ({ ...f, documentName: e.target.value }))}
                placeholder="e.g. Employment Contract 2026"
                data-testid="input-sig-doc-name"
              />
            </div>

            {documents.length > 0 && (
              <div className="space-y-1">
                <Label>Link to Library Document <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select
                  value={sendForm.documentId || "none"}
                  onValueChange={v => {
                    const realV = v === "none" ? "" : v;
                    const doc = documents.find(d => d.id === realV);
                    setSendForm(f => ({ ...f, documentId: realV, documentName: f.documentName || doc?.originalName || "" }));
                  }}
                >
                  <SelectTrigger data-testid="select-sig-document">
                    <SelectValue placeholder="Select document…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {documents.map(d => <SelectItem key={d.id} value={d.id}>{d.originalName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Select Employees <span className="text-muted-foreground text-xs">(required)</span></Label>
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {employees.map(emp => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 p-2.5 cursor-pointer hover-elevate"
                    data-testid={`checkbox-employee-${emp.id}`}
                  >
                    <input
                      type="checkbox"
                      checked={sendForm.employeeIds.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                    <span className="text-xs text-muted-foreground ml-auto capitalize">{emp.role}</span>
                  </label>
                ))}
              </div>
              {sendForm.employeeIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{sendForm.employeeIds.length} employee(s) selected</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Deadline <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                type="date"
                value={sendForm.deadline}
                onChange={e => setSendForm(f => ({ ...f, deadline: e.target.value }))}
                data-testid="input-sig-deadline"
              />
            </div>

            <div className="space-y-1">
              <Label>Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={sendForm.message}
                onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
                rows={2}
                placeholder="Add a message to the recipient…"
                data-testid="input-sig-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !sendForm.documentName || sendForm.employeeIds.length === 0}
              data-testid="button-confirm-send-signature"
            >
              {sendMutation.isPending ? "Sending…" : "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Share Document Permanently Dialog ─── */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-share-document">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Document with Employee
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The employee will have permanent access to this document in their Documents tab until you remove it.
          </p>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Employee</Label>
              <Select value={shareForm.employeeId || "none"} onValueChange={v => setShareForm(f => ({ ...f, employeeId: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-share-employee">
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select employee…</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Document</Label>
              <Select value={shareForm.documentId || "none"} onValueChange={v => setShareForm(f => ({ ...f, documentId: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-share-document">
                  <SelectValue placeholder="Select document…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select document…</SelectItem>
                  {documents.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.originalName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => shareMutation.mutate()}
              disabled={shareMutation.isPending || !shareForm.employeeId || !shareForm.documentId}
              data-testid="button-confirm-share-document"
            >
              {shareMutation.isPending ? "Sharing…" : "Share Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
