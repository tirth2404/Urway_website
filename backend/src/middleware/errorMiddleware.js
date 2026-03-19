export function notFound(req, res) {
  return res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const message = err?.message || "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(`[Error] ${message}`, err?.stack || "");
  }

  return res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err?.stack }),
  });
}