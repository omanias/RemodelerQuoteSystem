import type { Express } from "express";
import { db } from "@db";
import { users, companies, quotes, contacts, products, categories, templates, companyAccess, UserRole, UserStatus, notes, notifications, quoteSignatures } from "@db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { createServer, type Server } from "http";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { companyMiddleware, requireAuth, requireCompanyAccess, requireRole } from "./middleware/company";
import { count } from "drizzle-orm";
import { setupWebSocket } from "./websocket";
import multer from "multer";
import { storage, UPLOADS_PATH } from "./storage";
import express from "express";

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

const upload = multer({ storage });

export function registerRoutes(app: Express): Server {
  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOADS_PATH));

  const httpServer = createServer(app);

  // Setup WebSocket server
  const wsServer = setupWebSocket(httpServer, app);

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

  // Add detailed contact endpoint
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

  // Add endpoint to get quotes for a specific contact
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

  // Add PUT endpoint for updating contacts
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
        categoryId
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

  // Update the quote update endpoint with proper types
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
        paymentMethod,
        discountType,
        discountValue,
        discountCode,
        downPaymentType,
        downPaymentValue,
        taxRate,
        taxAmount,
        remainingBalance
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
      if (status === "ACCEPTED" && signature) {
        // Store the signature
        await db.insert(quoteSignatures).values({
          quoteId,
          signedBy: existingQuote.clientName,
          signatureType: "DRAWN" as const,
          signatureData: signature,
          ipAddress: req.ip || "",
          userAgent: req.get("user-agent") || "",
          geoLocation: req.headers["x-forwarded-for"]
            ? { ip: req.headers["x-forwarded-for"] as string }
            : null,
        });
      }

      // Parse numeric values with fallback to existing values
      const parseNumeric = (value: any, fallback: number | null = null) => {
        if (value === undefined || value === null || value === '') return fallback;
        const parsed = parseFloat(value.toString());
        return isNaN(parsed) ? fallback : parsed;
      };

      // If status has changed, create a notification and send via WebSocket
      if (status && status !== existingQuote.status) {
        // Create a notification
        const [notification] = await db
          .insert(notifications)
          .values({
            type: "QUOTE_STATUS_CHANGED" as const,
            title: "Quote Status Updated",
            message: `Quote #${existingQuote.number} status changed from ${existingQuote.status} to ${status}`,
            userId: existingQuote.userId,
            companyId,
            deliveryMethod: "IN_APP" as const,
            data: {
              quoteId,
              oldStatus: existingQuote.status,
              newStatus: status
            }
          })
          .returning();

        // Send notification via WebSocket
        wsServer.broadcast(existingQuote.userId, {
          type: "NEW_NOTIFICATION",
          payload: notification
        });

        // Create a note for the status change
        await db.insert(notes).values({
          content: `Quote status changed from ${existingQuote.status} to ${status}`,
          userId,
          quoteId,
          contactId: existingQuote.contactId!,
          type: "QUOTE" as const
        });
      }

      // Update the quote
      const [updatedQuote] = await db
        .update(quotes)
        .set({
          contactId: contactId ? parseInt(contactId.toString()) : existingQuote.contactId,
          templateId: templateId ? parseInt(templateId.toString()) : existingQuote.templateId,
          categoryId: categoryId ? parseInt(categoryId.toString()) : existingQuote.categoryId,
          clientName: clientName || existingQuote.clientName,
          clientEmail: clientEmail || existingQuote.clientEmail,
          clientPhone: clientPhone || existingQuote.clientPhone,
          clientAddress: clientAddress || existingQuote.clientAddress,
          status: (status || existingQuote.status) as typeof existingQuote.status,
          content: content || existingQuote.content,
          subtotal: parseNumeric(subtotal, existingQuote.subtotal),
          total: parseNumeric(total, existingQuote.total),
          notes: notes || existingQuote.notes,
          downPaymentType: downPaymentType || existingQuote.downPaymentType,
          downPaymentValue: parseNumeric(downPaymentValue, existingQuote.downPaymentValue),
          discountType: discountType || existingQuote.discountType,
          discountValue: parseNumeric(discountValue, existingQuote.discountValue),
          taxRate: parseNumeric(taxRate, existingQuote.taxRate),
          remainingBalance: parseNumeric(remainingBalance, existingQuote.remainingBalance),
          userId,
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
          },
          signatures: true
        },
        limit: 1
      });

      res.json(quoteWithRelations);
    } catch (error) {
      console.error('Error updating quote:', error);
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

  // Update the company query and access checks with proper SQL types
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

  // Update company endpoint
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
          streetAddress: streetAddress || null,
          suite: suite || null,
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

  // Add notification routes
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
      res.status(500).json({ message: "Server error" });
    }
  });

  // Add notes endpoints
  app.get("/api/contacts/:id/notes", requireAuth, requireCompanyAccess, async (req, res) => {
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
          type: "CONTACT" as const
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

  // Modify the quotes creation endpoint to add notes
  app.post("/api/quotes", requireAuth, requireCompanyAccess, async (req, res) => {
    try {
      const { contactId, templateId, categoryId, content, clientName, status } = req.body;
      const userId = req.session.userId;
      const companyId = req.company!.id;

      // If creating from contact, get the contact's email
      let clientEmail = null;
      if (contactId) {
        const [contact] = await db
          .select()
          .from(contacts)
          .where(eq(contacts.id, contactId))
          .limit(1);

        if (contact) {
          clientEmail = contact.primaryEmail;
        }
      }

      // Generate a quote number (you might want to implement a more sophisticated system)
      const quoteNumber = `Q${Date.now()}`;

      // Insert the quote
      const [newQuote] = await db
        .insert(quotes)
        .values({
          number: quoteNumber,
          categoryId,
          templateId,
          contactId,
          clientName,
          clientEmail: clientEmail || 'temp@example.com', // Provide a default if not available
          status,
          content,
          userId,
          companyId,
          subtotal: 0, // You'll need to calculate these based on your business logic
          total: 0,
        })
        .returning();

      // Add a note for the contact when a quote is created
      if (contactId) {
        await db
          .insert(notes)
          .values({
            content: `Quote #${quoteNumber} created`,
            contactId,
            userId,
            type: "QUOTE" as const,
            quoteId: newQuote.id
          });
      }

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
      console.error('Error in quote creation:', error);
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

  // First verify quote belongs to company
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
          type: "QUOTE" as const
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

  return httpServer;
}