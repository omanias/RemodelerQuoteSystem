import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import express from "express";
import { companyMiddleware, requireAuth, requireCompanyAccess } from "./middleware/company";
import { storage, UPLOADS_PATH } from "./storage";
import { db } from "@db";
import { 
  users, quotes, contacts, products, categories, 
  templates, notifications, companies, settings,
  type Quote, type Settings, type Contact
} from "@db/schema";
import { eq, and } from "drizzle-orm";
import { generateQuotePDF } from "./services/pdfService";

// Helper function to generate quote number
async function generateQuoteNumber(companyId: number): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');

  // Get the count of quotes for this company this month
  const existingQuotes = await db.query.quotes.findMany({
    where: and(
      eq(quotes.companyId, companyId)
    )
  });

  const quoteCount = existingQuotes.length + 1;
  const sequenceNumber = quoteCount.toString().padStart(4, '0');

  return `Q${year}${month}${sequenceNumber}`;
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Set up authentication routes and middleware
  setupAuth(app);

  // Apply company middleware to all routes after auth routes
  app.use(companyMiddleware);

  // Quote creation route with proper typing
  app.post("/api/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const {
        contactId,
        categoryId,
        templateId,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        status,
        paymentMethod,
        subtotal,
        total,
        downPaymentType,
        downPaymentValue,
        remainingBalance,
        discountType,
        discountValue,
        discountCode,
        taxRate,
        taxAmount,
        content,
        signature,
      } = req.body;

      // Generate quote number
      const quoteNumber = await generateQuoteNumber(req.user!.companyId);

      // Create new quote with proper type checking
      const [newQuote] = await db
        .insert(quotes)
        .values({
          number: quoteNumber, // Add quote number
          contactId: contactId ? parseInt(contactId) : null,
          categoryId: parseInt(categoryId),
          templateId: parseInt(templateId),
          clientName,
          clientEmail,
          clientPhone,
          clientAddress,
          status,
          paymentMethod,
          subtotal: parseFloat(subtotal) || 0,
          total: parseFloat(total) || 0,
          downPaymentType,
          downPaymentValue: parseFloat(downPaymentValue) || 0,
          remainingBalance: parseFloat(remainingBalance) || 0,
          discountType,
          discountValue: parseFloat(discountValue) || 0,
          discountCode,
          taxRate: parseFloat(taxRate) || 0,
          taxAmount: parseFloat(taxAmount) || 0,
          content,
          signature,
          companyId: req.user!.companyId,
          userId: req.user!.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.status(201).json(newQuote);
    } catch (error) {
      console.error('Error creating quote:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add DELETE route for quotes after the quote creation route
  app.delete("/api/quotes/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ message: "Invalid quote ID" });
      }

      // Verify quote exists and belongs to company
      const existingQuote = await db.query.quotes.findFirst({
        where: and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, req.user!.companyId)
        )
      });

      if (!existingQuote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Delete the quote
      await db
        .delete(quotes)
        .where(and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, req.user!.companyId)
        ));

      res.json({ message: "Quote deleted successfully" });
    } catch (error) {
      console.error('Error deleting quote:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PDF Export route with proper typing
  app.get("/api/quotes/:id/export/pdf", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      if (isNaN(quoteId)) {
        return res.status(400).json({ message: "Invalid quote ID" });
      }

      // Get quote with its template and necessary relations
      const quote = await db.query.quotes.findFirst({
        where: eq(quotes.id, quoteId),
        with: {
          template: true,
          company: true,
          category: true,
          products: {
            with: {
              category: true
            }
          }
        }
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Get quote settings with proper type checking
      const quoteSettings = await db.query.settings.findFirst({
        where: eq(settings.companyId, req.user!.companyId)
      });

      // Generate PDF with settings
      const pdfBuffer = await generateQuotePDF({ 
        quote,
        company: quote.company,
        settings: {
          showUnitPrice: quoteSettings?.showUnitPrice ?? true,
          showTotalPrice: quoteSettings?.showTotalPrice ?? true
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

  app.post("/api/categories", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const { name, description, subcategories } = req.body;

      // Create new category with subcategories array
      const [newCategory] = await db
        .insert(categories)
        .values({
          name,
          description,
          subcategories: subcategories || [], // Ensure subcategories is always an array
          companyId: req.user!.companyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Get the created category with its relations
      const createdCategory = await db.query.categories.findFirst({
        where: eq(categories.id, newCategory.id),
        with: {
          products: true
        }
      });

      res.status(201).json(createdCategory);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/categories/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      // Verify category exists and belongs to company
      const existingCategory = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, categoryId),
          eq(categories.companyId, req.user!.companyId)
        )
      });

      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Update category with subcategories array
      await db
        .update(categories)
        .set({
          name: req.body.name,
          description: req.body.description,
          subcategories: req.body.subcategories || [], // Ensure subcategories is always an array
          updatedAt: new Date()
        })
        .where(eq(categories.id, categoryId));

      // Get updated category
      const updatedCategory = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
        with: {
          products: true
        }
      });

      res.json(updatedCategory);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      // Verify category exists and belongs to company
      const existingCategory = await db.query.categories.findFirst({
        where: and(
          eq(categories.id, categoryId),
          eq(categories.companyId, req.user!.companyId)
        )
      });

      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Delete the category
      await db
        .delete(categories)
        .where(and(
          eq(categories.id, categoryId),
          eq(categories.companyId, req.user!.companyId)
        ));

      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error('Error deleting category:', error);
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

  // Add single contact route
  app.get("/api/contacts/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      const contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, req.user!.companyId)
        )
      });

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  // Add PUT route for updating contacts
  app.put("/api/contacts/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      // Verify contact exists and belongs to company
      const existingContact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, req.user!.companyId)
        )
      });

      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Update contact
      await db
        .update(contacts)
        .set({
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          primaryEmail: req.body.primaryEmail,
          secondaryEmail: req.body.secondaryEmail,
          primaryPhone: req.body.primaryPhone,
          mobilePhone: req.body.mobilePhone,
          leadStatus: req.body.leadStatus,
          leadSource: req.body.leadSource,
          propertyType: req.body.propertyType,
          primaryAddress: req.body.primaryAddress,
          projectAddress: req.body.projectAddress,
          projectTimeline: req.body.projectTimeline,
          budgetRangeMin: req.body.budgetRangeMin,
          budgetRangeMax: req.body.budgetRangeMax,
          productInterests: req.body.productInterests,
          notes: req.body.notes,
          assignedUserId: req.body.assignedUserId,
          updatedAt: new Date()
        })
        .where(eq(contacts.id, contactId));

      // Get updated contact
      const updatedContact = await db.query.contacts.findFirst({
        where: eq(contacts.id, contactId)
      });

      res.json(updatedContact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add contact creation route
  app.post("/api/contacts", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        primaryEmail,
        secondaryEmail,
        primaryPhone,
        mobilePhone,
        leadStatus,
        leadSource,
        propertyType,
        primaryAddress,
        projectAddress,
        projectTimeline,
        budgetRangeMin,
        budgetRangeMax,
        productInterests,
        notes,
      } = req.body;

      // Create new contact
      const [newContact] = await db
        .insert(contacts)
        .values({
          firstName,
          lastName,
          primaryEmail,
          secondaryEmail,
          primaryPhone,
          mobilePhone,
          leadStatus,
          leadSource,
          propertyType,
          primaryAddress,
          projectAddress,
          projectTimeline,
          budgetRangeMin,
          budgetRangeMax,
          productInterests,
          notes,
          assignedUserId: req.body.assignedUserId || req.user!.id,
          companyId: req.user!.companyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Get the created contact
      const createdContact = await db.query.contacts.findFirst({
        where: eq(contacts.id, newContact.id)
      });

      res.status(201).json(createdContact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add contact deletion route
  app.delete("/api/contacts/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      // Verify contact exists and belongs to company
      const existingContact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, req.user!.companyId)
        )
      });

      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Delete the contact
      await db
        .delete(contacts)
        .where(and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, req.user!.companyId)
        ));

      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error('Error deleting contact:', error);
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

  // Add this endpoint after the quotes GET endpoint (line 716)
  app.get("/api/contacts/:id/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      if (isNaN(contactId)) {
        return res.status(400).json({ message: "Invalid contact ID" });
      }

      // Verify contact exists and belongs to company
      const contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, req.user!.companyId)
        )
      });

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get quotes for this contact
      const contactQuotes = await db.query.quotes.findMany({
        where: and(
          eq(quotes.contactId, contactId),
          eq(quotes.companyId, req.user!.companyId)
        ),
        orderBy: (quotes, { desc }) => [desc(quotes.createdAt)]
      });

      res.json(contactQuotes);
    } catch (error) {
      console.error('Error fetching contact quotes:', error);
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

      const settingsData = {
        ...req.body,
        companyId: req.user!.companyId,
        updatedAt: new Date()
      };

      if (existingSettings) {
        // Update existing settings
        await db
          .update(settings)
          .set(settingsData)
          .where(eq(settings.companyId, req.user!.companyId));
      } else {
        // Create new settings
        await db
          .insert(settings)
          .values({
            ...settingsData,
            createdAt: new Date()
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