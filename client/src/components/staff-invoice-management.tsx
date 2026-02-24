import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileText, CheckCircle2, XCircle, DollarSign, MapPin, Clock, User, AlertCircle, ChevronLeft, Loader2, Filter, RefreshCw } from "lucide-react";
import { SiXero } from "react-icons/si";
import type { StaffInvoiceWithDetails } from "@shared/schema";

function statusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    submitted: { variant: "default", label: "Submitted" },
    approved: { variant: "secondary", label: "Approved" },
    rejected: { variant: "destructive", label: "Rejected" },
    paid: { variant: "outline", label: "Paid" },
  };
  const config = variants[status] || { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function InvoiceDetailView({ invoice, onBack }: { invoice: StaffInvoiceWithDetails; onBack: () => void }) {
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/staff-invoices/${invoice.id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices"] });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/staff-invoices/${invoice.id}/reject`, { reason: rejectReason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice rejected" });
      setRejectDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices"] });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/staff-invoices/${invoice.id}/pay`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice marked as paid" });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices"] });
      onBack();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: xeroStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/xero/status"],
    retry: false,
  });

  const xeroSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/xero/sync-invoice/${invoice.id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Synced to Xero", description: "Invoice has been created as a bill in Xero." });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices"] });
    },
    onError: (err: any) => {
      toast({ title: "Xero sync failed", description: err.message || "Failed to sync to Xero", variant: "destructive" });
    },
  });

  const inv = invoice as any;
  const canSyncToXero = xeroStatus?.connected && (invoice.status === 'approved' || invoice.status === 'paid') && !inv.xeroInvoiceId && inv.xeroSyncStatus !== 'synced';
  const canRetrySync = xeroStatus?.connected && inv.xeroSyncStatus === 'error' && !inv.xeroInvoiceId;
  const isSynced = inv.xeroSyncStatus === 'synced' && !!inv.xeroInvoiceId;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back">
        <ChevronLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle data-testid="text-invoice-number">{invoice.invoiceNumber}</CardTitle>
              <CardDescription>{format(new Date(invoice.createdAt!), "dd MMMM yyyy, HH:mm")}</CardDescription>
            </div>
            {statusBadge(invoice.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium" data-testid="text-guard-name">
              {invoice.guard?.firstName} {invoice.guard?.lastName}
            </span>
            {invoice.guard?.username && (
              <span className="text-muted-foreground">(@{invoice.guard.username})</span>
            )}
          </div>

          {invoice.rejectionReason && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Rejection reason</p>
                <p className="text-sm">{invoice.rejectionReason}</p>
              </div>
            </div>
          )}

          {invoice.approver && (
            <div className="text-sm text-muted-foreground">
              Approved by {invoice.approver.firstName} {invoice.approver.lastName}
              {invoice.approvedAt && ` on ${format(new Date(invoice.approvedAt), "dd MMM yyyy")}`}
            </div>
          )}

          {invoice.paidAt && (
            <div className="text-sm text-muted-foreground">
              Paid on {format(new Date(invoice.paidAt), "dd MMM yyyy, HH:mm")}
            </div>
          )}

          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3">Shift Breakdown</h4>
            <div className="space-y-2">
              {invoice.shifts?.map((is: any) => (
                <div key={is.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{is.site?.name || "Unknown Site"}</span>
                    </div>
                    {is.shift && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(is.shift.startTime), "dd MMM yyyy, HH:mm")} - {format(new Date(is.shift.endTime), "HH:mm")}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-right whitespace-nowrap">
                    <span className="text-muted-foreground">{is.hours}h @ £{is.rate}/h = </span>
                    <span className="font-medium">£{is.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-medium text-lg">Total</span>
            <span className="text-2xl font-bold" data-testid="text-total-amount">£{invoice.totalAmount}</span>
          </div>

          {(invoice.status === 'submitted' || invoice.status === 'approved') && (
            <>
              <Separator />
              <div className="flex items-center gap-2 flex-wrap">
                {invoice.status === 'submitted' && (
                  <>
                    <Button
                      onClick={() => approveMutation.mutate()}
                      disabled={approveMutation.isPending}
                      data-testid="button-approve"
                    >
                      {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectDialogOpen(true)}
                      data-testid="button-reject"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </>
                )}
                {invoice.status === 'approved' && (
                  <Button
                    onClick={() => payMutation.mutate()}
                    disabled={payMutation.isPending}
                    data-testid="button-pay"
                  >
                    {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
                    Mark as Paid
                  </Button>
                )}
              </div>
            </>
          )}

          {(isSynced || canSyncToXero || canRetrySync) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {isSynced ? (
                    <div className="flex items-center gap-2 text-sm">
                      <SiXero className="h-4 w-4 text-blue-500" />
                      <span className="text-muted-foreground">Synced to Xero</span>
                      {inv.xeroSyncedAt && (
                        <span className="text-xs text-muted-foreground">({format(new Date(inv.xeroSyncedAt), "dd MMM yyyy")})</span>
                      )}
                    </div>
                  ) : (canSyncToXero || canRetrySync) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => xeroSyncMutation.mutate()}
                      disabled={xeroSyncMutation.isPending}
                      data-testid="button-sync-xero"
                    >
                      {xeroSyncMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : canRetrySync ? (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      ) : (
                        <SiXero className="h-4 w-4 mr-2" />
                      )}
                      {canRetrySync ? "Retry Xero Sync" : "Sync to Xero"}
                    </Button>
                  ) : null}
                </div>
                {inv.xeroSyncStatus === 'error' && inv.xeroSyncError && (
                  <p className="text-xs text-destructive">{inv.xeroSyncError}</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Invoice</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. The shifts will become available for re-invoicing.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} data-testid="button-cancel-reject">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StaffInvoiceManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const queryParams = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data: invoices = [], isLoading } = useQuery<StaffInvoiceWithDetails[]>({
    queryKey: ["/api/staff-invoices", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/staff-invoices${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
  });

  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);

  if (selectedInvoice) {
    return <InvoiceDetailView invoice={selectedInvoice} onBack={() => setSelectedInvoiceId(null)} />;
  }

  const stats = {
    submitted: invoices.filter(i => i.status === "submitted").length,
    approved: invoices.filter(i => i.status === "approved").length,
    paid: invoices.filter(i => i.status === "paid").length,
    total: invoices.reduce((sum, i) => sum + parseFloat(i.totalAmount), 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" data-testid="text-staff-invoices-title">Staff Invoices</h2>
        <p className="text-sm text-muted-foreground">Review and manage employee payment invoices</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-pending-count">{stats.submitted}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-approved-count">{stats.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-paid-count">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold" data-testid="text-total-value">£{stats.total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No invoices found</p>
            <p className="text-muted-foreground mt-1">
              {statusFilter !== "all" ? "Try changing the filter." : "No staff invoices have been submitted yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Card
              key={invoice.id}
              className="cursor-pointer hover-elevate"
              onClick={() => setSelectedInvoiceId(invoice.id)}
              data-testid={`card-invoice-${invoice.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{invoice.invoiceNumber}</span>
                      {statusBadge(invoice.status)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {invoice.guard?.firstName} {invoice.guard?.lastName}
                      </span>
                      <span>{format(new Date(invoice.createdAt!), "dd MMM yyyy")}</span>
                      <span>{invoice.shifts?.length || 0} shift{(invoice.shifts?.length || 0) !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <span className="text-lg font-semibold" data-testid={`text-amount-${invoice.id}`}>
                    £{invoice.totalAmount}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
