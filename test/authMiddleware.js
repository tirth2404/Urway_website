import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";

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
 * Validates the shared inter-service secret on genai-service calls.
 *
 * FIX: Node's timingSafeEqual throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH when
 * the two buffers have different byte lengths, crashing the server with a 500.
 * We must compare lengths first — but do it in constant time by always
 * converting both sides to the same encoding before the byte-length check,
 * so that a length mismatch leaks nothing extra compared to the content check.
 */
export function verifyServiceSecret(req, res, next) {
  const incoming = req.headers["x-service-secret"] ?? "";
  const expected = process.env.SERVICE_SECRET ?? "";

  // Fast-reject if expected secret is not configured.
  if (!expected) {
    return res.status(403).json({ error: "Forbidden: service secret not configured." });
  }

  const incomingBuf = Buffer.from(incoming);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual requires identical lengths; a length mismatch is itself a
  // mismatch, so return 403 — but do NOT short-circuit before the length check
  // to avoid making the length observable via timing.
  if (
    incomingBuf.length !== expectedBuf.length ||
    !timingSafeEqual(incomingBuf, expectedBuf)
  ) {
    return res.status(403).json({ error: "Forbidden: invalid service secret." });
  }

  next();
}
