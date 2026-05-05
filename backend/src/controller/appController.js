import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { UserProfile }    from "../model/UserProfile.js";
import { UserCredential } from "../model/UserCredential.js";
import { Target }         from "../model/Target.js";
import { ExamSession }    from "../model/ExamSession.js";
import { ChromeActivity }  from "../model/ChromeActivity.js";
import { VscodeActivity }  from "../model/VscodeActivity.js";
import {
  setRefreshCookie,
  signAccessToken,
  signRefreshToken,
} from "../utils/tokenUtils.js";
import {
  getGenaiBaseUrl,
  requestCluster,
  requestRoadmap,
  requestExamQuestions,
  requestCareerPrediction,
  requestWellnessPrediction,
  requestCareerPathPrediction,
  requestStudentPerformancePrediction,
} from "./genaiClientController.js";

// ── Fallbacks ─────────────────────────────────────────────────────────────

function fallbackCluster() {
  return {
    clusterTag: "The Steady Explorer",
    rationale: "Fallback cluster — genai-service was unavailable.",
  };
}

function fallbackRoadmap() {
  return {
    steps: [
      { id: "S1", title: "Assess your starting point", status: "in-progress", dueDate: "Day 1–3", notes: "List your current skills, identify gaps, and set a clear daily schedule." },
      { id: "S2", title: "Build the foundation", status: "remaining", dueDate: "Week 1–2", notes: "Cover core concepts through structured resources or a beginner course." },
      { id: "S3", title: "Hands-on practice", status: "remaining", dueDate: "Week 2–3", notes: "Solve exercises and small challenges daily to reinforce learning." },
      { id: "S4", title: "Build a mini project", status: "remaining", dueDate: "Week 3–5", notes: "Apply what you've learned by building something tangible." },
      { id: "S5", title: "Review and fill gaps", status: "remaining", dueDate: "Week 5–6", notes: "Revisit weak areas, take mock tests, and document what you've learned." },
      { id: "S6", title: "Final milestone", status: "remaining", dueDate: "Week 7–8", notes: "Present, publish, or submit your work. Reflect on the journey." },
    ],
  };
}

function fallbackExamQuestions() {
  return {
    questions: [
      "Explain the core concept from your study material in your own words.",
      "Describe a real-world scenario where this skill or concept would be applied.",
      "What are three common mistakes beginners make in this area, and how would you avoid them?",
      "How would you explain this topic to someone with no prior background?",
      "What is the single most important thing you learned from your source material today?",
    ],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

const AI_DOMAINS = [
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "perplexity.ai",
  "copilot.microsoft.com",
];

function isAiDomain(url = "") {
  return AI_DOMAINS.some((d) => url.includes(d));
}

function classifyActivity(url = "") {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("coursera") || lower.includes("udemy") || lower.includes("docs.") || lower.includes("developer.")) return "learning";
  if (lower.includes("instagram") || lower.includes("twitter") || lower.includes("x.com") || lower.includes("tiktok") || lower.includes("reddit")) return "distracting";
  if (isAiDomain(lower)) return "ai-site";
  return "neutral";
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function validateEmail(email = "") {
  return /^\S+@\S+\.\S+$/.test(email);
}

function stripCredentials(inputs = {}) {
  const copy = { ...inputs };
  delete copy.password;
  delete copy.confirmPassword;
  return copy;
}

// ── Controllers ───────────────────────────────────────────────────────────

export async function getHealth(_req, res) {
  const mongoState = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    service: "urway-backend",
    mongo: mongoState,
    genaiServiceUrl: getGenaiBaseUrl(),
  });
}

/**
 * POST /api/onboarding
 *
 * Full flow:
 *  1. Validate email + password
 *  2. Call GenAI to classify user into a cluster
 *  3. Save UserProfile (with all onboarding inputs)
 *  4. Save UserCredential (hashed password)
 *  5. Call GenAI to generate a personalized roadmap from all user inputs
 *  6. Save initial Target with that roadmap
 *  7. Issue auth tokens (access token + refresh cookie) and return onboarding payload
 */
export async function onboarding(req, res) {
  const inputs = req.body || {};
  // SECURITY: always generate userId server-side — never trust it from the client body.
  // A malicious client could send an existing user's UUID and overwrite their profile.
  const userId = randomUUID();
  const email = normalizeEmail(inputs.email || "");
  const password = String(inputs.password || "");
  const confirmPassword = String(inputs.confirmPassword || "");

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Password and confirmPassword must match." });
  }

  const onboardingInputs = stripCredentials(inputs);

  // Check for existing email
  const existing = await UserCredential.findOne({ email }).lean();
  if (existing && existing.userId !== userId) {
    return res.status(409).json({ error: "This email is already registered. Please sign in." });
  }

  // 0. Career ML prediction (Flask service)
  let careerPrediction = null;
  try {
    const spec = onboardingInputs.ug_specialization === "__other__"
      ? (onboardingInputs.ug_specialization_other || "other")
      : (onboardingInputs.ug_specialization || "unknown");
    const mlPayload = {
      ug_course:        onboardingInputs.ug_course || "Other",
      ug_specialization: spec,
      skills:           (onboardingInputs.skills || []).join(";"),
      interests:        (onboardingInputs.interests || []).join(";"),
      ug_score:         onboardingInputs.ug_score || "70-80",
    };
    careerPrediction = await requestCareerPrediction(mlPayload);
  } catch {
    careerPrediction = { cluster: -1, confidence: 0 };
  }

  // 0.1 Wellness ML prediction (Flask service)
  let wellnessPrediction = null;
  try {
    const wellnessPayload = {
      Sleep_Hours:           parseFloat(onboardingInputs.sleep_hours),
      Sleep_Quality:         onboardingInputs.sleep_quality,
      Physical_Activity_Min: parseFloat(onboardingInputs.physical_activity_min),
      Diet_Quality:          onboardingInputs.diet_quality,
      Stress_Level:          parseFloat(onboardingInputs.stress_level),
    };
    wellnessPrediction = await requestWellnessPrediction(wellnessPayload);
  } catch (err) {
    console.error("Wellness prediction failed:", err.message);
    wellnessPrediction = { health_score: 0, health_floor: "Unknown", floor_num: -1 };
  }

  // 0.2 Career Path ML prediction (Flask service)
  let careerPathPrediction = null;
  try {
    const careerPathPayload = {
      Internships:            parseFloat(onboardingInputs.internships || 0),
      Projects:               parseFloat(onboardingInputs.projects || 0),
      Leadership_Positions:   parseFloat(onboardingInputs.leadership_positions || 0),
      Communication_Skills:   parseFloat(onboardingInputs.communication_skills || 0),
      Problem_Solving_Skills: parseFloat(onboardingInputs.problem_solving_skills || 0),
      Teamwork_Skills:        parseFloat(onboardingInputs.teamwork_skills || 0),
      Analytical_Skills:      parseFloat(onboardingInputs.analytical_skills || 0),
      Presentation_Skills:    parseFloat(onboardingInputs.presentation_skills || 0),
      Networking_Skills:      parseFloat(onboardingInputs.networking_skills || 0),
    };
    careerPathPrediction = await requestCareerPathPrediction(careerPathPayload);
  } catch (err) {
    console.error("Career Path prediction failed:", err.message);
    careerPathPrediction = { cluster_id: -1, cluster_name: "Unknown" };
  }

  // 0.3 Student Performance ML prediction (Flask service)
  let studentPerformancePrediction = null;
  try {
    const studentPerformancePayload = {
      traveltime: onboardingInputs.traveltime || 1,
      studytime:  onboardingInputs.studytime || 1,
      failures:   onboardingInputs.failures || 0,
      schoolsup:  onboardingInputs.schoolsup ? "yes" : "no",
      famsup:     onboardingInputs.famsup ? "yes" : "no",
      paid:       onboardingInputs.paid ? "yes" : "no",
      activities: onboardingInputs.activities ? "yes" : "no",
      internet:   onboardingInputs.internet ? "yes" : "no",
      freetime:   onboardingInputs.freetime || 3,
      goout:      onboardingInputs.goout || 3,
    };
    studentPerformancePrediction = await requestStudentPerformancePrediction(studentPerformancePayload);
  } catch (err) {
    console.error("Student Performance prediction failed:", err.message);
    studentPerformancePrediction = { cluster_id: -1, cluster_name: "Unknown" };
  }

  // 1. Classify cluster (non-blocking fallback)
  let cluster = fallbackCluster();
  try {
    cluster = await requestCluster(onboardingInputs);
  } catch {
    cluster = fallbackCluster();
  }

  // 2. Save profile (with all ML predictions)
  const profile = await UserProfile.findOneAndUpdate(
    { userId },
    {
      userId,
      virtualClusterTag: cluster.clusterTag || "The Steady Explorer",
      onboardingInputs: { 
        ...onboardingInputs, 
        careerPrediction, 
        wellnessPrediction, 
        careerPathPrediction,
        studentPerformancePrediction 
      },
    },
    { upsert: true, new: true }
  );

  // 3. Save credentials
  const passwordHash = await bcrypt.hash(password, 12);
  await UserCredential.findOneAndUpdate(
    { userId },
    { userId, email, passwordHash },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // 4. Generate personalized roadmap from ALL onboarding inputs
  const spec = onboardingInputs.ug_specialization === "__other__"
    ? (onboardingInputs.ug_specialization_other || "")
    : (onboardingInputs.ug_specialization || "");
  const targetName = spec
    ? `${onboardingInputs.ug_course || "Career"} — ${spec} Roadmap`
    : (onboardingInputs.ug_course ? `${onboardingInputs.ug_course} Roadmap` : "Personal Growth Roadmap");

  let roadmapResult = fallbackRoadmap();
  try {
    roadmapResult = await requestRoadmap({
      // Pass everything so the GenAI service can use all signals
      ...onboardingInputs,
      targetName,
      timeline: "8 weeks",
      clusterTag: profile.virtualClusterTag,
      extensionSummary: "No extension data yet — first session.",
    });
  } catch {
    roadmapResult = fallbackRoadmap();
  }

  // 5. Create initial target
  const target = await Target.create({
    userId,
    targetName,
    timeline: "8 weeks",
    priorKnowledge: ({ "<50": 3, "50-60": 5, "60-70": 6, "70-80": 7, "80-90": 8, "90+": 9 }[onboardingInputs.ug_score] || 5),
    description: `Auto-generated roadmap for ${cluster.clusterTag || "your learner profile"}.`,
    roadmap: roadmapResult.steps || [],
    status: "in-progress",
  });

  const accessToken = signAccessToken(profile.userId, email);
  const refreshToken = signRefreshToken(profile.userId, profile.virtualClusterTag ?? null);
  setRefreshCookie(res, refreshToken);

  return res.status(201).json({
    accessToken,
    userId: profile.userId,
    virtualClusterTag: profile.virtualClusterTag,
    rationale: cluster.rationale || "",
    initialTarget: target,
  });
}

/**
 * GET /api/dashboard/:userId
 * Return user profile + all targets.
 */
export async function dashboard(req, res) {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId is required." });

  const profile = await UserProfile.findOne({ userId }).lean();
  if (!profile) return res.status(404).json({ error: "User not found. Please complete onboarding." });

  const targets = await Target.find({ userId }).sort({ createdAt: -1 }).lean();

  return res.json({
    profile,
    targets,
    isNewUser: !targets.length,
  });
}

/**
 * POST /api/targets/:userId
 * Create a new target with a GenAI-generated roadmap.
 */
export async function createTarget(req, res) {
  const { userId } = req.params;
  const payload = req.body || {};

  if (!payload.targetName || !payload.timeline || !payload.description) {
    return res.status(400).json({ error: "targetName, timeline, and description are required." });
  }

  const profile = await UserProfile.findOne({ userId }).lean();
  if (!profile) {
    return res.status(404).json({ error: "User profile not found. Complete onboarding first." });
  }

  // Get recent Chrome extension data for context
  const recentActivity = await ChromeActivity.find({ userId })
    .sort({ capturedAt: -1 })
    .limit(30)
    .lean();

  const distractingMins = Math.round(
    recentActivity
      .filter((e) => e.category === "distracting")
      .reduce((sum, e) => sum + (e.secondsSpent || 0), 0) / 60
  );
  const learningMins = Math.round(
    recentActivity
      .filter((e) => e.category === "learning")
      .reduce((sum, e) => sum + (e.secondsSpent || 0), 0) / 60
  );
  const extensionSummary = recentActivity.length
    ? `Recent: ${learningMins} mins on learning sites, ${distractingMins} mins on distracting sites.`
    : "No extension data available.";

  let roadmapResult = fallbackRoadmap();
  try {
    roadmapResult = await requestRoadmap({
      target: payload,
      profile,
      clusterTag: profile.virtualClusterTag,
      extensionSummary,
    });
  } catch {
    roadmapResult = fallbackRoadmap();
  }

  const target = await Target.create({
    userId,
    targetName: payload.targetName,
    timeline: payload.timeline,
    priorKnowledge: Number(payload.priorKnowledge) || 5,
    description: payload.description,
    roadmap: roadmapResult.steps || [],
    status: "in-progress",
  });

  return res.status(201).json(target);
}

/**
 * POST /api/exam/start
 * Start a proctored exam session.
 */
export async function startExam(req, res) {
  const authUserId = req.user?.userId;
  const { targetId = "", sourceMaterial = [] } = req.body || {};
  if (!authUserId) return res.status(401).json({ error: "Unauthorized." });

  const profile = await UserProfile.findOne({ userId: authUserId }).lean();
  if (!profile) return res.status(404).json({ error: "User profile not found." });

  let questionSet = fallbackExamQuestions();
  try {
    questionSet = await requestExamQuestions(sourceMaterial, profile);
  } catch {
    questionSet = fallbackExamQuestions();
  }

  const session = await ExamSession.create({
    userId: authUserId,
    targetId,
    sourceMaterial,
    generatedQuestions: questionSet.questions || [],
  });

  return res.status(201).json(session);
}

/**
 * POST /api/exam/flag/:sessionId
 * Flag an exam session as violated.
 */
export async function flagExam(req, res) {
  const { sessionId } = req.params;
  const { reason = "Policy violation", url = "" } = req.body || {};
  const authUserId = req.user?.userId;
  if (!authUserId) return res.status(401).json({ error: "Unauthorized." });

  const existingSession = await ExamSession.findById(sessionId).lean();
  if (!existingSession) return res.status(404).json({ error: "Exam session not found." });
  if (existingSession.userId !== authUserId) {
    return res.status(403).json({ error: "Forbidden: cannot flag another user's exam session." });
  }

  const session = await ExamSession.findByIdAndUpdate(
    sessionId,
    {
      terminated: true,
      endedAt: new Date(),
      redFlag: true,
      redFlagReason: url ? `${reason} (${url})` : reason,
    },
    { new: true }
  );

  if (!session) return res.status(404).json({ error: "Exam session not found." });
  return res.json(session);
}

/**
 * POST /api/chrome/sync/:userId  (alias: /api/extension/sync/:userId)
 * Record a Chrome browser activity event and update the user's extension insight.
 */
export async function syncChromeExtension(req, res) {
  const { userId } = req.params;
  const { url = "", title = "", secondsSpent = 0 } = req.body || {};

  if (!url) return res.status(400).json({ error: "url is required." });

  const category = classifyActivity(url);

  // Write to the chrome_activity collection
  const event = await ChromeActivity.create({
    userId,
    url,
    title,
    secondsSpent: Math.max(0, Number(secondsSpent) || 0),
    category,
    capturedAt: new Date(),
  });

  let insight = "Browsing looks on track.";
  if (category === "distracting") insight = "Off-track browsing detected — try to refocus on your roadmap.";
  if (category === "ai-site")     insight = "AI site detected — exam sessions will be flagged if active.";
  if (category === "learning")    insight = "Great — learning content detected in your recent browsing.";

  await UserProfile.findOneAndUpdate(
    { userId },
    { lastExtensionInsight: insight },
    { upsert: false }
  );

  return res.json({ event, insight, category, aiDomainDetected: isAiDomain(url) });
}

// Keep the old export name so any code that still imports syncExtension doesn't break
export const syncExtension = syncChromeExtension;

/**
 * POST /api/vscode/sync/:userId
 * Record a VS Code coding activity event from the U'rWay VS Code extension.
 * Writes to the 'logs' collection (where the extension writes directly).
 */
export async function syncVscodeExtension(req, res) {
  const { userId } = req.params;
  const {
    project            = "",
    language           = "",
    duration           = 0,
    sessionTimeSeconds = 0,
    time               = new Date(),
  } = req.body || {};

  const event = await VscodeActivity.create({
    userId,
    project,
    language,
    duration:           Math.max(0, Number(duration)           || 0),
    sessionTimeSeconds: Math.max(0, Number(sessionTimeSeconds) || 0),
    time:               time ? new Date(time) : new Date(),
  });

  return res.status(201).json({ event });
}

