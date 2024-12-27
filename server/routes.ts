import { Express } from "express";
import { createServer } from "http";
import { getAuth } from "firebase-admin/auth";
import { db } from "@db";
import { users, quotes, products, templates, UserRole, QuoteStatus } from "@db/schema";
import { eq } from "drizzle-orm";
import "./firebase"; // Initialize Firebase Admin

// Middleware to verify Firebase token
const authenticateToken = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log("No token provided");
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      console.log("Decoded token:", decodedToken.email);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Token verification failed:", error);
      res.status(401).json({ message: "Invalid token" });
    }
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

// Middleware to check user role
const checkRole = (allowedRoles: string[]) => async (req: any, res: any, next: any) => {
  try {
    console.log("Checking role for user:", req.user.email);
    const dbUser = await db.query.users.findFirst({
      where: eq(users.email, req.user.email),
    });

    console.log("Found user in DB:", dbUser);

    if (!dbUser || !allowedRoles.includes(dbUser.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error("Role check error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Auth routes
  app.get("/api/auth/user", authenticateToken, async (req: any, res) => {
    try {
      console.log("Getting user data for:", req.user.email);
      const user = await db.query.users.findFirst({
        where: eq(users.email, req.user.email),
      });

      if (!user) {
        console.log("Creating new user");
        // Create new user if it doesn't exist
        const [newUser] = await db.insert(users).values({
          uid: req.user.uid,
          email: req.user.email!,
          name: req.user.name || req.user.email!.split("@")[0],
          role: req.user.email === 'admin@quotebuilder.com' ? UserRole.ADMIN : UserRole.SALES_REP,
        }).returning();

        console.log("Created new user:", newUser);
        res.json(newUser);
      } else {
        console.log("Returning existing user:", user);
        res.json(user);
      }
    } catch (error) {
      console.error("User fetch error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Quote routes
  app.get(
    "/api/quotes",
    authenticateToken,
    checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP]),
    async (req: any, res) => {
      try {
        const userQuotes = await db.query.quotes.findMany({
          where: eq(quotes.userId, req.dbUser.id),
          orderBy: (quotes, { desc }) => [desc(quotes.createdAt)],
        });
        res.json(userQuotes);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  app.post(
    "/api/quotes",
    authenticateToken,
    checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP]),
    async (req: any, res) => {
      try {
        const { clientName, clientEmail, templateId, content } = req.body;

        // Generate a quote number using timestamp
        const timestamp = new Date().getTime().toString();
        const quoteNumber = `Q${timestamp}`;

        const [newQuote] = await db.insert(quotes).values({
          number: quoteNumber,
          clientName,
          clientEmail,
          status: QuoteStatus.DRAFT,
          total: 0, // Will be calculated based on products
          content,
          userId: req.dbUser.id,
          templateId,
        }).returning();

        res.json(newQuote);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  // Product routes
  app.get(
    "/api/products",
    authenticateToken,
    checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP]),
    async (_req, res) => {
      try {
        const allProducts = await db.query.products.findMany({
          orderBy: (products, { asc }) => [asc(products.name)],
        });
        res.json(allProducts);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  app.post(
    "/api/products",
    authenticateToken,
    checkRole([UserRole.ADMIN, UserRole.MANAGER]),
    async (req: any, res) => {
      try {
        const { name, category, basePrice, unit, isActive, variations } = req.body;
        const [newProduct] = await db.insert(products).values({
          name,
          category,
          basePrice,
          unit,
          isActive,
          variations,
        }).returning();

        res.json(newProduct);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  // Template routes
  app.get(
    "/api/templates",
    authenticateToken,
    checkRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP]),
    async (_req, res) => {
      try {
        const allTemplates = await db.query.templates.findMany({
          orderBy: (templates, { desc }) => [desc(templates.isDefault), desc(templates.updatedAt)],
        });
        res.json(allTemplates);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  app.post(
    "/api/templates",
    authenticateToken,
    checkRole([UserRole.ADMIN]),
    async (req: any, res) => {
      try {
        const { name, category, content, isDefault } = req.body;
        const [newTemplate] = await db.insert(templates).values({
          name,
          category,
          content,
          isDefault,
        }).returning();

        res.json(newTemplate);
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    }
  );

  return httpServer;
}