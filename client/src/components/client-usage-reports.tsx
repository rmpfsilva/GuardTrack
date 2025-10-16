import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Download, BarChart3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {  format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";

interface UsageReport {
  companyId: string;
  companyName: string;
  month: number;
  year: number;
  checkInsCount: number;
  totalHours: number;
  activeUsers: number;
}

interface UsageReportResponse {
  month: number;
  year: number;
  reports: UsageReport[];
}

export default function ClientUsageReports() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const { data: usageData, isLoading } = useQuery<UsageReportResponse>({
    queryKey: ['/api/super-admin/usage-reports', currentMonth.getMonth(), currentMonth.getFullYear()],
    queryFn: async () => {
      const response = await fetch(
        `/api/super-admin/usage-reports?month=${currentMonth.getMonth()}&year=${currentMonth.getFullYear()}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch usage reports');
      return response.json();
    },
  });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const exportToCSV = () => {
    if (!usageData) return;

    let csv = 'Client,Check-Ins,Total Hours,Active Users\n';
    
    usageData.reports.forEach(report => {
      csv += `"${report.companyName}",${report.checkInsCount},${report.totalHours.toFixed(1)},${report.activeUsers}\n`;
    });

    csv += `\nTotal Check-Ins,${usageData.reports.reduce((sum, r) => sum + r.checkInsCount, 0)},,,\n`;
    csv += `Total Hours,${usageData.reports.reduce((sum, r) => sum + r.totalHours, 0).toFixed(1)},,,\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client_usage_${format(currentMonth, 'yyyy-MM')}.csv`;
    a.click();
  };

  const totalCheckIns = usageData?.reports.reduce((sum, r) => sum + r.checkInsCount, 0) || 0;
  const totalHours = usageData?.reports.reduce((sum, r) => sum + r.totalHours, 0) || 0;
  const totalActiveUsers = usageData?.reports.reduce((sum, r) => sum + r.activeUsers, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Client Usage Reports</h2>
          <p className="text-muted-foreground">Monthly platform usage statistics per client</p>
        </div>
        <Button 
          onClick={exportToCSV} 
          disabled={!usageData || usageData.reports.length === 0} 
          data-testid="button-export-csv"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Month Navigation */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousMonth}
            data-testid="button-previous-month"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous Month
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Report Period</p>
            <p className="font-semibold text-lg">
              {format(currentMonth, 'MMMM yyyy')}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            data-testid="button-next-month"
          >
            Next Month
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Check-Ins</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-total-checkins">
              {totalCheckIns}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-total-hours">
              {totalHours.toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">Platform usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-active-users">
              {totalActiveUsers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Unique users</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Table */}
      <Card>
        <CardHeader>
          <CardTitle>Client Usage Breakdown</CardTitle>
          <CardDescription>Usage statistics by client for {format(currentMonth, 'MMMM yyyy')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading usage data...</p>
          ) : !usageData || usageData.reports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No usage data for this period</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Check-Ins</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Active Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageData.reports.map((report) => (
                  <TableRow key={report.companyId} data-testid={`usage-row-${report.companyId}`}>
                    <TableCell className="font-medium">{report.companyName}</TableCell>
                    <TableCell className="text-right">{report.checkInsCount}</TableCell>
                    <TableCell className="text-right">{report.totalHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{report.activeUsers}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell className="text-right font-bold">{totalCheckIns}</TableCell>
                  <TableCell className="text-right font-bold">{totalHours.toFixed(1)}h</TableCell>
                  <TableCell className="text-right font-bold">
                    <Badge>{totalActiveUsers}</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
