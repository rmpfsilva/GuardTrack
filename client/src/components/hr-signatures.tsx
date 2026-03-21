import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import {
  PenLine, Send, Search, Filter, Clock, CheckCircle2, AlertCircle,
  XCircle, Eye, RotateCcw, ChevronDown, ChevronUp, X, Download,
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
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { User, CompanyDocument, SignatureRequest } from "@shared/schema";

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

interface SigningModalProps {
  request: SignatureRequest;
  onClose: () => void;
}

function SigningModal({ request, onClose }: SigningModalProps) {
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

export default function HrSignatures() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sendOpen, setSendOpen] = useState(false);
  const [signingRequest, setSigningRequest] = useState<SignatureRequest | null>(null);
  const [sendForm, setSendForm] = useState({
    documentId: "", documentName: "", employeeIds: [] as string[],
    deadline: "", message: "",
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
      }),
      credentials: "include",
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/signature-requests"] });
      setSendOpen(false);
      setSendForm({ documentId: "", documentName: "", employeeIds: [], deadline: "", message: "" });
      toast({ title: `Signature request sent to ${sendForm.employeeIds.length} employee(s)` });
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests.filter(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const name = `${emp?.firstName || ""} ${emp?.lastName || ""}`.toLowerCase();
      const matchSearch = !q || (r.documentName || "").toLowerCase().includes(q) || name.includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [requests, employees, search, statusFilter]);

  const getEmpName = (id: string) => {
    const e = employees.find(u => u.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "—";
  };

  const toggleEmployee = (id: string) => {
    setSendForm(f => ({
      ...f,
      employeeIds: f.employeeIds.includes(id) ? f.employeeIds.filter(x => x !== id) : [...f.employeeIds, id],
    }));
  };

  return (
    <div className="space-y-4">
      {signingRequest && (
        <SigningModal request={signingRequest} onClose={() => setSigningRequest(null)} />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Signatures</h2>
          <p className="text-muted-foreground text-sm">Send documents for digital signature</p>
        </div>
        <Button onClick={() => setSendOpen(true)} data-testid="button-send-for-signature">
          <Send className="h-4 w-4 mr-2" />
          Send for Signature
        </Button>
      </div>

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
          <SelectTrigger className="w-40" data-testid="select-sig-status">
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
                  {filtered.map(req => (
                    <TableRow key={req.id} data-testid={`row-sig-${req.id}`}>
                      <TableCell className="font-medium text-sm max-w-48 truncate">
                        {req.documentName || "Untitled Document"}
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
                          {(req.status === "pending") && (
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
                            <Button size="icon" variant="ghost" title="View signature"
                              onClick={() => window.open(`/uploads/signatures/${req.signatureImagePath}`, "_blank")}
                              data-testid={`button-view-sig-${req.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Send for Signature Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-send-signature">
          <DialogHeader>
            <DialogTitle>Send for Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                  <SelectTrigger data-testid="select-sig-document"><SelectValue placeholder="Select document…" /></SelectTrigger>
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
                  <label key={emp.id} className="flex items-center gap-3 p-2.5 cursor-pointer hover-elevate" data-testid={`checkbox-employee-${emp.id}`}>
                    <input
                      type="checkbox"
                      checked={sendForm.employeeIds.includes(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{emp.role}</span>
                  </label>
                ))}
              </div>
              {sendForm.employeeIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{sendForm.employeeIds.length} employee(s) selected</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Deadline <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" value={sendForm.deadline} onChange={e => setSendForm(f => ({ ...f, deadline: e.target.value }))} data-testid="input-sig-deadline" />
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
    </div>
  );
}
