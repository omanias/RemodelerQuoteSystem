import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import express from "express";
import { companyMiddleware, requireAuth, requireCompanyAccess } from "./middleware/company";
import { storage, UPLOADS_PATH } from "./storage";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Set up authentication routes and middleware
  setupAuth(app);

  // Apply company middleware to all other routes
  app.use(companyMiddleware);

  // Serve uploaded files statically
  app.use('/uploads', express.static(UPLOADS_PATH));

  return httpServer;
}