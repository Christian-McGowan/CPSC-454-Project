import crypto from "crypto";
import { env } from "../config/env.js";

// NIST SC-8 / SC-23 — protection against cross-site request forgery.
// We use the "double-submit cookie" pattern: the server issues a random
// token in a non-httpOnly cookie; the SPA reads it from document.cookie
// and echoes it back in an X-CSRF-Token header on every state-changing
// request. An attacker on a malicious origin can drive the browser to
// send the cookie via cross-site fetch, but cannot read the cookie value
// to populate the matching header (Same-Origin Policy), so the request
// is rejected.

export const CSRF_COOKIE_NAME = "aegiscare_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// Issues the CSRF cookie if one is not already present. The cookie is
// readable by JavaScript on the same origin (httpOnly: false) so the SPA
// can copy the value into the X-CSRF-Token header.
export function issueCsrfCookie(req, res, next) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = generateToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: "lax",
      secure: env.cookieSecure,
      maxAge: 24 * 60 * 60 * 1000
    });
    // Make the freshly issued token readable on the same response so the
    // SPA can prime its first state-changing call without an extra round
    // trip.
    req.cookies = { ...(req.cookies || {}), [CSRF_COOKIE_NAME]: token };
  }
  next();
}

// Rejects state-changing requests whose header token does not match the
// cookie token. Safe methods (GET/HEAD/OPTIONS) bypass the check.
export function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || !timingSafeEqualString(cookieToken, headerToken)) {
    return res.status(403).json({ message: "Invalid or missing CSRF token" });
  }
  return next();
}
