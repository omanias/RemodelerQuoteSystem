import { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { companies, type Company, type User, users } from "@db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      company?: Company;
      user?: User;
    }
    interface Session {
      userId?: number;
    }
  }
}

export async function companyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hostname = req.hostname;

    // Skip middleware for public API endpoints
    if (req.path === '/api/auth/login' ||
        req.path === '/api/auth/logout' ||
        req.path === '/api/auth/user' ||
        req.path.startsWith('/api/companies')) {
      return next();
    }

    // In subdomain mode, verify the company
    if (hostname !== 'localhost' && !hostname.includes('.')) {
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.subdomain, hostname))
        .limit(1);

      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }

      req.company = company;
    }

    next();
  } catch (error) {
    console.error('Company middleware error:', error);
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      next(error);
    }
  };
}

export function requireCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.company) {
    return res.status(403).json({ message: "Company access required" });
  }
  next();
}

export function requireSameCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.company || req.user.companyId !== req.company.id) {
    return res.status(403).json({ message: "Invalid company access" });
  }
  next();
}