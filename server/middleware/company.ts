import { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { companies } from "@db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      company?: any;
    }
  }
}

export async function companyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const subdomain = req.hostname.split(".")[0];
  
  // Skip middleware for www and localhost
  if (subdomain === "www" || subdomain === "localhost") {
    return next();
  }

  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.subdomain, subdomain))
      .limit(1);

    if (!company) {
      return res.status(404).send("Company not found");
    }

    req.company = company;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.company) {
    return res.status(403).send("Company access required");
  }
  next();
}

export function requireSameCompany(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.company || req.user.companyId !== req.company.id) {
    return res.status(403).send("Invalid company access");
  }
  next();
}
