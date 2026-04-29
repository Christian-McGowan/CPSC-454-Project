import crypto from "crypto";

// NIST SP 800-53 AU-9 — Protection of Audit Information.
// Each audit event is hashed together with the previous event's hash, forming
// a chain. Tampering with any historical record invalidates every hash that
// follows it, which makes silent log modification detectable.

const CHAIN_FIELDS = [
  "actorId",
  "actorName",
  "actorRole",
  "action",
  "resourceType",
  "resourceId",
  "patientId",
  "patientName",
  "outcome",
  "details",
  "metadata",
  "ip",
  "userAgent",
  "createdAt"
];

function canonicalize(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    return sortedKeys.reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value && typeof value.toString === "function" && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return value.toString();
  }
  return value;
}

export function computeEventHash(event, previousHash) {
  const projection = {};
  for (const field of CHAIN_FIELDS) {
    projection[field] = canonicalize(event[field]);
  }
  projection.previousHash = previousHash || "GENESIS";

  const serialized = JSON.stringify(projection);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export function verifyChainPair(event, previousHash) {
  const expected = computeEventHash(event, previousHash);
  return expected === event.hash;
}
