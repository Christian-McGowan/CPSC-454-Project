import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { COMPLIANCE_FAMILIES, PRIVACY_SAFEGUARDS, ROLE_ACCESS_MATRIX, DEMO_ROLE_GUIDE } from "../data/demoData.js";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json({
      safeguards: PRIVACY_SAFEGUARDS,
      roleMatrix: ROLE_ACCESS_MATRIX,
      complianceFamilies: COMPLIANCE_FAMILIES,
      roleGuide: DEMO_ROLE_GUIDE
    });
  })
);

export default router;
