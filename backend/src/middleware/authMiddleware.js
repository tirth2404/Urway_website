import jwt from "jsonwebtoken";
import hmac from "node:crypto";

/**
 * Verifies the Bearer JWT sent by the frontend.
 * Attaches decoded payload to req.user on success.
 */
export function verifyToken(req, res, next) {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Token expired." : "Invalid token.";
    return res.status(401).json({ error: message });
  }
}

/**
 * Ensures the authenticated user can only touch their own resources.
 * Must come AFTER verifyToken — compares req.user.userId vs :userId route param.
 */
export function verifySelf(req, res, next) {
  if (req.user?.userId !== req.params.userId) {
    return res.status(403).json({ error: "Forbidden: cannot access another user's data." });
  }
  next();
}

/**
 * Validates the shared inter-service secret on genai-service calls
 * (used in genai-service, not in backend routes).
 */
export function verifyServiceSecret(req, res, next) {
  const incoming = req.headers["x-service-secret"] ?? "";
  const expected = process.env.SERVICE_SECRET ?? "";
  if (!expected || !hmac.timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))) {
    return res.status(403).json({ error: "Forbidden: invalid service secret." });
  }
  next();
}
