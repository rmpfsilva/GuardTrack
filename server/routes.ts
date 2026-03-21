// Referenced from blueprint:javascript_log_in_with_replit and blueprint:javascript_auth_all_persistance
import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db, pool } from "./db";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { users, breaks, checkIns, sites, companies, scheduledShifts, tasks, staffProfiles, companyDocuments, signatureRequests, incidentPhotos, JOB_SHARE_ROLES } from "@shared/schema";
import { eq, desc, and, gte, lte, or, sql as drizzleSql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertCompanySchema, updateCompanySchema, insertSiteSchema, updateSiteSchema, insertCheckInSchema, insertBreakSchema, insertScheduledShiftSchema, insertUserSchema, insertInvitationSchema, insertLeaveRequestSchema, updateLeaveRequestSchema, insertNoticeSchema, updateNoticeSchema, insertNoticeApplicationSchema, updateNoticeApplicationSchema, insertPushSubscriptionSchema, insertInvoiceSchema, updateInvoiceSchema, updateCompanySettingsSchema } from "@shared/schema";
import { startOfWeek } from "date-fns";
import { syncCheckInToSheets, updateCheckOutInSheets } from "./googleSheets";
import { sendInvitationEmail, sendJobShareNotificationEmail, sendNewJobShareEmail } from './emailService';
import { sendNoticeNotification } from './push-notifications';

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Middleware to check if user is admin or super admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  console.log('[DEBUG isAdmin] req.user:', req.user ? { id: (req.user as any).id, role: (req.user as any).role, companyId: (req.user as any).companyId } : 'undefined');
  if (req.user && ((req.user as any).role === 'admin' || (req.user as any).role === 'super_admin')) {
    return next();
  }
  console.log('[DEBUG isAdmin] Access denied - role:', req.user ? (req.user as any).role : 'no user');
  res.status(403).json({ message: "Forbidden - Admin access required" });
}

// Middleware to check if user is super admin (can manage companies)
// When impersonating a company, req.user.role is temporarily 'admin' for data-scoping purposes.
// _originalRole preserves the real 'super_admin' role so super-admin-only routes still work.
function isSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  const effectiveRole = user?._originalRole || user?.role;
  if (user && effectiveRole === 'super_admin') {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Super Admin access required" });
}

// Feature access types
type FeatureName = 'userManagement' | 'dashboardAccess' | 'reportsViewing' | 'checkInOut' | 
  'shiftScheduling' | 'siteManagement' | 'breakTracking' | 'overtimeManagement' | 
  'leaveRequests' | 'noticeBoard' | 'pushNotifications';

// Middleware factory to check if company has access to a specific feature
function requireFeature(featureName: FeatureName) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    
    // Super admin always has access to all features
    if (user && user.role === 'super_admin') {
      return next();
    }
    
    // Check if user has a company
    if (!user || !user.companyId) {
      return res.status(403).json({ message: "No company associated with user" });
    }
    
    try {
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(403).json({ message: "Company not found" });
      }
      
      // Check if company is blocked
      if (company.isBlocked) {
        return res.status(403).json({ 
          message: "Company access has been blocked. Please contact support.",
          blocked: true
        });
      }
      
      // If no plan assigned, allow all features (beta / no restrictions)
      if (!company.planId) {
        return next();
      }
      
      // Get the company's subscription plan
      const plan = await storage.getSubscriptionPlan(company.planId);
      if (!plan) {
        return res.status(403).json({ message: "Subscription plan not found" });
      }
      
      // Check if plan is active
      if (!plan.isActive) {
        return res.status(403).json({ 
          message: "Subscription plan is no longer active. Please contact support.",
          planInactive: true
        });
      }
      
      // Check feature access
      const features = plan.features as Record<string, boolean>;
      if (!features[featureName]) {
        return res.status(403).json({ 
          message: `Feature '${featureName}' is not included in your current plan. Please upgrade.`,
          featureRestricted: true,
          feature: featureName,
          currentPlan: plan.name
        });
      }
      
      next();
    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({ message: "Failed to check feature access" });
    }
  };
}

// Helper function to check company feature access (for use in route handlers)
async function checkCompanyFeatureAccess(companyId: string, featureName: FeatureName): Promise<{ hasAccess: boolean; reason?: string }> {
  try {
    const company = await storage.getCompany(companyId);
    if (!company) {
      return { hasAccess: false, reason: "Company not found" };
    }
    
    if (company.isBlocked) {
      return { hasAccess: false, reason: "Company access blocked" };
    }
    
    if (!company.planId) {
      return { hasAccess: true }; // No plan = full access (beta / no restrictions)
    }
    
    const plan = await storage.getSubscriptionPlan(company.planId);
    if (!plan || !plan.isActive) {
      return { hasAccess: false, reason: "Plan not found or inactive" };
    }
    
    const features = plan.features as Record<string, boolean>;
    return { hasAccess: !!features[featureName] };
  } catch (error) {
    console.error('Error checking feature access:', error);
    return { hasAccess: false, reason: "Error checking access" };
  }
}

// Middleware to check if company trial is active (allows super admin to bypass)
async function requireActiveTrial(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  
  // Super admin always has access
  if (user && user.role === 'super_admin') {
    return next();
  }
  
  // Check if user has a company
  if (!user || !user.companyId) {
    return res.status(403).json({ message: "No company associated with user" });
  }
  
  try {
    // Companies with no plan assigned get full access (beta / direct clients)
    const company = await storage.getCompany(user.companyId);
    if (!company) {
      return res.status(403).json({ message: "Company not found" });
    }
    if (!company.planId) {
      return next();
    }

    const trialStatus = await storage.checkTrialStatus(user.companyId);
    
    if (!trialStatus.isActive) {
      return res.status(403).json({ 
        message: "Trial has expired. Please contact support to upgrade.",
        trialExpired: true,
        daysRemaining: trialStatus.daysRemaining
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking trial status:', error);
    res.status(500).json({ message: "Failed to check trial status" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware - sets up /api/register, /api/login, /api/logout, /api/user
  setupAuth(app);

  // Initialize super admin user with proper hashed password if needed
  try {
    const superAdmin = await storage.getSuperAdminByUsername('admin');
    if (superAdmin && superAdmin.password === 'password') {
      // Super admin has plain text password, update it to hashed "admin123"
      await storage.updateUser(superAdmin.id, {
        password: await hashPassword('admin123')
      });
      console.log('Super admin password initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing super admin user:', error);
  }

  // Public endpoint to lookup company by Company ID code (secure - doesn't expose all companies)
  app.get('/api/companies/lookup/:companyCode', async (req: any, res) => {
    try {
      const { companyCode } = req.params;
      
      if (!companyCode || companyCode.trim().length === 0) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      const companies = await storage.getAllCompanies();
      // Find company by companyId code (case-insensitive exact match)
      const company = companies.find(
        c => c.isActive && c.companyId?.toLowerCase() === companyCode.trim().toLowerCase()
      );
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Return minimal info for login
      res.json({
        id: company.id,
        name: company.name,
        companyId: company.companyId,
      });
    } catch (error) {
      console.error("Error looking up company:", error);
      res.status(500).json({ message: "Failed to lookup company" });
    }
  });

  // PWA Install routes — public endpoints for install page
  app.get('/api/install/company-info/:companyUuid', async (req: any, res) => {
    try {
      const { companyUuid } = req.params;
      const companies = await storage.getAllCompanies();
      const company = companies.find(c => c.isActive && c.id === companyUuid);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json({
        id: company.id,
        name: company.name,
        companyId: company.companyId,
        forceInstallEnabled: company.forceInstallEnabled,
        pwaPageViews: company.pwaPageViews,
        pwaInstallClicks: company.pwaInstallClicks,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch company install info" });
    }
  });

  app.post('/api/install/track', async (req: any, res) => {
    try {
      const { companyId, event } = req.body; // event: 'page_view' | 'install_click'
      if (!companyId || !['page_view', 'install_click'].includes(event)) {
        return res.status(400).json({ message: "Invalid tracking data" });
      }
      const companies = await storage.getAllCompanies();
      const company = companies.find(c => c.id === companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const update: any = {};
      if (event === 'page_view') update.pwaPageViews = (company.pwaPageViews || 0) + 1;
      if (event === 'install_click') update.pwaInstallClicks = (company.pwaInstallClicks || 0) + 1;
      await storage.updateCompany(company.id, update);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to track event" });
    }
  });

  app.patch('/api/companies/:id/force-install', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user as any;
      const { id } = req.params;
      const { forceInstallEnabled } = req.body;
      if (user.role !== 'super_admin' && user.companyId !== id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updated = await storage.updateCompany(id, { forceInstallEnabled });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update force install setting" });
    }
  });

  // Company management routes
  app.get('/api/companies', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Super admins can see all companies, regular admins only see their own
      if (user.role === 'super_admin') {
        const companies = await storage.getAllCompanies();
        res.json(companies);
      } else {
        // Regular admin - return only their company
        if (!user.companyId) {
          return res.status(400).json({ message: "User not assigned to a company" });
        }
        const company = await storage.getCompany(user.companyId);
        res.json(company ? [company] : []);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Get partnered companies endpoint (for job sharing - returns only companies with accepted partnerships)
  // IMPORTANT: This route must be defined BEFORE /api/companies/:id to avoid routing conflicts
  app.get('/api/companies/for-job-sharing', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Get accepted partnerships for this company
      const partnerships = await storage.getAcceptedPartnershipsByCompany(user.companyId);
      
      // Extract the partner companies (excluding own company)
      const partnerCompanies = partnerships.map(p => {
        // If we're the fromCompany, return toCompany; otherwise return fromCompany
        return p.fromCompanyId === user.companyId ? p.toCompany : p.fromCompany;
      });
      
      res.json(partnerCompanies);
    } catch (error: any) {
      console.error("Error fetching partnered companies for job sharing:", error);
      res.status(500).json({ message: error.message || "Failed to fetch partnered companies" });
    }
  });

  // Get own company info - accessible by any authenticated user (including guards)
  // IMPORTANT: This route must be defined BEFORE /api/companies/:id to avoid routing conflicts
  app.get('/api/companies/my-company', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user.companyId) {
        return res.status(400).json({ message: "User not assigned to a company" });
      }
      
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Return full company info for admins, minimal for guards/stewards
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      if (isAdmin) {
        res.json(company);
      } else {
        res.json({
          id: company.id,
          name: company.name,
          companyId: company.companyId,
        });
      }
    } catch (error) {
      console.error("Error fetching own company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.patch('/api/companies/my-company/email', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId) {
        return res.status(400).json({ message: "User not assigned to a company" });
      }
      const { email } = req.body;
      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      const updated = await storage.updateCompany(user.companyId, { email });
      res.json({ email: updated.email });
    } catch (error: any) {
      console.error("Error updating company email:", error);
      res.status(400).json({ message: error.message || "Failed to update company email" });
    }
  });

  app.get('/api/companies/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // Super admins can access any company, regular admins only their own
      if (user.role !== 'super_admin' && user.companyId !== id) {
        return res.status(403).json({ message: "Forbidden - Can only access your own company" });
      }
      
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post('/api/companies', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error: any) {
      console.error("Error creating company:", error);
      res.status(400).json({ message: error.message || "Failed to create company" });
    }
  });

  app.patch('/api/companies/:id', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateCompanySchema.parse(req.body);
      const company = await storage.updateCompany(id, validatedData);
      res.json(company);
    } catch (error: any) {
      console.error("Error updating company:", error);
      res.status(400).json({ message: error.message || "Failed to update company" });
    }
  });

  // ── Brand colour: company admin sets their own company colour ─────────────
  app.patch('/api/admin/companies/:id/branding', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { brand_colour } = req.body as { brand_colour: string };

      if (!brand_colour || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(brand_colour)) {
        return res.status(400).json({ error: "Invalid hex colour" });
      }

      const adminUser = req.user as any;
      // Super admins can edit any company; regular admins only their own
      if (adminUser.role !== 'super_admin' && adminUser.companyId !== id) {
        return res.status(403).json({ error: "Forbidden: can only update your own company" });
      }

      const company = await storage.updateCompany(id, { brandColor: brand_colour } as any);
      res.json({ success: true, company });
    } catch (error: any) {
      console.error("Error updating brand colour:", error);
      res.status(500).json({ error: error.message || "Failed to update brand colour" });
    }
  });

  // ── AI brand colour analysis: super admin only ────────────────────────────
  app.post('/api/admin/companies/:id/branding/analyse', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    const { website_url } = req.body as { website_url: string };
    if (!website_url) return res.status(400).json({ error: "website_url is required" });

    let url: string;
    try {
      const parsed = new URL(website_url.startsWith("http") ? website_url : `https://${website_url}`);
      url = parsed.toString();
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // Fetch the website
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let html = "";
      try {
        const fetchRes = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; GuardTrack-BrandBot/1.0)", Accept: "text/html" },
        });
        if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
        html = await fetchRes.text();
      } finally {
        clearTimeout(timeout);
      }

      // Extract colours
      const hexColours = [...html.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)].map(m => m[0]);
      const rgbColours = [...html.matchAll(/rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g)].map(m => m[0]);
      const all = [...new Set([...hexColours, ...rgbColours])].filter(c => {
        if (!c.startsWith('#')) return true;
        const hex = c.replace('#', '');
        const full = hex.length === 3 ? hex.split('').map((x: string) => x+x).join('') : hex;
        const r = parseInt(full.slice(0,2), 16), g = parseInt(full.slice(2,4), 16), b = parseInt(full.slice(4,6), 16);
        return !(Math.abs(r-g)<20 && Math.abs(g-b)<20) && !(r<30&&g<30&&b<30) && !(r>225&&g>225&&b>225);
      }).slice(0, 40);

      const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
      const themeColor = themeMatch ? themeMatch[1].trim() : null;
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const ogImageUrl = ogMatch ? ogMatch[1].trim() : null;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const siteTitle = titleMatch ? titleMatch[1].trim() : null;
      const cssBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
      const rawCssSnippet = cssBlocks.join('\n').slice(0, 3000);

      // Fetch og:image for Claude Vision
      let imageContent: any = null;
      if (ogImageUrl) {
        try {
          const imgRes = await fetch(ogImageUrl, { signal: AbortSignal.timeout(8000) });
          if (imgRes.ok) {
            const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
            const mt = ct.split(";")[0].trim();
            if (["image/jpeg","image/png","image/gif","image/webp"].includes(mt)) {
              const buf = await imgRes.arrayBuffer();
              imageContent = { type: "image", source: { type: "base64", media_type: mt, data: Buffer.from(buf).toString("base64") } };
            }
          }
        } catch { /* silently skip image */ }
      }

      const userContent: any[] = [];
      if (imageContent) userContent.push(imageContent);
      userContent.push({
        type: "text",
        text: `Analyse brand colours for: ${url}\nSite: ${siteTitle ?? "Unknown"}\n${themeColor ? `Theme-color: ${themeColor}\n` : ""}Colours from CSS: ${all.length > 0 ? all.join(", ") : "None"}\nCSS snippet:\n${rawCssSnippet || "N/A"}\n${imageContent ? "og:image included above." : ""}\n\nReturn ONLY valid JSON — no markdown.`,
      });

      const claudeRes = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1000,
        system: `You are a brand colour analyst for GuardTrack (B2B security SaaS). Recommend a single primary brand colour for use as a UI theme in a dark-sidebar enterprise dashboard. It must: be clearly the primary brand colour, work on white and dark backgrounds, have HSL lightness < 70%, not be grey/black/white, feel professional for security industry. Respond ONLY with valid JSON:\n{"recommended":{"hex":"#xxxxxx","name":"...","reason":"..."},"palette":[{"hex":"#xxxxxx","name":"...","usage":"..."}],"brandNotes":"..."}`,
        messages: [{ role: "user", content: userContent }],
      });

      const rawText = claudeRes.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      const clean = rawText.replace(/```json|```/g, "").trim();
      const result = JSON.parse(clean);

      return res.json({ success: true, url, siteTitle, ...result });
    } catch (err: any) {
      console.error("[branding/analyse]", err);
      if (err.name === "AbortError") return res.status(408).json({ error: "Website took too long to respond. Try entering a colour manually." });
      if (err instanceof SyntaxError) return res.status(500).json({ error: "AI response could not be parsed. Please try again." });
      return res.status(500).json({ error: err.message ?? "Analysis failed" });
    }
  });

  app.delete('/api/companies/:id', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompany(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting company:", error);
      res.status(400).json({ message: error.message || "Failed to delete company" });
    }
  });

  // Merge two companies: moves all data from sourceId into targetId, then deletes sourceId
  app.post('/api/companies/:sourceId/merge-into/:targetId', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    const { sourceId, targetId } = req.params;
    if (sourceId === targetId) {
      return res.status(400).json({ message: "Cannot merge a company into itself" });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. users
      await client.query(`UPDATE users SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 2. user_logins
      await client.query(`UPDATE user_logins SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 3. sites
      await client.query(`UPDATE sites SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 4. invitations
      await client.query(`UPDATE invitations SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 5. support_messages
      await client.query(`UPDATE support_messages SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 6. company_memberships — unique on (user_id, company_id), so delete conflicts first
      await client.query(`
        DELETE FROM company_memberships
        WHERE company_id = $1
          AND user_id IN (SELECT user_id FROM company_memberships WHERE company_id = $2)
      `, [sourceId, targetId]);
      await client.query(`UPDATE company_memberships SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 7. subscription_payments
      await client.query(`UPDATE subscription_payments SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 8. invoices
      await client.query(`UPDATE invoices SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 9. staff_invoices
      await client.query(`UPDATE staff_invoices SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 10. error_logs
      await client.query(`UPDATE error_logs SET company_id = $1 WHERE company_id = $2`, [targetId, sourceId]);

      // 11. company_settings — unique on company_id; delete source's settings (target's are kept)
      await client.query(`DELETE FROM company_settings WHERE company_id = $1`, [sourceId]);

      // 12. company_partnerships
      await client.query(`UPDATE company_partnerships SET from_company_id = $1 WHERE from_company_id = $2`, [targetId, sourceId]);
      await client.query(`UPDATE company_partnerships SET to_company_id = $1 WHERE to_company_id = $2`, [targetId, sourceId]);

      // 13. job_shares
      await client.query(`UPDATE job_shares SET from_company_id = $1 WHERE from_company_id = $2`, [targetId, sourceId]);
      await client.query(`UPDATE job_shares SET to_company_id = $1 WHERE to_company_id = $2`, [targetId, sourceId]);

      // 14. job_share_messages
      await client.query(`UPDATE job_share_messages SET sender_company_id = $1 WHERE sender_company_id = $2`, [targetId, sourceId]);

      // 15. Delete the source company (all remaining cascade-delete children will clean up)
      await client.query(`DELETE FROM companies WHERE id = $1`, [sourceId]);

      await client.query('COMMIT');

      const targetCompany = await storage.getCompany(targetId);
      console.log(`[Merge] Company ${sourceId} merged into ${targetId} (${targetCompany?.name})`);
      res.json({ success: true, message: `Companies merged successfully`, targetCompany });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error("Error merging companies:", error);
      res.status(500).json({ message: error.message || "Failed to merge companies" });
    } finally {
      client.release();
    }
  });

  // Subscription Plan Routes (Super Admin only)
  app.get('/api/subscription-plans', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error: any) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscription plans" });
    }
  });

  app.get('/api/subscription-plans/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const plan = await storage.getSubscriptionPlan(id);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }
      res.json(plan);
    } catch (error: any) {
      console.error("Error fetching subscription plan:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscription plan" });
    }
  });

  app.post('/api/subscription-plans', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const { insertSubscriptionPlanSchema } = await import("@shared/schema");
      const validatedData = insertSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan(validatedData);
      res.status(201).json(plan);
    } catch (error: any) {
      console.error("Error creating subscription plan:", error);
      res.status(400).json({ message: error.message || "Failed to create subscription plan" });
    }
  });

  app.patch('/api/subscription-plans/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { updateSubscriptionPlanSchema } = await import("@shared/schema");
      const validatedData = updateSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.updateSubscriptionPlan(id, validatedData);
      res.json(plan);
    } catch (error: any) {
      console.error("Error updating subscription plan:", error);
      res.status(400).json({ message: error.message || "Failed to update subscription plan" });
    }
  });

  app.delete('/api/subscription-plans/:id', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSubscriptionPlan(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting subscription plan:", error);
      res.status(400).json({ message: error.message || "Failed to delete subscription plan" });
    }
  });

  // Assign plan to company
  app.post('/api/companies/:id/assign-plan', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { z } = await import("zod");
      const { id } = req.params;
      
      const assignPlanSchema = z.object({
        planId: z.string().nullable(),
        subscriptionStatus: z.enum(['trial', 'active', 'expired', 'suspended']).optional(),
        billingStartDate: z.string().optional(),
      });
      
      const validatedData = assignPlanSchema.parse(req.body);
      
      // Validate plan exists if planId is provided
      if (validatedData.planId) {
        const plan = await storage.getSubscriptionPlan(validatedData.planId);
        if (!plan) {
          return res.status(400).json({ message: "Subscription plan not found" });
        }
      }
      
      const company = await storage.updateCompany(id, {
        planId: validatedData.planId,
        subscriptionStatus: validatedData.subscriptionStatus || 'active',
        billingStartDate: validatedData.billingStartDate ? new Date(validatedData.billingStartDate) : new Date(),
      });
      
      res.json(company);
    } catch (error: any) {
      console.error("Error assigning plan to company:", error);
      res.status(400).json({ message: error.message || "Failed to assign plan" });
    }
  });

  // Feature access check endpoint
  app.get('/api/feature-access', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      // Super admin has access to all features
      if (user.role === 'super_admin') {
        return res.json({
          hasFullAccess: true,
          features: {
            userManagement: true,
            dashboardAccess: true,
            reportsViewing: true,
            checkInOut: true,
            shiftScheduling: true,
            siteManagement: true,
            breakTracking: true,
            overtimeManagement: true,
            leaveRequests: true,
            noticeBoard: true,
            pushNotifications: true,
          },
          limits: { maxSites: null, maxUsers: null },
          planName: 'Super Admin',
          isBlocked: false,
        });
      }
      
      if (!user.companyId) {
        return res.status(400).json({ message: "No company associated with user" });
      }
      
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Check if blocked
      if (company.isBlocked) {
        return res.json({
          hasFullAccess: false,
          isBlocked: true,
          blockReason: company.blockReason,
          features: {},
          limits: { maxSites: 0, maxUsers: 0 },
          planName: null,
        });
      }
      
      // No plan assigned - return full access (beta / no restrictions)
      if (!company.planId) {
        return res.json({
          hasFullAccess: false,
          features: {
            userManagement: true,
            dashboardAccess: true,
            reportsViewing: true,
            checkInOut: true,
            shiftScheduling: true,
            siteManagement: true,
            breakTracking: true,
            overtimeManagement: true,
            leaveRequests: true,
            noticeBoard: true,
            pushNotifications: true,
          },
          limits: { maxSites: null, maxUsers: null },
          planName: null,
          isBlocked: false,
        });
      }
      
      const plan = await storage.getSubscriptionPlan(company.planId);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }
      
      res.json({
        hasFullAccess: false,
        features: plan.features,
        limits: plan.limits,
        planName: plan.name,
        planId: plan.id,
        isBlocked: false,
        isPlanActive: plan.isActive,
      });
    } catch (error: any) {
      console.error("Error checking feature access:", error);
      res.status(500).json({ message: error.message || "Failed to check feature access" });
    }
  });

  // Guard App Tab Configuration Routes (platform-wide, super_admin only for write operations)
  app.get('/api/guard-app-tabs', isAuthenticated, async (req: any, res) => {
    try {
      // Initialize default tabs if none exist, then return tabs (platform-wide)
      const tabs = await storage.initializeDefaultTabs();
      res.json(tabs);
    } catch (error: any) {
      console.error("Error fetching guard app tabs:", error);
      res.status(500).json({ message: error.message || "Failed to fetch guard app tabs" });
    }
  });

  app.get('/api/guard-app-tabs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tab = await storage.getGuardAppTab(id);
      if (!tab) {
        return res.status(404).json({ message: "Tab not found" });
      }
      
      res.json(tab);
    } catch (error: any) {
      console.error("Error fetching guard app tab:", error);
      res.status(500).json({ message: error.message || "Failed to fetch guard app tab" });
    }
  });

  app.post('/api/guard-app-tabs', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { z } = await import("zod");
      const createTabSchema = z.object({
        tabKey: z.string().min(1),
        label: z.string().min(1),
        icon: z.string().min(1),
        sortOrder: z.string(),
        isActive: z.boolean().default(true),
        isDefault: z.boolean().default(false),
        featureGate: z.string().nullable().optional(),
        roleVisibility: z.array(z.string()).default(['guard', 'steward', 'supervisor']),
      });

      const validatedData = createTabSchema.parse(req.body);
      const tab = await storage.createGuardAppTab(validatedData);
      
      res.status(201).json(tab);
    } catch (error: any) {
      console.error("Error creating guard app tab:", error);
      res.status(400).json({ message: error.message || "Failed to create guard app tab" });
    }
  });

  app.patch('/api/guard-app-tabs/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tab = await storage.getGuardAppTab(id);
      
      if (!tab) {
        return res.status(404).json({ message: "Tab not found" });
      }

      const { z } = await import("zod");
      const updateTabSchema = z.object({
        tabKey: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        icon: z.string().min(1).optional(),
        sortOrder: z.string().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        featureGate: z.string().nullable().optional(),
        roleVisibility: z.array(z.string()).optional(),
      });

      const validatedData = updateTabSchema.parse(req.body);
      const updatedTab = await storage.updateGuardAppTab(id, validatedData);
      
      res.json(updatedTab);
    } catch (error: any) {
      console.error("Error updating guard app tab:", error);
      res.status(400).json({ message: error.message || "Failed to update guard app tab" });
    }
  });

  app.delete('/api/guard-app-tabs/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tab = await storage.getGuardAppTab(id);
      
      if (!tab) {
        return res.status(404).json({ message: "Tab not found" });
      }
      
      // Prevent deleting the default home tab
      if (tab.tabKey === 'home' && tab.isDefault) {
        return res.status(400).json({ message: "Cannot delete the default home tab" });
      }
      
      await storage.deleteGuardAppTab(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting guard app tab:", error);
      res.status(400).json({ message: error.message || "Failed to delete guard app tab" });
    }
  });

  // Bulk update tab order (super_admin only)
  app.patch('/api/guard-app-tabs/reorder', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { z } = await import("zod");
      const reorderSchema = z.object({
        tabs: z.array(z.object({
          id: z.string(),
          sortOrder: z.string(),
        })),
      });

      const { tabs } = reorderSchema.parse(req.body);
      
      // Update each tab's sort order
      const updatedTabs = await Promise.all(
        tabs.map(({ id, sortOrder }) => storage.updateGuardAppTab(id, { sortOrder }))
      );
      
      res.json(updatedTabs);
    } catch (error: any) {
      console.error("Error reordering guard app tabs:", error);
      res.status(400).json({ message: error.message || "Failed to reorder guard app tabs" });
    }
  });

  // ==================== Staff Invoice Routes ====================

  // Get invoicable shifts for the current guard
  app.get('/api/staff-invoices/invoicable-shifts', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId) return res.json([]);
      const shifts = await storage.getInvoicableShifts(user.id, user.companyId);
      res.json(shifts);
    } catch (error: any) {
      console.error("Error fetching invoicable shifts:", error);
      res.status(500).json({ message: error.message || "Failed to fetch invoicable shifts" });
    }
  });

  // Create a staff invoice from selected shifts
  app.post('/api/staff-invoices', isAuthenticated, async (req: any, res) => {
    try {
      const { z } = await import("zod");
      const createInvoiceSchema = z.object({
        shiftIds: z.array(z.string()).min(1, "Must select at least one shift"),
      });

      const user = req.user;
      if (!user.companyId) return res.status(400).json({ message: "No company assigned" });

      const parsed = createInvoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
      }
      const { shiftIds } = parsed.data;

      const invoicableShifts = await storage.getInvoicableShifts(user.id, user.companyId);
      const invoicableMap = new Map(invoicableShifts.map(s => [s.shiftId, s]));

      const selectedShifts = [];
      for (const shiftId of shiftIds) {
        const shift = invoicableMap.get(shiftId);
        if (!shift) {
          return res.status(400).json({ message: `Shift ${shiftId} is not invoicable or does not belong to you` });
        }
        selectedShifts.push(shift);
      }

      const totalAmount = selectedShifts.reduce((sum, s) => sum + parseFloat(s.amount), 0).toFixed(2);
      const invoiceNumber = await storage.generateInvoiceNumber(user.companyId);

      const invoice = await storage.createStaffInvoice({
        companyId: user.companyId,
        guardUserId: user.id,
        invoiceNumber,
        totalAmount,
        status: 'submitted',
      });

      const invoiceShiftRecords = selectedShifts.map(s => ({
        invoiceId: invoice.id,
        shiftId: s.shiftId,
        checkInId: s.checkInId,
        amount: s.amount,
        hours: String(s.hours),
        rate: s.rate,
      }));

      await storage.createInvoiceShifts(invoiceShiftRecords);
      await storage.updateShiftBillingStatus(shiftIds, 'invoiced');

      const fullInvoice = await storage.getStaffInvoiceById(invoice.id);
      res.status(201).json(fullInvoice);
    } catch (error: any) {
      console.error("Error creating staff invoice:", error);
      res.status(500).json({ message: error.message || "Failed to create invoice" });
    }
  });

  // Get staff invoices (guards see own, admins see company)
  app.get('/api/staff-invoices', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId && user.role !== 'super_admin') return res.json([]);

      const filters: { guardUserId?: string; status?: string } = {};
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        filters.guardUserId = user.id;
      }
      if (req.query.status) filters.status = req.query.status as string;

      const companyId = user.role === 'super_admin' && req.query.companyId
        ? req.query.companyId as string
        : user.companyId;
      if (!companyId) return res.json([]);
      const invoices = await storage.getStaffInvoices(companyId, filters);
      res.json(invoices);
    } catch (error: any) {
      console.error("Error fetching staff invoices:", error);
      res.status(500).json({ message: error.message || "Failed to fetch staff invoices" });
    }
  });

  // Get a single staff invoice by ID
  app.get('/api/staff-invoices/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const invoice = await storage.getStaffInvoiceById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      if (user.role !== 'super_admin' && invoice.companyId !== user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (user.role !== 'admin' && user.role !== 'super_admin' && invoice.guardUserId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(invoice);
    } catch (error: any) {
      console.error("Error fetching staff invoice:", error);
      res.status(500).json({ message: error.message || "Failed to fetch invoice" });
    }
  });

  // Admin approve invoice
  app.patch('/api/staff-invoices/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const invoice = await storage.getStaffInvoiceById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (user.role !== 'super_admin' && invoice.companyId !== user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (invoice.status !== 'submitted') {
        return res.status(400).json({ message: `Cannot approve invoice with status '${invoice.status}'` });
      }

      const updated = await storage.updateStaffInvoice(invoice.id, {
        status: 'approved',
        approvedBy: user.id,
        approvedAt: new Date(),
        rejectionReason: null,
      });
      const full = await storage.getStaffInvoiceById(updated.id);
      res.json(full);
    } catch (error: any) {
      console.error("Error approving staff invoice:", error);
      res.status(500).json({ message: error.message || "Failed to approve invoice" });
    }
  });

  // Admin reject invoice
  app.patch('/api/staff-invoices/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const invoice = await storage.getStaffInvoiceById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (user.role !== 'super_admin' && invoice.companyId !== user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (invoice.status === 'paid') {
        return res.status(400).json({ message: "Cannot reject a paid invoice" });
      }

      const { z } = await import("zod");
      const rejectSchema = z.object({ reason: z.string().min(1, "Rejection reason is required") });
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Rejection reason is required" });
      }
      const { reason } = parsed.data;
      const shiftIds = invoice.shifts?.map((s: any) => s.shiftId) || [];

      const updated = await storage.updateStaffInvoice(invoice.id, {
        status: 'rejected',
        rejectionReason: reason,
      });
      await storage.updateShiftBillingStatus(shiftIds, 'not_invoiced');

      const full = await storage.getStaffInvoiceById(updated.id);
      res.json(full);
    } catch (error: any) {
      console.error("Error rejecting staff invoice:", error);
      res.status(500).json({ message: error.message || "Failed to reject invoice" });
    }
  });

  app.post('/api/staff-invoices/:id/pay', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const invoice = await storage.getStaffInvoiceById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (user.role !== 'super_admin' && invoice.companyId !== user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (invoice.status !== 'approved') {
        return res.status(400).json({ message: `Cannot pay invoice with status '${invoice.status}'. Must be approved first.` });
      }

      const shiftIds = invoice.shifts?.map((s: any) => s.shiftId) || [];

      const { isStripeConfigured, createPaymentIntent } = await import('./stripe');
      if (isStripeConfigured()) {
        const company = await storage.getCompany(invoice.companyId);
        const guard = await storage.getUser(invoice.guardUserId);
        const companyStripeId = (company as any)?.stripeAccountId;
        const guardStripeId = (guard as any)?.stripeConnectedAccountId;

        if (!companyStripeId) {
          return res.status(400).json({ message: "Company has not connected a Stripe account. Please set up Stripe Connect in billing settings." });
        }
        if (!guardStripeId) {
          return res.status(400).json({ message: "Guard has not connected a Stripe payout account. They must set up Stripe Connect in their settings." });
        }

        const paymentIntent = await createPaymentIntent(
          parseFloat(invoice.totalAmount),
          companyStripeId,
          guardStripeId,
          invoice.id
        );

        const updated = await storage.updateStaffInvoice(invoice.id, {
          status: 'paid',
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntent.id,
        });
        await storage.updateShiftBillingStatus(shiftIds, 'paid');
        const full = await storage.getStaffInvoiceById(updated.id);
        return res.json(full);
      }

      const updated = await storage.updateStaffInvoice(invoice.id, {
        status: 'paid',
        paidAt: new Date(),
      });
      await storage.updateShiftBillingStatus(shiftIds, 'paid');

      const full = await storage.getStaffInvoiceById(updated.id);
      res.json(full);
    } catch (error: any) {
      console.error("Error paying staff invoice:", error);
      res.status(500).json({ message: error.message || "Failed to pay invoice" });
    }
  });

  // ==================== Stripe Connect Routes ====================

  app.get('/api/stripe/configured', isAuthenticated, async (_req: any, res) => {
    const { isStripeConfigured } = await import('./stripe');
    res.json({ configured: isStripeConfigured() });
  });

  app.get('/api/stripe/connect/company/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId) return res.json({ connected: false });
      const company = await storage.getCompany(user.companyId);
      res.json({
        connected: !!(company as any)?.stripeAccountId,
        accountId: (company as any)?.stripeAccountId || null,
      });
    } catch (error: any) {
      res.json({ connected: false });
    }
  });

  app.get('/api/stripe/connect/guard/status', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      res.json({
        connected: !!(user as any)?.stripeConnectedAccountId,
        accountId: (user as any)?.stripeConnectedAccountId || null,
      });
    } catch (error: any) {
      res.json({ connected: false });
    }
  });

  app.post('/api/stripe/connect/company/onboard', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { isStripeConfigured, createConnectedAccount, createConnectAccountLink } = await import('./stripe');
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Stripe is not configured on this platform yet. Please contact your platform administrator." });
      }
      const user = req.user;
      if (!user.companyId) return res.status(400).json({ message: "No company assigned" });

      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      let accountId = (company as any).stripeAccountId;
      if (!accountId) {
        const account = await createConnectedAccount(company.email || user.email || '');
        accountId = account.id;
        await storage.updateCompany(user.companyId, { stripeAccountId: accountId } as any);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const link = await createConnectAccountLink(
        accountId,
        `${baseUrl}/admin?tab=billing&stripe=connected`,
        `${baseUrl}/api/stripe/connect/company/refresh`
      );

      res.json({ url: link.url });
    } catch (error: any) {
      console.error("Error creating company Stripe onboarding:", error);
      res.status(500).json({ message: error.message || "Failed to start Stripe onboarding" });
    }
  });

  app.get('/api/stripe/connect/company/refresh', isAuthenticated, async (req: any, res) => {
    res.redirect('/admin?tab=billing&stripe=refresh');
  });

  app.post('/api/stripe/connect/guard/onboard', isAuthenticated, async (req: any, res) => {
    try {
      const { isStripeConfigured, createConnectedAccount, createConnectAccountLink } = await import('./stripe');
      if (!isStripeConfigured()) {
        return res.status(503).json({ message: "Stripe is not configured on this platform yet." });
      }
      const user = req.user;

      let accountId = (user as any).stripeConnectedAccountId;
      if (!accountId) {
        const account = await createConnectedAccount(user.email || '');
        accountId = account.id;
        await storage.updateUser(user.id, { stripeConnectedAccountId: accountId } as any);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const link = await createConnectAccountLink(
        accountId,
        `${baseUrl}/guard/app?tab=settings&stripe=connected`,
        `${baseUrl}/api/stripe/connect/guard/refresh`
      );

      res.json({ url: link.url });
    } catch (error: any) {
      console.error("Error creating guard Stripe onboarding:", error);
      res.status(500).json({ message: error.message || "Failed to start Stripe onboarding" });
    }
  });

  app.get('/api/stripe/connect/guard/refresh', isAuthenticated, async (req: any, res) => {
    res.redirect('/guard/app?tab=settings&stripe=refresh');
  });

  // ==================== End Staff Invoice & Stripe Routes ====================

  // ==================== Xero Integration Routes ====================

  app.get('/api/xero/configured', isAuthenticated, async (_req: any, res) => {
    const { isXeroConfigured } = await import('./xero');
    res.json({ configured: isXeroConfigured() });
  });

  app.get('/api/xero/status', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId) return res.json({ connected: false });
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.json({ connected: false });
      const c = company as any;
      res.json({
        connected: !!(c.xeroTenantId && c.xeroRefreshToken),
        tenantName: c.xeroTenantName || null,
        connectedAt: c.xeroConnectedAt || null,
      });
    } catch (error: any) {
      res.json({ connected: false });
    }
  });

  app.post('/api/xero/connect', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { isXeroConfigured, buildConsentUrl } = await import('./xero');
      if (!isXeroConfigured()) {
        return res.status(503).json({ message: "Xero integration is not configured on this platform. Please contact your platform administrator." });
      }
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const url = await buildConsentUrl(baseUrl);
      res.json({ url });
    } catch (error: any) {
      console.error("Error building Xero consent URL:", error);
      res.status(500).json({ message: error.message || "Failed to start Xero connection" });
    }
  });

  app.get('/api/xero/callback', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { handleCallback } = await import('./xero');
      const user = req.user;
      if (!user.companyId) {
        return res.redirect('/admin?tab=billing&xero=error&reason=no_company');
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const callbackUrl = `${baseUrl}${req.originalUrl}`;

      const result = await handleCallback(baseUrl, callbackUrl);

      await storage.updateCompany(user.companyId, {
        xeroAccessToken: result.accessToken,
        xeroRefreshToken: result.refreshToken,
        xeroExpiresAt: result.expiresAt,
        xeroTenantId: result.tenantId,
        xeroTenantName: result.tenantName,
        xeroConnectedAt: new Date(),
      } as any);

      res.redirect('/admin?tab=billing&xero=connected');
    } catch (error: any) {
      console.error("Error handling Xero callback:", error);
      res.redirect('/admin?tab=billing&xero=error');
    }
  });

  app.post('/api/xero/disconnect', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId) return res.status(400).json({ message: "No company assigned" });

      await storage.updateCompany(user.companyId, {
        xeroAccessToken: null,
        xeroRefreshToken: null,
        xeroExpiresAt: null,
        xeroTenantId: null,
        xeroTenantName: null,
        xeroConnectedAt: null,
      } as any);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error disconnecting Xero:", error);
      res.status(500).json({ message: error.message || "Failed to disconnect Xero" });
    }
  });

  app.post('/api/xero/sync-invoice/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId) return res.status(400).json({ message: "No company assigned" });

      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const c = company as any;

      if (!c.xeroTenantId || !c.xeroRefreshToken) {
        return res.status(400).json({ message: "Xero is not connected. Please connect your Xero account first." });
      }

      const invoice = await storage.getStaffInvoiceById(req.params.id);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });
      if (invoice.companyId !== user.companyId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (invoice.status !== 'approved' && invoice.status !== 'paid') {
        return res.status(400).json({ message: "Only approved or paid invoices can be synced to Xero." });
      }
      if ((invoice as any).xeroInvoiceId) {
        return res.status(400).json({ message: "This invoice has already been synced to Xero." });
      }
      if ((invoice as any).xeroSyncStatus === 'error') {
        await storage.updateStaffInvoice(invoice.id, {
          xeroSyncStatus: 'not_synced',
          xeroSyncError: null,
        } as any);
      }

      const guard = await storage.getUser(invoice.guardUserId);
      const guardName = guard ? `${guard.firstName || ''} ${guard.lastName || ''}`.trim() || guard.username : 'Unknown Guard';

      const shifts = invoice.shifts || [];
      const lineItems = shifts.map((s: any) => ({
        description: `${s.site?.name || 'Shift'} - ${s.shift ? new Date(s.shift.startTime).toLocaleDateString() : 'Unknown date'} (${s.hours}h @ £${s.rate}/h)`,
        quantity: parseFloat(s.hours),
        unitAmount: parseFloat(s.rate),
        accountCode: '200',
      }));

      if (lineItems.length === 0) {
        return res.status(400).json({ message: "Invoice has no shift data to sync." });
      }

      const invoiceDate = invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { createBillInXero } = await import('./xero');
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const result = await createBillInXero(
        baseUrl,
        c.xeroAccessToken,
        c.xeroRefreshToken,
        new Date(c.xeroExpiresAt),
        c.xeroTenantId,
        guardName,
        invoice.invoiceNumber,
        lineItems,
        invoiceDate,
        dueDate
      );

      if (result.newTokens) {
        await storage.updateCompany(user.companyId, {
          xeroAccessToken: result.newTokens.accessToken,
          xeroRefreshToken: result.newTokens.refreshToken,
          xeroExpiresAt: result.newTokens.expiresAt,
        } as any);
      }

      await storage.updateStaffInvoice(invoice.id, {
        xeroInvoiceId: result.xeroInvoiceId,
        xeroSyncStatus: 'synced',
        xeroSyncedAt: new Date(),
        xeroSyncError: null,
      } as any);

      const full = await storage.getStaffInvoiceById(invoice.id);
      res.json(full);
    } catch (error: any) {
      console.error("Error syncing invoice to Xero:", error);
      try {
        await storage.updateStaffInvoice(req.params.id, {
          xeroSyncStatus: 'error',
          xeroSyncError: error.message || 'Unknown error',
        } as any);
      } catch (updateErr) {
        console.error("Failed to save sync error:", updateErr);
      }
      res.status(500).json({ message: error.message || "Failed to sync invoice to Xero" });
    }
  });

  // ==================== End Xero Routes ====================

  // User management routes (admin only)
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let users = await storage.getAllUsers();
      
      // Regular admins only see users from their company
      if (user.role !== 'super_admin' && user.companyId) {
        users = users.filter(u => u.companyId === user.companyId);
      }
      
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Note: Users are auto-created on first login via Replit Auth
  // This endpoint is not needed for user creation - removed to prevent ID mismatch issues

  app.patch('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };
      
      // Security: Only super admins can update passwords
      // Check for password key existence (not just truthy value) to prevent empty/null attacks
      if ('password' in updateData) {
        if (req.user.role !== 'super_admin') {
          // Regular admins cannot update password - strip the field
          delete updateData.password;
        } else {
          // Super admin: validate and hash password
          if (!updateData.password || typeof updateData.password !== 'string' || updateData.password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
          }
          updateData.password = await hashPassword(updateData.password);
        }
      }
      
      const user = await storage.updateUser(id, updateData);
      res.json(user);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(400).json({ message: error.message || "Failed to update user" });
    }
  });

  // Reset user password (Super Admin only)
  app.patch('/api/admin/users/:id/reset-password', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user's password
      await storage.updateUser(id, { password: hashedPassword });
      
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Error resetting user password:", error);
      res.status(400).json({ message: error.message || "Failed to reset password" });
    }
  });

  app.post('/api/user/change-password', isAuthenticated, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const isValid = await comparePasswords(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(req.user.id, { password: hashedPassword });
      res.json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.patch('/api/admin/users/:userId/suspend-membership', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const adminUser = req.user;
      
      // Admin can only suspend memberships for their own company
      if (!adminUser.companyId) {
        return res.status(403).json({ message: "Admin must be associated with a company" });
      }

      const membership = await storage.getMembership(userId, adminUser.companyId);
      if (!membership) {
        return res.status(404).json({ message: "Membership not found for this user in your company" });
      }

      await storage.updateMembershipStatus(userId, adminUser.companyId, 'suspended');
      
      // Check if user has any other active memberships
      const activeMemberships = await storage.getActiveMemberships(userId);
      if (activeMemberships.length === 0) {
        // If no more active memberships, also set isActivated = false
        await storage.updateUser(userId, { isActivated: false });
      }

      res.json({ message: "Membership suspended successfully" });
    } catch (error: any) {
      console.error("Error suspending membership:", error);
      res.status(500).json({ message: error.message || "Failed to suspend membership" });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminUser = req.user;

      if (!adminUser.companyId) {
        return res.status(403).json({ message: "Admin must be associated with a company" });
      }

      // Soft delete: suspends membership rather than deleting global user account
      await storage.updateMembershipStatus(id, adminUser.companyId, 'suspended');
      
      // Check if user has any other active memberships
      const activeMemberships = await storage.getActiveMemberships(id);
      if (activeMemberships.length === 0) {
        // If no more active memberships, also set isActivated = false
        await storage.updateUser(id, { isActivated: false });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting user (suspending membership):", error);
      res.status(400).json({ message: error.message || "Failed to delete user" });
    }
  });

  // User Roles routes (multi-role support)
  app.get('/api/admin/users/:id/roles', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const roles = await storage.getUserRoles(id);
      res.json({ userId: id, roles });
    } catch (error: any) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: error.message || "Failed to fetch user roles" });
    }
  });

  app.put('/api/admin/users/:id/roles', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { roles } = req.body;
      const adminUser = req.user;
      
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ message: "User must have at least one role" });
      }
      
      // Validate all roles
      const validRoles = ['guard', 'steward', 'supervisor', 'admin', 'super_admin'];
      const invalidRoles = roles.filter((r: string) => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        return res.status(400).json({ message: `Invalid roles: ${invalidRoles.join(', ')}` });
      }
      
      // Non-super admins cannot assign super_admin role
      if (adminUser.role !== 'super_admin' && roles.includes('super_admin')) {
        return res.status(403).json({ message: "Only super admins can assign super_admin role" });
      }
      
      await storage.setUserRoles(id, roles, adminUser.id);
      
      // Also migrate to roles table if not already done
      await storage.migrateUserToRoles(id);
      
      const updatedRoles = await storage.getUserRoles(id);
      res.json({ userId: id, roles: updatedRoles });
    } catch (error: any) {
      console.error("Error updating user roles:", error);
      res.status(400).json({ message: error.message || "Failed to update user roles" });
    }
  });

  // Get current user's roles
  app.get('/api/user/roles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const roles = await storage.getUserRoles(userId);
      res.json({ userId, roles });
    } catch (error: any) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: error.message || "Failed to fetch user roles" });
    }
  });

  // Sites routes
  app.get('/api/sites', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      let sites = await storage.getAllSites();
      
      // Filter sites by company (all users including guards only see their company's sites)
      if (user.companyId) {
        sites = sites.filter(s => s.companyId === user.companyId);
      }
      
      res.json(sites);
    } catch (error) {
      console.error("Error fetching sites:", error);
      res.status(500).json({ message: "Failed to fetch sites" });
    }
  });

  app.post('/api/sites', isAuthenticated, isAdmin, requireActiveTrial, requireFeature('siteManagement'), async (req: any, res) => {
    try {
      const user = req.user;
      
      // For non-super-admin users, inject companyId before validation
      const dataToValidate = { ...req.body };
      if (user.role !== 'super_admin') {
        if (!user.companyId) {
          return res.status(400).json({ message: "User not assigned to a company" });
        }
        dataToValidate.companyId = user.companyId;
      } else if (!dataToValidate.companyId) {
        // Super admin must specify companyId
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      const validatedData = insertSiteSchema.parse(dataToValidate);
      const site = await storage.createSite(validatedData);
      res.status(201).json(site);
    } catch (error: any) {
      console.error("Error creating site:", error);
      res.status(400).json({ message: error.message || "Failed to create site" });
    }
  });

  app.patch('/api/sites/:id', isAuthenticated, isAdmin, requireActiveTrial, requireFeature('siteManagement'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // For regular admins, validate site belongs to their company
      if (user.role !== 'super_admin') {
        const site = await storage.getSite(id);
        if (!site) {
          return res.status(404).json({ message: "Site not found" });
        }
        if (site.companyId !== user.companyId) {
          return res.status(403).json({ message: "Cannot update sites from other companies" });
        }
      }
      
      // Validate using partial update schema (strip unknown fields)
      const validatedData = updateSiteSchema.parse(req.body);
      const updatedSite = await storage.updateSite(id, validatedData);
      res.json(updatedSite);
    } catch (error: any) {
      console.error("Error updating site:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(400).json({ message: error.message || "Failed to update site" });
    }
  });

  app.delete('/api/sites/:id', isAuthenticated, isAdmin, requireActiveTrial, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // For regular admins, validate site belongs to their company
      if (user.role !== 'super_admin') {
        const site = await storage.getSite(id);
        if (!site) {
          return res.status(404).json({ message: "Site not found" });
        }
        if (site.companyId !== user.companyId) {
          return res.status(403).json({ message: "Cannot delete sites from other companies" });
        }
      }
      
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

  // Get user's monthly hours worked
  app.get('/api/user/monthly-hours', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const now = new Date();
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const month = parseInt(req.query.month as string) || (now.getMonth() + 1);
      
      const hours = await storage.getUserMonthlyHours(userId, year, month);
      res.json({ hours, year, month });
    } catch (error) {
      console.error("Error fetching monthly hours:", error);
      res.status(500).json({ message: "Failed to fetch monthly hours" });
    }
  });

  // Get user's leave balance
  app.get('/api/user/leave-balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const now = new Date();
      const year = parseInt(req.query.year as string) || now.getFullYear();
      
      const balance = await storage.getUserLeaveBalance(userId, year);
      res.json({ ...balance, year });
    } catch (error) {
      console.error("Error fetching leave balance:", error);
      res.status(500).json({ message: "Failed to fetch leave balance" });
    }
  });

  app.post('/api/check-ins', isAuthenticated, requireActiveTrial, async (req: any, res) => {
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
      const { overtimeReason, latitude, longitude } = req.body;

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

      const checkIn = await storage.checkOut(id, { latitude, longitude });
      
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

  app.post('/api/breaks/start', isAuthenticated, requireFeature('breakTracking'), async (req: any, res) => {
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

  app.patch('/api/breaks/:id/end', isAuthenticated, requireFeature('breakTracking'), async (req: any, res) => {
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
  app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const activeCheckIns = await storage.getAllActiveCheckIns();
      const allSites = await storage.getAllSites();
      const allUsers = await storage.getAllUsers();
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday

      // Filter by company for regular admins
      let filteredCheckIns = activeCheckIns;
      let filteredSites = allSites;
      let filteredGuards = allUsers;
      let filteredWeeklyHours = 0;
      
      if (user.role !== 'super_admin' && user.companyId) {
        filteredCheckIns = activeCheckIns.filter(ci => ci.user.companyId === user.companyId);
        filteredSites = allSites.filter(s => s.companyId === user.companyId);
        filteredGuards = allUsers.filter(g => g.companyId === user.companyId);
        
        // Calculate weekly hours for company users only
        for (const guard of filteredGuards) {
          filteredWeeklyHours += await storage.getUserWeeklyHours(guard.id, weekStart);
        }
      } else {
        // For super_admin, get all weekly hours
        filteredWeeklyHours = await storage.getAllUsersWeeklyHours(weekStart);
      }

      const stats = {
        activeGuards: filteredCheckIns.length,
        totalSites: filteredSites.filter(s => s.isActive).length,
        totalGuards: filteredGuards.length,
        weeklyHours: filteredWeeklyHours,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Licence Alerts — SIA guards/supervisors only, never stewards/admins
  app.get('/api/admin/licence-alerts', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      if (user.role === 'super_admin' && !user.companyId) {
        return res.json({ expired: [], expiring60: [], expiring90: [], valid: [], stats: { expired: 0, expiring60: 0, expiring90: 0, valid: 0, totalSiaEmployees: 0, totalEmployees: 0, activeSites: 0 } });
      }
      const companyId = user.companyId;
      const allUsers = await storage.getAllUsers();
      const allSites = await storage.getAllSites();

      // Only SIA-liable roles — exclude steward, admin, super_admin
      const siaRoles = ['guard', 'supervisor'];
      const companyUsers = allUsers.filter(u => u.companyId === companyId && siaRoles.includes(u.role));
      const totalEmployees = allUsers.filter(u => u.companyId === companyId).length;
      const activeSites = allSites.filter(s => s.companyId === companyId && s.isActive).length;

      const now = new Date();
      const d60 = new Date(now); d60.setDate(d60.getDate() + 60);

      const expired: any[] = [];
      const expiring: any[] = [];   // 0–59 days remaining (amber)
      const valid: any[] = [];      // 60+ days remaining (green)

      for (const u of companyUsers) {
        if (!u.siaExpiryDate) continue; // skip if no expiry set
        const expiry = new Date(u.siaExpiryDate);
        const diffMs = expiry.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const record = {
          id: u.id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
          role: u.role,
          siaNumber: u.siaNumber,
          siaExpiryDate: u.siaExpiryDate,
          daysRemaining: diffDays,
        };
        if (expiry < now) {
          // Actually expired — past the expiry date
          expired.push({ ...record, daysOverdue: Math.abs(diffDays) });
        } else if (expiry < d60) {
          // Not expired yet but below 60 days remaining — amber
          expiring.push(record);
        } else {
          // 60+ days remaining — valid/green
          valid.push(record);
        }
      }

      expired.sort((a, b) => a.daysRemaining - b.daysRemaining);
      expiring.sort((a, b) => a.daysRemaining - b.daysRemaining);

      res.json({
        expired,
        expiring,
        valid,
        stats: {
          expired: expired.length,
          expiring: expiring.length,
          valid: valid.length,
          totalSiaEmployees: expired.length + expiring.length + valid.length,
          totalEmployees,
          activeSites,
        },
      });
    } catch (error: any) {
      console.error('Error fetching licence alerts:', error);
      res.status(500).json({ message: 'Failed to fetch licence alerts' });
    }
  });

  // Shifts at risk — next 14 days where guard has expired/expiring<60d SIA
  app.get('/api/admin/shifts-at-risk', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      if (user.role === 'super_admin' && !user.companyId) return res.json([]);
      const companyId = user.companyId;

      const now = new Date();
      const in14 = new Date(now); in14.setDate(in14.getDate() + 14);
      const d60 = new Date(now); d60.setDate(d60.getDate() + 60);

      // Get all sites for this company
      const allSites = await storage.getAllSites();
      const companySiteIds = new Set(allSites.filter(s => s.companyId === companyId).map(s => s.id));

      // Query upcoming shifts
      const upcomingShifts = await db
        .select()
        .from(scheduledShifts)
        .where(and(gte(scheduledShifts.startTime, now), lte(scheduledShifts.startTime, in14), eq(scheduledShifts.isActive, true)));

      // Filter to company's sites and attach user data
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const siteMap = new Map(allSites.map(s => [s.id, s]));

      const shiftsAtRisk: any[] = [];
      for (const shift of upcomingShifts) {
        if (!companySiteIds.has(shift.siteId)) continue;
        const guard = userMap.get(shift.userId);
        if (!guard) continue;
        if (!['guard', 'supervisor'].includes(guard.role)) continue;
        if (!guard.siaExpiryDate) continue;

        const expiry = new Date(guard.siaExpiryDate);
        const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (expiry >= d60) continue; // licence is fine for 60+ days

        const site = siteMap.get(shift.siteId);
        shiftsAtRisk.push({
          shiftId: shift.id,
          shiftDate: shift.startTime,
          site: site?.name || 'Unknown Site',
          employeeId: guard.id,
          employeeName: `${guard.firstName || ''} ${guard.lastName || ''}`.trim() || guard.username,
          licenceExpiry: guard.siaExpiryDate,
          daysUntilExpiry: diffDays,
          riskLevel: expiry < now ? 'expired' : 'expiring_soon',
        });
      }

      shiftsAtRisk.sort((a, b) => new Date(a.shiftDate).getTime() - new Date(b.shiftDate).getTime());
      res.json(shiftsAtRisk);
    } catch (error: any) {
      console.error('Error fetching shifts at risk:', error);
      res.status(500).json({ message: 'Failed to fetch shifts at risk' });
    }
  });

  // ============================================================
  // Task Manager Routes
  // ============================================================
  app.get('/api/tasks', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const companyId = user.companyId;
      if (!companyId) return res.json([]);
      const rows = await db.select().from(tasks).where(eq(tasks.companyId, companyId)).orderBy(desc(tasks.createdAt));
      // Enrich with assignee name
      const allUsers = await storage.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const enriched = rows.map(t => ({
        ...t,
        assigneeName: t.assignedTo ? (() => { const u = userMap.get(t.assignedTo!); return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username : 'Unknown'; })() : null,
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch tasks' });
    }
  });

  app.post('/api/tasks', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const companyId = user.companyId;
      if (!companyId) return res.status(403).json({ message: 'No company' });
      const { title, description, status, category, priority, assignedTo, dueDate, notes } = req.body;
      if (!title) return res.status(400).json({ message: 'Title is required' });
      const [task] = await db.insert(tasks).values({
        companyId,
        title,
        description: description || null,
        status: status || 'pending',
        category: category || 'general',
        priority: priority || 'medium',
        assignedTo: assignedTo || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        createdBy: user.id,
      }).returning();
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to create task' });
    }
  });

  app.patch('/api/tasks/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.companyId, user.companyId)));
      if (!existing) return res.status(404).json({ message: 'Task not found' });
      const updates: any = { updatedAt: new Date() };
      if ('title' in req.body) updates.title = req.body.title;
      if ('description' in req.body) updates.description = req.body.description;
      if ('status' in req.body) updates.status = req.body.status;
      if ('category' in req.body) updates.category = req.body.category;
      if ('priority' in req.body) updates.priority = req.body.priority;
      if ('assignedTo' in req.body) updates.assignedTo = req.body.assignedTo;
      if ('dueDate' in req.body) updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
      if ('notes' in req.body) updates.notes = req.body.notes;
      if ('isArchived' in req.body) {
        updates.isArchived = req.body.isArchived;
        updates.archivedAt = req.body.isArchived ? new Date() : null;
      }
      const [updated] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update task' });
    }
  });

  app.delete('/api/tasks/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.companyId, user.companyId)));
      if (!existing) return res.status(404).json({ message: 'Task not found' });
      await db.delete(tasks).where(eq(tasks.id, id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to delete task' });
    }
  });

  // Staff view — tasks assigned to me
  app.get('/api/tasks/my-tasks', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      const companyId = user.companyId;
      if (!companyId) return res.json([]);
      const rows = await db.select().from(tasks).where(and(eq(tasks.companyId, companyId), eq(tasks.assignedTo, user.id), eq(tasks.isArchived, false))).orderBy(desc(tasks.createdAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch my tasks' });
    }
  });

  app.get('/api/admin/active-check-ins', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const activeCheckIns = await storage.getAllActiveCheckIns();
      
      // Filter by company for regular admins
      let filteredCheckIns = activeCheckIns;
      if (user.role !== 'super_admin' && user.companyId) {
        filteredCheckIns = activeCheckIns.filter(ci => ci.user.companyId === user.companyId);
      }
      
      res.json(filteredCheckIns);
    } catch (error) {
      console.error("Error fetching active check-ins:", error);
      res.status(500).json({ message: "Failed to fetch active check-ins" });
    }
  });

  app.get('/api/admin/recent-activity', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const recentActivity = await storage.getAllRecentActivity(50);
      
      // Filter by company for regular admins
      let filteredActivity = recentActivity;
      if (user.role !== 'super_admin' && user.companyId) {
        filteredActivity = recentActivity.filter(activity => activity.user.companyId === user.companyId);
      }
      
      res.json(filteredActivity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  app.get('/api/admin/guards', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const allUsers = await storage.getAllUsers();
      
      // Always filter by company - super admins must use companyId query param or their own company
      let guards = allUsers;
      const targetCompanyId = req.query.companyId || user.companyId;
      if (targetCompanyId) {
        guards = allUsers.filter(g => g.companyId === targetCompanyId);
      } else if (user.role !== 'super_admin') {
        guards = [];
      }
      
      console.log(`[DEBUG] Found ${guards.length} employees from database`);
      
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
  app.post('/api/admin/manual-check-in', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = req.user;
      const { userId, siteId, workingRole } = req.body;
      
      console.log('[MANUAL CHECK-IN] Request:', { userId, siteId, workingRole, adminId: admin.id });
      
      if (!userId || !siteId || !workingRole) {
        console.log('[MANUAL CHECK-IN] Missing required fields');
        return res.status(400).json({ message: "userId, siteId, and workingRole are required" });
      }

      // For regular admins, validate user and site belong to their company
      if (admin.role !== 'super_admin') {
        const user = await storage.getUserById(userId);
        const site = await storage.getSite(siteId);
        
        console.log('[MANUAL CHECK-IN] Validation:', { 
          userId, 
          userFound: !!user, 
          userCompany: user?.companyId,
          siteFound: !!site, 
          siteCompany: site?.companyId,
          adminCompany: admin.companyId 
        });
        
        if (!user || user.companyId !== admin.companyId) {
          console.log('[MANUAL CHECK-IN] User validation failed');
          return res.status(403).json({ message: "Cannot check in users from other companies" });
        }
        if (!site || site.companyId !== admin.companyId) {
          console.log('[MANUAL CHECK-IN] Site validation failed');
          return res.status(403).json({ message: "Cannot check in to sites from other companies" });
        }
      }

      // Check if user already has an active check-in
      const activeCheckIn = await storage.getActiveCheckInForUser(userId);
      if (activeCheckIn) {
        console.log('[MANUAL CHECK-IN] User already has active check-in:', activeCheckIn.id);
        return res.status(400).json({ message: "User already has an active check-in. Please check out first." });
      }

      const validatedData = {
        userId,
        siteId,
        latitude: null,
        longitude: null,
        workingRole,
        status: 'active' as const,
      };

      console.log('[MANUAL CHECK-IN] Creating check-in with data:', validatedData);
      const checkIn = await storage.createCheckIn(validatedData);
      console.log('[MANUAL CHECK-IN] Check-in created successfully:', checkIn.id);
      
      // Fetch full details for Google Sheets sync
      const checkInWithDetails = await storage.getActiveCheckInForUser(userId);
      if (checkInWithDetails) {
        syncCheckInToSheets(checkInWithDetails).catch(err => {
          console.error("Background sync to sheets failed:", err);
        });
      }

      res.status(201).json(checkIn);
    } catch (error: any) {
      console.error("[MANUAL CHECK-IN ERROR]", error);
      res.status(400).json({ message: error.message || "Failed to create check-in" });
    }
  });

  app.post('/api/admin/manual-check-out', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = req.user;
      const { checkInId } = req.body;
      
      console.log('[MANUAL CHECK-OUT] Request:', { checkInId, adminId: admin.id });
      
      if (!checkInId) {
        console.log('[MANUAL CHECK-OUT] Missing checkInId');
        return res.status(400).json({ message: "checkInId is required" });
      }

      // Get the check-in to verify it exists and is active
      const allActiveCheckIns = await storage.getAllActiveCheckIns();
      console.log('[MANUAL CHECK-OUT] Total active check-ins:', allActiveCheckIns.length);
      
      const activeCheckIn = allActiveCheckIns.find(ci => ci.id === checkInId);
      
      if (!activeCheckIn) {
        console.log('[MANUAL CHECK-OUT] Check-in not found in active check-ins');
        return res.status(404).json({ message: "Active check-in not found" });
      }

      console.log('[MANUAL CHECK-OUT] Found check-in:', { 
        id: activeCheckIn.id, 
        userId: activeCheckIn.userId, 
        userCompany: activeCheckIn.user.companyId,
        adminCompany: admin.companyId 
      });

      // For regular admins, validate check-in belongs to their company
      if (admin.role !== 'super_admin' && activeCheckIn.user.companyId !== admin.companyId) {
        console.log('[MANUAL CHECK-OUT] Company mismatch');
        return res.status(403).json({ message: "Cannot check out users from other companies" });
      }

      console.log('[MANUAL CHECK-OUT] Calling storage.checkOut');
      const checkIn = await storage.checkOut(checkInId);
      console.log('[MANUAL CHECK-OUT] Check-out successful:', checkIn.id);
      
      // Update Google Sheets asynchronously
      const checkInWithDetails = await storage.getUserRecentCheckIns(activeCheckIn.userId, 1);
      if (checkInWithDetails.length > 0) {
        updateCheckOutInSheets(checkInWithDetails[0]).catch(err => {
          console.error("Background update to sheets failed:", err);
        });
      }

      res.json(checkIn);
    } catch (error: any) {
      console.error("[MANUAL CHECK-OUT ERROR]", error);
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
      const isAdminUser = user.role === 'admin' || user.role === 'super_admin';
      
      let shifts;
      if (isAdminUser) {
        shifts = await storage.getAllScheduledShifts();
        if (user.role !== 'super_admin' && user.companyId) {
          shifts = shifts.filter(shift => shift.user.companyId === user.companyId);
        }
      } else {
        const userId = user.id;
        shifts = await storage.getUserScheduledShifts(userId);
      }

      // enriched company data is already returned by getUserScheduledShifts for guards
      // for admins, we might need to ensure it's enriched if not already
      
      const jobShareIds = [...new Set(shifts.filter((s: any) => s.jobShareId).map((s: any) => s.jobShareId))];
      if (jobShareIds.length > 0) {
        const allCompanies = await storage.getAllCompanies();
        const companyMap = new Map(allCompanies.map(c => [c.id, c.name]));

        const jobShareCompanyMap = new Map<string, string>();
        for (const jsId of jobShareIds) {
          try {
            const js = await storage.getJobShare(jsId);
            if (js) {
              jobShareCompanyMap.set(jsId, companyMap.get(js.fromCompanyId) || 'Partner Company');
            }
          } catch {}
        }

        const enriched = shifts.map((s: any) => {
          if (s.jobShareId && jobShareCompanyMap.has(s.jobShareId)) {
            return { ...s, jobShareFromCompany: jobShareCompanyMap.get(s.jobShareId) };
          }
          return s;
        });
        return res.json(enriched);
      }

      res.json(shifts);
    } catch (error) {
      console.error("Error fetching scheduled shifts:", error);
      res.status(500).json({ message: "Failed to fetch scheduled shifts" });
    }
  });

  app.get('/api/scheduled-shifts/user/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = req.user;
      const { userId } = req.params;
      
      // For regular admins, validate user belongs to their company
      if (admin.role !== 'super_admin') {
        const user = await storage.getUserById(userId);
        if (!user || user.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot access shifts for users from other companies" });
        }
      }
      
      const shifts = await storage.getUserScheduledShifts(userId);
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching user shifts:", error);
      res.status(500).json({ message: "Failed to fetch user shifts" });
    }
  });

  app.get('/api/scheduled-shifts/range', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = req.user;
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }
      let shifts = await storage.getScheduledShiftsInRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      // Filter by company for regular admins
      if (admin.role !== 'super_admin' && admin.companyId) {
        shifts = shifts.filter(shift => shift.user.companyId === admin.companyId);
      }
      
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching shifts in range:", error);
      res.status(500).json({ message: "Failed to fetch shifts" });
    }
  });

  app.post('/api/scheduled-shifts/batch', isAuthenticated, isAdmin, requireActiveTrial, requireFeature('shiftScheduling'), async (req: any, res) => {
    try {
      const admin = req.user;
      const { shifts: shiftsData } = req.body;

      if (!Array.isArray(shiftsData) || shiftsData.length === 0) {
        return res.status(400).json({ message: "At least one shift is required" });
      }

      if (shiftsData.length > 50) {
        return res.status(400).json({ message: "Maximum 50 shifts can be created at once" });
      }

      const createdShifts = [];
      for (const shiftData of shiftsData) {
        const validatedData = insertScheduledShiftSchema.parse(shiftData);

        if (admin.role !== 'super_admin') {
          const user = await storage.getUserById(validatedData.userId);
          const site = await storage.getSite(validatedData.siteId);

          if (!user || user.companyId !== admin.companyId) {
            return res.status(403).json({ message: "Cannot create shifts for users from other companies" });
          }
          if (!site || site.companyId !== admin.companyId) {
            return res.status(403).json({ message: "Cannot create shifts for sites from other companies" });
          }
        }

        const shift = await storage.createScheduledShift(validatedData);
        createdShifts.push(shift);
      }

      res.status(201).json(createdShifts);
    } catch (error: any) {
      console.error("[BATCH CREATE SHIFT ERROR]", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input data" });
      }
      res.status(400).json({ message: error.message || "Failed to create shifts" });
    }
  });

  app.post('/api/scheduled-shifts', isAuthenticated, isAdmin, requireActiveTrial, requireFeature('shiftScheduling'), async (req: any, res) => {
    try {
      const admin = req.user;
      
      console.log('[CREATE SHIFT] Request body:', req.body);
      console.log('[CREATE SHIFT] Admin:', { id: admin.id, role: admin.role, companyId: admin.companyId });
      
      const validatedData = insertScheduledShiftSchema.parse(req.body);
      console.log('[CREATE SHIFT] Validated data:', validatedData);
      
      // For regular admins, validate user and site belong to their company
      if (admin.role !== 'super_admin') {
        const user = await storage.getUserById(validatedData.userId);
        const site = await storage.getSite(validatedData.siteId);
        
        console.log('[CREATE SHIFT] Validation:', { 
          userFound: !!user, 
          userCompany: user?.companyId,
          siteFound: !!site,
          siteCompany: site?.companyId,
          adminCompany: admin.companyId 
        });
        
        if (!user || user.companyId !== admin.companyId) {
          console.log('[CREATE SHIFT] User validation failed');
          return res.status(403).json({ message: "Cannot create shifts for users from other companies" });
        }
        if (!site || site.companyId !== admin.companyId) {
          console.log('[CREATE SHIFT] Site validation failed');
          return res.status(403).json({ message: "Cannot create shifts for sites from other companies" });
        }
      }
      
      console.log('[CREATE SHIFT] Creating shift...');
      const shift = await storage.createScheduledShift(validatedData);
      console.log('[CREATE SHIFT] Shift created successfully:', shift.id);
      res.status(201).json(shift);
    } catch (error: any) {
      console.error("[CREATE SHIFT ERROR]", error);
      if (error.name === 'ZodError') {
        console.error("[CREATE SHIFT] Zod validation errors:", error.errors);
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input data" });
      }
      res.status(400).json({ message: error.message || "Failed to create shift" });
    }
  });

  app.patch('/api/scheduled-shifts/:id', isAuthenticated, isAdmin, requireActiveTrial, async (req: any, res) => {
    try {
      const admin = req.user;
      const { id } = req.params;
      
      // For regular admins, validate shift belongs to their company
      if (admin.role !== 'super_admin') {
        const existingShift = await storage.getScheduledShift(id);
        if (!existingShift) {
          return res.status(404).json({ message: "Scheduled shift not found" });
        }
        
        // Get user to check company
        const shiftUser = await storage.getUserById(existingShift.userId);
        if (!shiftUser || shiftUser.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot update shifts from other companies" });
        }
        
        // If updating userId or siteId, validate they belong to admin's company
        if (req.body.userId) {
          const user = await storage.getUserById(req.body.userId);
          if (!user || user.companyId !== admin.companyId) {
            return res.status(403).json({ message: "Cannot assign shifts to users from other companies" });
          }
        }
        if (req.body.siteId) {
          const site = await storage.getSite(req.body.siteId);
          if (!site || site.companyId !== admin.companyId) {
            return res.status(403).json({ message: "Cannot assign shifts to sites from other companies" });
          }
        }
      }
      
      const shift = await storage.updateScheduledShift(id, req.body);
      res.json(shift);
    } catch (error: any) {
      console.error("Error updating scheduled shift:", error);
      res.status(400).json({ message: error.message || "Failed to update shift" });
    }
  });

  app.delete('/api/scheduled-shifts/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = req.user;
      const { id } = req.params;
      
      // For regular admins, validate shift belongs to their company
      if (admin.role !== 'super_admin') {
        const existingShift = await storage.getScheduledShift(id);
        if (!existingShift) {
          return res.status(404).json({ message: "Scheduled shift not found" });
        }
        // Get the user to check their company
        const shiftUser = await storage.getUser(existingShift.userId);
        if (!shiftUser || shiftUser.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot delete shifts from other companies" });
        }
      }
      
      await storage.deleteScheduledShift(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting scheduled shift:", error);
      res.status(400).json({ message: error.message || "Failed to delete shift" });
    }
  });

  // Leave request routes
  app.post('/api/leave-requests', isAuthenticated, requireActiveTrial, requireFeature('leaveRequests'), async (req: any, res) => {
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

  // Admin can create leave on behalf of employees
  app.post('/api/admin/leave-requests', isAuthenticated, isAdmin, requireActiveTrial, requireFeature('leaveRequests'), async (req: any, res) => {
    try {
      const admin = req.user;
      const { userId, ...leaveData } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "Employee ID is required" });
      }
      
      // Validate the employee belongs to admin's company
      if (admin.role !== 'super_admin') {
        const employee = await storage.getUser(userId);
        if (!employee || employee.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot create leave for employees from other companies" });
        }
      }
      
      const validatedData = insertLeaveRequestSchema.parse({
        ...leaveData,
        userId,
      });
      
      // Create leave request and auto-approve it since admin is creating it
      const leaveRequest = await storage.createLeaveRequest(validatedData);
      
      // Auto-approve the leave since admin is creating it manually
      const approvedLeave = await storage.updateLeaveRequest(leaveRequest.id, {
        status: 'approved',
        reviewedBy: admin.id,
        reviewNotes: 'Auto-approved: Created by admin on behalf of employee',
      });
      
      res.status(201).json(approvedLeave);
    } catch (error: any) {
      console.error("Error creating admin leave request:", error);
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

  app.get('/api/leave-requests', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let requests = await storage.getAllLeaveRequests();
      
      // SECURITY: Filter by company for regular admins
      if (user.role !== 'super_admin' && user.companyId) {
        requests = requests.filter((r: any) => r.user?.companyId === user.companyId);
      }
      
      res.json(requests);
    } catch (error) {
      console.error("Error fetching all leave requests:", error);
      res.status(500).json({ message: "Failed to fetch leave requests" });
    }
  });

  app.get('/api/leave-requests/pending', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let requests = await storage.getPendingLeaveRequests();
      
      // SECURITY: Filter by company for regular admins
      if (user.role !== 'super_admin' && user.companyId) {
        requests = requests.filter((r: any) => r.user?.companyId === user.companyId);
      }
      
      res.json(requests);
    } catch (error) {
      console.error("Error fetching pending leave requests:", error);
      res.status(500).json({ message: "Failed to fetch pending requests" });
    }
  });

  app.get('/api/leave-requests/upcoming', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const daysAhead = parseInt(req.query.days as string) || 30;
      let requests = await storage.getUpcomingLeaveRequests(daysAhead);
      
      // SECURITY: Filter by company for regular admins
      if (user.role !== 'super_admin' && user.companyId) {
        requests = requests.filter((r: any) => r.user?.companyId === user.companyId);
      }
      
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
  app.get('/api/admin/billing/weekly', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { weekStart } = req.query;
      const user = req.user;
      const startDate = weekStart ? new Date(weekStart as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      
      // Pass companyId for regular admins, null for super admin (all companies)
      const companyId = user.role === 'super_admin' ? null : user.companyId;
      const report = await storage.getWeeklyBillingReport(startDate, companyId);
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
  app.get('/api/admin/reports/overtime', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { weekStart } = req.query;
      const user = req.user;
      const startDate = weekStart ? new Date(weekStart as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      
      // Pass companyId for regular admins, null for super admin (all companies)
      const companyId = user.role === 'super_admin' ? null : user.companyId;
      const report = await storage.getOvertimeReport(startDate, companyId);
      res.json(report);
    } catch (error) {
      console.error("Error fetching overtime report:", error);
      res.status(500).json({ message: "Failed to fetch overtime report" });
    }
  });

  app.get('/api/admin/reports/anomalies', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const user = req.user;
      const start = startDate ? new Date(startDate as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Pass companyId for regular admins, null for super admin (all companies)
      const companyId = user.role === 'super_admin' ? null : user.companyId;
      const report = await storage.getAnomalyReport(start, end, companyId);
      res.json(report);
    } catch (error) {
      console.error("Error fetching anomaly report:", error);
      res.status(500).json({ message: "Failed to fetch anomaly report" });
    }
  });

  app.get('/api/admin/reports/detailed-shifts', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const user = req.user;
      const start = startDate ? new Date(startDate as string) : startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Pass companyId for regular admins, null for super admin (all companies)
      const companyId = user.role === 'super_admin' ? null : user.companyId;
      const report = await storage.getDetailedShiftReport(start, end, companyId);
      res.json(report);
    } catch (error) {
      console.error("Error fetching detailed shift report:", error);
      res.status(500).json({ message: "Failed to fetch detailed shift report" });
    }
  });

  // Break and overtime approval routes (admin only)
  app.get('/api/admin/approvals/breaks', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const results = await db
        .select()
        .from(breaks)
        .leftJoin(users, eq(breaks.userId, users.id))
        .leftJoin(checkIns, eq(breaks.checkInId, checkIns.id))
        .leftJoin(sites, eq(checkIns.siteId, sites.id))
        .where(eq(breaks.approvalStatus, 'pending'))
        .orderBy(desc(breaks.breakEndTime));

      let pendingBreaks = results.map(r => ({
        ...r.breaks,
        user: r.users,
        checkIn: r.check_ins,
        site: r.sites,
      }));

      // SECURITY: Filter by company for regular admins
      if (user.role !== 'super_admin' && user.companyId) {
        pendingBreaks = pendingBreaks.filter(b => b.user?.companyId === user.companyId);
      }

      res.json(pendingBreaks);
    } catch (error) {
      console.error("Error fetching pending breaks:", error);
      res.status(500).json({ message: "Failed to fetch pending breaks" });
    }
  });

  app.post('/api/admin/approvals/breaks/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const admin = req.user;

      // SECURITY: Verify break belongs to admin's company
      const breakRecord = await storage.getBreakById(id);
      if (!breakRecord) {
        return res.status(404).json({ message: "Break not found" });
      }
      
      if (admin.role !== 'super_admin') {
        const breakUser = await storage.getUserById(breakRecord.userId);
        if (!breakUser || breakUser.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot approve breaks from other companies" });
        }
      }

      const updatedBreak = await storage.updateBreak(id, {
        approvalStatus: 'approved',
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      });

      res.json(updatedBreak);
    } catch (error: any) {
      console.error("Error approving break:", error);
      res.status(400).json({ message: error.message || "Failed to approve break" });
    }
  });

  app.post('/api/admin/approvals/breaks/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const admin = req.user;

      // SECURITY: Verify break belongs to admin's company
      const breakRecord = await storage.getBreakById(id);
      if (!breakRecord) {
        return res.status(404).json({ message: "Break not found" });
      }
      
      if (admin.role !== 'super_admin') {
        const breakUser = await storage.getUserById(breakRecord.userId);
        if (!breakUser || breakUser.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot reject breaks from other companies" });
        }
      }

      const updatedBreak = await storage.updateBreak(id, {
        approvalStatus: 'rejected',
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      });

      res.json(updatedBreak);
    } catch (error: any) {
      console.error("Error rejecting break:", error);
      res.status(400).json({ message: error.message || "Failed to reject break" });
    }
  });

  app.get('/api/admin/approvals/overtime', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let overtimeRequests = await storage.getPendingOvertimeRequests();
      
      // SECURITY: Filter by company for regular admins
      if (user.role !== 'super_admin' && user.companyId) {
        overtimeRequests = overtimeRequests.filter((ot: any) => ot.user?.companyId === user.companyId);
      }
      
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
      const admin = req.user;

      // SECURITY: Verify overtime belongs to admin's company
      const overtime = await storage.getOvertimeRequest(id);
      if (!overtime) {
        return res.status(404).json({ message: "Overtime request not found" });
      }
      
      if (admin.role !== 'super_admin') {
        const otUser = await storage.getUserById(overtime.userId);
        if (!otUser || otUser.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot approve overtime from other companies" });
        }
      }

      const overtimeRequest = await storage.approveOvertimeRequest(id, admin.id, notes);
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
      const admin = req.user;

      // SECURITY: Verify overtime belongs to admin's company
      const overtime = await storage.getOvertimeRequest(id);
      if (!overtime) {
        return res.status(404).json({ message: "Overtime request not found" });
      }
      
      if (admin.role !== 'super_admin') {
        const otUser = await storage.getUserById(overtime.userId);
        if (!otUser || otUser.companyId !== admin.companyId) {
          return res.status(403).json({ message: "Cannot reject overtime from other companies" });
        }
      }

      const overtimeRequest = await storage.rejectOvertimeRequest(id, admin.id, notes);
      res.json(overtimeRequest);
    } catch (error: any) {
      console.error("Error rejecting overtime:", error);
      res.status(400).json({ message: error.message || "Failed to reject overtime" });
    }
  });

  // Invitation routes (admin only)
  app.get('/api/admin/invitations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let invitations = await storage.getAllInvitations();
      
      // SECURITY: Filter by company for regular admins
      if (user.role !== 'super_admin' && user.companyId) {
        invitations = invitations.filter(inv => inv.companyId === user.companyId);
      }
      
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  app.post('/api/admin/invitations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const admin = req.user;
      
      // Get admin user details for sending email
      const adminUser = await storage.getUserById(admin.id);
      if (!adminUser) {
        return res.status(400).json({ message: "Admin user not found" });
      }
      
      // Determine the company ID
      const companyId = admin.role === 'super_admin' ? req.body.companyId : admin.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      // Get company details for the email
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const adminName = adminUser.firstName && adminUser.lastName 
        ? `${adminUser.firstName} ${adminUser.lastName}`
        : adminUser.username;

      const inviteEmail = req.body.email;
      if (!inviteEmail) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if a user with this email already exists
      const existingUsers = await storage.getUsersByEmail(inviteEmail);
      const existingUser = existingUsers.find(u => u.companyId === companyId) || existingUsers[0];

      if (existingUser) {
        if (existingUser.isActivated) {
          // Case B — user exists AND isActivated=true
          await storage.upsertMembership({
            userId: existingUser.id,
            companyId: companyId,
            role: req.body.role || 'guard',
            status: 'active',
            invitedBy: admin.id
          });

          try {
            const { sendAddedToCompanyEmail } = await import('./emailService');
            await sendAddedToCompanyEmail(existingUser.email || inviteEmail, company.name, adminName);
          } catch (emailErr) {
            console.error("[Invitation] Failed to send direct membership email:", emailErr);
          }

          return res.json({ 
            success: true, 
            type: 'direct_membership', 
            message: 'User added directly to company' 
          });
        } else {
          // Case C — user exists AND isActivated=false
          // Create/upsert invitation (pending)
          const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
          const invitationData = {
            ...req.body,
            token,
            invitedBy: admin.id,
            companyId,
          };
          const validatedData = insertInvitationSchema.parse(invitationData);
          
          await storage.createInvitation(validatedData);
          await storage.upsertMembership({
            userId: existingUser.id,
            companyId: companyId,
            role: req.body.role || 'guard',
            status: 'pending',
            invitedBy: admin.id
          });

          try {
            const { sendAddedToAnotherCompanyEmail } = await import('./emailService');
            await sendAddedToAnotherCompanyEmail(existingUser.email || inviteEmail, company.name);
          } catch (emailErr) {
            console.error("[Invitation] Failed to send pending membership email:", emailErr);
          }

          return res.json({ 
            success: true, 
            type: 'pending_membership', 
            message: 'Invite sent, awaiting activation' 
          });
        }
      }

      // Case A — no existing user: existing flow
      // Generate a unique token
      const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const invitationData = {
        ...req.body,
        token,
        invitedBy: admin.id,
        companyId,
      };
      
      const validatedData = insertInvitationSchema.parse(invitationData);

      // Upsert: if a pending invitation already exists for this email+company, update it
      let invitation: any;
      const existing = await storage.getInvitationByEmailAndCompany(validatedData.email, companyId);

      if (existing && existing.status === 'pending') {
        invitation = await storage.updateInvitation(existing.id, {
          role: validatedData.role,
          token: validatedData.token,
          expiresAt: validatedData.expiresAt,
          invitedBy: validatedData.invitedBy,
        });
      } else {
        invitation = await storage.createInvitation(validatedData);
      }
      
      // Send invitation email
      let emailSent = false;
      let emailError: string | null = null;
      
      try {
        console.log(`[Invitation] Sending email to ${invitation.email} from ${adminName}`);

        await sendInvitationEmail({
          toEmail: invitation.email,
          fromEmail: adminUser.email || undefined,
          fromName: adminName,
          inviteToken: invitation.token,
          role: invitation.role,
          expiresAt: invitation.expiresAt || undefined,
          companyName: company.name,
          companyCode: company.companyId,
          companyUuid: company.id,
        });

        emailSent = true;
        console.log(`[Invitation] Email sent successfully to ${invitation.email}`);
      } catch (err: any) {
        console.error("[Invitation] Failed to send invitation email:", err);
        emailError = err.message || "Failed to send email";
      }
      
      res.status(201).json({ 
        ...invitation, 
        emailSent,
        emailError: emailError || undefined
      });
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(400).json({ message: error.message || "Failed to create invitation" });
    }
  });

  app.patch('/api/admin/invitations/:id/revoke', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const admin = req.user;
      
      // SECURITY: Verify invitation belongs to admin's company
      const invitation = await storage.getInvitationById(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      if (admin.role !== 'super_admin' && invitation.companyId !== admin.companyId) {
        return res.status(403).json({ message: "Cannot revoke invitations from other companies" });
      }
      
      const revokedInvitation = await storage.revokeInvitation(id);
      res.json(revokedInvitation);
    } catch (error: any) {
      console.error("Error revoking invitation:", error);
      res.status(400).json({ message: error.message || "Failed to revoke invitation" });
    }
  });

  app.delete('/api/admin/invitations/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const admin = req.user;
      
      // SECURITY: Verify invitation belongs to admin's company
      const invitation = await storage.getInvitationById(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      if (admin.role !== 'super_admin' && invitation.companyId !== admin.companyId) {
        return res.status(403).json({ message: "Cannot delete invitations from other companies" });
      }
      
      await storage.deleteInvitation(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      res.status(400).json({ message: error.message || "Failed to delete invitation" });
    }
  });

  // Notice routes
  app.post('/api/notices', isAuthenticated, isAdmin, requireActiveTrial, requireFeature('noticeBoard'), async (req: any, res) => {
    try {
      console.log('Received notice creation request:', JSON.stringify(req.body, null, 2));
      const validatedData = insertNoticeSchema.parse(req.body);
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));
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
      if (error.errors) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        res.status(400).json({ 
          message: "Validation failed", 
          errors: error.errors 
        });
      } else {
        res.status(400).json({ message: error.message || "Failed to create notice" });
      }
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

  app.get('/api/notices/all', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let notices = await storage.getAllNotices();
      
      // SECURITY: Filter by company for regular admins
      if (user.role !== 'super_admin' && user.companyId) {
        notices = notices.filter((n: any) => n.postedByUser?.companyId === user.companyId);
      }
      
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
      
      // Check if user has already applied to this notice
      const hasApplied = await storage.hasUserAppliedToNotice(req.user.id, validatedData.noticeId);
      if (hasApplied) {
        return res.status(409).json({ message: "You have already applied to this notice" });
      }
      
      const application = await storage.createNoticeApplication(validatedData);
      res.status(201).json(application);
    } catch (error: any) {
      console.error("Error creating notice application:", error);
      res.status(400).json({ message: error.message || "Failed to create application" });
    }
  });

  app.get('/api/notice-applications', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const applications = await storage.getAllNoticeApplications();
      res.json(applications);
    } catch (error) {
      console.error("Error fetching all notice applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
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

  app.get('/api/notice-applications/check/:noticeId', isAuthenticated, async (req: any, res) => {
    try {
      const { noticeId } = req.params;
      const hasApplied = await storage.hasUserAppliedToNotice(req.user.id, noticeId);
      res.json({ hasApplied });
    } catch (error) {
      console.error("Error checking application status:", error);
      res.status(500).json({ message: "Failed to check application status" });
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

  // Store FCM token for native Android push notifications
  app.post('/api/push/fcm-token', isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: "FCM token is required" });
      }
      await storage.updateUserFcmToken(req.user.id, token);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error storing FCM token:", error);
      res.status(500).json({ message: error.message || "Failed to store FCM token" });
    }
  });

  // Company settings routes (admin only for updates, all authenticated users can view)
  app.get('/api/company-settings', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      let settings = await storage.getCompanySettings(user?.companyId);
      
      // If no settings exist for this company, create them
      if (!settings) {
        if (user?.companyId) {
          try {
            settings = await storage.createCompanySettings({
              companyId: user.companyId,
              companyName: '',
            });
          } catch {
            // Creation failed (e.g. FK violation) — just return defaults
          }
        }
      }
      
      res.json(settings || {
        companyName: '',
        invoicePrefix: 'INV',
        companyAddress: '',
        companyPhone: '',
        companyEmail: '',
        taxId: '',
        registrationNumber: '',
        bankName: '',
        bankAccountNumber: '',
        bankSortCode: '',
        invoiceNotes: '',
        logoUrl: '',
      });
    } catch (error: any) {
      console.error("Error fetching company settings:", error);
      res.status(500).json({ message: error.message || "Failed to fetch company settings" });
    }
  });

  app.put('/api/company-settings', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let settings = await storage.getCompanySettings(user?.companyId);

      // Parse through schema to strip id/createdAt/updatedAt (which arrive as strings from the client)
      const parsed = updateCompanySettingsSchema.parse(req.body);

      if (!settings) {
        settings = await storage.createCompanySettings({ ...parsed, companyId: user?.companyId });
      } else {
        settings = await storage.updateCompanySettings(settings.id, parsed);
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error("Error updating company settings:", error);
      res.status(400).json({ message: error.message || "Failed to update company settings" });
    }
  });

  // Company plan visibility routes (admin view)
  app.get('/api/company/plan', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user.companyId) {
        return res.json({ plan: null, planName: null });
      }
      
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.json({ plan: null, planName: null });
      }
      
      let plan = null;
      if (company.planId) {
        plan = await storage.getSubscriptionPlan(company.planId);
      }
      
      res.json({
        plan,
        planName: plan?.name || null,
      });
    } catch (error: any) {
      console.error("Error fetching company plan:", error);
      res.status(500).json({ message: error.message || "Failed to fetch company plan" });
    }
  });

  app.get('/api/company/plan-summary', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!user.companyId) {
        return res.status(400).json({ message: "User not associated with a company" });
      }
      
      const company = await storage.getCompany(user.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      let currentPlan = null;
      if (company.planId) {
        currentPlan = await storage.getSubscriptionPlan(company.planId);
      }
      
      // Calculate trial days remaining if on trial
      let trialDaysRemaining = null;
      if (company.trialStatus === 'trial' && company.trialEndDate) {
        const now = new Date();
        const endDate = new Date(company.trialEndDate);
        trialDaysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }
      
      res.json({
        company: {
          id: company.id,
          companyId: company.companyId,
          name: company.name,
        },
        subscription: {
          status: company.trialStatus || 'full',
          trialEndDate: company.trialEndDate,
          trialDaysRemaining,
          billingStartDate: company.billingStartDate,
        },
        currentPlan: currentPlan ? {
          id: currentPlan.id,
          name: currentPlan.name,
          description: currentPlan.description,
          monthlyPrice: currentPlan.monthlyPrice,
          features: currentPlan.features,
          limits: currentPlan.limits,
        } : null,
      });
    } catch (error: any) {
      console.error("Error fetching company plan summary:", error);
      res.status(500).json({ message: error.message || "Failed to fetch plan summary" });
    }
  });

  // Get all available subscription plans (for plan comparison)
  app.get('/api/subscription-plans', isAuthenticated, async (req: any, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      const activePlans = plans.filter(p => p.isActive).sort((a, b) => {
        const aOrder = a.sortOrder ? parseFloat(a.sortOrder) : 0;
        const bOrder = b.sortOrder ? parseFloat(b.sortOrder) : 0;
        return aOrder - bOrder;
      });
      res.json(activePlans);
    } catch (error: any) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscription plans" });
    }
  });

  // Company partnership routes (admin only)
  app.post('/api/partnerships/search', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { searchTerm } = req.body;
      
      if (!searchTerm || searchTerm.trim() === '') {
        return res.status(400).json({ message: "Search term is required" });
      }

      const company = await storage.findCompanyByNameOrEmail(searchTerm);
      
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Don't allow partnering with own company
      if (company.id === req.user.companyId) {
        return res.status(400).json({ message: "Cannot partner with your own company" });
      }

      res.json(company);
    } catch (error: any) {
      console.error("Error searching for company:", error);
      res.status(500).json({ message: error.message || "Failed to search for company" });
    }
  });

  app.get('/api/partnerships/sent', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const partnerships = await storage.getPartnershipsSentByCompany(user.companyId);
      res.json(partnerships);
    } catch (error: any) {
      console.error("Error fetching sent partnerships:", error);
      res.status(500).json({ message: error.message || "Failed to fetch sent partnerships" });
    }
  });

  app.get('/api/partnerships/received', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const partnerships = await storage.getPartnershipsReceivedByCompany(user.companyId);
      res.json(partnerships);
    } catch (error: any) {
      console.error("Error fetching received partnerships:", error);
      res.status(500).json({ message: error.message || "Failed to fetch received partnerships" });
    }
  });

  app.get('/api/partnerships/accepted', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const partnerships = await storage.getAcceptedPartnershipsByCompany(user.companyId);
      res.json(partnerships);
    } catch (error: any) {
      console.error("Error fetching accepted partnerships:", error);
      res.status(500).json({ message: error.message || "Failed to fetch accepted partnerships" });
    }
  });

  app.get('/api/partnerships/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const partnership = await storage.getPartnership(id);
      
      if (!partnership) {
        return res.status(404).json({ message: "Partnership not found" });
      }

      // Multi-tenant authorization: only super admins or involved companies can view
      if (user.role !== 'super_admin') {
        if (partnership.fromCompanyId !== user.companyId && partnership.toCompanyId !== user.companyId) {
          return res.status(403).json({ message: "Forbidden - You can only view partnerships involving your company" });
        }
      }

      res.json(partnership);
    } catch (error: any) {
      console.error("Error fetching partnership:", error);
      res.status(500).json({ message: error.message || "Failed to fetch partnership" });
    }
  });

  app.post('/api/partnerships', isAuthenticated, isAdmin, requireActiveTrial, async (req: any, res) => {
    try {
      const user = req.user;
      console.log('[DEBUG] POST /api/partnerships - Request body:', JSON.stringify(req.body));
      console.log('[DEBUG] POST /api/partnerships - User:', { id: user.id, companyId: user.companyId });
      
      // Validate required fields
      if (!req.body.toCompanyId || req.body.toCompanyId.trim() === '') {
        console.log('[DEBUG] POST /api/partnerships - Validation failed: toCompanyId missing');
        return res.status(400).json({ message: "Target company is required" });
      }

      // Prevent partnering with own company
      if (req.body.toCompanyId === user.companyId) {
        console.log('[DEBUG] POST /api/partnerships - Validation failed: cannot partner with own company');
        return res.status(400).json({ message: "You cannot create a partnership with your own company" });
      }

      // Check if partnership already exists in either direction
      const existingSent = await storage.getPartnershipsSentByCompany(user.companyId);
      const existingReceived = await storage.getPartnershipsReceivedByCompany(user.companyId);
      
      // Check for existing partnership sent by this company
      const sentPartnership = existingSent.find(p => p.toCompanyId === req.body.toCompanyId);
      if (sentPartnership) {
        if (sentPartnership.status === 'pending') {
          console.log('[DEBUG] POST /api/partnerships - Pending request already exists');
          return res.status(400).json({ message: "You have already sent a partnership request to this company" });
        } else if (sentPartnership.status === 'accepted') {
          console.log('[DEBUG] POST /api/partnerships - Active partnership already exists');
          return res.status(400).json({ message: "You are already in partnership with this company" });
        }
      }
      
      // Check for existing partnership received from the target company
      const receivedPartnership = existingReceived.find(p => p.fromCompanyId === req.body.toCompanyId);
      if (receivedPartnership) {
        if (receivedPartnership.status === 'pending') {
          console.log('[DEBUG] POST /api/partnerships - Incoming request already exists');
          return res.status(400).json({ message: "This company has already sent you a partnership request. Please check your Received Requests tab" });
        } else if (receivedPartnership.status === 'accepted') {
          console.log('[DEBUG] POST /api/partnerships - Active partnership already exists (received)');
          return res.status(400).json({ message: "You are already in partnership with this company" });
        }
      }

      const partnershipData = {
        ...req.body,
        fromCompanyId: user.companyId,
        requestedBy: user.id,
      };

      console.log('[DEBUG] POST /api/partnerships - Creating partnership with data:', JSON.stringify(partnershipData));
      const partnership = await storage.createPartnership(partnershipData);
      console.log('[DEBUG] POST /api/partnerships - Created partnership:', JSON.stringify(partnership));

      // Non-blocking email to receiving company
      (async () => {
        try {
          const toCompany = await storage.getCompany(req.body.toCompanyId);
          if (!toCompany?.email) return;
          const fromCompany = await storage.getCompany(user.companyId);
          const fromName = fromCompany?.name || 'A partner company';
          const appUrl = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/login`;
          const { sendPartnershipRequestEmail } = await import('./emailService');
          await sendPartnershipRequestEmail(toCompany.email, fromName, appUrl);
        } catch (emailErr: any) {
          console.error('[Partnership Email] Failed to send request notification:', emailErr.message);
        }
      })();

      res.status(201).json(partnership);
    } catch (error: any) {
      console.error("Error creating partnership:", error);
      res.status(400).json({ message: error.message || "Failed to create partnership" });
    }
  });

  app.patch('/api/partnerships/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const partnership = await storage.getPartnership(id);
      
      if (!partnership) {
        return res.status(404).json({ message: "Partnership not found" });
      }

      // Multi-tenant authorization: only the receiving company can accept/reject
      if (user.role !== 'super_admin') {
        if (partnership.toCompanyId !== user.companyId) {
          return res.status(403).json({ message: "Forbidden - Only the receiving company can respond to partnership requests" });
        }
      }

      const updates = {
        ...req.body,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      };

      const updated = await storage.updatePartnership(id, updates);

      // Send email to requesting company when accepted
      if (req.body.status === 'accepted') {
        (async () => {
          try {
            const fromCompany = await storage.getCompany(partnership.fromCompanyId);
            if (!fromCompany?.email) return;
            const toCompany = await storage.getCompany(partnership.toCompanyId);
            const acceptingName = toCompany?.name || 'Your partner company';
            const appUrl = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/login`;
            const { sendPartnershipAcceptedEmail } = await import('./emailService');
            await sendPartnershipAcceptedEmail(fromCompany.email, acceptingName, appUrl);
          } catch (emailErr: any) {
            console.error('[Partnership Email] Failed to send accepted notification:', emailErr.message);
          }
        })();
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating partnership:", error);
      res.status(400).json({ message: error.message || "Failed to update partnership" });
    }
  });

  app.delete('/api/partnerships/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const partnership = await storage.getPartnership(id);
      
      if (!partnership) {
        return res.status(404).json({ message: "Partnership not found" });
      }

      // Multi-tenant authorization: only the requesting company can delete
      if (user.role !== 'super_admin') {
        if (partnership.fromCompanyId !== user.companyId) {
          return res.status(403).json({ message: "Forbidden - Only the requesting company can cancel partnership requests" });
        }
      }

      await storage.deletePartnership(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting partnership:", error);
      res.status(500).json({ message: error.message || "Failed to delete partnership" });
    }
  });

  // Job share routes (admin only)
  app.get('/api/job-shares', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      let jobShares;

      if (user.role === 'super_admin') {
        // Super admins can see all job shares
        jobShares = await storage.getAllJobShares();
      } else {
        // Regular admins can only see job shares for their company
        const offeredShares = await storage.getJobSharesOfferedByCompany(user.companyId);
        const receivedShares = await storage.getJobSharesReceivedByCompany(user.companyId);
        
        // Combine and deduplicate
        const allShares = [...offeredShares, ...receivedShares];
        const uniqueShares = allShares.filter((share, index, self) =>
          index === self.findIndex((s) => s.id === share.id)
        );
        jobShares = uniqueShares;
      }

      res.json(jobShares);
    } catch (error: any) {
      console.error("Error fetching job shares:", error);
      res.status(500).json({ message: error.message || "Failed to fetch job shares" });
    }
  });

  app.get('/api/job-shares/offered', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const jobShares = await storage.getJobSharesOfferedByCompany(user.companyId);
      res.json(jobShares);
    } catch (error: any) {
      console.error("Error fetching offered job shares:", error);
      res.status(500).json({ message: error.message || "Failed to fetch offered job shares" });
    }
  });

  app.get('/api/job-shares/received', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const jobShares = await storage.getJobSharesReceivedByCompany(user.companyId);
      res.json(jobShares);
    } catch (error: any) {
      console.error("Error fetching received job shares:", error);
      res.status(500).json({ message: error.message || "Failed to fetch received job shares" });
    }
  });

  app.get('/api/job-shares/archived/offered', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const shares = await storage.getArchivedJobSharesOfferedByCompany(user.companyId);
      res.json(shares);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch archived offered job shares" });
    }
  });

  app.get('/api/job-shares/archived/received', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const shares = await storage.getArchivedJobSharesReceivedByCompany(user.companyId);
      res.json(shares);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch archived received job shares" });
    }
  });

  app.get('/api/company-employees', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const allUsers = await storage.getAllUsers();
      const companyId = user.companyId;
      const employees = allUsers
        .filter(u => u.companyId === companyId)
        .map(u => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          email: u.email || '',
          role: u.role,
          fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username,
        }));
      res.json(employees);
    } catch (error: any) {
      console.error("Error fetching company employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get('/api/job-shares/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const jobShare = await storage.getJobShare(id);
      
      if (!jobShare) {
        return res.status(404).json({ message: "Job share not found" });
      }

      // Multi-tenant authorization: only super admins or companies involved can view
      if (user.role !== 'super_admin') {
        if (jobShare.fromCompanyId !== user.companyId && jobShare.toCompanyId !== user.companyId) {
          return res.status(403).json({ message: "Forbidden - You can only view job shares involving your company" });
        }
      }

      res.json(jobShare);
    } catch (error: any) {
      console.error("Error fetching job share:", error);
      res.status(500).json({ message: error.message || "Failed to fetch job share" });
    }
  });

  app.post('/api/job-shares', isAuthenticated, isAdmin, requireActiveTrial, async (req: any, res) => {
    try {
      const user = req.user;
      
      if (!req.body.toCompanyId || req.body.toCompanyId.trim() === '') {
        return res.status(400).json({ message: "Target company is required" });
      }
      
      if (!req.body.siteId || req.body.siteId.trim() === '') {
        return res.status(400).json({ message: "Site is required" });
      }
      
      if (req.body.toCompanyId === user.companyId) {
        return res.status(400).json({ message: "Cannot share jobs with your own company" });
      }

      const positions = req.body.positions;
      if (!positions || !Array.isArray(positions) || positions.length === 0) {
        return res.status(400).json({ message: "At least one position is required" });
      }

      const validRoles = [...JOB_SHARE_ROLES, 'guard'] as string[];
      for (const pos of positions) {
        if (!pos.role || !validRoles.includes(pos.role)) {
          return res.status(400).json({ message: `Invalid role: ${pos.role}. Valid roles: ${JOB_SHARE_ROLES.join(', ')}` });
        }
        if (!pos.count || Number(pos.count) < 1) {
          return res.status(400).json({ message: "Each position must have a count of at least 1" });
        }
        if (!pos.hourlyRate || parseFloat(pos.hourlyRate) < 0) {
          return res.status(400).json({ message: "Each position must have a valid hourly rate" });
        }
      }

      const sanitizedPositions = positions.map((p: any) => ({
        role: p.role === 'guard' ? 'sia' : p.role,
        count: Number(p.count),
        hourlyRate: String(p.hourlyRate),
      }));

      const totalJobs = sanitizedPositions.reduce((sum: number, p: any) => sum + p.count, 0);
      
      const jobShareData: any = {
        toCompanyId: req.body.toCompanyId,
        siteId: req.body.siteId,
        fromCompanyId: user.companyId,
        createdBy: user.id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        positions: sanitizedPositions,
        requirements: req.body.requirements || null,
        numberOfJobs: String(totalJobs),
        workingRole: sanitizedPositions[0].role,
        hourlyRate: sanitizedPositions[0].hourlyRate,
      };

      if (req.body.responseDeadline) {
        jobShareData.responseDeadline = new Date(req.body.responseDeadline);
      }

      const jobShare = await storage.createJobShare(jobShareData);

      // Non-blocking email to receiving company — errors here must not fail the API response
      (async () => {
        try {
          const toCompany = await storage.getCompany(req.body.toCompanyId);
          if (!toCompany?.email) {
            console.warn(`[New Job Share Email] No email for company ${req.body.toCompanyId}, skipping notification`);
            return;
          }
          if (req.body.toCompanyId === user.companyId) {
            console.warn(`[New Job Share Email] fromCompanyId === toCompanyId, skipping notification`);
            return;
          }
          if (totalJobs === 0) {
            console.warn(`[New Job Share Email] Zero jobs in share, skipping notification`);
            return;
          }
          const fromCompany = await storage.getCompany(user.companyId);
          const fromName = fromCompany?.name || 'A partner company';
          // Derive the URL from the live request — works correctly in both dev and production
          const appUrl = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/login`;
          await sendNewJobShareEmail(toCompany.email, fromName, totalJobs, appUrl);
        } catch (emailErr: any) {
          console.error('[New Job Share Email] Failed to send notification:', emailErr.message);
        }
      })();

      res.status(201).json(jobShare);
    } catch (error: any) {
      console.error("Error creating job share:", error);
      res.status(400).json({ message: error.message || "Failed to create job share" });
    }
  });

  app.patch('/api/job-shares/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user = req.user;
      
      const jobShare = await storage.getJobShare(id);
      if (!jobShare) {
        return res.status(404).json({ message: "Job share not found" });
      }
      
      if (user.role !== 'super_admin') {
        if (jobShare.fromCompanyId !== user.companyId && jobShare.toCompanyId !== user.companyId) {
          return res.status(403).json({ message: "Forbidden - You can only modify job shares involving your company" });
        }
      }

      let sanitizedUpdates: any = {};

      if (updates.status && ['accepted', 'rejected', 'cancelled', 'withdrawn'].includes(updates.status)) {
        sanitizedUpdates.status = updates.status;
        sanitizedUpdates.reviewedBy = req.user.id;
        sanitizedUpdates.reviewedAt = new Date();
        if (updates.reviewNotes) sanitizedUpdates.reviewNotes = updates.reviewNotes;

        if (updates.status === 'withdrawn') {
          if (jobShare.status !== 'accepted') {
            return res.status(400).json({ message: "Can only withdraw from accepted job shares" });
          }
          if (user.role !== 'super_admin' && jobShare.toCompanyId !== user.companyId) {
            return res.status(403).json({ message: "Only the accepting company can withdraw from a job share" });
          }
          sanitizedUpdates.assignedWorkers = [];
          sanitizedUpdates.acceptedPositions = [];

          try {
            const existingShifts = await storage.getAllScheduledShifts();
            const jobShareShifts = existingShifts.filter((s: any) => s.jobShareId === id);
            const futureShifts = jobShareShifts.filter((s: any) => {
              const shiftStart = new Date(s.startTime);
              return shiftStart > new Date();
            });
            for (const shift of futureShifts) {
              await storage.deleteScheduledShift(shift.id);
            }
            console.log(`Job share ${id} withdrawn: ${futureShifts.length} future shifts deleted`);
          } catch (shiftError) {
            console.error("Error deleting shifts on withdrawal:", shiftError);
          }
        }

        if (updates.status === 'cancelled') {
          if (user.role !== 'super_admin' && jobShare.fromCompanyId !== user.companyId) {
            return res.status(403).json({ message: "Only the creator company can cancel a job share" });
          }
          if (jobShare.status !== 'pending' && jobShare.status !== 'accepted') {
            return res.status(400).json({ message: "Can only cancel pending or accepted job shares" });
          }
          sanitizedUpdates.assignedWorkers = [];
          sanitizedUpdates.acceptedPositions = [];

          if (jobShare.status === 'accepted') {
            try {
              const existingShifts = await storage.getAllScheduledShifts();
              const jobShareShifts = existingShifts.filter((s: any) => s.jobShareId === id);
              const futureShifts = jobShareShifts.filter((s: any) => {
                const shiftStart = new Date(s.startTime);
                return shiftStart > new Date();
              });
              for (const shift of futureShifts) {
                await storage.deleteScheduledShift(shift.id);
              }
              console.log(`Job share ${id} cancelled by creator: ${futureShifts.length} future shifts deleted`);
            } catch (shiftError) {
              console.error("Error deleting shifts on cancellation:", shiftError);
            }
          }
        }

        if (updates.status === 'rejected' && jobShare.status === 'accepted') {
          if (user.role !== 'super_admin' && jobShare.toCompanyId !== user.companyId) {
            return res.status(403).json({ message: "Only the accepting company can reject an accepted job share" });
          }
          sanitizedUpdates.assignedWorkers = [];
          sanitizedUpdates.acceptedPositions = [];

          try {
            const existingShifts = await storage.getAllScheduledShifts();
            const jobShareShifts = existingShifts.filter((s: any) => s.jobShareId === id);
            const futureShifts = jobShareShifts.filter((s: any) => {
              const shiftStart = new Date(s.startTime);
              return shiftStart > new Date();
            });
            for (const shift of futureShifts) {
              await storage.deleteScheduledShift(shift.id);
            }
            console.log(`Job share ${id} rejected after acceptance: ${futureShifts.length} future shifts deleted`);
          } catch (shiftError) {
            console.error("Error deleting shifts on rejection:", shiftError);
          }
        }

        if (updates.status === 'accepted') {
          sanitizedUpdates.acceptedAt = new Date();
          if (updates.assignedWorkers && Array.isArray(updates.assignedWorkers)) {
            const validRoles = JOB_SHARE_ROLES as readonly string[];
            const cleanWorkers = updates.assignedWorkers
              .filter((w: any) => w.name && w.name.trim())
              .map((w: any) => ({
                name: w.name.trim(),
                role: validRoles.includes(w.role) ? w.role : 'sia',
                phone: w.phone?.trim() || undefined,
                email: w.email?.trim() || undefined,
                siaLicense: w.siaLicense?.trim() || undefined,
              }));
            if (cleanWorkers.length > 0) {
              sanitizedUpdates.assignedWorkers = cleanWorkers;
            }
          }
          if (updates.acceptedPositions && Array.isArray(updates.acceptedPositions) && updates.acceptedPositions.length > 0) {
            const acceptedPositions = updates.acceptedPositions.map((p: any) => ({
              role: p.role === 'guard' ? 'sia' : p.role,
              count: Number(p.count),
              hourlyRate: String(p.hourlyRate),
            }));
            sanitizedUpdates.acceptedPositions = acceptedPositions;
            const totalAccepted = acceptedPositions.reduce((sum: number, p: any) => sum + p.count, 0);
            sanitizedUpdates.numberOfJobs = String(totalAccepted);
          }
        }
      } else if (!updates.status && updates.assignedWorkers && Array.isArray(updates.assignedWorkers)) {
        if (jobShare.status !== 'accepted') {
          return res.status(400).json({ message: "Can only edit workers on accepted job shares" });
        }
        if (user.role !== 'super_admin' && jobShare.toCompanyId !== user.companyId) {
          return res.status(403).json({ message: "Only the accepting company can edit assigned workers" });
        }
        const validRoles = [...JOB_SHARE_ROLES, 'guard'] as string[];
        const cleanWorkers = updates.assignedWorkers
          .filter((w: any) => w.name && w.name.trim())
          .map((w: any) => ({
            name: w.name.trim(),
            role: validRoles.includes(w.role) ? (w.role === 'guard' ? 'sia' : w.role) : 'sia',
            phone: w.phone?.trim() || undefined,
            email: w.email?.trim() || undefined,
            siaLicense: w.siaLicense?.trim() || undefined,
          }));
        sanitizedUpdates.assignedWorkers = cleanWorkers;
      } else if (updates.positions || updates.siteId || updates.startDate || updates.endDate || updates.requirements !== undefined) {
        if (user.role !== 'super_admin' && jobShare.fromCompanyId !== user.companyId) {
          return res.status(403).json({ message: "Only the creator company can edit job share details" });
        }
        if (jobShare.status !== 'pending' && jobShare.status !== 'accepted') {
          return res.status(400).json({ message: "Can only edit pending or accepted job shares" });
        }

        if (updates.positions && Array.isArray(updates.positions) && updates.positions.length > 0) {
          const validRoles = [...JOB_SHARE_ROLES, 'guard'] as string[];
          for (const pos of updates.positions) {
            if (!pos.role || !validRoles.includes(pos.role)) {
              return res.status(400).json({ message: `Invalid role: ${pos.role}` });
            }
          }
          const cleanPositions = updates.positions.map((p: any) => ({
            role: p.role === 'guard' ? 'sia' : p.role,
            count: Number(p.count),
            hourlyRate: String(p.hourlyRate),
          }));
          sanitizedUpdates.positions = cleanPositions;
          const totalJobs = cleanPositions.reduce((sum: number, p: any) => sum + p.count, 0);
          sanitizedUpdates.numberOfJobs = String(totalJobs);
          sanitizedUpdates.workingRole = cleanPositions[0].role;
          sanitizedUpdates.hourlyRate = cleanPositions[0].hourlyRate;
        }
        if (updates.siteId) sanitizedUpdates.siteId = updates.siteId;
        if (updates.startDate) sanitizedUpdates.startDate = new Date(updates.startDate);
        if (updates.endDate) sanitizedUpdates.endDate = new Date(updates.endDate);
        if (updates.requirements !== undefined) sanitizedUpdates.requirements = updates.requirements || null;
        if (updates.responseDeadline !== undefined) {
          sanitizedUpdates.responseDeadline = updates.responseDeadline ? new Date(updates.responseDeadline) : null;
        }
      }

      const updatedJobShare = await storage.updateJobShare(id, sanitizedUpdates);

      if (sanitizedUpdates.status && ['accepted', 'rejected', 'withdrawn', 'cancelled'].includes(sanitizedUpdates.status)) {
        (async () => {
          try {
            const fromCompany = await storage.getCompany(jobShare.fromCompanyId);
            const toCompany = await storage.getCompany(jobShare.toCompanyId);
            const site = jobShare.siteId ? await storage.getSite(jobShare.siteId) : null;

            const posSource = (sanitizedUpdates.acceptedPositions && sanitizedUpdates.acceptedPositions.length > 0)
              ? sanitizedUpdates.acceptedPositions
              : (jobShare.positions as any[] | null);
            const positionsText = posSource 
              ? posSource.map((p: any) => `${p.count} x ${p.role}`).join(', ')
              : `${jobShare.numberOfJobs} x ${jobShare.workingRole}`;

            const isCancelledByCreator = sanitizedUpdates.status === 'cancelled' && 
              (user.role === 'super_admin' || jobShare.fromCompanyId === user.companyId);

            if (isCancelledByCreator) {
              const adminsOfAcceptor = (await storage.getAllUsers()).filter(
                u => u.companyId === jobShare.toCompanyId && (u.role === 'admin' || u.role === 'super_admin') && u.email
              );
              for (const admin of adminsOfAcceptor) {
                if (admin.email) {
                  sendJobShareNotificationEmail({
                    toEmail: admin.email,
                    fromCompanyName: fromCompany?.name || 'Unknown',
                    toCompanyName: toCompany?.name || 'Unknown',
                    siteName: site?.name || 'Unknown Site',
                    status: 'cancelled',
                    startDate: new Date(jobShare.startDate).toLocaleDateString('en-GB'),
                    endDate: new Date(jobShare.endDate).toLocaleDateString('en-GB'),
                    positions: positionsText,
                    notes: updates.reviewNotes || `Job share cancelled by ${fromCompany?.name || 'the offering company'}`,
                  }).catch(err => console.error(`[Job Share Email] Failed to notify ${admin.email}:`, err.message));
                }
              }
            } else {
              const adminsOfCreator = (await storage.getAllUsers()).filter(
                u => u.companyId === jobShare.fromCompanyId && (u.role === 'admin' || u.role === 'super_admin') && u.email
              );
              for (const admin of adminsOfCreator) {
                if (admin.email) {
                  sendJobShareNotificationEmail({
                    toEmail: admin.email,
                    fromCompanyName: fromCompany?.name || 'Unknown',
                    toCompanyName: toCompany?.name || 'Unknown',
                    siteName: site?.name || 'Unknown Site',
                    status: sanitizedUpdates.status,
                    startDate: new Date(jobShare.startDate).toLocaleDateString('en-GB'),
                    endDate: new Date(jobShare.endDate).toLocaleDateString('en-GB'),
                    positions: positionsText,
                    notes: updates.reviewNotes || undefined,
                  }).catch(err => console.error(`[Job Share Email] Failed to notify ${admin.email}:`, err.message));
                }
              }
            }
          } catch (err: any) {
            console.error('[Job Share Email] Error preparing notifications:', err.message);
          }
        })();
      }

      if (!sanitizedUpdates.status && jobShare.status === 'accepted' && jobShare.toCompanyId &&
          (sanitizedUpdates.positions || sanitizedUpdates.siteId || sanitizedUpdates.startDate || sanitizedUpdates.endDate || sanitizedUpdates.requirements !== undefined)) {
        (async () => {
          try {
            const fromCompany = await storage.getCompany(jobShare.fromCompanyId);
            const toCompany = await storage.getCompany(jobShare.toCompanyId);
            const site = sanitizedUpdates.siteId 
              ? await storage.getSite(sanitizedUpdates.siteId) 
              : (jobShare.siteId ? await storage.getSite(jobShare.siteId) : null);

            const posSource = sanitizedUpdates.positions || (jobShare.positions as any[] | null);
            const positionsText = posSource 
              ? posSource.map((p: any) => `${p.count} x ${p.role}`).join(', ')
              : `${jobShare.numberOfJobs} x ${jobShare.workingRole}`;

            const adminsOfAcceptor = (await storage.getAllUsers()).filter(
              u => u.companyId === jobShare.toCompanyId && (u.role === 'admin' || u.role === 'super_admin') && u.email
            );
            for (const admin of adminsOfAcceptor) {
              if (admin.email) {
                sendJobShareNotificationEmail({
                  toEmail: admin.email,
                  fromCompanyName: fromCompany?.name || 'Unknown',
                  toCompanyName: toCompany?.name || 'Unknown',
                  siteName: site?.name || 'Unknown Site',
                  status: 'edited',
                  startDate: new Date(sanitizedUpdates.startDate || jobShare.startDate).toLocaleDateString('en-GB'),
                  endDate: new Date(sanitizedUpdates.endDate || jobShare.endDate).toLocaleDateString('en-GB'),
                  positions: positionsText,
                  notes: `Job share details have been updated by ${fromCompany?.name || 'the offering company'}`,
                }).catch(err => console.error(`[Job Share Email] Failed to notify ${admin.email}:`, err.message));
              }
            }
          } catch (err: any) {
            console.error('[Job Share Email] Error preparing edit notifications:', err.message);
          }
        })();
      }

      const roleToJobTitle: Record<string, string> = {
        sia: 'SIA Guard', guard: 'SIA Guard', steward: 'Steward',
        supervisor: 'Supervisor', response: 'Response Officer',
        dog_handler: 'Dog Handler', call_out: 'Call Out',
      };

      const findMatchingUser = (worker: any, companyUsers: any[]) => {
        const workerNameLower = worker.name.toLowerCase().trim();

        if (worker.email) {
          const emailMatch = companyUsers.find(u => u.email?.toLowerCase() === worker.email.toLowerCase());
          if (emailMatch) return emailMatch;
        }

        return companyUsers.find(u => {
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

      const createShiftsForWorkers = async (workers: any[], companyUsers: any[], jsData: any, jsId: string) => {
        const startDate = new Date(jsData.startDate);
        const endDate = new Date(jsData.endDate);

        const startHour = startDate.getHours() || 8;
        const startMin = startDate.getMinutes() || 0;
        const endHour = endDate.getHours() || 20;
        const endMin = endDate.getMinutes() || 0;

        const shiftsCreated: string[] = [];
        const unmatchedWorkers: string[] = [];

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
                siteId: jsData.siteId,
                jobTitle,
                startTime: shiftStart,
                endTime: shiftEnd,
                recurrence: 'none',
                isActive: true,
                notes: `Auto-created from job share`,
                jobShareId: jsId,
              });
              shiftsCreated.push(`${worker.name} - ${currentDate.toISOString().split('T')[0]}`);

              currentDate.setDate(currentDate.getDate() + 1);
            }
          } else {
            unmatchedWorkers.push(worker.name);
          }
        }
        return { shiftsCreated, unmatchedWorkers };
      };

      if (sanitizedUpdates.status === 'accepted' && sanitizedUpdates.assignedWorkers?.length > 0) {
        try {
          const allUsers = await storage.getAllUsers();
          const companyUsers = allUsers.filter(u => u.companyId === jobShare.toCompanyId);

          const { shiftsCreated, unmatchedWorkers } = await createShiftsForWorkers(
            sanitizedUpdates.assignedWorkers, companyUsers, jobShare, updatedJobShare.id
          );

          console.log(`Job share ${id} accepted: ${shiftsCreated.length} shifts created`);
          if (unmatchedWorkers.length > 0) {
            console.log(`Unmatched workers (no user account found): ${unmatchedWorkers.join(', ')}`);
          }

          const response: any = { ...updatedJobShare, shiftsCreated: shiftsCreated.length };
          if (unmatchedWorkers.length > 0) {
            response.unmatchedWorkers = unmatchedWorkers;
          }
          return res.json(response);
        } catch (shiftError) {
          console.error("Error auto-creating shifts from job share:", shiftError);
        }
      }

      if (sanitizedUpdates.assignedWorkers?.length > 0 && !sanitizedUpdates.status && jobShare.status === 'accepted') {
        try {
          const existingShifts = await storage.getAllScheduledShifts();
          const jobShareShifts = existingShifts.filter((s: any) => s.jobShareId === id);

          const futureShifts = jobShareShifts.filter((s: any) => {
            const hasCheckIn = s.checkIn && s.checkIn.id;
            return !hasCheckIn;
          });
          for (const shift of futureShifts) {
            await storage.deleteScheduledShift(shift.id);
          }

          const allUsers = await storage.getAllUsers();
          const companyUsers = allUsers.filter(u => u.companyId === jobShare.toCompanyId);

          const { shiftsCreated, unmatchedWorkers } = await createShiftsForWorkers(
            sanitizedUpdates.assignedWorkers, companyUsers, jobShare, updatedJobShare.id
          );

          const response: any = { ...updatedJobShare, shiftsCreated: shiftsCreated.length };
          if (unmatchedWorkers.length > 0) {
            response.unmatchedWorkers = unmatchedWorkers;
          }
          return res.json(response);
        } catch (shiftError) {
          console.error("Error re-syncing shifts from job share:", shiftError);
        }
      }

      res.json(updatedJobShare);
    } catch (error: any) {
      console.error("Error updating job share:", error);
      res.status(400).json({ message: error.message || "Failed to update job share" });
    }
  });

  app.post('/api/job-shares/backfill-shifts', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      const allJobShares = user.role === 'super_admin'
        ? await storage.getAllJobShares()
        : [
            ...await storage.getJobSharesReceivedByCompany(user.companyId),
          ];

      const acceptedWithWorkers = allJobShares.filter(
        js => js.status === 'accepted' && js.assignedWorkers && (js.assignedWorkers as any[]).length > 0
      );

      const existingShifts = await storage.getAllScheduledShifts();
      const allUsers = await storage.getAllUsers();

      const roleToJobTitle: Record<string, string> = {
        sia: 'SIA Guard', guard: 'SIA Guard', steward: 'Steward',
        supervisor: 'Supervisor', response: 'Response Officer',
        dog_handler: 'Dog Handler', call_out: 'Call Out',
      };

      const findMatchingUser = (worker: any, companyUsers: any[]) => {
        const workerNameLower = worker.name.toLowerCase().trim();
        if (worker.email) {
          const emailMatch = companyUsers.find(u => u.email?.toLowerCase() === worker.email.toLowerCase());
          if (emailMatch) return emailMatch;
        }
        return companyUsers.find(u => {
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
      let totalSkipped = 0;

      for (const js of acceptedWithWorkers) {
        const hasExistingShifts = existingShifts.some((s: any) => s.jobShareId === js.id);
        if (hasExistingShifts) {
          totalSkipped++;
          continue;
        }

        const companyUsers = allUsers.filter(u => u.companyId === js.toCompanyId);
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

      res.json({
        message: `Backfill complete`,
        totalJobSharesProcessed: acceptedWithWorkers.length,
        totalShiftsCreated: totalCreated,
        totalSkipped,
      });
    } catch (error: any) {
      console.error("Error backfilling job share shifts:", error);
      res.status(500).json({ message: "Failed to backfill shifts" });
    }
  });

  app.delete('/api/job-shares/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const jobShare = await storage.getJobShare(id);
      if (!jobShare) {
        return res.status(404).json({ message: "Job share not found" });
      }

      if (user.role !== 'super_admin' && jobShare.fromCompanyId !== user.companyId) {
        return res.status(403).json({ message: "Only the creator company can delete job shares" });
      }

      if (jobShare.status === 'accepted') {
        try {
          const existingShifts = await storage.getAllScheduledShifts();
          const jobShareShifts = existingShifts.filter((s: any) => s.jobShareId === id);
          const futureShifts = jobShareShifts.filter((s: any) => {
            const shiftStart = new Date(s.startTime);
            return shiftStart > new Date();
          });
          for (const shift of futureShifts) {
            await storage.deleteScheduledShift(shift.id);
          }
          console.log(`Job share ${id} deleted: ${futureShifts.length} future shifts removed`);
        } catch (shiftError) {
          console.error("Error deleting shifts on job share deletion:", shiftError);
        }
      }

      if (jobShare.toCompanyId) {
        (async () => {
          try {
            const fromCompany = await storage.getCompany(jobShare.fromCompanyId);
            const toCompany = await storage.getCompany(jobShare.toCompanyId);
            const site = jobShare.siteId ? await storage.getSite(jobShare.siteId) : null;
            const posSource = jobShare.positions as any[] | null;
            const positionsText = posSource 
              ? posSource.map((p: any) => `${p.count} x ${p.role}`).join(', ')
              : `${jobShare.numberOfJobs} x ${jobShare.workingRole}`;

            const adminsOfAcceptor = (await storage.getAllUsers()).filter(
              u => u.companyId === jobShare.toCompanyId && (u.role === 'admin' || u.role === 'super_admin') && u.email
            );
            for (const admin of adminsOfAcceptor) {
              if (admin.email) {
                sendJobShareNotificationEmail({
                  toEmail: admin.email,
                  fromCompanyName: fromCompany?.name || 'Unknown',
                  toCompanyName: toCompany?.name || 'Unknown',
                  siteName: site?.name || 'Unknown Site',
                  status: 'deleted',
                  startDate: new Date(jobShare.startDate).toLocaleDateString('en-GB'),
                  endDate: new Date(jobShare.endDate).toLocaleDateString('en-GB'),
                  positions: positionsText,
                  notes: `Job share has been removed by ${fromCompany?.name || 'the offering company'}`,
                }).catch(err => console.error(`[Job Share Email] Failed to notify ${admin.email}:`, err.message));
              }
            }
          } catch (err: any) {
            console.error('[Job Share Email] Error preparing delete notifications:', err.message);
          }
        })();
      }

      await storage.deleteJobShare(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting job share:", error);
      res.status(400).json({ message: error.message || "Failed to delete job share" });
    }
  });

  // Job Share Messages Routes
  app.get('/api/job-shares/:id/messages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const jobShare = await storage.getJobShare(id);
      if (!jobShare) {
        return res.status(404).json({ message: "Job share not found" });
      }

      if (user.role !== 'super_admin' && jobShare.fromCompanyId !== user.companyId && jobShare.toCompanyId !== user.companyId) {
        return res.status(403).json({ message: "Only involved companies can view messages" });
      }

      const messages = await storage.getJobShareMessages(id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching job share messages:", error);
      res.status(500).json({ message: error.message || "Failed to fetch messages" });
    }
  });

  app.post('/api/job-shares/:id/messages', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }

      const jobShare = await storage.getJobShare(id);
      if (!jobShare) {
        return res.status(404).json({ message: "Job share not found" });
      }

      if (user.role !== 'super_admin' && jobShare.fromCompanyId !== user.companyId && jobShare.toCompanyId !== user.companyId) {
        return res.status(403).json({ message: "Only involved companies can send messages" });
      }

      const msg = await storage.createJobShareMessage({
        jobShareId: id,
        senderCompanyId: user.companyId,
        senderUserId: user.id,
        message: message.trim(),
      });

      res.status(201).json(msg);
    } catch (error: any) {
      console.error("Error creating job share message:", error);
      res.status(500).json({ message: error.message || "Failed to send message" });
    }
  });

  // Partner Performance Metrics Route
  app.get('/api/partnerships/:id/metrics', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const partnership = await storage.getPartnership(id);
      if (!partnership) {
        return res.status(404).json({ message: "Partnership not found" });
      }

      if (user.role !== 'super_admin' && partnership.fromCompanyId !== user.companyId && partnership.toCompanyId !== user.companyId) {
        return res.status(403).json({ message: "Only involved companies can view metrics" });
      }

      const allShares = await storage.getAllJobShares();
      const partnerShares = allShares.filter(s =>
        (s.fromCompanyId === partnership.fromCompanyId && s.toCompanyId === partnership.toCompanyId) ||
        (s.fromCompanyId === partnership.toCompanyId && s.toCompanyId === partnership.fromCompanyId)
      );

      const totalShares = partnerShares.length;
      const acceptedShares = partnerShares.filter(s => s.status === 'accepted');
      const rejectedShares = partnerShares.filter(s => s.status === 'rejected');
      const acceptanceRate = totalShares > 0 ? Math.round((acceptedShares.length / totalShares) * 100) : 0;

      let avgResponseTimeHours: number | null = null;
      const sharesWithResponseTime = acceptedShares.filter(s => s.acceptedAt && s.createdAt);
      if (sharesWithResponseTime.length > 0) {
        const totalMs = sharesWithResponseTime.reduce((sum, s) => {
          const created = new Date(s.createdAt!).getTime();
          const accepted = new Date(s.acceptedAt!).getTime();
          return sum + (accepted - created);
        }, 0);
        avgResponseTimeHours = Math.round((totalMs / sharesWithResponseTime.length) / (1000 * 60 * 60) * 10) / 10;
      }

      res.json({
        totalShares,
        accepted: acceptedShares.length,
        rejected: rejectedShares.length,
        acceptanceRate,
        avgResponseTimeHours,
      });
    } catch (error: any) {
      console.error("Error fetching partnership metrics:", error);
      res.status(500).json({ message: error.message || "Failed to fetch metrics" });
    }
  });

  // Trial Management Routes (Super Admin only)
  app.post('/api/companies/:id/trial', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { trialDays } = req.body;

      if (!trialDays || trialDays <= 0) {
        return res.status(400).json({ message: "Trial days must be a positive number" });
      }

      const company = await storage.setCompanyTrial(id, trialDays);
      res.json(company);
    } catch (error: any) {
      console.error("Error setting company trial:", error);
      res.status(400).json({ message: error.message || "Failed to set company trial" });
    }
  });

  app.post('/api/companies/:id/trial/extend', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { additionalDays } = req.body;

      if (!additionalDays || additionalDays <= 0) {
        return res.status(400).json({ message: "Additional days must be a positive number" });
      }

      const company = await storage.extendCompanyTrial(id, additionalDays);
      res.json(company);
    } catch (error: any) {
      console.error("Error extending company trial:", error);
      res.status(400).json({ message: error.message || "Failed to extend company trial" });
    }
  });

  app.get('/api/companies/:id/trial/status', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      // Multi-tenant check: users can only check their own company's trial status
      // unless they are super admin
      if (user.role !== 'super_admin' && user.companyId !== id) {
        return res.status(403).json({ message: "Forbidden - You can only check your own company's trial status" });
      }

      const trialStatus = await storage.checkTrialStatus(id);
      res.json(trialStatus);
    } catch (error: any) {
      console.error("Error checking trial status:", error);
      res.status(400).json({ message: error.message || "Failed to check trial status" });
    }
  });

  app.post('/api/companies/:id/trial/convert-to-full', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;

      const [company] = await db
        .update(companies)
        .set({
          trialStatus: 'full',
          trialEndDate: null,
          subscriptionStatus: 'active', // Activate subscription when converting to full
          billingStartDate: new Date(), // Reset billing start date
          updatedAt: new Date(),
        })
        .where(eq(companies.id, id))
        .returning();

      res.json(company);
    } catch (error: any) {
      console.error("Error converting company to full:", error);
      res.status(400).json({ message: error.message || "Failed to convert company to full" });
    }
  });

  // Super Admin Client Management Routes
  // Super Admin User Management - Get all users across all companies
  app.get('/api/super-admin/all-users', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allCompanies = await storage.getAllCompanies();
      
      // Create company lookup map
      const companyMap = new Map(allCompanies.map(c => [c.id, c.name]));
      
      // Role priority for determining highest priority role
      const rolePriority: Record<string, number> = {
        'super_admin': 5,
        'admin': 4,
        'supervisor': 3,
        'steward': 2,
        'guard': 1
      };
      
      // Enrich users with their roles and company name
      const usersWithDetails = await Promise.all(
        allUsers.map(async (user) => {
          const roles = await storage.getUserRoles(user.id);
          
          // Determine expected role (highest priority from userRoles)
          let expectedRole = user.role;
          if (roles.length > 0) {
            const sortedRoles = [...roles].sort((a, b) => (rolePriority[b] || 0) - (rolePriority[a] || 0));
            expectedRole = sortedRoles[0];
          }
          
          // Check if there's a role mismatch
          const hasRoleMismatch = roles.length > 0 && user.role !== expectedRole;
          
          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            role: user.role, // Legacy role field (what's stored in users table)
            roles: roles.length > 0 ? roles : [user.role],
            expectedRole, // What the role SHOULD be based on userRoles
            hasRoleMismatch, // Flag for UI to highlight
            companyId: user.companyId,
            companyName: user.companyId ? companyMap.get(user.companyId) : null,
            isActive: true, // All users in the system are considered active (no isActive field in schema)
            createdAt: user.createdAt,
          };
        })
      );
      
      res.json(usersWithDetails);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Super Admin - Get companies list for filtering
  app.get('/api/super-admin/companies-list', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      res.json(allCompanies.map(c => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error("Error fetching companies list:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  // Super Admin - Update user roles
  app.put('/api/super-admin/users/:id/roles', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { z } = await import("zod");
      
      // Validate request body with Zod
      const VALID_ROLES_ARRAY = ['guard', 'steward', 'supervisor', 'admin', 'super_admin'] as const;
      const rolesSchema = z.object({
        roles: z.array(z.enum(VALID_ROLES_ARRAY)).min(1, "At least one role is required")
      });
      
      const validationResult = rolesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: validationResult.error.errors[0].message });
      }
      
      const { roles } = validationResult.data;
      
      // Role priority order (highest privilege first) for deterministic primary role selection
      const rolePriority: Record<string, number> = {
        'super_admin': 5,
        'admin': 4,
        'supervisor': 3,
        'steward': 2,
        'guard': 1
      };
      
      // Sort roles by priority (highest first) and use the highest as primary role
      const sortedRoles = [...roles].sort((a, b) => rolePriority[b] - rolePriority[a]);
      const primaryRole = sortedRoles[0];
      
      // Update the user's roles in the user_roles table
      await storage.setUserRoles(id, roles, req.user.id);
      
      // Also update the legacy role field to the highest priority role
      await storage.updateUser(id, { role: primaryRole });
      
      res.json({ message: "Roles updated successfully", roles, primaryRole });
    } catch (error: any) {
      console.error("Error updating user roles:", error);
      res.status(500).json({ message: error.message || "Failed to update user roles" });
    }
  });

  // Super Admin - Reset user password
  app.post('/api/super-admin/users/:id/reset-password', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { z } = await import("zod");
      const { hashPassword } = await import("./auth");
      
      const passwordSchema = z.object({
        password: z.string().min(6, "Password must be at least 6 characters")
      });
      
      const validationResult = passwordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: validationResult.error.errors[0].message });
      }
      
      const { password } = validationResult.data;
      const hashedPassword = await hashPassword(password);
      
      await storage.updateUser(id, { password: hashedPassword });
      
      res.json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Error resetting user password:", error);
      res.status(500).json({ message: error.message || "Failed to reset password" });
    }
  });

  // Super Admin - Fix role mismatch (sync legacy role field with userRoles)
  app.post('/api/super-admin/users/:id/fix-role', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get user's roles from userRoles table
      const userRoles = await storage.getUserRoles(id);
      
      if (userRoles.length === 0) {
        return res.status(400).json({ message: "User has no roles in userRoles table" });
      }
      
      // Role priority for determining highest priority role
      const rolePriority: Record<string, number> = {
        'super_admin': 5,
        'admin': 4,
        'supervisor': 3,
        'steward': 2,
        'guard': 1
      };
      
      // Get the highest priority role
      const sortedRoles = [...userRoles].sort((a, b) => (rolePriority[b] || 0) - (rolePriority[a] || 0));
      const correctRole = sortedRoles[0];
      
      // Update the legacy role field
      await storage.updateUser(id, { role: correctRole });
      
      res.json({ 
        message: "Role fixed successfully", 
        previousRole: req.body.previousRole,
        newRole: correctRole 
      });
    } catch (error: any) {
      console.error("Error fixing user role:", error);
      res.status(500).json({ message: error.message || "Failed to fix role" });
    }
  });

  // Super Admin - Directly create a user for any company
  app.post('/api/super-admin/users', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { z } = await import("zod");
      const { hashPassword } = await import("./auth");

      const createUserSchema = z.object({
        username: z.string().min(1, "Username is required"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email("Invalid email").optional(),
        phone: z.string().optional(),
        role: z.enum(['guard', 'steward', 'supervisor', 'admin']),
        companyId: z.string().min(1, "Company is required"),
        jobTitle: z.string().optional(),
      });

      const validationResult = createUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: validationResult.error.errors[0].message });
      }

      const data = validationResult.data;

      // Check company exists
      const company = await storage.getCompany(data.companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Check username uniqueness within company
      const existingUser = await storage.getUserByUsername(data.username, data.companyId);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists in this company" });
      }

      const hashedPassword = await hashPassword(data.password);

      const user = await storage.createUser({
        username: data.username,
        password: hashedPassword,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        role: data.role,
        companyId: data.companyId,
        jobTitle: data.jobTitle || null,
      });

      // Remove password from response
      const { password, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: error.message || "Failed to create user" });
    }
  });

  // Super Admin Company Impersonation Routes
  // Only super admins can activate this; it lets them view admin data as a specific company
  app.post('/api/super-admin/impersonate/:companyId', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      (req.session as any).impersonatedCompanyId = companyId;
      (req.session as any).impersonatedCompanyName = company.name;
      res.json({ success: true, companyId, companyName: company.name });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(500).json({ message: "Failed to start company view" });
    }
  });

  app.delete('/api/super-admin/impersonate', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      delete (req.session as any).impersonatedCompanyId;
      delete (req.session as any).impersonatedCompanyName;
      res.json({ success: true });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to exit company view" });
    }
  });

  app.get('/api/super-admin/clients', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const allCompanies = await storage.getAllCompanies();
      
      // Enrich each company with trial status and duration info
      const clientsWithStatus = await Promise.all(
        allCompanies.map(async (company) => {
          const trialStatus = await storage.checkTrialStatus(company.id);
          
          // Calculate days since joined (using createdAt if available)
          const daysSinceJoined = company.createdAt 
            ? Math.floor((Date.now() - new Date(company.createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : undefined;
          
          return {
            ...company,
            trialStatus: trialStatus.status,
            daysRemaining: trialStatus.daysRemaining,
            daysSinceJoined,
          };
        })
      );
      
      res.json(clientsWithStatus);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.post('/api/companies/:id/block', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      // Set company to blocked
      const [company] = await db
        .update(companies)
        .set({
          isBlocked: true,
          blockReason: reason || null,
          blockedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companies.id, id))
        .returning();
      
      res.json(company);
    } catch (error: any) {
      console.error("Error blocking company:", error);
      res.status(400).json({ message: error.message || "Failed to block company" });
    }
  });

  app.post('/api/companies/:id/unblock', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Unblock company
      const [company] = await db
        .update(companies)
        .set({
          isBlocked: false,
          blockReason: null,
          blockedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, id))
        .returning();
      
      res.json(company);
    } catch (error: any) {
      console.error("Error unblocking company:", error);
      res.status(400).json({ message: error.message || "Failed to unblock company" });
    }
  });

  app.post('/api/super-admin/send-message', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { sendTrialInvitationEmail } = await import('./emailService');
      const { clientId, subject, body } = req.body;
      
      if (!clientId || !subject || !body) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get company details
      const company = await storage.getCompany(clientId);
      if (!company || !company.email) {
        return res.status(404).json({ message: "Company not found or no email address" });
      }
      
      // Send email using the email service
      await sendTrialInvitationEmail(company.email, subject, body);
      
      res.json({ message: "Message sent successfully" });
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });

  app.get('/api/super-admin/usage-reports', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { month, year } = req.query;
      
      // Default to current month if not specified
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth();
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      
      const allCompanies = await storage.getAllCompanies();
      
      // Calculate usage stats for each company
      const usageReports = await Promise.all(
        allCompanies.map(async (company) => {
          // Get all check-ins for this company in the target month
          const companyCheckIns = await db
            .select()
            .from(checkIns)
            .leftJoin(users, eq(checkIns.userId, users.id))
            .where(eq(users.companyId, company.id));
          
          // Filter check-ins by month/year
          const monthCheckIns = companyCheckIns.filter(({ check_ins: checkIn }) => {
            const checkInDate = new Date(checkIn.checkInTime);
            return checkInDate.getMonth() === targetMonth && checkInDate.getFullYear() === targetYear;
          });
          
          // Calculate total hours
          const totalHours = monthCheckIns.reduce((sum, { check_ins: checkIn }) => {
            if (checkIn.checkOutTime) {
              const hours = (new Date(checkIn.checkOutTime).getTime() - new Date(checkIn.checkInTime).getTime()) / (1000 * 60 * 60);
              return sum + hours;
            }
            return sum;
          }, 0);
          
          // Get active users count
          const activeUserIds = new Set(monthCheckIns.map(({ check_ins: checkIn }) => checkIn.userId));
          
          return {
            companyId: company.id,
            companyName: company.name,
            month: targetMonth + 1,
            year: targetYear,
            checkInsCount: monthCheckIns.length,
            totalHours: Math.round(totalHours * 10) / 10,
            activeUsers: activeUserIds.size,
          };
        })
      );
      
      res.json({
        month: targetMonth + 1,
        year: targetYear,
        reports: usageReports,
      });
    } catch (error) {
      console.error("Error generating usage reports:", error);
      res.status(500).json({ message: "Failed to generate usage reports" });
    }
  });

  // Trial Invitation Routes
  app.post('/api/super-admin/invite-trial', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { insertTrialInvitationSchema } = await import("@shared/schema");
      const { randomBytes } = await import("crypto");
      const { sendTrialInvitationEmail } = await import("./emailService");
      
      // Validate input
      const validatedData = insertTrialInvitationSchema.parse({
        ...req.body,
        invitedBy: req.user.id,
      });
      
      // Check if there's already a trial invitation for this email
      const existingInvitation = await storage.getTrialInvitationByEmail(validatedData.email);
      if (existingInvitation && (existingInvitation.status === 'pending' || existingInvitation.status === 'accepted')) {
        return res.status(400).json({ 
          message: `A trial invitation already exists for ${validatedData.email}. Super Admin authorization required for additional trials.` 
        });
      }
      
      // Block trial invites for any company that already exists (trial or full)
      if (validatedData.companyName) {
        const existingCompany = await storage.findCompanyByNameOrEmail(validatedData.companyName);
        if (existingCompany) {
          return res.status(400).json({ 
            message: `A company named "${existingCompany.name}" already exists (${existingCompany.companyId}). To add more users to it, use the regular invite flow from the admin dashboard instead.`,
            existingCompanyId: existingCompany.id,
            existingCompanyName: existingCompany.name,
          });
        }
      }
      
      // Generate unique token
      const token = randomBytes(32).toString("hex");
      
      // Set expiration (7 days from now)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      // Create trial invitation
      const invitation = await storage.createTrialInvitation({
        ...validatedData,
        token,
        expiresAt,
      });
      
      // Send email with registration link (catch errors to not fail the whole request)
      // Determine the correct base URL based on environment
      let baseUrl: string;
      if (process.env.REPLIT_DEPLOYMENT === '1' && process.env.REPLIT_DOMAINS) {
        // Production deployment - use the first domain from REPLIT_DOMAINS (the .replit.app URL)
        const domains = process.env.REPLIT_DOMAINS.split(',');
        baseUrl = `https://${domains[0]}`;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        // Development environment
        baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
      } else {
        // Local development
        baseUrl = 'http://localhost:5000';
      }
      
      let emailSent = false;
      let emailError = null;
      try {
        const registrationLink = `${baseUrl}/register-trial?token=${token}`;
        const emailBody = `Hello,

You've been invited to try GuardTrack for ${validatedData.durationDays} days!

${validatedData.companyName ? `Company: ${validatedData.companyName}\n` : ''}
Click the link below to complete your registration and start your free trial:

${registrationLink}

This invitation will expire in 7 days.

Best regards,
GuardTrack Team`;
        
        await sendTrialInvitationEmail(
          validatedData.email,
          `Invitation to Try GuardTrack - ${validatedData.durationDays} Day Trial`,
          emailBody
        );
        emailSent = true;
      } catch (error: any) {
        console.error("Error sending trial invitation email:", error);
        emailError = error.message || "Failed to send email";
      }
      
      res.json({ 
        message: emailSent 
          ? "Trial invitation sent successfully" 
          : `Trial invitation created but email delivery failed: ${emailError}. You can resend the invitation link manually.`,
        emailSent,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          companyName: invitation.companyName,
          durationDays: invitation.durationDays,
          expiresAt: invitation.expiresAt,
          registrationLink: `${baseUrl}/register-trial?token=${token}`,
        }
      });
    } catch (error: any) {
      console.error("Error sending trial invitation:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(400).json({ message: error.message || "Failed to send trial invitation" });
    }
  });

  app.get('/api/trial-invitation/:token', async (req: any, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getTrialInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }
      
      res.json({
        email: invitation.email,
        companyName: invitation.companyName,
        durationDays: invitation.durationDays,
        expiresAt: invitation.expiresAt,
      });
    } catch (error: any) {
      console.error("Error fetching trial invitation:", error);
      res.status(400).json({ message: error.message || "Failed to fetch invitation" });
    }
  });

  app.post('/api/trial-registration', async (req: any, res) => {
    try {
      const { token, companyName, adminName, username, password } = req.body;
      
      // Validate required fields
      if (!token || !companyName || !adminName || !username || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get trial invitation
      const invitation = await storage.getTrialInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }
      
      // Import hash password function
      const { hashPassword } = await import("./auth");

      const effectiveCompanyName = (invitation.companyName || companyName).trim();

      // Split adminName into first/last
      const nameParts = adminName.trim().split(/\s+/);
      const firstName = nameParts[0] || adminName;
      const lastName = nameParts.slice(1).join(' ') || '';
      const hashedPassword = await hashPassword(password);

      // === SAFETY CHECK: join existing company instead of creating a duplicate ===
      const existingCompany = await storage.findCompanyByNameOrEmail(effectiveCompanyName);
      if (existingCompany) {
        // Company already exists — add this person as an admin to the existing one
        const newUser = await storage.createUser({
          companyId: existingCompany.id,
          username,
          password: hashedPassword,
          firstName,
          lastName,
          email: invitation.email,
          role: 'admin',
          isActivated: true,
        });

        await storage.upsertMembership({
          userId: newUser.id,
          companyId: existingCompany.id,
          role: 'admin',
          status: 'active',
        });

        await storage.markTrialInvitationAccepted(token);
        console.log(`[Trial] ${invitation.email} joined existing company "${existingCompany.name}" (${existingCompany.companyId}) instead of creating duplicate`);

        return res.json({
          message: "Registration successful! Your account has been added to the existing company. You can now log in.",
          company: {
            id: existingCompany.id,
            name: existingCompany.name,
            joinedExisting: true,
          }
        });
      }

      // No existing company — create new (normal flow)
      const allCompanies = await storage.getAllCompanies();
      const maxCompanyNum = allCompanies.reduce((max, c) => {
        const match = c.companyId.match(/COMP(\d+)/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const newCompanyId = `COMP${String(maxCompanyNum + 1).padStart(3, '0')}`;

      const trialDays = parseInt(invitation.durationDays as string);
      const trialEndDate = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      const company = await storage.createCompany({
        companyId: newCompanyId,
        name: effectiveCompanyName,
        email: invitation.email,
        isActive: true,
        trialStatus: 'trial',
        trialEndDate,
        trialDays: trialDays.toString(),
      });

      const adminUser = await storage.createUser({
        companyId: company.id,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        email: invitation.email,
        role: 'admin',
        isActivated: true,
      });

      await storage.upsertMembership({
        userId: adminUser.id,
        companyId: company.id,
        role: 'admin',
        status: 'active',
      });

      // Mark invitation as accepted
      await storage.markTrialInvitationAccepted(token);

      res.json({ 
        message: "Registration successful! You can now log in.",
        company: {
          id: company.id,
          name: company.name,
          trialDays,
          trialEndDate,
        }
      });
    } catch (error: any) {
      console.error("Error during trial registration:", error);
      res.status(400).json({ message: error.message || "Failed to complete registration" });
    }
  });

  // Get all trial invitations (Super Admin only)
  app.get('/api/super-admin/trial-invitations', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const invitations = await storage.getAllTrialInvitations();
      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching trial invitations:", error);
      res.status(500).json({ message: error.message || "Failed to fetch trial invitations" });
    }
  });

  // Delete trial invitation (Super Admin only)
  app.delete('/api/super-admin/trial-invitations/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTrialInvitation(id);
      res.json({ message: "Trial invitation deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting trial invitation:", error);
      res.status(500).json({ message: error.message || "Failed to delete trial invitation" });
    }
  });

  // Support Message Routes
  app.post('/api/support/send', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { insertSupportMessageSchema } = await import("@shared/schema");
      
      const validatedData = insertSupportMessageSchema.parse({
        ...req.body,
        companyId: req.user.companyId,
        senderId: req.user.id,
        isAdminReply: req.user.role === 'super_admin',
      });

      const message = await storage.createSupportMessage(validatedData);
      res.json(message);
    } catch (error: any) {
      console.error("Error sending support message:", error);
      res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });

  app.get('/api/support/messages', isAuthenticated, async (req: any, res) => {
    try {
      let messages;
      
      if (req.user.role === 'super_admin') {
        // Super Admin sees all messages
        messages = await storage.getAllSupportMessages();
      } else if (req.user.companyId) {
        // Company users see their company's messages
        messages = await storage.getSupportMessagesByCompany(req.user.companyId);
      } else {
        messages = [];
      }
      
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching support messages:", error);
      res.status(500).json({ message: error.message || "Failed to fetch messages" });
    }
  });

  app.patch('/api/support/messages/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const message = await storage.markSupportMessageAsRead(id);
      res.json(message);
    } catch (error: any) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: error.message || "Failed to mark message as read" });
    }
  });

  app.get('/api/support/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const companyId = req.user.role === 'super_admin' ? undefined : req.user.companyId;
      const count = await storage.getUnreadSupportMessagesCount(companyId);
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: error.message || "Failed to fetch unread count" });
    }
  });

  // App Usage Stats Routes
  app.get('/api/super-admin/app-usage', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId, month, year } = req.query;
      
      // Default to current month if not specified
      const targetMonth = month ? parseInt(month as string) - 1 : new Date().getMonth();
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      
      const currentMonthDate = new Date(targetYear, targetMonth, 1);
      const previousMonthDate = new Date(targetYear, targetMonth - 1, 1);
      
      if (companyId) {
        // Get stats for specific company
        const dailyLogins = await storage.getUserLoginStats(companyId, 'day');
        const weeklyLogins = await storage.getUserLoginStats(companyId, 'week');
        const monthlyLogins = await storage.getUserLoginStats(companyId, 'month');
        const userGrowth = await storage.getCompanyUserGrowth(companyId, currentMonthDate, previousMonthDate);
        
        res.json({
          companyId,
          dailyLogins,
          weeklyLogins,
          monthlyLogins,
          userGrowth,
          month: targetMonth + 1,
          year: targetYear,
        });
      } else {
        // Get overall stats for all companies
        const dailyLogins = await storage.getUserLoginStats(null, 'day');
        const weeklyLogins = await storage.getUserLoginStats(null, 'week');
        const monthlyLogins = await storage.getUserLoginStats(null, 'month');
        
        res.json({
          dailyLogins,
          weeklyLogins,
          monthlyLogins,
          month: targetMonth + 1,
          year: targetYear,
        });
      }
    } catch (error: any) {
      console.error("Error fetching app usage stats:", error);
      res.status(500).json({ message: error.message || "Failed to fetch app usage stats" });
    }
  });

  // Subscription Payment Routes (Super Admin only)
  app.get('/api/super-admin/subscription-payments', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.query;
      let payments;
      if (companyId) {
        payments = await storage.getSubscriptionPaymentsByCompany(companyId);
      } else {
        payments = await storage.getAllSubscriptionPayments();
      }
      res.json(payments);
    } catch (error: any) {
      console.error("Error fetching subscription payments:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscription payments" });
    }
  });

  app.get('/api/super-admin/subscription-payments/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const payment = await storage.getSubscriptionPayment(id);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (error: any) {
      console.error("Error fetching subscription payment:", error);
      res.status(500).json({ message: error.message || "Failed to fetch subscription payment" });
    }
  });

  app.post('/api/super-admin/subscription-payments', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const paymentData = {
        ...req.body,
        createdBy: req.user.id,
        paymentDate: new Date(req.body.paymentDate),
        periodStart: new Date(req.body.periodStart),
        periodEnd: new Date(req.body.periodEnd),
      };
      const payment = await storage.createSubscriptionPayment(paymentData);
      res.status(201).json(payment);
    } catch (error: any) {
      console.error("Error creating subscription payment:", error);
      res.status(500).json({ message: error.message || "Failed to create subscription payment" });
    }
  });

  app.patch('/api/super-admin/subscription-payments/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
      if (updates.paymentDate) updates.paymentDate = new Date(updates.paymentDate);
      if (updates.periodStart) updates.periodStart = new Date(updates.periodStart);
      if (updates.periodEnd) updates.periodEnd = new Date(updates.periodEnd);
      
      const payment = await storage.updateSubscriptionPayment(id, updates);
      res.json(payment);
    } catch (error: any) {
      console.error("Error updating subscription payment:", error);
      res.status(500).json({ message: error.message || "Failed to update subscription payment" });
    }
  });

  app.delete('/api/super-admin/subscription-payments/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSubscriptionPayment(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting subscription payment:", error);
      res.status(500).json({ message: error.message || "Failed to delete subscription payment" });
    }
  });

  // Invoice Routes (Super Admin CRUD)
  app.get('/api/super-admin/invoices', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.query;
      let result;
      if (companyId) {
        result = await storage.getInvoicesByCompany(companyId);
      } else {
        result = await storage.getAllInvoices();
      }
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: error.message || "Failed to fetch invoices" });
    }
  });

  app.get('/api/super-admin/invoices/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error: any) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: error.message || "Failed to fetch invoice" });
    }
  });

  app.post('/api/super-admin/invoices', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const parsed = insertInvoiceSchema.safeParse({
        ...req.body,
        createdBy: req.user.id,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        periodStart: req.body.periodStart ? new Date(req.body.periodStart) : null,
        periodEnd: req.body.periodEnd ? new Date(req.body.periodEnd) : null,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid invoice data", errors: parsed.error.flatten() });
      }
      const invoice = await storage.createInvoice(parsed.data);
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: error.message || "Failed to create invoice" });
    }
  });

  app.patch('/api/super-admin/invoices/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getInvoice(id);
      if (!existing) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const updates = { ...req.body };
      if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);
      if (updates.periodStart) updates.periodStart = new Date(updates.periodStart);
      if (updates.periodEnd) updates.periodEnd = new Date(updates.periodEnd);
      if (updates.paidAt) updates.paidAt = new Date(updates.paidAt);

      const parsed = updateInvoiceSchema.safeParse(updates);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid update data", errors: parsed.error.flatten() });
      }
      const invoice = await storage.updateInvoice(id, parsed.data);
      res.json(invoice);
    } catch (error: any) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: error.message || "Failed to update invoice" });
    }
  });

  app.delete('/api/super-admin/invoices/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getInvoice(id);
      if (!existing) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      await storage.deleteInvoice(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: error.message || "Failed to delete invoice" });
    }
  });

  // Company-facing invoice route (admin users can view their company's invoices)
  app.get('/api/invoices', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user.companyId) {
        return res.status(400).json({ message: "No company associated with this user" });
      }
      const result = await storage.getInvoicesByCompany(user.companyId);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching company invoices:", error);
      res.status(500).json({ message: error.message || "Failed to fetch invoices" });
    }
  });

  // Auth Activity Log Routes (Super Admin only)
  app.get('/api/super-admin/auth-activity', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 200;
      const logs = await storage.getAuthActivityLogs(limit);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching auth activity logs:", error);
      res.status(500).json({ message: error.message || "Failed to fetch auth activity logs" });
    }
  });

  // Error Log Routes (Super Admin only)
  app.get('/api/super-admin/error-logs', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId, limit } = req.query;
      let logs;
      if (companyId) {
        logs = await storage.getErrorLogsByCompany(companyId, Number(limit) || 100);
      } else {
        logs = await storage.getAllErrorLogs(Number(limit) || 100);
      }
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching error logs:", error);
      res.status(500).json({ message: error.message || "Failed to fetch error logs" });
    }
  });

  app.get('/api/super-admin/error-logs/count', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const count = await storage.getUnresolvedErrorCount();
      res.json({ count });
    } catch (error: any) {
      console.error("Error fetching error count:", error);
      res.status(500).json({ message: error.message || "Failed to fetch error count" });
    }
  });

  app.get('/api/super-admin/error-logs/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const log = await storage.getErrorLog(id);
      if (!log) {
        return res.status(404).json({ message: "Error log not found" });
      }
      res.json(log);
    } catch (error: any) {
      console.error("Error fetching error log:", error);
      res.status(500).json({ message: error.message || "Failed to fetch error log" });
    }
  });

  app.post('/api/super-admin/error-logs/:id/resolve', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const log = await storage.resolveErrorLog(id, req.user.id, notes);
      res.json(log);
    } catch (error: any) {
      console.error("Error resolving error log:", error);
      res.status(500).json({ message: error.message || "Failed to resolve error log" });
    }
  });

  app.delete('/api/super-admin/error-logs/:id', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteErrorLog(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting error log:", error);
      res.status(500).json({ message: error.message || "Failed to delete error log" });
    }
  });

  // Platform settings (in-memory storage for simplicity)
  let platformSettings: {
    backgroundType: 'default' | 'guardtrack' | 'custom';
    customBackgroundUrl: string | null;
    overlayOpacity: number;
  } = {
    backgroundType: 'default',
    customBackgroundUrl: null,
    overlayOpacity: 50,
  };

  // Get platform settings (public - anyone can read to apply background)
  app.get('/api/platform-settings', async (req: any, res) => {
    try {
      res.json(platformSettings);
    } catch (error: any) {
      console.error("Error fetching platform settings:", error);
      res.status(500).json({ message: error.message || "Failed to fetch platform settings" });
    }
  });

  // ===== Super Admin — Company Sites & Users Management =====

  app.get('/api/super-admin/companies/:companyId/sites', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const allSites = await storage.getAllSites();
      const companySites = allSites.filter(s => s.companyId === companyId);
      res.json(companySites);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch sites" });
    }
  });

  app.post('/api/super-admin/companies/:companyId/sites', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const validatedData = insertSiteSchema.parse({ ...req.body, companyId });
      const site = await storage.createSite(validatedData);
      res.status(201).json(site);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create site" });
    }
  });

  app.patch('/api/super-admin/companies/:companyId/sites/:siteId', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { siteId } = req.params;
      const site = await storage.updateSite(siteId, req.body);
      res.json(site);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update site" });
    }
  });

  app.delete('/api/super-admin/companies/:companyId/sites/:siteId', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { siteId } = req.params;
      await storage.deleteSite(siteId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to delete site" });
    }
  });

  app.get('/api/super-admin/companies/:companyId/users', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const allUsers = await storage.getAllUsers();
      const companyUsers = allUsers.filter(u => u.companyId === companyId);
      res.json(companyUsers.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActivated: u.isActivated,
        companyId: u.companyId,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to fetch users" });
    }
  });

  app.post('/api/super-admin/companies/:companyId/invite-user', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const { email, role, firstName, lastName } = req.body;
      if (!email || !role) return res.status(400).json({ message: "Email and role are required" });

      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      // 3-case invite logic (same as admin invite)
      const existingUsers = await storage.getUsersByEmail(email);
      const existingUser = existingUsers[0];

      if (existingUser) {
        if (existingUser.isActivated) {
          // Case B: already activated — add membership directly
          await storage.upsertMembership({ userId: existingUser.id, companyId, role, status: 'active', invitedBy: req.user.id });
          return res.json({ success: true, type: 'direct_membership', message: 'User added directly to company' });
        } else {
          // Case C: exists but not activated — create pending membership + invitation
          await storage.upsertMembership({ userId: existingUser.id, companyId, role, status: 'pending', invitedBy: req.user.id });
        }
      }

      // Case A or C: create invitation token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createInvitation({ email, companyId, role, token, expiresAt, invitedBy: req.user.id });

      // Send invitation email
      try {
        const { sendInvitationEmail } = await import('./emailService');
        await sendInvitationEmail({
          toEmail: email,
          fromName: 'GuardTrack',
          inviteToken: token,
          role,
          companyName: company.name,
          expiresAt: expiresAt,
        });
      } catch (emailErr) {
        console.error('Failed to send invitation email:', emailErr);
      }

      res.status(201).json({ success: true, type: 'invitation_sent', message: 'Invitation sent' });
    } catch (error: any) {
      console.error("Error inviting user:", error);
      res.status(400).json({ message: error.message || "Failed to invite user" });
    }
  });

  // Get platform settings (super admin)
  app.get('/api/super-admin/platform-settings', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      res.json(platformSettings);
    } catch (error: any) {
      console.error("Error fetching platform settings:", error);
      res.status(500).json({ message: error.message || "Failed to fetch platform settings" });
    }
  });

  // Update platform settings (super admin only)
  app.put('/api/super-admin/platform-settings', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      const { backgroundType, customBackgroundUrl, overlayOpacity } = req.body;
      
      if (backgroundType) {
        platformSettings.backgroundType = backgroundType;
      }
      if (customBackgroundUrl !== undefined) {
        platformSettings.customBackgroundUrl = customBackgroundUrl;
      }
      if (overlayOpacity !== undefined) {
        platformSettings.overlayOpacity = overlayOpacity;
      }
      
      res.json(platformSettings);
    } catch (error: any) {
      console.error("Error updating platform settings:", error);
      res.status(500).json({ message: error.message || "Failed to update platform settings" });
    }
  });

  // Upload background image (super admin only)
  app.post('/api/super-admin/upload-background', isAuthenticated, isSuperAdmin, async (req: any, res) => {
    try {
      // For now, we'll just return a placeholder since we don't have file storage
      // In a real implementation, you'd use object storage like Replit Object Storage
      res.status(501).json({ 
        message: "File upload not implemented. Please use an image URL instead.",
        suggestion: "Enter the URL of an image hosted elsewhere"
      });
    } catch (error: any) {
      console.error("Error uploading background:", error);
      res.status(500).json({ message: error.message || "Failed to upload background" });
    }
  });

  // Client-side error reporting endpoint (for frontend errors)
  app.post('/api/error-report', async (req: any, res) => {
    try {
      const { message, stack, endpoint, userAgent } = req.body;
      
      // Sanitize and capture error
      const errorLog = await storage.createErrorLog({
        errorType: 'client_error',
        severity: 'error',
        message: message || 'Unknown client error',
        stack,
        endpoint: endpoint || req.headers.referer,
        userAgent: userAgent || req.headers['user-agent'],
        ipAddress: req.ip,
        userId: req.user?.id || null,
        companyId: req.user?.companyId || null,
      });
      
      res.json({ success: true, id: errorLog.id });
    } catch (error: any) {
      console.error("Error saving client error report:", error);
      res.status(500).json({ message: "Failed to save error report" });
    }
  });

  // Global error handler to capture API errors
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("API Error:", err);
    
    // Don't log certain expected errors
    const skipLogging = [401, 403].includes(err.status || err.statusCode);
    
    if (!skipLogging) {
      // Sanitize request body (remove passwords and tokens)
      const sanitizedBody = { ...req.body };
      delete sanitizedBody.password;
      delete sanitizedBody.token;
      delete sanitizedBody.invitationToken;
      
      // Log the error asynchronously
      storage.createErrorLog({
        errorType: 'api_error',
        severity: err.status >= 500 ? 'critical' : 'error',
        message: err.message || 'Unknown API error',
        stack: err.stack,
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: String(err.status || err.statusCode || 500),
        requestBody: Object.keys(sanitizedBody).length > 0 ? JSON.stringify(sanitizedBody) : null,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        userId: req.user?.id || null,
        companyId: req.user?.companyId || null,
      }).catch(logErr => {
        console.error("Failed to log error:", logErr);
      });
    }
    
    res.status(err.status || err.statusCode || 500).json({
      message: err.message || 'Internal server error'
    });
  });

  // ── Issue Tracker ──────────────────────────────────────────────────────────
  app.get("/api/issues", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      await storage.initDefaultIssueSettings(companyId);
      res.json(await storage.getAllIssues(companyId));
    } catch (e) { res.status(500).json({ error: "Failed to fetch issues" }); }
  });

  app.get("/api/issues/stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try { res.json(await storage.getIssueStats(req.user.companyId)); }
    catch (e) { res.status(500).json({ error: "Failed to fetch stats" }); }
  });

  app.get("/api/issues/archived", isAuthenticated, isAdmin, async (req: any, res) => {
    try { res.json(await storage.getArchivedIssues(req.user.companyId)); }
    catch (e) { res.status(500).json({ error: "Failed to fetch archived issues" }); }
  });

  app.get("/api/issues/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const issue = await storage.getIssueById(parseInt(req.params.id), req.user.companyId);
      issue ? res.json(issue) : res.status(404).json({ error: "Issue not found" });
    } catch (e) { res.status(500).json({ error: "Failed to fetch issue" }); }
  });

  app.post("/api/issues", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const issue = await storage.createIssue({ ...req.body, companyId: req.user.companyId });
      res.status(201).json(issue);
    } catch (e) { res.status(500).json({ error: "Failed to create issue" }); }
  });

  app.patch("/api/issues/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateIssue(parseInt(req.params.id), req.user.companyId, req.body);
      updated ? res.json(updated) : res.status(404).json({ error: "Issue not found" });
    } catch (e) { res.status(500).json({ error: "Failed to update issue" }); }
  });

  app.delete("/api/issues/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try { await storage.deleteIssue(parseInt(req.params.id), req.user.companyId); res.status(204).send(); }
    catch (e) { res.status(500).json({ error: "Failed to delete issue" }); }
  });

  app.post("/api/issues/:id/archive", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const issue = await storage.archiveIssue(parseInt(req.params.id), req.user.companyId);
      issue ? res.json(issue) : res.status(404).json({ error: "Issue not found" });
    } catch (e) { res.status(500).json({ error: "Failed to archive issue" }); }
  });

  app.post("/api/issues/:id/unarchive", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const issue = await storage.unarchiveIssue(parseInt(req.params.id), req.user.companyId);
      issue ? res.json(issue) : res.status(404).json({ error: "Issue not found" });
    } catch (e) { res.status(500).json({ error: "Failed to unarchive issue" }); }
  });

  app.get("/api/issue-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      await storage.initDefaultIssueSettings(req.user.companyId);
      res.json(await storage.getIssueSettings(req.user.companyId, req.query.type as string | undefined));
    }
    catch (e) { res.status(500).json({ error: "Failed to fetch settings" }); }
  });

  app.post("/api/issue-settings", isAuthenticated, isAdmin, async (req: any, res) => {
    try { res.status(201).json(await storage.createIssueSetting({ ...req.body, companyId: req.user.companyId })); }
    catch (e) { res.status(500).json({ error: "Failed to create setting" }); }
  });

  app.delete("/api/issue-settings/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try { await storage.deleteIssueSetting(parseInt(req.params.id), req.user.companyId); res.status(204).send(); }
    catch (e) { res.status(500).json({ error: "Failed to delete setting" }); }
  });

  app.post("/api/issues/:id/generate-report", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const issue = await storage.getIssueById(parseInt(req.params.id), req.user.companyId);
      if (!issue) return res.status(404).json({ error: "Issue not found" });
      const { generateNonConformanceReport } = await import("./report-generator");
      const reportContent = await generateNonConformanceReport(issue);
      const updated = await storage.updateIssue(issue.id, req.user.companyId, { reportContent, reportGeneratedAt: new Date() as any });
      res.json({ success: true, report: reportContent, issue: updated });
    } catch (e: any) { res.status(500).json({ error: e.message || "Failed to generate report" }); }
  });

  app.post("/api/issues/ai-fill", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { description } = req.body;
      if (!description?.trim()) return res.status(400).json({ error: "Description required" });
      const settings = await storage.getIssueSettings(req.user.companyId);
      const categories = settings.filter((s: any) => s.settingType === 'category').map((s: any) => s.value);
      const departments = settings.filter((s: any) => s.settingType === 'department').map((s: any) => s.value);
      const { aiFormFill } = await import("./report-generator");
      const fields = await aiFormFill(description, categories, departments);
      res.json({ success: true, fields });
    } catch (e: any) { res.status(500).json({ error: e.message || "AI fill failed" }); }
  });

  app.get("/api/public/issue-report/:issueId", async (req: any, res) => {
    try {
      const { eq } = await import("drizzle-orm");
      const { db } = await import("./db");
      const { issues, companySettings } = await import("@shared/schema");

      const [issue] = await db.select().from(issues).where(eq(issues.issueId, req.params.issueId));
      if (!issue) return res.status(404).json({ error: "Issue not found" });
      if (!issue.reportContent) return res.status(404).json({ error: "Report not yet generated" });

      let branding: { companyName?: string; logoUrl?: string } = {};
      if (issue.companyId) {
        const [settings] = await db.select().from(companySettings).where(eq(companySettings.companyId, issue.companyId));
        if (settings) {
          branding = { companyName: settings.companyName || undefined, logoUrl: settings.logoUrl || undefined };
        }
      }

      res.json({
        issueId: issue.issueId, title: issue.title, siteName: issue.siteName,
        dateLogged: issue.dateLogged, reportedBy: issue.reportedBy, status: issue.status,
        reportContent: issue.reportContent, reportGeneratedAt: issue.reportGeneratedAt,
        companyName: branding.companyName, logoUrl: branding.logoUrl,
      });
    } catch (e) { res.status(500).json({ error: "Failed to fetch report" }); }
  });

  // Periodic trial expiration check (runs every hour)
  // ─── File Upload Setup ────────────────────────────────────────────────────
  const uploadsBase = path.join(process.cwd(), "uploads");
  ["documents", "signatures", "incident-photos"].forEach(d => {
    fs.mkdirSync(path.join(uploadsBase, d), { recursive: true });
  });

  const docStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(uploadsBase, "documents")),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`),
  });
  const photoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(uploadsBase, "incident-photos")),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`),
  });
  const sigStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(uploadsBase, "signatures")),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`),
  });

  const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 50 * 1024 * 1024 } });
  const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 20 * 1024 * 1024 } });
  const uploadSig = multer({ storage: sigStorage });

  // Serve uploaded files
  app.use("/uploads", (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    next();
  }, (req: Request, res, next) => {
    const staticPath = path.join(uploadsBase, req.path.replace(/^\/uploads/, ""));
    res.sendFile(staticPath, err => { if (err) next(); });
  });

  // Fallback static middleware for /uploads
  app.use("/uploads", (req: Request, res) => {
    const fp = path.join(uploadsBase, decodeURIComponent(req.path));
    res.sendFile(fp, err => { if (err) res.status(404).json({ message: "File not found" }); });
  });

  // ─── Staff Profiles ────────────────────────────────────────────────────────
  app.get("/api/admin/staff-profiles", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const rows = await db.select().from(staffProfiles).where(eq(staffProfiles.companyId, companyId));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/staff-profiles/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const [row] = await db.select().from(staffProfiles).where(
        and(eq(staffProfiles.userId, req.params.userId), eq(staffProfiles.companyId, companyId))
      );
      res.json(row || null);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/staff-profiles", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const data = { ...req.body, companyId };
      const [existing] = await db.select().from(staffProfiles).where(
        and(eq(staffProfiles.userId, data.userId), eq(staffProfiles.companyId, companyId))
      );
      if (existing) {
        const [updated] = await db.update(staffProfiles)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(staffProfiles.id, existing.id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db.insert(staffProfiles).values(data).returning();
      res.json(created);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/staff-profiles/:userId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const [existing] = await db.select().from(staffProfiles).where(
        and(eq(staffProfiles.userId, req.params.userId), eq(staffProfiles.companyId, companyId))
      );
      if (!existing) {
        const [created] = await db.insert(staffProfiles)
          .values({ ...req.body, userId: req.params.userId, companyId })
          .returning();
        return res.json(created);
      }
      const [updated] = await db.update(staffProfiles)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(staffProfiles.id, existing.id))
        .returning();
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Document Library ──────────────────────────────────────────────────────
  app.get("/api/admin/documents", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const showArchived = req.query.showArchived === "true";
      const rows = await db.select().from(companyDocuments)
        .where(and(
          eq(companyDocuments.companyId, companyId),
          eq(companyDocuments.status, showArchived ? "archived" : "active")
        ))
        .orderBy(desc(companyDocuments.uploadedAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/documents/upload", isAuthenticated, isAdmin, uploadDoc.single("file"), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const companyId = req.user.companyId;
      const [doc] = await db.insert(companyDocuments).values({
        companyId,
        employeeId: req.body.employeeId || null,
        filename: req.file.filename,
        originalName: req.body.name || req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        category: req.body.category || "other",
        notes: req.body.notes || null,
        uploadedBy: req.user.id,
        status: "active",
      }).returning();
      res.json(doc);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/documents/:id/archive", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const [doc] = await db.update(companyDocuments)
        .set({ status: "archived", archivedAt: new Date() })
        .where(and(eq(companyDocuments.id, req.params.id), eq(companyDocuments.companyId, companyId)))
        .returning();
      res.json(doc);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.patch("/api/admin/documents/:id/unarchive", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const [doc] = await db.update(companyDocuments)
        .set({ status: "active", archivedAt: null })
        .where(and(eq(companyDocuments.id, req.params.id), eq(companyDocuments.companyId, companyId)))
        .returning();
      res.json(doc);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/admin/documents/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const [doc] = await db.delete(companyDocuments)
        .where(and(eq(companyDocuments.id, req.params.id), eq(companyDocuments.companyId, companyId)))
        .returning();
      if (doc?.filename) {
        const fp = path.join(uploadsBase, "documents", doc.filename);
        fs.unlink(fp, () => {});
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/admin/documents/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const [doc] = await db.select().from(companyDocuments).where(eq(companyDocuments.id, req.params.id));
      if (!doc) return res.status(404).json({ message: "Not found" });
      const fp = path.join(uploadsBase, "documents", doc.filename);
      res.download(fp, doc.originalName);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Signature Requests ────────────────────────────────────────────────────
  app.get("/api/admin/signature-requests", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const rows = await db.select().from(signatureRequests)
        .where(eq(signatureRequests.companyId, companyId))
        .orderBy(desc(signatureRequests.sentAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/signature-requests", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const companyId = req.user.companyId;
      const { employeeIds, documentId, documentName, deadline, message } = req.body;
      const ids: string[] = Array.isArray(employeeIds) ? employeeIds : [employeeIds];
      const created = [];
      for (const employeeId of ids) {
        const [row] = await db.insert(signatureRequests).values({
          companyId,
          documentId: documentId || null,
          employeeId,
          sentBy: req.user.id,
          deadline: deadline ? new Date(deadline) : null,
          message: message || null,
          documentName: documentName || null,
          status: "pending",
        }).returning();
        created.push(row);
      }
      res.json(created);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Employee: get my pending signature requests
  app.get("/api/my-signature-requests", isAuthenticated, async (req: any, res) => {
    try {
      const rows = await db.select().from(signatureRequests)
        .where(and(eq(signatureRequests.employeeId, req.user.id), eq(signatureRequests.status, "pending")))
        .orderBy(desc(signatureRequests.sentAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Employee: submit signature
  app.post("/api/signature-requests/:id/sign", isAuthenticated, uploadSig.single("signature"), async (req: any, res) => {
    try {
      const [row] = await db.select().from(signatureRequests).where(eq(signatureRequests.id, req.params.id));
      if (!row || row.employeeId !== req.user.id) return res.status(403).json({ message: "Forbidden" });
      let imagePath = row.signatureImagePath;
      if (req.file) {
        imagePath = req.file.filename;
      } else if (req.body.signatureData) {
        // base64 PNG from canvas
        const base64 = req.body.signatureData.replace(/^data:image\/png;base64,/, "");
        const fname = `${Date.now()}-${req.params.id}.png`;
        fs.writeFileSync(path.join(uploadsBase, "signatures", fname), base64, "base64");
        imagePath = fname;
      }
      const [updated] = await db.update(signatureRequests)
        .set({ status: "signed", signedAt: new Date(), signatureImagePath: imagePath })
        .where(eq(signatureRequests.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: update status (reminder etc)
  app.patch("/api/admin/signature-requests/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [updated] = await db.update(signatureRequests)
        .set(req.body)
        .where(eq(signatureRequests.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Incident Photos ───────────────────────────────────────────────────────
  app.get("/api/incidents/:id/photos", isAuthenticated, async (req: any, res) => {
    try {
      const rows = await db.select().from(incidentPhotos)
        .where(eq(incidentPhotos.incidentId, parseInt(req.params.id)))
        .orderBy(incidentPhotos.uploadedAt);
      res.json(rows.map(r => ({ ...r, filePath: `/uploads/incident-photos/${r.filename}` })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/incidents/:id/photos", isAuthenticated, uploadPhoto.array("photos", 10), async (req: any, res) => {
    try {
      const incidentId = parseInt(req.params.id);
      const files = (req.files as Express.Multer.File[]) || [];
      const inserted = [];
      for (const file of files) {
        const [row] = await db.insert(incidentPhotos).values({
          incidentId,
          filename: file.filename,
          originalName: file.originalname,
          uploadedBy: req.user.id,
        }).returning();
        inserted.push(row);
      }
      res.json(inserted);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.delete("/api/incidents/:incidentId/photos/:photoId", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [photo] = await db.delete(incidentPhotos)
        .where(eq(incidentPhotos.id, req.params.photoId))
        .returning();
      if (photo?.filename) {
        fs.unlink(path.join(uploadsBase, "incident-photos", photo.filename), () => {});
      }
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  const expireTrialsInterval = setInterval(async () => {
    try {
      const expiredCount = await storage.expireTrials();
      if (expiredCount > 0) {
        console.log(`[Trial Check] Expired ${expiredCount} trial(s)`);
      }
    } catch (error) {
      console.error('[Trial Check] Error expiring trials:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Run trial expiration check on startup
  storage.expireTrials().then(count => {
    if (count > 0) {
      console.log(`[Trial Check] Initial check: Expired ${count} trial(s)`);
    }
  }).catch(error => {
    console.error('[Trial Check] Initial check error:', error);
  });

  // Clean up interval on server shutdown
  const httpServer = createServer(app);
  httpServer.on('close', () => {
    clearInterval(expireTrialsInterval);
  });

  return httpServer;
}
