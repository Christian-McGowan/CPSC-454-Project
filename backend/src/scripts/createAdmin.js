import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

const DEMO_USERS = [
  { name: "Dr. Maya Chen", email: "doctor.demo@aegiscare.local", password: "DoctorDemo1", role: "doctor" },
  { name: "Coverage Analyst", email: "insurer.demo@aegiscare.local", password: "InsurerDemo1", role: "insurer" }
];

async function ensureUser({ name, email, password, role }) {
  const existing = await User.findOne({ email });
  if (existing) {
    return { email, created: false };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email, passwordHash, role });
  return { email, created: true };
}

async function main() {
  await connectDatabase();

  const results = [];

  results.push(
    await ensureUser({
      name: "Portal Admin",
      email: env.DEFAULT_ADMIN_EMAIL,
      password: env.DEFAULT_ADMIN_PASSWORD,
      role: "admin"
    })
  );

  for (const demoUser of DEMO_USERS) {
    results.push(await ensureUser(demoUser));
  }

  results.forEach((item) => {
    console.log(`${item.created ? "Created" : "Exists"}: ${item.email}`);
  });

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
