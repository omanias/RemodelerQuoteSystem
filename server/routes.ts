import type { Express } from "express";
import { db } from "@db";
import { 
  users, quotes, products, templates, tablePermissions, companies, contacts, contactNotes,
  contactTasks, contactDocuments, contactPhotos, contactCustomFields, categories,
  UserRole, QuoteStatus, UserStatus, PermissionType
} from "@db/schema";
import { eq, ilike, desc, and } from "drizzle-orm";
import { createServer } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { companyMiddleware, requireAuth, requireRole } from "./middleware/company";

const scryptAsync = promisify(scrypt);
const MemoryStore = createMemoryStore(session);

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

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Setup session middleware before any routes
  app.use(
    session({
      secret: process.env.REPL_ID || "quote-builder-secret",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({
        checkPeriod: 86400000 // Prune expired entries every 24h
      }),
      cookie: {
        secure: app.get("env") === "production",
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // Public company search and lookup routes (no auth or company middleware required)
  app.get("/api/companies/search", async (req, res) => {
    try {
      const { q } = req.query;
      const searchTerm = q ? String(q) : '';

      const results = await db.query.companies.findMany({
        where: searchTerm ? ilike(companies.name, `%${searchTerm}%`) : undefined,
        limit: 10,
      });

      res.json(results);
    } catch (error) {
      console.error('Error searching companies:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);

      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }

      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add company middleware after public routes
  app.use(companyMiddleware);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    try {
      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await crypto.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // If in subdomain mode, verify user has access to the company
      if (req.company && user.companyId !== req.company.id) {
        return res.status(403).json({ message: "You don't have access to this company" });
      }

      if (!req.session) {
        return res.status(500).json({ message: "Session not initialized" });
      }

      req.session.userId = user.id;
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: user.companyId
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    if (!req.session) {
      return res.status(200).json({ message: "Already logged out" });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: "Error during logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: user.companyId
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/companies/current", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(req.company);
    } catch (error) {
      console.error('Error fetching current company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}

// Helper function to check if a user has permission for an action
export async function hasPermission(
  userId: number,
  tableName: string,
  permissionType: keyof typeof PermissionType
): Promise<boolean> {
  try {
    // Get user's role
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return false;

    // Admin always has all permissions
    if (user.role === UserRole.ADMIN) return true;

    // Check specific permission
    const permission = await db.query.tablePermissions.findFirst({
      where: and(
        eq(tablePermissions.tableName, tableName),
        eq(tablePermissions.roleId, user.role),
        eq(tablePermissions.permissionType, permissionType)
      ),
    });

    return permission?.isAllowed ?? false;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}