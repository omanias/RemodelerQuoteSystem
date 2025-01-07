import type { Express } from "express";
import { db } from "@db";
import { users, companies, quotes, contacts, products, categories, templates, companyAccess, UserRole, UserStatus, notes, notifications, QuoteStatus, LeadStatus, LeadSource, PropertyType } from "@db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { setupWebSocket } from "./websocket";
import multer from "multer";
import { storage, UPLOADS_PATH } from "./storage";
import express from "express";
import { companyMiddleware, requireAuth, requireCompanyAccess } from "./middleware/company";

// Add custom interface for Request to include user property
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

const upload = multer({ storage });

export function registerRoutes(app: Express): Server {
  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOADS_PATH));

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

      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.companyId = companyId;

      // For MULTI_ADMIN, get their accessible companies
      if (user.role === UserRole.MULTI_ADMIN) {
        const accessibleCompanies = await db
          .select({ companyId: companyAccess.companyId })
          .from(companyAccess)
          .where(eq(companyAccess.userId, user.id));

        req.session.accessibleCompanyIds = accessibleCompanies.map(c => c.companyId);
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: req.session.companyId,
        accessibleCompanyIds: req.session.accessibleCompanyIds
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Server error" });
    }
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


  // Create new quote
  app.post("/api/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const {
        contactId,
        templateId,
        categoryId,
        content,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        status,
        subtotal,
        total,
        notes,
        signature,
        downPaymentType,
        downPaymentValue,
        discountType,
        discountValue,
        taxRate,
        remainingBalance,
        paymentMethod
      } = req.body;

      const userId = req.session.userId;
      const companyId = req.company!.id;

      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }

      // Generate a unique quote number
      const quoteNumber = `Q${Date.now()}`;

      let signatureData = null;
      if (signature) {
        signatureData = {
          data: signature.data,
          timestamp: new Date().toISOString(),
          metadata: {
            browserInfo: req.headers['user-agent'] || 'unknown',
            ipAddress: req.ip || 'unknown',
            signedAt: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        };
      }

      // Parse numeric values with fallback to 0
      const parseNumeric = (value: any) => {
        if (value === undefined || value === null || value === '') return 0;
        const parsed = parseFloat(value.toString());
        return isNaN(parsed) ? 0 : parsed;
      };

      // Create the quote with all calculation fields
      const [newQuote] = await db
        .insert(quotes)
        .values({
          number: quoteNumber,
          categoryId: parseInt(categoryId),
          templateId: parseInt(templateId),
          contactId: contactId ? parseInt(contactId) : null,
          clientName,
          clientEmail: clientEmail || '',
          clientPhone: clientPhone || '',
          clientAddress: clientAddress || '',
          status: (status || "DRAFT") as keyof typeof QuoteStatus,
          content,
          subtotal: parseNumeric(subtotal),
          total: parseNumeric(total),
          downPaymentType: downPaymentType || null,
          downPaymentValue: parseNumeric(downPaymentValue),
          discountType: discountType || null,
          discountValue: parseNumeric(discountValue),
          taxRate: parseNumeric(taxRate),
          remainingBalance: parseNumeric(remainingBalance),
          paymentMethod: paymentMethod || null,
          notes,
          userId,
          companyId,
          signature: signatureData,
        })
        .returning();

      // Get full quote data with relations
      const [quoteWithRelations] = await db.query.quotes.findMany({
        where: eq(quotes.id, newQuote.id),
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
        limit: 1
      });

      res.json(quoteWithRelations);
    } catch (error) {
      console.error('Error creating quote:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update quote
  app.put("/api/quotes/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      const userId = req.session.userId;
      const companyId = req.company!.id;
      const {
        status,
        signature,
        contactId,
        templateId,
        categoryId,
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
        content,
        subtotal,
        total,
        notes,
        downPaymentType,
        downPaymentValue,
        discountType,
        discountValue,
        taxRate,
        remainingBalance,
        paymentMethod
      } = req.body;

      // First verify quote exists and belongs to company
      const [existingQuote] = await db
        .select()
        .from(quotes)
        .where(and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, companyId)
        ))
        .limit(1);

      if (!existingQuote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // If status is being changed to ACCEPTED and signature is provided
      let signatureData = existingQuote.signature;
      if (status === "ACCEPTED" && signature) {
        signatureData = {
          data: signature.data,
          timestamp: new Date().toISOString(),
          metadata: {
            browserInfo: req.headers['user-agent'] || 'unknown',
            ipAddress: req.ip || 'unknown',
            signedAt: new Date().toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        };
      }

      // Parse numeric values with fallback to existing values
      const parseNumeric = (value: any, fallback: number | null = null) => {
        if (value === undefined || value === null || value === '') return fallback;
        const parsed = parseFloat(value.toString());
        return isNaN(parsed) ? fallback : parsed;
      };

      // Update the quote
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          contactId: contactId ? parseInt(contactId) : existingQuote.contactId,
          templateId: templateId ? parseInt(templateId) : existingQuote.templateId,
          categoryId: categoryId ? parseInt(categoryId) : existingQuote.categoryId,
          clientName: clientName || existingQuote.clientName,
          clientEmail: clientEmail || existingQuote.clientEmail,
          clientPhone: clientPhone || existingQuote.clientPhone,
          clientAddress: clientAddress || existingQuote.clientAddress,
          status: (status || existingQuote.status) as keyof typeof QuoteStatus,
          content: content || existingQuote.content,
          subtotal: parseNumeric(subtotal, existingQuote.subtotal),
          total: parseNumeric(total, existingQuote.total),
          downPaymentType: downPaymentType || existingQuote.downPaymentType,
          downPaymentValue: parseNumeric(downPaymentValue, existingQuote.downPaymentValue),
          discountType: discountType || existingQuote.discountType,
          discountValue: parseNumeric(discountValue, existingQuote.discountValue),
          taxRate: parseNumeric(taxRate, existingQuote.taxRate),
          remainingBalance: parseNumeric(remainingBalance, existingQuote.remainingBalance),
          paymentMethod: paymentMethod || existingQuote.paymentMethod,
          notes: notes || existingQuote.notes,
          userId,
          signature: signatureData,
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quoteId))
        .returning();

      // Get full quote data with relations
      const [quoteWithRelations] = await db.query.quotes.findMany({
        where: eq(quotes.id, updatedQuote.id),
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
        limit: 1
      });

      res.json(quoteWithRelations);
    } catch (error) {
      console.error('Error updating quote:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Get all quotes
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

  // Get quote by ID
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

  app.get("/api/contacts/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const [contactData] = await db.query.contacts.findMany({
        where: and(
          eq(contacts.id, parseInt(req.params.id)),
          eq(contacts.companyId, req.company!.id)
        ),
        with: {
          assignedUser: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          },
          category: true,
          quotes: {
            with: {
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
            }
          }
        },
        limit: 1
      });

      if (!contactData) {
        return res.status(404).json({ message: "Contact not found" });
      }

      res.json(contactData);
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/contacts/:id/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quotesData = await db.query.quotes.findMany({
        where: and(
          eq(quotes.contactId, parseInt(req.params.id)),
          eq(quotes.companyId, req.company!.id)
        ),
        with: {
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
      console.error('Error fetching contact quotes:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Delete contact
  app.delete("/api/contacts/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const companyId = req.company!.id;

      // First verify contact exists and belongs to company
      const [existingContact] = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, companyId)
        ))
        .limit(1);

      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Delete the contact (related records will be deleted via CASCADE)
      await db
        .delete(contacts)
        .where(and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, companyId)
        ));

      console.log(`Contact ${contactId} successfully deleted for company ${companyId}`);
      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/contacts/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const companyId = req.company!.id;
      const {
        firstName,
        lastName,
        primaryEmail,
        primaryPhone,
        secondaryPhone,
        address,
        leadStatus,
        leadSource,
        propertyType,
        projectTimeline,
        budget,
        notes,
        assignedUserId,
        categoryId,
        secondaryEmail
      } = req.body;

      // First verify contact belongs to company
      const [existingContact] = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, companyId)
        ))
        .limit(1);

      if (!existingContact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Update the contact
      const [updatedContact] = await db
        .update(contacts)
        .set({
          firstName: firstName || existingContact.firstName,
          lastName: lastName || existingContact.lastName,
          primaryEmail: primaryEmail || existingContact.primaryEmail,
          primaryPhone: primaryPhone || existingContact.primaryPhone,
          secondaryPhone: secondaryPhone || existingContact.secondaryPhone,
          address: address || existingContact.address,
          leadStatus: leadStatus || existingContact.leadStatus,
          leadSource: leadSource || existingContact.leadSource,
          propertyType: propertyType || existingContact.propertyType,
          projectTimeline: projectTimeline || existingContact.projectTimeline,
          budget: budget !== undefined ? parseFloat(budget) : existingContact.budget,
          notes: notes || existingContact.notes,
          assignedUserId: assignedUserId ? parseInt(assignedUserId) : existingContact.assignedUserId,
          categoryId: categoryId ? parseInt(categoryId) : existingContact.categoryId,
          secondaryEmail: secondaryEmail || existingContact.secondaryEmail,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, contactId))
        .returning();

      // Get full contact data with relations
      const [contactWithRelations] = await db.query.contacts.findMany({
        where: eq(contacts.id, updatedContact.id),
        with: {
          assignedUser: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          },
          category: true,
          quotes: {
            with: {
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
            }
          }
        },
        limit: 1
      });

      res.json(contactWithRelations);
    } catch (error) {
      console.error('Error updating contact:', error);
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

  // Create template
  app.post("/api/templates", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const {
        name,
        categoryId,
        termsAndConditions,
        isDefault,
        imageUrls,
      } = req.body;

      // Create the template
      const [newTemplate] = await db
        .insert(templates)
        .values({
          name,
          categoryId: parseInt(categoryId),
          termsAndConditions: termsAndConditions || null,
          isDefault: isDefault || false,
          imageUrls: imageUrls || [],
          companyId: req.company!.id,
        })
        .returning();

      // Get template with relations
      const [templateWithRelations] = await db.query.templates.findMany({
        where: eq(templates.id, newTemplate.id),
        with: {
          category: true,
        },
        limit: 1,
      });

      res.json(templateWithRelations);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Update template
  app.put("/api/templates/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const {
        name,
        categoryId,
        termsAndConditions,
        isDefault,
        imageUrls,
      } = req.body;

      // First verify template exists and belongs to company
      const [existingTemplate] = await db
        .select()
        .from(templates)
        .where(and(
          eq(templates.id, templateId),
          eq(templates.companyId, req.company!.id)
        ))
        .limit(1);

      if (!existingTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Update the template
      const [updatedTemplate] = await db
        .update(templates)
        .set({
          name: name || existingTemplate.name,
          categoryId: categoryId ? parseInt(categoryId) : existingTemplate.categoryId,
          termsAndConditions: termsAndConditions || existingTemplate.termsAndConditions,
          isDefault: isDefault !== undefined ? isDefault : existingTemplate.isDefault,
          imageUrls: imageUrls || existingTemplate.imageUrls,
          updatedAt: new Date(),
        })
        .where(eq(templates.id, templateId))
        .returning();

      // Get template with relations
      const [templateWithRelations] = await db.query.templates.findMany({
        where: eq(templates.id, updatedTemplate.id),
        with: {
          category: true,
        },
        limit: 1,
      });

      res.json(templateWithRelations);
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/companies", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;
      const [user] = await db
        .select()
        .from(users)
        .where(sql`${users.id} = ${userId}`)
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
            subdomain: companies.subdomain,
            logo: companies.logo,
            phone: companies.phone,
            email: companies.email,
            website: companies.website,
            createdAt: companies.createdAt,
            updatedAt: companies.updatedAt
          })
          .from(companyAccess)
          .innerJoin(
            companies,
            sql`${companyAccess.companyId} = ${companies.id} AND ${companyAccess.userId} = ${userId}`
          )
          .orderBy(companies.name);

        return res.json(accessibleCompanies);
      }

      // Regular users only see their own company
      const [userCompany] = await db
        .select()
        .from(companies)
        .where(sql`${companies.id} = ${user.companyId}`)
        .limit(1);

      return res.json(userCompany ? [userCompany] : []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.put("/api/companies/current", requireAuth, requireCompanyAccess, upload.single('logo'), async (req, res) => {
    try {
      const companyId = req.company!.id;
      const {
        name,
        phone,
        tollFree,
        fax,
        email,
        website,
        streetAddress,
        suite,
        city,
        state,
        zipCode,
        taxId,
        businessHours,
        socialMedia
      } = req.body;

      const logoFile = req.file;
      console.log('Received logo file:', logoFile);

      // Parse JSON strings back to objects
      const parsedBusinessHours = businessHours ? JSON.parse(businessHours) : undefined;
      const parsedSocialMedia = socialMedia ? JSON.parse(socialMedia) : undefined;

      // Update company details
      const [updatedCompany] = await db
        .update(companies)
        .set({
          name: name || req.company!.name,
          logo: logoFile ? `/uploads/${logoFile.filename}` : req.company!.logo,
          phone: phone || null,
          tollFree: tollFree || null,
          fax: fax || null,
          email: email || null,
          website: website || null,
          streetAddress: streetAddress || null,          suite: suite || null,
          city: city || null,
          state: state || null,
          zipCode: zipCode || null,
          taxId: taxId || null,
          businessHours: parsedBusinessHours,
          socialMedia: parsedSocialMedia,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId))
        .returning();

      console.log('Updated company:', updatedCompany);
      res.json(updatedCompany);
    } catch (error) {
      console.error('Error updating company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/companies/current", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(404).json({ message: "No company context found" });
      }

      // Get fresh data from database to ensure we have the latest
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, req.company.id))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error('Error fetching current company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userNotifications = await db.query.notifications.findMany({
        where: sql`${notifications.userId} = ${req.session.userId}`,
        orderBy: (notificationsTable, { desc }) => [desc(notificationsTable.createdAt)],
      });

      res.json(userNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/notifications/mark-read", requireAuth, async (req, res) => {
    try {
      const { notificationIds } = req.body;

      if (!Array.isArray(notificationIds)) {
        return res.status(400).json({ message: "Invalid notification IDs" });
      }

      await db
        .update(notifications)
        .set({ read: true })
        .where(sql`${notifications.userId} = ${req.session.userId} AND ${notifications.id} = ANY(${notificationIds})`);

      res.json({ message: "Notifications marked as read" });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ message: "Server error" });    }
  });

  app.get("/api/api/contacts/:id/notes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const companyId = req.company!.id;

      // First verify contact belongs to company
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, companyId)
        ))
        .limit(1);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Get all notes for this contact, including quoterelated notes
      const notesData = await db.query.notes.findMany({
        where: eq(notes.contactId, contactId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          }
        },
        orderBy: (notesTable, { desc }) => [desc(notesTable.createdAt)],
      });

      res.json(notesData);
    } catch (error) {
      console.error('Error fetching contact notes:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/contacts/:id/notes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const contactId = parseInt(req.params.id);
      const companyId = req.company!.id;
      const userId = req.session.userId;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Note content is required" });
      }

      // First verify contact belongs to company
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.id, contactId),
          eq(contacts.companyId, companyId)
        ))
        .limit(1);

      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Create the note
      const [newNote] = await db
        .insert(notes)
        .values({
          content, contactId,
          userId,
          type: "CONTACT"
        })
        .returning();

      // Get full note data with user info
      const [noteWithUser] = await db.query.notes.findMany({
        where: eq(notes.id, newNote.id),
        with: {
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

      res.json(noteWithUser);
    } catch (error) {
      console.error('Error creating contact note:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/quotes/:id/notes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      const companyId = req.company!.id;

      // First verify quote belongs to company
      const [quote] = await db
        .select()
        .from(quotes)
        .where(and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, companyId)
        ))
        .limit(1);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Get all notes for this quote
      const notesData = await db.query.notes.findMany({
        where: eq(notes.quoteId, quoteId),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          }
        },
        orderBy: (notesTable, { desc }) => [desc(notesTable.createdAt)],
      });

      res.json(notesData);
    } catch (error) {
      console.error('Error fetching quote notes:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/quotes/:id/notes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      const userId = req.session.userId;
      const { content, contactId } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Note content is required" });
      }

      // First verify quote exists and belongs to company
      const [quote] = await db
        .select()
        .from(quotes)
        .where(and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, req.company!.id)
        ))
        .limit(1);

      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Create the note
      const [newNote] = await db
        .insert(notes)
        .values({
          content,
          quoteId,
          userId,
          contactId: contactId || quote.contactId,
          type: "QUOTE"
        })
        .returning();

      // Get full note data with user info
      const [noteWithRelations] = await db.query.notes.findMany({
        where: eq(notes.id, newNote.id),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          },
          contact: true
        },
        limit: 1
      });

      res.json(noteWithRelations);
    } catch (error) {
      console.error('Error creating quote note:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

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

  app.get("/api/companies/current", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      if (!req.company) {
        return res.status(404).json({ message: "No company context found" });
      }

      // Get fresh data from database to ensure we have the latest
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, req.company.id))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      res.json(company);
    } catch (error) {
      console.error('Error fetching current company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Delete quote
  app.delete("/api/quotes/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      const companyId = req.company!.id;

      // First verify quote exists and belongs to company
      const [existingQuote] = await db
        .select()
        .from(quotes)
        .where(and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, companyId)
        ))
        .limit(1);

      if (!existingQuote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Delete the quote directly since we have ON DELETE CASCADE
      await db
        .delete(quotes)
        .where(and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, companyId)
        ));

      console.log(`Quote ${quoteId} successfully deleted for company ${companyId}`);
      res.json({ message: "Quote deleted successfully" });
    } catch (error) {
      console.error('Error deleting quote:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/contacts", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        primaryEmail,
        primaryPhone,
        primaryAddress,
        leadStatus = LeadStatus.NEW,
        leadSource = LeadSource.OTHER,
        propertyType = PropertyType.SINGLE_FAMILY,
        productInterests = "None specified",
        secondaryEmail = null,
        mobilePhone = null,
        projectAddress = null,
        categoryId = null
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !primaryEmail || !primaryPhone || !primaryAddress) {
        return res.status(400).json({
          message: "First name, last name, primary email, primary phone, and primary address are required"
        });
      }

      // Create the contact with defaults for required fields
      const [newContact] = await db
        .insert(contacts)
        .values({
          firstName,
          lastName,
          primaryEmail,
          primaryPhone,
          primaryAddress,
          leadStatus,
          leadSource,
          propertyType,
          productInterests,
          assignedUserId: req.session.userId,
          companyId: req.company!.id,
          secondaryEmail,
          mobilePhone,
          projectAddress,
          categoryId,
          tags: [], // Default empty array since it's notNull
        })
        .returning();

      // Get full contact data with relations
      const [contactWithRelations] = await db.query.contacts.findMany({
        where: eq(contacts.id, newContact.id),
        with: {
          assignedUser: {
            columns: {
              id: true,
              name: true,
              email: true,
              role: true,
            }
          },
          category: true,
        },
        limit: 1
      });

      res.json(contactWithRelations);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add this route after other quote-related routes
  app.get("/api/quotes/:id/pdf", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      const companyId = req.company!.id;

      // Get quote with template data
      const [quoteData] = await db.query.quotes.findMany({
        where: and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, companyId)
        ),
        with: {
          template: true,
        },
        limit: 1
      });

      if (!quoteData) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Get company data
      const [companyData] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!companyData) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Generate PDF
      const pdfBuffer = await generateQuotePDF({
        quote: quoteData,
        company: companyData
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="quote-${quoteData.number}.pdf"`);

      // Send PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating quote PDF:', error);
      res.status(500).json({ message: "Error generating PDF" });
    }
  });

  // Add PDF export route
  app.get("/api/quotes/:id/export/pdf", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      const companyId = req.company!.id;

      // Get quote with all necessary relations
      const [quoteData] = await db.query.quotes.findMany({
        where: and(
          eq(quotes.id, quoteId),
          eq(quotes.companyId, companyId)
        ),
        with: {
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
        limit: 1
      });

      if (!quoteData) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Generate PDF
      const pdfBuffer = await generateQuotePDF({
        quote: quoteData,
        company: req.company!
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="quote-${quoteData.number}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // Send the PDF buffer
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: "Error generating PDF" });
    }
  });
  // Add product deletion route
  app.delete("/api/products/:id", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const companyId = req.company!.id;

      // First verify product exists and belongs to company
      const [existingProduct] = await db
        .select()
        .from(products)
        .where(and(
          eq(products.id, productId),
          eq(products.companyId, companyId)
        ))
        .limit(1);

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Delete the product
      await db
        .delete(products)
        .where(and(
          eq(products.id, productId),
          eq(products.companyId, companyId)
        ));

      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: "Server error" });
    }
  });
  // Add new endpoints for company user management
  app.get("/api/companies/:id/users", requireAuth, async (req, res) => {
    try {
      // Only SUPER_ADMIN and MULTI_ADMIN can view users across companies
      if (req.session.userRole !== UserRole.SUPER_ADMIN &&
        req.session.userRole !== UserRole.MULTI_ADMIN) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const companyId = parseInt(req.params.id);
      const companyUsers = await db
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
        .from(users)
        .where(eq(users.companyId, companyId))
        .orderBy(users.name);

      res.json(companyUsers);
    } catch (error) {
      console.error('Error fetching company users:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add user to company
  app.post("/api/companies/:id/users", requireAuth, async (req, res) => {
    try {
      // Only SUPER_ADMIN can modify user-company relationships
      if (req.session.userRole !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const companyId = parseInt(req.params.id);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Verify company exists
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      // Verify user exists and update their company
      const [updatedUser] = await db
        .update(users)
        .set({
          companyId,
          updatedAt: new Date()
        })
        .where(eq(users.id, parseInt(userId)))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Error assigning user to company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Remove user from company
  app.delete("/api/companies/:id/users/:userId", requireAuth, async (req, res) => {
    try {
      // Only SUPER_ADMIN can modify user-company relationships
      if (req.session.userRole !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const companyId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      // Verify user belongs to company
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.id, userId),
          eq(users.companyId, companyId)
        ))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found in company" });
      }

      // Cannot remove SUPER_ADMIN users
      if (user.role === UserRole.SUPER_ADMIN) {
        return res.status(403).json({ message: "Cannot remove super admin users" });
      }

      // Update user's company to null
      const [updatedUser] = await db
        .update(users)
        .set({
          companyId: null as any, // Type assertion needed due to Drizzle typing
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error('Error removing user from company:', error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Replace the existing user creation route with improved error handling
  app.post("/api/users", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const { name, email, password, role, status, companyId } = req.body;

      // Validate required fields
      if (!name || !email || !password || !role || !status) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // For non-super-admin users, force company assignment to their own company
      const assignedCompanyId = req.session.userRole === UserRole.SUPER_ADMIN
        ? (companyId || req.company!.id)
        : req.company!.id;

      // Check if email already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // Create the user with proper company assignment
      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          password, // Note: In production, ensure password is hashed
          role: role as keyof typeof UserRole,
          status: status as keyof typeof UserStatus,
          companyId: assignedCompanyId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          status: users.status,
          companyId: users.companyId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      res.json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: "Server error creating user" });
    }
  });

  return httpServer;
}