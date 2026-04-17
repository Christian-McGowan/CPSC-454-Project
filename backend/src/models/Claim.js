import mongoose from "mongoose";

const claimSchema = new mongoose.Schema(
  {
    claimNumber: { type: String, required: true, unique: true, trim: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    patientId: { type: String, required: true, trim: true },
    patientName: { type: String, required: true, trim: true },
    payerName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    procedureCode: { type: String, required: true, trim: true },
    diagnosisCode: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "submitted", "in_review", "approved", "denied", "paid"],
      default: "draft"
    },
    submittedAt: { type: Date },
    insurerNote: { type: String, trim: true, maxlength: 500, default: "" },
    clinicianNote: { type: String, trim: true, maxlength: 500, default: "" },
    coverageDecisionAt: { type: Date },
    updatedByRole: { type: String, trim: true },
    updatedByName: { type: String, trim: true }
  },
  { timestamps: true }
);

export const Claim = mongoose.model("Claim", claimSchema);
