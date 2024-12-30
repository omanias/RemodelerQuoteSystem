import type { Express } from "express";
import { db } from "@db";
import { users, companies, quotes, contacts, products, categories, templates } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { createServer } from "http";
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

      // Verify user belongs to company
      if (user.companyId !== companyId) {
        return res.status(403).json({ message: "Invalid company access" });
      }

      // Verify password
      const isValidPassword = await crypto.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session!.userId = user.id;
      req.session!.companyId = user.companyId; // Store company ID in session
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

  // Protected routes middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  // Data routes with company filtering
  app.get("/api/quotes", requireAuth, async (req, res) => {
    try {
      const quotes = await db.query.quotes.findMany({
        where: eq(quotes.companyId, req.session!.companyId),
        orderBy: (quotes, { desc }) => [desc(quotes.updatedAt)],
      });
      res.json(quotes);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const contacts = await db.query.contacts.findMany({
        where: eq(contacts.companyId, req.session!.companyId),
        orderBy: (contacts, { desc }) => [desc(contacts.updatedAt)],
      });
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await db.query.products.findMany({
        where: eq(products.companyId, req.session!.companyId),
        orderBy: (products, { desc }) => [desc(products.updatedAt)],
      });
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const categories = await db.query.categories.findMany({
        where: eq(categories.companyId, req.session!.companyId),
        orderBy: (categories, { desc }) => [desc(categories.updatedAt)],
      });
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      const templates = await db.query.templates.findMany({
        where: eq(templates.companyId, req.session!.companyId),
        orderBy: (templates, { desc }) => [desc(templates.updatedAt)],
      });
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}