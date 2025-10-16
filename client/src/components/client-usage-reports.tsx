import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Users, TrendingUp, TrendingDown, Activity, Calendar } from "lucide-react";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface LoginStats {
  date: string;
  count: number;
}

interface UserGrowth {
  current: number;
  previous: number;
}

interface AppUsageResponse {
  dailyLogins: LoginStats[];
  weeklyLogins: LoginStats[];
  monthlyLogins: LoginStats[];
  userGrowth?: UserGrowth;
  month: number;
  year: number;
}

export default function ClientUsageReports() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const { data: usageData, isLoading } = useQuery<AppUsageResponse>({
    queryKey: ['/api/super-admin/app-usage', currentMonth.getMonth() + 1, currentMonth.getFullYear()],
    queryFn: async () => {
      const response = await fetch(
        `/api/super-admin/app-usage?month=${currentMonth.getMonth() + 1}&year=${currentMonth.getFullYear()}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch app usage stats');
      return response.json();
    },
  });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const totalDailyLogins = usageData?.dailyLogins.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalWeeklyLogins = usageData?.weeklyLogins.reduce((sum, d) => sum + d.count, 0) || 0;
  const totalMonthlyLogins = usageData?.monthlyLogins.reduce((sum, d) => sum + d.count, 0) || 0;

  const userGrowthPercentage = usageData?.userGrowth
    ? usageData.userGrowth.previous > 0
      ? ((usageData.userGrowth.current - usageData.userGrowth.previous) / usageData.userGrowth.previous) * 100
      : 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">App Usage Analytics</h2>
          <p className="text-muted-foreground">Platform login activity and user growth metrics</p>
        </div>
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
            <p className="text-sm text-muted-foreground">Viewing Period</p>
            <p className="font-semibold text-lg" data-testid="text-current-month">
              {format(currentMonth, 'MMMM yyyy')}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            disabled={currentMonth >= startOfMonth(new Date())}
            data-testid="button-next-month"
          >
            Next Month
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-daily-logins">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-daily-logins">{totalDailyLogins}</div>
            <p className="text-xs text-muted-foreground">Total logins in the last day</p>
          </CardContent>
        </Card>

        <Card data-testid="card-weekly-logins">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-weekly-logins">{totalWeeklyLogins}</div>
            <p className="text-xs text-muted-foreground">Total logins in the last week</p>
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-logins">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-monthly-logins">{totalMonthlyLogins}</div>
            <p className="text-xs text-muted-foreground">Total logins this month</p>
          </CardContent>
        </Card>
      </div>

      {/* User Growth */}
      {usageData?.userGrowth && (
        <Card data-testid="card-user-growth">
          <CardHeader>
            <CardTitle>User Growth Comparison</CardTitle>
            <CardDescription>Active users this month vs. previous month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Previous Month</p>
                <p className="text-2xl font-bold" data-testid="text-previous-month-users">
                  {usageData.userGrowth.previous}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {userGrowthPercentage >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-600" />
                )}
                <Badge 
                  variant={userGrowthPercentage >= 0 ? "default" : "destructive"}
                  data-testid="badge-growth-percentage"
                >
                  {userGrowthPercentage >= 0 ? '+' : ''}{userGrowthPercentage.toFixed(1)}%
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Current Month</p>
                <p className="text-2xl font-bold" data-testid="text-current-month-users">
                  {usageData.userGrowth.current}
                </p>
              </div>
            </div>

            {/* Growth Chart */}
            <div className="h-[200px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Previous Month', users: usageData.userGrowth.previous },
                    { name: 'Current Month', users: usageData.userGrowth.current },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Login Activity Chart */}
      {usageData?.monthlyLogins && usageData.monthlyLogins.length > 0 && (
        <Card data-testid="card-login-activity">
          <CardHeader>
            <CardTitle>Daily Login Activity</CardTitle>
            <CardDescription>Login frequency throughout the month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageData.monthlyLogins}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value as string), 'MMM dd, yyyy')}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3b82f6" 
                    name="Logins"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading app usage data...</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !usageData && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No usage data available for this period</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
