# U'rWay — 6 Critical Bug Fixes

---

## Bug 1 — OnboardingFlow.jsx line 2263: localStorage instead of signIn()

**File:** `frontend/src/OnboardingFlow.jsx`

**Problem:** After onboarding completes, `userId` was written to `localStorage` but `AuthContext` never reads from `localStorage`. So `AuthContext.user` stayed `null` and Roadmap immediately redirected back to `/`.

**Fix — two changes:**

### 1. Add import at the top of the file (after existing imports):
```js
import { useAuth } from './context/AuthContext';
```

### 2. Inside `OnboardingFlow` component body, destructure `signIn`:
```js
// Add this line near the top of the component, alongside the other useState calls:
const { signIn } = useAuth();
```

### 3. In `handleFinish`, replace the localStorage line:
```js
// BEFORE (line 2263):
if (data.userId) localStorage.setItem('urway_user_id', data.userId);
onComplete({ userId: data.userId });

// AFTER:
// Onboarding succeeded — immediately sign in so AuthContext.user is populated.
await signIn(formData.email, formData.password);
onComplete({ userId: data.userId });
```

---

## Bug 2 — authRouter.js: empty file causing confusion

**File:** `backend/src/router/authRouter.js`

**Problem:** Empty file. Routes were (correctly) registered in `appRouter.js`, but the dead file confused everyone.

**Fix — two valid options:**

**Option A (simplest):** Just **delete** `backend/src/router/authRouter.js`. Done.

**Option B (cleaner architecture):** Use the provided `authRouter.js` file and update `appRouter.js`:

```js
// In appRouter.js, replace these three lines:
router.post("/auth/signin",  asyncHandler(authSignIn));
router.post("/auth/refresh", asyncHandler(refreshTokens));
router.post("/auth/signout", asyncHandler(authSignOut));

// With:
import authRouter from './authRouter.js';
router.use('/auth', authRouter);

// And remove the authController imports from appRouter.js since authRouter.js handles them.
```

The provided `authRouter.js` in this fix package implements Option B.

---

## Bug 3 — router/genaiClientController.js: controller in wrong folder

**File:** `backend/src/router/genaiClientController.js`

**Problem:** Empty file placed in the wrong folder. The real controller is at `backend/src/controller/genaiClientController.js` and is imported correctly by `appController.js`.

**Fix:** **Delete** `backend/src/router/genaiClientController.js`. No other changes needed.

---

## Bug 4 — appController.js: dead authSignIn function (lines 597–621)

**File:** `backend/src/controller/appController.js`

**Problem:** Duplicate `authSignIn` that has no JWT logic and is never called (router correctly uses `authController.js`). It's a maintenance timebomb — someone will inevitably edit the wrong one.

**Fix:** Delete lines 594–621 in `appController.js` — the entire exported `authSignIn` function:

```js
// DELETE this entire block (lines ~594–621):
/**
 * POST /api/auth/signin
 * Verify email + password, return userId.
 */
export async function authSignIn(req, res) {
  // ... entire function body ...
}
```

Also clean up the now-unused imports at the top if `bcrypt` is no longer needed anywhere else in `appController.js` (it isn't — `onboarding()` calls `bcrypt.hash` so keep it).

---

## Bug 5 — authMiddleware.js: timingSafeEqual crashes on mismatched lengths

**File:** `backend/src/middleware/authMiddleware.js`

**Problem:** `crypto.timingSafeEqual()` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` when the two buffers have different byte lengths (e.g. empty string incoming header). This produced a 500 instead of a clean 403.

**Fix:** Add a length check before calling `timingSafeEqual`. The full corrected file is provided.

```js
// BEFORE:
if (!expected || !hmac.timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))) {
  return res.status(403).json({ error: "Forbidden: invalid service secret." });
}

// AFTER:
if (!expected) {
  return res.status(403).json({ error: "Forbidden: service secret not configured." });
}

const incomingBuf = Buffer.from(incoming);
const expectedBuf = Buffer.from(expected);

if (
  incomingBuf.length !== expectedBuf.length ||
  !timingSafeEqual(incomingBuf, expectedBuf)
) {
  return res.status(403).json({ error: "Forbidden: invalid service secret." });
}
```

Also note: the import changed from `import hmac from "node:crypto"` to the named import `import { timingSafeEqual } from "node:crypto"` for clarity.

---

## Bug 6 — corsMiddleware.js: Set-Cookie header not exposed

**File:** `backend/src/middleware/corsMiddleware.js`

**Problem:** The CORS config was missing `exposedHeaders: ["Set-Cookie"]`. In some browser/fetch configurations, the `Set-Cookie` header from cross-origin responses is silently dropped during preflight even with `credentials: true` on the fetch call, so the refresh-token cookie never landed.

**Fix:** Add `exposedHeaders` to the cors config. The full corrected file is provided.

```js
// Add this line to the cors() options object:
exposedHeaders: ["Set-Cookie"],
```

---

## Files to replace / delete

| Action  | Path |
|---------|------|
| Edit    | `frontend/src/OnboardingFlow.jsx` — see Bug 1 above |
| Replace | `backend/src/router/authRouter.js` — use provided file |
| **Delete** | `backend/src/router/genaiClientController.js` |
| Edit    | `backend/src/controller/appController.js` — remove lines 597–621 |
| Replace | `backend/src/middleware/authMiddleware.js` — use provided file |
| Replace | `backend/src/middleware/corsMiddleware.js` — use provided file |
