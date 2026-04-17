import { AuditEvent } from "../models/AuditEvent.js";

export async function logAuditEvent(req, details) {
  try {
    await AuditEvent.create({
      actorId: req.user?._id,
      actorName: req.user?.name,
      actorRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      outcome: details.outcome || "success",
      metadata: details.metadata || {},
      ...details
    });
  } catch (error) {
    console.error("Failed to write audit event", error.message);
  }
}
