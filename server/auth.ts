import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, type User as SelectUser } from "@db/schema";
import { db } from "@db";
import { eq, and } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

// Extend express user object with our schema
declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "quote-builder-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = {
      ...sessionSettings.cookie,
      secure: true,
    };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true,
      },
      async (req, email, password, done) => {
        try {
          const companyId = parseInt(req.body.companyId);

          if (isNaN(companyId)) {
            return done(null, false, { message: "Invalid company ID" });
          }

          // Find user with matching email and company ID
          const [user] = await db
            .select()
            .from(users)
            .where(
              and(
                eq(users.email, email),
                eq(users.companyId, companyId)
              )
            )
            .limit(1);

          if (!user) {
            return done(null, false, { message: "Invalid credentials" });
          }

          const isMatch = await crypto.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: "Invalid credentials" });
          }

          if (user.status !== 'ACTIVE') {
            return done(null, false, { message: "Account is inactive" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, { id: user.id, companyId: user.companyId });
  });

  passport.deserializeUser(async (data: { id: number; companyId: number }, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, data.id),
            eq(users.companyId, data.companyId)
          )
        )
        .limit(1);

      if (!user) {
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Authentication routes
  app.post("/api/auth/login", (req, res, next) => {
    const { email, password, companyId } = req.body;

    if (!email || !password || !companyId) {
      return res.status(400).json({ message: "Email, password and company ID are required" });
    }

    passport.authenticate("local", (err: any, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(401).json({ message: info.message || "Invalid credentials" });
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }

        // Add company information to the session
        req.session.companyId = user.companyId;
        req.session.userId = user.id;
        req.session.userRole = user.role;

        return res.json({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          status: user.status
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Session destruction failed" });
        }
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      return res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        companyId: req.user.companyId,
        status: req.user.status
      });
    }
    res.status(401).json({ message: "Not authenticated" });
  });
}