import { Router } from "express";
import { z } from "zod";
import { AuditEvent } from "../models/AuditEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const listAuditSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    action: z.string().trim().optional(),
    outcome: z.enum(["success", "denied", "error"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(60)
  })
});

router.get(
  "/",
  requireAuth,
  requireRole("doctor", "admin"),
  validate(listAuditSchema),
  asyncHandler(async (req, res) => {
    const { action, outcome, limit } = req.validated.query;
    const filter = {};

    if (action) {
      filter.action = new RegExp(action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    if (outcome) {
      filter.outcome = outcome;
    }

    const items = await AuditEvent.find(filter).sort({ createdAt: -1 }).limit(limit);
    return res.json({ items });
  })
);

export default router;
