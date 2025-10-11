import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download, Receipt, Clock, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BillingReport {
  weekStart: string;
  weekEnd: string;
  sites: SiteBilling[];
  grandTotal: number;
}

interface SiteBilling {
  siteId: string;
  siteName: string;
  siteAddress: string;
  totalHours: number;
  totalAmount: number;
  guardHours: number;
  stewardHours: number;
  supervisorHours: number;
  shifts: Shift[];
}

interface Shift {
  id: string;
  workerName: string;
  role: string;
  checkInTime: string;
  checkOutTime: string;
  hoursWorked: number;
  hourlyRate: number;
  amount: number;
}

export default function BillingReports() {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [expandedSite, setExpandedSite] = useState<string | null>(null);

  const handleGenerateInvoice = async (site: SiteBilling) => {
    try {
      // Fetch company settings
      const settingsResponse = await fetch('/api/company-settings');
      if (!settingsResponse.ok) throw new Error('Failed to fetch company settings');
      const settings = await settingsResponse.json();

      // Generate invoice number
      const invoiceNumber = `${settings.invoicePrefix || 'INV'}-${site.siteId}-${format(currentWeek, 'yyyyMMdd')}`;

      // Generate invoice HTML
      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              color: #333;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #2563eb;
            }
            .company-info {
              flex: 1;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .invoice-info {
              text-align: right;
            }
            .invoice-number {
              font-size: 28px;
              font-weight: bold;
              color: #2563eb;
              margin-bottom: 10px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #2563eb;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #2563eb;
              color: white;
              padding: 12px;
              text-align: left;
              font-weight: 600;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .total-row {
              background-color: #f3f4f6;
              font-weight: bold;
            }
            .amount {
              text-align: right;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
            @media print {
              body {
                margin: 0;
                padding: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              ${settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Company Logo" style="max-width: 150px; margin-bottom: 10px;">` : ''}
              <div class="company-name">${settings.companyName || 'Company Name'}</div>
              ${settings.companyAddress ? `<div>${settings.companyAddress.replace(/\n/g, '<br>')}</div>` : ''}
              ${settings.companyPhone ? `<div>Phone: ${settings.companyPhone}</div>` : ''}
              ${settings.companyEmail ? `<div>Email: ${settings.companyEmail}</div>` : ''}
              ${settings.taxId ? `<div>VAT: ${settings.taxId}</div>` : ''}
              ${settings.registrationNumber ? `<div>Reg No: ${settings.registrationNumber}</div>` : ''}
            </div>
            <div class="invoice-info">
              <div class="invoice-number">INVOICE</div>
              <div>${invoiceNumber}</div>
              <div style="margin-top: 10px;">Date: ${format(new Date(), 'dd/MM/yyyy')}</div>
              <div>Period: ${format(new Date(report!.weekStart), 'dd/MM/yyyy')} - ${format(new Date(report!.weekEnd), 'dd/MM/yyyy')}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Bill To:</div>
            <div style="font-size: 16px; font-weight: 600;">${site.siteName}</div>
            <div>${site.siteAddress}</div>
          </div>

          <div class="section">
            <div class="section-title">Services Provided</div>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th class="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${site.shifts.map(shift => `
                  <tr>
                    <td>${shift.workerName}</td>
                    <td>${shift.role}</td>
                    <td>${format(new Date(shift.checkInTime), 'dd/MM/yyyy')}</td>
                    <td>${shift.hoursWorked.toFixed(1)}</td>
                    <td>£${shift.hourlyRate.toFixed(2)}/hr</td>
                    <td class="amount">£${shift.amount.toFixed(2)}</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td colspan="3">Total Hours: ${site.totalHours.toFixed(1)}</td>
                  <td colspan="2">TOTAL AMOUNT</td>
                  <td class="amount">£${site.totalAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${settings.bankName || settings.bankAccountNumber ? `
            <div class="section">
              <div class="section-title">Payment Details</div>
              ${settings.bankName ? `<div>Bank: ${settings.bankName}</div>` : ''}
              ${settings.bankAccountNumber ? `<div>Account Number: ${settings.bankAccountNumber}</div>` : ''}
              ${settings.bankSortCode ? `<div>Sort Code: ${settings.bankSortCode}</div>` : ''}
            </div>
          ` : ''}

          ${settings.invoiceNotes ? `
            <div class="section">
              <div class="section-title">Notes</div>
              <div>${settings.invoiceNotes.replace(/\n/g, '<br>')}</div>
            </div>
          ` : ''}

          <div class="footer">
            <div>This is a computer-generated invoice.</div>
            ${settings.companyName ? `<div>${settings.companyName} - All rights reserved.</div>` : ''}
          </div>
        </body>
        </html>
      `;

      // Open invoice in new window
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();
        printWindow.focus();
        // Trigger print dialog after a short delay
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      alert('Failed to generate invoice. Please try again.');
    }
  };

  const { data: report, isLoading } = useQuery<BillingReport>({
    queryKey: ['/api/admin/billing/weekly', currentWeek.toISOString()],
    queryFn: async () => {
      const response = await fetch(`/api/admin/billing/weekly?weekStart=${currentWeek.toISOString()}`);
      if (!response.ok) throw new Error('Failed to fetch billing report');
      return response.json();
    },
  });

  const handlePreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
    setExpandedSite(null);
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
    setExpandedSite(null);
  };

  const exportToCSV = () => {
    if (!report) return;

    let csv = 'Site,Address,Guard Hours,Steward Hours,Supervisor Hours,Total Hours,Total Amount\n';
    
    report.sites.forEach(site => {
      csv += `"${site.siteName}","${site.siteAddress}",${site.guardHours.toFixed(2)},${site.stewardHours.toFixed(2)},${site.supervisorHours.toFixed(2)},${site.totalHours.toFixed(2)},£${site.totalAmount.toFixed(2)}\n`;
    });

    csv += `\nTotal,,,,,,£${report.grandTotal.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_${format(currentWeek, 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Billing & Invoicing</h2>
          <p className="text-muted-foreground">Weekly hours and costs per site for invoicing</p>
        </div>
        <Button onClick={exportToCSV} disabled={!report || report.sites.length === 0} data-testid="button-export-csv">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousWeek}
            data-testid="button-previous-week"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous Week
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Week of</p>
            <p className="font-semibold text-lg">
              {format(currentWeek, 'MMM d')} - {format(addWeeks(currentWeek, 1), 'MMM d, yyyy')}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextWeek}
            data-testid="button-next-week"
          >
            Next Week
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Billing Summary */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading billing report...</p>
          </CardContent>
        </Card>
      ) : !report || report.sites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No billable hours for this week</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Grand Total Card */}
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Weekly Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  £{report.grandTotal.toFixed(2)}
                </span>
                <span className="text-lg opacity-90">
                  ({report.sites.reduce((sum, s) => sum + s.totalHours, 0).toFixed(1)} hours)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Site Breakdown */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Site Breakdown</h3>
            
            {report.sites.map((site) => (
              <Card key={site.siteId} data-testid={`billing-site-${site.siteId}`}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle>{site.siteName}</CardTitle>
                      <CardDescription>{site.siteAddress}</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold">£{site.totalAmount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {site.totalHours.toFixed(1)} hours
                        </p>
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
                  {/* Role Hours Breakdown */}
                  <div className="flex gap-4">
                    {site.guardHours > 0 && (
                      <Badge variant="secondary">
                        Guard: {site.guardHours.toFixed(1)}h
                      </Badge>
                    )}
                    {site.stewardHours > 0 && (
                      <Badge variant="secondary">
                        Steward: {site.stewardHours.toFixed(1)}h
                      </Badge>
                    )}
                    {site.supervisorHours > 0 && (
                      <Badge variant="secondary">
                        Supervisor: {site.supervisorHours.toFixed(1)}h
                      </Badge>
                    )}
                  </div>

                  {/* Shifts Detail */}
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedSite(expandedSite === site.siteId ? null : site.siteId)}
                      data-testid={`button-toggle-shifts-${site.siteId}`}
                    >
                      {expandedSite === site.siteId ? 'Hide' : 'Show'} {site.shifts.length} shifts
                    </Button>
                    
                    {expandedSite === site.siteId && (
                      <div className="mt-4 border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Worker</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Day</TableHead>
                              <TableHead>Check-In</TableHead>
                              <TableHead>Check-Out</TableHead>
                              <TableHead className="text-right">Hours</TableHead>
                              <TableHead className="text-right">Rate</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {site.shifts.map((shift) => (
                              <TableRow key={shift.id} data-testid={`shift-${shift.id}`}>
                                <TableCell className="font-medium">{shift.workerName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">
                                    {shift.role}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{format(new Date(shift.checkInTime), 'EEE')}</TableCell>
                                <TableCell>{format(new Date(shift.checkInTime), 'MMM d, HH:mm')}</TableCell>
                                <TableCell>{format(new Date(shift.checkOutTime), 'MMM d, HH:mm')}</TableCell>
                                <TableCell className="text-right">{shift.hoursWorked.toFixed(2)}</TableCell>
                                <TableCell className="text-right">£{shift.hourlyRate.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-semibold">£{shift.amount.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
