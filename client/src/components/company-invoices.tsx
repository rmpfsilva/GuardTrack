import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import type { InvoiceWithDetails } from "@shared/schema";

export default function CompanyInvoices() {
  const { data: invoicesList = [], isLoading } = useQuery<InvoiceWithDetails[]>({
    queryKey: ["/api/invoices"],
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-600 text-white">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalPending = invoicesList
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);

  const totalPaid = invoicesList
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" data-testid="text-company-invoices-title">Invoices</h2>
        <p className="text-muted-foreground">View invoices from platform administration</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-company-pending-amount">
              {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(totalPending)}
            </div>
            <p className="text-xs text-muted-foreground">
              {invoicesList.filter((i) => i.status === "pending").length} pending invoice(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-company-paid-amount">
              {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(totalPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {invoicesList.filter((i) => i.status === "paid").length} paid invoice(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>All invoices for your company</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No invoices yet</h3>
              <p className="text-muted-foreground">Your invoices will appear here once issued.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Issued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesList.map((invoice) => (
                    <TableRow key={invoice.id} data-testid={`row-company-invoice-${invoice.id}`}>
                      <TableCell className="font-medium" data-testid={`text-company-inv-number-${invoice.id}`}>
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell className="max-w-[250px]" data-testid={`text-company-inv-desc-${invoice.id}`}>
                        <div className="truncate">{invoice.description}</div>
                        {invoice.notes && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">{invoice.notes}</div>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-company-inv-amount-${invoice.id}`}>
                        {new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: invoice.currency || "GBP",
                        }).format(parseFloat(invoice.amount))}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>
                        {invoice.dueDate
                          ? format(new Date(invoice.dueDate), "dd MMM yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {invoice.periodStart && invoice.periodEnd
                          ? `${format(new Date(invoice.periodStart), "dd MMM")} - ${format(new Date(invoice.periodEnd), "dd MMM yyyy")}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {invoice.createdAt
                          ? format(new Date(invoice.createdAt), "dd MMM yyyy")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
