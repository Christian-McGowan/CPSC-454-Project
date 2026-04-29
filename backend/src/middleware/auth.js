import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { verifyToken } from "../utils/jwt.js";
import { logAuditEvent } from "./audit.js";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const payload = verifyToken(token);
    // passwordHash is hidden by default via the User schema's select:false.
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }
}

export function requireRole(...roles) {
  return async function roleCheck(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      await logAuditEvent(req, {
        action: "access.denied",
        outcome: "denied",
        resourceType: "route",
        details: `Role ${req.user?.role || "anonymous"} attempted to access ${req.method} ${req.originalUrl}`,
        metadata: { requiredRoles: roles }
      });
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    return next();
  };
}
