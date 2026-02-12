import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeSessionStore, storage } from "./storage";

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
