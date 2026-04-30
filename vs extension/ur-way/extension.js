const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
let fetchFn = null;
try {
    fetchFn = globalThis.fetch ? globalThis.fetch.bind(globalThis) : require('node-fetch');
} catch (e) {
    fetchFn = null;
}

let intervalId;
let lastActivityTime = Date.now();
const IDLE_LIMIT = 60000; // 1 minute
let timerIntervalId;
let logoutCheckIntervalId;
let statusBarItem;
let elapsedSeconds = 0;
let isWindowFocused = (vscode.window && vscode.window.state && vscode.window.state.focused) || false;
let extensionContext;
let isSigningIn = false; // Flag to prevent multiple sign-in dialogs
let isAuthenticated = false; // true when a user is signed in
let pendingAuthCode = null; // filled by URI handler when browser redirects to vscode://
const VS_BACKEND_BASE_URL = (process.env.URWAY_VS_BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');

function vsBackendUrl(pathname) {
    return `${VS_BACKEND_BASE_URL}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

// Persist elapsed seconds per-user so timers resume across sign-outs
function _getElapsedKeyForUser(user) {
    if (!user) return null;
    const id = user.id || user._id || user.email || null;
    if (!id) return null;
    return `urway.elapsed.${id}`;
}

async function saveElapsedForUser(user, seconds) {
    try {
        if (!extensionContext || !user) return;
        const key = _getElapsedKeyForUser(user);
        if (!key) return;
        await extensionContext.globalState.update(key, seconds || 0);
        console.log('Saved elapsed for', key, seconds || 0);
    } catch (e) { console.error('Error saving elapsed for user:', e); }
}

function loadElapsedForUser(user) {
    try {
        if (!extensionContext || !user) return 0;
        const key = _getElapsedKeyForUser(user);
        if (!key) return 0;
        const v = extensionContext.globalState.get(key, 0);
        console.log('Loaded elapsed for', key, v);
        return v || 0;
    } catch (e) { console.error('Error loading elapsed for user:', e); return 0; }
}

// Helper: determine a stable file path for queued logs
function getLogFilePath() {
    // Prefer workspace folder when present (user-visible project),
    // otherwise use extension global storage (stable for extension-dev host)
    try {
        if (vscode.workspace && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
            return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'urway_logs.json');
        }
    } catch (e) {
        // ignore and fall back
    }

    if (extensionContext && extensionContext.globalStorageUri) {
        const storageDir = extensionContext.globalStorageUri.fsPath;
        try { fs.mkdirSync(storageDir, { recursive: true }); } catch (e) { }
        return path.join(storageDir, 'urway_logs.json');
    }

    // Last resort: extension path or cwd
    const fallback = (extensionContext && extensionContext.extensionPath) || process.cwd();
    return path.join(fallback, 'urway_logs.json');
}

async function activate(context) {
    extensionContext = context;
    // Register a URI handler so the browser can redirect to vscode://urway.urway-tracker/auth?code=...
    try {
        context.subscriptions.push(vscode.window.registerUriHandler({
            handleUri(uri) {
                try {
                    console.log('Received URI:', uri.toString());
                    const params = new URLSearchParams(uri.query);
                    const code = params.get('code');
                    if (code) {
                        pendingAuthCode = code;
                        vscode.window.showInformationMessage('Received sign-in code from browser. Completing sign-in...');
                    }
                } catch (e) {
                    console.error('Error handling URI:', e);
                }
            }
        }));
    } catch (e) {
        console.error('Failed to register URI handler:', e);
    }
    console.log('U\'rWay Tracker is active!');
    console.log('Checking for stored user...');

    let user = null;
    try {
        const stored = await context.secrets.get('urway.user');
        if (stored) {
            user = JSON.parse(stored);
            isAuthenticated = true;
            // Restore previously persisted elapsed time for this user so timer resumes across restarts
            try {
                const restored = loadElapsedForUser(user);
                if (restored && typeof restored === 'number') {
                    elapsedSeconds = restored;
                }
            } catch (e) { console.error('Error restoring elapsed on activate:', e); }
            console.log('✓ User already signed in:', user.email, 'restored elapsed:', elapsedSeconds);
        } else {
            isAuthenticated = false;
            console.log('No user stored - will prompt for sign-in');
        }
    } catch (e) {
        console.error('Error checking stored user', e);
    }

    if (!user) {
        console.log('Starting sign-in process...');
        try {
            user = await ensureSignedIn(context);
            if (user) {
                console.log('✓ Sign-in successful for:', user.email);
            } else {
                console.log('User cancelled sign-in');
            }
        } catch (e) {
            console.error('Sign-in flow error', e);
        }
    }

    console.log('Initializing UI and timers...');

    // Try to flush any locally-saved logs (from previous offline periods)
    try { await flushLocalLogs(); } catch (e) { console.error('Error flushing local logs on startup:', e); }
    // Create status bar timer (clickable)
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.tooltip = "Click to open your dashboard";
    statusBarItem.text = `U'rWay: 00:00:00`;
    statusBarItem.command = 'urway.openDashboard';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 1. Listen for activity
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(() => { lastActivityTime = Date.now(); }),
        vscode.window.onDidChangeWindowState((e) => {
            if (e.focused) {
                lastActivityTime = Date.now();
                // Check if user logged out (secret was deleted)
                checkLogoutStatus(context);
            } else {
                // Window lost focus - immediately save elapsed time to prevent loss
                if (isAuthenticated && extensionContext && extensionContext.secrets) {
                    extensionContext.secrets.get('urway.user').then(async (stored) => {
                        if (stored) {
                            const u = JSON.parse(stored);
                            await saveElapsedForUser(u, elapsedSeconds);
                            console.log('Saved on window blur: elapsed =', elapsedSeconds);
                        }
                    }).catch(e => console.error('Error saving on blur:', e));
                }
            }
            isWindowFocused = e.focused;
            if (statusBarItem) {
                statusBarItem.text = isWindowFocused
                    ? `U'rWay: ${formatTime(elapsedSeconds)}`
                    : `U'rWay: ${formatTime(elapsedSeconds)} (paused)`;
            }
        }),
        vscode.workspace.onDidChangeTextDocument(() => { lastActivityTime = Date.now(); })
    );

    // Start the 1-second timer for the status bar stopwatch
    timerIntervalId = setInterval(async () => {
        // Only count time when a user is signed in and the window is focused
        if (!isAuthenticated) {
            if (statusBarItem) statusBarItem.text = isWindowFocused
                ? `U'rWay: ${formatTime(elapsedSeconds)} (sign in)`
                : `U'rWay: ${formatTime(elapsedSeconds)} (paused)`;
            return;
        }

        if (isWindowFocused) {
            elapsedSeconds++;
            if (statusBarItem) statusBarItem.text = `U'rWay: ${formatTime(elapsedSeconds)}`;
        }
    }, 1000);

    // Periodically persist elapsed time every 2 seconds so it's always saved
    let persistIntervalId = setInterval(async () => {
        if (isAuthenticated && extensionContext && extensionContext.secrets) {
            try {
                const stored = await extensionContext.secrets.get('urway.user');
                if (stored) {
                    const u = JSON.parse(stored);
                    await saveElapsedForUser(u, elapsedSeconds);
                    console.log('Periodic save: elapsed =', elapsedSeconds);
                }
            } catch (e) { console.error('Error in periodic elapsed save:', e); }
        }
    }, 2000); // Save every 2 seconds for accuracy

    // Update database every 10 seconds with current sessionTimeSeconds
    let dbUpdateIntervalId = setInterval(async () => {
        if (isAuthenticated && extensionContext && extensionContext.secrets) {
            try {
                const stored = await extensionContext.secrets.get('urway.user');
                if (stored) {
                    const user = JSON.parse(stored);
                    console.log(`[Database Update] Sending sessionTimeSeconds to DB: ${elapsedSeconds} for user ${user.id}`);
                    if (!fetchFn) {
                        console.error('Fetch API not available; cannot update elapsed time.');
                        return;
                    }
                    const response = await fetchFn(vsBackendUrl(`/api/elapsed/${user.id}`), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionTimeSeconds: elapsedSeconds })
                    });
                    const result = await response.json();
                    if (response.ok) {
                        console.log(`[Database Update] Success - DB now has: ${result.sessionTimeSeconds} seconds`);
                    } else {
                        console.warn(`[Database Update] Error:`, result.error);
                    }
                }
            } catch (e) { console.error('Error updating database every 10 seconds:', e); }
        }
    }, 10000); // Update database every 10 seconds

    context.subscriptions.push({ dispose: () => clearInterval(persistIntervalId) });
    context.subscriptions.push({ dispose: () => clearInterval(dbUpdateIntervalId) });

    let lastWasLoggedIn = true;
    logoutCheckIntervalId = setInterval(async () => {
        if (context && context.secrets) {
            try {
                if (!fetchFn) {
                    console.error('Fetch API not available; skipping logout checks. Run npm install or use Node 18+.');
                    return;
                }
                const stored = await context.secrets.get('urway.user');
                if (!stored) {
                    lastWasLoggedIn = false;
                    return;
                }
                const user = JSON.parse(stored);
                const checkResp = await fetchFn(vsBackendUrl(`/auth/check-logout/${user.id}`));
                const { loggedOut, reason } = await checkResp.json();
                if (loggedOut) {
                    console.log('LOGOUT DETECTED from backend! Reason:', reason, 'Persisting timer and clearing user...');
                    if (reason === 'user_deleted') {
                        vscode.window.showWarningMessage('Your account was deleted. Please sign in again.');
                    }
                    try {
                        // save elapsed for this user before deleting secret
                        const stored = await context.secrets.get('urway.user');
                        if (stored) {
                            const u = JSON.parse(stored);
                            await saveElapsedForUser(u, elapsedSeconds);
                        }
                    } catch (e) { console.error('Error saving elapsed on backend logout:', e); }

                    if (statusBarItem) statusBarItem.text = `U'rWay: ${formatTime(elapsedSeconds)} (paused)`;
                    try { await context.secrets.delete('urway.user'); } catch (e) { console.error('Error deleting secret on backend logout:', e); }
                    isAuthenticated = false;
                    console.log('User secret deleted - ready for new sign-in');
                    lastWasLoggedIn = false;
                } else {
                    lastWasLoggedIn = true;
                }
            } catch (e) {
                console.error('Logout detection error:', e);
            }
        }
    }, 1000);

    // 2. Start the Loop
    intervalId = setInterval(checkAndLogTime, 60000);

    // 3. Register commands
    let forceLogDisposable = vscode.commands.registerCommand('urway.forceLog', async () => {
        console.log("Forcing a log save...");
        await saveLogLocally("Manual Test", "javascript");
    });
    context.subscriptions.push(forceLogDisposable);

    let logoutDisposable = vscode.commands.registerCommand('urway.logout', async () => {
        console.log("Logging out...");
        // Persist current elapsed for this user before removing the secret
        try {
            if (context && context.secrets) {
                const stored = await context.secrets.get('urway.user');
                if (stored) {
                    const u = JSON.parse(stored);
                    await saveElapsedForUser(u, elapsedSeconds);
                }
                await context.secrets.delete('urway.user');
                isAuthenticated = false;
                console.log('User secret deleted (logout)');
            }
        } catch (e) { console.error('Error during logout persistence:', e); }

        // Do not reset elapsedSeconds to 0 so timer can resume on next sign-in
        if (statusBarItem) statusBarItem.text = `U'rWay: ${formatTime(elapsedSeconds)} (paused)`;
        vscode.window.showInformationMessage('✓ Logged out successfully! Sign-in dialog will appear.');
        // Call ensure signed in after a short delay to let the UI settle
        await new Promise(resolve => setTimeout(resolve, 500));
        await ensureSignedIn(context);
    });
    context.subscriptions.push(logoutDisposable);

    let dashboardDisposable = vscode.commands.registerCommand('urway.openDashboard', async () => {
        try {
            const stored = context && context.secrets ? await context.secrets.get('urway.user') : null;
            if (!stored) {
                // If not signed in, start the sign-in flow. Do not show an error.
                const user = await ensureSignedIn(context);
                if (!user) {
                    // user cancelled sign-in; nothing to do
                    return;
                }
                // fall through to open dashboard for the newly signed-in user
                // Send current elapsed time to backend before opening dashboard
                try {
                    console.log(`[Dashboard] Sending elapsed time for user ${user.id}: ${elapsedSeconds} seconds`);
                    if (!fetchFn) {
                        console.error('Fetch API not available; cannot update elapsed time.');
                        return;
                    }
                    const response = await fetchFn(vsBackendUrl(`/api/elapsed/${user.id}`), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionTimeSeconds: elapsedSeconds })
                    });
                    const result = await response.json();
                    console.log(`[Dashboard] Response from server:`, result);
                } catch (e) { console.error('Error updating elapsed time:', e); }

                const dashboardUrl = `${VS_BACKEND_BASE_URL}/dashboard/${user.id}?elapsed=${elapsedSeconds}`;
                await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
                return;
            }
            const user = JSON.parse(stored);

            // Send current elapsed time to backend before opening dashboard
            try {
                console.log(`[Dashboard] Sending elapsed time for user ${user.id}: ${elapsedSeconds} seconds`);
                if (!fetchFn) {
                    console.error('Fetch API not available; cannot update elapsed time.');
                    return;
                }
                const response = await fetchFn(vsBackendUrl(`/api/elapsed/${user.id}`), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionTimeSeconds: elapsedSeconds })
                });
                const result = await response.json();
                console.log(`[Dashboard] Response from server:`, result);
            } catch (e) { console.error('Error updating elapsed time:', e); }

            const dashboardUrl = `${VS_BACKEND_BASE_URL}/dashboard/${user.id}?elapsed=${elapsedSeconds}`;
            await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        } catch (e) {
            vscode.window.showErrorMessage('Error opening dashboard: ' + e.message);
        }
    });
    context.subscriptions.push(dashboardDisposable);
}

async function checkAndLogTime() {
    const currentTime = Date.now();

    // Do not log if user is not signed in
    if (!isAuthenticated) {
        return;
    }

    // Check if idle
    if (currentTime - lastActivityTime > IDLE_LIMIT) {
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const language = editor.document.languageId;
    const projectName = vscode.workspace.name || "Unknown";

    console.log(`[U'rWay] Logging 1 min for: ${projectName}`);
    await saveLogLocally(projectName, language);
}

function formatTime(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

async function saveLogLocally(projectName, language) {
    // 1. GET CURRENT PROJECT FOLDER PATH
    const filePath = getLogFilePath();
    try { fs.mkdirSync(path.dirname(filePath), { recursive: true }); } catch (e) { }

    // attach user id if available
    let userId = null;
    let userName = null;
    try {
        const stored = extensionContext && extensionContext.secrets ? await extensionContext.secrets.get('urway.user') : null;
        if (stored) {
            const u = JSON.parse(stored);
            userId = u.id || u._id || null;
            userName = u.name || u.email || null;
        }
    } catch (e) { console.error('Error reading user secret', e); }

    const logEntry = {
        userId,
        userName,
        project: projectName,
        language: language,
        duration: 60,
        sessionTimeSeconds: elapsedSeconds,
        time: new Date().toISOString()
    };

    // 2. READ / WRITE FILE
    let logs = [];
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            logs = JSON.parse(content);
        } catch (e) { console.error("Read error:", e); }
    }

    logs.push(logEntry);

    // Save to local file first (acts as a queue of pending logs)
    try {
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
        console.log(`SAVED LOG TO: ${filePath}`);
        vscode.window.setStatusBarMessage(`Saved to urway_logs.json`, 3000);
    } catch (e) {
        console.error("Write error:", e);
    }

    // Try to POST the latest log to backend. On success, remove it from local file.
    try {
        const backendUrl = vsBackendUrl('/logs');
        if (!fetchFn) {
            console.error('Fetch API not available; cannot post logs.');
            return;
        }
        const resp = await fetchFn(backendUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntry)
        });
        if (!resp.ok) {
            const text = await resp.text();
            console.warn('Backend log failed:', text);
            return;
        }

        console.log('Log posted to backend');

        // Remove the posted entry from the local file to avoid re-posting
        try {
            const stored = fs.readFileSync(filePath, 'utf8');
            const queued = JSON.parse(stored || '[]');
            const idx = queued.findIndex(l => l.time === logEntry.time && l.project === logEntry.project && l.language === logEntry.language && (l.userId || null) === (logEntry.userId || null));
            if (idx !== -1) {
                queued.splice(idx, 1);
                fs.writeFileSync(filePath, JSON.stringify(queued, null, 2));
                console.log('Removed posted log from local queue');
            }
        } catch (e) {
            console.error('Error removing posted log from file:', e);
        }

    } catch (e) {
        console.warn('Could not post log to backend:', e.message);
    }
}


// Attempt to send all locally queued logs to the backend. Removes entries as they are posted.
async function flushLocalLogs() {
    if (!vscode.workspace.workspaceFolders) return;
    const filePath = getLogFilePath();
    if (!fs.existsSync(filePath)) return;

    let queued = [];
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        queued = JSON.parse(content || '[]');
    } catch (e) {
        console.error('Error reading queued logs for flush:', e);
        return;
    }

    if (!Array.isArray(queued) || queued.length === 0) return;

    for (let i = 0; i < queued.length;) {
        const entry = queued[i];
        try {
            if (!fetchFn) {
                console.error('Fetch API not available; cannot flush logs.');
                return;
            }
            const resp = await fetchFn(vsBackendUrl('/logs'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
            if (resp.ok) {
                // remove this entry and continue (do not increment i since array shrinks)
                queued.splice(i, 1);
                try { fs.writeFileSync(filePath, JSON.stringify(queued, null, 2)); } catch (e) { console.error('Error updating queue file:', e); }
                console.log('Flushed a queued log to backend');
                continue;
            } else {
                console.warn('Flush failed for entry:', await resp.text());
            }
        } catch (e) {
            console.warn('Network error flushing logs:', e.message);
            // stop trying if network appears down
            break;
        }
        i++;
    }
}

async function ensureSignedIn(context) {
    // Prevent multiple sign-in dialogs from appearing at once
    if (isSigningIn) {
        console.log('Sign-in already in progress, skipping...');
        return null;
    }

    if (!context || !context.secrets) return null;
    const existing = await context.secrets.get('urway.user');
    if (existing) {
        console.log('User already signed in');
        return JSON.parse(existing);
    }

    isSigningIn = true;
    console.log('Starting sign-in flow...');
    let shouldRetry = true;

    try {
        while (shouldRetry) {
            shouldRetry = false;
            console.log('Showing sign-in dialog');

            const choice = await vscode.window.showInformationMessage(
                'Please sign in to UrWay. Browser window will open for Google authentication.',
                { modal: true },
                'Sign in with Google'
            );

            if (choice !== 'Sign in with Google') {
                console.log('User cancelled sign-in');
                isAuthenticated = false;
                isSigningIn = false;
                return null;
            }

            console.log('Opening Google auth URL...');
            const authUrl = vsBackendUrl('/auth/google');
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));

            // First, check if a code was delivered via the URI handler (browser -> vscode://...)
            // Wait briefly for an incoming URI code before falling back to manual paste.
            const waitForUriCode = async (timeoutMs) => {
                const deadline = Date.now() + timeoutMs;
                while (Date.now() < deadline) {
                    if (pendingAuthCode) return pendingAuthCode;
                    await new Promise(r => setTimeout(r, 300));
                }
                return null;
            };

            let code = null;
            if (pendingAuthCode) {
                code = pendingAuthCode;
                pendingAuthCode = null;
                console.log('Using code already received via URI handler');
            } else {
                // Wait up to 20s for the browser to redirect to vscode:// with the code
                const uriCode = await waitForUriCode(20000);
                if (uriCode) {
                    code = uriCode;
                    pendingAuthCode = null;
                    console.log('Received code via URI during wait');
                } else {
                    console.log('Waiting for user to enter code manually...');
                    code = await vscode.window.showInputBox({
                        prompt: 'Copy the code from your browser and paste it here',
                        ignoreFocusOut: true,
                        placeHolder: 'Paste your sign-in code here'
                    });
                }
            }

            if (!code || code.trim() === '') {
                console.log('No code entered');
                const again = await vscode.window.showInformationMessage('No code entered. Try again?', 'Try again');
                if (again === 'Try again') {
                    shouldRetry = true;
                }
                continue;
            }

            console.log('Exchanging code for user token...');
            try {
                if (!fetchFn) {
                    console.error('Fetch API not available; cannot complete sign-in.');
                    vscode.window.showErrorMessage('Fetch API not available. Run npm install or use Node 18+.');
                    shouldRetry = false;
                    continue;
                }
                const resp = await fetchFn(vsBackendUrl('/auth/exchange'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: code.trim() })
                });

                if (!resp.ok) {
                    const text = await resp.text();
                    console.error('Exchange failed:', text);
                    vscode.window.showErrorMessage('Sign in failed: ' + text);
                    shouldRetry = true;
                    continue;
                }

                const user = await resp.json();
                console.log('User received from backend:', user);

                // Store user FIRST before showing any messages
                await context.secrets.store('urway.user', JSON.stringify(user));
                console.log('User stored in context.secrets - SIGN IN COMPLETE');

                // Mark authenticated and restore any previously-saved elapsed time for this user
                isAuthenticated = true;
                // CRITICAL: Reset elapsed to 0 first, then load this specific user's saved time
                elapsedSeconds = 0;
                try {
                    const restored = loadElapsedForUser(user);
                    if (restored && typeof restored === 'number') {
                        elapsedSeconds = restored;
                    }
                } catch (e) { console.error('Error restoring elapsed after sign-in:', e); }
                console.log('Loaded elapsed for new sign-in user:', elapsedSeconds);

                if (statusBarItem) statusBarItem.text = `U'rWay: ${formatTime(elapsedSeconds)}`;
                // Show success and wait a moment before returning
                vscode.window.showInformationMessage(`✓ Signed in as ${user.name || user.email}`);
                // Small delay to let UI update before returning
                await new Promise(resolve => setTimeout(resolve, 500));
                isSigningIn = false;
                return user;

            } catch (e) {
                console.error('Sign-in error:', e);
                vscode.window.showErrorMessage('Sign in error: ' + e.message);
                shouldRetry = true;
                continue;
            }
        }
    } finally {
        isSigningIn = false;
    }

    return null;
}

async function checkLogoutStatus(context) {
    if (!context || !context.secrets) return;
    const stored = await context.secrets.get('urway.user');
    // If no user stored (was deleted), reset timer and mark unauthenticated
    if (!stored) {
        // Do not reset elapsedSeconds; keep the last value so it can resume when the same user signs in again
        isAuthenticated = false;
        if (statusBarItem) statusBarItem.text = `U'rWay: ${formatTime(elapsedSeconds)} (paused)`;
        vscode.window.showInformationMessage('You have been logged out. Use the command or click the timer to sign in again.');
    }
}


async function deactivate() {
    // Persist elapsedSeconds for current user on deactivate BEFORE clearing intervals
    try {
        if (extensionContext && extensionContext.secrets) {
            const stored = await extensionContext.secrets.get('urway.user');
            if (stored) {
                const u = JSON.parse(stored);
                await saveElapsedForUser(u, elapsedSeconds);
                console.log('Deactivate: saved elapsed =', elapsedSeconds);
            }
        }
    } catch (e) { console.error('Deactivate save error:', e); }
    if (intervalId) clearInterval(intervalId);
    if (timerIntervalId) clearInterval(timerIntervalId);
    if (logoutCheckIntervalId) clearInterval(logoutCheckIntervalId);
    if (statusBarItem) {
        try { statusBarItem.dispose(); } catch (e) { }
    }
}

module.exports = { activate, deactivate };


