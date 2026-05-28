import json
import os
import re
from google import genai
from google.genai import types
from dotenv import load_dotenv

from backend.config import get_settings

# Încărcăm variabilele
load_dotenv()

# Configurare Client (Singleton la nivel de modul)
settings = get_settings()
api_key = settings.gemini_api_key or os.getenv("GOOGLE_API_KEY")
client = None

if api_key:
    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
        print(f"⚠️ Error initializing Gemini Client: {e}")
else:
    print("⚠️ GEMINI_API_KEY/GOOGLE_API_KEY not found. AI features will use fallback responses.")


def _fallback_acceptance_criteria(title: str) -> list[str]:
    clean_title = title.strip() or "the requested capability"
    return [
        f"The team can use {clean_title} from the intended workflow.",
        "Validation, error and empty states are handled clearly.",
        "The implementation respects project permissions and audit expectations.",
        "The change is verified from the relevant user-facing page.",
    ]


def _fallback_subtasks(title: str) -> list[str]:
    clean_title = title.strip() or "feature"
    return [
        f"Clarify requirements for {clean_title}",
        "Design API/data changes",
        "Implement backend behavior",
        "Implement frontend experience",
        "Test happy path and edge cases",
    ]


def _fallback_story_points(title: str, description: str | None = None) -> dict:
    text = f"{title} {description or ''}".lower()
    score = 3

    complexity_keywords = {
        2: ["integration", "webhook", "permission", "audit", "migration", "realtime", "websocket"],
        3: ["ai", "calendar", "report", "export", "dashboard", "workflow"],
        5: ["architecture", "security", "methodology", "transition", "multi-project"],
    }


def _fallback_refined_spec(
    *,
    title: str,
    description: str | None = None,
    priority: str = "MEDIUM",
    context: str = "Software Development",
) -> dict:
    criteria = _fallback_acceptance_criteria(title)
    subtasks = _fallback_subtasks(title)
    user_story = (
        f"As a project member, I want {title.strip() or 'this capability'} "
        f"so that the team can deliver the workflow reliably."
    )
    technical_notes = (
        f"Fallback generated without Gemini context. Priority: {priority}. Context: {context}."
    )
    markdown = (
        f"### User Story\n"
        f"{user_story}\n\n"
        f"### Acceptance Criteria\n"
        + "\n".join(f"- [ ] {item}" for item in criteria)
        + "\n\n### Suggested Subtasks\n"
        + "\n".join(f"- {item}" for item in subtasks)
        + f"\n\n### Technical Notes\n{technical_notes}"
    )
    return {
        "user_story": user_story,
        "acceptance_criteria": criteria,
        "suggested_subtasks": subtasks,
        "technical_notes": technical_notes,
        "markdown": markdown,
        "source": "fallback",
    }


def _fallback_release_notes(
    *,
    sprint_name: str,
    sprint_goal: str | None,
    completed_tasks: list[dict],
    unfinished_tasks: list[dict],
) -> dict:
    highlights = [
        f"{task.get('key')}: {task.get('title')}"
        for task in completed_tasks[:8]
    ] or ["No completed tasks were recorded for this sprint."]
    known_issues = [
        f"{task.get('key')}: {task.get('title')}"
        for task in unfinished_tasks[:5]
    ]
    markdown = (
        f"## Release Notes - {sprint_name}\n\n"
        f"### Sprint Goal\n{sprint_goal or 'No sprint goal was set.'}\n\n"
        f"### Delivered\n"
        + "\n".join(f"- {item}" for item in highlights)
        + "\n\n### Follow-up\n"
        + ("\n".join(f"- {item}" for item in known_issues) if known_issues else "- No unfinished follow-up items.")
        + "\n\n### Notes\nGenerated with local fallback. Configure GEMINI_API_KEY for richer release notes."
    )
    return {
        "summary": f"{len(completed_tasks)} tasks completed in {sprint_name}.",
        "highlights": highlights,
        "known_issues": known_issues,
        "markdown": markdown,
        "source": "fallback",
    }

    for weight, keywords in complexity_keywords.items():
        if any(keyword in text for keyword in keywords):
            score += weight

    if len(text) > 700:
        score += 2

    if score <= 3:
        points = 3
    elif score <= 6:
        points = 5
    elif score <= 9:
        points = 8
    else:
        points = 13

    return {
        "story_points": points,
        "confidence": 72,
        "reasoning": (
            "Fallback estimate based on scope keywords, expected integration surface "
            "and description size. Configure GEMINI_API_KEY for contextual AI estimation."
        ),
        "risk_factors": [
            "Confirm edge cases before sprint commitment.",
            "Review permissions and audit impact if this touches shared workflows.",
        ],
    }


def _extract_json_object(value: str) -> dict:
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", value, flags=re.DOTALL)
    if not match:
        raise ValueError("AI response did not contain a JSON object.")

    return json.loads(match.group(0))

def generate_task_metadata(title: str, priority: str, context: str = "Software Development") -> str:
    """
    Serviciu care apelează Gemini pentru a genera descrierea task-ului.
    """
    if not client:
        refined = refine_task_spec(title=title, description="", priority=priority, context=context)
        return refined["markdown"]

    prompt = f"""
    Role: Senior Technical Product Manager.
    Task: Write a concise task description for: "{title}".
    Priority: {priority}.
    Context: {context}.

    Output format (Markdown):
    ### User Story
    (As a... I want... So that...)

    ### Acceptance Criteria
    - [ ] Criteria 1
    - [ ] Criteria 2
    - [ ] Criteria 3

    ### Technical Notes
    (One brief sentence implementation hint)
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
            )
        )
        
        return response.text if response.text else "AI generated empty response."
        
    except Exception as e:
        print(f"AI Service Error: {e}")
        raise e


def refine_task_spec(
    *,
    title: str,
    description: str | None = None,
    priority: str = "MEDIUM",
    context: str = "Software Development",
) -> dict:
    if not client:
        return _fallback_refined_spec(
            title=title,
            description=description,
            priority=priority,
            context=context,
        )

    prompt = f"""
    Role: Senior Agile Business Analyst and Technical Product Manager.
    Refine this work item into structured delivery-ready requirements.

    Context: {context}
    Title: {title}
    Priority: {priority}
    Existing description: {description or "None"}

    Return ONLY valid JSON with this schema:
    {{
      "user_story": "As a ... I want ... so that ...",
      "acceptance_criteria": ["criterion 1", "criterion 2", "criterion 3"],
      "suggested_subtasks": ["subtask 1", "subtask 2", "subtask 3"],
      "technical_notes": "short implementation note"
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.25),
        )
        parsed = _extract_json_object(response.text or "{}")
        criteria = [str(item) for item in parsed.get("acceptance_criteria", [])][:8]
        subtasks = [str(item) for item in parsed.get("suggested_subtasks", [])][:8]
        user_story = str(parsed.get("user_story") or "")
        technical_notes = str(parsed.get("technical_notes") or "")

        markdown = (
            f"### User Story\n{user_story}\n\n"
            f"### Acceptance Criteria\n"
            + "\n".join(f"- [ ] {item}" for item in criteria)
            + "\n\n### Suggested Subtasks\n"
            + "\n".join(f"- {item}" for item in subtasks)
            + f"\n\n### Technical Notes\n{technical_notes}"
        )

        return {
            "user_story": user_story,
            "acceptance_criteria": criteria,
            "suggested_subtasks": subtasks,
            "technical_notes": technical_notes,
            "markdown": markdown,
            "source": "gemini",
        }
    except Exception as exc:
        print(f"AI Spec Refiner Error: {exc}")
        fallback = _fallback_refined_spec(
            title=title,
            description=description,
            priority=priority,
            context=context,
        )
        fallback["source"] = "fallback_after_error"
        return fallback


def estimate_story_points(
    *,
    title: str,
    description: str | None = None,
    priority: str = "MEDIUM",
    context: str = "Software Development",
) -> dict:
    if not client:
        return _fallback_story_points(title, description)

    prompt = f"""
    Role: Senior Scrum estimator.
    Estimate story points using a Fibonacci-like scale: 1, 2, 3, 5, 8, 13, 21.

    Context: {context}
    Title: {title}
    Priority: {priority}
    Description: {description or "None"}

    Return ONLY valid JSON:
    {{
      "story_points": 5,
      "confidence": 80,
      "reasoning": "short explanation",
      "risk_factors": ["risk 1", "risk 2"]
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        parsed = _extract_json_object(response.text or "{}")
        points = int(parsed.get("story_points") or 3)
        allowed = [1, 2, 3, 5, 8, 13, 21]
        points = min(allowed, key=lambda value: abs(value - points))

        return {
            "story_points": points,
            "confidence": max(0, min(100, int(parsed.get("confidence") or 70))),
            "reasoning": str(parsed.get("reasoning") or "Estimated from task scope and implementation risk."),
            "risk_factors": [str(item) for item in parsed.get("risk_factors", [])][:5],
            "source": "gemini",
        }
    except Exception as exc:
        print(f"AI Estimator Error: {exc}")
        fallback = _fallback_story_points(title, description)
        fallback["source"] = "fallback_after_error"
        return fallback


def generate_release_notes(
    *,
    sprint_name: str,
    sprint_goal: str | None,
    completed_tasks: list[dict],
    unfinished_tasks: list[dict],
    context: str = "Software Development",
) -> dict:
    if not client:
        return _fallback_release_notes(
            sprint_name=sprint_name,
            sprint_goal=sprint_goal,
            completed_tasks=completed_tasks,
            unfinished_tasks=unfinished_tasks,
        )

    prompt = f"""
    Role: Product release manager.
    Generate concise release notes for a software sprint.

    Context: {context}
    Sprint: {sprint_name}
    Sprint goal: {sprint_goal or "No sprint goal set"}
    Completed tasks JSON: {json.dumps(completed_tasks, default=str)}
    Unfinished tasks JSON: {json.dumps(unfinished_tasks, default=str)}

    Return ONLY valid JSON:
    {{
      "summary": "short executive summary",
      "highlights": ["delivered item 1", "delivered item 2"],
      "known_issues": ["follow-up item 1"],
      "markdown": "full markdown release notes"
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.3),
        )
        parsed = _extract_json_object(response.text or "{}")
        return {
            "summary": str(parsed.get("summary") or ""),
            "highlights": [str(item) for item in parsed.get("highlights", [])][:10],
            "known_issues": [str(item) for item in parsed.get("known_issues", [])][:10],
            "markdown": str(parsed.get("markdown") or ""),
            "source": "gemini",
        }
    except Exception as exc:
        print(f"AI Release Notes Error: {exc}")
        fallback = _fallback_release_notes(
            sprint_name=sprint_name,
            sprint_goal=sprint_goal,
            completed_tasks=completed_tasks,
            unfinished_tasks=unfinished_tasks,
        )
        fallback["source"] = "fallback_after_error"
        return fallback
