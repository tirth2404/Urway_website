const genaiBaseUrl = process.env.GENAI_SERVICE_URL || "http://127.0.0.1:5001";

async function postJson(path, payload) {
  const response = await fetch(`${genaiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `GenAI request failed: ${path}`);
  }
  return data;
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
