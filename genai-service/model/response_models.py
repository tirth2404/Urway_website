from typing import Any, Dict


def cluster_fallback() -> Dict[str, Any]:
    return {
        "clusterTag": "The Steady Explorer",
        "rationale": "Fallback cluster used because Gemini output was unavailable.",
    }


def roadmap_fallback() -> Dict[str, Any]:
    return {
        "steps": [
            {
                "id": "S1",
                "title": "Foundation sprint",
                "status": "in-progress",
                "dueDate": "Week 1",
                "notes": "Start with core concepts.",
            },
            {
                "id": "S2",
                "title": "Guided practice",
                "status": "remaining",
                "dueDate": "Week 2",
                "notes": "Solve practical exercises daily.",
            },
            {
                "id": "S3",
                "title": "Mini project",
                "status": "remaining",
                "dueDate": "Week 3",
                "notes": "Build and document one project.",
            },
            {
                "id": "S4",
                "title": "Mock review",
                "status": "remaining",
                "dueDate": "Week 4",
                "notes": "Evaluate and close skill gaps.",
            },
        ]
    }


def exam_fallback() -> Dict[str, Any]:
    return {
        "questions": [
            "Explain the core concept from your latest study source in your own words.",
            "Solve a practical scenario related to your target domain.",
            "List three mistakes beginners make and how to avoid them.",
        ]
    }
