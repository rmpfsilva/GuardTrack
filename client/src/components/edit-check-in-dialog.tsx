import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CheckInWithDetails } from "@shared/schema";

interface EditCheckInDialogProps {
  checkIn: CheckInWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditCheckInDialog({ checkIn, isOpen, onClose }: EditCheckInDialogProps) {
  const { toast } = useToast();
  const [checkInDate, setCheckInDate] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");

  // Initialize form when check-in changes
  useEffect(() => {
    if (checkIn) {
      const checkInDateTime = new Date(checkIn.checkInTime);
      setCheckInDate(format(checkInDateTime, "yyyy-MM-dd"));
      setCheckInTime(format(checkInDateTime, "HH:mm"));
      
      if (checkIn.checkOutTime) {
        const checkOutDateTime = new Date(checkIn.checkOutTime);
        setCheckOutDate(format(checkOutDateTime, "yyyy-MM-dd"));
        setCheckOutTime(format(checkOutDateTime, "HH:mm"));
      } else {
        setCheckOutDate("");
        setCheckOutTime("");
      }
    }
  }, [checkIn]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { checkInId: string; checkInTime: string; checkOutTime?: string }) => {
      return await apiRequest("PATCH", "/api/admin/override-check-in", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/active-check-ins"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Times Updated",
        description: "Check-in times have been successfully updated.",
      });
      onClose();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!checkIn || !checkInDate || !checkInTime) {
      toast({
        title: "Missing Information",
        description: "Check-in date and time are required.",
        variant: "destructive",
      });
      return;
    }

    const checkInDateTime = `${checkInDate}T${checkInTime}:00`;
    const checkOutDateTime = checkOutDate && checkOutTime ? `${checkOutDate}T${checkOutTime}:00` : undefined;

    // Validate check-out is after check-in
    if (checkOutDateTime && new Date(checkOutDateTime) <= new Date(checkInDateTime)) {
      toast({
        title: "Invalid Times",
        description: "Check-out time must be after check-in time.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      checkInId: checkIn.id,
      checkInTime: checkInDateTime,
      checkOutTime: checkOutDateTime,
    });
  };

  if (!checkIn) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Edit Check-In Times
          </DialogTitle>
          <DialogDescription>
            Override check-in and check-out times for {checkIn.user.firstName} {checkIn.user.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p><strong>Site:</strong> {checkIn.site.name}</p>
            <p><strong>Role:</strong> {checkIn.workingRole || "guard"}</p>
            <p><strong>Status:</strong> {checkIn.status}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkin-date">Check-In Date</Label>
            <Input
              id="checkin-date"
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              data-testid="input-override-checkin-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkin-time">Check-In Time</Label>
            <Input
              id="checkin-time"
              type="time"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              data-testid="input-override-checkin-time"
            />
          </div>

          {checkIn.status === 'completed' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="checkout-date">Check-Out Date</Label>
                <Input
                  id="checkout-date"
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  data-testid="input-override-checkout-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkout-time">Check-Out Time</Label>
                <Input
                  id="checkout-time"
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  data-testid="input-override-checkout-time"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-override"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
