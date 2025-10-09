// Referenced from blueprint:javascript_log_in_with_replit
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { insertSiteSchema, insertCheckInSchema, insertScheduledShiftSchema, insertUserSchema, insertInvitationSchema } from "@shared/schema";
import { startOfWeek } from "date-fns";
import { syncCheckInToSheets, updateCheckOutInSheets } from "./googleSheets";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
      const site = await storage.updateSite(id, req.body);
      res.json(site);
    } catch (error: any) {
      console.error("Error updating site:", error);
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
      const userId = req.user.claims.sub;
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      res.json(activeCheckIn);
    } catch (error) {
      console.error("Error fetching active check-in:", error);
      res.status(500).json({ message: "Failed to fetch active check-in" });
    }
  });

  app.get('/api/check-ins/my-recent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recentCheckIns = await storage.getUserRecentCheckIns(userId, 20);
      res.json(recentCheckIns);
    } catch (error) {
      console.error("Error fetching recent check-ins:", error);
      res.status(500).json({ message: "Failed to fetch recent check-ins" });
    }
  });

  app.post('/api/check-ins', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;

      // Verify this check-in belongs to the user
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      if (!activeCheckIn || activeCheckIn.id !== id) {
        return res.status(403).json({ message: "You can only check out your own active check-in" });
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
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

      // Fetch stats for each guard
      const guardsWithStats = await Promise.all(
        guards.map(async (guard) => {
          const weeklyHours = await storage.getUserWeeklyHours(guard.id, weekStart);
          const recentCheckIns = await storage.getUserRecentCheckIns(guard.id, 10);
          const activeCheckIn = await storage.getActiveCheckInForUser(guard.id);

          return {
            ...guard,
            weeklyHours,
            totalShifts: recentCheckIns.length,
            recentCheckIns: recentCheckIns.map(ci => ({
              id: ci.id,
              checkInTime: ci.checkInTime,
              checkOutTime: ci.checkOutTime,
              status: ci.status,
            })),
            isCurrentlyActive: !!activeCheckIn,
          };
        })
      );

      res.json(guardsWithStats);
    } catch (error) {
      console.error("Error fetching guards:", error);
      res.status(500).json({ message: "Failed to fetch guards" });
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
      const isAdminUser = user.claims.role === 'admin';
      
      if (isAdminUser) {
        // Admin can see all shifts
        const shifts = await storage.getAllScheduledShifts();
        res.json(shifts);
      } else {
        // Guards see only their own shifts
        const userId = user.claims.sub;
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
      const adminId = req.user.claims.sub;
      
      // Generate a unique token
      const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const validatedData = insertInvitationSchema.parse({
        ...req.body,
        token,
        invitedBy: adminId,
      });
      
      const invitation = await storage.createInvitation(validatedData);
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

  const httpServer = createServer(app);
  return httpServer;
}
