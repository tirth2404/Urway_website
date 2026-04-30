import React, { useEffect, useState } from 'react'
import ActivityList from './components/ActivityList'
import DomainDetailView from './components/DomainDetailView'
import HistoryCalendar from './components/HistoryCalendar'
import HistoryDayView from './components/HistoryDayView'
import CryptoUtils from './utils/crypto-utils'
import { bridgeUrl } from './config'

export default function App() {
    const [userEmail, setUserEmail] = useState(null)
    const [registrationTimestamp, setRegistrationTimestamp] = useState(null)
    const [activities, setActivities] = useState([])
    const [sitesData, setSitesData] = useState([])
    const [loading, setLoading] = useState(false)
    const [browserTotal, setBrowserTotal] = useState(0)
    const [storageDebug, setStorageDebug] = useState(null)
    const [theme, setTheme] = useState('light')
    const [selectedDomain, setSelectedDomain] = useState(null)
    // Navigation: 'today' | 'history' | 'history-day'
    const [page, setPage] = useState('today')
    const [historyDays, setHistoryDays] = useState([])
    const [selectedHistoryDate, setSelectedHistoryDate] = useState(null)

  // Theme persistence
  useEffect(()=>{
    (async ()=>{
      try{
        const s = await chrome.storage.local.get(['theme'])
        const t = s && s.theme ? s.theme : 'light'
        setTheme(t)
        document.documentElement.classList.toggle('dark-theme', t === 'dark')
      }catch(e){console.warn('Failed to read theme', e)}
    })()
  },[])

  function toggleTheme(){
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    try{ chrome.storage.local.set({ theme: newTheme }) }catch(e){}
    document.documentElement.classList.toggle('dark-theme', newTheme === 'dark')
  }

  // Initial load: read persisted session once on mount
  useEffect(()=>{
    (async ()=>{
      try{
        let session = await chrome.storage.local.get(['userEmail','registrationTimestamp'])
        console.log('Initial storage load:', session)
        // If storage is empty, check localStorage fallback and copy back to chrome.storage.local
        if ((!session || !session.userEmail) && localStorage.getItem('urway_user')){
          try{
            const parsed = JSON.parse(localStorage.getItem('urway_user'))
            if (parsed && parsed.userEmail){
              await chrome.storage.local.set(parsed)
              session = parsed
              console.log('Recovered session from localStorage fallback:', parsed)
            }
          }catch(e){console.warn('Failed to parse localStorage fallback', e)}
        }
        setStorageDebug(session)
        if (session && session.userEmail) {
          setUserEmail(session.userEmail)
          setRegistrationTimestamp(session.registrationTimestamp)
          await fetchAndRender(session.userEmail, session.registrationTimestamp)
        }
      }catch(e){
        console.error('Failed to read storage on init', e)
      }
    })()
  }, [])

    // Polling refresh only when user is set
    useEffect(() => {
        if (!userEmail) return
        const id = setInterval(async () => {
            await fetchAndRender(userEmail, registrationTimestamp)
        }, 5000)
        return () => clearInterval(id)
    }, [userEmail, registrationTimestamp])

    async function fetchAndRender(email, regTs) {
        setLoading(true)
        try {
            // Only fetch today's data for the main view (daily reset)
            const today = new Date().toLocaleDateString()
            let result = { sites: [], totalBrowserDuration: 0 }
            
            try {
                const res = await fetch(`${bridgeUrl('/activities')}?userEmail=${encodeURIComponent(email)}&date=${encodeURIComponent(today)}`, {
                    signal: AbortSignal.timeout(3000)
                })
                if (res.ok) {
                    result = await res.json()
                } else {
                    console.warn('Backend returned', res.status)
                }
            } catch (fetchErr) {
                console.warn('⚠ Failed to fetch activities from backend:', fetchErr.message || fetchErr)
                // Continue with empty data - user can still see UI and login is preserved
            }
            
            const sites = result.sites || []
            setBrowserTotal(result.totalBrowserDuration || 0)
            const out = []

            for (const site of sites) {
                const domain = site.domain
                const siteTitle = site.title
                const siteUrl = site.url
                for (const seg of site.segments || []) {
                    // Server keeps plain duration/timestamps updated on each pulse,
                    // but encryptedData is only written once at creation. Always prefer
                    // the server's plain fields for duration and timestamps.
                    const serverDuration = seg.duration
                    const serverStart = seg.startTimestamp
                    const serverEnd = seg.endTimestamp

                    if (seg.encrypted === false) {
                        const base = seg.unencryptedData || {}
                        out.push({
                            ...base,
                            domain: base.domain || domain,
                            title: base.title || siteTitle,
                            url: base.url || siteUrl,
                            duration: serverDuration ?? base.duration ?? base.timestamps?.duration ?? 0,
                            startTimestamp: serverStart ?? base.timestamps?.startTimestamp,
                            endTimestamp: serverEnd ?? base.timestamps?.endTimestamp,
                            timestamps: {
                                startTimestamp: serverStart ?? base.timestamps?.startTimestamp,
                                endTimestamp: serverEnd ?? base.timestamps?.endTimestamp
                            }
                        })
                    } else if (seg.encryptedData) {
                        try {
                            const key = await CryptoUtils.deriveKeyFromTimestamp(email, regTs)
                            const obj = await CryptoUtils.decryptActivity(seg.encryptedData, key)
                            // Merge: use decrypted for title/url/domain, server plain fields for duration/timestamps
                            out.push({
                                ...obj,
                                domain: obj.domain || domain,
                                title: obj.title || siteTitle,
                                url: obj.url || siteUrl,
                                duration: serverDuration ?? obj.duration ?? obj.timestamps?.duration ?? 0,
                                startTimestamp: serverStart ?? obj.startTimestamp ?? obj.timestamps?.startTimestamp,
                                endTimestamp: serverEnd ?? obj.endTimestamp ?? obj.timestamps?.endTimestamp,
                                timestamps: {
                                    startTimestamp: serverStart ?? obj.timestamps?.startTimestamp,
                                    endTimestamp: serverEnd ?? obj.timestamps?.endTimestamp
                                }
                            })
                        } catch (e) {
                            console.error('Decryption failed for a segment', e)
                            // Even if decryption fails, we can still show the segment using plain fields
                            out.push({
                                domain, title: siteTitle, url: siteUrl,
                                duration: serverDuration ?? 0,
                                startTimestamp: serverStart,
                                endTimestamp: serverEnd,
                                timestamps: { startTimestamp: serverStart, endTimestamp: serverEnd }
                            })
                        }
                    } else {
                        const base = seg.unencryptedData || {}
                        out.push({
                            ...base,
                            domain: base.domain || domain,
                            title: base.title || siteTitle,
                            url: base.url || siteUrl,
                            duration: serverDuration ?? base.duration ?? 0,
                            startTimestamp: serverStart ?? base.timestamps?.startTimestamp,
                            endTimestamp: serverEnd ?? base.timestamps?.endTimestamp,
                            timestamps: {
                                startTimestamp: serverStart ?? base.timestamps?.startTimestamp,
                                endTimestamp: serverEnd ?? base.timestamps?.endTimestamp
                            }
                        })
                    }
                }
            }

            // Normalize segments: ensure numeric durations and unified timestamps
            function normalizeSegment(s){
                const domain = s.domain || (s.url ? (new URL(s.url)).hostname : '')
                const title = s.title || s.unencryptedData?.title || ''
                const url = s.url || s.unencryptedData?.url || ''

                // Determine start/end timestamps
                let start = null, end = null
                if (s.timestamps && typeof s.timestamps === 'object'){
                    start = s.timestamps.startTimestamp ?? (Array.isArray(s.timestamps) ? s.timestamps[0] : null)
                    end = s.timestamps.endTimestamp ?? (Array.isArray(s.timestamps) ? s.timestamps[s.timestamps.length-1] : null)
                }
                start = start ?? s.startTimestamp ?? null
                end = end ?? s.endTimestamp ?? null

                // Duration (seconds) - coerce to Number and fallback to end-start
                let duration = Number(s.duration ?? s.unencryptedData?.duration ?? 0) || 0
                if ((!duration || duration === 0) && start && end){
                    const diff = (new Date(end)).getTime() - (new Date(start)).getTime()
                    duration = Math.max(0, Math.round(diff / 1000))
                }

                // Return normalized object with ALL original properties preserved via spread
                return { 
                    ...s,  // Preserve all original properties
                    domain, 
                    title, 
                    url, 
                    duration, 
                    timestamps: { startTimestamp: start, endTimestamp: end }, 
                    startTimestamp: start,
                    endTimestamp: end
                }
            }

            const normalized = out.map(normalizeSegment)

            // Build site-level data: use server site documents but replace segments
            // with enriched normalized ones so titles/urls propagate correctly
            const sitesOut = []
            for (const site of sites) {
                const domain = site.domain
                const siteTitle = site.title
                const siteUrl = site.url
                // Find all normalized segments that belong to this site
                const nd = (d) => { let x = String(d||'').toLowerCase().trim(); if(x.startsWith('www.')) x=x.slice(4); return x||'unknown' }
                const siteDomain = nd(domain)
                const siteSegs = normalized.filter(seg => {
                    const segDomain = nd(seg.domain)
                    return segDomain === siteDomain && 
                           // Match by timestamp to ensure correct site mapping
                           site.segments?.some(ss => 
                               ss.startTimestamp === seg.startTimestamp || 
                               ss.startTimestamp === seg.timestamps?.startTimestamp
                           )
                })
                // Use server total for accuracy
                const siteTotal = Number(site.totalDuration || 0)
                sitesOut.push({ domain: siteDomain, title: siteTitle, url: siteUrl, total: siteTotal, segments: siteSegs.length > 0 ? siteSegs : normalized.filter(s => nd(s.domain) === siteDomain) })
            }
            // Merge sites with same normalized domain
            const merged = new Map()
            for (const s of sitesOut) {
                const key = s.domain
                if (merged.has(key)) {
                    const existing = merged.get(key)
                    existing.segments.push(...s.segments)
                    existing.total += s.total
                    if (!existing.title && s.title) existing.title = s.title
                    if (!existing.url && s.url) existing.url = s.url
                } else {
                    merged.set(key, { ...s, segments: [...s.segments] })
                }
            }
            const finalSites = Array.from(merged.values()).sort((a, b) => b.total - a.total)
            console.log('Final sites data:', finalSites.map(s => ({ domain: s.domain, title: s.title, segCount: s.segments.length, total: s.total })))
            setSitesData(finalSites)
            setActivities(normalized)
        } catch (e) {
            console.error('Failed to fetch/decrypt', e)
        } finally { setLoading(false) }
    }

    // Fetch history data for calendar view
    async function fetchHistory() {
        try {
            const res = await fetch(`${bridgeUrl('/history')}?userEmail=${encodeURIComponent(userEmail)}&registrationTimestamp=${encodeURIComponent(registrationTimestamp)}`, {
                signal: AbortSignal.timeout(3000)
            })
            if (res.ok) {
                const result = await res.json()
                if (result.status === 'success' || result.days) {
                    setHistoryDays(result.days || [])
                }
            } else {
                console.warn('History endpoint returned', res.status)
            }
        } catch (e) {
            console.warn('⚠ Failed to fetch history (backend may be offline):', e.message || e)
        }
    }

    // Shared login completion: register email with backend, persist session, load data
    async function completeLogin(email) {
        let regTs = null
        let backendAvailable = false

        // Try to register/get user from backend
        try {
            const resp = await fetch(bridgeUrl('/register-or-get-user'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                signal: AbortSignal.timeout(3000) // 3s timeout
            })
            if (resp.ok) {
                const body = await resp.json()
                regTs = body.registrationTimestamp
                backendAvailable = true
                console.log('✓ Backend available, got registrationTimestamp:', regTs)
            } else {
                throw new Error('Backend returned ' + resp.status)
            }
        } catch (fetchErr) {
            console.warn('⚠ Backend offline or unreachable:', fetchErr.message || fetchErr)
            // Do NOT generate a permanent registrationTimestamp locally; instead create a device-local timestamp
            // used only for local buffering/encryption until canonical timestamp is available.
            const deviceRegTs = Date.now()
            await chrome.storage.local.set({ userEmail: email, registrationTimestamp: null, deviceRegTs, sessionOffline: true })
            try { localStorage.setItem('urway_user', JSON.stringify({ userEmail: email, registrationTimestamp: null, deviceRegTs })) } catch (e) {/* ignore */}
            console.log('⚠ Created device-local registration timestamp for buffering:', deviceRegTs)
            setUserEmail(email)
            setRegistrationTimestamp(null)

            // Load whatever local data we have (will show only local items)
            await fetchAndRender(email, null)

            alert('⚠ Logged in successfully, but backend server is offline.\\n\\nActivities will be buffered locally and uploaded once the backend is available.\\n\\nTo enable sync and history now:\\n1. Start Flask backend: python urway_bridge.py\\n2. Wait a few seconds for the background to reconnect or click the extension to retry')
            return
        }

        // Save canonical session locally
        await chrome.storage.local.set({ userEmail: email, registrationTimestamp: regTs, sessionOffline: false })
        try { localStorage.setItem('urway_user', JSON.stringify({ userEmail: email, registrationTimestamp: regTs })) } catch (e) {/* ignore */}
        console.log('✓ Session stored for', email)
        setUserEmail(email)
        setRegistrationTimestamp(regTs)

        // Load today's data using canonical registrationTimestamp
        await fetchAndRender(email, regTs)

        // If there are pending activities buffered while offline, ask background to flush them now
        try {
            chrome.runtime.sendMessage({ action: 'forceSync' }, (resp) => {
                const lErr = chrome.runtime && chrome.runtime.lastError
                if (lErr) return console.warn('forceSync message error', lErr)
                console.log('forceSync response', resp)
            })
        } catch (e) { console.warn('Could not request forceSync', e) }
    }

    // ─── Google OAuth ───
    async function handleGoogleLogin() {
        try {
            const manifest = (chrome && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest() : null
            const clientId = manifest && manifest.oauth2 && manifest.oauth2.client_id
                ? manifest.oauth2.client_id
                : "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
            if (clientId.includes("YOUR_GOOGLE_CLIENT_ID")) {
                alert("ERROR: Please configure your Google Client ID first! See GOOGLE_SETUP.md for instructions.")
                return
            }

            const redirectUrl = chrome.identity.getRedirectURL()
            const authUrl = new URL("https://accounts.google.com/o/oauth2/auth")
            authUrl.searchParams.append("client_id", clientId)
            authUrl.searchParams.append("response_type", "token")
            authUrl.searchParams.append("redirect_uri", redirectUrl)
            authUrl.searchParams.append("scope", "email profile")
            authUrl.searchParams.append("prompt", "consent")

            const redirectedTo = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true })
            if (!redirectedTo) throw new Error("User cancelled or no redirect URL")

            const parsed = new URL(redirectedTo)
            const hash = parsed.hash || ''
            const accessToken = hash ? new URLSearchParams(hash.substring(1)).get('access_token') : new URLSearchParams(parsed.search).get('access_token')
            if (!accessToken) throw new Error('No access token received')

            const userInfo = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${accessToken}` }
            }).then(r => r.json())
            if (!userInfo.email) throw new Error('Failed to retrieve email from Google')

            await completeLogin(userInfo.email)
        } catch (e) {
            console.error('Google Sign-In Error:', e)
            alert('Google Sign-In Error: ' + (e.message || e))
        }
    }

    // ─── Microsoft OAuth ───
    async function handleMicrosoftLogin() {
        try {
            const manifest = (chrome && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest() : null
            const msClientId = manifest?.oauth2?.microsoft_client_id || "YOUR_MICROSOFT_CLIENT_ID"
            if (msClientId.includes("YOUR_MICROSOFT")) {
                alert("ERROR: Please configure your Microsoft Client ID in manifest.json under oauth2.microsoft_client_id")
                return
            }

            const redirectUrl = chrome.identity.getRedirectURL()
            const nonce = crypto.randomUUID()
            const authUrl = new URL("https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize")
            authUrl.searchParams.append("client_id", msClientId)
            authUrl.searchParams.append("response_type", "id_token")
            authUrl.searchParams.append("redirect_uri", redirectUrl)
            authUrl.searchParams.append("scope", "openid email profile")
            authUrl.searchParams.append("prompt", "select_account")
            authUrl.searchParams.append("response_mode", "fragment")
            authUrl.searchParams.append("nonce", nonce)

            const redirectedTo = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true })
            if (!redirectedTo) throw new Error("User cancelled or no redirect URL")

            // DEBUG: log redirect info (no token content) to help diagnose missing id_token
            try {
                console.log('Microsoft OAuth redirectedTo length=', String(redirectedTo).length)
                // log whether there's a fragment present and its length (avoid printing tokens)
                const debugHash = new URL(redirectedTo).hash || ''
                console.log('Microsoft OAuth fragment length=', debugHash.length)
            } catch (dbg) { console.warn('Failed to compute redirect debug info', dbg) }

            // Extract id_token from fragment
            const hash = new URL(redirectedTo).hash || ''
            const params = new URLSearchParams(hash.substring(1))
            const idToken = params.get('id_token')
            if (!idToken) {
                // Inspect fragment params to surface any provider-side errors (safe to log keys and error message)
                try {
                    const keys = Array.from(params.keys())
                    console.log('Microsoft fragment param keys=', keys.join(','))
                    if (params.has('error')) {
                        console.error('Microsoft OAuth returned error=', params.get('error'), params.get('error_description'))
                        throw new Error('Microsoft OAuth error: ' + (params.get('error') || 'unknown'))
                    }
                } catch (dbg) { console.warn('Failed to inspect Microsoft fragment params', dbg) }

                // Fallback: check for access_token
                const accessToken = params.get('access_token')
                if (accessToken) {
                    // Ask background service worker to fetch Graph /me on our behalf (avoids popup CORS/network issues)
                    let userInfo
                    try {
                        userInfo = await new Promise((resolve, reject) => {
                            try {
                                chrome.runtime.sendMessage({ action: 'ms_graph_me', accessToken }, (response) => {
                                    const lErr = chrome.runtime && chrome.runtime.lastError
                                    if (lErr) return reject(new Error('Runtime message error: ' + lErr.message))
                                    if (!response) return reject(new Error('No response from background'))
                                    if (response.error) return reject(new Error(response.error))
                                    return resolve(response)
                                })
                            } catch (err) {
                                return reject(err)
                            }
                        })
                    } catch (fetchErr) {
                        console.error('Microsoft Graph fetch (background) failed:', fetchErr)
                        throw new Error('Failed to fetch Microsoft profile: ' + (fetchErr.message || fetchErr))
                    }
                    const email = userInfo.mail || userInfo.userPrincipalName
                    if (!email) throw new Error('Failed to retrieve email from Microsoft')
                    await completeLogin(email)
                    return
                }
                console.error('Microsoft redirect URL (no token):', redirectedTo)
                throw new Error('No id_token or access_token received from Microsoft')
            }

            // Decode JWT payload to get email
            const payloadB64 = idToken.split('.')[1]
            const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
            const payload = JSON.parse(payloadJson)
            const email = payload.email || payload.preferred_username || payload.upn
            if (!email) throw new Error('No email found in Microsoft id_token')

            await completeLogin(email)
        } catch (e) {
            console.error('Microsoft Sign-In Error:', e)
            alert('Microsoft Sign-In Error: ' + (e.message || e))
        }
    }

    // Apple Sign-In removed for this project (not used)

    // ─── GitHub OAuth ───
    async function handleGitHubLogin() {
        try {
            const manifest = (chrome && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest() : null
            const ghClientId = manifest?.oauth2?.github_client_id || "YOUR_GITHUB_CLIENT_ID"
            if (ghClientId.includes("YOUR_GITHUB")) {
                alert("ERROR: Please configure your GitHub Client ID in manifest.json under oauth2.github_client_id")
                return
            }

            const redirectUrl = chrome.identity.getRedirectURL()
            const state = crypto.randomUUID()
            const authUrl = new URL("https://github.com/login/oauth/authorize")
            authUrl.searchParams.append("client_id", ghClientId)
            authUrl.searchParams.append("redirect_uri", redirectUrl)
            authUrl.searchParams.append("scope", "user:email")
            authUrl.searchParams.append("state", state)

            const redirectedTo = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true })
            if (!redirectedTo) throw new Error("User cancelled or no redirect URL")

            const parsed = new URL(redirectedTo)
            const code = parsed.searchParams.get('code') || (parsed.hash ? new URLSearchParams(parsed.hash.substring(1)).get('code') : null)
            if (!code) throw new Error('No code returned from GitHub')

            // Exchange code on server
            const resp = await fetch(bridgeUrl('/github/exchange'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, redirect_uri: redirectUrl })
            })
            const body = await resp.json()
            if (!resp.ok || body.error) {
                console.error('GitHub exchange failed', body)
                throw new Error(body.error || 'GitHub token exchange failed')
            }
            const email = body.email
            if (!email) throw new Error('Failed to obtain email from GitHub')
            await completeLogin(email)
        } catch (e) {
            console.error('GitHub Sign-In Error:', e)
            alert('GitHub Sign-In Error: ' + (e.message || e))
        }
    }

    async function handleLogout() {
        try {
            await chrome.storage.local.remove(['userEmail', 'registrationTimestamp'])
            setUserEmail(null)
            setRegistrationTimestamp(null)
            setActivities([])
            console.log('✓ User logged out and local session cleared')
        } catch (e) {
            console.error('Logout error', e)
        }
    }

    const loginLogoUrl = chrome && chrome.runtime ? chrome.runtime.getURL("images/U'rWay Logo.png") : ''

    if (!userEmail) return (
        <div className="root login-root">
            <div className="login-container">
                <div className="login-glow"></div>
                <div className="login-card">
                    <div className="login-logo-wrap">
                        <img src={loginLogoUrl} alt="U'rWay" className="login-logo" />
                        <div className="login-logo-ring"></div>
                    </div>
                    <h1 className="login-title">U'rWay</h1>
                    <p className="login-tagline">Be Fearless Online</p>
                    <p className="login-desc">Track your digital footprint with intelligence.<br/>Sign in to get started.</p>
                    <div className="login-providers">
                        <button className="login-provider-btn login-btn-google" onClick={handleGoogleLogin}>
                            <svg className="provider-icon" viewBox="0 0 24 24" width="20" height="20">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span>Continue with Google</span>
                        </button>

                        <button className="login-provider-btn login-btn-microsoft" onClick={handleMicrosoftLogin}>
                            <svg className="provider-icon" viewBox="0 0 23 23" width="20" height="20">
                                <rect fill="#F25022" x="1" y="1" width="10" height="10"/>
                                <rect fill="#7FBA00" x="12" y="1" width="10" height="10"/>
                                <rect fill="#00A4EF" x="1" y="12" width="10" height="10"/>
                                <rect fill="#FFB900" x="12" y="12" width="10" height="10"/>
                            </svg>
                            <span>Continue with Microsoft</span>
                        </button>

                        <button className="login-provider-btn login-btn-github" onClick={handleGitHubLogin}>
                            <svg className="provider-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                                <path fill="currentColor" d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.89.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.27-1.7-1.27-1.7-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.52-2.56-.29-5.26-1.28-5.26-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 012.9-.39c.98 0 1.97.13 2.9.39 2.2-1.5 3.17-1.18 3.17-1.18.63 1.6.23 2.77.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.69.41.36.77 1.08.77 2.18 0 1.57-.01 2.84-.01 3.23 0 .3.21.65.79.54A10.52 10.52 0 0023.5 12C23.5 5.73 18.27.5 12 .5z"/>
                            </svg>
                            <span>Continue with GitHub</span>
                        </button>

                        {/* Apple Sign-In removed */}
                    </div>
                    <div className="login-features">
                        <div className="login-feature">
                            <span className="feature-icon">&#128274;</span>
                            <span>End-to-End Encrypted</span>
                        </div>
                        <div className="login-feature">
                            <span className="feature-icon">&#127760;</span>
                            <span>Cross-Browser Sync</span>
                        </div>
                        <div className="login-feature">
                            <span className="feature-icon">&#128202;</span>
                            <span>Smart Analytics</span>
                        </div>
                    </div>
                    <div className="login-footer">
                        <span>U'rWay Intelligence</span>
                        <span className="login-dot">&#183;</span>
                        <span>Privacy First</span>
                    </div>
                </div>
            </div>
        </div>
    )

    function formatDurationLocal(seconds){
        if (!seconds && seconds !== 0) return '0m'
        seconds = Math.max(0, Math.round(seconds))
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        if (hours > 0) return `${hours}h ${minutes}m`
        if (minutes > 0) return `${minutes}m ${secs}s`
        return `${secs}s`
    }

    const logoUrl = chrome && chrome.runtime ? chrome.runtime.getURL("images/U'rWay Logo.png") : ''

    // Helper to normalize domain for matching
    function normalizeDomainForMatch(domain) {
        let d = String(domain || '').toLowerCase().trim()
        if (d.startsWith('www.')) d = d.slice(4)
        return d || 'unknown'
    }

    // Find selected domain data
    const selectedDomainData = selectedDomain ? (() => {
        const normalizedSelected = normalizeDomainForMatch(selectedDomain)
        const match = sitesData.find(s => normalizeDomainForMatch(s.domain) === normalizedSelected)
        if (!match) {
            console.warn('No match found for domain:', selectedDomain, 'normalized:', normalizedSelected, 'available:', sitesData.map(s => s.domain))
            return null
        }
        console.log('Selected domain matched:', match.domain, 'segments:', match.segments?.length, 'total:', match.total)
        return {
            domain: selectedDomain,
            segments: match.segments || [],
            total: match.total || 0
        }
    })() : null

    return (
        <div className="root">
            <header className="app-header">
                <div className="brand">
                    <img src={logoUrl} alt="U'rWay" className="brand-logo" />
                    <div className="brand-text">
                        <div className="brand-title">U'rWay</div>
                        <div className="brand-sub">Be Fearless Online</div>
                    </div>
                </div>

                <div className="header-actions">
                    <button className="theme-toggle" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
                    <button className="logout-btn" onClick={async ()=>{ if (confirm('Logout and clear session?')) await handleLogout()}}>Logout</button>
                </div>
            </header>

            <div className="user-email-bar">
                <span className="user-email-icon">👤</span>
                <span className="user-email-text" title={userEmail}>{userEmail}</span>
            </div>

            <nav className="nav-tabs">
                <button className={`nav-tab ${page === 'today' ? 'active' : ''}`} onClick={() => { setPage('today'); setSelectedDomain(null) }}>
                    <span className="nav-tab-icon">📊</span> Today
                </button>
                <button className={`nav-tab ${page === 'history' || page === 'history-day' ? 'active' : ''}`} onClick={() => { setPage('history'); fetchHistory() }}>
                    <span className="nav-tab-icon">📅</span> History
                </button>
            </nav>

            <main>
                {page === 'today' && (
                    <>
                        {!selectedDomain ? (
                            <>
                                <div className="top-banner">
                                    <div className="total-label">Today's browsing time</div>
                                    <div className="total-value">{formatDurationLocal(browserTotal)}</div>
                                </div>

                                {loading ? <div className="loading">Loading…</div> : <ActivityList sites={sitesData} totalBrowserDuration={browserTotal} onDomainClick={setSelectedDomain} />}
                            </>
                        ) : (
                            selectedDomainData && (
                                <DomainDetailView 
                                    domain={selectedDomainData.domain}
                                    items={selectedDomainData.segments}
                                    totalDuration={selectedDomainData.total}
                                    onBack={() => setSelectedDomain(null)}
                                />
                            )
                        )}
                    </>
                )}

                {page === 'history' && (
                    <HistoryCalendar 
                        days={historyDays} 
                        onDateClick={(date) => { setSelectedHistoryDate(date); setPage('history-day') }} 
                        onBack={() => setPage('today')} 
                    />
                )}

                {page === 'history-day' && selectedHistoryDate && (
                    <HistoryDayView 
                        date={selectedHistoryDate} 
                        userEmail={userEmail} 
                        registrationTimestamp={registrationTimestamp} 
                        onBack={() => setPage('history')} 
                    />
                )}
            </main>

            <footer className="app-footer">
                <div className="version">U'rWay Intelligence</div>
                <div className="credits">Built with care</div>
            </footer>
        </div>
    )
}
