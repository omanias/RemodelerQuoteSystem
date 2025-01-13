import { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { companies, type Company, UserRole } from "@db/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      company?: Company;
      user?: {
        id: number;
        role: keyof typeof UserRole;
        companyId: number;
        [key: string]: any;
      };
    }
    interface Session {
      userId?: number;
      userRole?: keyof typeof UserRole;
      companyId?: number;
      accessibleCompanyIds?: number[];
    }
  }
}

export async function companyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Skip middleware for public API endpoints and static assets
    if (req.path === '/api/auth/login' ||
        req.path === '/api/auth/logout' ||
        req.path === '/api/auth/user' ||
        req.path.startsWith('/api/companies/search') ||
        !req.path.startsWith('/api/')) {
      return next();
    }

    // If we have a user in session, get their details and validate company access
    if (req.session?.userId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.session.userId))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // For SUPER_ADMIN, allow access to any company but still validate the company exists
      if (user.role === UserRole.SUPER_ADMIN && req.session.companyId) {
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, req.session.companyId))
          .limit(1);

        if (!company) {
          return res.status(404).json({ message: "Company not found" });
        }

        req.company = company;
        req.user = user;
        return next();
      }

      // For regular users, use their assigned company
      if (user.companyId) {
        const [company] = await db
          .select()
          .from(companies)
          .where(eq(companies.id, user.companyId))
          .limit(1);

        if (!company) {
          return res.status(404).json({ message: "Company not found" });
        }

        // Regular users can only access their assigned company
        req.session.companyId = user.companyId; // Set company ID in session
        req.company = company;
        req.user = user;
        return next();
      }

      return res.status(403).json({ message: "No company access" });
    }

    // If no user session, request is unauthorized
    return res.status(401).json({ message: "Unauthorized" });
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

export function requireCompanyAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.company) {
    return res.status(403).json({ message: "Company access required" });
  }
  next();
}

export function requireRole(roles: Array<keyof typeof UserRole>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}