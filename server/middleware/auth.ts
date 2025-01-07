import { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { users, UserRole } from "@db/schema";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: keyof typeof UserRole;
    companyId?: number;
    accessibleCompanyIds?: number[];
  }
}

declare module "express" {
  interface Request {
    user?: {
      id: number;
      role: keyof typeof UserRole;
      companyId: number;
      [key: string]: any;
    };
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.session.userId),
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: "Server error" });
  }
};

export const requireRole = (allowedRoles: (keyof typeof UserRole)[]) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.user.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  } catch (error) {
    console.error('Role middleware error:', error);
    res.status(500).json({ message: "Server error" });
  }
};