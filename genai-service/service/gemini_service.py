import json
import os
import re
from typing import Any, Dict, List

from google import genai

from model.response_models import cluster_fallback, exam_fallback, roadmap_fallback


# ── Gemini client ────────────────────────────────────────────────────────────

_GEMINI_CLIENT = None
_GEMINI_CLIENT_API_KEY = None


def _get_models() -> List[str]:
    configured = os.environ.get("GEMINI_MODEL", "").strip()
    candidates = [configured, "gemini-2.0-flash", "gemini-1.5-flash"]
    seen, ordered = set(), []
    for m in candidates:
        if m and m not in seen:
            seen.add(m)
            ordered.append(m)
    return ordered

def ask_openai_compatible(api_url: str, model: str, api_key: str, prompt: str) -> str:
    import urllib.request
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "Urway-Backend/1.0"
    }
    data = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7
    }
    req = urllib.request.Request(api_url, data=json.dumps(data).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        error_body = ""
        if hasattr(e, 'read'):
            error_body = e.read().decode('utf-8')
        print(f"Error calling {api_url} with {model}: {e} - {error_body}")
        return ""

def ask_gemini(prompt: str) -> str:
    global _GEMINI_CLIENT, _GEMINI_CLIENT_API_KEY
    
    # 1. Try Gemini
    gemini_keys = ("GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5", "GEMINI_API_KEY")
    for env_name in gemini_keys:
        api_key = os.environ.get(env_name, "").strip()
        if not api_key: continue
        
        if _GEMINI_CLIENT is None or _GEMINI_CLIENT_API_KEY != api_key:
            _GEMINI_CLIENT = genai.Client(api_key=api_key)
            _GEMINI_CLIENT_API_KEY = api_key
            
        for model_name in _get_models():
            try:
                response = _GEMINI_CLIENT.models.generate_content(model=model_name, contents=prompt)
                text = (response.text or "").strip()
                if text: return text
            except Exception as e:
                print(f"Gemini error with {model_name}: {e}")
                continue

    # 2. Try Groq (User called it Grok, but keys are gsk_)
    groq_keys = ("GROK_API_KEY_1", "GROK_API_KEY_2", "GROK_API_KEY_3", "GROK_API_KEY_4", "GROK_API_KEY")
    for env_name in groq_keys:
        api_key = os.environ.get(env_name, "").strip()
        if not api_key: continue
        for model_name in ("llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"):
            text = ask_openai_compatible("https://api.groq.com/openai/v1/chat/completions", model_name, api_key, prompt)
            if text: return text

    # 3. Try Cerebras
    cerebras_keys = ("CEREBRAS_API_KEY_1", "CEREBRAS_API_KEY_2", "CEREBRAS_API_KEY")
    for env_name in cerebras_keys:
        api_key = os.environ.get(env_name, "").strip()
        if not api_key: continue
        for model_name in ("llama3.3-70b", "llama3.1-8b"):
            text = ask_openai_compatible("https://api.cerebras.ai/v1/chat/completions", model_name, api_key, prompt)
            if text: return text

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

    if any(term in goal_key for term in ["machine learning", "ml", "ai", "deep learning", "nlp", "computer vision"]):
        core_topic = keyword_focus[0] if keyword_focus else goal
        titles = [
            f"Define the {core_topic} learning path",
            "Master the mathematical foundations",
            f"Set up your {core_topic} development environment",
            f"Build your first {core_topic} model from scratch",
            "Evaluate and optimize your model",
            "Develop a real-world project",
            "Document and prepare for deployment",
        ]
        notes = [
            f"Write a learning objective for {goal}. Identify prerequisites, choose a dataset, pick a success metric. Ground this in: {description_snippet}.",
            f"Study the core math ({keyword_text}), Python fundamentals, and libraries (NumPy, Pandas). Address gaps: {', '.join(gaps) if gaps else 'foundational knowledge'}.",
            f"Install Jupyter, set up GPU if available, load your first dataset, and do exploratory analysis. Test your environment with a simple model.",
            f"Implement a baseline {keyword_text} model. Document assumptions, hyperparameters, and what each part does. Compare 2-3 variants.",
            "Run cross-validation, check metrics, plot learning curves, and identify where the model struggles. Tune the most impactful parameters.",
            f"Build a mini-project that solves a real problem using {goal}. Include data preprocessing, model training, evaluation, and basic visualization.",
            f"Write a detailed README, save your model, create a simple demo script. Plan next steps: scaling, production, or exploring a related {keyword_focus[0] if keyword_focus else 'technique'}.",
        ]
    elif any(term in goal_key for term in ["node", "backend", "express", "nestjs", "api", "server", "rest api", "restapi"]):
        core_tech = keyword_focus[0] if keyword_focus else goal
        titles = [
            f"Map the {goal} backend architecture",
            "Set up the server foundation",
            "Design routes and request flow",
            "Implement core API endpoints",
            "Connect data models and validation",
            "Add testing and error handling",
            "Prepare deployment and docs",
        ]
        notes = [
            f"Clarify what the {goal} backend should do, define the folder structure, and identify the main routes. Ground it in {description_snippet}.",
            f"Set up the backend stack: Express, Node.js, environment variables, and project structure. Focus on {keyword_text} as your core stack.",
            "Sketch the request-response flow, middleware, and how APIs should be organized. Keep the architecture simple and maintainable.",
            "Implement the first set of endpoints or services that directly support the target. Test each route with sample requests.",
            f"Connect validation, database access, and any needed business logic. Use {core_tech} where it directly helps the target outcome.",
            "Add logging, error handling, and unit tests. Make sure failures are visible and recoverable.",
            f"Write deployment notes, API examples, and a README. Make the {goal} backend easy to run, explain, and extend.",
        ]
    elif any(term in goal_key for term in ["react", "frontend", "web", "javascript", "full stack", "full-stack", "typescript"]):
        core_tech = keyword_focus[0] if keyword_focus else goal
        titles = [
            f"Map the {core_tech} project architecture",
            "Study core concepts and best practices",
            "Build a static prototype",
            "Add interactivity and state management",
            "Integrate backend APIs",
            "Test and optimize performance",
            "Deploy and polish",
        ]
        notes = [
            f"Design the folder structure, pick your stack ({core_tech}), sketch the UI/UX. Align with {description_snippet}.",
            f"Deep dive into {keyword_text}: components, hooks, routing, state patterns. Study code examples aligned to your cluster ({cluster_tag}).",
            "Build a static version with all pages/screens. Focus on layout, styling, and navigation. No API calls yet.",
            "Add form handling, client-side state, local storage if needed. Make interactions feel smooth and responsive.",
            "Wire up API endpoints, handle loading/error states, implement authentication if applicable. Keep data flow clear and testable.",
            "Run performance audits, optimize bundle size, add unit/integration tests. Refactor any code smells.",
            f"Deploy to a platform (Vercel, Netlify, etc.), set up CI/CD, write deployment notes. Create a portfolio-ready README with screenshots and the {goal} demo link.",
        ]
    elif any(term in goal_key for term in ["architecture", "design", "autocad", "revit", "3d", "sketching", "drawing", "cad", "bim"]):
        core_skill = keyword_focus[0] if keyword_focus else goal
        titles = [
            f"Understand {goal} fundamentals and principles",
            f"Master hand sketching and visualization",
            f"Learn {core_skill} software basics",
            "Apply principles through case studies",
            f"Create your first complete {goal} project",
            "Review, critique, and iterate",
            "Build a portfolio piece",
        ]
        notes = [
            f"Study design principles, composition, and spatial concepts for {goal}. Review projects in your niche ({keyword_text}). Read: {description_snippet}.",
            f"Practice hand sketching: quick ideation, perspective drawing, proportions. Spend 30 mins daily on sketching exercises.",
            f"Get hands-on with {core_skill}: interface tour, basic drawing tools, templates. Follow 2-3 beginner tutorials for {goal}.",
            "Analyze 5–10 professional projects in {goal}. Annotate what works, identify design decisions, understand the process.",
            f"Design a small but complete {goal} solution: concept, sketches, drawings, renderings. Use {keyword_text} tools. Connect to {description_snippet}.",
            "Share your work for peer/mentor feedback. Revise based on critique. Refine details and fix any issues.",
            f"Polish your project, create high-quality renders or presentations, write a case study. This becomes your signature {goal} portfolio piece.",
        ]
    elif any(term in goal_key for term in ["data science", "analytics", "python", "sql", "statistics"]):
        core_tech = keyword_focus[0] if keyword_focus else goal
        titles = [
            f"Build your {goal} foundations",
            "Master data manipulation and analysis",
            "Learn visualization and storytelling",
            "Explore statistical concepts",
            "Build your first data project",
            "Communicate insights effectively",
            "Specialize and scale",
        ]
        notes = [
            f"Learn Python/SQL/R basics, git, and Jupyter. Set up your environment. Ground yourself in {description_snippet}.",
            f"Study {keyword_text}: loading, cleaning, transforming, aggregating data. Use real datasets from Kaggle or your field.",
            "Master visualization tools (matplotlib, Plotly, Tableau). Create plots that tell a story. Practice on 5+ datasets.",
            "Study distributions, hypothesis testing, correlation, regression. Understand *why* before memorizing formulas.",
            f"Develop a 3–5 step data project: question → data → analysis → visualization → insight. Use {core_tech} in every step.",
            "Write a blog post or presentation that explains one key finding. Practice explaining data insights to non-technical audiences.",
            f"Explore a specialization: A/B testing, time-series, NLP, geospatial. Build a mini-capstone in {goal}.",
        ]
    elif any(term in goal_key for term in ["interview", "system design", "competitive programming", "algorithms", "data structures", "coding", "leetcode"]):
        core_topic = keyword_focus[0] if keyword_focus else goal
        titles = [
            f"Assess your {goal} baseline",
            "Master core fundamentals",
            "Practice problem-solving strategies",
            f"Solve {goal} problems systematically",
            "Optimize and refactor",
            "Do mock interviews",
            "Final preparation and confidence",
        ]
        notes = [
            f"Take a baseline assessment: solve 5 easy problems, identify weak areas. Note your pace and confidence level in {description_snippet}.",
            f"Review data structures, algorithms, and complexity analysis. Use {keyword_text} resources. Solve 1 problem daily.",
            "Learn pattern-based approaches: two pointers, sliding window, recursion, etc. Label each problem with its pattern.",
            f"Solve 50–100 medium-level {goal} problems. Aim for clean, efficient code. Time yourself; target 20–30 mins per problem.",
            "Refactor old solutions for clarity and efficiency. Optimize space/time. Practice explaining your approach out loud.",
            "Do 5–10 mock interviews with peers or platforms. Simulate pressure, time limits, and explaining your logic.",
            f"Review your weak areas one more time. Build confidence. Go into interviews calm, prepared, and ready to communicate your {goal} skills.",
        ]
    else:
        # Improved generic fallback
        titles = [
            f"Define your {goal} learning objectives",
            f"Build foundational knowledge in {goal}",
            f"Practice and apply {goal} concepts",
            f"Build a meaningful project with {goal}",
            "Review and strengthen weak areas",
            f"Polish your {goal} output",
            f"Share and get feedback on {goal}",
        ]
        notes = [
            f"Write a clear objective for {goal}. Identify prerequisites and success metrics. Connect to: {description_snippet}.",
            f"Study core concepts and fundamentals of {keyword_text}. Use varied resources: courses, books, tutorials. Aim for 1–2 hours daily.",
            f"Apply what you've learned: solve problems, complete exercises, build small prototypes. Address gaps: {', '.join(gaps) if gaps else 'as you discover them'}.",
            f"Build a project that demonstrates {goal} skills. Keep it scoped and achievable in {weeks} weeks. Make it tangible and shareable.",
            f"Revisit weak areas. Fill knowledge gaps. Refine your project. Use your strengths ({', '.join(strengths) if strengths else 'your abilities'}) to elevate quality.",
            f"Improve presentation: documentation, code quality, visuals. Make your {goal} output portfolio-ready.",
            f"Share your {goal} project with peers or online communities. Get feedback, iterate, and celebrate the milestone.",
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
        print(f"[gemini_service] Gemini returned empty for goal='{goal}', using contextual-fallback")
        return {
            "source": "contextual-fallback",
            "steps": _contextual_roadmap_steps(goal, timeline, cluster_tag, brief, description, extension_summary, keywords, strengths, gaps),
        }

    parsed = extract_json(text, fallback)
    steps = _normalize_roadmap_steps(parsed.get("steps"))
    if not steps:
        print(f"[gemini_service] Could not parse Gemini response for goal='{goal}', using contextual-fallback")
        return {
            "source": "contextual-fallback",
            "steps": _contextual_roadmap_steps(goal, timeline, cluster_tag, brief, description, extension_summary, keywords, strengths, gaps),
        }
    print(f"[gemini_service] Successfully generated {len(steps)} steps via Gemini for goal='{goal}'")
    return {"source": "genai", "steps": steps}


def generate_exam_questions(source_material: Any, profile: Dict[str, Any], target_info: Dict[str, Any] = None) -> Dict[str, Any]:
    """Generate proctored exam questions from source material."""
    fallback = exam_fallback()
    target_info = target_info or {}
    profile_inputs = profile.get("onboardingInputs") or {}
    target_name = target_info.get("targetName", "")
    prior_knowledge = target_info.get("priorKnowledge", 5)
    goal = target_name or profile_inputs.get("target_goal") or profile.get("virtualClusterTag") or "general learning"

    prompt = f"""You are U'rWay's exam composer.

Generate 5 challenging but fair MULTIPLE CHOICE exam questions based on the source material and the student's domain goal.
The student has a prior knowledge level of {prior_knowledge} out of 10 in this domain. Adjust the difficulty accordingly.
Questions should test genuine understanding, not just recall.

Return STRICT JSON only (no markdown). The format must be an array of objects under the "questions" key:
{{
  "questions": [
    {{
      "question": "The question text goes here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }}
  ]
}}
Note: 'correctAnswer' must be the integer index (0-3) of the correct option in the options array.

---
STUDENT GOAL DOMAIN: {goal}
PRIOR KNOWLEDGE: {prior_knowledge}/10
SOURCE MATERIAL: {json.dumps(source_material, indent=2)}
---"""

    text = ask_gemini(prompt)
    if not text:
        print("[gemini_service] ask_gemini returned empty string for exam questions")
        return fallback

    print(f"[gemini_service] text from ask_gemini: {text[:200]}...")

    parsed = extract_json(text, fallback)
    print(f"[gemini_service] parsed JSON: {parsed}")

    if not isinstance(parsed.get("questions"), list) or len(parsed["questions"]) == 0:
        return fallback
    return {"questions": parsed["questions"][:5]}
