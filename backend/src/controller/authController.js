import bcrypt from "bcryptjs";
import { UserCredential } from "../model/UserCredential.js";
import { UserProfile }    from "../model/UserProfile.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
} from "../utils/tokenUtils.js";

function normalizeEmail(e = "") { return String(e).trim().toLowerCase(); }
function validateEmail(e = "")  { return /^\S+@\S+\.\S+$/.test(e); }

/* ─────────────────────────────────────────────────────────────────
   POST /api/auth/signin
   Body: { email, password }
   Returns: { accessToken, userId, virtualClusterTag }
   Sets:    HttpOnly refreshToken cookie
───────────────────────────────────────────────────────────────── */
export async function authSignIn(req, res) {
  const email    = normalizeEmail(req.body?.email || "");
  const password = String(req.body?.password || "");

  if (!validateEmail(email) || password.length < 8) {
    return res.status(400).json({ error: "Valid email and password (min 8 chars) are required." });
  }

  const credential = await UserCredential.findOne({ email }).lean();
  if (!credential) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const isMatch = await bcrypt.compare(password, credential.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const profile = await UserProfile.findOne({ userId: credential.userId }).lean();

  const accessToken  = signAccessToken(credential.userId, credential.email);
  const refreshToken = signRefreshToken(credential.userId);
  setRefreshCookie(res, refreshToken);

  return res.json({
    accessToken,
    userId:            credential.userId,
    virtualClusterTag: profile?.virtualClusterTag || null,
  });
}

/* ─────────────────────────────────────────────────────────────────
   POST /api/auth/refresh
   Reads HttpOnly cookie → issues new access token + rotates refresh
───────────────────────────────────────────────────────────────── */
export async function refreshTokens(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: "No refresh token." });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Refresh token expired. Please sign in again." });
  }

  const credential = await UserCredential.findOne({ userId: decoded.userId }).lean();
  if (!credential) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "User not found." });
  }

  const newAccessToken  = signAccessToken(credential.userId, credential.email);
  const newRefreshToken = signRefreshToken(credential.userId);
  setRefreshCookie(res, newRefreshToken);

  // Also return userId + virtualClusterTag so the frontend can restore user state
  const profile = await UserProfile.findOne({ userId: decoded.userId }).lean();

  return res.json({
    accessToken:       newAccessToken,
    userId:            credential.userId,
    virtualClusterTag: profile?.virtualClusterTag ?? null,
  });
}

/* ─────────────────────────────────────────────────────────────────
   POST /api/auth/signout
───────────────────────────────────────────────────────────────── */
export function authSignOut(_req, res) {
  clearRefreshCookie(res);
  return res.json({ ok: true });
}