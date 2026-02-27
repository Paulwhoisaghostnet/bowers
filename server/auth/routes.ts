import type { Express } from "express";
import passport from "passport";
import { z } from "zod";
import { authStorage } from "./storage";
import { hashPassword, isAuthenticated } from "./passport";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.parse(req.body);
      const existing = await authStorage.getUserByEmail(
        parsed.email.toLowerCase()
      );
      if (existing) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const passwordHash = await hashPassword(parsed.password);
      const user = await authStorage.createUser({
        email: parsed.email.toLowerCase(),
        passwordHash,
        firstName: parsed.firstName ?? null,
        lastName: parsed.lastName ?? null,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { passwordHash: _, ...safeUser } = user;
        return res.status(201).json(safeUser);
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Registration error:", err?.message ?? err);
      const isDbUnavailable =
        err?.code === "ECONNREFUSED" ||
        err?.code === "ENOTFOUND" ||
        err?.message?.includes("connect");
      const message = isDbUnavailable
        ? "Database unavailable. Please ensure PostgreSQL is running and DATABASE_URL in .env is correct."
        : "Registration failed. Please try again.";
      return res.status(500).json({ message });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(400).json({ message: "Invalid request" });
    }

    passport.authenticate(
      "local",
      (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) {
          return res
            .status(401)
            .json({ message: info?.message || "Invalid email or password" });
        }
        req.login(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          const { passwordHash: _, ...safeUser } = user;
          return res.json(safeUser);
        });
      }
    )(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
