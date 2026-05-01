require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb+srv://tirth2404:tirth2404@cluster0.qut1y8v.mongodb.net/";
const DB_NAME = process.env.DB_NAME || 'urway';

app.use(express.json());
app.use(cors());
app.use(session({ secret: process.env.SESSION_SECRET || 'dev_secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

if (!MONGO_URI) {
  console.error('MONGO_URI not set in .env');
  process.exit(1);
}

mongoose.connect(MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 5000 }).then(() => {
  console.log('MongoDB connected');
}).catch(err => { console.error('Mongo connect error', err); process.exit(1); });

const userSchema = new mongoose.Schema({ googleId: String, email: String, name: String, sessionTimeSeconds: { type: Number, default: 0 } }, { timestamps: true });
const User = mongoose.model('User', userSchema);

const logSchema = new mongoose.Schema({ userId: String, project: String, language: String, duration: Number, sessionTimeSeconds: Number, time: Date }, { timestamps: true });
const Log = mongoose.model('Log', logSchema);

const codeMap = new Map(); // one-time code -> userId
const loggedOutUsers = new Set(); // track logged-out users temporarily

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${BASE_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, cb) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({ googleId: profile.id, email: profile.emails?.[0]?.value, name: profile.displayName });
    }
    return cb(null, user);
  } catch (err) { return cb(err); }
}));

passport.serializeUser((u, done) => done(null, u.id));
passport.deserializeUser(async (id, done) => done(null, await User.findById(id)));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/fail' }), (req, res) => {
  const code = uuidv4();
  codeMap.set(code, req.user.id);
  // Render a page that attempts to open the vscode:// URI to auto-complete sign-in in the VS Code extension.
  // Also provide a fallback manual code copy for environments where vscode:// is not handled.
  const vscodeUri = `vscode://urway.urway-tracker/auth?code=${code}`;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sign-in successful</title>
  <style>body{font-family: Arial, sans-serif;max-width:800px;margin:50px auto;padding:20px} .card{background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}</style>
</head>
<body>
  <div class="card">
    <h1>Sign-in successful</h1>
    <p>We will try to open VS Code to complete sign-in automatically. If nothing happens, copy the code below and paste it into the extension.</p>
    <pre id="code">${code}</pre>
    <p><a id="openLink" href="${vscodeUri}">Open in VS Code</a></p>
    <p><button onclick="copyCode()">Copy Code</button></p>
    <p style="color:#666">If your browser doesn't open VS Code automatically, try clicking the "Open in VS Code" link above.</p>
  </div>
  <script>
    function copyCode(){ navigator.clipboard.writeText('${code}').then(()=>{ alert('Code copied to clipboard.'); }).catch(()=>{ alert('Unable to copy. Select and copy the code manually.'); }); }
    // Attempt to open the VS Code URI. After a short delay, also show the fallback link.
    setTimeout(function(){
      try { window.location.href = '${vscodeUri}'; } catch(e) { console.error(e); }
    }, 500);
  </script>
</body>
</html>`;
  res.send(html);
});

app.post('/auth/exchange', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const userId = codeMap.get(code);
    if (!userId) return res.status(400).json({ error: 'Invalid or expired code' });
    codeMap.delete(code);
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ id: user._id, name: user.name, email: user.email });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/logs', async (req, res) => {
  try {
    const { userId, project, language, duration, sessionTimeSeconds, time } = req.body || {};
    if (!project || !language || !duration) return res.status(400).json({ error: 'Missing fields' });
    const entry = await Log.create({ userId: userId || null, project, language, duration, sessionTimeSeconds: sessionTimeSeconds || 0, time: time ? new Date(time) : new Date() });
    
    // Update user's sessionTimeSeconds
    if (userId) {
      try {
        await User.findByIdAndUpdate(userId, { sessionTimeSeconds: sessionTimeSeconds || 0 });
      } catch (e) {
        console.error('Error updating user sessionTimeSeconds:', e);
      }
    }
    
    return res.json({ ok: true, id: entry._id });
  } catch (e) {
    console.error('Error saving log', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/elapsed/:userId', async (req, res) => {
  try {
    const { sessionTimeSeconds } = req.body;
    console.log(`[DEBUG] PUT /api/elapsed/:userId called - userId: ${req.params.userId}, sessionTimeSeconds: ${sessionTimeSeconds}`);
    if (typeof sessionTimeSeconds !== 'number') return res.status(400).json({ error: 'sessionTimeSeconds must be a number' });
    const user = await User.findByIdAndUpdate(req.params.userId, { sessionTimeSeconds }, { new: true });
    if (!user) {
      console.log(`[DEBUG] User not found for userId: ${req.params.userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(`[DEBUG] User updated successfully. New sessionTimeSeconds: ${user.sessionTimeSeconds}`);
    return res.json({ ok: true, sessionTimeSeconds: user.sessionTimeSeconds });
  } catch (e) {
    console.error('Error updating elapsed time:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard page to show user info and logout
app.get('/dashboard/:userId', async (req, res) => {
  try {
    console.log(`[DEBUG] Dashboard accessed for userId: ${req.params.userId}, query: ${JSON.stringify(req.query)}`);
    const user = await User.findById(req.params.userId).lean();
    if (!user) {
      console.log(`[DEBUG] User not found for userId: ${req.params.userId}`);
      return res.status(404).send('User not found');
    }
    
    // Use elapsed time from query parameter if provided, otherwise use from DB
    const totalSeconds = req.query.elapsed ? parseInt(req.query.elapsed) : (user.sessionTimeSeconds || 0);
    console.log(`[DEBUG] User found: ${user.email}, totalSeconds: ${totalSeconds}`);
    
    function formatTime(totalSecs) {
      const hrs = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>UrWay Dashboard</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .info { margin: 20px 0; padding: 10px; background: #e8f5e9; border-radius: 4px; }
    button { padding: 10px 20px; margin: 5px; font-size: 16px; border: none; border-radius: 4px; cursor: pointer; }
    .logout-btn { background: #f44336; color: white; }
    .logout-btn:hover { background: #d32f2f; }
    .success { display: none; background: #4CAF50; color: white; padding: 15px; border-radius: 4px; margin: 10px 0; }
    .stats { margin: 20px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome, ${user.name || user.email}!</h1>
    <div class="info">
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Total Time Coded:</strong> ${formatTime(totalSeconds)}</p>
    </div>
    <div id="successMsg" class="success">✓ Logged out successfully! You can now switch back to VS Code and sign in as a different user.</div>
    <div>
      <button class="logout-btn" onclick="logout('${req.params.userId}')">Logout</button>
    </div>
  </div>
  <script>
    function logout(userId) {
      fetch('/auth/logout/' + userId, { method: 'POST' })
        .then(() => {
          document.getElementById('successMsg').style.display = 'block';
          setTimeout(() => { window.close(); }, 1000);
        })
        .catch(e => alert('Logout error: ' + e.message));
    }
  </script>
</body>
</html>
    `;
    return res.send(html);
  } catch (e) {
    console.error(e);
    return res.status(500).send('Error loading dashboard');
  }
});

app.post('/auth/logout/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    loggedOutUsers.add(userId);
    console.log('User logged out:', userId);
    setTimeout(() => {
      loggedOutUsers.delete(userId);
    }, 10000);
    return res.json({ ok: true, message: 'Logged out' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Logout error' });
  }
});

app.get('/auth/check-logout/:userId', async (req, res) => {
  const userId = req.params.userId;
  const isLoggedOut = loggedOutUsers.has(userId);
  
  // Check if user still exists in database
  const userExists = await User.findById(userId);
  if (!userExists) {
    console.log('User does not exist in database:', userId);
    return res.json({ loggedOut: true, reason: 'user_deleted' });
  }
  
  console.log('Logout check for', userId, ':', isLoggedOut);
  return res.json({ loggedOut: isLoggedOut });
});

app.get('/', (req, res) => {
  res.send(`
<html>
<head><title>UrWay</title><style>
body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
.card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
button { padding: 10px 20px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; }
button:hover { background: #45a049; }
</style></head>
<body>
<div class="card">
<h2>UrWay Tracker</h2>
<p>Please sign in through the VS Code extension</p>
<button onclick="window.location.href='/auth/google'">Sign in with Google</button>
</div>
</body>
</html>
  `);
});


// Simple admin endpoints for testing
app.get('/users', async (req, res) => {
  try {
    const users = await User.find().lean();
    return res.json(users);
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

app.get('/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ createdAt: -1 }).limit(200).lean();
    return res.json(logs);
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
});

app.listen(PORT, () => console.log(`urway-backend listening on ${PORT}`));


