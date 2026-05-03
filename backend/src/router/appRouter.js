import express from "express";
import { asyncHandler }           from "../middleware/asyncHandler.js";
import { verifyToken, verifySelf } from "../middleware/authMiddleware.js";
import authRouter from "./authRouter.js";
import {
  createTarget,
  dashboard,
  flagExam,
  getHealth,
  onboarding,
  startExam,
  syncChromeExtension,
  syncVscodeExtension,
} from "../controller/appController.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get( "/health",       asyncHandler(getHealth));
router.use("/auth",          authRouter);
router.post("/onboarding",   asyncHandler(onboarding));   // creates account — public

// ── Protected (JWT required) ──────────────────────────────────────────────────
router.get(  "/dashboard/:userId",              verifyToken, verifySelf, asyncHandler(dashboard));
router.post( "/targets/:userId",               verifyToken, verifySelf, asyncHandler(createTarget));
router.post( "/exam/start",                    verifyToken,             asyncHandler(startExam));
router.post( "/exam/flag/:sessionId",          verifyToken,             asyncHandler(flagExam));

// ── Extension sync endpoints ───────────────────────────────────────────────────
// Renamed: /extension/sync → /chrome/sync  (chrome_activity collection)
// Added:   /vscode/sync                    (vscode_activity collection)
router.post("/chrome/sync/:userId",            verifyToken, verifySelf, asyncHandler(syncChromeExtension));
router.post("/vscode/sync/:userId",            verifyToken, verifySelf, asyncHandler(syncVscodeExtension));

// ── Backward-compat alias — old extension clients still work ──────────────────
router.post("/extension/sync/:userId",         verifyToken, verifySelf, asyncHandler(syncChromeExtension));

export default router;
