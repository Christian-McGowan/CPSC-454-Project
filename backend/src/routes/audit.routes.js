import { Router } from "express";
import { z } from "zod";
import { AuditEvent } from "../models/AuditEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { computeEventHash } from "../utils/auditHash.js";

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

// NIST SP 800-53 AU-9 verification endpoint. Walks the audit chain from the
// genesis record forward and recomputes each hash. Any mismatch identifies the
// first record that was tampered with after it was written.
router.get(
  "/verify",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const events = await AuditEvent.find({}).sort({ createdAt: 1, _id: 1 }).lean();
    let previousHash = "GENESIS";
    const breaks = [];

    for (const event of events) {
      if (!event.hash) {
        breaks.push({
          eventId: String(event._id),
          reason: "missing_hash",
          createdAt: event.createdAt
        });
        continue;
      }
      const expected = computeEventHash(event, previousHash);
      if (expected !== event.hash) {
        breaks.push({
          eventId: String(event._id),
          reason: "hash_mismatch",
          expected,
          actual: event.hash,
          createdAt: event.createdAt
        });
      }
      previousHash = event.hash;
    }

    return res.json({
      totalEvents: events.length,
      verified: breaks.length === 0,
      breaks
    });
  })
);

export default router;
