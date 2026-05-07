const genaiBaseUrl    = process.env.GENAI_SERVICE_URL || "http://127.0.0.1:5001";
const REQUEST_TIMEOUT = 30_000; // 30s — Gemini can be slow

if (!process.env.SERVICE_SECRET) {
  console.warn("[genaiClient] WARNING: SERVICE_SECRET is not set — calls to genai-service will be rejected.");
}

async function postJson(path, payload) {
  const serviceSecret = process.env.SERVICE_SECRET || "";
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    console.log(`[genaiClient] POST ${path} to GenAI service at`, genaiBaseUrl);
    const response = await fetch(`${genaiBaseUrl}${path}`, {
      method:  "POST",
      headers: {
        "Content-Type":     "application/json",
        "X-Service-Secret": serviceSecret,   // ← shared secret injected here automatically
      },
      body:   JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[genaiClient] GenAI service error at ${path} (${response.status}):`, data);
      throw new Error(data.error || `GenAI service error at ${path} (${response.status})`);
    }
    console.log(`[genaiClient] GenAI service success at ${path}`);
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error(`[genaiClient] GenAI service timed out at ${path} after ${REQUEST_TIMEOUT}ms`);
      throw new Error(`GenAI service timed out at ${path}`);
    }
    console.error(`[genaiClient] GenAI service failed at ${path}:`, err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function getGenaiBaseUrl()                      { return genaiBaseUrl; }
export async function requestCluster(inputs)           { return postJson("/api/cluster",        inputs); }
export async function requestRoadmap(payload)          { return postJson("/api/roadmap",         payload); }
export async function requestExamQuestions(sm, profile, targetInfo){ return postJson("/api/exam-questions",  { sourceMaterial: sm, profile, targetInfo }); }

// ── Career Recommender ML service (Combined Flask on port 5006) ──────────────────────
const careerMlUrl = process.env.CAREER_ML_URL || "http://127.0.0.1:5006/api/career";


export async function requestCareerPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    console.log("[genaiClient] Calling Career ML at:", `${careerMlUrl}/predict`);
    const response = await fetch(`${careerMlUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[genaiClient] Career ML error response:", response.status, data);
      throw new Error(data.error || `Career ML service error (${response.status})`);
    }
    console.log("[genaiClient] Career ML success, cluster:", data.cluster);
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[genaiClient] Career ML service timed out after", REQUEST_TIMEOUT, "ms");
      throw new Error("Career ML service timed out");
    }
    console.error("[genaiClient] Career ML call failed:", err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Mental Wellness ML service (Combined Flask on port 5006) ─────────────────────────
const wellnessMlUrl = process.env.WELLNESS_ML_URL || "http://127.0.0.1:5006/api/wellness";

export async function requestWellnessPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    console.log("[genaiClient] Calling Wellness ML at:", `${wellnessMlUrl}/predict`);
    const response = await fetch(`${wellnessMlUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[genaiClient] Wellness ML error response:", response.status, data);
      throw new Error(data.error || `Wellness ML service error (${response.status})`);
    }
    console.log("[genaiClient] Wellness ML success");
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[genaiClient] Wellness ML service timed out after", REQUEST_TIMEOUT, "ms");
      throw new Error("Wellness ML service timed out");
    }
    console.error("[genaiClient] Wellness ML call failed:", err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Career Path ML service (Combined Flask on port 5006) ─────────────────────────────
const careerPathMlUrl = process.env.CAREER_PATH_ML_URL || "http://127.0.0.1:5006/api/career_path";

export async function requestCareerPathPrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    console.log("[genaiClient] Calling Career Path ML at:", `${careerPathMlUrl}/predict`);
    const response = await fetch(`${careerPathMlUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[genaiClient] Career Path ML error response:", response.status, data);
      throw new Error(data.error || `Career Path ML service error (${response.status})`);
    }
    console.log("[genaiClient] Career Path ML success");
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[genaiClient] Career Path ML service timed out after", REQUEST_TIMEOUT, "ms");
      throw new Error("Career Path ML service timed out");
    }
    console.error("[genaiClient] Career Path ML call failed:", err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Student Performance ML service (Combined Flask on port 5006) ──────────────────────
const studentPerformanceMlUrl = process.env.STUDENT_PERFORMANCE_ML_URL || "http://127.0.0.1:5006/api/student_performance";

export async function requestStudentPerformancePrediction(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    console.log("[genaiClient] Calling Student Performance ML at:", `${studentPerformanceMlUrl}/predict`);
    const response = await fetch(`${studentPerformanceMlUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[genaiClient] Student Performance ML error response:", response.status, data);
      throw new Error(data.error || `Student Performance ML service error (${response.status})`);
    }
    console.log("[genaiClient] Student Performance ML success");
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[genaiClient] Student Performance ML service timed out after", REQUEST_TIMEOUT, "ms");
      throw new Error("Student Performance ML service timed out");
    }
    console.error("[genaiClient] Student Performance ML call failed:", err.message);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Keyword Extraction service (Text Summarization Flask on port 5007) ────────────────
const keywordServiceUrl = process.env.KEYWORD_SERVICE_URL || "http://127.0.0.1:5007";

/**
 * POST /api/keywords/predict
 * Sends a target description to the fine-tuned Flan-T5 keyword extractor.
 * Returns: { description, keywords_raw, keywords_list, keyword_count }
 */
export async function requestKeywordPrediction(description) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(`${keywordServiceUrl}/api/keywords/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Keyword service error (${response.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Keyword service timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
