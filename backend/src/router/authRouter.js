import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authSignIn, refreshTokens, authSignOut } from "../controller/authController.js";

const authRouter = express.Router();

authRouter.post("/signin",  asyncHandler(authSignIn));
authRouter.post("/refresh", asyncHandler(refreshTokens));
authRouter.post("/signout", asyncHandler(authSignOut));

export default authRouter;