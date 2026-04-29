import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

const DEMO_USERS = [
  { name: "Portal Admin", email: env.DEFAULT_ADMIN_EMAIL, password: env.DEFAULT_ADMIN_PASSWORD, role: "admin" },
  { name: "Dr. Maya Chen", email: "doctor.demo@aegiscare.local", password: "DoctorDemo1", role: "doctor" },
  { name: "Coverage Analyst", email: "insurer.demo@aegiscare.local", password: "InsurerDemo1", role: "insurer" }
];

async function ensureUser({ name, email, password, role }) {
  const existing = await User.findOne({ email });
  if (existing) {
    return { email, created: false, role: existing.role };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role });
  return { email, created: true, role: user.role };
}

export async function ensureDemoUsers() {
  const results = [];

  for (const entry of DEMO_USERS) {
    results.push(await ensureUser(entry));
  }

  return results;
}