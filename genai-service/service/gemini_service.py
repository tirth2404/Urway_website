import json
import os
import re
from typing import Any, Dict, List

from google import genai

from model.response_models import cluster_fallback, exam_fallback, roadmap_fallback


# ── Gemini client ────────────────────────────────────────────────────────────

def _get_models() -> List[str]:
    configured = os.environ.get("GEMINI_MODEL", "").strip()
    candidates = [configured, "gemini-2.0-flash", "gemini-1.5-flash"]
    seen, ordered = set(), []
    for m in candidates:
        if m and m not in seen:
            seen.add(m)
            ordered.append(m)
    return ordered


def ask_gemini(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return ""
    client = genai.Client(api_key=api_key)
    for model_name in _get_models():
        try:
            response = client.models.generate_content(model=model_name, contents=prompt)
            text = (response.text or "").strip()
            if text:
                return text
        except Exception:
            continue
    return ""


# ── JSON extraction (fixed — no dead code) ──────────────────────────────────

def extract_json(text: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not text:
        return fallback

    raw = text.strip()
    # Strip markdown fences
    raw = re.sub(r"^```(?:json)?", "", raw).strip()
    raw = re.sub(r"```$", "", raw).strip()

    try:
        return json.loads(raw)
    except Exception:
        pass

    # Try to find the outermost JSON object
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(raw[start:end + 1])
        except Exception:
            pass

    return fallback


# ── Helpers ──────────────────────────────────────────────────────────────────

def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _normalize_roadmap_steps(steps: Any) -> List[Dict[str, Any]]:
    if not isinstance(steps, list):
        return []
    normalized = []
    valid_statuses = {"complete", "in-progress", "remaining", "overdue"}
    for i, item in enumerate(steps[:8], start=1):
        if not isinstance(item, dict):
            continue
        status = str(item.get("status") or "remaining").strip()
        if status not in valid_statuses:
            status = "remaining"
        normalized.append({
            "id": item.get("id") or f"S{i}",
            "title": str(item.get("title") or f"Step {i}").strip(),
            "status": status,
            "dueDate": str(item.get("dueDate") or f"Week {i}").strip(),
            "notes": str(item.get("notes") or "Keep progress measurable and practical.").strip(),
        })
    return normalized


def _build_user_brief(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Flatten onboarding inputs into a clean signal brief for prompts."""
    return {
        "name": inputs.get("name", ""),
        "age": inputs.get("age", ""),
        "targetGoal": inputs.get("target_goal", "Career readiness"),
        "academicScore": inputs.get("cgpa", ""),
        "studyHoursPerDay": inputs.get("study_hours_per_day", ""),
        "preferredStudyTime": inputs.get("preferred_study_time", ""),
        "learningStyle": inputs.get("learning_style", ""),
        "weakAreas": inputs.get("weak_areas", []),
        "internetAccess": inputs.get("internet_access", True),
        "internships": inputs.get("internship_count", 0),
        "projects": inputs.get("project_count", 0),
        "techSkills": inputs.get("tech_skills", []),
        "interests": inputs.get("interests", []),
        "clubs": inputs.get("club_memberships", []),
        "communicationScore": inputs.get("communication_score", 3),
        "teamworkScore": inputs.get("teamwork_score", 3),
        "leadershipScore": inputs.get("leadership_score", 3),
        "timeManagementScore": inputs.get("time_management_score", 3),
        "sleepHours": inputs.get("sleep_hours", 7),
        "stressLevel": inputs.get("stress_level", 3),
        "physicalActivityMin": inputs.get("physical_activity_min", 30),
        "activityType": inputs.get("activity_type", ""),
    }


# ── Public service functions ─────────────────────────────────────────────────

def classify_virtual_cluster(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Classify a user into a learner archetype cluster."""
    fallback = cluster_fallback()
    brief = _build_user_brief(inputs)

    prompt = f"""You are a student profiling agent for U'rWay, an AI growth platform.

Given the student profile below, assign them to ONE evocative learner archetype cluster.
Choose a tag that captures their personality and learning style — make it memorable and specific.
Examples: "The Night-Owl Builder", "The Steady Grinder", "The Creative Generalist", "The Sprint-and-Rest Coder".

Return STRICT JSON only (no extra text, no markdown):
{{
  "clusterTag": "<evocative tag>",
  "rationale": "<1–2 sentence explanation>"
}}

Student Profile:
{json.dumps(brief, indent=2)}"""

    text = ask_gemini(prompt)
    if not text:
        return fallback
    result = extract_json(text, fallback)
    if not result.get("clusterTag"):
        return fallback
    return result


def generate_roadmap(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main roadmap generation function.

    Accepts two shapes:
    1. Direct onboarding payload  → called during onboarding
    2. Target creation payload    → called when user adds a new target
       {target: {targetName, timeline, priorKnowledge, description}, profile: {...}}
    """
    fallback = roadmap_fallback()

    # --- Extract signals ---
    target = payload.get("target") or {}
    profile = payload.get("profile") or {}
    profile_inputs = profile.get("onboardingInputs") or {}

    # For direct onboarding calls, the inputs are at the top level
    onboarding_inputs = payload if not target else profile_inputs

    brief = _build_user_brief(onboarding_inputs)
    cluster_tag = payload.get("clusterTag") or profile.get("virtualClusterTag") or "Unclassified"

    # Goal and timeline — prefer explicit target, fall back to onboarding
    goal = (
        target.get("targetName")
        or payload.get("targetName")
        or brief.get("targetGoal")
        or "Career readiness"
    )
    timeline = (
        target.get("timeline")
        or payload.get("timeline")
        or "8 weeks"
    )
    prior_knowledge = _safe_int(
        target.get("priorKnowledge") or payload.get("priorKnowledge"), 5
    )
    description = target.get("description") or payload.get("description") or ""
    extension_summary = payload.get("extensionSummary") or "No browsing data available."

    # Auto-detect strengths and gaps
    gaps = []
    if _safe_int(brief.get("stressLevel"), 1) >= 7:
        gaps.append("high stress level — needs wellbeing steps")
    if _safe_int(brief.get("projects"), 0) == 0:
        gaps.append("no project experience yet")
    if _safe_int(brief.get("internships"), 0) == 0:
        gaps.append("no internship exposure")
    if brief.get("weakAreas"):
        gaps.extend([f"self-reported weak area: {w}" for w in brief["weakAreas"]])

    strengths = []
    if _safe_int(brief.get("projects"), 0) >= 2:
        strengths.append("has built projects before")
    if isinstance(brief.get("techSkills"), list) and len(brief["techSkills"]) >= 3:
        strengths.append(f"knows: {', '.join(brief['techSkills'][:5])}")
    if brief.get("learningStyle"):
        strengths.append(f"{brief['learningStyle']} learner")

    prompt = f"""You are U'rWay's roadmap engine — an expert AI mentor.

Generate a personalized, practical roadmap for this student. Every step must be:
- Directly tied to their goal, skills, and personal profile
- Realistic within the given timeline
- Actionable (not vague — mention specific tools, topics, or tasks)

Rules:
- Generate exactly 6 to 8 steps
- First step status should be "in-progress", rest should be "remaining"
- dueDate should be a milestone label like "Week 1–2" or "Day 1–3"
- notes should be 1–2 sentences of specific, practical guidance

Return STRICT JSON only (no markdown, no extra text):
{{
  "steps": [
    {{"id":"S1","title":"...","status":"in-progress","dueDate":"Week 1","notes":"..."}}
  ]
}}

---
GOAL: {goal}
TIMELINE: {timeline}
DESCRIPTION: {description}
LEARNER CLUSTER: {cluster_tag}
PRIOR KNOWLEDGE (1–10): {prior_knowledge}
STRENGTHS: {', '.join(strengths) if strengths else 'None identified'}
GAPS TO ADDRESS: {', '.join(gaps) if gaps else 'None identified'}
TECH SKILLS: {', '.join(brief.get('techSkills', [])) or 'None listed'}
INTERESTS: {', '.join(brief.get('interests', [])) or 'None listed'}
STUDY PATTERN: {brief.get('studyHoursPerDay', 'Unknown')} per day, {brief.get('preferredStudyTime', 'any time')}
LEARNING STYLE: {brief.get('learningStyle', 'Not specified')}
BROWSER INSIGHTS: {extension_summary}
---"""

    text = ask_gemini(prompt)
    if not text:
        return fallback

    parsed = extract_json(text, fallback)
    steps = _normalize_roadmap_steps(parsed.get("steps"))
    if not steps:
        return fallback
    return {"steps": steps}


def generate_exam_questions(source_material: Any, profile: Dict[str, Any]) -> Dict[str, Any]:
    """Generate proctored exam questions from source material."""
    fallback = exam_fallback()
    profile_inputs = profile.get("onboardingInputs") or {}
    goal = profile_inputs.get("target_goal") or profile.get("virtualClusterTag") or "general learning"

    prompt = f"""You are U'rWay's exam composer.

Generate 5 challenging but fair exam questions based on the source material and the student's goal.
Questions should test genuine understanding, not just recall.
Mix question types: conceptual, practical application, and scenario-based.

Return STRICT JSON only (no markdown):
{{"questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]}}

---
STUDENT GOAL: {goal}
SOURCE MATERIAL: {json.dumps(source_material, indent=2)}
---"""

    text = ask_gemini(prompt)
    if not text:
        return fallback

    parsed = extract_json(text, fallback)
    if not isinstance(parsed.get("questions"), list) or len(parsed["questions"]) == 0:
        return fallback
    return {"questions": parsed["questions"][:5]}