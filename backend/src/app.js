import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import patientsRoutes from "./routes/patients.routes.js";
import claimsRoutes from "./routes/claims.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import privacyRoutes from "./routes/privacy.routes.js";
import portalRoutes from "./routes/portal.routes.js";
import demoRoutes from "./routes/demo.routes.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { issueCsrfCookie, verifyCsrfToken } from "./middleware/csrf.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    // NIST SC-8: enforce HTTPS at the user agent for one year, including
    // every subdomain. Browsers that have seen this header refuse to make
    // plain-HTTP requests to the origin even if the user types http://.
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
);

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(morgan(env.isProduction ? "combined" : "dev"));

// Health check is exempt from CSRF (read-only, no auth state).
app.use(healthRoutes);

// Issue the CSRF cookie on every request, then enforce double-submit on
// state-changing requests. Auth routes opt out of enforcement (see below)
// because login itself has no prior session to attach a token to.
app.use(issueCsrfCookie);
app.use("/api/auth", authRoutes);
app.use(verifyCsrfToken);
app.use("/api/portal", portalRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/claims", claimsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/privacy", privacyRoutes);
app.use("/api/demo", demoRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
