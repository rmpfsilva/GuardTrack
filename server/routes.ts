// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_auth_all_persistance
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword } from "./auth";
import { insertSiteSchema, updateSiteSchema, insertCheckInSchema, insertBreakSchema, insertScheduledShiftSchema, insertUserSchema, insertInvitationSchema, insertLeaveRequestSchema, updateLeaveRequestSchema, insertNoticeSchema, updateNoticeSchema, insertNoticeApplicationSchema, updateNoticeApplicationSchema, insertPushSubscriptionSchema } from "@shared/schema";
import { startOfWeek } from "date-fns";
import { syncCheckInToSheets, updateCheckOutInSheets } from "./googleSheets";
import { sendInvitationEmail } from './emailService';
import { sendNoticeNotification } from './push-notifications';

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Middleware to check if user is admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user && (req.user as any).role === 'admin') {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin access required" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // User management routes (admin only)
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Note: Users are auto-created on first login via Replit Auth
  // This endpoint is not needed for user creation - removed to prevent ID mismatch issues

  app.patch('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.updateUser(id, req.body);
      res.json(user);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(400).json({ message: error.message || "Failed to delete user" });
    }
  });

  // Admin password reset for users
  app.post('/api/admin/users/:id/reset-password', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Update user's password
      await storage.updateUser(id, {
        password: await hashPassword(newPassword),
      });

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(400).json({ message: error.message || "Failed to reset password" });
    }
  });

  // Sites routes
  app.get('/api/sites', isAuthenticated, async (req, res) => {
    try {
      const sites = await storage.getAllSites();
      res.json(sites);
    } catch (error) {
      console.error("Error fetching sites:", error);
      res.status(500).json({ message: "Failed to fetch sites" });
    }
  });

  app.post('/api/sites', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertSiteSchema.parse(req.body);
      const site = await storage.createSite(validatedData);
      res.status(201).json(site);
    } catch (error: any) {
      console.error("Error creating site:", error);
      res.status(400).json({ message: error.message || "Failed to create site" });
    }
  });

  app.patch('/api/sites/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      // Validate using partial update schema (strip unknown fields)
      const validatedData = updateSiteSchema.parse(req.body);
      const site = await storage.updateSite(id, validatedData);
      res.json(site);
    } catch (error: any) {
      console.error("Error updating site:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(400).json({ message: error.message || "Failed to update site" });
    }
  });

  app.delete('/api/sites/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSite(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting site:", error);
      res.status(400).json({ message: error.message || "Failed to delete site" });
    }
  });

  // Check-in routes for guards
  app.get('/api/check-ins/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      res.json(activeCheckIn);
    } catch (error) {
      console.error("Error fetching active check-in:", error);
      res.status(500).json({ message: "Failed to fetch active check-in" });
    }
  });

  app.get('/api/check-ins/my-recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recentCheckIns = await storage.getUserRecentCheckIns(userId, 20);
      res.json(recentCheckIns);
    } catch (error) {
      console.error("Error fetching recent check-ins:", error);
      res.status(500).json({ message: "Failed to fetch recent check-ins" });
    }
  });

  app.post('/api/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check if user already has an active check-in
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      if (activeCheckIn) {
        return res.status(400).json({ message: "You already have an active check-in. Please check out first." });
      }

      const { siteId, latitude, longitude, workingRole } = req.body;
      const validatedData = {
        userId,
        siteId,
        latitude: latitude || null,
        longitude: longitude || null,
        workingRole: workingRole || 'guard',
        status: 'active',
      };

      const checkIn = await storage.createCheckIn(validatedData);
      
      // Fetch full details for Google Sheets sync
      const checkInWithDetails = await storage.getActiveCheckInForUser(userId);
      if (checkInWithDetails) {
        // Sync to Google Sheets asynchronously (don't wait for it)
        syncCheckInToSheets(checkInWithDetails).catch(err => {
          console.error("Background sync to sheets failed:", err);
        });
      }

      res.status(201).json(checkIn);
    } catch (error: any) {
      console.error("Error creating check-in:", error);
      res.status(400).json({ message: error.message || "Failed to create check-in" });
    }
  });

  app.patch('/api/check-ins/:id/checkout', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { overtimeReason } = req.body;

      // Verify this check-in belongs to the user
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      if (!activeCheckIn || activeCheckIn.id !== id) {
        return res.status(403).json({ message: "You can only check out your own active check-in" });
      }

      // Check for scheduled shift to detect overtime
      const checkInTime = new Date(activeCheckIn.checkInTime);
      const checkOutTime = new Date();
      
      // Get user's scheduled shifts for the day
      const dayStart = new Date(checkInTime);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkInTime);
      dayEnd.setHours(23, 59, 59, 999);
      
      const scheduledShifts = await storage.getUserScheduledShifts(userId, dayStart, dayEnd);
      
      // Find matching scheduled shift (within 2 hours of start time)
      const matchingShift = scheduledShifts.find(shift => {
        const shiftStart = new Date(shift.startTime);
        const timeDiff = Math.abs(checkInTime.getTime() - shiftStart.getTime()) / (1000 * 60); // minutes
        return timeDiff <= 120; // Within 2 hours
      });

      // If there's a matching shift, check for overtime
      if (matchingShift) {
        const scheduledEndTime = new Date(matchingShift.endTime);
        const overtimeMinutes = (checkOutTime.getTime() - scheduledEndTime.getTime()) / (1000 * 60);
        
        // If overtime >30 minutes, require reason and create overtime request
        if (overtimeMinutes > 30) {
          if (!overtimeReason || overtimeReason.trim() === '') {
            return res.status(400).json({ 
              message: `You are checking out ${Math.round(overtimeMinutes)} minutes after your scheduled shift end time. Please provide a reason for the overtime.`,
              requiresOvertimeReason: true,
              overtimeMinutes: Math.round(overtimeMinutes)
            });
          }
          
          // Create overtime request pending approval
          await storage.createOvertimeRequest({
            checkInId: id,
            userId,
            scheduledEndTime: scheduledEndTime,
            actualEndTime: checkOutTime,
            overtimeMinutes: Math.round(overtimeMinutes),
            reason: overtimeReason,
            status: 'pending',
          });
        }
      }

      const checkIn = await storage.checkOut(id);
      
      // Update Google Sheets asynchronously
      const checkInWithDetails = await storage.getUserRecentCheckIns(userId, 1);
      if (checkInWithDetails.length > 0) {
        updateCheckOutInSheets(checkInWithDetails[0]).catch(err => {
          console.error("Background update to sheets failed:", err);
        });
      }

      res.json(checkIn);
    } catch (error: any) {
      console.error("Error checking out:", error);
      res.status(400).json({ message: error.message || "Failed to check out" });
    }
  });

  // Break routes for guards/stewards (unpaid breaks)
  app.get('/api/breaks/active', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const activeBreak = await storage.getActiveBreakForUser(userId);
      res.json(activeBreak);
    } catch (error) {
      console.error("Error fetching active break:", error);
      res.status(500).json({ message: "Failed to fetch active break" });
    }
  });

  app.post('/api/breaks/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check if user has an active check-in
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      if (!activeCheckIn) {
        return res.status(400).json({ message: "You must be checked in to start a break" });
      }

      // Check if user already has an active break
      const activeBreak = await storage.getActiveBreakForUser(userId);
      if (activeBreak) {
        return res.status(400).json({ message: "You already have an active break. Please end it first." });
      }

      const { latitude, longitude } = req.body;
      const breakData = {
        checkInId: activeCheckIn.id,
        userId,
        latitude: latitude || null,
        longitude: longitude || null,
        status: 'active' as const,
      };

      const breakRecord = await storage.createBreak(breakData);
      res.status(201).json(breakRecord);
    } catch (error: any) {
      console.error("Error starting break:", error);
      res.status(400).json({ message: error.message || "Failed to start break" });
    }
  });

  app.patch('/api/breaks/:id/end', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { latitude, longitude, reason } = req.body;

      // Verify this break belongs to the user
      const activeBreak = await storage.getActiveBreakForUser(userId);
      if (!activeBreak || activeBreak.id !== id) {
        return res.status(403).json({ message: "You can only end your own active break" });
      }

      // Calculate break duration
      const breakStartTime = new Date(activeBreak.breakStartTime);
      const breakEndTime = new Date();
      const breakDurationHours = (breakEndTime.getTime() - breakStartTime.getTime()) / (1000 * 60 * 60);

      // If break is >1 hour, require reason and mark for approval
      if (breakDurationHours > 1) {
        if (!reason || reason.trim() === '') {
          return res.status(400).json({ 
            message: "Your break was longer than 1 hour. Please provide a reason for the extended break time." 
          });
        }
        // Mark as pending approval
        await storage.updateBreak(id, {
          breakEndTime: breakEndTime,
          latitude: latitude || null,
          longitude: longitude || null,
          status: 'completed',
          reason: reason,
          approvalStatus: 'pending',
        });
      } else {
        // Auto-approve breaks <=1 hour
        await storage.updateBreak(id, {
          breakEndTime: breakEndTime,
          latitude: latitude || null,
          longitude: longitude || null,
          status: 'completed',
          approvalStatus: 'auto_approved',
        });
      }

      const breakRecord = await storage.getBreakById(id);
      res.json(breakRecord);
    } catch (error: any) {
      console.error("Error ending break:", error);
      res.status(400).json({ message: error.message || "Failed to end break" });
    }
  });

  // Admin routes
  app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activeCheckIns = await storage.getAllActiveCheckIns();
      const allSites = await storage.getAllSites();
      const allGuards = await storage.getUsersByRole('guard');
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
      const weeklyHours = await storage.getAllUsersWeeklyHours(weekStart);

      const stats = {
        activeGuards: activeCheckIns.length,
        totalSites: allSites.filter(s => s.isActive).length,
        totalGuards: allGuards.length,
        weeklyHours,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/admin/active-check-ins', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const activeCheckIns = await storage.getAllActiveCheckIns();
      res.json(activeCheckIns);
    } catch (error) {
      console.error("Error fetching active check-ins:", error);
      res.status(500).json({ message: "Failed to fetch active check-ins" });
    }
  });

  app.get('/api/admin/recent-activity', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const recentActivity = await storage.getAllRecentActivity(50);
      res.json(recentActivity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  app.get('/api/admin/guards', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const guards = await storage.getUsersByRole('guard');
      console.log(`[DEBUG] Found ${guards.length} guards from database`);
      
      if (guards.length === 0) {
        return res.json([]);
      }

      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

      // Fetch stats for each guard with individual error handling
      const guardsWithStats = [];
      
      for (const guard of guards) {
        try {
          console.log(`[DEBUG] Processing guard: ${guard.firstName} ${guard.lastName}`);
          
          let weeklyHours = 0;
          let recentCheckIns: any[] = [];
          let activeCheckIn = null;
          
          try {
            weeklyHours = await storage.getUserWeeklyHours(guard.id, weekStart);
          } catch (err: any) {
            console.error(`[ERROR] getUserWeeklyHours failed for ${guard.id}:`, err.message);
          }
          
          try {
            recentCheckIns = await storage.getUserRecentCheckIns(guard.id, 10);
          } catch (err: any) {
            console.error(`[ERROR] getUserRecentCheckIns failed for ${guard.id}:`, err.message);
          }
          
          try {
            activeCheckIn = await storage.getActiveCheckInForUser(guard.id);
          } catch (err: any) {
            console.error(`[ERROR] getActiveCheckInForUser failed for ${guard.id}:`, err.message);
          }

          guardsWithStats.push({
            ...guard,
            weeklyHours: weeklyHours || 0,
            totalShifts: recentCheckIns.length,
            recentCheckIns: recentCheckIns.map(ci => ({
              id: ci.id,
              checkInTime: ci.checkInTime,
              checkOutTime: ci.checkOutTime,
              status: ci.status,
            })),
            isCurrentlyActive: !!activeCheckIn,
          });
        } catch (error: any) {
          console.error(`[ERROR] Failed to process guard ${guard.id}:`, error.message);
          // Still add the guard with default values
          guardsWithStats.push({
            ...guard,
            weeklyHours: 0,
            totalShifts: 0,
            recentCheckIns: [],
            isCurrentlyActive: false,
          });
        }
      }

      console.log(`[DEBUG] Returning ${guardsWithStats.length} guards with stats`);
      res.json(guardsWithStats);
    } catch (error: any) {
      console.error("[ERROR] Failed to fetch guards - outer catch:", error.message, error.stack);
      res.status(500).json({ message: "Failed to fetch guards", error: error.message });
    }
  });

  // Admin manual check-in/out routes
  app.post('/api/admin/manual-check-in', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, siteId, workingRole } = req.body;
      
      if (!userId || !siteId || !workingRole) {
        return res.status(400).json({ message: "userId, siteId, and workingRole are required" });
      }

      // Check if user already has an active check-in
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      if (activeCheckIn) {
        return res.status(400).json({ message: "User already has an active check-in. Please check out first." });
      }

      const validatedData = {
        userId,
        siteId,
        latitude: null,
        longitude: null,
        workingRole,
        status: 'active',
      };

      const checkIn = await storage.createCheckIn(validatedData);
      
      // Fetch full details for Google Sheets sync
      const checkInWithDetails = await storage.getActiveCheckInForUser(userId);
      if (checkInWithDetails) {
        syncCheckInToSheets(checkInWithDetails).catch(err => {
          console.error("Background sync to sheets failed:", err);
        });
      }

      res.status(201).json(checkIn);
    } catch (error: any) {
      console.error("Error creating manual check-in:", error);
      res.status(400).json({ message: error.message || "Failed to create check-in" });
    }
  });

  app.post('/api/admin/manual-check-out', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { checkInId } = req.body;
      
      if (!checkInId) {
        return res.status(400).json({ message: "checkInId is required" });
      }

      // Get the check-in to verify it exists and is active
      const allActiveCheckIns = await storage.getAllActiveCheckIns();
      const activeCheckIn = allActiveCheckIns.find(ci => ci.id === checkInId);
      
      if (!activeCheckIn) {
        return res.status(404).json({ message: "Active check-in not found" });
      }

      const checkIn = await storage.checkOut(checkInId);
      
      // Update Google Sheets asynchronously
      const checkInWithDetails = await storage.getUserRecentCheckIns(activeCheckIn.userId, 1);
      if (checkInWithDetails.length > 0) {
        updateCheckOutInSheets(checkInWithDetails[0]).catch(err => {
          console.error("Background update to sheets failed:", err);
        });
      }

      res.json(checkIn);
    } catch (error: any) {
      console.error("Error checking out:", error);
      res.status(400).json({ message: error.message || "Failed to check out" });
    }
  });

  // Admin override check-in times route
  app.patch('/api/admin/override-check-in', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { checkInId, checkInTime, checkOutTime } = req.body;
      
      if (!checkInId || !checkInTime) {
        return res.status(400).json({ message: "checkInId and checkInTime are required" });
      }

      // Parse and validate the times
      const parsedCheckInTime = new Date(checkInTime);
      const parsedCheckOutTime = checkOutTime ? new Date(checkOutTime) : null;
      
      if (isNaN(parsedCheckInTime.getTime())) {
        return res.status(400).json({ message: "Invalid check-in time format" });
      }
      
      if (parsedCheckOutTime && isNaN(parsedCheckOutTime.getTime())) {
        return res.status(400).json({ message: "Invalid check-out time format" });
      }
      
      if (parsedCheckOutTime && parsedCheckOutTime <= parsedCheckInTime) {
        return res.status(400).json({ message: "Check-out time must be after check-in time" });
      }

      // Update the check-in times using storage
      const updatedCheckIn = await storage.updateCheckInTimes(checkInId, {
        checkInTime: parsedCheckInTime,
        checkOutTime: parsedCheckOutTime,
      });

      res.json(updatedCheckIn);
    } catch (error: any) {
      console.error("Error overriding check-in times:", error);
      res.status(400).json({ message: error.message || "Failed to override check-in times" });
    }
  });

  // Scheduled shifts routes
  app.get('/api/scheduled-shifts', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const isAdminUser = user.role === 'admin';
      
      if (isAdminUser) {
        // Admin can see all shifts
        const shifts = await storage.getAllScheduledShifts();
        res.json(shifts);
      } else {
        // Guards see only their own shifts
        const userId = user.id;
        const shifts = await storage.getUserScheduledShifts(userId);
        res.json(shifts);
      }
    } catch (error) {
      console.error("Error fetching scheduled shifts:", error);
      res.status(500).json({ message: "Failed to fetch scheduled shifts" });
    }
  });

  app.get('/api/scheduled-shifts/user/:userId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const shifts = await storage.getUserScheduledShifts(userId);
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching user shifts:", error);
      res.status(500).json({ message: "Failed to fetch user shifts" });
    }
  });

  app.get('/api/scheduled-shifts/range', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      const shifts = await storage.getScheduledShiftsInRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching shifts in range:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.post('/api/scheduled-shifts', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const validatedData = insertScheduledShiftSchema.parse(req.body);
      const shift = await storage.createScheduledShift(validatedData);
      res.status(201).json(shift);
    } catch (error: any) {
      console.error("Error creating scheduled shift:", error);
      res.status(400).json({ message: error.message || "Failed to create shift" });
    }
  });

  app.patch('/api/scheduled-shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const shift = await storage.updateScheduledShift(id, req.body);
      res.json(shift);
    } catch (error: any) {
      console.error("Error updating scheduled shift:", error);
      res.status(400).json({ message: error.message || "Failed to update shift" });
    }
  });

  app.delete('/api/scheduled-shifts/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteScheduledShift(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting scheduled shift:", error);
      res.status(400).json({ message: error.message || "Failed to delete shift" });
    }
  });

  // Leave request routes
  app.post('/api/leave-requests', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertLeaveRequestSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      const leaveRequest = await storage.createLeaveRequest(validatedData);
      res.status(201).json(leaveRequest);
    } catch (error: any) {
      console.error("Error creating leave request:", error);
      res.status(400).json({ message: error.message || "Failed to create leave request" });
    }
  });

  app.get('/api/leave-requests/my', isAuthenticated, async (req: any, res) => {
    try {
      const requests = await storage.getUserLeaveRequests(req.user.id);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching user leave requests:", error);
      res.status(500).json({ message: "Failed to fetch leave requests" });
    }
  });

  app.get('/api/leave-requests', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await storage.getAllLeaveRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching all leave requests:", error);
      res.status(500).json({ message: "Failed to fetch leave requests" });
    }
  });

  app.get('/api/leave-requests/pending', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const requests = await storage.getPendingLeaveRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching pending leave requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
    }
  });

  app.get('/api/leave-requests/upcoming', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const daysAhead = parseInt(req.query.days as string) || 30;
      const requests = await storage.getUpcomingLeaveRequests(daysAhead);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching upcoming leave requests:", error);
      res.status(500).json({ message: "Failed to fetch upcoming requests" });
    }
  });

  app.patch('/api/leave-requests/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateLeaveRequestSchema.parse({
        ...req.body,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      });
      const leaveRequest = await storage.updateLeaveRequest(id, validatedData);
      res.json(leaveRequest);
    } catch (error: any) {
      console.error("Error updating leave request:", error);
      res.status(400).json({ message: error.message || "Failed to update leave request" });
    }
  });

  app.post('/api/leave-requests/:id/cancel', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { cancellationReason } = req.body;
      
      if (!cancellationReason || cancellationReason.trim() === '') {
        return res.status(400).json({ message: "Cancellation reason is required" });
      }

      const leaveRequest = await storage.getLeaveRequest(id);
      
      if (!leaveRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      if (leaveRequest.status !== 'approved') {
        return res.status(400).json({ message: "Only approved leave requests can be cancelled" });
      }

      const cancelled = await storage.updateLeaveRequest(id, {
        status: 'cancelled',
        cancelledBy: req.user.id,
        cancelledAt: new Date(),
        cancellationReason,
      });

      res.json(cancelled);
    } catch (error: any) {
      console.error("Error cancelling leave request:", error);
      res.status(400).json({ message: error.message || "Failed to cancel leave request" });
    }
  });

  app.delete('/api/leave-requests/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const leaveRequest = await storage.getLeaveRequest(id);
      
      if (!leaveRequest) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      // Only allow users to delete their own requests or admins to delete any
      if (leaveRequest.userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteLeaveRequest(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting leave request:", error);
      res.status(400).json({ message: error.message || "Failed to delete leave request" });
    }
  });

  // Billing reports routes (admin only)
  app.get('/api/admin/billing/weekly', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { weekStart } = req.query;
      const startDate = weekStart ? new Date(weekStart as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const report = await storage.getWeeklyBillingReport(startDate);
      res.json(report);
    } catch (error) {
      console.error("Error fetching weekly billing report:", error);
      res.status(500).json({ message: "Failed to fetch billing report" });
    }
  });

  app.get('/api/admin/billing/daily/:siteId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { siteId } = req.params;
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const activity = await storage.getDailyActivityBySite(siteId, targetDate);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching daily activity:", error);
      res.status(500).json({ message: "Failed to fetch daily activity" });
    }
  });

  // Advanced reporting routes (admin only)
  app.get('/api/admin/reports/overtime', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { weekStart } = req.query;
      const startDate = weekStart ? new Date(weekStart as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const report = await storage.getOvertimeReport(startDate);
      res.json(report);
    } catch (error) {
      console.error("Error fetching overtime report:", error);
      res.status(500).json({ message: "Failed to fetch overtime report" });
    }
  });

  app.get('/api/admin/reports/anomalies', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endDate ? new Date(endDate as string) : new Date();
      const report = await storage.getAnomalyReport(start, end);
      res.json(report);
    } catch (error) {
      console.error("Error fetching anomaly report:", error);
      res.status(500).json({ message: "Failed to fetch anomaly report" });
    }
  });

  app.get('/api/admin/reports/detailed-shifts', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endDate ? new Date(endDate as string) : new Date();
      const report = await storage.getDetailedShiftReport(start, end);
      res.json(report);
    } catch (error) {
      console.error("Error fetching detailed shift report:", error);
      res.status(500).json({ message: "Failed to fetch detailed shift report" });
    }
  });

  // Break and overtime approval routes (admin only)
  app.get('/api/admin/approvals/breaks', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const results = await db
        .select()
        .from(breaks)
        .leftJoin(users, eq(breaks.userId, users.id))
        .leftJoin(checkIns, eq(breaks.checkInId, checkIns.id))
        .leftJoin(sites, eq(checkIns.siteId, sites.id))
        .where(eq(breaks.approvalStatus, 'pending'))
        .orderBy(desc(breaks.breakEndTime));

      const pendingBreaks = results.map(r => ({
        ...r.breaks,
        user: r.users,
        checkIn: r.check_ins,
        site: r.sites,
      }));

      res.json(pendingBreaks);
    } catch (error) {
      console.error("Error fetching pending breaks:", error);
      res.status(500).json({ message: "Failed to fetch pending breaks" });
    }
  });

  app.post('/api/admin/approvals/breaks/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const breakRecord = await storage.updateBreak(id, {
        approvalStatus: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date(),
      });

      res.json(breakRecord);
    } catch (error: any) {
      console.error("Error approving break:", error);
      res.status(400).json({ message: error.message || "Failed to approve break" });
    }
  });

  app.post('/api/admin/approvals/breaks/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const breakRecord = await storage.updateBreak(id, {
        approvalStatus: 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
      });

      res.json(breakRecord);
    } catch (error: any) {
      console.error("Error rejecting break:", error);
      res.status(400).json({ message: error.message || "Failed to reject break" });
    }
  });

  app.get('/api/admin/approvals/overtime', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const overtimeRequests = await storage.getPendingOvertimeRequests();
      res.json(overtimeRequests);
    } catch (error) {
      console.error("Error fetching pending overtime:", error);
      res.status(500).json({ message: "Failed to fetch pending overtime requests" });
    }
  });

  app.post('/api/admin/approvals/overtime/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = req.user.id;

      const overtimeRequest = await storage.approveOvertimeRequest(id, adminId, notes);
      res.json(overtimeRequest);
    } catch (error: any) {
      console.error("Error approving overtime:", error);
      res.status(400).json({ message: error.message || "Failed to approve overtime" });
    }
  });

  app.post('/api/admin/approvals/overtime/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = req.user.id;

      const overtimeRequest = await storage.rejectOvertimeRequest(id, adminId, notes);
      res.json(overtimeRequest);
    } catch (error: any) {
      console.error("Error rejecting overtime:", error);
      res.status(400).json({ message: error.message || "Failed to reject overtime" });
    }
  });

  // Invitation routes (admin only)
  app.get('/api/admin/invitations', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const invitations = await storage.getAllInvitations();
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post('/api/admin/invitations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      
      // Get admin user details for sending email
      const adminUser = await storage.getUserById(adminId);
      if (!adminUser) {
        return res.status(400).json({ message: "Admin user not found" });
      }
      
      // Generate a unique token
      const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const validatedData = insertInvitationSchema.parse({
        ...req.body,
        token,
        invitedBy: adminId,
      });
      
      const invitation = await storage.createInvitation(validatedData);
      
      // Send invitation email
      try {
        if (!adminUser.email) {
          console.warn("Admin user has no email set - skipping email notification");
        } else {
          const adminName = adminUser.firstName && adminUser.lastName 
            ? `${adminUser.firstName} ${adminUser.lastName}`
            : adminUser.username;
          
          await sendInvitationEmail({
            toEmail: invitation.email,
            fromEmail: adminUser.email,
            fromName: adminName,
            inviteToken: invitation.token,
            role: invitation.role,
            expiresAt: invitation.expiresAt || undefined,
          });
        }
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
      }
      
      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(400).json({ message: error.message || "Failed to create invitation" });
    }
  });

  app.patch('/api/admin/invitations/:id/revoke', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const invitation = await storage.revokeInvitation(id);
      res.json(invitation);
    } catch (error: any) {
      console.error("Error revoking invitation:", error);
      res.status(400).json({ message: error.message || "Failed to revoke invitation" });
    }
  });

  app.delete('/api/admin/invitations/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteInvitation(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      res.status(400).json({ message: error.message || "Failed to delete invitation" });
    }
  });

  // Notice routes
  app.post('/api/notices', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const validatedData = insertNoticeSchema.parse(req.body);
      const notice = await storage.createNotice({
        ...validatedData,
        postedBy: req.user.id,
      });

      // Send push notifications to all subscribed users (non-blocking)
      (async () => {
        try {
          const allSubscriptions = await storage.getAllActivePushSubscriptions();
          const result = await sendNoticeNotification(
            allSubscriptions,
            notice.type,
            notice.title,
            notice.startTime ? new Date(notice.startTime).toISOString() : ''
          );
          console.log(`Push notifications sent: ${result.sent} successful, ${result.failed} failed`);
        } catch (error) {
          console.error('Error sending push notifications:', error);
        }
      })();

      res.status(201).json(notice);
    } catch (error: any) {
      console.error("Error creating notice:", error);
      res.status(400).json({ message: error.message || "Failed to create notice" });
    }
  });

  app.get('/api/notices', isAuthenticated, async (req, res) => {
    try {
      const notices = await storage.getActiveNotices();
      res.json(notices);
    } catch (error) {
      console.error("Error fetching notices:", error);
      res.status(500).json({ message: "Failed to fetch notices" });
    }
  });

  app.get('/api/notices/all', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const notices = await storage.getAllNotices();
      res.json(notices);
    } catch (error) {
      console.error("Error fetching all notices:", error);
      res.status(500).json({ message: "Failed to fetch notices" });
    }
  });

  app.get('/api/notices/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const notice = await storage.getNotice(id);
      if (!notice) {
        return res.status(404).json({ message: "Notice not found" });
      }
      res.json(notice);
    } catch (error) {
      console.error("Error fetching notice:", error);
      res.status(500).json({ message: "Failed to fetch notice" });
    }
  });

  app.patch('/api/notices/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateNoticeSchema.parse(req.body);
      const notice = await storage.updateNotice(id, validatedData);
      res.json(notice);
    } catch (error: any) {
      console.error("Error updating notice:", error);
      res.status(400).json({ message: error.message || "Failed to update notice" });
    }
  });

  app.delete('/api/notices/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteNotice(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting notice:", error);
      res.status(400).json({ message: error.message || "Failed to delete notice" });
    }
  });

  // Notice application routes
  app.post('/api/notice-applications', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertNoticeApplicationSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      const application = await storage.createNoticeApplication(validatedData);
      res.status(201).json(application);
    } catch (error: any) {
      console.error("Error creating notice application:", error);
      res.status(400).json({ message: error.message || "Failed to create application" });
    }
  });

  app.get('/api/notice-applications/my', isAuthenticated, async (req: any, res) => {
    try {
      const applications = await storage.getUserNoticeApplications(req.user.id);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching user applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.get('/api/notice-applications/notice/:noticeId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { noticeId } = req.params;
      const applications = await storage.getNoticeApplicationsForNotice(noticeId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching notice applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.patch('/api/notice-applications/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateNoticeApplicationSchema.parse({
        ...req.body,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      });
      const application = await storage.updateNoticeApplication(id, validatedData);
      res.json(application);
    } catch (error: any) {
      console.error("Error updating notice application:", error);
      res.status(400).json({ message: error.message || "Failed to update application" });
    }
  });

  app.delete('/api/notice-applications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if user owns the application or is admin
      const application = await storage.getNoticeApplication(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      const isOwner = application.user.id === req.user.id;
      const isUserAdmin = req.user.role === 'admin';
      
      if (!isOwner && !isUserAdmin) {
        return res.status(403).json({ message: "Forbidden - You can only delete your own applications" });
      }
      
      await storage.deleteNoticeApplication(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting notice application:", error);
      res.status(400).json({ message: error.message || "Failed to delete application" });
    }
  });

  // Push subscription routes
  app.post('/api/push-subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertPushSubscriptionSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      const subscription = await storage.createPushSubscription(validatedData);
      res.status(201).json(subscription);
    } catch (error: any) {
      console.error("Error creating push subscription:", error);
      res.status(400).json({ message: error.message || "Failed to create subscription" });
    }
  });

  app.get('/api/push-subscriptions/my', isAuthenticated, async (req: any, res) => {
    try {
      const subscriptions = await storage.getUserPushSubscriptions(req.user.id);
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching user subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Delete push subscription by endpoint (used when unsubscribing from client)
  app.delete('/api/push-subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      
      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint is required" });
      }
      
      // Get user's subscriptions to find the one with matching endpoint
      const subscriptions = await storage.getUserPushSubscriptions(req.user.id);
      const subscription = subscriptions.find(sub => sub.endpoint === endpoint);
      
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      
      await storage.deletePushSubscription(subscription.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting push subscription by endpoint:", error);
      res.status(400).json({ message: error.message || "Failed to delete subscription" });
    }
  });

  // Delete push subscription by ID (admin endpoint)
  app.delete('/api/push-subscriptions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Check if user owns the subscription or is admin
      const subscriptions = await storage.getUserPushSubscriptions(req.user.id);
      const subscription = subscriptions.find(sub => sub.id === id);
      
      if (!subscription && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden - You can only delete your own subscriptions" });
      }
      
      await storage.deletePushSubscription(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting push subscription:", error);
      res.status(400).json({ message: error.message || "Failed to delete subscription" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
