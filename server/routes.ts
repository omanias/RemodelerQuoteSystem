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

  // Let's create the initial admin user if it doesn't exist
  const createInitialAdmin = async () => {
    try {
      const adminExists = await db.query.users.findFirst({
        where: eq(users.email, "admin@quotebuilder.com"),
      });

      if (!adminExists) {
        const hashedPassword = await crypto.hash("admin123");
        await db.insert(users).values({
          email: "admin@quotebuilder.com",
          password: hashedPassword,
          name: "Admin User",
          role: UserRole.ADMIN,
        });
        console.log("Initial admin user created");
      }
    } catch (error) {
      console.error("Error creating initial admin:", error);
    }
  };
  createInitialAdmin();

  return httpServer;
}