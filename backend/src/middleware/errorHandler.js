function buildSafeError(error, defaultStatus = 500) {
  if (error?.code === 11000) {
    return {
      status: 409,
      message: "This record already exists.",
      details: null
    };
  }

  if (error?.code === 13) {
    return {
      status: 503,
      message: "The database user does not have the required permissions.",
      details: null
    };
  }

  if (error?.name === "ZodError") {
    return {
      status: 400,
      message: "Validation failed",
      details: null
    };
  }

  if (error?.status && error?.message) {
    return {
      status: error.status,
      message: error.message,
      details: null
    };
  }

  return {
    status: defaultStatus,
    message: defaultStatus >= 500 ? "Something went wrong on the server." : "Request failed.",
    details: null
  };
}

export function notFoundHandler(req, res) {
  return res.status(404).json({ message: "Resource not found" });
}

export function errorHandler(error, req, res, next) {
  const safe = buildSafeError(error, error?.status || 500);

  if (safe.status >= 500) {
    console.error("Unhandled error", error);
  }

  return res.status(safe.status).json({
    message: safe.message,
    ...(safe.details ? { details: safe.details } : {}),
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
}
