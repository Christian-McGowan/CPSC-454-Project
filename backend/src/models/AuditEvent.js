import mongoose from "mongoose";

const auditEventSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, trim: true },
    actorRole: { type: String, trim: true },
    action: { type: String, required: true, trim: true },
    resourceType: { type: String, trim: true },
    resourceId: { type: String, trim: true },
    patientId: { type: String, trim: true },
    patientName: { type: String, trim: true },
    outcome: { type: String, enum: ["success", "denied", "error"], default: "success" },
    details: { type: String, trim: true, maxlength: 800 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true }
  },
  { timestamps: true }
);

auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ actorRole: 1, createdAt: -1 });
auditEventSchema.index({ patientId: 1, createdAt: -1 });

export const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);
