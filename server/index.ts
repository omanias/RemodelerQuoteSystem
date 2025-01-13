import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { db } from "@db";
import { sql } from "drizzle-orm";
import type { Server } from "http";

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

const app = express();

// Basic middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up session store with enhanced security
const MemoryStoreSession = MemoryStore(session);

// Enhanced session configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStoreSession({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  name: 'sessionId',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  }
};

if (app.get("env") === "production") {
  app.set("trust proxy", 1);
  sessionConfig.cookie.secure = true;
}

// Initialize session before any routes
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// CORS configuration for development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.endsWith('.replit.dev') || origin.includes('localhost'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Security headers middleware
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  });
  next();
});

// Request logging middleware with better error handling
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Safely capture JSON responses
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    try {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    } catch (error) {
      log(`Error in json response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return originalResJson.apply(res, [{ error: 'Internal Server Error' }]);
    }
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch (error) {
          logLine += ' :: [Response cannot be stringified]';
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  let server: Server | undefined;

  try {
    // Verify database connection before starting
    await db.execute(sql`SELECT 1`).catch((error) => {
      log("Database connection failed");
      throw error;
    });
    log("Database connection verified");

    server = registerRoutes(app);

    // Register routes before error handling middleware
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Global error handling middleware - must be after routes
    app.use((err: Error | APIError, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);

      if (err instanceof APIError) {
        return res.status(err.statusCode).json({
          error: err.message,
          details: err.details
        });
      }

      // For unhandled errors, return 500
      const status = 500;
      const message = process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error'
        : err.message || 'Internal Server Error';

      res.status(status).json({ error: message });
    });

    // Handle process termination gracefully
    const gracefulShutdown = () => {
      log('Shutting down gracefully...');
      if (server) {
        server.close(() => {
          log('Server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    const PORT = 5000;
    server.listen(PORT, "0.0.0.0", () => {
      log(`Server started on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();