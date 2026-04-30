// Initialize 30-second pulse alarm
try {
    // Use chrome.runtime.getURL to ensure absolute extension URL (avoids DOMException when worker scope differs)
    importScripts(chrome.runtime.getURL('crypto-utils.js'));
    console.log('✓ CryptoUtils loaded into background service worker');
} catch (e) {
    console.error('✗ Failed to import CryptoUtils into background worker:', e);
}
// Diagnostic: show runtime type (helps detect scoping/import issues)
console.log('🔍 Post-import: CryptoUtils typeof ->', typeof CryptoUtils);

chrome.alarms.create("syncPulse", { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "syncPulse") {
        trackActivity();
    }
});

// Handle messages from popup (e.g., fetch Microsoft Graph on behalf of popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return; // ignore unknown
    if (message.action === 'ms_graph_me') {
        const token = message.accessToken
        if (!token) {
            sendResponse({ error: 'No access token provided' })
            return true
        }
        (async () => {
            try {
                const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (!resp.ok) {
                    const bodyText = await resp.text().catch(() => '<no-body>')
                    console.error('Graph /me returned non-OK status', resp.status, bodyText)
                    sendResponse({ error: 'Graph API returned ' + resp.status + ' - ' + bodyText })
                    return
                }
                const data = await resp.json()
                sendResponse(data)
            } catch (e) {
                console.error('Background Graph fetch failed', e)
                sendResponse({ error: 'Background fetch failed: ' + (e.message || e) })
            }
        })()
        // indicate we'll call sendResponse asynchronously
        return true
    }
    // Force background to attempt flushing pendingActivities to bridge
    if (message.action === 'forceSync') {
        (async () => {
            try {
                const result = await flushPendingActivities()
                sendResponse({ status: 'ok', flushed: result })
            } catch (e) {
                console.error('forceSync failed', e)
                sendResponse({ status: 'error', error: String(e) })
            }
        })()
        return true
    }
})

// Fetch title for special platforms (Netflix, JioHotstar, etc.)
async function fetchSpecialTitle(tab) {
    if (tab.url.includes("netflix")) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const elem = document.querySelector('[data-uia="nmhp-card-title"]') || 
                                document.querySelector('.player-status') || 
                                document.title;
                    return elem.textContent || document.title;
                }
            });
            return result[0]?.result || tab.title;
        } catch (e) {
            return tab.title;
        }
    }
    if (tab.url.includes("jiohotstar")) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const elem = document.querySelector('.playing-title') || document.title;
                    return elem.textContent || document.title;
                }
            });
            return result[0]?.result || tab.title;
        } catch (e) {
            return tab.title;
        }
    }
    return tab.title;
}

// Extract domain from URL
function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return 'Unknown';
    }
}

// Format time for display (HH:MM AM/PM)
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Main activity tracking function
async function trackActivity() {
    // Check current window state first - must be focused and not minimized
    const windows = await chrome.windows.getCurrent();
    if (!windows.focused || windows.state === 'minimized') return;
    
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const [tab] = tabs;
    
    // Stop tracking if no active tab or on chrome/about pages
    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("about:")) return;
    
    // Double-check tab is actually active (visible in foreground)
    if (!tab.active) return;

    const { footprint = [] } = await chrome.storage.local.get("footprint");
    const now = new Date();
    const todayDate = now.toLocaleDateString();
    const domain = getDomainFromUrl(tab.url);
    const title = await fetchSpecialTitle(tab);

    // PACKING RULE: Check for identical Title + URL + Date
    const existingIdx = footprint.findIndex(
        item => item.url === tab.url && item.title === title && item.date === todayDate
    );

    if (existingIdx > -1) {
        // Update existing row: add duration and update endTime
        footprint[existingIdx].duration += 30;
        footprint[existingIdx].endTime = formatTime(now);
        footprint[existingIdx].endTimestamp = now.getTime();
    } else {
        // Create new unique activity
        footprint.unshift({
            domain: domain,
            title: title,
            url: tab.url,
            startTime: formatTime(now),
            endTime: formatTime(now),
            startTimestamp: now.getTime(),
            endTimestamp: now.getTime(),
            duration: 30,
            date: todayDate
        });
    }

    await chrome.storage.local.set({ footprint });
    
    // Ensure metadata for bridge indexing is present (start/end/duration)
    const toSync = footprint[existingIdx > -1 ? existingIdx : 0];
    if (toSync && !toSync.timestamps) {
        toSync.timestamps = {
            startTimestamp: toSync.startTimestamp,
            endTimestamp: toSync.endTimestamp,
            duration: toSync.duration
        };
        // Persist the updated timestamps back to storage
        await chrome.storage.local.set({ footprint });
    }

    // Sync to bridge with exponential backoff (include userEmail if available)
    syncToBridge(toSync);
}

// Sync to Flask MongoDB bridge with end-to-end encryption (timestamp-based)
async function syncToBridge(data, retries = 3) {
    // Get user credentials and registration timestamp (for cross-browser sync) from session storage or Chrome identity
    let { userEmail, registrationTimestamp } = await chrome.storage.local.get(['userEmail', 'registrationTimestamp']);

    // Fallback: try chrome.identity profile if local storage has no email
    if (!userEmail) {
        try {
            const profile = await new Promise(resolve => chrome.identity.getProfileUserInfo(resolve));
            if (profile && profile.email) {
                userEmail = profile.email;
                await chrome.storage.local.set({ userEmail });
                console.log('🔐 Background detected signed-in profile email and saved to local:', userEmail);
            }
        } catch (e) {
            console.warn('⚠ Could not detect profile email in background:', e);
        }
    }

    // If we have an email but no registrationTimestamp, ask the bridge
    if (userEmail && !registrationTimestamp) {
        try {
            const resp = await fetch('http://localhost:5000/register-or-get-user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail })
            });
            if (resp.ok) {
                const r = await resp.json();
                if (r.status === 'success') {
                    registrationTimestamp = r.registrationTimestamp;
                    await chrome.storage.local.set({ registrationTimestamp });
                    console.log('✓ Background obtained registrationTimestamp and saved to local:', registrationTimestamp);
                }
            }
        } catch (e) {
            console.warn('⚠ Background could not fetch registration timestamp:', e);
        }
    }

    if (!userEmail) {
        console.log("⚠ No user logged in or encryption not configured");
        return;
    }

    // Diagnostic logging for CryptoUtils availability
    console.log('🔍 syncToBridge - userEmail:', userEmail, 'registrationTimestamp:', registrationTimestamp, 'CryptoUtilsType:', typeof CryptoUtils);

    // If CryptoUtils is missing, send an UNENCRYPTED fallback so we don't lose data
    if (typeof CryptoUtils === 'undefined') {
        console.warn('⚠ CryptoUtils not available. Buffering activity locally as pending (cannot encrypt)');
        // Store in pendingActivities as unencrypted fallback (still protected by extension storage)
        try {
            const stored = await chrome.storage.local.get(['pendingActivities', 'deviceRegTs'])
            const pending = stored.pendingActivities || []
            const deviceRegTs = stored.deviceRegTs || Date.now()
            if (!stored.deviceRegTs) await chrome.storage.local.set({ deviceRegTs })
            pending.push({ unencryptedData: {
                domain: data.domain || null,
                title: data.title || null,
                url: data.url || null,
                date: data.date,
                timestamps: data.timestamps || {
                    startTimestamp: data.startTimestamp,
                    endTimestamp: data.endTimestamp,
                    duration: data.duration
                },
                duration: data.duration
            }, deviceRegTs, createdAt: Date.now(), encrypted: false })
            await chrome.storage.local.set({ pendingActivities: pending })
            console.log('Buffered unencrypted pending activity for later sync')
        } catch (e) {
            console.error('Failed to buffer pending activity', e)
        }
        return
    }

    try {
        // Determine which timestamp to use for encryption: canonical registrationTimestamp if present,
        // otherwise a device-local timestamp (deviceRegTs) used only for local buffering.
        const stored = await chrome.storage.local.get(['deviceRegTs'])
        let deviceRegTs = stored.deviceRegTs
        if (!registrationTimestamp && !deviceRegTs) {
            deviceRegTs = Date.now()
            await chrome.storage.local.set({ deviceRegTs })
        }
        const effectiveRegTs = registrationTimestamp || deviceRegTs
        // Derive encryption key from email and the effective registration timestamp
        const encryptionKey = await CryptoUtils.deriveKeyFromTimestamp(userEmail, effectiveRegTs);
        
        // Encrypt the activity data
        const encryptedData = await CryptoUtils.encryptActivity(data, encryptionKey);
        
        // Create payload with encrypted data and essential metadata
        const payload = {
            userEmail: userEmail,
            registrationTimestamp: registrationTimestamp,  // Send registration timestamp for cross-browser sync
            domain: data.domain || (data.unencryptedData && data.unencryptedData.domain) || null,
            title: data.title || (data.unencryptedData && data.unencryptedData.title) || null,
            url: data.url || (data.unencryptedData && data.unencryptedData.url) || null,
            encryptedData: encryptedData,
            date: data.date,
            timestamps: data.timestamps || {
                startTimestamp: data.startTimestamp,
                endTimestamp: data.endTimestamp,
                duration: data.duration
            },
            duration: data.duration // Top-level duration for quick queries/indexes
        };

        let sent = false
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch("http://localhost:5000/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    timeout: 5000
                });
                if (response.ok) {
                    console.log("🔒 Encrypted activity synced (cross-browser consolidated):", data.title);
                    sent = true
                    break
                }
            } catch (e) {
                if (i === retries - 1) {
                    console.warn("⚠ Bridge offline after", retries, "attempts");
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }

        if (!sent) {
            // Buffer encrypted payload locally for later reconciliation
            try {
                const stored = await chrome.storage.local.get(['pendingActivities', 'deviceRegTs'])
                const pending = stored.pendingActivities || []
                let deviceRegTs = stored.deviceRegTs
                if (!deviceRegTs) {
                    deviceRegTs = Date.now()
                    await chrome.storage.local.set({ deviceRegTs })
                }
                // Store the encryptedData produced with device-derived key (we derived key using registrationTimestamp variable,
                // but if canonical registrationTimestamp is absent we used deviceRegTs for encryption in completeLogin flow). To be safe,
                // include both encryptedData and the timestamps/metadata so we can re-encrypt when canonical timestamp becomes available.
                pending.push({ encryptedData: payload.encryptedData, metadata: { domain: payload.domain, title: payload.title, url: payload.url, date: payload.date, timestamps: payload.timestamps, duration: payload.duration }, deviceRegTs, createdAt: Date.now(), encrypted: true })
                await chrome.storage.local.set({ pendingActivities: pending })
                console.log('Buffered encrypted pending activity for later reconciliation')
            } catch (e) {
                console.error('Failed to buffer encrypted pending activity', e)
            }
        }
    } catch (e) {
        console.error("❌ Encryption error during sync:", e);
    }
}

// Flush pendingActivities: attempt to register/get canonical registrationTimestamp then re-encrypt and upload
async function flushPendingActivities() {
    const stored = await chrome.storage.local.get(['pendingActivities', 'userEmail', 'deviceRegTs'])
    const pending = stored.pendingActivities || []
    const userEmail = stored.userEmail
    const deviceRegTs = stored.deviceRegTs
    if (!userEmail) throw new Error('No userEmail in storage')
    if (!pending.length) return 0

    // Get canonical registrationTimestamp from bridge
    let canonicalRegTs = null
    try {
        const resp = await fetch('http://localhost:5000/register-or-get-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: userEmail }) })
        if (resp.ok) {
            const b = await resp.json()
            canonicalRegTs = b.registrationTimestamp
            await chrome.storage.local.set({ registrationTimestamp: canonicalRegTs })
            console.log('flushPendingActivities: obtained canonical registrationTimestamp', canonicalRegTs)
        }
    } catch (e) {
        throw new Error('Bridge unreachable during flush')
    }

    if (!canonicalRegTs) throw new Error('Could not obtain canonical registrationTimestamp')

    let flushed = 0
    for (const item of pending.slice()) {
        try {
            if (item.encrypted) {
                // Re-decrypt with device key and re-encrypt with canonical key
                const deviceKey = await CryptoUtils.deriveKeyFromTimestamp(userEmail, item.deviceRegTs || deviceRegTs)
                const plaintext = await CryptoUtils.decryptActivity(item.encryptedData, deviceKey)
                const canonicalKey = await CryptoUtils.deriveKeyFromTimestamp(userEmail, canonicalRegTs)
                const reEnc = await CryptoUtils.encryptActivity(plaintext, canonicalKey)
                const payload = {
                    userEmail: userEmail,
                    registrationTimestamp: canonicalRegTs,
                    domain: item.metadata.domain,
                    title: item.metadata.title,
                    url: item.metadata.url,
                    encryptedData: reEnc,
                    date: item.metadata.date,
                    timestamps: item.metadata.timestamps,
                    duration: item.metadata.duration
                }
                const r = await fetch('http://localhost:5000/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                if (r.ok) {
                    flushed++
                    // remove from pending
                    const idx = pending.indexOf(item)
                    if (idx > -1) pending.splice(idx, 1)
                }
            } else {
                // Unencrypted pending item: re-encrypt with canonical key then upload
                const canonicalKey = await CryptoUtils.deriveKeyFromTimestamp(userEmail, canonicalRegTs)
                const reEnc = await CryptoUtils.encryptActivity(item.unencryptedData, canonicalKey)
                const payload = {
                    userEmail: userEmail,
                    registrationTimestamp: canonicalRegTs,
                    domain: item.unencryptedData.domain,
                    title: item.unencryptedData.title,
                    url: item.unencryptedData.url,
                    encryptedData: reEnc,
                    date: item.unencryptedData.date,
                    timestamps: item.unencryptedData.timestamps,
                    duration: item.unencryptedData.duration
                }
                const r = await fetch('http://localhost:5000/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                if (r.ok) {
                    flushed++
                    const idx = pending.indexOf(item)
                    if (idx > -1) pending.splice(idx, 1)
                }
            }
        } catch (e) {
            console.error('Failed to flush pending item', e)
        }
    }

    // Persist updated pending list
    await chrome.storage.local.set({ pendingActivities: pending })
    return flushed
}