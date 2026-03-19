import express from "express";

import {
  authSignIn,
  createTarget,
  dashboard,
  flagExam,
  getHealth,
  onboarding,
  startExam,
  syncExtension,
} from "../controller/appController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

router.get("/health", asyncHandler(getHealth));
router.post("/auth/signin", asyncHandler(authSignIn));
router.post("/onboarding", asyncHandler(onboarding));
router.get("/dashboard/:userId", asyncHandler(dashboard));
router.post("/targets/:userId", asyncHandler(createTarget));
router.post("/exam/start", asyncHandler(startExam));
router.post("/exam/flag/:sessionId", asyncHandler(flagExam));
router.post("/extension/sync/:userId", asyncHandler(syncExtension));

export default router;
