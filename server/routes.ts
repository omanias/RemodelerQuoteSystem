import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import express from "express";
import { companyMiddleware, requireAuth, requireCompanyAccess } from "./middleware/company";
import { storage, UPLOADS_PATH } from "./storage";
import { db } from "@db";
import { 
  users, quotes, contacts, products, categories, 
  templates, notifications, companies 
} from "@db/schema";
import { eq, and } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Set up authentication routes and middleware
  setupAuth(app);

  // Apply company middleware to all other routes
  app.use(companyMiddleware);

  // Companies routes
  app.get("/api/companies/current", requireAuth, async (req, res) => {
    try {
      if (!req.user?.companyId) {
        return res.status(403).json({ message: "No company access" });
      }

      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, req.user.companyId))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Products
  app.get("/api/products", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyProducts = await db
        .select()
        .from(products)
        .where(eq(products.companyId, req.user!.companyId));

      res.json(companyProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Categories
  app.get("/api/categories", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.companyId, req.user!.companyId));

      res.json(companyCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contacts
  app.get("/api/contacts", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyContacts = await db
        .select()
        .from(contacts)
        .where(eq(contacts.companyId, req.user!.companyId));

      res.json(companyContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Quotes
  app.get("/api/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyQuotes = await db
        .select()
        .from(quotes)
        .where(eq(quotes.companyId, req.user!.companyId));

      res.json(companyQuotes);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Templates
  app.get("/api/templates", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyTemplates = await db
        .select()
        .from(templates)
        .where(eq(templates.companyId, req.user!.companyId));

      res.json(companyTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notifications
  app.get("/api/notifications", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.companyId, req.user!.companyId),
            eq(notifications.userId, req.user!.id)
          )
        );

      res.json(userNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOADS_PATH));

  return httpServer;
}