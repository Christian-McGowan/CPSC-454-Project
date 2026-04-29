import { AuditEvent } from "../models/AuditEvent.js";

export async function logAuditEvent(req, details) {
  try {
    const eventPayload = {
      actorId: req.user?._id,
      actorName: req.user?.name,
      actorRole: req.user?.role,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      outcome: details.outcome || "success",
      metadata: details.metadata || {},
      ...details
    };

    const event = await AuditEvent.create(eventPayload);

    // ECS sends stdout/stderr to the configured CloudWatch log group, which gives the
    // application audit trail a second review location outside the MongoDB collection.
    console.info("AUDIT_EVENT", JSON.stringify({
      id: String(event._id),
      action: event.action,
      actorRole: event.actorRole,
      actorId: event.actorId ? String(event.actorId) : undefined,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      patientId: event.patientId,
      outcome: event.outcome,
      createdAt: event.createdAt
    }));
  } catch (error) {
    console.error("Failed to write audit event", error.message);
  }
}
