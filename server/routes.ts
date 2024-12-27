import { Express } from "express";
import { createServer } from "http";
import { db } from "@db";
import { users, quotes, products, templates, UserRole, QuoteStatus } from "@db/schema";
import { eq } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Utility for password hashing
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (supplied: string, stored: string) => {
    const [hash, salt] = stored.split(".");
    const hashBuffer = Buffer.from(hash, "hex");
    const suppliedBuffer = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashBuffer, suppliedBuffer);
  },
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
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user || !(await crypto.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (error) {
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

  // User management (admin only)
  app.post("/api/users", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      const hashedPassword = await crypto.hash(password);
      const [user] = await db.insert(users)
        .values({ email, password: hashedPassword, name, role })
        .returning();
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/users", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const allUsers = await db.query.users.findMany({
        orderBy: (users, { asc }) => [asc(users.name)],
      });
      res.json(allUsers.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role })));
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Quote routes
  app.get("/api/quotes", requireAuth, async (req: any, res) => {
    try {
      const userQuotes = await db.query.quotes.findMany({
        where: eq(quotes.userId, req.user.id),
        orderBy: (quotes, { desc }) => [desc(quotes.createdAt)],
      });
      res.json(userQuotes);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/quotes", requireAuth, async (req: any, res) => {
    try {
      const { clientName, clientEmail, templateId, content } = req.body;
      const timestamp = new Date().getTime().toString();
      const quoteNumber = `Q${timestamp}`;

      const [newQuote] = await db.insert(quotes)
        .values({
          number: quoteNumber,
          clientName,
          clientEmail,
          status: QuoteStatus.DRAFT,
          total: 0,
          content,
          userId: req.user.id,
          templateId,
        })
        .returning();

      res.json(newQuote);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Product routes
  app.get("/api/products", requireAuth, async (_req, res) => {
    try {
      const allProducts = await db.query.products.findMany({
        orderBy: (products, { asc }) => [asc(products.name)],
      });
      res.json(allProducts);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/products", requireAuth, requireRole([UserRole.ADMIN, UserRole.MANAGER]), async (req: any, res) => {
    try {
      const { name, category, basePrice, unit, isActive, variations } = req.body;
      const [newProduct] = await db.insert(products).values({
        name,
        category,
        basePrice,
        unit,
        isActive,
        variations,
      }).returning();

      res.json(newProduct);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Template routes
  app.get("/api/templates", requireAuth, async (_req, res) => {
    try {
      const allTemplates = await db.query.templates.findMany({
        orderBy: (templates, { desc }) => [desc(templates.isDefault), desc(templates.updatedAt)],
      });
      res.json(allTemplates);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/templates", requireAuth, requireRole([UserRole.ADMIN]), async (req: any, res) => {
    try {
      const { name, category, content, isDefault } = req.body;
      const [newTemplate] = await db.insert(templates).values({
        name,
        category,
        content,
        isDefault,
      }).returning();

      res.json(newTemplate);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}