import jwt from "jsonwebtoken";

const ACCESS_TTL  = "15m";
const REFRESH_TTL = "7d";

export const signAccessToken  = (userId, email) =>
  jwt.sign({ userId, email }, process.env.JWT_SECRET,         { expiresIn: ACCESS_TTL,  issuer: "urway" });

export const signRefreshToken = (userId) =>
  jwt.sign({ userId },        process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL, issuer: "urway" });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

/** Store refresh token in HttpOnly cookie — JS can never read it */
export const setRefreshCookie = (res, token) =>
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure:   false,                     // true only in production (requires HTTPS)
    sameSite: "lax",                     // "strict" blocks cross-port in dev
    maxAge:   7 * 24 * 60 * 60 * 1000,
    path:     "/",                       // "/" so browser sends on all /api/auth/* calls
  });

export const clearRefreshCookie = (res) =>
  res.clearCookie("refreshToken", { path: "/" });