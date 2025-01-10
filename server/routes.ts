import type { Express } from "express";
import { db } from "@db";
import { users, companies, UserRole, UserStatus } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import express from "express";
import { companyMiddleware, requireAuth, requireCompanyAccess } from "./middleware/company";
import { storage, UPLOADS_PATH } from "./storage";

declare module 'express' {
  interface Request {
    user?: {
      id: number;
      role: keyof typeof UserRole;
      companyId: number;
    };
    company?: {
      id: number;
      name: string;
    };
  }
}

declare module 'express-session' {
  interface SessionData {
    userId: number;
    userRole: keyof typeof UserRole;
    companyId: number;
    accessibleCompanyIds?: number[];
  }
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Setup session middleware before any routes
  const MemoryStore = createMemoryStore(session);
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

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, companyId } = req.body;
      console.log('Login attempt:', { email, companyId });

      if (!email || !password || !companyId) {
        return res.status(400).json({ message: "Email, password and company ID are required" });
      }

      // First verify if company exists
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company) {
        console.log('Company not found:', companyId);
        return res.status(401).json({ message: "Invalid company ID" });
      }

      // Then check user credentials
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.email, email),
          eq(users.companyId, companyId)
        ))
        .limit(1);

      console.log('Found user:', user ? 'yes' : 'no');

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(401).json({ message: "Account is inactive" });
      }

      // Set session data
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.companyId = user.companyId;

      console.log('Session set:', req.session);

      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        status: user.status,
        companyName: company.name
      };

      res.json(userData);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: "Error during logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json(null);
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json(null);
      }

      // Get company name
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1);

      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        status: user.status,
        companyName: company?.name
      };

      res.json(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Apply company middleware to all other routes
  app.use(companyMiddleware);

  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOADS_PATH));

  return httpServer;
}