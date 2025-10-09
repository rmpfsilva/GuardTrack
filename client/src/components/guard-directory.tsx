import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Users, Clock, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { User, CheckIn } from "@shared/schema";

interface GuardWithStats extends User {
  weeklyHours: number;
  totalShifts: number;
  recentCheckIns: CheckIn[];
  isCurrentlyActive: boolean;
}

export default function GuardDirectory() {
  const [expandedGuard, setExpandedGuard] = useState<string | null>(null);

  // Fetch guards with stats
  const { data: guards = [], isLoading } = useQuery<GuardWithStats[]>({
    queryKey: ["/api/admin/guards"],
  });

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Guard Directory
        </CardTitle>
        <CardDescription>View all guards and their shift history</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading guards...</p>
        ) : guards.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No guards registered yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {guards.map((guard) => (
              <Collapsible
                key={guard.id}
                open={expandedGuard === guard.id}
                onOpenChange={(open) => setExpandedGuard(open ? guard.id : null)}
              >
                <Card className="hover-elevate" data-testid={`guard-card-${guard.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={guard.profileImageUrl || undefined} alt={guard.firstName || "Guard"} />
                          <AvatarFallback>{getInitials(guard)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {guard.firstName} {guard.lastName}
                            </p>
                            {guard.isCurrentlyActive && (
                              <Badge variant="default" className="bg-chart-2">On Duty</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{guard.email}</p>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {guard.weeklyHours.toFixed(1)}h this week
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {guard.totalShifts} shifts
                            </span>
                          </div>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" data-testid={`button-expand-guard-${guard.id}`}>
                          {expandedGuard === guard.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="mt-4 space-y-2">
                      <div className="border-t border-border pt-4">
                        <p className="text-sm font-medium mb-3">Recent Shifts</p>
                        {guard.recentCheckIns.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No recent shifts</p>
                        ) : (
                          <div className="space-y-2">
                            {guard.recentCheckIns.map((checkIn, index) => (
                              <div 
                                key={checkIn.id}
                                className="flex justify-between items-center text-sm p-2 rounded bg-muted/50"
                                data-testid={`guard-${guard.id}-shift-${index}`}
                              >
                                <div>
                                  <p className="font-medium">
                                    {format(new Date(checkIn.checkInTime), "MMM d, yyyy")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(checkIn.checkInTime), "HH:mm")}
                                    {checkIn.checkOutTime && ` - ${format(new Date(checkIn.checkOutTime), "HH:mm")}`}
                                  </p>
                                </div>
                                <Badge variant={checkIn.status === 'active' ? 'default' : 'secondary'}>
                                  {checkIn.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
