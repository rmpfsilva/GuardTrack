// Referenced from blueprint:javascript_auth_all_persistance
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { sendTrialInvitationEmail, sendPasswordResetEmail } from "./emailService";

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

export async function comparePasswords(supplied: string, stored: string) {
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
      const { username, password, firstName, lastName, invitationToken } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || '';
      const userAgent = req.headers['user-agent'] || '';
      
      if (!username || !password) {
        storage.createAuthActivityLog({ eventType: 'register', status: 'failed', username, ipAddress, userAgent, errorReason: 'Missing username or password' }).catch(() => {});
        return res.status(400).json({ message: "Username and password are required" });
      }

      if (!invitationToken) {
        storage.createAuthActivityLog({ eventType: 'register', status: 'failed', username, ipAddress, userAgent, errorReason: 'Missing invitation token' }).catch(() => {});
        return res.status(400).json({ message: "Invitation token is required" });
      }

      const invitation = await storage.getInvitationByToken(invitationToken);
      
      if (!invitation) {
        storage.createAuthActivityLog({ eventType: 'register', status: 'failed', username, email: undefined, ipAddress, userAgent, errorReason: 'Invalid invitation token' }).catch(() => {});
        return res.status(400).json({ message: "Invalid invitation token" });
      }

      if (invitation.status !== 'pending') {
        storage.createAuthActivityLog({ eventType: 'register', status: 'failed', username, email: invitation.email, companyId: invitation.companyId, ipAddress, userAgent, errorReason: 'Invitation already used' }).catch(() => {});
        return res.status(400).json({ message: "This invitation has already been used" });
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        storage.createAuthActivityLog({ eventType: 'register', status: 'failed', username, email: invitation.email, companyId: invitation.companyId, ipAddress, userAgent, errorReason: 'Invitation expired' }).catch(() => {});
        return res.status(400).json({ message: "This invitation has expired" });
      }

      const existingUser = await storage.getUserByUsername(username, invitation.companyId);
      if (existingUser) {
        storage.createAuthActivityLog({ eventType: 'register', status: 'failed', username, email: invitation.email, companyId: invitation.companyId, ipAddress, userAgent, errorReason: 'Username already exists in company' }).catch(() => {});
        return res.status(400).json({ message: "Username already exists in this company" });
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        firstName,
        lastName,
        role: invitation.role as 'guard' | 'steward' | 'supervisor' | 'admin',
        email: invitation.email,
        companyId: invitation.companyId,
      });

      await storage.acceptInvitation(invitationToken);

      const company = invitation.companyId ? await storage.getCompany(invitation.companyId) : null;
      storage.createAuthActivityLog({ eventType: 'register', status: 'success', username, email: invitation.email, userId: user.id, companyId: invitation.companyId, companyName: company?.name || undefined, ipAddress, userAgent }).catch(() => {});

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
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || '';
      const userAgent = req.headers['user-agent'] || '';
      
      if (!username || !password) {
        storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, ipAddress, userAgent, errorReason: 'Missing username or password' }).catch(() => {});
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      let user: SelectUser | undefined;
      
      if (isSuperAdmin) {
        user = await storage.getSuperAdminByUsername(username);
        if (!user) {
          storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, ipAddress, userAgent, errorReason: 'Super admin not found' }).catch(() => {});
          return res.status(401).json({ message: "Invalid credentials" });
        }
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
          storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, userId: user.id, ipAddress, userAgent, errorReason: 'Invalid password (super admin)' }).catch(() => {});
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }
      else if (companyId) {
        user = await storage.getUserByUsername(username, companyId);
        if (!user) {
          storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, companyId, ipAddress, userAgent, errorReason: 'User not found in company' }).catch(() => {});
          return res.status(401).json({ message: "Invalid credentials" });
        }
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
          storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, userId: user.id, companyId, ipAddress, userAgent, errorReason: 'Invalid password' }).catch(() => {});
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }
      else {
        const matchingUsers = await storage.getUsersByUsername(username);
        
        if (matchingUsers.length === 0) {
          storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, ipAddress, userAgent, errorReason: 'Username not found' }).catch(() => {});
          return res.status(401).json({ message: "Invalid credentials" });
        }
        
        const validUsers: SelectUser[] = [];
        for (const u of matchingUsers) {
          const passwordMatch = await comparePasswords(password, u.password);
          if (passwordMatch) {
            validUsers.push(u);
          }
        }
        
        if (validUsers.length === 0) {
          storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, ipAddress, userAgent, errorReason: 'Invalid password' }).catch(() => {});
          return res.status(401).json({ message: "Invalid credentials" });
        }
        
        if (validUsers.length > 1) {
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
        
        user = validUsers[0];
      }
      
      if (user.role !== 'super_admin' && user.companyId) {
        try {
          const trialStatus = await storage.checkTrialStatus(user.companyId);
          
          if (!trialStatus.isActive && trialStatus.status === 'expired') {
            const company = await storage.getCompany(user.companyId);
            if (company && company.email) {
              await sendTrialInvitationEmail(
                company.email,
                'Trial Period Expired - GuardTrack',
                `Dear ${company.name} Team,\n\nYour trial period for GuardTrack has expired. To continue using the platform, please contact our support team to upgrade to a full account.\n\nThank you for trying GuardTrack.\n\nBest regards,\nGuardTrack Team`
              );
            }
            
            storage.createAuthActivityLog({ eventType: 'login', status: 'failed', username, userId: user.id, companyId: user.companyId, companyName: company?.name || undefined, ipAddress, userAgent, errorReason: 'Trial expired' }).catch(() => {});
            return res.status(403).json({ 
              message: "Your trial period has expired. An email has been sent to your company administrator. Please contact support to upgrade.",
              trialExpired: true 
            });
          }
        } catch (trialError) {
          console.error('Error checking trial on login:', trialError);
        }
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        try {
          await storage.createUserLogin({
            userId: user!.id,
            companyId: user!.companyId || null,
          });
        } catch (trackingError) {
          console.error('Error tracking user login:', trackingError);
        }
        
        const company = user!.companyId ? await storage.getCompany(user!.companyId) : null;
        storage.createAuthActivityLog({ eventType: 'login', status: 'success', username, email: user!.email || undefined, userId: user!.id, companyId: user!.companyId || undefined, companyName: company?.name || undefined, ipAddress, userAgent }).catch(() => {});
        
        return res.status(200).json(sanitizeUser(user as SelectUser));
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).json({ message: "Login failed" });
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
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Import and validate with Zod schema
      const { updateUserProfileSchema } = await import("@shared/schema");
      const validatedData = updateUserProfileSchema.parse(req.body);

      // Update user profile
      await storage.updateUser(req.user.id, validatedData);

      // Fetch updated user and sanitize
      const updatedUser = await storage.getUserById(req.user.id);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(sanitizeUser(updatedUser));
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  app.patch("/api/user/credentials", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Import and validate with Zod schema
      const { updateUserCredentialsSchema } = await import("@shared/schema");
      const validatedData = updateUserCredentialsSchema.parse(req.body);

      // Update user credentials
      await storage.updateUser(req.user.id, validatedData);

      // Fetch updated user and sanitize
      const updatedUser = await storage.getUserById(req.user.id);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(sanitizeUser(updatedUser));
    } catch (error: any) {
      console.error("Error updating user credentials:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors[0]?.message || "Invalid input" });
      }
      res.status(500).json({ message: error.message || "Failed to update credentials" });
    }
  });

  app.post("/api/user/change-password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      // Get full user data (including password hash)
      const user = await storage.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValidPassword = await comparePasswords(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Update password
      await storage.updateUser(user.id, {
        password: await hashPassword(newPassword),
      });

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: error.message || "Failed to change password" });
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
      // Option 3: Look up by username across ALL users (super admin first, then company users)
      else if (username) {
        user = await storage.getSuperAdminByUsername(username);
        if (!user) {
          const allUsers = await storage.getAllUsers();
          user = allUsers.find(u => u.username === username);
        }
      }
      else {
        return res.status(400).json({ message: "Email or username with company selection is required" });
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

      const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
      console.log(`🔐 Password reset requested for user: ${user.username}`);
      console.log(`🔗 Reset link: ${resetLink}`);

      // Send email if the user has an email address on file
      if (user.email) {
        try {
          const host = `${req.protocol}://${req.get('host')}`;
          await sendPasswordResetEmail(user.email, token, host);
          res.status(200).json({
            message: "A password reset link has been sent to your email address.",
          });
        } catch (emailError: any) {
          console.error("Failed to send password reset email:", emailError.message, emailError.stack);
          // Still return success — the reset link is logged for admin fallback
          res.status(200).json({
            message: "Password reset request received. Contact your administrator for the reset link if you don't receive an email.",
          });
        }
      } else {
        // No email on file — admin must share the link manually
        console.log(`⚠️  No email on file for user ${user.username}. Admin must share the reset link manually.`);
        res.status(200).json({
          message: "Password reset request received. Contact your administrator to receive the reset link — no email address is on file for your account.",
        });
      }
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
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
      res.status(500).json({ message: "Failed to verify reset token" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const resetToken = await storage.getPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
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
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}
