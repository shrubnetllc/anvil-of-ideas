import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { hashPassword } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import type { Express } from "express";

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  email: z.string().email(),
  role: z.enum(["user", "superadmin"]).optional().default("user"),
});

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function setupAdminRoutes(app: Express) {
  const router = Router();

  router.use(adminLimiter);

  router.post("/users", async (req, res, next) => {
    try {
      // Determine auth mode
      let actorId: string | null = null;
      let isApiKey = false;

      const apiKeyHeader = req.headers["x-api-key"];
      const adminApiKey = process.env.ADMIN_API_KEY;

      if (req.isAuthenticated() && req.user?.role === "superadmin") {
        actorId = req.user.id;
      } else if (req.isAuthenticated() && req.user?.role !== "superadmin") {
        return res.status(403).json({ message: "Forbidden: superadmin role required" });
      } else if (
        adminApiKey &&
        typeof apiKeyHeader === "string" &&
        safeEqual(apiKeyHeader, adminApiKey)
      ) {
        isApiKey = true;
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate payload
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      let { username, password, email, role } = parsed.data;

      // API key auth can only create regular users
      if (isApiKey) {
        role = "user";
      }

      // Check uniqueness
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already exists" });
      }

      // Hash password and insert directly (no RLS — admin operation)
      const hashedPassword = await hashPassword(password);
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          role,
          emailVerified: "false",
        })
        .returning();

      // Write audit log
      await storage.createAuditLog({
        actorId,
        action: "admin.create_user",
        targetType: "user",
        targetId: newUser.id,
        details: {
          username,
          email,
          role,
          authMethod: isApiKey ? "api_key" : "session",
        },
        ipAddress: req.ip || req.socket.remoteAddress || null,
      });

      // Return user sans password
      const { password: _, ...userWithoutPassword } = newUser;
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/admin", router);
}
