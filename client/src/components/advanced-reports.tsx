import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, subDays } from "date-fns";
import { AlertTriangle, Clock, TrendingUp, FileText, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LocationDisplay } from "@/components/location-display";

export default function AdvancedReports() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const endDate = addDays(weekStart, 7);

  // Overtime report
  const { data: overtimeReport, isLoading: overtimeLoading } = useQuery({
    queryKey: [`/api/admin/reports/overtime?weekStart=${weekStart.toISOString()}`],
  });

  // Anomaly report (last 7 days)
  const { data: anomalyReport, isLoading: anomalyLoading } = useQuery({
    queryKey: [`/api/admin/reports/anomalies?startDate=${weekStart.toISOString()}&endDate=${endDate.toISOString()}`],
  });

  // Detailed shifts report
  const { data: detailedReport, isLoading: detailedLoading } = useQuery({
    queryKey: [`/api/admin/reports/detailed-shifts?startDate=${weekStart.toISOString()}&endDate=${endDate.toISOString()}`],
  });

  const handlePreviousWeek = () => {
    setWeekStart(subDays(weekStart, 7));
  };

  const handleNextWeek = () => {
    setWeekStart(addDays(weekStart, 7));
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high":
        return <Badge variant="destructive">High</Badge>;
      case "medium":
        return <Badge variant="secondary" className="bg-orange-600 text-white">Medium</Badge>;
      case "low":
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getAnomalyIcon = (type: string) => {
    return <AlertTriangle className="h-4 w-4" />;
  };

  const exportToCSV = (data: any, filename: string) => {
    // Simple CSV export functionality
    const csvContent = "data:text/csv;charset=utf-8," + data;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Advanced Reports</h2>
          <p className="text-muted-foreground">Overtime tracking, anomaly detection, and detailed shift analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePreviousWeek} data-testid="button-previous-week">
            Previous Week
          </Button>
          <span className="text-sm font-medium px-4">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Button variant="outline" size="sm" onClick={handleNextWeek} data-testid="button-next-week">
            Next Week
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overtime" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overtime" data-testid="tab-overtime">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overtime
          </TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">
            <AlertTriangle className="h-4 w-4 mr-2" />
            E-statistics
          </TabsTrigger>
          <TabsTrigger value="detailed" data-testid="tab-detailed">
            <FileText className="h-4 w-4 mr-2" />
            Detailed Shifts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overtime" className="space-y-4 mt-4">
          {overtimeLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading overtime report...</p>
              </CardContent>
            </Card>
          ) : overtimeReport?.employees?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No overtime recorded this week</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Overtime Summary
                  </CardTitle>
                  <CardDescription>
                    Total overtime hours for week of {format(weekStart, 'MMM d, yyyy')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-orange-600">
                    {overtimeReport?.totalOvertimeHours?.toFixed(1) || '0.0'} hours
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Standard work week: 40 hours
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Employee Overtime Breakdown</CardTitle>
                  <CardDescription>Hours worked beyond standard 40-hour week</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-right">Standard Hours</TableHead>
                        <TableHead className="text-right">Overtime Hours</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overtimeReport?.employees?.map((emp: any) => (
                        <>
                          <TableRow key={emp.userId} data-testid={`overtime-employee-${emp.userId}`}>
                            <TableCell className="font-medium">{emp.userName}</TableCell>
                            <TableCell className="text-right">{emp.totalHours.toFixed(1)}h</TableCell>
                            <TableCell className="text-right">{emp.standardHours.toFixed(1)}h</TableCell>
                            <TableCell className="text-right">
                              <span className="font-semibold text-orange-600">
                                {emp.overtimeHours.toFixed(1)}h
                              </span>
                            </TableCell>
                            <TableCell>
                              {emp.shifts.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedEmployee(expandedEmployee === emp.userId ? null : emp.userId)}
                                  data-testid={`button-expand-${emp.userId}`}
                                >
                                  {expandedEmployee === emp.userId ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedEmployee === emp.userId && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-muted/50">
                                <div className="py-2 space-y-2">
                                  <p className="text-sm font-semibold">Shift Details:</p>
                                  {emp.shifts.map((shift: any, idx: number) => (
                                    <div key={idx} className="text-sm flex justify-between items-center py-1 border-b last:border-0">
                                      <span>{shift.siteName}</span>
                                      <span className="text-muted-foreground">
                                        {format(new Date(shift.checkInTime), 'MMM d, h:mm a')} - 
                                        {format(new Date(shift.checkOutTime), 'h:mm a')}
                                        <span className="ml-2 font-medium">{shift.hoursWorked.toFixed(1)}h</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4 mt-4">
          {anomalyLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Scanning for anomalies...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{anomalyReport?.summary?.total || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-red-600">High Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{anomalyReport?.summary?.high || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-orange-600">Medium Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{anomalyReport?.summary?.medium || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-yellow-600">Low Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{anomalyReport?.summary?.low || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {anomalyReport?.anomalies?.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>All Clear!</AlertTitle>
                  <AlertDescription>
                    No anomalies detected for this period.
                  </AlertDescription>
                </Alert>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Detected Anomalies</CardTitle>
                    <CardDescription>Issues requiring attention</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {anomalyReport?.anomalies?.map((anomaly: any, idx: number) => (
                      <Alert key={idx} variant={anomaly.severity === 'high' ? 'destructive' : 'default'} data-testid={`anomaly-${idx}`}>
                        <div className="flex items-start gap-3">
                          {getAnomalyIcon(anomaly.type)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <AlertTitle className="mb-0">{anomaly.userName} - {anomaly.siteName}</AlertTitle>
                              {getSeverityBadge(anomaly.severity)}
                            </div>
                            <AlertDescription>{anomaly.description}</AlertDescription>
                            {anomaly.scheduledTime && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Scheduled: {format(new Date(anomaly.scheduledTime), 'MMM d, h:mm a')}
                              </p>
                            )}
                            {anomaly.checkInTime && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Check-in: {format(new Date(anomaly.checkInTime), 'MMM d, h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                      </Alert>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4 mt-4">
          {detailedLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Loading detailed report...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Shift Summary</CardTitle>
                      <CardDescription>Overview for selected period</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const csv = detailedReport?.shifts?.map((s: any) => {
                          const location = s.location?.lat && s.location?.lng 
                            ? `"${s.location.lat}, ${s.location.lng}"` 
                            : 'No location';
                          return `${s.userName},${s.siteName},${s.role},${format(new Date(s.checkInTime), 'yyyy-MM-dd HH:mm')},${s.checkOutTime ? format(new Date(s.checkOutTime), 'yyyy-MM-dd HH:mm') : 'Active'},${location},${s.hoursWorked},${s.amount}`;
                        }).join('\n');
                        exportToCSV('Employee,Site,Role,Check-In,Check-Out,Location,Hours,Amount\n' + csv, `shifts-${format(weekStart, 'yyyy-MM-dd')}.csv`);
                      }}
                      data-testid="button-export-csv"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Shifts</p>
                      <p className="text-2xl font-bold">{detailedReport?.summary?.totalShifts || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold">{detailedReport?.summary?.completedShifts || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-bold">{detailedReport?.summary?.totalHours?.toFixed(1) || '0.0'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-2xl font-bold">£{detailedReport?.summary?.totalAmount?.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>All Shifts</CardTitle>
                  <CardDescription>Detailed breakdown of all shifts</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Check-In</TableHead>
                        <TableHead>Check-Out</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailedReport?.shifts?.map((shift: any) => (
                        <TableRow key={shift.id} data-testid={`shift-${shift.id}`}>
                          <TableCell className="font-medium">{shift.userName}</TableCell>
                          <TableCell>{shift.siteName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{shift.role}</Badge>
                          </TableCell>
                          <TableCell>{format(new Date(shift.checkInTime), 'MMM d, h:mm a')}</TableCell>
                          <TableCell>
                            {shift.checkOutTime ? format(new Date(shift.checkOutTime), 'MMM d, h:mm a') : '-'}
                          </TableCell>
                          <TableCell>
                            <LocationDisplay 
                              latitude={shift.location?.lat || null}
                              longitude={shift.location?.lng || null}
                              className="text-xs"
                              showLabel={false}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {shift.hoursWorked.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">£{shift.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={shift.status === 'completed' ? 'default' : 'secondary'}>
                              {shift.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
