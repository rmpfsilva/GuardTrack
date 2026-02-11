import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { Calendar, Plus, Pencil, Trash2, Clock, MapPin, ChevronLeft, ChevronRight, Briefcase, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScheduledShiftWithDetails, Site, User as UserType } from "@shared/schema";

const JOB_TITLES = [
  "SIA Guard",
  "Steward",
  "Supervisor",
  "Call Out",
  "Door Supervisor",
  "CCTV Operator",
  "Close Protection",
  "Key Holder",
  "Mobile Patrol",
  "Receptionist",
  "Concierge",
  "Event Marshal",
];

const JOB_ROLES = ["guard", "steward", "supervisor", "call_out"] as const;

const JOB_ROLE_LABELS: Record<string, string> = {
  guard: "Guard",
  steward: "Steward",
  supervisor: "Supervisor",
  call_out: "Call Out",
  admin: "Admin",
};

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

interface ShiftEntry {
  id: string;
  startTime: string;
  endTime: string;
}

export default function ScheduleManagement() {
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduledShiftWithDetails | null>(null);

  const [formData, setFormData] = useState({
    userId: "",
    siteId: "",
    jobTitle: "",
    role: "",
    recurrence: "none",
    notes: "",
  });

  const [shiftEntries, setShiftEntries] = useState<ShiftEntry[]>([
    { id: "1", startTime: "", endTime: "" },
  ]);

  const [editFormData, setEditFormData] = useState({
    userId: "",
    siteId: "",
    jobTitle: "",
    role: "",
    startTime: "",
    endTime: "",
    recurrence: "none",
    notes: "",
  });

  const { data: shifts = [], isLoading } = useQuery<ScheduledShiftWithDetails[]>({
    queryKey: ["/api/scheduled-shifts"],
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: employees = [] } = useQuery<UserType[]>({
    queryKey: ["/api/admin/guards"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { shifts: Array<{ userId: string; siteId: string; jobTitle: string; startTime: string; endTime: string; recurrence: string; notes: string; isActive: boolean }> }) => {
      return await apiRequest("POST", "/api/scheduled-shifts/batch", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-shifts"] });
      const count = shiftEntries.length;
      toast({
        title: count > 1 ? "Shifts Scheduled" : "Shift Scheduled",
        description: count > 1
          ? `${count} shifts have been successfully created.`
          : "The shift has been successfully created.",
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
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
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
      jobTitle: "",
      role: "",
      recurrence: "none",
      notes: "",
    });
    setShiftEntries([{ id: "1", startTime: "", endTime: "" }]);
  };

  const addShiftEntry = () => {
    const newId = String(Date.now());
    setShiftEntries([...shiftEntries, { id: newId, startTime: "", endTime: "" }]);
  };

  const removeShiftEntry = (id: string) => {
    if (shiftEntries.length <= 1) return;
    setShiftEntries(shiftEntries.filter((e) => e.id !== id));
  };

  const updateShiftEntry = (id: string, field: "startTime" | "endTime", value: string) => {
    setShiftEntries(shiftEntries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const filteredEmployees = formData.role && formData.role !== "all"
    ? employees.filter((e) => e.role === formData.role)
    : employees;

  const handleCreate = () => {
    const validEntries = shiftEntries.filter((e) => e.startTime && e.endTime);
    if (!formData.userId || !formData.siteId || !formData.jobTitle || validEntries.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in Job Title, Employee, Site, and at least one shift time.",
        variant: "destructive",
      });
      return;
    }
    const shiftsPayload = validEntries.map((entry) => ({
      userId: formData.userId,
      siteId: formData.siteId,
      jobTitle: formData.jobTitle,
      startTime: new Date(entry.startTime).toISOString(),
      endTime: new Date(entry.endTime).toISOString(),
      recurrence: formData.recurrence,
      notes: formData.notes,
      isActive: true,
    }));
    createMutation.mutate({ shifts: shiftsPayload });
  };

  const handleEdit = (shift: ScheduledShiftWithDetails) => {
    setEditingShift(shift);
    setEditFormData({
      userId: shift.userId,
      siteId: shift.siteId,
      jobTitle: shift.jobTitle || "Guard",
      role: shift.user?.role || "",
      startTime: format(new Date(shift.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(shift.endTime), "yyyy-MM-dd'T'HH:mm"),
      recurrence: shift.recurrence,
      notes: shift.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingShift) return;
    updateMutation.mutate({
      id: editingShift.id,
      data: {
        userId: editFormData.userId,
        siteId: editFormData.siteId,
        jobTitle: editFormData.jobTitle,
        startTime: editFormData.startTime,
        endTime: editFormData.endTime,
        recurrence: editFormData.recurrence,
        notes: editFormData.notes,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this shift?")) {
      deleteMutation.mutate(id);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const getShiftsForDay = (date: Date) => {
    return shifts.filter((shift) => isSameDay(new Date(shift.startTime), date));
  };

  const goToPreviousWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));
  const goToNextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  if (isLoading) {
    return <div className="p-4" data-testid="loading-schedule">Loading schedule...</div>;
  }

  const editFilteredEmployees = editFormData.role && editFormData.role !== "all"
    ? employees.filter((e) => e.role === editFormData.role)
    : employees;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-schedule-title">Shift Schedule</h2>
          <p className="text-muted-foreground">Manage employee shift assignments</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-shift">
              <Plus className="w-4 h-4 mr-2" />
              Schedule Shift
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" data-testid="dialog-add-shift">
            <DialogHeader>
              <DialogTitle>Schedule New Shifts</DialogTitle>
              <DialogDescription>Assign an employee to a site with one or more shift times</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Select
                    value={formData.jobTitle}
                    onValueChange={(value) => setFormData({ ...formData, jobTitle: value })}
                  >
                    <SelectTrigger id="jobTitle" data-testid="select-job-title">
                      <SelectValue placeholder="Select job title" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TITLES.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role (optional filter)</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value, userId: "" })}
                  >
                    <SelectTrigger id="role" data-testid="select-role">
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {JOB_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {JOB_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employee">Employee</Label>
                  <Select
                    value={formData.userId}
                    onValueChange={(value) => setFormData({ ...formData, userId: value })}
                  >
                    <SelectTrigger id="employee" data-testid="select-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                          <span className="ml-2 text-muted-foreground text-xs">({JOB_ROLE_LABELS[emp.role] || emp.role})</span>
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label>Shift Times</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addShiftEntry}
                      data-testid="button-add-shift-entry"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Another Shift
                    </Button>
                  </div>
                  {shiftEntries.map((entry, index) => (
                    <Card key={entry.id} className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">Shift {index + 1}</Badge>
                            {shiftEntries.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeShiftEntry(entry.id)}
                                data-testid={`button-remove-shift-${index}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Start</Label>
                              <Input
                                type="datetime-local"
                                value={entry.startTime}
                                onChange={(e) => updateShiftEntry(entry.id, "startTime", e.target.value)}
                                data-testid={`input-start-time-${index}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">End</Label>
                              <Input
                                type="datetime-local"
                                value={entry.endTime}
                                onChange={(e) => updateShiftEntry(entry.id, "endTime", e.target.value)}
                                data-testid={`input-end-time-${index}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
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
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-confirm-add-shift">
                {createMutation.isPending
                  ? "Creating..."
                  : shiftEntries.length > 1
                    ? `Create ${shiftEntries.length} Shifts`
                    : "Create Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousWeek} data-testid="button-prev-week">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-4 flex-wrap">
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

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayShifts = getShiftsForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card key={day.toISOString()} className={isToday ? "border-primary" : ""} data-testid={`day-${format(day, "yyyy-MM-dd")}`}>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">
                  <div className="flex items-center justify-between gap-1">
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
                          <span className="text-xs font-medium truncate flex-1" data-testid={`text-shift-name-${shift.id}`}>
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
                        {shift.jobTitle && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate" data-testid={`text-shift-jobtitle-${shift.id}`}>{shift.jobTitle}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{shift.site.name}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>
                              {format(new Date(shift.startTime), "HH:mm")} - {format(new Date(shift.endTime), "HH:mm")}
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
                        {shift.recurrence !== "none" && (
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

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-shift">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Shift</DialogTitle>
            <DialogDescription>Update shift details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-jobTitle">Job Title</Label>
              <Select
                value={editFormData.jobTitle}
                onValueChange={(value) => setEditFormData({ ...editFormData, jobTitle: value })}
              >
                <SelectTrigger id="edit-jobTitle" data-testid="edit-select-job-title">
                  <SelectValue placeholder="Select job title" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role (optional filter)</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) => setEditFormData({ ...editFormData, role: value, userId: "" })}
              >
                <SelectTrigger id="edit-role" data-testid="edit-select-role">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {JOB_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {JOB_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-employee">Employee</Label>
              <Select
                value={editFormData.userId}
                onValueChange={(value) => setEditFormData({ ...editFormData, userId: value })}
              >
                <SelectTrigger id="edit-employee" data-testid="edit-select-employee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editFilteredEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                      <span className="ml-2 text-muted-foreground text-xs">({JOB_ROLE_LABELS[emp.role] || emp.role})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-site">Site</Label>
              <Select
                value={editFormData.siteId}
                onValueChange={(value) => setEditFormData({ ...editFormData, siteId: value })}
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
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="edit-startTime">Start Time</Label>
                <Input
                  id="edit-startTime"
                  type="datetime-local"
                  value={editFormData.startTime}
                  onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-endTime">End Time</Label>
                <Input
                  id="edit-endTime"
                  type="datetime-local"
                  value={editFormData.endTime}
                  onChange={(e) => setEditFormData({ ...editFormData, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-recurrence">Recurrence</Label>
              <Select
                value={editFormData.recurrence}
                onValueChange={(value) => setEditFormData({ ...editFormData, recurrence: value })}
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
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
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
