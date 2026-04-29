import { Router } from "express";
import { z } from "zod";
import { Patient } from "../models/Patient.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { logAuditEvent } from "../middleware/audit.js";

const router = Router();

const patientSummarySelect = "patientId fullName dateOfBirth sex primaryDoctor insuranceProvider diagnosisSummary allergies medications privacyLevel lastVisitAt billingProfile createdAt updatedAt";

const medicationInput = z.object({
  name: z.string().trim().min(2).max(120),
  dose: z.string().trim().min(1).max(80),
  schedule: z.string().trim().min(1).max(120)
});

const createPatientSchema = z.object({
  body: z.object({
    patientId: z.string().trim().min(4).max(24),
    fullName: z.string().trim().min(3).max(120),
    dateOfBirth: z.string().datetime(),
    sex: z.enum(["female", "male", "nonbinary", "other"]),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    primaryDoctor: z.string().trim().min(3).max(80),
    insuranceProvider: z.string().trim().min(3).max(120),
    diagnosisSummary: z.string().trim().max(600).optional().default(""),
    allergies: z.array(z.string().trim().min(1).max(80)).optional().default([]),
    medications: z.array(medicationInput).optional().default([]),
    privacyLevel: z.enum(["standard", "restricted"]).default("standard"),
    lastVisitAt: z.string().datetime().optional(),
    billingProfile: z.object({
      payerName: z.string().trim().min(3).max(120),
      policyNumberMasked: z.string().trim().min(3).max(40),
      coverageStatus: z.enum(["active", "pending", "review", "expired"]).default("active"),
      outstandingBalance: z.coerce.number().min(0).default(0),
      lastClaimStatus: z.string().trim().min(2).max(40).default("draft")
    })
  }),
  params: z.object({}),
  query: z.object({})
});

const updatePatientSchema = z.object({
  body: z.object({
    diagnosisSummary: z.string().trim().max(600).optional(),
    allergies: z.array(z.string().trim().min(1).max(80)).optional(),
    medications: z.array(medicationInput).optional(),
    privacyLevel: z.enum(["standard", "restricted"]).optional(),
    addNote: z.string().trim().min(4).max(1200).optional(),
    billingProfile: z.object({
      payerName: z.string().trim().min(3).max(120).optional(),
      policyNumberMasked: z.string().trim().min(3).max(40).optional(),
      coverageStatus: z.enum(["active", "pending", "review", "expired"]).optional(),
      outstandingBalance: z.coerce.number().min(0).optional(),
      lastClaimStatus: z.string().trim().min(2).max(40).optional()
    }).optional(),
    lastVisitAt: z.string().datetime().optional()
  }).refine((value) => Object.keys(value).length > 0, { message: "At least one field must be updated" }),
  params: z.object({ id: z.string().length(24, "Invalid patient id") }),
  query: z.object({})
});

const listPatientsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    q: z.string().trim().optional(),
    privacyLevel: z.enum(["standard", "restricted"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50)
  })
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.use(requireAuth, requireRole("doctor", "admin"));

router.get(
  "/",
  validate(listPatientsSchema),
  asyncHandler(async (req, res) => {
    const { q, privacyLevel, limit } = req.validated.query;
    const filter = {};

    if (privacyLevel) {
      filter.privacyLevel = privacyLevel;
    }

    if (q) {
      const safe = escapeRegex(q);
      filter.$or = [
        { fullName: { $regex: safe, $options: "i" } },
        { patientId: { $regex: safe, $options: "i" } },
        { primaryDoctor: { $regex: safe, $options: "i" } },
        { insuranceProvider: { $regex: safe, $options: "i" } },
        { diagnosisSummary: { $regex: safe, $options: "i" } }
      ];
    }

    const patients = await Patient.find(filter).select(patientSummarySelect).sort({ updatedAt: -1 }).limit(limit);

    await logAuditEvent(req, {
      action: "patient.list",
      resourceType: "patient",
      details: `Viewed ${patients.length} patient summaries`
    });

    return res.json({
      items: patients,
      meta: {
        total: patients.length,
        restrictedCount: patients.filter((patient) => patient.privacyLevel === "restricted").length
      }
    });
  })
);

router.post(
  "/",
  validate(createPatientSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    const patient = await Patient.create({
      ...payload,
      email: payload.email || undefined,
      phone: payload.phone || undefined,
      dateOfBirth: new Date(payload.dateOfBirth),
      lastVisitAt: payload.lastVisitAt ? new Date(payload.lastVisitAt) : undefined,
      notes: []
    });

    await logAuditEvent(req, {
      action: "patient.create",
      resourceType: "patient",
      resourceId: String(patient._id),
      patientId: patient.patientId,
      patientName: patient.fullName,
      details: `Created patient record ${patient.patientId}`
    });

    return res.status(201).json({ item: patient });
  })
);

router.get(
  "/:id",
  validate(
    z.object({ body: z.object({}), params: z.object({ id: z.string().length(24, "Invalid patient id") }), query: z.object({}) })
  ),
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.validated.params.id);
    if (!patient) {
      return res.status(404).json({ message: "Patient record not found" });
    }

    await logAuditEvent(req, {
      action: "patient.view",
      resourceType: "patient",
      resourceId: String(patient._id),
      patientId: patient.patientId,
      patientName: patient.fullName,
      details: `Opened chart for ${patient.fullName}`
    });

    return res.json({ item: patient });
  })
);

router.patch(
  "/:id",
  validate(updatePatientSchema),
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.validated.params.id);
    if (!patient) {
      return res.status(404).json({ message: "Patient record not found" });
    }

    const { diagnosisSummary, allergies, medications, privacyLevel, addNote, billingProfile, lastVisitAt } = req.validated.body;

    if (diagnosisSummary !== undefined) patient.diagnosisSummary = diagnosisSummary;
    if (allergies !== undefined) patient.allergies = allergies;
    if (medications !== undefined) patient.medications = medications;
    if (privacyLevel !== undefined) patient.privacyLevel = privacyLevel;
    if (lastVisitAt !== undefined) patient.lastVisitAt = new Date(lastVisitAt);
    if (billingProfile) {
      patient.billingProfile = { ...patient.billingProfile.toObject(), ...billingProfile };
    }
    if (addNote) {
      patient.notes.unshift({
        authorName: req.user.name,
        authorRole: req.user.role,
        text: addNote,
        createdAt: new Date()
      });
    }

    await patient.save();

    await logAuditEvent(req, {
      action: "patient.update",
      resourceType: "patient",
      resourceId: String(patient._id),
      patientId: patient.patientId,
      patientName: patient.fullName,
      details: addNote ? "Updated chart and added care note" : "Updated patient record"
    });

    return res.json({ item: patient });
  })
);

export default router;
