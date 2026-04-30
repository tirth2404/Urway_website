# OAuth Configuration Fix Guide

## Problem
The extension is receiving "redirect_uri_mismatch" errors because the Chrome extension's redirect URI hasn't been registered in each OAuth provider's console.

## Your Extension ID
First, find your extension ID:
1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Look for "U'rWay Intelligence" and copy the **ID** (format: `abcdef123456...`)
4. Your redirect URI will be: `https://[YOUR_ID].chromiumapp.org/`

Example: If your ID is `lklaihnhdbijinpodijjidnbiefpfclg`, the redirect URI is:
```
https://lklaihnhdbijinpodijjidnbiefpfclg.chromiumapp.org/
```

---

## Fix #1: Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **U'rWay Intelligence** (or the project for client ID `351530263168-tue4epbrpfkvc2psh48al0i94k3vnsj3`)
3. Left sidebar → **APIs & Services** → **Credentials**
4. Find and click the OAuth 2.0 Client ID: `351530263168-tue4epbrpfkvc2psh48al0i94k3vnsj3`
5. Under "Authorized redirect URIs", add:
   ```
   https://[YOUR_EXTENSION_ID].chromiumapp.org/
   ```
6. Click **Save**

**Example:**
```
https://lklaihnhdbijinpodijjidnbiefpfclg.chromiumapp.org/
```

---

## Fix #2: Microsoft Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Search for **App registrations**
3. Find the app with client ID: `fb00a083-ded3-4914-8f15-ee52b4fe9a79`
4. Left sidebar → **Authentication**
5. Under "Redirect URIs", add:
   ```
   https://[YOUR_EXTENSION_ID].chromiumapp.org/
   ```
6. Click **Save**

**Note:** Make sure the redirect URI type is set to **Web** (not Mobile/Desktop)

---

## Fix #3: GitHub

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Find the app with client ID: `Ov23liQ5c006P39beNcC`
3. Click on it to edit
4. Under "Authorization callback URL", change to:
   ```
   https://[YOUR_EXTENSION_ID].chromiumapp.org/
   ```
5. Click **Update application**

---

## Verify Installation

1. Reload the extension:
   - Go to `chrome://extensions/`
   - Find "U'rWay Intelligence"
   - Click the **refresh icon** (⟳)

2. Test login:
   - Click the extension popup
   - Try "Sign in with Google" (or Microsoft/GitHub)
   - You should see the login page without redirect errors

---

## Troubleshooting

### Still getting redirect_uri_mismatch?
- **Double-check the extension ID** is correct (not truncated)
- **Wait 5-10 minutes** for OAuth provider changes to propagate
- **Clear browser cache** (Ctrl+Shift+Delete)

### Getting different OAuth error?
- Check your client IDs in `manifest.json` match the correct apps
- Ensure scopes are correct: `email profile` for Google, `openid email profile` for Microsoft

---

## Reference: manifest.json

Your current OAuth2 configuration:
```json
"oauth2": {
  "client_id": "351530263168-tue4epbrpfkvc2psh48al0i94k3vnsj3.apps.googleusercontent.com",
  "microsoft_client_id": "fb00a083-ded3-4914-8f15-ee52b4fe9a79",
  "github_client_id": "Ov23liQ5c006P39beNcC",
  "scopes": ["email", "profile"]
}
```

These client IDs are already in your manifest - you just need to update the OAuth provider consoles with the redirect URI.
