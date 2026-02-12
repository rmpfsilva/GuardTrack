import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Handshake } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScheduledShiftWithDetails } from "@shared/schema";

export default function MySchedule() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Fetch my scheduled shifts
  const { data: shifts = [], isLoading } = useQuery<ScheduledShiftWithDetails[]>({
    queryKey: ["/api/scheduled-shifts"],
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  
  const getShiftsForDay = (date: Date) => {
    return shifts.filter(shift => 
      isSameDay(new Date(shift.startTime), date)
    );
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  if (isLoading) {
    return <div className="p-4" data-testid="loading-my-schedule">Loading your schedule...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">My Schedule</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-prev-week-guard">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today-guard">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-next-week-guard">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mb-2">
        {format(weekDays[0], "MMM d")} - {format(weekDays[6], "MMM d, yyyy")}
      </div>

      <div className="space-y-2">
        {weekDays.map((day) => {
          const dayShifts = getShiftsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card key={day.toISOString()} className={isToday ? "border-primary" : ""} data-testid={`guard-day-${format(day, 'yyyy-MM-dd')}`}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{format(day, "EEEE, MMM d")}</span>
                    {isToday && <Badge variant="default" className="text-xs">Today</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {dayShifts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No shifts scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map((shift) => (
                      <div 
                        key={shift.id} 
                        className="flex items-start justify-between p-3 rounded-lg border border-border hover-elevate"
                        data-testid={`guard-shift-${shift.id}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span className="font-mono">
                              Scheduled: {format(new Date(shift.startTime), "HH:mm")} - {format(new Date(shift.endTime), "HH:mm")}
                            </span>
                          </div>
                          {shift.checkIn && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="w-4 h-4 text-primary" />
                              <span className="font-medium font-mono text-primary">
                                Actual: {format(new Date(shift.checkIn.checkInTime), "HH:mm")}
                                {shift.checkIn.checkOutTime && ` - ${format(new Date(shift.checkIn.checkOutTime), "HH:mm")}`}
                                {!shift.checkIn.checkOutTime && " - (Active)"}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-4 h-4" />
                            <span>{shift.site.name}</span>
                          </div>
                          {shift.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{shift.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end shrink-0">
                          {shift.recurrence !== 'none' && (
                            <Badge variant="secondary" className="text-xs">
                              {shift.recurrence}
                            </Badge>
                          )}
                          {(shift as any).jobShareId && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Handshake className="w-3 h-3" />
                              Job Share
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
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
