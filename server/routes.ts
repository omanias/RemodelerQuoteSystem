import type { Express } from "express";
import { db } from "@db";
import { users, companies, quotes, contacts, products, categories, templates, companyAccess, UserRole, UserStatus } from "@db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { companyMiddleware, requireAuth, requireCompanyAccess, requireRole } from "./middleware/company";
import { count } from "drizzle-orm";

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

export function registerRoutes(app: Express): Server {
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

  // Apply company middleware to all routes
  app.use(companyMiddleware);

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

  // Protected data routes with company filtering
  app.get("/api/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quotesData = await db.query.quotes.findMany({
        where: eq(quotes.companyId, req.company!.id),
        with: {
          contact: true,
          template: true,
          category: true,
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          }
        },
        orderBy: (quotesTable, { desc }) => [desc(quotesTable.updatedAt)],
      });
      res.json(quotesData);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/contacts", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactsData = await db.query.contacts.findMany({
        where: eq(contacts.companyId, req.company!.id),
        with: {
          assignedUser: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          },
          category: true
        },
        orderBy: (contactsTable, { desc }) => [desc(contactsTable.updatedAt)],
      });
      res.json(contactsData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/products", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const productsData = await db.query.products.findMany({
        where: eq(products.companyId, req.company!.id),
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

  // Categories endpoint with proper relations
  app.get("/api/categories", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const categoriesData = await db.query.categories.findMany({
        where: eq(categories.companyId, req.company!.id),
        with: {
          products: true,
          templates: true,
        },
        orderBy: (categoriesTable, { desc }) => [desc(categoriesTable.updatedAt)],
      });

      res.json(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add detailed quote endpoint
  app.get("/api/quotes/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const [quoteData] = await db.query.quotes.findMany({
        where: and(
          eq(quotes.id, parseInt(req.params.id)),
          eq(quotes.companyId, req.company!.id)
        ),
        with: {
          contact: true,
          template: {
            with: {
              category: true
            }
          },
          category: true,
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          }
        },
        limit: 1
      });

      if (!quoteData) {
        return res.status(404).json({ message: "Quote not found" });
      }

      res.json(quoteData);
    } catch (error) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update users endpoint to include proper company filtering
  app.get("/api/users", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      let userQuery = db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          status: users.status,
          companyId: users.companyId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users);

      // For SUPER_ADMIN, return all users
      if (req.session.userRole === UserRole.SUPER_ADMIN) {
        const allUsers = await userQuery.orderBy(users.name);
        return res.json(allUsers);
      }

      // For MULTI_ADMIN, return users from accessible companies
      if (req.session.userRole === UserRole.MULTI_ADMIN && req.session.accessibleCompanyIds) {
        const accessibleUsers = await userQuery
          .where(inArray(users.companyId, req.session.accessibleCompanyIds))
          .orderBy(users.name);
        return res.json(accessibleUsers);
      }

      // For regular users, return only users from their company
      const companyUsers = await userQuery
        .where(eq(users.companyId, req.company!.id))
        .orderBy(users.name);

      res.json(companyUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add the delete user endpoint after the /api/users GET endpoint
  app.delete("/api/users/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only SUPER_ADMIN can delete other SUPER_ADMINs
      if (user.role === UserRole.SUPER_ADMIN && req.session.userRole !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "Not authorized to delete super admin users" });
      }

      // For MULTI_ADMIN, verify if they have access to the user's company
      if (req.session.userRole === UserRole.MULTI_ADMIN) {
        if (!req.session.accessibleCompanyIds?.includes(user.companyId)) {
          return res.status(403).json({ message: "Not authorized to delete this user" });
        }
      }

      // For regular ADMIN, verify they are deleting a user from their company
      if (req.session.userRole === UserRole.ADMIN && user.companyId !== req.company!.id) {
        return res.status(403).json({ message: "Not authorized to delete this user" });
      }

      // Delete the user
      await db.delete(users).where(eq(users.id, userId));

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: "Server error" });
    }
  });


  app.get("/api/templates", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const templatesData = await db.query.templates.findMany({
        where: eq(templates.companyId, req.company!.id),
        with: {
          category: true
        },
        orderBy: (templatesTable, { desc }) => [desc(templatesTable.updatedAt)],
      });
      res.json(templatesData);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add endpoint to get accessible companies for SUPER_ADMIN and MULTI_ADMIN
  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // For SUPER_ADMIN, return all companies
      if (user.role === UserRole.SUPER_ADMIN) {
        const allCompanies = await db
          .select()
          .from(companies)
          .orderBy(companies.name);
        return res.json(allCompanies);
      }

      // For MULTI_ADMIN, return only accessible companies
      if (user.role === UserRole.MULTI_ADMIN) {
        const accessibleCompanies = await db
          .select({
            id: companies.id,
            name: companies.name,
            // add other company fields as needed
          })
          .from(companies)
          .innerJoin(
            companyAccess,
            and(
              eq(companyAccess.companyId, companies.id),
              eq(companyAccess.userId, userId)
            )
          )
          .orderBy(companies.name);
        return res.json(accessibleCompanies);
      }

      // Regular users only see their own company
      const [userCompany] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, user.companyId))
        .limit(1);

      return res.json(userCompany ? [userCompany] : []);

    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add current company endpoint
  app.get("/api/companies/current", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(404).json({ message: "No company context found" });
      }

      res.json({
        id: req.company.id,
        name: req.company.name,
        subdomain: req.company.subdomain,
        settings: req.company.settings
      });
    } catch (error) {
      console.error('Error fetching current company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add to existing routes inside registerRoutes function
  app.get("/api/admin/company-metrics", requireAuth, async (req, res) => {
    try {
      // Only SUPER_ADMIN and MULTI_ADMIN can access this endpoint
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user || !["SUPER_ADMIN", "MULTI_ADMIN"].includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      // For MULTI_ADMIN, only return metrics for accessible companies
      const companyQuery = user.role === "SUPER_ADMIN"
        ? db.select().from(companies)
        : db.select()
            .from(companies)
            .innerJoin(
              companyAccess,
              and(
                eq(companyAccess.companyId, companies.id),
                eq(companyAccess.userId, user.id)
              )
            );

      const companiesData = await companyQuery;

      // Gather metrics for each company
      const companyMetrics = await Promise.all(
        companiesData.map(async (company) => {
          // Get total users
          const [{ value: userCount }] = await db
            .select({ value: count() })
            .from(users)
            .where(eq(users.companyId, company.id));

          // Get active users (users who have created quotes in the last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const [{ value: activeUsers }] = await db
            .select({ value: count(users.id, { distinct: true }) })
            .from(users)
            .innerJoin(quotes, eq(quotes.userId, users.id))
            .where(
              and(
                eq(users.companyId, company.id),
                sql`${quotes.createdAt} > ${thirtyDaysAgo}`
              )
            );

          // Get total quotes
          const [{ value: quoteCount }] = await db
            .select({ value: count() })
            .from(quotes)
            .where(eq(quotes.companyId, company.id));

          // Get recent quotes (last 30 days)
          const [{ value: recentQuotes }] = await db
            .select({ value: count() })
            .from(quotes)
            .where(
              and(
                eq(quotes.companyId, company.id),
                sql`${quotes.createdAt} > ${thirtyDaysAgo}`
              )
            );

          return {
            id: company.id,
            name: company.name,
            userCount,
            activeUsers,
            quoteCount,
            recentQuotes,
          };
        })
      );

      res.json(companyMetrics);
    } catch (error) {
      console.error('Error fetching company metrics:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}