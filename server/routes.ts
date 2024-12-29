import type { Express } from "express";
import { createServer } from "http";
import { db } from "@db";
import { 
  users, quotes, products, templates, tablePermissions, companies, contacts, contactNotes,
  contactTasks, contactDocuments, contactPhotos, contactCustomFields,
  UserRole, QuoteStatus, UserStatus, categories, PermissionType,
  type Company, type User
} from "@db/schema";
import { eq, ilike, desc, and } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { companyMiddleware, requireCompany, requireSameCompany } from "./middleware/company";
import { requireAuth, requireRole } from "./middleware/auth";
import PDFDocument from "pdfkit";
import { createObjectCsvWriter } from "csv-writer";
import { Readable } from "stream";

const scryptAsync = promisify(scrypt);

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

// Type for quote content
interface QuoteProduct {
  id: number;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface QuoteCalculations {
  subtotal: number;
  total: number;
  downPayment: number;
  remainingBalance: number;
  discount: number;
  tax: number;
}

interface QuoteContent {
  products: QuoteProduct[];
  calculations: QuoteCalculations;
}

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

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  setupSession(app);

  // Direct company lookup by ID (no auth required)
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

  // Company search route (no auth required)
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

  // Add company middleware globally
  app.use(companyMiddleware);

  // Company routes
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

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password, subdomain } = req.body;

    try {
      console.log(`Login attempt for email: ${email}`);

      // Find user and check company association if subdomain is provided
      const user = await db.query.users.findFirst({
        where: eq(users.email, email)
      });

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await crypto.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // If subdomain is provided, verify user has access to the company
      if (subdomain && req.company) {
        if (user.companyId !== req.company.id) {
          return res.status(403).json({ message: "You don't have access to this company" });
        }
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
    req.session.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", requireAuth, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Apply multi-tenant middleware to all other routes
  app.use("/api/*", requireAuth, requireCompany, requireSameCompany);

  // Categories Routes
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }

      const allCategories = await db.query.categories.findMany({
        where: eq(categories.companyId, req.company.id),
        orderBy: (categories, { asc }) => [asc(categories.name)],
      });
      res.json(allCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/categories", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { name, description } = req.body;

      // Check if category already exists
      const existingCategory = await db.query.categories.findFirst({
        where: eq(categories.name, name),
      });

      if (existingCategory) {
        return res.status(400).json({ message: "Category with this name already exists" });
      }

      const [category] = await db.insert(categories)
        .values({ name, description, companyId: req.company!.id }) 
        .returning();

      res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/categories/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      // Check if name is being changed and if it's already taken
      const existingCategory = await db.query.categories.findFirst({
        where: eq(categories.name, name),
      });

      if (existingCategory && existingCategory.id !== parseInt(id)) {
        return res.status(400).json({ message: "Category name already taken" });
      }

      const [category] = await db.update(categories)
        .set({ name, description })
        .where(eq(categories.id, parseInt(id)))
        .returning();

      res.json(category);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/categories/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;

      // Check if category is being used by any products
      const productsWithCategory = await db.query.products.findFirst({
        where: eq(products.categoryId, parseInt(id)),
      });

      if (productsWithCategory) {
        return res.status(400).json({ message: "Cannot delete category that has products" });
      }

      await db.delete(categories).where(eq(categories.id, parseInt(id)));
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Products Routes with Category Support
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const allProducts = await db.query.products.findMany({
        with: {
          category: true,
        },
        where: eq(products.companyId, req.company.id), 
        orderBy: (products, { asc }) => [asc(products.name)],
      });
      res.json(allProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/products", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { name, categoryId, basePrice, cost, unit, isActive } = req.body;

      // Validate that category exists
      const category = await db.query.categories.findFirst({
        where: and(eq(categories.id, categoryId), eq(categories.companyId, req.company!.id)), 
      });

      if (!category) {
        return res.status(400).json({ message: "Invalid category" });
      }

      const [product] = await db.insert(products)
        .values({
          name,
          categoryId,
          basePrice,
          cost,
          unit,
          isActive: isActive ?? true,
          companyId: req.company!.id 
        })
        .returning();

      res.json({
        ...product,
        category,
      });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/products/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, categoryId, basePrice, unit, variations, isActive } = req.body;

      // Validate that category exists
      const category = await db.query.categories.findFirst({
        where: and(eq(categories.id, categoryId), eq(categories.companyId, req.company!.id)), 
      });

      if (!category) {
        return res.status(400).json({ message: "Invalid category" });
      }

      const [product] = await db.update(products)
        .set({ name, categoryId, basePrice, unit, variations, isActive })
        .where(eq(products.id, parseInt(id)))
        .returning();

      res.json({
        ...product,
        category,
      });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(products).where(eq(products.id, parseInt(id)));
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // User Management Routes
  app.get("/api/users", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const allUsers = await db.query.users.findMany({
        orderBy: (users, { asc }) => [asc(users.name)],
        where: eq(users.companyId, req.company.id) 
      });

      res.json(allUsers.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status
      })));
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/users", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { email, password, name, role } = req.body;

      // Check if user already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const hashedPassword = await crypto.hash(password);
      const [user] = await db.insert(users)
        .values({
          email,
          password: hashedPassword,
          name,
          role,
          status: UserStatus.ACTIVE,
          companyId: req.company!.id 
        })
        .returning();

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/users/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;
      const { email, name, role, status } = req.body;

      // Check if email is being changed and if it's already taken
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(400).json({ message: "Email already taken" });
      }

      const [user] = await db.update(users)
        .set({ email, name, role, status })
        .where(eq(users.id, parseInt(id)))
        .returning();

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/users/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent deleting the admin user
      const userToDelete = await db.query.users.findFirst({
        where: eq(users.id, parseInt(id)),
      });

      if (userToDelete?.email === "admin@quotebuilder.com") {
        return res.status(400).json({ message: "Cannot delete admin user" });
      }

      await db.delete(users).where(eq(users.id, parseInt(id)));
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Template Routes
  app.get("/api/templates", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const allTemplates = await db.query.templates.findMany({
        with: {
          category: true,
        },
        where: eq(templates.companyId, req.company.id), 
        orderBy: (templates, { asc }) => [asc(templates.name)],
      });
      res.json(allTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/templates", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { name, categoryId, termsAndConditions, imageUrls, isDefault } = req.body;

      // Validate that category exists
      const category = await db.query.categories.findFirst({
        where: and(eq(categories.id, categoryId), eq(categories.companyId, req.company!.id)), 
      });

      if (!category) {
        return res.status(400).json({ message: "Invalid category" });
      }

      // If this is set as default, unset any existing default templates for this category
      if (isDefault) {
        await db
          .update(templates)
          .set({ isDefault: false })
          .where(eq(templates.categoryId, categoryId));
      }

      const [template] = await db.insert(templates)
        .values({
          name,
          categoryId,
          termsAndConditions,
          imageUrls,
          isDefault: isDefault || false,
          companyId: req.company!.id 
        })
        .returning();

      res.json({
        ...template,
        category,
      });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/templates/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, categoryId, termsAndConditions, imageUrls, isDefault } = req.body;

      // Validate that category exists
      const category = await db.query.categories.findFirst({
        where: and(eq(categories.id, categoryId), eq(categories.companyId, req.company!.id)), 
      });

      if (!category) {
        return res.status(400).json({ message: "Invalid category" });
      }

      // If this is set as default, unset any existing default templates for this category
      if (isDefault) {
        await db
          .update(templates)
          .set({ isDefault: false })
          .where(eq(templates.categoryId, categoryId));
      }

      const [template] = await db.update(templates)
        .set({
          name,
          categoryId,
          termsAndConditions,
          imageUrls,
          isDefault: isDefault || false,
        })
        .where(eq(templates.id, parseInt(id)))
        .returning();

      res.json({
        ...template,
        category,
      });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/templates/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { id } = req.params;

      // Check if this is the only template for the category
      const template = await db.query.templates.findFirst({
        where: eq(templates.id, parseInt(id)),
      });

      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const templatesInCategory = await db.query.templates.findMany({
        where: eq(templates.categoryId, template.categoryId),
      });

      if (templatesInCategory.length === 1) {
        return res.status(400).json({ message: "Cannot delete the only template in a category" });
      }

      // If this was the default template, make another template the default
      if (template.isDefault && templatesInCategory.length > 1) {
        const newDefault = templatesInCategory.find(t => t.id !== template.id);
        if (newDefault) {
          await db.update(templates)
            .set({ isDefault: true })
            .where(eq(templates.id, newDefault.id));
        }
      }

      await db.delete(templates).where(eq(templates.id, parseInt(id)));
      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Quote Routes
  app.get("/api/contacts/:id/quotes", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const { id } = req.params;
      const contactQuotes = await db.query.quotes.findMany({
        where: and(eq(quotes.contactId, parseInt(id)), eq(quotes.companyId, req.company.id)), 
        orderBy: (quotes, { desc }) => [desc(quotes.updatedAt)],
        with: {
          category: true,
          template: true,
        },
      });

      res.json(contactQuotes);
    } catch (error) {
      console.error('Error fetching contact quotes:', error);
      res.status(500).json({ message: "Error fetching quotes for contact" });
    }
  });

  app.get("/api/quotes/:id", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const { id } = req.params;
      const quote = await db.query.quotes.findFirst({
        where: and(eq(quotes.id, parseInt(id)), eq(quotes.companyId, req.company.id)), 
        with: {
          category: true,
          template: true,
          contact: true,
        },
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      res.json(quote);
    } catch (error) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ message: "Server error fetching quote" });
    }
  });

  app.post("/api/quotes", requireAuth, async (req, res) => {
    try {
      const {
        categoryId,
        templateId,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        selectedProducts = [],
        total,
        downPaymentValue,
        downPaymentType,
        discountType,
        discountValue,
        taxRate,
        subtotal,
        remainingBalance,
        notes,
        contactId
      } = req.body;

      console.log('Quote creation request:', {
        categoryId,
        templateId,
        clientName,
        clientEmail,
        clientAddress,
        downPaymentValue,
        total,
        contactId
      });

      // Validate quote data
      if (!categoryId || !templateId) {
        return res.status(400).json({ message: "Category and template are required" });
      }

      if (!clientName) {
        return res.status(400).json({ message: "Client name is required" });
      }

      // Generate quote number before insertion
      const [latestQuote] = await db
        .select({ id: quotes.id })
        .from(quotes)
        .orderBy(desc(quotes.id))
        .limit(1);

      const nextId = latestQuote ? latestQuote.id + 1 : 1;
      const quoteNumber = `QT-${nextId.toString().padStart(6, '0')}`;

      // Parse numeric values with fallbacks
      const parsedTotal = parseFloat(total?.toString() || '0') || 0;
      const parsedDownPayment = parseFloat(downPaymentValue?.toString() || '0') || 0;
      const parsedSubtotal = parseFloat(subtotal?.toString() || '0') || 0;
      const parsedRemainingBalance = parseFloat(remainingBalance?.toString() || '0') || 0;
      const parsedDiscountValue = parseFloat(discountValue?.toString() || '0') || 0;
      const parsedTaxRate = parseFloat(taxRate?.toString() || '0') || 0;

      const [quote] = await db.insert(quotes)
        .values({
          number: quoteNumber,
          categoryId: parseInt(categoryId),
          templateId: parseInt(templateId),
          contactId: contactId ? parseInt(contactId) : undefined,
          clientName,
          clientEmail: clientEmail || null,
          clientPhone: clientPhone || null,
          clientAddress: clientAddress || null,
          status: QuoteStatus.DRAFT,
          userId: req.user!.id,
          companyId: req.company!.id, 
          subtotal: parsedSubtotal,
          total: parsedTotal,
          downPaymentValue: parsedDownPayment,
          downPaymentType: downPaymentType || 'percentage',
          discountType: discountType || 'percentage',
          discountValue: parsedDiscountValue,
          taxRate: parsedTaxRate,
          remainingBalance: parsedRemainingBalance,
          notes: notes || '',
          content: {
            products: selectedProducts.map((product: any) => ({
              ...product,
              price: parseFloat(product.price?.toString() || '0') || 0,
              quantity: parseInt(product.quantity?.toString() || '1') || 1
            })),
            calculations: {
              subtotal: parsedSubtotal,
              total: parsedTotal,
              downPayment: parsedDownPayment,
              remainingBalance: parsedRemainingBalance,
              discount: parsedDiscountValue,
              tax: parsedTaxRate
            },
          },
        })
        .returning();

      res.json(quote);
    } catch (error) {
      console.error('Error creating quote:', error);
      res.status(500).json({ message: "Server error creating quote" });
    }
  });

  app.put("/api/quotes/:id", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const { id } = req.params;
      const {
        categoryId,
        templateId,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        selectedProducts = [],
        total,
        downPaymentValue,
        downPaymentType,
        discountType,
        discountValue,
        taxRate,
        subtotal,
        remainingBalance,
        notes,
        status,
        contactId
      } = req.body;

      // Parse numeric values with fallbacks
      const parsedTotal = parseFloat(total?.toString() || '0') || 0;
      const parsedDownPayment = parseFloat(downPaymentValue?.toString() || '0') || 0;
      const parsedSubtotal = parseFloat(subtotal?.toString() || '0') || 0;
      const parsedRemainingBalance = parseFloat(remainingBalance?.toString() || '0') || 0;
      const parsedDiscountValue = parseFloat(discountValue?.toString() || '0') || 0;
      const parsedTaxRate = parseFloat(taxRate?.toString() || '0') || 0;

      const [quote] = await db.update(quotes)
        .set({
          categoryId: parseInt(categoryId),
          templateId: parseInt(templateId),
          contactId: contactId ? parseInt(contactId) : undefined,
          clientName,
          clientEmail: clientEmail || null,
          clientPhone: clientPhone || null,
          clientAddress: clientAddress || null,
          subtotal: parsedSubtotal,
          total: parsedTotal,
          downPaymentValue: parsedDownPayment,
          downPaymentType: downPaymentType || 'percentage',
          discountType: discountType || 'percentage',
          discountValue: parsedDiscountValue,
          taxRate: parsedTaxRate,
          remainingBalance: parsedRemainingBalance,
          notes: notes || '',
          status: status || QuoteStatus.DRAFT,
          content: {
            products: selectedProducts.map((product: any) => ({
              ...product,
              price: parseFloat(product.price?.toString() || '0') || 0,
              quantity: parseInt(product.quantity?.toString() || '1') || 1
            })),
            calculations: {
              subtotal: parsedSubtotal,
              total: parsedTotal,
              downPayment: parsedDownPayment,
              remainingBalance: parsedRemainingBalance,
              discount: parsedDiscountValue,
              tax: parsedTaxRate
            },
          },
        })
        .where(eq(quotes.id, parseInt(id)))
        .returning();

      res.json(quote);
    } catch (error) {
      console.error('Error updating quote:', error);
      res.status(500).json({ message: "Server error updating quote" });
    }
  });

  app.get("/api/quotes", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const userQuotes = await db.query.quotes.findMany({
        where: and(eq(quotes.userId, req.user!.id), eq(quotes.companyId, req.company.id)), 
        with: {
          category: true,
          template: true,
        },
        orderBy: (quotes, { desc }) => [desc(quotes.updatedAt)],
      });
      res.json(userQuotes);
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ message: "Server error fetching quotes" });
    }
  });

  app.delete("/api/quotes/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Delete the quote
      await db.delete(quotes).where(eq(quotes.id, parseInt(id)));
      res.json({ message: "Quote deleted successfully" });
    } catch (error) {
      console.error('Error deleting quote:', error);
      res.status(500).json({ message: "Server error deleting quote" });
    }
  });

  // Permission Management Routes
  app.get("/api/permissions", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const allPermissions = await db.query.tablePermissions.findMany({
        orderBy: (tablePermissions, { asc }) => [
          asc(tablePermissions.tableName),
          asc(tablePermissions.roleId),
        ],
      });
      res.json(allPermissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/permissions", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { tableName, roleId, permissionType, isAllowed } = req.body;

      // Validate input
      if (!tableName || !roleId || !permissionType) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if permission already exists
      const existingPermission = await db.query.tablePermissions.findFirst({
        where: and(
          eq(tablePermissions.tableName, tableName),
          eq(tablePermissions.roleId, roleId),
          eq(tablePermissions.permissionType, permissionType)
        ),
      });

      let permission;

      if (existingPermission) {
        // Update existing permission
        [permission] = await db.update(tablePermissions)
          .set({ 
            isAllowed,
            updatedAt: new Date()
          })
          .where(eq(tablePermissions.id, existingPermission.id))
          .returning();
      } else {
        // Create new permission
        [permission] = await db.insert(tablePermissions)
          .values({
            tableName,
            roleId,
            permissionType,
            isAllowed,
            createdBy: req.user!.id,
          })
          .returning();
      }

      res.json(permission);
    } catch (error) {
      console.error('Error updating permission:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Bulk permission update
  app.post("/api/permissions/bulk", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const { tableName, roleId, isAllowed } = req.body;

      // Update all permission types for the given table and role
      const permissions = await Promise.all(
        Object.values(PermissionType).map(async (permissionType) => {
          const [permission] = await db.update(tablePermissions)
            .set({ isAllowed })
            .where(and(
              eq(tablePermissions.tableName, tableName),
              eq(tablePermissions.roleId, roleId),
              eq(tablePermissions.permissionType, permissionType)
            ))
            .returning();
          return permission;
        })
      );

      res.json(permissions);
    } catch (error) {
      console.error('Error bulk updating permissions:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Export quote as PDF
  app.get("/api/quotes/:id/export/pdf", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const { id } = req.params;
      const quote = await db.query.quotes.findFirst({
        where: and(eq(quotes.id, parseInt(id)), eq(quotes.companyId, req.company.id)), 
        with: {
          category: true,
          template: true,
        },
      });

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=quote-${quote.number}.pdf`);
      doc.pipe(res);

      // Add company header
      doc.fontSize(20).text('QuoteBuilder', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`Quote #${quote.number}`, { align: 'center' });
      doc.moveDown();

      // Add quote details
      doc.fontSize(12);
      doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`);
      doc.text(`Status: ${quote.status}`);
      doc.moveDown();

      // Client information
      doc.fontSize(14).text('Client Information');
      doc.fontSize(12);
      doc.text(`Name: ${quote.clientName}`);
      doc.text(`Email: ${quote.clientEmail}`);
      if (quote.clientPhone) doc.text(`Phone: ${quote.clientPhone}`);
      if (quote.clientAddress) doc.text(`Address: ${quote.clientAddress}`);
      doc.moveDown();

      // Products
      doc.fontSize(14).text('Products');
      doc.fontSize(12);
      const products = quote.content.products;
      products.forEach((product: any) => {
        doc.text(`${product.name} - ${product.quantity} x $${product.price} = $${product.quantity * product.price}`);
      });
      doc.moveDown();

      // Financial summary
      doc.fontSize(14).text('Summary');
      doc.fontSize(12);
      doc.text(`Subtotal: $${quote.subtotal}`);
      if (quote.discountValue) {
        doc.text(`Discount: ${quote.discountType === 'percentage' ? quote.discountValue + '%' : '$' + quote.discountValue}`);
      }
      if (quote.taxRate) {
        doc.text(`Tax Rate: ${quote.taxRate}%`);
      }
      doc.text(`Total: $${quote.total}`);
      if (quote.downPaymentValue) {
        doc.text(`Down Payment: ${quote.downPaymentType === 'percentage' ? quote.downPaymentValue + '%' : '$' + quote.downPaymentValue}`);
        doc.text(`Remaining Balance: $${quote.remainingBalance}`);
      }
      doc.moveDown();

      // Notes
      if (quote.notes) {
        doc.fontSize(14).text('Notes');
        doc.fontSize(12).text(quote.notes);
      }

      doc.end();
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: "Error generating PDF" });
    }
  });

  // Export quotes as CSV
  app.get("/api/quotes/export/csv", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const quotes = await db.query.quotes.findMany({
        where: and(eq(quotes.userId, req.user!.id), eq(quotes.companyId, req.company.id)), 
        with: {
          category: true,
          template: true,
        },
        orderBy: (quotes, { desc }) => [desc(quotes.createdAt)],
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=quotes.csv');

      const csvWriter = createObjectCsvWriter({
        path: 'stdout',
        header: [
          { id: 'number', title: 'Quote Number' },
          { id: 'clientName', title: 'Client Name' },
          { id: 'clientEmail', title: 'Client Email' },
          { id: 'status', title: 'Status' },
          { id: 'total', title: 'Total' },
          { id: 'category', title: 'Category' },
          { id: 'createdAt', title: 'Created At' }
        ]
      });

      const records = quotes.map(quote => ({
        number: quote.number,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        status: quote.status,
        total: quote.total,
        category: quote.category.name,
        createdAt: new Date(quote.createdAt).toLocaleDateString()
      }));

      // Write to a buffer first since we're using stdout
      const chunks: any[] = [];
      const writableStream = new Readable();
      writableStream._read = () => {};

      await csvWriter.writeRecords(records)
        .then(() => {
          writableStream.push(null);
        });

      writableStream.on('data', chunk => chunks.push(chunk));
      writableStream.on('end', () => {
        const result = Buffer.concat(chunks).toString();
        res.send(result);
      });

    } catch (error) {
      console.error('Error generating CSV:', error);
      res.status(500).json({ message: "Error generating CSV" });
    }
  });

  // Contact Management Routes
  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const allContacts = await db.query.contacts.findMany({
        where: eq(contacts.companyId, req.company.id), 
        orderBy: (contacts, { desc }) => [desc(contacts.updatedAt)],
      });
      res.json(allContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const contact = req.body;

      // Convert arrays to JSON strings
      contact.productInterests = JSON.stringify(contact.productInterests || []);
      contact.tags = JSON.stringify(contact.tags || []);

      const [newContact] = await db.insert(contacts)
        .values({
          ...contact,
          createdAt: new Date(),
          updatedAt: new Date(),
          companyId: req.company!.id 
        })
        .returning();

      res.json(newContact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ message: "Server error creating contact" });
    }
  });

  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const { id } = req.params;
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, parseInt(id)), eq(contacts.companyId, req.company.id)), 
      });

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Convert arrays to JSON strings
      if (updates.productInterests) {
        updates.productInterests = JSON.stringify(updates.productInterests);
      }
      if (updates.tags) {
        updates.tags = JSON.stringify(updates.tags);
      }

      const [updatedContact] = await db.update(contacts)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, parseInt(id)))
        .returning();

      res.json(updatedContact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const { id } = req.params;

      // Check if contact exists
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, parseInt(id)), eq(contacts.companyId, req.company.id)), 
      });

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Check if contact has any quotes
      const quoteWithContact = await db.query.quotes.findFirst({
        where: eq(quotes.contactId, parseInt(id)),
      });

      if (quoteWithContact) {
        return res.status(400).json({ 
          message: "Cannot delete contact with associated quotes" 
        });
      }

      // Delete related records first
      await db.delete(contactNotes)
        .where(eq(contactNotes.contactId, parseInt(id)));
      await db.delete(contactTasks)
        .where(eq(contactTasks.contactId, parseInt(id)));
      await db.delete(contactDocuments)
        .where(eq(contactDocuments.contactId, parseInt(id)));
      await db.delete(contactPhotos)
        .where(eq(contactPhotos.contactId, parseInt(id)));

      // Delete the contact
      await db.delete(contacts)
        .where(eq(contacts.id, parseInt(id)));

      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Custom fields management
  app.get("/api/contact-custom-fields", requireAuth, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(403).json({ message: "Company access required" });
      }
      const fields = await db.query.contactCustomFields.findMany({
        where: eq(contactCustomFields.companyId, req.company.id), 
        orderBy: (fields, { asc }) => [asc(fields.name)],
      });
      res.json(fields);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/contact-custom-fields", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const result = insertContactCustomFieldSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid input", 
          errors: result.error.issues 
        });
      }

      // Convert options array to JSON string if present
      const fieldData = {
        ...result.data,
        options: result.data.options ? JSON.stringify(result.data.options) : null,
        companyId: req.company!.id 
      };

      const [field] = await db.insert(contactCustomFields)
        .values(fieldData)
        .returning();

      res.json(field);
    } catch (error) {
      console.error('Error creating custom field:', error);
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