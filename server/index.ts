import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeSessionStore, storage } from "./storage";
import { hashPassword } from "./auth";
import { db } from "./db";
import { users, userRoles } from "@shared/schema";
import { or, eq } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

async function ensureProductionSuperAdmin() {
  try {
    const TARGET_USERNAME = 'rmpfsilva';
    const TARGET_EMAIL = 'rmpfsilva@gmail.com';

    // Find any user matching EITHER username OR email — handles all database states
    const matches = await db.select().from(users).where(
      or(
        eq(users.username, TARGET_USERNAME),
        eq(users.email, TARGET_EMAIL)
      )
    );

    const initialPassword = await hashPassword('GuardTrack@2024!');
    let targetId: string;

    if (matches.length > 0) {
      // Use whichever record we found (prefer email match, then username match)
      const target = matches.find(u => u.email === TARGET_EMAIL) ?? matches[0];
      targetId = target.id;

      const needsUpdate = target.username !== TARGET_USERNAME || target.role !== 'super_admin' || target.companyId !== null;
      if (needsUpdate) {
        await db.update(users).set({
          username: TARGET_USERNAME,
          email: TARGET_EMAIL,
          password: initialPassword,
          role: 'super_admin',
          companyId: null,
          updatedAt: new Date(),
        }).where(eq(users.id, target.id));
        log(`[Init] rmpfsilva users table fixed (was: username=${target.username}, role=${target.role}, companyId=${target.companyId ?? 'null'})`);
      }
    } else {
      // No matching record — clear stale email and create fresh
      await db.update(users).set({ email: null }).where(eq(users.email, TARGET_EMAIL));
      const [created] = await db.insert(users).values({
        username: TARGET_USERNAME,
        email: TARGET_EMAIL,
        password: initialPassword,
        role: 'super_admin',
        companyId: null,
      }).returning({ id: users.id });
      targetId = created.id;
      log('[Init] rmpfsilva super_admin created fresh');
    }

    // ALWAYS ensure userRoles table is correct — stale 'admin' entries override users.role
    const existingRoles = await db.select().from(userRoles).where(eq(userRoles.userId, targetId));
    const hasSuperAdmin = existingRoles.some(r => r.role === 'super_admin');
    const hasStaleRoles = existingRoles.some(r => r.role !== 'super_admin');

    if (hasStaleRoles) {
      await db.delete(userRoles).where(eq(userRoles.userId, targetId));
      log('[Init] rmpfsilva stale userRoles cleared');
    }
    if (!hasSuperAdmin) {
      await db.insert(userRoles).values({ userId: targetId, role: 'super_admin' });
      log('[Init] rmpfsilva super_admin userRole inserted');
    }

    if (!hasStaleRoles && hasSuperAdmin) {
      log('[Init] rmpfsilva super_admin already configured correctly');
    }
  } catch (err) {
    console.error('[Init] Error ensuring super admin:', err);
  }
}

async function backfillJobShareShifts() {
  try {
    const allJobShares = await storage.getAllJobShares();
    const acceptedWithWorkers = allJobShares.filter(
      (js: any) => js.status === 'accepted' && js.assignedWorkers && (js.assignedWorkers as any[]).length > 0
    );

    if (acceptedWithWorkers.length === 0) {
      log("[Backfill] No accepted job shares with workers found");
      return;
    }

    const existingShifts = await storage.getAllScheduledShifts();
    const allUsers = await storage.getAllUsers();

    const roleToJobTitle: Record<string, string> = {
      sia: 'SIA Guard', guard: 'SIA Guard', steward: 'Steward',
      supervisor: 'Supervisor', response: 'Response Officer',
      dog_handler: 'Dog Handler', call_out: 'Call Out',
    };

    const findMatchingUser = (worker: any, companyUsers: any[]) => {
      const workerNameLower = (worker.name || '').toLowerCase().trim();
      if (worker.email) {
        const emailMatch = companyUsers.find((u: any) => u.email?.toLowerCase() === worker.email.toLowerCase());
        if (emailMatch) return emailMatch;
      }
      if (!workerNameLower) return undefined;
      return companyUsers.find((u: any) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().trim();
        const reverseName = `${u.lastName || ''} ${u.firstName || ''}`.toLowerCase().trim();
        const usernameLower = u.username.toLowerCase().trim();
        if (fullName === workerNameLower) return true;
        if (reverseName === workerNameLower) return true;
        if (usernameLower === workerNameLower) return true;
        if (u.firstName && u.firstName.toLowerCase() === workerNameLower) return true;
        if (u.lastName && u.lastName.toLowerCase() === workerNameLower) return true;
        return false;
      });
    };

    let totalCreated = 0;

    for (const js of acceptedWithWorkers) {
      const hasExistingShifts = existingShifts.some((s: any) => s.jobShareId === js.id);
      if (hasExistingShifts) continue;

      const companyUsers = allUsers.filter((u: any) => u.companyId === js.toCompanyId);
      const workers = js.assignedWorkers as any[];

      const startDate = new Date(js.startDate);
      const endDate = new Date(js.endDate);
      const startHour = startDate.getHours() || 8;
      const startMin = startDate.getMinutes() || 0;
      const endHour = endDate.getHours() || 20;
      const endMin = endDate.getMinutes() || 0;

      for (const worker of workers) {
        const matchedUser = findMatchingUser(worker, companyUsers);
        if (matchedUser) {
          const jobTitle = roleToJobTitle[worker.role] || worker.role || 'Guard';
          const currentDate = new Date(startDate);
          currentDate.setHours(0, 0, 0, 0);
          const lastDate = new Date(endDate);
          lastDate.setHours(0, 0, 0, 0);

          while (currentDate <= lastDate) {
            const shiftStart = new Date(currentDate);
            shiftStart.setHours(startHour, startMin, 0, 0);
            const shiftEnd = new Date(currentDate);
            shiftEnd.setHours(endHour, endMin, 0, 0);

            await storage.createScheduledShift({
              userId: matchedUser.id,
              siteId: js.siteId,
              jobTitle,
              startTime: shiftStart,
              endTime: shiftEnd,
              recurrence: 'none',
              isActive: true,
              notes: `Auto-created from job share`,
              jobShareId: js.id,
            });
            totalCreated++;
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }
    }

    log(`[Backfill] Complete: ${totalCreated} shifts created from ${acceptedWithWorkers.length} accepted job shares`);
  } catch (error) {
    console.error("[Backfill] Error:", error);
  }
}

(async () => {
  try {
    // Initialize session store before starting the server
    await initializeSessionStore();

    // Ensure platform super admin exists in whichever DB this instance connects to
    await ensureProductionSuperAdmin();
    
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log the error but don't throw to prevent crashes
      console.error('Error:', err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Cloud Run and Autoscale deployments require listening on process.env.PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });

    setTimeout(() => {
      backfillJobShareShifts().catch(err => console.error("Backfill error:", err));
    }, 3000);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
