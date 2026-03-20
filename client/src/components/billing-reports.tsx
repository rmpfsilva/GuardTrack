import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Download, Receipt, Clock, FileText, TrendingUp, TrendingDown, Minus, Printer, Upload, X, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface RoleBreakdown {
  hours: number;
  clientAmount: number;
  staffAmount: number;
}

interface Shift {
  id: string;
  workerName: string;
  role: string;
  jobTitle: string;
  checkInTime: string;
  checkOutTime: string;
  hoursWorked: number;
  staffRate: number;
  clientRate: number;
  staffAmount: number;
  clientAmount: number;
}

interface SiteBilling {
  siteId: string;
  siteName: string;
  siteAddress: string;
  totalHours: number;
  clientTotal: number;
  staffTotal: number;
  roleBreakdown: Record<string, RoleBreakdown>;
  shifts: Shift[];
}

interface BillingReport {
  weekStart: string;
  weekEnd: string;
  sites: SiteBilling[];
  grandClientTotal: number;
  grandStaffTotal: number;
  grandTotal: number;
}

function MoneyBadge({ label, amount, icon: Icon, className }: { label: string; amount: number; icon: any; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${className}`}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <span className="font-bold text-lg">£{amount.toFixed(2)}</span>
    </div>
  );
}

export default function BillingReports() {
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [brandingOpen, setBrandingOpen] = useState(true);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useQuery<any>({
    queryKey: ['/api/company-settings'],
  });

  useEffect(() => {
    if (settings) {
      setLogoPreview(settings.logoUrl || '');
      setCompanyName(settings.companyName || '');
    }
  }, [settings]);

  const saveBrandingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", "/api/company-settings", {
        ...(settings || {}),
        companyName,
        logoUrl: logoPreview,
      });
    },
    onSuccess: () => {
      toast({ title: "Branding saved", description: "Your logo and company name will appear on all reports." });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setBrandingOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const { data: report, isLoading } = useQuery<BillingReport>({
    queryKey: ['/api/admin/billing/weekly', currentWeek.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/admin/billing/weekly?weekStart=${currentWeek.toISOString()}`);
      if (!response.ok) throw new Error('Failed to fetch billing report');
      return response.json();
    },
  });

  const handleGenerateInvoice = async (site: SiteBilling) => {
    try {
      const settingsResponse = await fetch('/api/company-settings');
      const settings = settingsResponse.ok ? await settingsResponse.json() : {};

      const invoiceNumber = `${settings.invoicePrefix || 'INV'}-${site.siteId.substring(0, 8).toUpperCase()}-${format(currentWeek, 'yyyyMMdd')}`;

      const rows = site.shifts.map(shift => `
        <tr>
          <td>${shift.workerName}</td>
          <td>${shift.jobTitle || shift.role}</td>
          <td>${format(new Date(shift.checkInTime), 'dd/MM/yyyy')}</td>
          <td>${shift.hoursWorked.toFixed(2)}</td>
          <td>£${shift.clientRate.toFixed(2)}/hr</td>
          <td style="text-align:right">£${shift.clientAmount.toFixed(2)}</td>
        </tr>`).join('');

      const invoiceHTML = `<!DOCTYPE html><html><head><title>Invoice ${invoiceNumber}</title>
        <style>
          body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}
          .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #2563eb}
          .company-name{font-size:24px;font-weight:bold;color:#2563eb;margin-bottom:10px}
          .invoice-number{font-size:28px;font-weight:bold;color:#2563eb;margin-bottom:10px}
          .invoice-info{text-align:right}
          .section{margin-bottom:30px}
          .section-title{font-size:16px;font-weight:bold;margin-bottom:10px;color:#2563eb}
          table{width:100%;border-collapse:collapse;margin-top:10px}
          th{background-color:#2563eb;color:white;padding:10px;text-align:left;font-weight:600}
          td{padding:9px 10px;border-bottom:1px solid #e5e7eb}
          .total-row td{background:#f3f4f6;font-weight:bold;border-top:2px solid #333}
          .footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280}
          @media print{body{margin:0;padding:15px}}
        </style></head><body>
        <div class="header">
          <div>
            ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-width:150px;margin-bottom:10px">` : ''}
            <div class="company-name">${settings.companyName || 'Company Name'}</div>
            ${settings.companyAddress ? `<div>${settings.companyAddress.replace(/\n/g, '<br>')}</div>` : ''}
            ${settings.companyPhone ? `<div>Phone: ${settings.companyPhone}</div>` : ''}
            ${settings.companyEmail ? `<div>Email: ${settings.companyEmail}</div>` : ''}
            ${settings.taxId ? `<div>VAT: ${settings.taxId}</div>` : ''}
            ${settings.registrationNumber ? `<div>Reg: ${settings.registrationNumber}</div>` : ''}
          </div>
          <div class="invoice-info">
            <div class="invoice-number">INVOICE</div>
            <div>${invoiceNumber}</div>
            <div style="margin-top:10px">Date: ${format(new Date(), 'dd/MM/yyyy')}</div>
            <div>Period: ${format(new Date(report!.weekStart), 'dd/MM/yyyy')} – ${format(new Date(report!.weekEnd), 'dd/MM/yyyy')}</div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Bill To:</div>
          <div style="font-size:16px;font-weight:600">${site.siteName}</div>
          <div>${site.siteAddress}</div>
        </div>
        <div class="section">
          <div class="section-title">Services Provided</div>
          <table>
            <thead><tr><th>Employee</th><th>Role</th><th>Date</th><th>Hours</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>
              ${rows}
              <tr class="total-row">
                <td colspan="3">Total Hours: ${site.totalHours.toFixed(1)}</td>
                <td colspan="2">TOTAL</td>
                <td style="text-align:right">£${site.clientTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${settings.bankName || settings.bankAccountNumber ? `
        <div class="section">
          <div class="section-title">Payment Details</div>
          ${settings.bankName ? `<div>Bank: ${settings.bankName}</div>` : ''}
          ${settings.bankAccountNumber ? `<div>Account: ${settings.bankAccountNumber}</div>` : ''}
          ${settings.bankSortCode ? `<div>Sort Code: ${settings.bankSortCode}</div>` : ''}
        </div>` : ''}
        ${settings.invoiceNotes ? `<div class="section"><div class="section-title">Notes</div><div>${settings.invoiceNotes.replace(/\n/g, '<br>')}</div></div>` : ''}
        <div class="footer">
          <div>Computer-generated invoice.</div>
          ${settings.companyName ? `<div>${settings.companyName} – All rights reserved.</div>` : ''}
        </div>
      </body></html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(invoiceHTML);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      } else {
        alert('Please allow pop-ups to generate invoices.');
      }
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    }
  };

  const exportToCSV = async () => {
    if (!report) return;
    const weekLabel = `${format(new Date(report.weekStart), 'dd/MM/yyyy')} - ${format(new Date(report.weekEnd), 'dd/MM/yyyy')}`;
    const grandProfit = (report.grandClientTotal || 0) - (report.grandStaffTotal || 0);

    let csv = '';
    if (companyName) csv += `"${companyName}"\n`;
    csv += `"Weekly Billing Report: ${weekLabel}"\n`;
    csv += `"Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}"\n\n`;
    csv += 'Site,Address,Hours,Revenue (IN),Cost (OUT),Profit\n';
    report.sites.forEach(site => {
      const profit = site.clientTotal - site.staffTotal;
      csv += `"${site.siteName}","${site.siteAddress}",${site.totalHours.toFixed(2)},£${site.clientTotal.toFixed(2)},£${site.staffTotal.toFixed(2)},£${profit.toFixed(2)}\n`;
    });
    csv += `\nTotal,,,£${(report.grandClientTotal || 0).toFixed(2)},£${(report.grandStaffTotal || 0).toFixed(2)},£${grandProfit.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_${format(currentWeek, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrintReport = async () => {
    if (!report) return;
    const weekLabel = `${format(new Date(report.weekStart), 'dd MMM yyyy')} – ${format(new Date(report.weekEnd), 'dd MMM yyyy')}`;
    const grandProfit = (report.grandClientTotal || 0) - (report.grandStaffTotal || 0);
    const totalHours = report.sites.reduce((s, x) => s + x.totalHours, 0);

    const siteRows = report.sites.map(site => {
      const profit = site.clientTotal - site.staffTotal;
      const profitColor = profit >= 0 ? '#16a34a' : '#dc2626';
      const shiftRows = site.shifts.map(sh => `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:7px 10px">${sh.workerName}</td>
          <td style="padding:7px 10px">${sh.jobTitle || sh.role}</td>
          <td style="padding:7px 10px">${format(new Date(sh.checkInTime), 'EEE d MMM')}</td>
          <td style="padding:7px 10px;text-align:right">${sh.hoursWorked.toFixed(2)}</td>
          <td style="padding:7px 10px;text-align:right;color:#ea580c">£${sh.staffRate.toFixed(2)}/hr</td>
          <td style="padding:7px 10px;text-align:right;color:#16a34a">£${sh.clientRate.toFixed(2)}/hr</td>
          <td style="padding:7px 10px;text-align:right">£${sh.staffAmount.toFixed(2)}</td>
          <td style="padding:7px 10px;text-align:right;font-weight:600">£${sh.clientAmount.toFixed(2)}</td>
        </tr>`).join('');

      return `
        <div style="margin-bottom:32px;page-break-inside:avoid">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:16px;font-weight:700;color:#1e40af">${site.siteName}</div>
              <div style="font-size:12px;color:#6b7280">${site.siteAddress}</div>
            </div>
            <div style="display:flex;gap:20px;text-align:center">
              <div><div style="font-size:11px;color:#6b7280">Revenue</div><div style="font-weight:700;color:#16a34a">£${site.clientTotal.toFixed(2)}</div></div>
              <div><div style="font-size:11px;color:#6b7280">Staff Cost</div><div style="font-weight:700;color:#ea580c">£${site.staffTotal.toFixed(2)}</div></div>
              <div><div style="font-size:11px;color:#6b7280">Profit</div><div style="font-weight:700;color:${profitColor}">£${profit.toFixed(2)}</div></div>
              <div><div style="font-size:11px;color:#6b7280">Hours</div><div style="font-weight:700">${site.totalHours.toFixed(1)}h</div></div>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#1e40af;color:white">
                <th style="padding:8px 10px;text-align:left">Worker</th>
                <th style="padding:8px 10px;text-align:left">Role</th>
                <th style="padding:8px 10px;text-align:left">Date</th>
                <th style="padding:8px 10px;text-align:right">Hours</th>
                <th style="padding:8px 10px;text-align:right">Staff Rate</th>
                <th style="padding:8px 10px;text-align:right">Client Rate</th>
                <th style="padding:8px 10px;text-align:right">Staff Cost</th>
                <th style="padding:8px 10px;text-align:right">Revenue</th>
              </tr>
            </thead>
            <tbody>${shiftRows}</tbody>
            <tfoot>
              <tr style="background:#f9fafb;font-weight:700;border-top:2px solid #e5e7eb">
                <td colspan="3" style="padding:8px 10px">Site Total — ${site.totalHours.toFixed(1)} hrs</td>
                <td colspan="3"></td>
                <td style="padding:8px 10px;text-align:right;color:#ea580c">£${site.staffTotal.toFixed(2)}</td>
                <td style="padding:8px 10px;text-align:right;color:#16a34a">£${site.clientTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>${companyName} – Weekly Report ${weekLabel}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#111}
        @media print{body{padding:12px}@page{margin:15mm}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e40af;padding-bottom:16px;margin-bottom:24px">
        <div>
          ${logoPreview ? `<img src="${logoPreview}" alt="${companyName}" style="max-height:60px;max-width:200px;object-fit:contain;margin-bottom:8px;display:block">` : ''}
          <div style="font-size:22px;font-weight:700;color:#1e40af">${companyName}</div>
          ${settings.companyAddress ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">${settings.companyAddress.replace(/\n/g,'<br>')}</div>` : ''}
          ${settings.companyEmail ? `<div style="font-size:12px;color:#6b7280">${settings.companyEmail}</div>` : ''}
          ${settings.companyPhone ? `<div style="font-size:12px;color:#6b7280">${settings.companyPhone}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:700;color:#1e40af">WEEKLY BILLING REPORT</div>
          <div style="font-size:13px;color:#374151;margin-top:4px">${weekLabel}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:4px">Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>
      </div>

      <div style="display:flex;gap:32px;background:#1e40af;color:white;border-radius:8px;padding:16px 24px;margin-bottom:32px">
        <div style="text-align:center">
          <div style="font-size:11px;opacity:0.8;margin-bottom:4px">Total Revenue (IN)</div>
          <div style="font-size:22px;font-weight:700">£${(report.grandClientTotal || 0).toFixed(2)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;opacity:0.8;margin-bottom:4px">Staff Cost (OUT)</div>
          <div style="font-size:22px;font-weight:700">£${(report.grandStaffTotal || 0).toFixed(2)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;opacity:0.8;margin-bottom:4px">Net Profit</div>
          <div style="font-size:22px;font-weight:700">£${grandProfit.toFixed(2)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;opacity:0.8;margin-bottom:4px">Total Hours</div>
          <div style="font-size:22px;font-weight:700">${totalHours.toFixed(1)}h</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:11px;opacity:0.8;margin-bottom:4px">Sites</div>
          <div style="font-size:22px;font-weight:700">${report.sites.length}</div>
        </div>
      </div>

      <div style="font-size:16px;font-weight:700;margin-bottom:16px;color:#374151">Site Breakdown</div>
      ${siteRows}

      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center">
        ${companyName} — Confidential Weekly Billing Report — ${weekLabel}
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    } else {
      alert('Please allow pop-ups to print the report.');
    }
  };

  const grandClient = report?.grandClientTotal ?? 0;
  const grandStaff = report?.grandStaffTotal ?? 0;
  const grandProfit = grandClient - grandStaff;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold">Billing & Invoicing</h2>
          <p className="text-muted-foreground">Weekly revenue, costs, and profit per site</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintReport} disabled={!report || report.sites.length === 0} data-testid="button-print-report">
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
          <Button onClick={exportToCSV} disabled={!report || report.sites.length === 0} data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Branding Card */}
      <Card data-testid="card-report-branding">
        <CardHeader className="pb-3">
          <button
            type="button"
            className="flex items-center justify-between w-full text-left"
            onClick={() => setBrandingOpen(o => !o)}
            data-testid="button-toggle-branding"
          >
            <div className="flex items-center gap-3">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="h-8 max-w-[80px] object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-base">
                  {companyName || 'Set your company branding'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {logoPreview ? 'Logo set — appears on all printed reports and CSVs' : 'Add your logo and company name to reports'}
                </CardDescription>
              </div>
            </div>
            {brandingOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>

        {brandingOpen && (
          <CardContent className="pt-0 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Logo upload */}
              <div className="space-y-2">
                <Label>Company Logo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFile}
                  data-testid="input-logo-file"
                />
                {logoPreview ? (
                  <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-10 max-w-[120px] object-contain"
                      data-testid="img-logo-preview"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {logoPreview.startsWith('data:') ? 'Uploaded file' : 'URL set'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => { setLogoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      data-testid="button-remove-logo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-logo"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo (PNG, JPG — max 2MB)
                  </Button>
                )}
                {!logoPreview && (
                  <Input
                    placeholder="Or paste a logo URL…"
                    value={logoPreview}
                    onChange={e => setLogoPreview(e.target.value)}
                    data-testid="input-logo-url"
                  />
                )}
              </div>

              {/* Company name */}
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  placeholder="Your company name"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  data-testid="input-company-name-branding"
                />
                <p className="text-xs text-muted-foreground">
                  Shown at the top of every printed report and CSV download
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBrandingOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => saveBrandingMutation.mutate()}
                disabled={saveBrandingMutation.isPending}
                data-testid="button-save-branding"
              >
                {saveBrandingMutation.isPending ? 'Saving…' : 'Save Branding'}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <Button variant="outline" size="sm" onClick={() => { setCurrentWeek(subWeeks(currentWeek, 1)); setExpandedSite(null); }} data-testid="button-previous-week">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous Week
          </Button>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Week of</p>
            <p className="font-semibold text-lg">{format(currentWeek, 'MMM d')} - {format(addWeeks(currentWeek, 1), 'MMM d, yyyy')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setCurrentWeek(addWeeks(currentWeek, 1)); setExpandedSite(null); }} data-testid="button-next-week">
            Next Week
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="p-12 text-center"><p className="text-muted-foreground">Loading billing report...</p></CardContent></Card>
      ) : !report || report.sites.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No billable hours for this week</p>
        </CardContent></Card>
      ) : (
        <>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Weekly Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 divide-x divide-primary-foreground/20">
                <MoneyBadge label="Revenue (IN)" amount={grandClient} icon={TrendingUp} className="pr-4" />
                <MoneyBadge label="Staff Cost (OUT)" amount={grandStaff} icon={TrendingDown} className="px-4" />
                <MoneyBadge label="Profit" amount={grandProfit} icon={Minus} className="pl-4" />
              </div>
              <p className="text-sm opacity-80 mt-3 text-center">
                {report.sites.reduce((s, x) => s + x.totalHours, 0).toFixed(1)} hours across {report.sites.length} site{report.sites.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Site Breakdown</h3>

            {report.sites.map((site) => {
              const profit = site.clientTotal - site.staffTotal;
              return (
                <Card key={site.siteId} data-testid={`billing-site-${site.siteId}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle>{site.siteName}</CardTitle>
                        <CardDescription>{site.siteAddress}</CardDescription>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="grid grid-cols-3 gap-4 text-center text-sm">
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs"><TrendingUp className="h-3 w-3 text-green-500" /> IN</div>
                            <div className="font-bold text-lg">£{site.clientTotal.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs"><TrendingDown className="h-3 w-3 text-orange-500" /> OUT</div>
                            <div className="font-bold text-lg">£{site.staffTotal.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs"><Minus className="h-3 w-3" /> Profit</div>
                            <div className={`font-bold text-lg ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              £{profit.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleGenerateInvoice(site)}
                          data-testid={`button-generate-invoice-${site.siteId}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Invoice
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Role breakdown */}
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(site.roleBreakdown).map(([title, data]) => (
                        <Badge key={title} variant="secondary" className="gap-1">
                          {title}: {data.hours.toFixed(1)}h
                          <span className="text-green-600 dark:text-green-400">£{data.clientAmount.toFixed(0)}</span>
                          /
                          <span className="text-orange-500">£{data.staffAmount.toFixed(0)}</span>
                        </Badge>
                      ))}
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {site.totalHours.toFixed(1)}h total
                      </Badge>
                    </div>

                    {/* Shifts detail */}
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedSite(expandedSite === site.siteId ? null : site.siteId)}
                        data-testid={`button-toggle-shifts-${site.siteId}`}
                      >
                        {expandedSite === site.siteId ? 'Hide' : 'Show'} {site.shifts.length} shift{site.shifts.length !== 1 ? 's' : ''}
                      </Button>

                      {expandedSite === site.siteId && (
                        <div className="mt-3 border rounded-md overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Worker</TableHead>
                                <TableHead>Job Title</TableHead>
                                <TableHead>Day</TableHead>
                                <TableHead className="text-right">Hours</TableHead>
                                <TableHead className="text-right">
                                  <span className="flex items-center gap-1 justify-end"><TrendingDown className="h-3 w-3 text-orange-500" />Staff Rate</span>
                                </TableHead>
                                <TableHead className="text-right">
                                  <span className="flex items-center gap-1 justify-end"><TrendingUp className="h-3 w-3 text-green-500" />Client Rate</span>
                                </TableHead>
                                <TableHead className="text-right">Staff Cost</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {site.shifts.map((shift) => (
                                <TableRow key={shift.id} data-testid={`shift-${shift.id}`}>
                                  <TableCell className="font-medium">{shift.workerName}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{shift.jobTitle || shift.role}</Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {format(new Date(shift.checkInTime), 'EEE d MMM')}
                                  </TableCell>
                                  <TableCell className="text-right">{shift.hoursWorked.toFixed(2)}</TableCell>
                                  <TableCell className="text-right text-orange-600 dark:text-orange-400">£{shift.staffRate.toFixed(2)}</TableCell>
                                  <TableCell className="text-right text-green-600 dark:text-green-400">£{shift.clientRate.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">£{shift.staffAmount.toFixed(2)}</TableCell>
                                  <TableCell className="text-right font-semibold">£{shift.clientAmount.toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
