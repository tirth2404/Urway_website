// backend/src/router/authRouter.js
//
// Fix: was an empty file. Auth routes were being registered directly in
// appRouter.js (which still works), but this dead file caused confusion.
// Option A (recommended): Delete this file entirely and keep routes in appRouter.js.
// Option B: Move auth routes here and import from appRouter.js — shown below.
//
// This file shows Option B. To apply it:
//   1. Replace this file with the content below.
//   2. In appRouter.js, replace the three direct auth-route registrations with:
//        import authRouter from './authRouter.js';
//        router.use('/auth', authRouter);

import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authSignIn, refreshTokens, authSignOut } from "../controller/authController.js";

const authRouter = express.Router();

authRouter.post("/signin",  asyncHandler(authSignIn));
authRouter.post("/refresh", asyncHandler(refreshTokens));
authRouter.post("/signout", asyncHandler(authSignOut));

export default authRouter;
