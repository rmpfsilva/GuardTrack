// Referenced from blueprint:javascript_auth_all_persistance
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Sanitize user object by removing sensitive fields
function sanitizeUser(user: SelectUser): Omit<SelectUser, 'password'> {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      console.log("🔐 Login attempt for username:", username);
      const user = await storage.getUserByUsername(username);
      console.log("👤 User found:", user ? `Yes (${user.username})` : "No");
      
      if (!user) {
        console.log("❌ Login failed: User not found");
        return done(null, false);
      }
      
      const passwordMatch = await comparePasswords(password, user.password);
      console.log("🔑 Password match:", passwordMatch);
      
      if (!passwordMatch) {
        console.log("❌ Login failed: Invalid password");
        return done(null, false);
      }
      
      console.log("✅ Login successful for:", username);
      return done(null, user);
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUserById(id);
    // Sanitize user to remove password before setting on req.user
    done(null, user ? sanitizeUser(user) : null);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate input
      const { username, password, firstName, lastName } = req.body;
      
      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Create user with default 'guard' role - role elevation requires admin action
      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        firstName,
        lastName,
        role: 'guard', // Always default to guard, preventing privilege escalation
      });

      req.login(sanitizeUser(user), (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("📥 POST /api/login received");
    console.log("📦 Request body:", req.body);
    
    passport.authenticate("local", (err: any, user: any, info: any) => {
      console.log("🔍 Passport authenticate callback - err:", err, "user:", user ? user.username : null, "info:", info);
      
      if (err) {
        console.log("❌ Authentication error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("❌ No user returned from passport");
        return res.status(401).send("Invalid credentials");
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.log("❌ Login error:", loginErr);
          return next(loginErr);
        }
        console.log("✅ Login successful, sending response");
        return res.status(200).json(sanitizeUser(user as SelectUser));
      });
    })(req, res, next);
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
}

export { hashPassword };
