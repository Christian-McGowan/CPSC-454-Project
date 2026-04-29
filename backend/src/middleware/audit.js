import { AuditEvent } from "../models/AuditEvent.js";
import { computeEventHash } from "../utils/auditHash.js";

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

    // Build the chain: previousHash points at the most recent event's hash so
    // any tampering with history breaks the chain at the point of edit.
    const previous = await AuditEvent.findOne({ hash: { $ne: null } })
      .sort({ createdAt: -1, _id: -1 })
      .select("hash")
      .lean();

    const previousHash = previous?.hash || "GENESIS";
    const event = new AuditEvent({ ...eventPayload, previousHash });

    // Mongoose populates timestamps via pre-save; set createdAt now so the hash
    // covers the same value that gets persisted.
    event.createdAt = event.createdAt || new Date();
    event.hash = computeEventHash(event.toObject(), previousHash);

    await event.save();

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
      createdAt: event.createdAt,
      hash: event.hash,
      previousHash: event.previousHash
    }));
  } catch (error) {
    console.error("Failed to write audit event", error.message);
  }
}
