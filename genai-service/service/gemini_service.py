import json
import os
import re
from typing import Any, Dict, List

from google import genai

from model.response_models import cluster_fallback, exam_fallback, roadmap_fallback


# ── Gemini client ────────────────────────────────────────────────────────────

_GEMINI_CLIENT = None
_GEMINI_CLIENT_API_KEY = None


def _get_gemini_api_key() -> str:
    direct_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if direct_key:
        return direct_key

    for env_name in ("GEMINI_API_KEY_1", "GEMINI_API_KEY_2"):
        candidate = os.environ.get(env_name, "").strip()
        if candidate:
            return candidate

    return ""

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
    global _GEMINI_CLIENT, _GEMINI_CLIENT_API_KEY
    api_key = _get_gemini_api_key()
    if not api_key:
        return ""
    if _GEMINI_CLIENT is None or _GEMINI_CLIENT_API_KEY != api_key:
        _GEMINI_CLIENT = genai.Client(api_key=api_key)
        _GEMINI_CLIENT_API_KEY = api_key
    for model_name in _get_models():
        try:
            response = _GEMINI_CLIENT.models.generate_content(model=model_name, contents=prompt)
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


def _split_keywords(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        return [part.strip() for part in re.split(r"[,;]", value) if part.strip()]
    return []


def _timeline_weeks(value: Any, default: int = 6) -> int:
    text = str(value or "").lower()
    match = re.search(r"(\d+)", text)
    if match:
        return max(3, min(12, int(match.group(1))))
    return default


def _contextual_roadmap_steps(
    goal: str,
    timeline: Any,
    cluster_tag: str,
    brief: Dict[str, Any],
    description: str,
    extension_summary: str,
    keywords: List[str],
    strengths: List[str],
    gaps: List[str],
) -> List[Dict[str, Any]]:
    weeks = _timeline_weeks(timeline)
    cluster_key = str(cluster_tag or "").strip().lower()
    goal_key = str(goal or "").strip().lower()
    keyword_text = ", ".join(keywords[:4]) if keywords else goal
    description_text = str(description or goal).strip()
    description_snippet = description_text[:180].rstrip()
    keyword_focus = keywords[:3] if keywords else [goal]

    if any(term in goal_key for term in ["machine learning", "ml", "ai"]):
        core_topic = keyword_focus[0] if keyword_focus else goal
        titles = [
            f"Define the {core_topic} learning path",
            "Review the deep learning foundations",
            "Set up your first notebook and dataset",
            "Build a simple neural network baseline",
            "Improve the model with tuning and evaluation",
            "Ship a mini project around your target",
            "Document results and plan the next upgrade",
        ]
        notes = [
            f"Write a one-page objective for {goal}. Choose one notebook, one dataset, and one metric. Start from the exact gap in your description: {description_snippet}.",
            f"Review the minimum math, Python, and neural-network ideas needed for {goal}. Focus on {keyword_text} and the concepts that connect directly to {description_snippet}.",
            f"Set up a reproducible notebook, load a dataset, and do cleaning plus feature inspection. Address gaps like {', '.join(gaps) if gaps else 'none'} while keeping the scope small.",
            "Train one simple baseline neural model first, then compare it to a slightly better version so the learning curve is visible.",
            "Tune the model, check performance, and write a short explanation of what improved and what still feels unclear.",
            f"Build a mini project that proves you can apply {goal} to a real use case. Tie it back to {description_snippet} and the cluster style {cluster_tag}.",
            "Wrap up with a concise README, key learnings, and one next-step idea so the target becomes a portfolio-ready milestone.",
        ]
    elif any(term in goal_key for term in ["react", "frontend", "web", "node", "full stack", "full-stack"]):
        titles = [
            f"Set up the {goal} project foundation",
            "Review the core UI and state concepts",
            "Connect pages, routing, and forms",
            "Build the first feature slice",
            "Add API integration and validation",
            "Polish UX and test the flow",
            "Ship a portfolio-ready version",
        ]
        notes = [
            f"Create the folder structure and map the screens for {goal}. Keep the scope aligned to {cluster_tag} and the target description: {description_snippet}.",
            f"Review components, props, state, forms, and one styling approach. Anchor the study around {keyword_text} rather than generic React notes.",
            "Wire up navigation and form state before adding complexity so the app flow stays easy to debug.",
            "Build one real user feature as small reusable pieces and keep each piece testable.",
            "Connect the frontend to the backend API, handle loading and error states, and keep the data contract explicit.",
            f"Use browser insights and your strengths ({', '.join(strengths) if strengths else 'building step by step'}) to refine the final build.",
            "Finish with a README, screenshots, and deployment notes so the target can be shown to others.",
        ]
    else:
        titles = [
            f"Clarify the {goal} target",
            "Build the core foundation",
            "Practice with guided exercises",
            "Create a first project or case study",
            "Strengthen weak areas",
            "Polish and review",
            "Deliver the final version",
        ]
        notes = [
            f"Break {goal} into weekly milestones that fit {weeks} weeks. Start from the exact description: {description_snippet}.",
            f"Study the basics that match this cluster: {cluster_tag}. Use {keyword_text} as anchor topics instead of generic reading.",
            f"Do active practice every day so learning turns into skill. Narrow the target into one concrete outcome tied to {description_snippet}.",
            f"Build something visible from the new knowledge and make it shareable.",
            f"Review weak areas and use the roadmap to fix gaps like {', '.join(gaps) if gaps else 'none identified'}.",
            "Check quality, consistency, and whether the work matches your timeline.",
            "Finish by shipping the work, documenting the result, and deciding the next target.",
        ]

    due_labels = ["Day 1–3"] + [f"Week {i}" for i in range(1, weeks + 1)]
    step_count = min(len(titles), len(due_labels))
    roadmap_steps = []
    for index in range(step_count):
        due = due_labels[index]
        roadmap_steps.append({
            "id": f"S{index + 1}",
            "title": titles[index],
            "status": "in-progress" if index == 0 else "remaining",
            "dueDate": due,
            "notes": notes[index],
        })
    return roadmap_steps


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
    cluster_rationale = payload.get("clusterRationale") or profile.get("clusterRationale") or ""
    target_summary = payload.get("targetSummary") or {}
    user_profile = payload.get("userProfile") or {}

    raw_keywords = payload.get("keywordsList") or payload.get("keywordsRaw") or target.get("keywordsList") or target.get("keywordsRaw")
    keywords = _split_keywords(raw_keywords)

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

    cluster_playbook = {
        "steady explorer": "Needs consistent small wins, low-friction routines, and confidence-building milestones.",
        "project-driven builders": "Learns best by shipping projects quickly with practical deliverables every week.",
        "connected achievers": "Benefits from collaborative learning, peer accountability, and communication-heavy tasks.",
        "research strategist": "Prefers deep conceptual understanding, structured reading, and analytical breakdowns.",
        "career accelerator": "Needs outcome-focused planning with portfolio, interview, and internship/job preparation tasks.",
    }

    cluster_key = str(cluster_tag).strip().lower()
    cluster_guidance = cluster_playbook.get(
        cluster_key,
        "Adapt roadmap intensity, style, and milestones to the learner profile represented by this cluster.",
    )

    cluster_definitions_block = "\n".join(
        [f"- {k.title()}: {v}" for k, v in cluster_playbook.items()]
    )

    prompt = f"""You are U'rWay's roadmap engine.

Your task is to generate a ROADMAP that is specific to the student, the target, and the learner cluster.

Hard requirements:
- Return STRICT JSON only. No markdown, no commentary, no code fences.
- Generate 6 to 8 steps only.
- Every step must be target-specific. Do not use generic filler like "assess your starting point" unless it is rewritten for this exact target.
- Never copy the student's raw description verbatim into step notes.
- Do not include the full user sentence inside any step note.
- Notes must be concise and practical: 1 to 2 sentences each.
- Due dates must match the timeline and progress logically from early to late weeks.
- First step must be "in-progress". All remaining steps must be "remaining".
- Keep titles action-oriented and specific.
- Mention the exact target in at least 2 steps.
- Mention the learner cluster style in at least 1 step.
- Mention keywords or prerequisite topics when they are relevant.

Output schema:
{{
    "steps": [
        {{
            "id": "S1",
            "title": "Short action title",
            "status": "in-progress",
            "dueDate": "Day 1–3",
            "notes": "1-2 practical sentences"
        }}
    ]
}}

Student and target context:
- Goal: {goal}
- Timeline: {timeline}
- Target name: {target_summary.get('targetName') or goal}
- Target description: {description}
- Prior knowledge (1-10): {prior_knowledge}
- Keywords: {', '.join(keywords) if keywords else 'None provided'}
- Cluster tag: {cluster_tag}
- Cluster rationale: {cluster_rationale or 'Not provided'}
- Cluster guidance: {cluster_guidance}
- Cluster definitions:
{cluster_definitions_block}

Learner profile:
- Name: {user_profile.get('name') or brief.get('name') or 'Unknown'}
- Age: {user_profile.get('age') or brief.get('age') or 'Unknown'}
- Learning style: {brief.get('learningStyle', 'Not specified')}
- Study pattern: {brief.get('studyHoursPerDay', 'Unknown')} per day, {brief.get('preferredStudyTime', 'any time')}
- Strengths: {', '.join(strengths) if strengths else 'None identified'}
- Gaps to address: {', '.join(gaps) if gaps else 'None identified'}
- Tech skills: {', '.join(brief.get('techSkills', [])) or 'None listed'}
- Interests: {', '.join(brief.get('interests', [])) or 'None listed'}
- Browser insights: {extension_summary}

Roadmap design strategy:
1. Start with a small, low-friction first step that reduces uncertainty.
2. Build the conceptual foundation next.
3. Add targeted practice and one visible deliverable early.
4. Include a refinement step that addresses gaps and strengthens confidence.
5. End with a concrete output, review, or portfolio-ready result.

Keep the roadmap concrete, varied, and aligned with the student's current level. Avoid repeating the same phrasing across steps.
"""

    text = ask_gemini(prompt)
    if not text:
        return {
            "source": "contextual-fallback",
            "steps": _contextual_roadmap_steps(goal, timeline, cluster_tag, brief, description, extension_summary, keywords, strengths, gaps),
        }

    parsed = extract_json(text, fallback)
    steps = _normalize_roadmap_steps(parsed.get("steps"))
    if not steps:
        return {
            "source": "contextual-fallback",
            "steps": _contextual_roadmap_steps(goal, timeline, cluster_tag, brief, description, extension_summary, keywords, strengths, gaps),
        }
    return {"source": "genai", "steps": steps}


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
