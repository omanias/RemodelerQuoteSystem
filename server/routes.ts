import type { Express } from "express";
import { db } from "@db";
import { users, companies, quotes, contacts, products, categories, templates, companyAccess, UserRole } from "@db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

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

declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: keyof typeof UserRole;
    companyId: number;
    accessibleCompanyIds?: number[];
  }
}

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

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { companyId, email, password } = req.body;

    if (!companyId || !email || !password) {
      return res.status(400).json({ message: "Company ID, email and password are required" });
    }

    try {
      // First verify company exists
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company) {
        return res.status(401).json({ message: "Company not found" });
      }

      // Then find user
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

      // For SUPER_ADMIN, allow access to all companies
      if (user.role === UserRole.SUPER_ADMIN) {
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.companyId = companyId;
        // No need to set accessibleCompanyIds as SUPER_ADMIN has access to all
      }
      // For MULTI_ADMIN, get their accessible companies
      else if (user.role === UserRole.MULTI_ADMIN) {
        const accessibleCompanies = await db
          .select({ companyId: companyAccess.companyId })
          .from(companyAccess)
          .where(eq(companyAccess.userId, user.id));

        const accessibleCompanyIds = accessibleCompanies.map(c => c.companyId);

        // Verify if user has access to the requested company
        if (!accessibleCompanyIds.includes(companyId)) {
          return res.status(403).json({ message: "Access denied to this company" });
        }

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.companyId = companyId;
        req.session.accessibleCompanyIds = accessibleCompanyIds;
      }
      // For regular users, verify they belong to the company
      else {
        if (user.companyId !== companyId) {
          return res.status(403).json({ message: "Invalid company access" });
        }

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.companyId = companyId;
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: req.session.companyId
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy((err) => {
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

      // For MULTI_ADMIN, include accessible company IDs
      const accessibleCompanyIds = req.session.userRole === UserRole.MULTI_ADMIN
        ? req.session.accessibleCompanyIds
        : undefined;

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: req.session.companyId,
        accessibleCompanyIds
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Protected routes middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  // Company access middleware
  const checkCompanyAccess = async (req: any, res: any, next: any) => {
    const { userRole, companyId, accessibleCompanyIds } = req.session;

    if (userRole === UserRole.SUPER_ADMIN) {
      // Super admin has access to all companies
      return next();
    }

    if (userRole === UserRole.MULTI_ADMIN) {
      // Multi admin can only access their assigned companies
      if (!accessibleCompanyIds?.includes(companyId)) {
        return res.status(403).json({ message: "Access denied to this company" });
      }
      return next();
    }

    // Regular users can only access their own company
    if (companyId !== req.session.companyId) {
      return res.status(403).json({ message: "Access denied to this company" });
    }

    next();
  };

  // Data routes with company filtering
  app.get("/api/quotes", requireAuth, checkCompanyAccess, async (req, res) => {
    try {
      const quotesData = await db.query.quotes.findMany({
        where: eq(quotes.companyId, req.session.companyId),
        orderBy: (quotesTable, { desc }) => [desc(quotesTable.updatedAt)],
      });
      res.json(quotesData);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/contacts", requireAuth, checkCompanyAccess, async (req, res) => {
    try {
      const contactsData = await db.query.contacts.findMany({
        where: eq(contacts.companyId, req.session.companyId),
        orderBy: (contactsTable, { desc }) => [desc(contactsTable.updatedAt)],
      });
      res.json(contactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products", requireAuth, checkCompanyAccess, async (req, res) => {
    try {
      const productsData = await db.query.products.findMany({
        where: eq(products.companyId, req.session.companyId),
        with: {
          category: true
        },
        orderBy: (productsTable, { desc }) => [desc(productsTable.updatedAt)],
      });
      res.json(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/categories", requireAuth, checkCompanyAccess, async (req, res) => {
    try {
      const categoriesData = await db.query.categories.findMany({
        where: eq(categories.companyId, req.session.companyId),
        orderBy: (categoriesTable, { desc }) => [desc(categoriesTable.updatedAt)],
      });
      res.json(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/templates", requireAuth, checkCompanyAccess, async (req, res) => {
    try {
      const templatesData = await db.query.templates.findMany({
        where: eq(templates.companyId, req.session.companyId),
        orderBy: (templatesTable, { desc }) => [desc(templatesTable.updatedAt)],
      });
      res.json(templatesData);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}