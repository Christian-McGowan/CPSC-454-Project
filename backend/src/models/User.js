import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["doctor", "insurer", "admin"], default: "doctor" },
    organization: { type: String, trim: true, maxlength: 120, default: "AegisCare Network" },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
