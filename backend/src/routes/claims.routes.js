import { Router } from "express";
import { z } from "zod";
import { Claim } from "../models/Claim.js";
import { Patient } from "../models/Patient.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { logAuditEvent } from "../middleware/audit.js";
import { ensureDemoData } from "../utils/demoSeeder.js";

const router = Router();

const claimStatus = z.enum(["draft", "submitted", "in_review", "approved", "denied", "paid"]);

const listClaimsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    status: claimStatus.optional(),
    q: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50)
  })
});

const createClaimSchema = z.object({
  body: z.object({
    patientId: z.string().trim().min(4).max(24),
    amount: z.coerce.number().min(0),
    procedureCode: z.string().trim().min(2).max(20),
    diagnosisCode: z.string().trim().min(2).max(20),
    clinicianNote: z.string().trim().max(500).optional().default("")
  }),
  params: z.object({}),
  query: z.object({})
});

const updateClaimSchema = z.object({
  body: z.object({
    status: claimStatus.optional(),
    insurerNote: z.string().trim().max(500).optional(),
    clinicianNote: z.string().trim().max(500).optional(),
    amount: z.coerce.number().min(0).optional(),
    procedureCode: z.string().trim().min(2).max(20).optional(),
    diagnosisCode: z.string().trim().min(2).max(20).optional()
  }).refine((value) => Object.keys(value).length > 0, { message: "At least one field must be updated" }),
  params: z.object({ id: z.string().length(24, "Invalid claim id") }),
  query: z.object({})
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.use(requireAuth);

router.get(
  "/",
  validate(listClaimsSchema),
  asyncHandler(async (req, res) => {
    await ensureDemoData();
    const { status, q, limit } = req.validated.query;
    const filter = {};

    if (status) filter.status = status;
    if (q) {
      const safe = escapeRegex(q);
      filter.$or = [
        { claimNumber: { $regex: safe, $options: "i" } },
        { patientName: { $regex: safe, $options: "i" } },
        { payerName: { $regex: safe, $options: "i" } },
        { procedureCode: { $regex: safe, $options: "i" } },
        { diagnosisCode: { $regex: safe, $options: "i" } }
      ];
    }

    const claims = await Claim.find(filter).sort({ updatedAt: -1 }).limit(limit);

    await logAuditEvent(req, {
      action: "claim.list",
      resourceType: "claim",
      details: `Viewed ${claims.length} billing claims`
    });

    return res.json({
      items: claims,
      meta: {
        total: claims.length,
        pendingCount: claims.filter((claim) => ["submitted", "in_review"].includes(claim.status)).length,
        approvedAmount: claims.filter((claim) => ["approved", "paid"].includes(claim.status)).reduce((sum, claim) => sum + claim.amount, 0)
      }
    });
  })
);

router.post(
  "/",
  requireRole("doctor", "admin"),
  validate(createClaimSchema),
  asyncHandler(async (req, res) => {
    const patient = await Patient.findOne({ patientId: req.validated.body.patientId });
    if (!patient) {
      return res.status(404).json({ message: "Patient record not found for claim" });
    }

    const claim = await Claim.create({
      claimNumber: `CLM-${Date.now().toString().slice(-6)}`,
      patient: patient._id,
      patientId: patient.patientId,
      patientName: patient.fullName,
      payerName: patient.billingProfile.payerName,
      amount: req.validated.body.amount,
      procedureCode: req.validated.body.procedureCode,
      diagnosisCode: req.validated.body.diagnosisCode,
      clinicianNote: req.validated.body.clinicianNote,
      status: "submitted",
      submittedAt: new Date(),
      updatedByRole: req.user.role,
      updatedByName: req.user.name
    });

    patient.billingProfile.lastClaimStatus = claim.status;
    patient.billingProfile.outstandingBalance = Number((patient.billingProfile.outstandingBalance + claim.amount).toFixed(2));
    await patient.save();

    await logAuditEvent(req, {
      action: "claim.create",
      resourceType: "claim",
      resourceId: String(claim._id),
      patientId: patient.patientId,
      patientName: patient.fullName,
      details: `Submitted claim ${claim.claimNumber}`
    });

    return res.status(201).json({ item: claim });
  })
);

router.patch(
  "/:id",
  validate(updateClaimSchema),
  asyncHandler(async (req, res) => {
    const claim = await Claim.findById(req.validated.params.id);
    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    const patient = await Patient.findById(claim.patient);
    if (!patient) {
      return res.status(404).json({ message: "Linked patient record not found" });
    }

    const payload = req.validated.body;
    const role = req.user.role;

    if (role === "insurer") {
      const allowed = new Set(["status", "insurerNote"]);
      const invalidField = Object.keys(payload).find((key) => !allowed.has(key));
      if (invalidField) {
        await logAuditEvent(req, {
          action: "claim.update.denied",
          resourceType: "claim",
          resourceId: String(claim._id),
          patientId: patient.patientId,
          patientName: patient.fullName,
          outcome: "denied",
          details: `Insurer attempted to modify ${invalidField}`
        });
        return res.status(403).json({ message: "Insurance providers can only update billing review status and notes" });
      }
    }

    if (role === "doctor") {
      const allowed = new Set(["status", "clinicianNote", "amount", "procedureCode", "diagnosisCode"]);
      const invalidField = Object.keys(payload).find((key) => !allowed.has(key));
      if (invalidField) {
        await logAuditEvent(req, {
          action: "claim.update.denied",
          resourceType: "claim",
          resourceId: String(claim._id),
          patientId: patient.patientId,
          patientName: patient.fullName,
          outcome: "denied",
          details: `Doctor attempted to modify ${invalidField}`
        });
        return res.status(403).json({ message: "Doctors can update clinical claim details but not insurer review notes" });
      }
    }

    Object.assign(claim, payload);
    claim.updatedByRole = req.user.role;
    claim.updatedByName = req.user.name;
    if (payload.status === "submitted" && !claim.submittedAt) claim.submittedAt = new Date();
    if (["approved", "denied", "paid"].includes(payload.status)) claim.coverageDecisionAt = new Date();
    await claim.save();

    patient.billingProfile.lastClaimStatus = claim.status;
    if (claim.status === "paid") {
      patient.billingProfile.outstandingBalance = Math.max(0, Number((patient.billingProfile.outstandingBalance - claim.amount).toFixed(2)));
    }
    await patient.save();

    await logAuditEvent(req, {
      action: "claim.update",
      resourceType: "claim",
      resourceId: String(claim._id),
      patientId: patient.patientId,
      patientName: patient.fullName,
      details: `Updated claim ${claim.claimNumber} to ${claim.status}`
    });

    return res.json({ item: claim });
  })
);

export default router;
