import express from "express";
import { asyncHandler }           from "../middleware/asyncHandler.js";
import { verifyToken, verifySelf } from "../middleware/authMiddleware.js";
import authRouter from "./authRouter.js";
import {
  createTarget,
  dashboard,
  flagExam,
  getFinalRoadmaps,
  getHealth,
  onboarding,
  recomputeFallbackPredictions,
  recomputePredictions,
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
router.get(  "/final-roadmaps/:userId",          verifyToken, verifySelf, asyncHandler(getFinalRoadmaps));
router.post( "/targets/:userId",               verifyToken, verifySelf, asyncHandler(createTarget));
router.post( "/exam/start",                    verifyToken,             asyncHandler(startExam));
router.post( "/exam/flag/:sessionId",          verifyToken,             asyncHandler(flagExam));
router.post( "/predictions/recompute/:userId", verifyToken, verifySelf, asyncHandler(recomputePredictions));

// ── Extension sync endpoints ───────────────────────────────────────────────────
// Renamed: /extension/sync → /chrome/sync  (chrome_activity collection)
// Added:   /vscode/sync                    (vscode_activity collection)
router.post("/chrome/sync/:userId",            verifyToken, verifySelf, asyncHandler(syncChromeExtension));
router.post("/vscode/sync/:userId",            verifyToken, verifySelf, asyncHandler(syncVscodeExtension));

// ── Backward-compat alias — old extension clients still work ──────────────────
router.post("/extension/sync/:userId",         verifyToken, verifySelf, asyncHandler(syncChromeExtension));

// ── Admin maintenance endpoint (header protected) ─────────────────────────────
router.post("/admin/predictions/recompute-fallbacks", asyncHandler(recomputeFallbackPredictions));

export default router;
