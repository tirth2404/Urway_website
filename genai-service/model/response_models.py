from typing import Any, Dict


def cluster_fallback() -> Dict[str, Any]:
    return {
        "clusterTag": "The Steady Explorer",
        "rationale": "A balanced learner building skills step by step.",
    }


def roadmap_fallback() -> Dict[str, Any]:
    return {
        "steps": [
            {
                "id": "S1",
                "title": "Assess your starting point",
                "status": "in-progress",
                "dueDate": "Day 1–3",
                "notes": "List your current skills, identify gaps, and set a clear daily schedule.",
            },
            {
                "id": "S2",
                "title": "Build the foundation",
                "status": "remaining",
                "dueDate": "Week 1–2",
                "notes": "Cover the core concepts through structured resources or a beginner course.",
            },
            {
                "id": "S3",
                "title": "Hands-on practice",
                "status": "remaining",
                "dueDate": "Week 2–3",
                "notes": "Solve exercises and small challenges daily to reinforce learning.",
            },
            {
                "id": "S4",
                "title": "Build a mini project",
                "status": "remaining",
                "dueDate": "Week 3–5",
                "notes": "Apply what you've learned by building something tangible and shareable.",
            },
            {
                "id": "S5",
                "title": "Review and fill gaps",
                "status": "remaining",
                "dueDate": "Week 5–6",
                "notes": "Revisit weak areas, take mock tests, and document what you've learned.",
            },
            {
                "id": "S6",
                "title": "Final milestone",
                "status": "remaining",
                "dueDate": "Week 7–8",
                "notes": "Present, publish, or submit your work. Reflect on the journey.",
            },
        ]
    }


def exam_fallback() -> Dict[str, Any]:
    return {
        "questions": [
            "Explain the core concept from your study material in your own words.",
            "Describe a real-world scenario where this skill or concept would be applied.",
            "What are the three most common mistakes beginners make in this area, and how would you avoid them?",
            "How would you explain this topic to someone with no prior background?",
            "What is the single most important thing you learned from your source material today?",
        ]
    }