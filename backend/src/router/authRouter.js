import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authSignIn, refreshTokens, authSignOut, resolveEmail } from "../controller/authController.js";

const authRouter = express.Router();

authRouter.post("/signin",           asyncHandler(authSignIn));
authRouter.post("/refresh",          asyncHandler(refreshTokens));
authRouter.post("/signout",          asyncHandler(authSignOut));

// Extension identity bridge — no auth required (public, read-only, returns userId only)
authRouter.get("/resolve/:email",    asyncHandler(resolveEmail));

export default authRouter;