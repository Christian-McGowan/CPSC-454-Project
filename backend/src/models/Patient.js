import mongoose from "mongoose";

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dose: { type: String, required: true, trim: true },
    schedule: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 1200 },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const billingProfileSchema = new mongoose.Schema(
  {
    payerName: { type: String, required: true, trim: true },
    policyNumberMasked: { type: String, required: true, trim: true },
    coverageStatus: { type: String, enum: ["active", "pending", "review", "expired"], default: "active" },
    outstandingBalance: { type: Number, default: 0 },
    lastClaimStatus: { type: String, default: "draft" }
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    dateOfBirth: { type: Date, required: true },
    sex: { type: String, enum: ["female", "male", "nonbinary", "other"], default: "other" },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    primaryDoctor: { type: String, required: true, trim: true },
    insuranceProvider: { type: String, required: true, trim: true },
    diagnosisSummary: { type: String, trim: true, maxlength: 600, default: "" },
    allergies: [{ type: String, trim: true }],
    medications: [medicationSchema],
    notes: [noteSchema],
    privacyLevel: { type: String, enum: ["standard", "restricted"], default: "standard" },
    lastVisitAt: { type: Date },
    billingProfile: { type: billingProfileSchema, required: true }
  },
  { timestamps: true }
);

export const Patient = mongoose.model("Patient", patientSchema);
