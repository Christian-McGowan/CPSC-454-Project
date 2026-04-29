import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // NIST IA-5 / SC-28: hide credential material by default so it can never
    // accidentally serialize into an API response. The login flow opts in
    // explicitly with .select("+passwordHash").
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["doctor", "insurer", "admin"], default: "doctor" },
    organization: { type: String, trim: true, maxlength: 120, default: "AegisCare Network" },
    lastLoginAt: { type: Date },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
