import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from "date-fns";
import { Calendar, Plus, Pencil, Trash2, Clock, MapPin, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ScheduledShiftWithDetails, Site, User as UserType } from "@shared/schema";

const getRecurrenceLabel = (recurrence: string): string => {
  const labels: Record<string, string> = {
    none: "One-time",
    daily: "Daily",
    weekdays: "Mon-Fri",
    weekends: "Sat-Sun",
    weekly: "Weekly",
    monthly: "Monthly",
  };
  return labels[recurrence] || recurrence;
};

export default function ScheduleManagement() {
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduledShiftWithDetails | null>(null);
  const [formData, setFormData] = useState({
    userId: "",
    siteId: "",
    startTime: "",
    endTime: "",
    recurrence: "none",
    notes: "",
  });

  // Fetch scheduled shifts
  const { data: shifts = [], isLoading } = useQuery<ScheduledShiftWithDetails[]>({
    queryKey: ["/api/scheduled-shifts"],
  });

  // Fetch sites
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  // Fetch all guards
  const { data: guards = [] } = useQuery<UserType[]>({
    queryKey: ["/api/admin/guards"],
  });

  // Create shift mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/scheduled-shifts", {
        ...data,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-shifts"] });
      toast({
        title: "Shift Scheduled",
        description: "The shift has been successfully created.",
      });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update shift mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const updateData: any = { ...data };
      if (data.startTime) updateData.startTime = new Date(data.startTime).toISOString();
      if (data.endTime) updateData.endTime = new Date(data.endTime).toISOString();
      return await apiRequest("PATCH", `/api/scheduled-shifts/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-shifts"] });
      toast({
        title: "Shift Updated",
        description: "The shift has been successfully updated.",
      });
      setIsEditDialogOpen(false);
      setEditingShift(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete shift mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/scheduled-shifts/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-shifts"] });
      toast({
        title: "Shift Deleted",
        description: "The shift has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      userId: "",
      siteId: "",
      startTime: "",
      endTime: "",
      recurrence: "none",
      notes: "",
    });
  };

  const handleCreate = () => {
    if (!formData.userId || !formData.siteId || !formData.startTime || !formData.endTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (shift: ScheduledShiftWithDetails) => {
    setEditingShift(shift);
    setFormData({
      userId: shift.userId,
      siteId: shift.siteId,
      startTime: format(new Date(shift.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(shift.endTime), "yyyy-MM-dd'T'HH:mm"),
      recurrence: shift.recurrence,
      notes: shift.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingShift) return;
    updateMutation.mutate({ id: editingShift.id, data: formData });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this shift?")) {
      deleteMutation.mutate(id);
    }
  };

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
    return <div className="p-4" data-testid="loading-schedule">Loading schedule...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Shift Schedule</h2>
          <p className="text-muted-foreground">Manage guard shift assignments</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-shift">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Shift
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-shift">
            <DialogHeader>
              <DialogTitle>Schedule New Shift</DialogTitle>
              <DialogDescription>Assign a guard to a site for a specific time period</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="guard">Guard</Label>
                <Select
                  value={formData.userId}
                  onValueChange={(value) => setFormData({ ...formData, userId: value })}
                >
                  <SelectTrigger id="guard" data-testid="select-guard">
                    <SelectValue placeholder="Select guard" />
                  </SelectTrigger>
                  <SelectContent>
                    {guards.map((guard) => (
                      <SelectItem key={guard.id} value={guard.id}>
                        {guard.firstName} {guard.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="site">Site</Label>
                <Select
                  value={formData.siteId}
                  onValueChange={(value) => setFormData({ ...formData, siteId: value })}
                >
                  <SelectTrigger id="site" data-testid="select-site-schedule">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  data-testid="input-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  data-testid="input-end-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recurrence">Recurrence</Label>
                <Select
                  value={formData.recurrence}
                  onValueChange={(value) => setFormData({ ...formData, recurrence: value })}
                >
                  <SelectTrigger id="recurrence" data-testid="select-recurrence">
                    <SelectValue placeholder="Select recurrence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="daily">Daily (Every day)</SelectItem>
                    <SelectItem value="weekdays">Weekdays (Mon-Fri)</SelectItem>
                    <SelectItem value="weekends">Weekends (Sat-Sun)</SelectItem>
                    <SelectItem value="weekly">Weekly (Same day each week)</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  data-testid="input-shift-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-confirm-add-shift">
                {createMutation.isPending ? "Creating..." : "Create Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Week Navigator */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-prev-week">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-4">
              <span className="font-medium" data-testid="text-week-range">
                {format(weekDays[0], "MMM d")} - {format(weekDays[6], "MMM d, yyyy")}
              </span>
              <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
                Today
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToNextWeek} data-testid="button-next-week">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayShifts = getShiftsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card key={day.toISOString()} className={isToday ? "border-primary" : ""} data-testid={`day-${format(day, 'yyyy-MM-dd')}`}>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">
                  <div className="flex items-center justify-between">
                    <span>{format(day, "EEE")}</span>
                    <Badge variant={isToday ? "default" : "outline"} className="text-xs">
                      {format(day, "d")}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                {dayShifts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No shifts</p>
                ) : (
                  dayShifts.map((shift) => (
                    <Card key={shift.id} className="p-2 hover-elevate" data-testid={`shift-${shift.id}`}>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate flex-1">
                            {shift.user.firstName} {shift.user.lastName}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(shift)}
                              title="Edit shift"
                              data-testid={`button-edit-shift-${shift.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(shift.id)}
                              title="Delete shift"
                              data-testid={`button-delete-shift-${shift.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{shift.site.name}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>
                              Scheduled: {format(new Date(shift.startTime), "HH:mm")} - {format(new Date(shift.endTime), "HH:mm")}
                            </span>
                          </div>
                          {shift.checkIn && (
                            <div className="flex items-center gap-1 text-xs">
                              <Clock className="w-3 h-3 text-primary" />
                              <span className="text-primary font-medium">
                                Actual: {format(new Date(shift.checkIn.checkInTime), "HH:mm")}
                                {shift.checkIn.checkOutTime && ` - ${format(new Date(shift.checkIn.checkOutTime), "HH:mm")}`}
                                {!shift.checkIn.checkOutTime && " - (In Progress)"}
                              </span>
                            </div>
                          )}
                        </div>
                        {shift.recurrence !== 'none' && (
                          <Badge variant="secondary" className="text-xs">
                            {getRecurrenceLabel(shift.recurrence)}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-shift">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Shift</DialogTitle>
            <DialogDescription>Update shift details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-guard">Guard</Label>
              <Select
                value={formData.userId}
                onValueChange={(value) => setFormData({ ...formData, userId: value })}
              >
                <SelectTrigger id="edit-guard">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {guards.map((guard) => (
                    <SelectItem key={guard.id} value={guard.id}>
                      {guard.firstName} {guard.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-site">Site</Label>
              <Select
                value={formData.siteId}
                onValueChange={(value) => setFormData({ ...formData, siteId: value })}
              >
                <SelectTrigger id="edit-site">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-startTime">Start Time</Label>
              <Input
                id="edit-startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endTime">End Time</Label>
              <Input
                id="edit-endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recurrence">Recurrence</Label>
              <Select
                value={formData.recurrence}
                onValueChange={(value) => setFormData({ ...formData, recurrence: value })}
              >
                <SelectTrigger id="edit-recurrence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One-time</SelectItem>
                  <SelectItem value="daily">Daily (Every day)</SelectItem>
                  <SelectItem value="weekdays">Weekdays (Mon-Fri)</SelectItem>
                  <SelectItem value="weekends">Weekends (Sat-Sun)</SelectItem>
                  <SelectItem value="weekly">Weekly (Same day each week)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-confirm-edit-shift">
              {updateMutation.isPending ? "Updating..." : "Update Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
