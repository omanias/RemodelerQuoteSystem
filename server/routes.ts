import { Express } from "express";
import { createServer } from "http";
import { db } from "@db";
import { users, quotes, products, templates, UserRole, QuoteStatus, UserStatus, categories } from "@db/schema";
import { eq, ilike } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

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

const requireAuth = async (req: any, res: any, next: any) => {
  try {
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
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: "Server error" });
  }
};

const requireRole = (allowedRoles: string[]) => async (req: any, res: any, next: any) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  } catch (error) {
    console.error('Role middleware error:', error);
    res.status(500).json({ message: "Server error" });
  }
};

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  setupSession(app);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    try {
      console.log(`Login attempt for email: ${email}`);

      // Find or create admin user
      let user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!user && email === "admin@quotebuilder.com") {
        // Create new admin user with correct password hash
        const hashedPassword = await crypto.hash("admin123");
        [user] = await db.insert(users)
          .values({
            email: "admin@quotebuilder.com",
            password: hashedPassword,
            name: "Admin User",
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          })
          .returning();
      }

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Now try to log in
      const isValidPassword = await crypto.compare(password, user.password);
      console.log(`Password validation result: ${isValidPassword}`);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;
      res.json({ 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role,
        status: user.status
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
    res.json(req.user);
  });

  // Categories Routes
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const allCategories = await db.query.categories.findMany({
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
        .values({ name, description })
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
      const allProducts = await db.query.products.findMany({
        with: {
          category: true,
        },
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
        where: eq(categories.id, categoryId),
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
        where: eq(categories.id, categoryId),
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
      const allUsers = await db.query.users.findMany({
        orderBy: (users, { asc }) => [asc(users.name)],
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
      const allTemplates = await db.query.templates.findMany({
        with: {
          category: true,
        },
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
        where: eq(categories.id, categoryId),
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
        where: eq(categories.id, categoryId),
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
  app.post("/api/quotes", requireAuth, async (req, res) => {
    try {
      const { categoryId, templateId, items, total, status, customerInfo } = req.body;

      // Validate quote data
      if (!categoryId || !templateId) {
        return res.status(400).json({ message: "Category and template are required" });
      }

      // Generate quote number
      const currentYear = new Date().getFullYear();
      const latestQuote = await db.query.quotes.findFirst({
        where: ilike(quotes.number, `QT-${currentYear}-%`),
        orderBy: (quotes, { desc }) => [desc(quotes.number)],
      });

      let sequence = 1;
      if (latestQuote) {
        const lastSequence = parseInt(latestQuote.number.split('-')[2]);
        sequence = lastSequence + 1;
      }

      const quoteNumber = `QT-${currentYear}-${sequence.toString().padStart(4, '0')}`;

      const [quote] = await db.insert(quotes)
        .values({
          number: quoteNumber,
          categoryId,
          templateId,
          items,
          total,
          status: status || QuoteStatus.DRAFT,
          customerInfo,
          userId: req.user.id,
        })
        .returning();

      res.json(quote);
    } catch (error) {
      console.error('Error creating quote:', error);
      res.status(500).json({ message: "Server error creating quote" });
    }
  });

  app.get("/api/quotes", requireAuth, async (req, res) => {
    try {
      const userQuotes = await db.query.quotes.findMany({
        where: eq(quotes.userId, req.user.id),
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

  return httpServer;
}