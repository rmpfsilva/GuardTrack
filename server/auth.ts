// Referenced from blueprint:javascript_auth_all_persistance
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendTrialInvitationEmail } from "./emailService";

declare global {
  namespace Express {
    interface User extends Omit<SelectUser, 'password'> {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Handle invalid password format gracefully
  if (!stored || !stored.includes(".")) {
    return false;
  }
  
  const [hashed, salt] = stored.split(".");
  
  // Verify both parts exist
  if (!hashed || !salt) {
    return false;
  }
  
  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    // Handle any errors during password comparison
    console.error("Error comparing passwords:", error);
    return false;
  }
}

// Sanitize user object by removing sensitive fields
function sanitizeUser(user: SelectUser): Omit<SelectUser, 'password'> {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function setupAuth(app: Express) {
  // For Replit production deployment, always use secure cookies with sameSite 'none' for PWA
  // In development, this will work over HTTPS but may need adjustment for local HTTP testing
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days - users stay logged in
      httpOnly: true,
      secure: true, // Required for sameSite 'none' - works on Replit's HTTPS
      sameSite: 'none', // Required for PWA standalone mode
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Custom authentication function for company-scoped login
  // Passport LocalStrategy doesn't support additional fields, so we handle auth manually in the login route

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUserById(id);
    if (!user) {
      return done(null, null);
    }
    
    // Fetch user's roles from userRoles table and determine highest priority role
    const userRoles = await storage.getUserRoles(id);
    const rolePriority: Record<string, number> = {
      'super_admin': 5,
      'admin': 4,
      'supervisor': 3,
      'steward': 2,
      'guard': 1
    };
    
    // If user has roles in userRoles table, use the highest priority one
    let effectiveRole = user.role;
    if (userRoles.length > 0) {
      const sortedRoles = userRoles.sort((a, b) => (rolePriority[b] || 0) - (rolePriority[a] || 0));
      effectiveRole = sortedRoles[0];
    }
    
    // Sanitize and include the effective role
    const sanitized = sanitizeUser(user);
    const userWithRoles = {
      ...sanitized,
      role: effectiveRole, // Override with highest priority role from userRoles
      roles: userRoles.length > 0 ? userRoles : [user.role] // Include all roles
    };
    
    done(null, userWithRoles);
  });

  // Validate invitation token and return company info (for registration page)
  app.get("/api/invitation/validate/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ valid: false, error: "Invalid invitation token" });
      }
      
      if (invitation.status !== 'pending') {
        return res.status(400).json({ valid: false, error: "This invitation has already been used" });
      }
      
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).json({ valid: false, error: "This invitation has expired" });
      }
      
      // Get company details
      const company = await storage.getCompany(invitation.companyId);
      
      res.json({
        valid: true,
        email: invitation.email,
        role: invitation.role,
        companyName: company?.name,
        companyCode: company?.companyId,
        expiresAt: invitation.expiresAt,
      });
    } catch (error: any) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ valid: false, error: "Failed to validate invitation" });
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate input
      const { username, password, firstName, lastName, invitationToken } = req.body;
      
      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }

      if (!invitationToken) {
        return res.status(400).send("Invitation token is required");
      }

      // Validate invitation token
      const invitation = await storage.getInvitationByToken(invitationToken);
      
      if (!invitation) {
        return res.status(400).send("Invalid invitation token");
      }

      if (invitation.status !== 'pending') {
        return res.status(400).send("This invitation has already been used");
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(400).send("This invitation has expired");
      }

      // Check username uniqueness within the company
      const existingUser = await storage.getUserByUsername(username, invitation.companyId);
      if (existingUser) {
        return res.status(400).send("Username already exists in this company");
      }

      // Create user with role from invitation and company assignment
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        firstName,
        lastName,
        role: invitation.role as 'guard' | 'steward' | 'supervisor' | 'admin',
        email: invitation.email,
        companyId: invitation.companyId, // Assign user to the company from invitation
      });

      // Mark invitation as accepted
      await storage.acceptInvitation(invitationToken);

      req.login(sanitizeUser(user), (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const { username, password, companyId, isSuperAdmin } = req.body;
      
      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }
      
      let user: SelectUser | undefined;
      
      // If super admin login is explicitly requested
      if (isSuperAdmin) {
        user = await storage.getSuperAdminByUsername(username);
        if (!user) {
          return res.status(401).send("Invalid credentials");
        }
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
          return res.status(401).send("Invalid credentials");
        }
      }
      // If companyId is explicitly provided (user selected from conflict resolution)
      else if (companyId) {
        user = await storage.getUserByUsername(username, companyId);
        if (!user) {
          return res.status(401).send("Invalid credentials");
        }
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
          return res.status(401).send("Invalid credentials");
        }
      }
      // Normal login - look up by username only
      else {
        const matchingUsers = await storage.getUsersByUsername(username);
        
        if (matchingUsers.length === 0) {
          return res.status(401).send("Invalid credentials");
        }
        
        // Filter to users whose password matches
        const validUsers: SelectUser[] = [];
        for (const u of matchingUsers) {
          const passwordMatch = await comparePasswords(password, u.password);
          if (passwordMatch) {
            validUsers.push(u);
          }
        }
        
        if (validUsers.length === 0) {
          return res.status(401).send("Invalid credentials");
        }
        
        // If multiple valid users (same username+password in different companies), ask for company selection
        if (validUsers.length > 1) {
          // Get company info for each matching user
          const companyOptions = await Promise.all(
            validUsers.map(async (u) => {
              if (u.companyId) {
                const company = await storage.getCompany(u.companyId);
                return {
                  companyId: u.companyId,
                  companyName: company?.name || 'Unknown Company',
                  companyCode: company?.companyId || '',
                };
              }
              return null;
            })
          );
          
          return res.status(300).json({
            message: "Multiple companies found. Please select your company.",
            requiresCompanySelection: true,
            companies: companyOptions.filter(Boolean),
          });
        }
        
        // Exactly one match - use that user
        user = validUsers[0];
      }
      
      // Check trial status for non-super-admin users with companies
      if (user.role !== 'super_admin' && user.companyId) {
        try {
          const trialStatus = await storage.checkTrialStatus(user.companyId);
          
          if (!trialStatus.isActive && trialStatus.status === 'expired') {
            // Trial has expired - send email notification and block login
            const company = await storage.getCompany(user.companyId);
            if (company && company.email) {
              await sendTrialInvitationEmail(
                company.email,
                'Trial Period Expired - GuardTrack',
                `Dear ${company.name} Team,\n\nYour trial period for GuardTrack has expired. To continue using the platform, please contact our support team to upgrade to a full account.\n\nThank you for trying GuardTrack.\n\nBest regards,\nGuardTrack Team`
              );
            }
            
            return res.status(403).json({ 
              message: "Your trial period has expired. An email has been sent to your company administrator. Please contact support to upgrade.",
              trialExpired: true 
            });
          }
        } catch (trialError) {
          console.error('Error checking trial on login:', trialError);
          // Continue with login even if trial check fails
        }
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        // Track user login for analytics
        try {
          await storage.createUserLogin({
            userId: user!.id,
            companyId: user!.companyId || null,
          });
        } catch (trackingError) {
          console.error('Error tracking user login:', trackingError);
          // Continue with login even if tracking fails
        }
        
        return res.status(200).json(sanitizeUser(user as SelectUser));
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).send("Login failed");
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user); // Already sanitized in deserializeUser
  });

  app.patch("/api/user/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Unauthorized");
      }

      // Import and validate with Zod schema
      const { updateUserProfileSchema } = await import("@shared/schema");
      const validatedData = updateUserProfileSchema.parse(req.body);

      // Update user profile
      await storage.updateUser(req.user.id, validatedData);

      // Fetch updated user and sanitize
      const updatedUser = await storage.getUserById(req.user.id);
      if (!updatedUser) {
        return res.status(404).send("User not found");
      }

      res.status(200).json(sanitizeUser(updatedUser));
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).send(error.message || "Failed to update profile");
    }
  });

  app.patch("/api/user/credentials", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Unauthorized");
      }

      // Import and validate with Zod schema
      const { updateUserCredentialsSchema } = await import("@shared/schema");
      const validatedData = updateUserCredentialsSchema.parse(req.body);

      // Update user credentials
      await storage.updateUser(req.user.id, validatedData);

      // Fetch updated user and sanitize
      const updatedUser = await storage.getUserById(req.user.id);
      if (!updatedUser) {
        return res.status(404).send("User not found");
      }

      res.status(200).json(sanitizeUser(updatedUser));
    } catch (error: any) {
      console.error("Error updating user credentials:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).send(error.message || "Failed to update credentials");
    }
  });

  app.post("/api/user/change-password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).send("Unauthorized");
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).send("Current password and new password are required");
      }

      if (newPassword.length < 6) {
        return res.status(400).send("New password must be at least 6 characters");
      }

      // Get full user data (including password hash)
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).send("User not found");
      }

      // Verify current password
      const isValidPassword = await comparePasswords(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).send("Current password is incorrect");
      }

      // Update password
      await storage.updateUser(user.id, {
        password: await hashPassword(newPassword),
      });

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).send(error.message || "Failed to change password");
    }
  });

  // Request password reset - generates a reset token
  // Now requires username + companyId (since usernames are unique per company)
  // Or email (which can identify users across companies)
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { username, companyId, email } = req.body;

      let user: SelectUser | undefined;

      // Option 1: Look up by email (works across all companies)
      if (email) {
        const allUsers = await storage.getAllUsers();
        user = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
      }
      // Option 2: Look up by username + companyId
      else if (username && companyId) {
        user = await storage.getUserByUsername(username, companyId);
      }
      // Option 3: Look up super admin by username (no company)
      else if (username) {
        user = await storage.getSuperAdminByUsername(username);
      }
      else {
        return res.status(400).send("Email or username with company selection is required");
      }

      if (!user) {
        // Don't reveal if user exists for security
        return res.status(200).json({ 
          message: "If an account with those details exists, a password reset link will be sent to the admin for manual processing." 
        });
      }

      // Generate reset token (random 32 character string)
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });

      // TODO: Send email with reset link
      // For now, log the token server-side only (admin can share it manually)
      console.log(`🔐 Password reset requested for user: ${user.username}`);
      console.log(`📧 Reset token: ${token}`);
      console.log(`🔗 Reset link: ${req.protocol}://${req.get('host')}/reset-password?token=${token}`);
      console.log(`⚠️  Admins: Share this reset link with the user securely`);

      res.status(200).json({ 
        message: "Password reset request received. Contact your administrator for the reset link.",
      });
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      res.status(500).send("Failed to process password reset request");
    }
  });

  // Verify reset token
  app.get("/api/auth/verify-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Invalid or expired reset token" });
      }

      res.status(200).json({ valid: true });
    } catch (error: any) {
      console.error("Error verifying reset token:", error);
      res.status(500).send("Failed to verify reset token");
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).send("Token and new password are required");
      }

      if (newPassword.length < 6) {
        return res.status(400).send("New password must be at least 6 characters");
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).send("Invalid or expired reset token");
      }

      // Update password
      await storage.updateUser(resetToken.userId, {
        password: await hashPassword(newPassword),
      });

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(token);

      res.status(200).json({ message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(500).send("Failed to reset password");
    }
  });
}
