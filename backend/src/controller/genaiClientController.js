const genaiBaseUrl = process.env.GENAI_SERVICE_URL || "http://127.0.0.1:5001";
const REQUEST_TIMEOUT_MS = 30_000; // 30s — Gemini can be slow

async function postJson(path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${genaiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `GenAI service error at ${path} (${response.status})`);
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`GenAI service timed out at ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function getGenaiBaseUrl() {
  return genaiBaseUrl;
}

export async function requestCluster(inputs) {
  return postJson("/api/cluster", inputs);
}

export async function requestRoadmap(payload) {
  return postJson("/api/roadmap", payload);
}

export async function requestExamQuestions(sourceMaterial, profile) {
  return postJson("/api/exam-questions", { sourceMaterial, profile });
}