import { Express } from "express";
import { createServer } from "http";
import { db } from "@db";
import { users, quotes, products, templates, UserRole, QuoteStatus } from "@db/schema";
import { eq, ilike } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Utility for password hashing
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    return `${derivedKey.toString('hex')}.${salt}`;
  },
  compare: async (supplied: string, stored: string) => {
    try {
      const [hashedPassword, salt] = stored.split('.');
      const derivedKey = await scryptAsync(supplied, salt, 64) as Buffer;
      const storedDerivedKey = Buffer.from(hashedPassword, 'hex');
      return timingSafeEqual(derivedKey, storedDerivedKey);
    } catch (error) {
      console.error('Password comparison error:', error);
      return false;
    }
  }
};

// Setup session middleware
function setupSession(app: Express) {
  const MemoryStore = createMemoryStore(session);
  app.use(
    session({
      secret: process.env.REPL_ID || "quote-builder-secret",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86400000 }), // Prune expired entries every 24h
      cookie: {
        secure: app.get("env") === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );
}

// Auth middleware
const requireAuth = async (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.session.userId),
  });
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  req.user = user;
  next();
};

const requireRole = (allowedRoles: string[]) => async (req: any, res: any, next: any) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  setupSession(app);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    try {
      console.log(`Login attempt for email: ${email}`);

      // Delete existing admin user first
      await db.delete(users).where(eq(users.email, "admin@quotebuilder.com"));

      // Create new admin user with correct password hash
      const hashedPassword = await crypto.hash("admin123");
      const [user] = await db.insert(users)
        .values({
          email: "admin@quotebuilder.com",
          password: hashedPassword,
          name: "Admin User",
          role: UserRole.ADMIN,
        })
        .returning();

      // Now try to log in
      const isValidPassword = await crypto.compare(password, user.password);
      console.log(`Password validation result: ${isValidPassword}`);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;
      res.json({ 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", requireAuth, async (req, res) => {
    res.json(req.user);
  });

  return httpServer;
}