import { Request, Response, NextFunction } from "express";
import { db } from "@db";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";

declare module "express-session" {
  interface SessionData {
    userId: number;
    loginAttempts?: number;
    lastLoginAttempt?: number;
    csrfToken?: string;
    createdAt?: number;
  }
}

declare module "express" {
  interface Request {
    user?: {
      id: number;
      role: string;
      status: string;
    };
  }
}

// Rate limiter specifically for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Set session creation time if not set
    if (!req.session.createdAt) {
      req.session.createdAt = Date.now();
    }

    // Check for session expiration
    const sessionAge = Date.now() - req.session.createdAt;
    if (sessionAge > 24 * 60 * 60 * 1000) { // 24 hours
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Session expired" });
    }

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

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      req.session.destroy(() => {});
      return res.status(403).json({ message: "Account is not active" });
    }

    req.user = user;

    // Refresh session to prevent fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ message: "Internal server error" });
      }
      req.session.userId = user.id;
      req.session.createdAt = Date.now(); // Reset creation time on regenerate
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: "Server error" });
  }
};

export const requireRole = (allowedRoles: string[]) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      console.warn(`Unauthorized role access attempt: ${req.user.role} tried to access route requiring ${allowedRoles.join(', ')}`);
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  } catch (error) {
    console.error('Role middleware error:', error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  next();
};

// Helper function to validate password strength
export const validatePassword = (password: string): boolean => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonalphas = /\W/.test(password);

  return password.length >= minLength 
    && hasUpperCase 
    && hasLowerCase 
    && hasNumbers 
    && hasNonalphas;
};

// Middleware to prevent brute force attacks
export const preventBruteForce = (req: Request, res: Response, next: NextFunction) => {
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

  if (!req.session.loginAttempts) {
    req.session.loginAttempts = 0;
  }

  if (req.session.lastLoginAttempt && Date.now() - req.session.lastLoginAttempt >= LOCKOUT_TIME) {
    req.session.loginAttempts = 0;
  }

  if (req.session.loginAttempts >= MAX_ATTEMPTS) {
    return res.status(429).json({
      message: "Too many failed login attempts. Please try again later.",
      remainingTime: LOCKOUT_TIME - (Date.now() - (req.session.lastLoginAttempt || 0))
    });
  }

  next();
};

export { loginLimiter };