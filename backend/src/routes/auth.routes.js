import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { signToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { logAuditEvent } from "../middleware/audit.js";

const router = Router();

// NIST SP 800-53 AC-7 — unsuccessful logon attempts. After this many
// consecutive failures the account is temporarily locked.
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Try again later." }
});

const emailSchema = z.string().trim().toLowerCase().email();
const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["doctor", "insurer"]).default("doctor"),
    organization: z.string().trim().max(120).optional().default("AegisCare Network")
  }),
  params: z.object({}),
  query: z.object({})
});

const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required")
  }),
  params: z.object({}),
  query: z.object({})
});

function setAuthCookie(res, token) {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: 24 * 60 * 60 * 1000
  });
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

router.get("/password-policy", (req, res) => {
  res.json({
    publicRegistrationEnabled: env.allowPublicRegistration,
    policy: {
      minLength: 10,
      requiresUppercase: true,
      requiresNumber: true,
      hints: [
        "Use at least 10 characters",
        "Include one uppercase letter",
        "Include one number"
      ]
    }
  });
});

router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    if (!env.allowPublicRegistration) {
      return res.status(403).json({ message: "Public registration is disabled. Use the seeded demo accounts or ask an admin to provision access." });
    }

    const { name, email, password, role, organization } = req.validated.body;
    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role, organization });
    const token = signToken(user);
    setAuthCookie(res, token);

    req.user = user;
    await logAuditEvent(req, {
      action: "auth.register",
      resourceType: "user",
      resourceId: String(user._id),
      details: `New ${role} account created for ${email}`
    });

    return res.status(201).json({
      message: "Account created successfully",
      user: serializeUser(user)
    });
  })
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.validated.body;
    // passwordHash is select:false on the schema; opt in for the login query only.
    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user) {
      await logAuditEvent(req, {
        action: "auth.login.failed",
        outcome: "denied",
        resourceType: "user",
        details: `Login failed for ${email}`,
        metadata: { email, reason: "user_not_found" }
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // NIST AC-7: refuse the attempt outright if the account is currently locked.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      req.user = user;
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await logAuditEvent(req, {
        action: "auth.login.locked",
        outcome: "denied",
        resourceType: "user",
        resourceId: String(user._id),
        details: `Login refused for ${email}; account locked`,
        metadata: { lockedUntil: user.lockedUntil, minutesRemaining: minutesLeft }
      });
      return res.status(423).json({
        message: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      req.user = user;
      user.failedLoginCount = (user.failedLoginCount || 0) + 1;

      let locked = false;
      if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        user.failedLoginCount = 0;
        locked = true;
      }
      await user.save();

      await logAuditEvent(req, {
        action: locked ? "auth.account.locked" : "auth.login.failed",
        outcome: "denied",
        resourceType: "user",
        resourceId: String(user._id),
        details: locked
          ? `Account locked after ${MAX_FAILED_LOGINS} failed attempts for ${email}`
          : `Invalid password for ${email}`,
        metadata: locked
          ? { lockedUntil: user.lockedUntil, lockoutMinutes: LOCKOUT_MINUTES }
          : { failedLoginCount: user.failedLoginCount }
      });

      if (locked) {
        return res.status(423).json({
          message: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
        });
      }
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Successful auth resets the lockout counters.
    user.lastLoginAt = new Date();
    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await user.save();

    const token = signToken(user);
    setAuthCookie(res, token);

    req.user = user;
    await logAuditEvent(req, {
      action: "auth.login.success",
      resourceType: "user",
      resourceId: String(user._id),
      details: `${user.role} signed in`
    });

    return res.json({ message: "Login successful", user: serializeUser(user) });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await logAuditEvent(req, {
      action: "auth.logout",
      resourceType: "user",
      resourceId: String(req.user._id),
      details: `${req.user.role} signed out`
    });

    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.cookieSecure
    });

    return res.status(204).send();
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json({ user: serializeUser(req.user) });
  })
);

export default router;
