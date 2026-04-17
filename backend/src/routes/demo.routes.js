import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ensureDemoData } from "../utils/demoSeeder.js";
import { logAuditEvent } from "../middleware/audit.js";

const router = Router();

router.post(
  "/bootstrap",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const seeded = await ensureDemoData();

    await logAuditEvent(req, {
      action: "demo.bootstrap",
      resourceType: "system",
      details: "Seeded healthcare portal demo data"
    });

    return res.json({
      message: "Demo records loaded",
      counts: {
        patients: seeded.patients.length,
        claims: seeded.claims.length
      }
    });
  })
);

export default router;
