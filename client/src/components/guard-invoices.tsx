import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, isWithinInterval,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  FileText, Plus, Clock, MapPin, ChevronRight, CheckCircle2,
  XCircle, Loader2, PoundSterling, Printer, Send, AlertCircle,
  CalendarDays, ReceiptText,
} from "lucide-react";
import type { StaffInvoiceWithDetails, InvoicableShift } from "@shared/schema";

// ─── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    submitted: { variant: "default",     label: "Awaiting Approval" },
    approved:  { variant: "secondary",   label: "Approved" },
    rejected:  { variant: "destructive", label: "Rejected" },
    paid:      { variant: "outline",     label: "Paid" },
  };
  const cfg = map[status] || { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Period filter type ──────────────────────────────────────────────────────
type Period = "today" | "week" | "month" | "all";

function periodLabel(p: Period) {
  return { today: "Today", week: "This Week", month: "This Month", all: "All Shifts" }[p];
}

function shiftsInPeriod(shifts: InvoicableShift[], period: Period): InvoicableShift[] {
  if (period === "all") return shifts;
  const now = new Date();
  const intervals: Record<Exclude<Period, "all">, { start: Date; end: Date }> = {
    today: { start: startOfDay(now),                          end: endOfDay(now) },
    week:  { start: startOfWeek(now, { weekStartsOn: 1 }),   end: endOfWeek(now,  { weekStartsOn: 1 }) },
    month: { start: startOfMonth(now),                       end: endOfMonth(now) },
  };
  const iv = intervals[period as Exclude<Period, "all">];
  return shifts.filter(s => isWithinInterval(new Date(s.checkInTime as any), iv));
}

// ─── Print invoice helper ────────────────────────────────────────────────────
function printInvoice(invoice: StaffInvoiceWithDetails) {
  const guardName = invoice.guard
    ? `${(invoice.guard as any).firstName || ""} ${(invoice.guard as any).lastName || ""}`.trim() || (invoice.guard as any).username
    : "Guard";
  const companyName = (invoice.company as any)?.name || "Company";

  const rows = (invoice.shifts || []).map((is: any) => `
    <tr>
      <td>${is.site?.name || is.shift?.jobTitle || "Shift"}</td>
      <td>${is.hours}h</td>
      <td>£${is.rate}/hr</td>
      <td style="text-align:right">£${parseFloat(is.amount).toFixed(2)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body{font-family:sans-serif;max-width:700px;margin:40px auto;color:#111;font-size:14px}
    h1{font-size:24px;margin:0}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .meta{color:#555;font-size:13px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    th{text-align:left;border-bottom:2px solid #111;padding:8px 0;font-size:13px}
    td{padding:8px 0;border-bottom:1px solid #e5e5e5;font-size:13px}
    .total-row td{font-weight:bold;border-top:2px solid #111;border-bottom:none;padding-top:12px;font-size:16px}
    .status{display:inline-block;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
    @media print{body{margin:20px}}
  </style></head><body>
  <div class="header">
    <div>
      <h1>Invoice</h1>
      <div class="meta">${invoice.invoiceNumber}</div>
      <div class="meta">Issued: ${format(new Date(invoice.createdAt!), "dd MMMM yyyy")}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:600">${guardName}</div>
      <div class="meta">To: ${companyName}</div>
      <div style="margin-top:8px"><span class="status">${invoice.status.toUpperCase()}</span></div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Hours</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3">Total</td>
        <td style="text-align:right">£${parseFloat(String(invoice.totalAmount)).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <script>window.onload=()=>{window.print();}</script>
  </body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── Create Invoice View ─────────────────────────────────────────────────────
function CreateInvoiceView({ onCreated }: { onCreated: (invoice: StaffInvoiceWithDetails) => void }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("week");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: allShifts = [], isLoading } = useQuery<InvoicableShift[]>({
    queryKey: ["/api/staff-invoices/invoicable-shifts"],
  });

  const createMutation = useMutation({
    mutationFn: async (shiftIds: string[]) => {
      const res = await apiRequest("POST", "/api/staff-invoices", { shiftIds });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create invoice");
      }
      return res.json() as Promise<StaffInvoiceWithDetails>;
    },
    onSuccess: (invoice) => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invoices/invoicable-shifts"] });
      onCreated(invoice);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create invoice", variant: "destructive" });
    },
  });

  const visibleShifts = shiftsInPeriod(allShifts, period);

  const toggle = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectPeriod = () => {
    const ids = new Set(visibleShifts.map(s => s.shiftId));
    const allSelected = visibleShifts.every(s => selected.has(s.shiftId));
    setSelected(allSelected ? new Set([...selected].filter(id => !ids.has(id))) : new Set([...selected, ...ids]));
  };

  const selectedList = allShifts.filter(s => selected.has(s.shiftId));
  const totalAmount = selectedList.reduce((sum, s) => sum + parseFloat(s.amount), 0);
  const totalHours  = selectedList.reduce((sum, s) => sum + s.hours, 0);

  // Group visible shifts by date
  const grouped = visibleShifts.reduce<Record<string, InvoicableShift[]>>((acc, s) => {
    const key = format(new Date(s.checkInTime as any), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});
  const groupDates = Object.keys(grouped).sort().reverse();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allShifts.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <CheckCircle2 className="h-14 w-14 mx-auto text-muted-foreground" />
        <p className="text-lg font-semibold">All caught up</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          No completed shifts are available for invoicing. Shifts appear here once you have checked out.
        </p>
      </div>
    );
  }

  const periods: Period[] = ["today", "week", "month", "all"];

  return (
    <div className="space-y-4 pb-32">
      {/* Period selector */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground font-medium">Select a period</p>
        <div className="grid grid-cols-4 gap-2">
          {periods.map(p => {
            const count = shiftsInPeriod(allShifts, p).length;
            return (
              <button
                key={p}
                onClick={() => { setPeriod(p); setSelected(new Set()); }}
                data-testid={`button-period-${p}`}
                className={`rounded-md border p-2 text-center transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover-elevate"
                }`}
              >
                <div className="text-[11px] font-medium leading-tight">{periodLabel(p)}</div>
                <div className={`text-lg font-bold leading-tight ${period === p ? "" : "text-primary"}`}>{count}</div>
                <div className="text-[10px] opacity-70">shift{count !== 1 ? "s" : ""}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Select all / deselect for this period */}
      {visibleShifts.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{periodLabel(period)}</p>
          <Button variant="ghost" size="sm" onClick={selectPeriod} data-testid="button-select-period">
            {visibleShifts.every(s => selected.has(s.shiftId)) ? "Deselect all" : `Select all ${visibleShifts.length}`}
          </Button>
        </div>
      )}

      {visibleShifts.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No shifts in this period. Try "All Shifts".
        </div>
      ) : (
        <div className="space-y-4">
          {groupDates.map(dateKey => {
            const dayShifts = grouped[dateKey];
            const dayDate = new Date(dateKey);
            const dayTotal = dayShifts.reduce((s, sh) => s + parseFloat(sh.amount), 0);
            const allDaySelected = dayShifts.every(s => selected.has(s.shiftId));

            return (
              <div key={dateKey} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-semibold">{format(dayDate, "EEEE, d MMMM")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">£{dayTotal.toFixed(2)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => {
                        const ids = dayShifts.map(s => s.shiftId);
                        setSelected(prev => {
                          const n = new Set(prev);
                          if (allDaySelected) ids.forEach(id => n.delete(id));
                          else ids.forEach(id => n.add(id));
                          return n;
                        });
                      }}
                    >
                      {allDaySelected ? "Deselect day" : "Select day"}
                    </Button>
                  </div>
                </div>

                {dayShifts.map(shift => (
                  <Card
                    key={shift.shiftId}
                    className={`cursor-pointer transition-colors ${selected.has(shift.shiftId) ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => toggle(shift.shiftId)}
                    data-testid={`card-shift-${shift.shiftId}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selected.has(shift.shiftId)}
                          onCheckedChange={() => toggle(shift.shiftId)}
                          className="mt-0.5"
                          data-testid={`checkbox-shift-${shift.shiftId}`}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{shift.siteName}</span>
                            </div>
                            <span className="font-bold text-sm shrink-0" data-testid={`text-amount-${shift.shiftId}`}>
                              £{parseFloat(shift.amount).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              {format(new Date(shift.checkInTime as any), "HH:mm")}
                              {" – "}
                              {format(new Date(shift.checkOutTime as any), "HH:mm")}
                            </span>
                            <span className="mx-1">·</span>
                            <span>{shift.hours.toFixed(1)}h @ £{shift.rate}/hr</span>
                          </div>
                          {shift.jobTitle && (
                            <Badge variant="secondary" className="mt-1 text-xs">{shift.jobTitle}</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky summary + submit */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg" data-testid="sticky-invoice-summary">
          <div className="max-w-lg mx-auto space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{selected.size} shift{selected.size !== 1 ? "s" : ""} · {totalHours.toFixed(1)} hrs</span>
              <span className="text-xl font-bold text-foreground" data-testid="text-invoice-total">
                £{totalAmount.toFixed(2)}
              </span>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => createMutation.mutate(Array.from(selected))}
              disabled={createMutation.isPending}
              data-testid="button-submit-invoice"
            >
              {createMutation.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating invoice…</>
                : <><Send className="h-4 w-4 mr-2" /> Send Invoice to Company</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice Success Screen ──────────────────────────────────────────────────
function InvoiceSuccess({ invoice, onViewInvoice, onCreateAnother }: {
  invoice: StaffInvoiceWithDetails;
  onViewInvoice: () => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="py-8 text-center space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </div>
        <div>
          <p className="text-xl font-bold">Invoice Sent!</p>
          <p className="text-sm text-muted-foreground mt-1">Your invoice has been submitted for approval</p>
        </div>
      </div>

      <Card className="text-left">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Invoice number</span>
            <span className="font-mono font-semibold text-sm">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total amount</span>
            <span className="font-bold text-lg">£{parseFloat(String(invoice.totalAmount)).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge status={invoice.status} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button className="w-full" onClick={onViewInvoice} data-testid="button-view-invoice">
          <ReceiptText className="h-4 w-4 mr-2" />
          View Invoice
        </Button>
        <Button variant="outline" className="w-full" onClick={onCreateAnother} data-testid="button-create-another">
          <Plus className="h-4 w-4 mr-2" />
          Create Another Invoice
        </Button>
      </div>
    </div>
  );
}

// ─── Invoice Detail ──────────────────────────────────────────────────────────
function InvoiceDetail({ invoice, onBack }: { invoice: StaffInvoiceWithDetails; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-list">
          ← Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => printInvoice(invoice)} data-testid="button-export-pdf">
          <Printer className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-lg font-mono" data-testid="text-invoice-number">{invoice.invoiceNumber}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {format(new Date(invoice.createdAt!), "dd MMMM yyyy, HH:mm")}
              </p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoice.rejectionReason && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Rejected</p>
                <p className="text-sm">{invoice.rejectionReason}</p>
                <p className="text-xs mt-1 opacity-75">These shifts have been returned and are available to re-invoice.</p>
              </div>
            </div>
          )}

          {invoice.status === "submitted" && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-primary/10 text-primary">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm">Awaiting approval from your company admin.</p>
            </div>
          )}

          {invoice.status === "paid" && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-sm">Payment has been processed.</p>
            </div>
          )}

          {/* Shift breakdown */}
          <div>
            <p className="text-sm font-semibold mb-3">Shift Breakdown</p>
            <div className="space-y-2">
              {(invoice.shifts || []).map((is: any) => (
                <div key={is.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{is.site?.name || is.shift?.jobTitle || "Shift"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{Number(is.hours).toFixed(1)}h @ £{is.rate}/hr</span>
                    <span className="font-semibold">£{parseFloat(is.amount).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-2xl font-bold" data-testid="text-detail-total">
              £{parseFloat(String(invoice.totalAmount)).toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Invoice List ────────────────────────────────────────────────────────────
function InvoiceListView({ onViewInvoice }: { onViewInvoice: (id: string) => void }) {
  const { data: invoices = [], isLoading } = useQuery<StaffInvoiceWithDetails[]>({
    queryKey: ["/api/staff-invoices"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <FileText className="h-14 w-14 mx-auto text-muted-foreground" />
        <p className="text-lg font-semibold">No invoices yet</p>
        <p className="text-sm text-muted-foreground">Your submitted invoices will appear here.</p>
      </div>
    );
  }

  const statusOrder: Record<string, number> = { submitted: 0, approved: 1, rejected: 2, paid: 3 };
  const sorted = [...invoices].sort((a, b) => {
    const sd = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (sd !== 0) return sd;
    return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
  });

  return (
    <div className="space-y-2">
      {sorted.map((invoice) => (
        <Card
          key={invoice.id}
          className="cursor-pointer hover-elevate"
          onClick={() => onViewInvoice(invoice.id)}
          data-testid={`card-invoice-${invoice.id}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono font-semibold text-sm">{invoice.invoiceNumber}</span>
                  <StatusBadge status={invoice.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(invoice.createdAt!), "dd MMM yyyy")}
                  {" · "}
                  {invoice.shifts?.length || 0} shift{(invoice.shifts?.length || 0) !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-lg" data-testid={`text-invoice-amount-${invoice.id}`}>
                  £{parseFloat(String(invoice.totalAmount)).toFixed(2)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Root component ──────────────────────────────────────────────────────────
export default function GuardInvoices() {
  const [tab, setTab] = useState<"create" | "list">("create");
  const [successInvoice, setSuccessInvoice] = useState<StaffInvoiceWithDetails | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  const { data: invoices = [] } = useQuery<StaffInvoiceWithDetails[]>({
    queryKey: ["/api/staff-invoices"],
  });

  const handleCreated = (invoice: StaffInvoiceWithDetails) => {
    setSuccessInvoice(invoice);
  };

  const handleViewInvoice = (id?: string) => {
    const targetId = id || successInvoice?.id;
    if (targetId) {
      setViewingInvoiceId(targetId);
      setTab("list");
      setSuccessInvoice(null);
    }
  };

  const handleCreateAnother = () => {
    setSuccessInvoice(null);
    setTab("create");
  };

  // Detail view
  const viewingInvoice = invoices.find(i => i.id === viewingInvoiceId);
  if (viewingInvoice) {
    return (
      <div className="space-y-4">
        <InvoiceDetail invoice={viewingInvoice} onBack={() => setViewingInvoiceId(null)} />
      </div>
    );
  }

  // Success screen
  if (successInvoice) {
    return (
      <div className="space-y-4">
        <InvoiceSuccess
          invoice={successInvoice}
          onViewInvoice={() => handleViewInvoice()}
          onCreateAnother={handleCreateAnother}
        />
      </div>
    );
  }

  const pendingCount = invoices.filter(i => i.status === "submitted" || i.status === "approved").length;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("create")}
          data-testid="button-tab-create"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border text-sm font-medium transition-colors ${
            tab === "create"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border hover-elevate"
          }`}
        >
          <Plus className="h-4 w-4" />
          Create Invoice
        </button>
        <button
          onClick={() => setTab("list")}
          data-testid="button-tab-list"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border text-sm font-medium transition-colors ${
            tab === "list"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border hover-elevate"
          }`}
        >
          <FileText className="h-4 w-4" />
          My Invoices
          {pendingCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              tab === "list" ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {tab === "create"
        ? <CreateInvoiceView onCreated={handleCreated} />
        : <InvoiceListView onViewInvoice={setViewingInvoiceId} />
      }
    </div>
  );
}
