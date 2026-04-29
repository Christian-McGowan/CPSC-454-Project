import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  COOKIE_NAME: z.string().default("aegiscare_token"),
  COOKIE_SECURE: z.string().default("false"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(10).default("ChangeMe123!"),
  ALLOW_PUBLIC_REGISTRATION: z.string().default("false"),
  SEED_DEMO_USERS_ON_STARTUP: z.string().default("true")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  port: Number(parsed.data.PORT),
  isProduction: parsed.data.NODE_ENV === "production",
  cookieSecure: parsed.data.COOKIE_SECURE === "true",
  allowPublicRegistration: parsed.data.ALLOW_PUBLIC_REGISTRATION === "true",
  seedDemoUsersOnStartup: parsed.data.NODE_ENV !== "production" && parsed.data.SEED_DEMO_USERS_ON_STARTUP === "true"
};
