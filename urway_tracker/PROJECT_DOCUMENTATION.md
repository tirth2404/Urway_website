# U'rWay Tracker — Project Documentation

## Overview

U'rWay is a browser extension that tracks browsing activity locally, aggregates it per day, and (optionally) synchronizes encrypted activity segments to a central bridge server for cross-browser consolidation and history.

This document consolidates the project's design, flows, encryption details, cross-browser sync behavior, OAuth providers, developer setup, and troubleshooting in one place.

---

## Architecture

- Popup (React app `popup_react/`): UI — shows Today's view and History calendar/day view. Handles OAuth sign-in flows (Google, Microsoft, GitHub), session management, and requests history/activities from the bridge.
- Background Service Worker (`background.js`): activity collector and periodic sync agent. Buffers activities locally, encrypts with per-user keys, and uploads to the bridge when reachable. Also provides helpers (e.g., Graph requests) for the popup.
- Bridge (`urway_bridge.py`): Flask application that stores encrypted segments in MongoDB (`UrWay_Intelligence.daily_footprint`) and provides endpoints used by the popup/background: `/register-or-get-user`, `/sync`, `/activities`, `/history`, and `/github/exchange`.
- Crypto utilities (`crypto-utils.js`): browser-side key derivation (PBKDF2) and AES‑GCM encryption/decryption helpers.
- Storage: `chrome.storage.local` is the canonical local storage for sessions, buffered activities and small metadata. The bridge persists encrypted segments to MongoDB.

---

## How tracking works (high level)

1. Background worker wakes on an alarm (every 30 seconds) and inspects the active tab.
2. It groups activity into a `footprint` array (entries per URL/title/date) and updates start/end timestamps and durations.
3. For each updated footprint entry, the worker calls `syncToBridge()` to attempt secure sync.
4. `syncToBridge()` derives an encryption key from the user's email and a registration timestamp and encrypts the activity object (IV + ciphertext, base64-encoded) using AES-256-GCM.
5. The worker posts the encrypted payload to `/sync` including metadata (date, timestamps, duration). The bridge stores per-site documents and appends segments.

Important: at no point does the bridge receive plaintext activity data — all sensitive content is encrypted client-side. The bridge stores metadata (domain/title/url when available) for indexing, but the canonical sensitive payload remains encrypted and only decryptable by the user's derived key.

---

## Encryption details

- Key derivation: AES-256-GCM keys are derived using PBKDF2 with inputs: `email + '|' + registrationTimestamp`. The salt is fixed (`urway_intelligence_salt_v1`) and iterations = 100000. This yields a deterministic key per (email, registrationTimestamp).
- Registration timestamp: a timestamp assigned when the user first registers with the bridge via `/register-or-get-user`. This timestamp is the canonical cross-browser anchor — the same timestamp used in each browser produces the same derived key enabling cross-browser decryption.
- Offline mode: if the bridge is unreachable, the extension creates a device-local timestamp (`deviceRegTs`) and encrypts buffered activities with a device-local key derived from `(email, deviceRegTs)`. Those buffered entries remain encrypted at rest locally and are re-encrypted with the canonical key when the bridge becomes reachable.
- Encryption format: activity objects are JSON-serialized and encrypted with AES‑GCM. The IV (12 bytes) is prepended to ciphertext and the combined bytes are base64-encoded for transport and storage.

Security notes:
- The server never receives plaintext — re-encryption happens client-side. The bridge therefore cannot decrypt user data.
- Device-local buffering preserves confidentiality while offline, since buffered items are encrypted with a device-local key.
- Do NOT share the `deviceRegTs` or local storage contents across untrusted channels.

---

## Cross-browser sync (how it prevents split users)

1. When a user logs in, the popup calls `POST /register-or-get-user` with the user's email. The bridge returns a canonical `registrationTimestamp` (atomic upsert by email).
2. Each browser uses `deriveKeyFromTimestamp(email, registrationTimestamp)` to produce the encryption key. Uploads from multiple browsers that use the same `registrationTimestamp` will be stored under the same `registrationTimestamp` and thus consolidated by the bridge into one user's activity timeline.
3. If a browser logged in while the bridge was offline, it will not create a permanent canonical timestamp locally. Instead it uses a `deviceRegTs` and buffers encrypted activities locally. When the bridge is available, the client requests the canonical `registrationTimestamp` and re-encrypts buffered items with the canonical key and uploads them, ensuring all uploads map to the single canonical user record.

This approach prevents the earlier problem of separate browsers creating diverging user records and producing inconsistent totals.

---

## Server endpoints (summary)

- `POST /register-or-get-user` — Input: `{ email }`. Returns `{ registrationTimestamp }`. Implemented atomically (upsert by email) so multiple calls return the same timestamp.
- `POST /sync` — Input: encrypted payload + metadata. Bridge stores or upserts per-site documents and appends segments (encryptedData or unencryptedData). Returns success and stored metadata.
- `GET /activities?userEmail=...&date=...` — Returns per-site documents (segments, totalDuration) for the requested date and user.
- `GET /history?userEmail=...` — Returns date-level totals for calendar view.
- `POST /github/exchange` — Server-side exchange for GitHub OAuth code → access token → primary email (server holds client secret in environment `.env`).

---

## OAuth flows

All OAuth flows authenticate the user and return an email address which is used as the canonical account identifier.

1. Google (client-side implicit flow)
   - Popup constructs an OAuth authorization URL and opens `chrome.identity.launchWebAuthFlow`.
   - On success, extractor obtains an access token from the redirect fragment and fetches the user's profile from Google to obtain their email.
   - The popup then calls `completeLogin(email)` which registers with the bridge and persists `registrationTimestamp`.

2. Microsoft
   - Implemented as an implicit `id_token` flow (popup requests id_token via response_type=id_token). The popup decodes the JWT id_token to extract email.
   - If id_token is not returned (Azure app misconfiguration), the popup falls back to `access_token` and asks the background worker to call Microsoft Graph (`/me`) using the access token. Graph response is used to obtain the user's email.
   - Note: for production, Authorization Code + PKCE is recommended for increased security and compatibility with modern Azure AD app settings.

3. GitHub (hybrid client+server)
   - The popup uses `chrome.identity.launchWebAuthFlow` to obtain a `code` from GitHub.
   - The code is posted to the bridge at `/github/exchange`. The bridge performs server-side exchange using `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (read from `.env`) to get an access token and then fetches the user's primary verified email from GitHub API and returns it to the popup.
   - This avoids exposing client secrets in the extension.

---

## Local buffering and reconciliation (detailed)

- Buffering: when uploads fail (bridge unreachable) or CryptoUtils not available, items are added to `chrome.storage.local.pendingActivities`. Each pending item includes either `encryptedData` (encrypted with device key) or `unencryptedData` (if CryptoUtils missing — but in recent changes we encrypt with device key whenever possible), plus metadata and `deviceRegTs` used for the device key.
- Reconciliation: background exposes a `forceSync` message. When the bridge is available and the popup requests a canonical `registrationTimestamp`, the background's `flushPendingActivities()` does:
  1. Call `/register-or-get-user` → get canonical registrationTimestamp.
  2. For each pending item:
     - If encrypted with device key: decrypt with device key, re-encrypt with canonical key, POST to `/sync`.
     - If unencrypted (rare): encrypt with canonical key, POST to `/sync`.
  3. Remove successfully uploaded items from `pendingActivities`.

This ensures buffered activities become part of the canonical user record and prevents split totals.

---

## Developer setup & commands

1. Create and populate `.env` (optional, for GitHub exchange and Mongo config):
   - `GITHUB_CLIENT_ID=...`
   - `GITHUB_CLIENT_SECRET=...`
   - `MONGO_URI=mongodb+srv://tirth2404:tirth2404@cluster0.qut1y8v.mongodb.net/`
   - `DB_NAME=urway`
   - `BRIDGE_PORT=5002`

2. Start the Flask bridge (bridge runs on http://127.0.0.1:5002 by default):
```bash
python urway_bridge.py
```

3. Build the React popup (from `popup_react/`):
```bash
cd popup_react
npm install
npm run build
```

4. Load the extension in Chrome (Developer Mode) pointing to the project root or to the built `popup_react/dist` assets as needed.

5. Register OAuth apps (if testing Google/Microsoft/GitHub):
   - Google: use the extension redirect URL `chrome.identity.getRedirectURL()` and configure OAuth client.
   - Microsoft: enable ID tokens (or implement Authorization Code + PKCE) and include redirect URL.
   - GitHub: add the redirect URL to the GitHub OAuth app and set client id/secret in `.env`.

---

## Troubleshooting checklist

- If totals differ across browsers:
  1. Ensure the bridge is running and reachable from both browsers.
  2. Verify both browsers have the same `registrationTimestamp` (open extension console and run: `chrome.storage.local.get(['userEmail','registrationTimestamp','deviceRegTs','pendingActivities'], console.log)`).
  3. If one browser has buffered activities, either start the bridge and reopen the popup (it will trigger `forceSync`) or open the background console and run `chrome.runtime.sendMessage({action:'forceSync'}, console.log)`.

- If Microsoft id_token is missing: check Azure App Registration settings to enable ID tokens or switch to Authorization Code + PKCE.
- If GitHub exchange fails: ensure `.env` has `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` and bridge can reach GitHub.

---

## Files kept (core)

- `urway_bridge.py` — Flask bridge and endpoints
- `background.js` — extension background worker (activity collection + sync)
- `crypto-utils.js` — client-side cryptography helper
- `popup_react/` — React UI source (builds to `popup_react/dist` used by extension)
- `manifest.json` — extension manifest
- `images/` — assets

---

If you want, I can now:
- Add a small UI indicator/button in the popup to show the pending buffer size and to trigger `forceSync` (handy for testing).
- Run tests or attempt a local end-to-end test sequence (start bridge, sign in, buffer activities offline, bring bridge up, flush pending items).

---

Document last updated: 2026-02-12
