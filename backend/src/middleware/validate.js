function normalizePath(path) {
  return path
    .filter((segment) => segment !== "body" && segment !== "query" && segment !== "params")
    .join(".") || "request";
}

export function validate(schema) {
  return function validationMiddleware(req, res, next) {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: normalizePath(issue.path),
        message: issue.message
      }));

      const fieldErrors = issues.reduce((accumulator, issue) => {
        accumulator[issue.path] = accumulator[issue.path] || [];
        accumulator[issue.path].push(issue.message);
        return accumulator;
      }, {});

      return res.status(400).json({
        message: "Validation failed",
        fieldErrors,
        issues
      });
    }

    req.validated = parsed.data;
    return next();
  };
}
