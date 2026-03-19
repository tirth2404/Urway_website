import json
import os
from typing import Any, Dict, List

from google import genai

from model.response_models import cluster_fallback, exam_fallback, roadmap_fallback


def get_candidate_models() -> List[str]:
    configured = os.environ.get("GEMINI_MODEL", "").strip()
    candidates = [
        configured,
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]
    seen = set()
    ordered = []
    for name in candidates:
        if name and name not in seen:
            seen.add(name)
            ordered.append(name)
    return ordered


def extract_json(text: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not text:
        return fallback


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _extract_profile_signals(payload: Dict[str, Any]) -> Dict[str, Any]:
    target = payload.get("target") if isinstance(payload.get("target"), dict) else {}
    onboarding = payload.get("onboardingInputs") if isinstance(payload.get("onboardingInputs"), dict) else {}
    profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
    profile_inputs = profile.get("onboardingInputs") if isinstance(profile.get("onboardingInputs"), dict) else {}

    merged_inputs = {**profile_inputs, **onboarding}
    goal = target.get("targetName") or payload.get("targetName") or merged_inputs.get("target_goal") or "Career readiness"
    timeline = target.get("timeline") or payload.get("timeline") or "8 weeks"

    return {
        "goal": goal,
        "timeline": timeline,
        "clusterTag": payload.get("clusterTag") or profile.get("virtualClusterTag") or "Unclassified",
        "priorKnowledge": target.get("priorKnowledge") or payload.get("priorKnowledge"),
        "cgpa": merged_inputs.get("cgpa"),
        "attendance": merged_inputs.get("attendance"),
        "weeklyStudyHours": merged_inputs.get("weekly_study_hours"),
        "techSkills": merged_inputs.get("tech_skills") or [],
        "interests": merged_inputs.get("interests") or [],
        "internshipCount": merged_inputs.get("internship_count"),
        "projectCount": merged_inputs.get("project_count"),
        "stressLevel": merged_inputs.get("stress_level"),
        "sleepHours": merged_inputs.get("sleep_hours"),
        "activityType": merged_inputs.get("activity_type"),
        "extensionSummary": payload.get("extensionSummary") or "No extension usage insights available.",
    }


def _normalize_roadmap_steps(steps: Any) -> List[Dict[str, Any]]:
    if not isinstance(steps, list):
        return []

    normalized = []
    for index, item in enumerate(steps[:8], start=1):
        if not isinstance(item, dict):
            continue

        normalized.append(
            {
                "id": item.get("id") or f"S{index}",
                "title": str(item.get("title") or f"Step {index}").strip(),
                "status": str(item.get("status") or "remaining").strip(),
                "dueDate": str(item.get("dueDate") or f"Week {index}").strip(),
                "notes": str(item.get("notes") or "Keep progress measurable and practical.").strip(),
            }
        )

    return normalized

    raw = text.strip()
    if raw.startswith("```json"):
        raw = raw.replace("```json", "", 1)
    if raw.startswith("```"):
        raw = raw.replace("```", "", 1)
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()

    try:
        return json.loads(raw)
    except Exception:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except Exception:
                return fallback
        return fallback


def ask_gemini(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return ""

    client = genai.Client(api_key=api_key)
    for model_name in get_candidate_models():
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            text = (response.text or "").strip()
            if text:
                return text
        except Exception:
            # If a model is unavailable or the request fails, try the next candidate.
            continue

    return ""


def classify_virtual_cluster(inputs: Dict[str, Any]) -> Dict[str, Any]:
    fallback = cluster_fallback()

    prompt = (
        "You are a student profiling agent for U'rWay.\n"
        "Categorize this user into an evocative virtual cluster tag.\n"
        "Return STRICT JSON only in this shape:\n"
        "{\n"
        '  "clusterTag": "string",\n'
        '  "rationale": "string"\n'
        "}\n\n"
        f"Input JSON:\n{json.dumps(inputs, indent=2)}"
    )

    text = ask_gemini(prompt)
    if not text:
        return fallback
    return extract_json(text, fallback)


def generate_roadmap(payload: Dict[str, Any]) -> Dict[str, Any]:
    fallback = roadmap_fallback()
    signals = _extract_profile_signals(payload)

    weak_areas = []
    if _safe_int(signals.get("weeklyStudyHours"), 0) < 8:
        weak_areas.append("low weekly study hours")
    if _safe_int(signals.get("attendance"), 100) < 75:
        weak_areas.append("attendance consistency")
    if _safe_int(signals.get("stressLevel"), 1) >= 4:
        weak_areas.append("high stress")
    if _safe_int(signals.get("projectCount"), 0) == 0:
        weak_areas.append("lack of projects")
    if _safe_int(signals.get("internshipCount"), 0) == 0:
        weak_areas.append("no internship exposure")

    strengths = []
    if _safe_int(signals.get("weeklyStudyHours"), 0) >= 12:
        strengths.append("strong study consistency")
    if _safe_int(signals.get("projectCount"), 0) >= 2:
        strengths.append("project experience")
    if isinstance(signals.get("techSkills"), list) and len(signals.get("techSkills")) >= 3:
        strengths.append("broad technical stack")

    personalization_brief = {
        "goal": signals.get("goal"),
        "timeline": signals.get("timeline"),
        "clusterTag": signals.get("clusterTag"),
        "strengths": strengths,
        "weakAreas": weak_areas,
        "skills": signals.get("techSkills"),
        "interests": signals.get("interests"),
        "extensionSummary": signals.get("extensionSummary"),
    }

    prompt = (
        "You are U'rWay roadmap engine.\n"
        "Generate a concise adaptive roadmap personalized to this specific student.\n"
        "Use the student signals to tailor sequence, intensity, and milestones.\n"
        "Every step must contain actionable notes tied to at least one user signal (skills, weak areas, interests, or extension usage).\n"
        "Generate 5 to 7 steps with realistic deadlines across the requested timeline.\n"
        "Return STRICT JSON only in this shape:\n"
        "{\n"
        '  "steps": [\n'
        '    {"id":"S1","title":"...","status":"complete|in-progress|remaining|overdue","dueDate":"...","notes":"..."}\n'
        "  ]\n"
        "}\n\n"
        f"Personalization Brief:\n{json.dumps(personalization_brief, indent=2)}\n\n"
        f"Raw Input Payload:\n{json.dumps(payload, indent=2)}"
    )

    text = ask_gemini(prompt)
    if not text:
        return fallback

    parsed = extract_json(text, fallback)
    normalized_steps = _normalize_roadmap_steps(parsed.get("steps"))
    if len(normalized_steps) == 0:
        return fallback
    return {"steps": normalized_steps}


def generate_exam_questions(source_material: Any, profile: Dict[str, Any]) -> Dict[str, Any]:
    fallback = exam_fallback()

    prompt = (
        "You are U'rWay exam composer.\n"
        "Generate 5 challenging but fair questions personalized to the source list and profile.\n"
        "Return STRICT JSON only: {\"questions\": [\"...\"]}.\n\n"
        f"Source Material:\n{json.dumps(source_material, indent=2)}\n\n"
        f"Profile:\n{json.dumps(profile, indent=2)}"
    )

    text = ask_gemini(prompt)
    if not text:
        return fallback

    parsed = extract_json(text, fallback)
    if not isinstance(parsed.get("questions"), list) or len(parsed.get("questions", [])) == 0:
        return fallback
    return parsed
