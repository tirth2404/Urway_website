import express from "express";
import { asyncHandler }          from "../middleware/asyncHandler.js";
import { verifyToken, verifySelf } from "../middleware/authMiddleware.js";
import { authSignIn, refreshTokens, authSignOut } from "../controller/authController.js";
import {
  createTarget,
  dashboard,
  flagExam,
  getHealth,
  onboarding,
  startExam,
  syncExtension,
} from "../controller/appController.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get( "/health",          asyncHandler(getHealth));
router.post("/auth/signin",     asyncHandler(authSignIn));
router.post("/auth/refresh",    asyncHandler(refreshTokens));
router.post("/auth/signout",    asyncHandler(authSignOut));
router.post("/onboarding",      asyncHandler(onboarding));   // creates account — public

// ── Protected (JWT required) ──────────────────────────────────────────────────
router.get( "/dashboard/:userId",         verifyToken, verifySelf, asyncHandler(dashboard));
router.post("/targets/:userId",           verifyToken, verifySelf, asyncHandler(createTarget));
router.post("/exam/start",                verifyToken,             asyncHandler(startExam));
router.post("/exam/flag/:sessionId",      verifyToken,             asyncHandler(flagExam));
router.post("/extension/sync/:userId",    verifyToken, verifySelf, asyncHandler(syncExtension));

export default router;
