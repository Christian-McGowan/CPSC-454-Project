const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function toQueryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function extractErrorMessage(data, status) {
  if (data?.fieldErrors) {
    const flattened = Object.entries(data.fieldErrors)
      .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`));

    if (flattened.length) {
      return flattened.join(" | ");
    }
  }

  if (Array.isArray(data?.issues) && data.issues.length) {
    return data.issues.map((issue) => `${issue.path}: ${issue.message}`).join(" | ");
  }

  if (status >= 500) {
    return data?.message || "The server ran into a problem. Refresh and try again.";
  }

  return data?.message || "Request failed";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(extractErrorMessage(data, response.status));
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export const api = {
  me: () => request("/auth/me"),
  health: () => request("/health"),
  passwordPolicy: () => request("/auth/password-policy"),
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  portalSummary: () => request("/portal/summary"),
  listPatients: (params = {}) => request(`/patients${toQueryString(params)}`),
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (payload) => request("/patients", { method: "POST", body: JSON.stringify(payload) }),
  updatePatient: (id, payload) => request(`/patients/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listClaims: (params = {}) => request(`/claims${toQueryString(params)}`),
  createClaim: (payload) => request("/claims", { method: "POST", body: JSON.stringify(payload) }),
  updateClaim: (id, payload) => request(`/claims/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listAuditEvents: (params = {}) => request(`/audit${toQueryString(params)}`),
  privacyOverview: () => request("/privacy/overview"),
  bootstrapDemo: () => request("/demo/bootstrap", { method: "POST", body: JSON.stringify({}) })
};
