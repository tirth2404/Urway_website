export function notFound(_req, res) {
  return res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  return res.status(statusCode).json({ error: err?.message || "Internal server error" });
}
