import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  PenLine,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderOpen,
  Trash2,
  X,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PendingDoc {
  id: string;
  documentId: string | null;
  documentName: string | null;
  sentBy: string;
  sentAt: string;
  deadline: string | null;
  message: string | null;
  status: string;
  type: string;
  siteId: string | null;
  viewedAt: string | null;
  senderFirstName: string | null;
  senderLastName: string | null;
  siteName: string | null;
  companyId: string;
  docFilename: string | null;
  docFileType: string | null;
}

interface SharedDoc {
  id: string;
  documentId: string;
  filename: string;
  originalName: string | null;
  category: string;
  fileType: string | null;
  sharedAt: string;
  sharedByFirstName: string | null;
  sharedByLastName: string | null;
}

// ─── Signature Canvas ─────────────────────────────────────────────────────────
function SignatureCanvas({ onSigned }: { onSigned: (data: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: MouseEvent | Touch, rect: DOMRect) => ({
    x: (e instanceof Touch ? e.clientX : (e as MouseEvent).clientX) - rect.left,
    y: (e instanceof Touch ? e.clientY : (e as MouseEvent).clientY) - rect.top,
  });

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(
      "touches" in e ? e.touches[0] : (e as React.MouseEvent).nativeEvent,
      rect
    );
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const pos = getPos(
      "touches" in e ? e.touches[0] : (e as React.MouseEvent).nativeEvent,
      rect
    );
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasDrawn.current = true;
    setIsEmpty(false);
  };

  const stopDraw = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    setIsEmpty(true);
  };

  const submit = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    onSigned(canvas.toDataURL("image/png"));
  };

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      // preserve drawn content temporarily
      const imgData = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = w;
      canvas.height = Math.max(300, Math.min(400, window.innerHeight * 0.35));
      if (imgData) canvas.getContext("2d")?.putImageData(imgData, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Please review the document above, then sign below using your finger or stylus.
      </p>
      <div className="relative rounded-md border-2 border-dashed border-border bg-white overflow-hidden">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-muted-foreground/50 text-base select-none">Sign here</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          data-testid="canvas-signature"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} data-testid="button-clear-signature">
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
        <Button
          size="sm"
          disabled={isEmpty}
          onClick={submit}
          className="flex-1"
          data-testid="button-submit-signature"
        >
          <PenLine className="h-4 w-4 mr-1" />
          Submit Signature
        </Button>
      </div>
    </div>
  );
}

// ─── Document Viewer ──────────────────────────────────────────────────────────
function DocViewer({ doc }: { doc: PendingDoc }) {
  const isPdf = doc.docFileType === "application/pdf" || doc.docFilename?.endsWith(".pdf");
  const downloadUrl = doc.documentId ? `/uploads/documents/${doc.docFilename}` : null;

  if (!doc.documentId) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No document file attached. Please review the message below before signing.
      </p>
    );
  }

  if (isPdf && downloadUrl) {
    return (
      <div className="rounded-md border overflow-hidden" style={{ height: "340px" }}>
        <iframe
          src={`${downloadUrl}#view=FitH`}
          className="w-full h-full"
          title="Document to sign"
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border p-4 flex items-center gap-3 bg-muted/30">
      <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{doc.documentName || "Document"}</p>
        <p className="text-xs text-muted-foreground">Open the file to review it before signing.</p>
      </div>
      <Button variant="outline" size="sm" asChild className="shrink-0" data-testid="button-download-to-review">
        <a href={downloadUrl || "#"} download target="_blank" rel="noreferrer">
          <Download className="h-4 w-4 mr-1" />
          Open
        </a>
      </Button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function GuardDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviewDoc, setReviewDoc] = useState<PendingDoc | null>(null);
  const [signed, setSigned] = useState(false);

  const { data: pending = [], isLoading: loadPending } = useQuery<PendingDoc[]>({
    queryKey: ["/api/guard/documents/pending"],
  });

  const { data: shared = [], isLoading: loadShared } = useQuery<SharedDoc[]>({
    queryKey: ["/api/guard/documents/shared"],
  });

  const markViewedMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/guard/signature-requests/${id}/viewed`, {}),
  });

  const signMutation = useMutation({
    mutationFn: ({ id, signatureData }: { id: string; signatureData: string }) =>
      apiRequest("POST", `/api/signature-requests/${id}/sign`, { signatureData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guard/documents/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guard/documents/count"] });
      setSigned(true);
    },
    onError: () => toast({ title: "Error", description: "Failed to submit signature.", variant: "destructive" }),
  });

  const openReview = (doc: PendingDoc) => {
    setReviewDoc(doc);
    setSigned(false);
    if (!doc.viewedAt) markViewedMutation.mutate(doc.id);
  };

  const closeReview = () => {
    setReviewDoc(null);
    setSigned(false);
  };

  const handleSigned = (signatureData: string) => {
    if (!reviewDoc) return;
    signMutation.mutate({ id: reviewDoc.id, signatureData });
  };

  if (loadPending || loadShared) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Section A: Documents to Sign ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <PenLine className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Documents to Sign</h3>
          {pending.length > 0 && (
            <Badge variant="destructive" className="text-xs">{pending.length}</Badge>
          )}
        </div>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm text-muted-foreground">No documents awaiting your signature.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map(doc => {
              const isNew = !doc.viewedAt;
              const isOverdue = doc.deadline && new Date(doc.deadline) < new Date();
              return (
                <Card
                  key={doc.id}
                  className={isNew ? "border-primary/60" : ""}
                  data-testid={`card-pending-doc-${doc.id}`}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{doc.documentName || "Document"}</p>
                          {isNew && <Badge variant="default" className="text-xs shrink-0">New</Badge>}
                          {doc.type === "site_document" && (
                            <Badge variant="secondary" className="text-xs shrink-0">Site Doc</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          From: {doc.senderFirstName} {doc.senderLastName}
                          {doc.siteName && ` · ${doc.siteName}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Received {format(new Date(doc.sentAt), "dd MMM yyyy")}
                        </p>
                        {doc.deadline && (
                          <p className={`text-xs flex items-center gap-1 mt-1 ${isOverdue ? "text-destructive" : "text-amber-600"}`}>
                            {isOverdue
                              ? <AlertTriangle className="h-3 w-3" />
                              : <Clock className="h-3 w-3" />}
                            {isOverdue ? "Overdue" : "Due"}: {format(new Date(doc.deadline), "dd MMM yyyy")}
                          </p>
                        )}
                        {doc.message && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                            "{doc.message}"
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => openReview(doc)}
                      data-testid={`button-review-sign-${doc.id}`}
                    >
                      <PenLine className="h-4 w-4 mr-1" />
                      Review and Sign
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Section B: Shared Documents ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold text-base">My Documents</h3>
        </div>

        {shared.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No documents shared with you yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {shared.map(doc => (
              <Card key={doc.id} data-testid={`card-shared-doc-${doc.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.originalName || doc.filename}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {doc.category} · Shared {format(new Date(doc.sharedAt), "dd MMM yyyy")}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild data-testid={`button-download-shared-${doc.id}`}>
                      <a href={`/api/guard/documents/shared/${doc.id}/download`} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ─── Review & Sign Dialog ─── */}
      <Dialog open={!!reviewDoc} onOpenChange={open => !open && closeReview()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {reviewDoc?.documentName || "Document to Sign"}
            </DialogTitle>
          </DialogHeader>

          {signed ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="font-semibold text-lg">Signature Submitted</p>
              <p className="text-sm text-muted-foreground">
                Thank you — your signature has been submitted and sent to your company.
              </p>
              <Button variant="outline" onClick={closeReview} data-testid="button-close-after-sign">
                Close
              </Button>
            </div>
          ) : reviewDoc ? (
            <div className="space-y-4">
              {reviewDoc.message && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Message from admin:</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{reviewDoc.message}</p>
                </div>
              )}

              {reviewDoc.type === "site_document" && reviewDoc.siteName && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Site Document</Badge>
                  <span className="text-sm text-muted-foreground">{reviewDoc.siteName}</span>
                </div>
              )}

              <DocViewer doc={reviewDoc} />
              <SignatureCanvas onSigned={handleSigned} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
