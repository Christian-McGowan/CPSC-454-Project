import { Router } from "express";
import { Claim } from "../models/Claim.js";
import { Patient } from "../models/Patient.js";
import { AuditEvent } from "../models/AuditEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureDemoData, maskPatientForBilling } from "../utils/demoSeeder.js";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    await ensureDemoData();

    const [patients, claims, auditEvents] = await Promise.all([
      Patient.find().sort({ updatedAt: -1 }),
      Claim.find().sort({ updatedAt: -1 }),
      AuditEvent.find().sort({ createdAt: -1 }).limit(8)
    ]);

    const restrictedCount = patients.filter((patient) => patient.privacyLevel === "restricted").length;
    const outstandingBalance = patients.reduce((sum, patient) => sum + (patient.billingProfile?.outstandingBalance || 0), 0);
    const pendingClaims = claims.filter((claim) => ["submitted", "in_review"].includes(claim.status));
    const paidClaims = claims.filter((claim) => claim.status === "paid");

    const statsByRole = {
      doctor: [
        {
          label: "Active patients",
          value: patients.length,
          helper: "Clinical charts available for review"
        },
        {
          label: "Restricted charts",
          value: restrictedCount,
          helper: "Higher sensitivity records needing careful access"
        },
        {
          label: "Claims in motion",
          value: pendingClaims.length,
          helper: "Visits that still need payer action"
        },
        {
          label: "Outstanding balance",
          value: `$${outstandingBalance.toFixed(0)}`,
          helper: "Patient balances still open across the roster"
        }
      ],
      insurer: [
        {
          label: "Claims queue",
          value: pendingClaims.length,
          helper: "Claims awaiting review or decision"
        },
        {
          label: "Paid claims",
          value: paidClaims.length,
          helper: "Claims successfully closed"
        },
        {
          label: "Amount under review",
          value: `$${pendingClaims.reduce((sum, claim) => sum + claim.amount, 0).toFixed(0)}`,
          helper: "Dollar amount in the active adjudication queue"
        },
        {
          label: "Protected records",
          value: restrictedCount,
          helper: "Records kept outside the insurer workflow"
        }
      ],
      admin: [
        {
          label: "Portal accounts",
          value: new Set(auditEvents.map((event) => event.actorId?.toString()).filter(Boolean)).size,
          helper: "Users seen in the latest activity stream"
        },
        {
          label: "Patient records",
          value: patients.length,
          helper: "Seeded records in the demo dataset"
        },
        {
          label: "Open claims",
          value: pendingClaims.length,
          helper: "Claims currently in the workflow"
        },
        {
          label: "Audit events",
          value: auditEvents.length,
          helper: "Recent access activity captured by the portal"
        }
      ]
    };

    const highlightPatients = req.user.role === "insurer"
      ? patients.slice(0, 3).map(maskPatientForBilling)
      : patients.slice(0, 3);

    return res.json({
      hero: {
        title: req.user.role === "doctor"
          ? "Patient privacy without slowing down care"
          : req.user.role === "insurer"
            ? "Billing review without opening the chart"
            : "HIPAA-focused access control at a glance",
        body: req.user.role === "doctor"
          ? "Open a patient record, update the chart, and keep billing moving while every access is logged."
          : req.user.role === "insurer"
            ? "Review claim status, add billing decisions, and stay out of the clinical record by design."
            : "Use the admin view to seed the portal, verify role separation, and show how audit logging supports HIPAA-ready workflows."
      },
      stats: statsByRole[req.user.role] || statsByRole.doctor,
      spotlight: highlightPatients,
      recentActivity: auditEvents,
      queue: claims.slice(0, 5)
    });
  })
);

export default router;
