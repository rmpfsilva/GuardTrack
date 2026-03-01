import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Handshake, Building2, PoundSterling } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScheduledShiftWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { getCompanyColor } from "@/lib/utils";

const JOB_TITLE_COLORS: Record<string, { strip: string; bg: string; border: string; text: string }> = {
  "SIA Guard":        { strip: "bg-blue-500",    bg: "bg-blue-500/10 dark:bg-blue-500/15",     border: "border-blue-300 dark:border-blue-700",    text: "text-blue-700 dark:text-blue-300" },
  "Steward":          { strip: "bg-amber-500",   bg: "bg-amber-500/10 dark:bg-amber-500/15",   border: "border-amber-300 dark:border-amber-700",  text: "text-amber-700 dark:text-amber-300" },
  "Supervisor":       { strip: "bg-purple-500",  bg: "bg-purple-500/10 dark:bg-purple-500/15", border: "border-purple-300 dark:border-purple-700", text: "text-purple-700 dark:text-purple-300" },
  "Call Out":         { strip: "bg-rose-500",    bg: "bg-rose-500/10 dark:bg-rose-500/15",     border: "border-rose-300 dark:border-rose-700",    text: "text-rose-700 dark:text-rose-300" },
  "Door Supervisor":  { strip: "bg-cyan-500",    bg: "bg-cyan-500/10 dark:bg-cyan-500/15",     border: "border-cyan-300 dark:border-cyan-700",    text: "text-cyan-700 dark:text-cyan-300" },
  "CCTV Operator":    { strip: "bg-indigo-500",  bg: "bg-indigo-500/10 dark:bg-indigo-500/15", border: "border-indigo-300 dark:border-indigo-700", text: "text-indigo-700 dark:text-indigo-300" },
  "Key Holder":       { strip: "bg-yellow-500",  bg: "bg-yellow-500/10 dark:bg-yellow-500/15", border: "border-yellow-300 dark:border-yellow-700", text: "text-yellow-700 dark:text-yellow-300" },
  "Mobile Patrol":    { strip: "bg-sky-500",     bg: "bg-sky-500/10 dark:bg-sky-500/15",       border: "border-sky-300 dark:border-sky-700",      text: "text-sky-700 dark:text-sky-300" },
};
const DEFAULT_JOB_COLOR = { strip: "bg-slate-400", bg: "bg-slate-500/10 dark:bg-slate-500/15", border: "border-slate-300 dark:border-slate-600", text: "text-slate-600 dark:text-slate-400" };

function getJobColor(jobTitle?: string | null) {
  if (!jobTitle) return DEFAULT_JOB_COLOR;
  return JOB_TITLE_COLORS[jobTitle] ?? DEFAULT_JOB_COLOR;
}

function getHourlyRate(jobTitle: string | null | undefined, site: any): string {
  const title = (jobTitle || "").toLowerCase();
  if (title === "steward") return site?.stewardRate || "18.00";
  if (title === "supervisor") return site?.supervisorRate || "22.00";
  return site?.guardRate || "15.00";
}

export default function MySchedule() {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);

  const { data: shifts = [], isLoading } = useQuery<ScheduledShiftWithDetails[]>({
    queryKey: ["/api/scheduled-shifts"],
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const filteredShifts = companyFilter
    ? shifts.filter(s => s.companyId === companyFilter)
    : shifts;

  const getShiftsForDay = (date: Date) =>
    filteredShifts.filter(shift => isSameDay(new Date(shift.startTime), date));

  if (isLoading) {
    return <div className="p-4" data-testid="loading-my-schedule">Loading your schedule...</div>;
  }

  const isMultiCompany = (user as any)?.isMultiCompany;
  const memberships = (user as any)?.memberships || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">My Schedule</h3>
            </div>
            {isMultiCompany && (
              <p className="text-xs text-muted-foreground ml-7">
                Across {memberships.length} Companies
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} data-testid="button-prev-week-guard">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} data-testid="button-today-guard">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} data-testid="button-next-week-guard">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isMultiCompany && memberships.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Badge
              variant={companyFilter === null ? "default" : "outline"}
              onClick={() => setCompanyFilter(null)}
              className="cursor-pointer"
              data-testid="badge-filter-company-all"
            >
              All
            </Badge>
            {memberships.map((m: any) => (
              <Badge
                key={m.companyId}
                variant={companyFilter === m.companyId ? "default" : "outline"}
                onClick={() => setCompanyFilter(m.companyId)}
                style={companyFilter === m.companyId ? { backgroundColor: getCompanyColor(m.companyId, m.brandColor) } : {}}
                className="cursor-pointer whitespace-nowrap"
                data-testid={`badge-filter-company-${m.companyId}`}
              >
                {m.companyName}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="text-sm text-muted-foreground mb-2">
        {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d, yyyy")}
      </div>

      <div className="space-y-2">
        {weekDays.map((day) => {
          const dayShifts = getShiftsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card key={day.toISOString()} className={isToday ? "border-primary" : ""} data-testid={`guard-day-${format(day, 'yyyy-MM-dd')}`}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{format(day, "EEEE, MMM d")}</span>
                  {isToday && <Badge variant="default" className="text-xs">Today</Badge>}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {dayShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shifts scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map((shift) => {
                      const isJobShare = !!(shift as any).jobShareId;
                      const fromCompany = (shift as any).jobShareFromCompany;
                      const color = getJobColor(shift.jobTitle);
                      const rate = getHourlyRate(shift.jobTitle, shift.site);

                      return (
                        <div
                          key={shift.id}
                          className={`rounded-md border overflow-hidden hover-elevate ${color.bg} ${color.border}`}
                          data-testid={`guard-shift-${shift.id}`}
                          style={isMultiCompany ? { borderLeft: `4px solid ${getCompanyColor(shift.companyId || '', shift.brandColor)}` } : undefined}
                        >
                          <div className={`h-1.5 ${color.strip}`} />
                          <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-1">
                                {isMultiCompany && shift.companyName && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5" data-testid={`text-guard-shift-company-${shift.id}`}>
                                    <span 
                                      className="inline-block w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: getCompanyColor(shift.companyId || '', shift.brandColor) }} 
                                    />
                                    {shift.companyName}
                                  </div>
                                )}
                                <span className={`text-sm font-bold leading-tight ${color.text}`} data-testid={`text-guard-shift-jobtitle-${shift.id}`}>
                                  {shift.jobTitle || "Guard"}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-0.5" data-testid={`text-guard-shift-rate-${shift.id}`}>
                                  <PoundSterling className="w-3 h-3" />{rate}/hr
                                </span>
                                {isJobShare && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs gap-1 cursor-default border-primary/40 text-primary">
                                        <Handshake className="w-3 h-3" />
                                        Job Share
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <div className="flex items-center gap-1.5 text-xs">
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span>Shared by <strong>{fromCompany || 'Partner Company'}</strong></span>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {shift.recurrence !== 'none' && (
                                  <Badge variant="secondary" className="text-xs">
                                    {shift.recurrence}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-mono">
                                {format(new Date(shift.startTime), "HH:mm")} – {format(new Date(shift.endTime), "HH:mm")}
                              </span>
                            </div>

                            {shift.checkIn && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className={`font-medium font-mono ${color.text}`}>
                                  Actual: {format(new Date(shift.checkIn.checkInTime), "HH:mm")}
                                  {shift.checkIn.checkOutTime
                                    ? ` – ${format(new Date(shift.checkIn.checkOutTime), "HH:mm")}`
                                    : " – (Active)"}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span>{shift.site.name}</span>
                            </div>

                            {shift.notes && (
                              <p className="text-xs text-muted-foreground">{shift.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
