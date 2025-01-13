import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import express from "express";
import { companyMiddleware, requireAuth, requireCompanyAccess } from "./middleware/company";
import { storage, UPLOADS_PATH } from "./storage";
import { db } from "@db";
import { 
  users, quotes, contacts, products, categories, 
  templates, notifications, companies, settings 
} from "@db/schema";
import { eq, and } from "drizzle-orm";
import { generateQuotePDF } from "./services/pdfService";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Set up authentication routes and middleware
  setupAuth(app);

  // Apply company middleware to all routes after auth routes
  app.use(companyMiddleware);

  // Products routes with proper middleware chain
  app.get("/api/products", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyProducts = await db.query.products.findMany({
        where: eq(products.companyId, req.user!.companyId),
        with: {
          category: true
        }
      });

      res.json(companyProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add DELETE route for products
  app.delete("/api/products/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      // Verify product exists and belongs to company
      const existingProduct = await db.query.products.findFirst({
        where: and(
          eq(products.id, productId),
          eq(products.companyId, req.user!.companyId)
        )
      });

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Delete the product
      await db
        .delete(products)
        .where(and(
          eq(products.id, productId),
          eq(products.companyId, req.user!.companyId)
        ));

      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add PUT route for updating products
  app.put("/api/products/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      // Verify product exists and belongs to company
      const existingProduct = await db.query.products.findFirst({
        where: and(
          eq(products.id, productId),
          eq(products.companyId, req.user!.companyId)
        )
      });

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Update product
      await db
        .update(products)
        .set({
          name: req.body.name,
          categoryId: req.body.categoryId,
          basePrice: req.body.basePrice,
          cost: req.body.cost,
          unit: req.body.unit,
          isActive: req.body.isActive,
          variations: req.body.variations,
          updatedAt: new Date()
        })
        .where(eq(products.id, productId));

      // Get updated product
      const updatedProduct = await db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
          category: true
        }
      });

      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add POST route for creating products
  app.post("/api/products", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const { name, categoryId, basePrice, cost, unit, isActive, variations } = req.body;

      // Create new product
      const [newProduct] = await db
        .insert(products)
        .values({
          name,
          categoryId,
          basePrice,
          cost,
          unit,
          isActive,
          variations,
          companyId: req.user!.companyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Get the created product with its category
      const createdProduct = await db.query.products.findFirst({
        where: eq(products.id, newProduct.id),
        with: {
          category: true
        }
      });

      res.status(201).json(createdProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

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

  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      // Only SUPER_ADMIN and MULTI_ADMIN can view all companies
      if (!["SUPER_ADMIN", "MULTI_ADMIN"].includes(req.user!.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const allCompanies = await db
        .select()
        .from(companies);

      res.json(allCompanies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PDF Export route
  app.get("/api/quotes/:id/export/pdf", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ message: "Invalid quote ID" });
      }

      // Get quote with its template
      const quote = await db.query.quotes.findFirst({
        where: eq(quotes.id, quoteId),
        with: {
          template: true
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Get company info
      const company = await db.query.companies.findFirst({
        where: eq(companies.id, req.user!.companyId)
      });

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Get quote settings
      const quoteSettings = await db.query.settings.findFirst({
        where: eq(settings.companyId, req.user!.companyId)
      }) || {
        showUnitPrice: true, // Default to true for backwards compatibility
        showTotalPrice: true // Default to true for backwards compatibility
      };

      // Generate PDF with settings
      const pdfBuffer = await generateQuotePDF({ 
        quote, 
        company,
        settings: {
          showUnitPrice: quoteSettings.showUnitPrice,
          showTotalPrice: quoteSettings.showTotalPrice
        }
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=quote-${quote.number}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: "Error generating PDF" });
    }
  });

  // Users routes with proper middleware chain
  app.get("/api/users", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyUsers = await db
        .select()
        .from(users)
        .where(eq(users.companyId, req.user!.companyId));

      res.json(companyUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Categories routes with proper middleware chain
  app.get("/api/categories", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const companyCategories = await db.query.categories.findMany({
        where: eq(categories.companyId, req.user!.companyId),
        with: {
          products: true,
          templates: true
        }
      });

      res.json(companyCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Contacts routes with proper middleware chain
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

  // Quotes routes with proper middleware chain
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

  // Templates routes with proper middleware chain
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

  // Notifications routes with proper middleware chain
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

  // Quote Settings routes
  app.get("/api/settings/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteSettings = await db.query.settings.findFirst({
        where: eq(settings.companyId, req.user!.companyId)
      });

      // Return settings with defaults if not found
      res.json(quoteSettings || {
        defaultTaxRate: "0",
        defaultDiscountType: "percentage",
        defaultDiscountValue: "0",
        defaultPaymentMethod: "CASH",
        defaultDownPaymentType: "percentage",
        defaultDownPaymentValue: "0",
        requireClientSignature: false,
        autoSendEmails: false,
        showUnitPrice: true,
        showTotalPrice: true
      });
    } catch (error) {
      console.error('Error fetching quote settings:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/settings/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      // Check if settings exist
      const existingSettings = await db.query.settings.findFirst({
        where: eq(settings.companyId, req.user!.companyId)
      });

      if (existingSettings) {
        // Update existing settings
        await db
          .update(settings)
          .set({
            ...req.body,
            updatedAt: new Date()
          })
          .where(eq(settings.companyId, req.user!.companyId));
      } else {
        // Create new settings
        await db
          .insert(settings)
          .values({
            ...req.body,
            companyId: req.user!.companyId,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }

      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error('Error updating quote settings:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOADS_PATH));

  return httpServer;
}