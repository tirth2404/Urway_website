import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import { UserProfile } from "../model/UserProfile.js";
import { UserCredential } from "../model/UserCredential.js";
import { Target } from "../model/Target.js";
import { ExamSession } from "../model/ExamSession.js";
import { ExtensionActivity } from "../model/ExtensionActivity.js";
import {
  getGenaiBaseUrl,
  requestCluster,
  requestRoadmap,
  requestExamQuestions,
} from "./genaiClientController.js";

function fallbackCluster() {
  return {
    clusterTag: "The Steady Explorer",
    rationale: "Fallback cluster used because genai-service was unavailable.",
  };
}

function fallbackRoadmap() {
  return {
    steps: [
      {
        id: "S1",
        title: "Foundation sprint",
        status: "in-progress",
        dueDate: "Week 1",
        notes: "Start with core concepts.",
      },
      {
        id: "S2",
        title: "Guided practice",
        status: "remaining",
        dueDate: "Week 2",
        notes: "Solve practical exercises daily.",
      },
      {
        id: "S3",
        title: "Mini project",
        status: "remaining",
        dueDate: "Week 3",
        notes: "Build and document one project.",
      },
    ],
  };
}

function fallbackExamQuestions() {
  return {
    questions: [
      "Explain the core concept from your latest study source in your own words.",
      "Solve a practical scenario related to your target domain.",
      "List three mistakes beginners make and how to avoid them.",
    ],
  };
}

const aiDomains = [
  "chat.openai.com",
  "gemini.google.com",
  "claude.ai",
  "perplexity.ai",
  "copilot.microsoft.com",
];

function isAiDomain(url = "") {
  return aiDomains.some((domain) => url.includes(domain));
}

function classifyActivity(url = "") {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com") || lower.includes("coursera") || lower.includes("docs")) return "learning";
  if (lower.includes("f1") || lower.includes("instagram") || lower.includes("twitter") || lower.includes("x.com")) return "distracting";
  if (isAiDomain(lower)) return "ai-site";
  return "neutral";
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function validateEmail(email = "") {
  return /^\S+@\S+\.\S+$/.test(email);
}

function sanitizeOnboardingInputs(inputs = {}) {
  const copy = { ...inputs };
  delete copy.password;
  delete copy.confirmPassword;
  return copy;
}

export async function getHealth(_req, res) {
  const mongoState = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    service: "urway-mern-backend",
    mongo: mongoState,
    genaiServiceUrl: getGenaiBaseUrl(),
  });
}

export async function authSignIn(req, res) {
  const email = normalizeEmail(req.body?.email || "");
  const password = String(req.body?.password || "");

  if (!validateEmail(email) || password.length < 8) {
    return res.status(400).json({ error: "Valid email and password are required." });
  }

  const credential = await UserCredential.findOne({ email }).lean();
  if (!credential) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const isMatch = await bcrypt.compare(password, credential.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const profile = await UserProfile.findOne({ userId: credential.userId }).lean();

  return res.json({
    userId: credential.userId,
    virtualClusterTag: profile?.virtualClusterTag || null,
  });
}

export async function onboarding(req, res) {
  const inputs = req.body || {};
  const userId = inputs.userId || randomUUID();
  const email = normalizeEmail(inputs.email || "");
  const password = String(inputs.password || "");
  const onboardingInputs = sanitizeOnboardingInputs(inputs);

  if (!validateEmail(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const existingByEmail = await UserCredential.findOne({ email }).lean();
  if (existingByEmail && existingByEmail.userId !== userId) {
    return res.status(409).json({ error: "Email already exists. Please sign in." });
  }

  let cluster = fallbackCluster();
  try {
    cluster = await requestCluster(onboardingInputs);
  } catch {
    cluster = fallbackCluster();
  }

  const profile = await UserProfile.findOneAndUpdate(
    { userId },
    {
      userId,
      virtualClusterTag: cluster.clusterTag || "The Steady Explorer",
      onboardingInputs,
    },
    { upsert: true, new: true }
  );

  const passwordHash = await bcrypt.hash(password, 12);
  await UserCredential.findOneAndUpdate(
    { userId },
    { userId, email, passwordHash },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const initialTargetPayload = {
    targetName: onboardingInputs.target_goal ? `${onboardingInputs.target_goal} Launch Plan` : "Personal Growth Plan",
    timeline: "8 weeks",
    priorKnowledge: Math.max(1, Math.min(10, Math.round((Number(onboardingInputs.cgpa) || 50) / 10))),
    description: "Auto-generated roadmap from onboarding clusters and profile signals.",
    clusterTag: profile.virtualClusterTag,
    onboardingInputs,
    extensionSummary: "No extension data yet.",
  };

  let roadmapResult = fallbackRoadmap();
  try {
    roadmapResult = await requestRoadmap(initialTargetPayload);
  } catch {
    roadmapResult = fallbackRoadmap();
  }

  const target = await Target.create({
    userId,
    targetName: initialTargetPayload.targetName,
    timeline: initialTargetPayload.timeline,
    priorKnowledge: initialTargetPayload.priorKnowledge,
    description: initialTargetPayload.description,
    roadmap: roadmapResult.steps || [],
    status: "in-progress",
  });

  res.json({
    userId: profile.userId,
    virtualClusterTag: profile.virtualClusterTag,
    rationale: cluster.rationale || "",
    onboardingInputs: profile.onboardingInputs,
    initialTarget: target,
  });
}

export async function dashboard(req, res) {
  const { userId } = req.params;
  const profile = await UserProfile.findOne({ userId }).lean();
  const targets = await Target.find({ userId }).sort({ createdAt: -1 }).lean();

  res.json({
    profile,
    targets,
    isNewUser: !targets.length,
  });
}

export async function createTarget(req, res) {
  const { userId } = req.params;
  const payload = req.body || {};

  const profile = await UserProfile.findOne({ userId }).lean();
  if (!profile) {
    return res.status(404).json({ error: "User profile not found. Complete onboarding first." });
  }

  const extensionEvents = await ExtensionActivity.find({ userId }).sort({ createdAt: -1 }).limit(30).lean();
  const distractionSeconds = extensionEvents
    .filter((event) => event.category === "distracting")
    .reduce((sum, event) => sum + (event.secondsSpent || 0), 0);

  const extensionSummary = `Recent distracting time: ${Math.round(distractionSeconds / 60)} minutes.`;

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
    priorKnowledge: Number(payload.priorKnowledge),
    description: payload.description,
    roadmap: roadmapResult.steps || [],
    status: "in-progress",
  });

  return res.status(201).json(target);
}

export async function startExam(req, res) {
  const { userId, targetId = "", sourceMaterial = [] } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required." });

  const profile = await UserProfile.findOne({ userId }).lean();
  if (!profile) return res.status(404).json({ error: "Profile not found." });

  let questionSet = fallbackExamQuestions();
  try {
    questionSet = await requestExamQuestions(sourceMaterial, profile);
  } catch {
    questionSet = fallbackExamQuestions();
  }

  const session = await ExamSession.create({
    userId,
    targetId,
    sourceMaterial,
    generatedQuestions: questionSet.questions || [],
  });

  return res.status(201).json(session);
}

export async function flagExam(req, res) {
  const { sessionId } = req.params;
  const { reason = "Policy violation", url = "" } = req.body || {};

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

export async function syncExtension(req, res) {
  const { userId } = req.params;
  const { url = "", title = "", secondsSpent = 0 } = req.body || {};

  const category = classifyActivity(url);

  const event = await ExtensionActivity.create({
    userId,
    url,
    title,
    secondsSpent: Number(secondsSpent) || 0,
    category,
    capturedAt: new Date(),
  });

  let suggestion = "On track";
  if (category === "distracting") {
    suggestion = "Roadmap shifted toward orange due to off-target browsing.";
  }

  if (category === "ai-site") {
    suggestion = "AI site detected. Exam sessions should be red-flagged.";
  }

  await UserProfile.findOneAndUpdate(
    { userId },
    { lastExtensionInsight: suggestion },
    { upsert: false }
  );

  return res.json({ event, suggestion, category, aiDomainDetected: isAiDomain(url) });
}
