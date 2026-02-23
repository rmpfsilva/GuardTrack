import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Clock, MapPin, DollarSign, ChevronRight, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { StaffInvoiceWithDetails, InvoicableShift } from "@shared/schema";

function statusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    submitted: { variant: "default", label: "Submitted" },
    approved: { variant: "secondary", label: "Approved" },
    rejected: { variant: "destructive", label: "Rejected" },
    paid: { variant: "outline", label: "Paid" },
  };
  const config = variants[status] || { variant: "outline" as const, label: status };
  return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
}

function CreateInvoiceView() {
  const { toast } = useToast();
  const [selectedShifts, setSelectedShifts] = useState<Set<string>>(new Set());

  const { data: invoicableShifts = [], isLoading } = useQuery<InvoicableShift[]>({
    queryKey: ["/api/staff-invoices/invoicable-shifts"],
  });

  const createMutation = useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const res = await apiRequest("POST", "/api/staff-invoices", { shiftIds });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invoice created", description: "Your invoice has been submitted for approval." });
      setSelectedShifts(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices/invoicable-shifts"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create invoice", variant: "destructive" });
    },
  });

  const toggleShift = (shiftId: string) => {
    setSelectedShifts(prev => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedShifts.size === invoicableShifts.length) {
      setSelectedShifts(new Set());
    } else {
      setSelectedShifts(new Set(invoicableShifts.map(s => s.shiftId)));
    }
  };

  const selectedTotal = invoicableShifts
    .filter(s => selectedShifts.has(s.shiftId))
    .reduce((sum, s) => sum + parseFloat(s.amount), 0);

  const selectedHours = invoicableShifts
    .filter(s => selectedShifts.has(s.shiftId))
    .reduce((sum, s) => sum + s.hours, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invoicableShifts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">All caught up</p>
          <p className="text-muted-foreground mt-1">No completed shifts awaiting invoicing.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-create-invoice-title">Create Invoice</h3>
          <p className="text-sm text-muted-foreground">{invoicableShifts.length} completed shift{invoicableShifts.length !== 1 ? "s" : ""} available</p>
        </div>
        <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
          {selectedShifts.size === invoicableShifts.length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="space-y-2">
        {invoicableShifts.map((shift) => (
          <Card
            key={shift.shiftId}
            className={`cursor-pointer transition-colors ${selectedShifts.has(shift.shiftId) ? "border-primary" : ""}`}
            onClick={() => toggleShift(shift.shiftId)}
            data-testid={`card-shift-${shift.shiftId}`}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedShifts.has(shift.shiftId)}
                  onCheckedChange={() => toggleShift(shift.shiftId)}
                  className="mt-1"
                  data-testid={`checkbox-shift-${shift.shiftId}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{shift.siteName}</span>
                    </div>
                    <span className="font-semibold text-sm" data-testid={`text-amount-${shift.shiftId}`}>
                      £{shift.amount}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(shift.checkInTime), "dd MMM yyyy, HH:mm")} - {format(new Date(shift.checkOutTime), "HH:mm")}
                    </span>
                    <span>{shift.hours}h @ £{shift.rate}/h</span>
                    {shift.jobTitle && <Badge variant="secondary" className="text-xs">{shift.jobTitle}</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedShifts.size > 0 && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm text-muted-foreground">{selectedShifts.size} shift{selectedShifts.size !== 1 ? "s" : ""} selected</p>
                <p className="text-xs text-muted-foreground">{selectedHours.toFixed(1)} hours total</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold" data-testid="text-invoice-total">£{selectedTotal.toFixed(2)}</span>
                <Button
                  onClick={() => createMutation.mutate(Array.from(selectedShifts))}
                  disabled={createMutation.isPending}
                  data-testid="button-submit-invoice"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Submit Invoice
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InvoiceDetail({ invoice, onBack }: { invoice: StaffInvoiceWithDetails; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-list">
        Back to invoices
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg" data-testid="text-invoice-number">{invoice.invoiceNumber}</CardTitle>
              <CardDescription>{format(new Date(invoice.createdAt!), "dd MMMM yyyy, HH:mm")}</CardDescription>
            </div>
            {statusBadge(invoice.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoice.rejectionReason && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Rejection reason</p>
                <p className="text-sm">{invoice.rejectionReason}</p>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Shift Breakdown</h4>
            <div className="space-y-2">
              {invoice.shifts?.map((is: any) => (
                <div key={is.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>{is.site?.name || "Unknown Site"}</span>
                  </div>
                  <div className="text-sm text-right">
                    <span className="text-muted-foreground">{is.hours}h @ £{is.rate}/h = </span>
                    <span className="font-medium">£{is.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-medium">Total</span>
            <span className="text-xl font-bold" data-testid="text-detail-total">£{invoice.totalAmount}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceListView() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useQuery<StaffInvoiceWithDetails[]>({
    queryKey: ["/api/staff-invoices"],
  });

  const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);

  if (selectedInvoice) {
    return <InvoiceDetail invoice={selectedInvoice} onBack={() => setSelectedInvoiceId(null)} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">No invoices yet</p>
          <p className="text-muted-foreground mt-1">Create your first invoice from completed shifts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => (
        <Card
          key={invoice.id}
          className="cursor-pointer hover-elevate"
          onClick={() => setSelectedInvoiceId(invoice.id)}
          data-testid={`card-invoice-${invoice.id}`}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{invoice.invoiceNumber}</span>
                  {statusBadge(invoice.status)}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>{format(new Date(invoice.createdAt!), "dd MMM yyyy")}</span>
                  <span>{invoice.shifts?.length || 0} shift{(invoice.shifts?.length || 0) !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold" data-testid={`text-invoice-amount-${invoice.id}`}>£{invoice.totalAmount}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function GuardInvoices() {
  const [view, setView] = useState<"create" | "list">("create");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={view === "create" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("create")}
          data-testid="button-view-create"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
        <Button
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("list")}
          data-testid="button-view-list"
        >
          <FileText className="h-4 w-4 mr-1" />
          My Invoices
        </Button>
      </div>

      {view === "create" ? <CreateInvoiceView /> : <InvoiceListView />}
    </div>
  );
}
