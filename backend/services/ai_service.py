import json
import os
import re
import httpx
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


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini"


def _build_client(selected_api_key: str | None = None):
    if selected_api_key:
        try:
            return genai.Client(api_key=selected_api_key)
        except Exception as exc:
            print(f"⚠️ Error initializing project Gemini Client: {exc}")
            return None

    return client


def _normalize_openai_base_url(value: str | None) -> str:
    base_url = (value or "https://api.openai.com/v1").strip().rstrip("/")
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"


def _provider_source(ai_config: dict | None) -> str:
    if not ai_config:
        return "gemini"
    provider = ai_config.get("provider", "GEMINI").lower()
    provider_name = ai_config.get("provider_name") or provider
    return f"project_{provider}:{provider_name}"


def _generate_text(
    prompt: str,
    *,
    ai_config: dict | None = None,
    temperature: float = 0.25,
) -> str:
    provider = (ai_config or {}).get("provider", "GEMINI")
    selected_api_key = (ai_config or {}).get("api_key")
    model = (ai_config or {}).get("model")

    if provider == "OPENAI_COMPATIBLE":
        if not selected_api_key:
            raise ValueError("Project AI key is missing.")

        response = httpx.post(
            _normalize_openai_base_url((ai_config or {}).get("base_url")),
            headers={
                "Authorization": f"Bearer {selected_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model or DEFAULT_OPENAI_COMPATIBLE_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a concise senior software delivery assistant.",
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": temperature,
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        return str(payload["choices"][0]["message"]["content"])

    active_client = _build_client(selected_api_key)
    if not active_client:
        raise ValueError("AI client is not configured.")

    response = active_client.models.generate_content(
        model=model or DEFAULT_GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=temperature),
    )
    return response.text or ""


def resolve_project_ai_config(project) -> dict | None:
    if not project or getattr(project, "ai_provider_mode", "PLATFORM") != "PROJECT":
        return None

    from backend.utils.secret_crypto import decrypt_secret

    return {
        "provider": getattr(project, "ai_provider", None) or "GEMINI",
        "provider_name": getattr(project, "ai_provider_name", None) or getattr(project, "ai_provider", None) or "Gemini",
        "api_key": decrypt_secret(getattr(project, "ai_api_key_encrypted", None)) or "__INVALID_PROJECT_AI_KEY__",
        "base_url": getattr(project, "ai_base_url", None),
        "model": getattr(project, "ai_model", None),
    }


def resolve_project_ai_api_key(project) -> str | None:
    config = resolve_project_ai_config(project)
    return config.get("api_key") if config else None


def test_ai_provider(
    *,
    provider: str,
    api_key: str,
    base_url: str | None = None,
    model: str | None = None,
) -> bool:
    text = _generate_text(
        "Return the exact text: SDLC_HUB_AI_KEY_OK",
        ai_config={
            "provider": provider,
            "api_key": api_key,
            "base_url": base_url,
            "model": model,
            "provider_name": provider,
        },
        temperature=0,
    )
    return "SDLC_HUB_AI_KEY_OK" in text


def test_ai_api_key(api_key: str) -> bool:
    return test_ai_provider(provider="GEMINI", api_key=api_key)


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
        f"Planning: clarify scope and constraints for {clean_title}",
        "Analysis: confirm data, permissions and edge cases",
        "Design: define API/UI changes and acceptance flow",
        "Implementation: build backend and frontend behavior",
        "Integration: connect workflow with existing project modules",
        "Testing: verify happy path, errors and role-based access",
    ]


def _fallback_story_points(title: str, description: str | None = None) -> dict:
    text = f"{title} {description or ''}".lower()
    score = 3

    complexity_keywords = {
        2: ["integration", "webhook", "permission", "audit", "migration", "realtime", "websocket"],
        3: ["ai", "calendar", "report", "export", "dashboard", "workflow"],
        5: ["architecture", "security", "methodology", "transition", "multi-project"],
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
            "and description size. Configure a platform or project AI provider for contextual estimation."
        ),
        "risk_factors": [
            "Confirm edge cases before sprint commitment.",
            "Review permissions and audit impact if this touches shared workflows.",
        ],
        "source": "fallback",
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
        + "\n\n### Notes\nGenerated with local fallback. Configure a platform or project AI provider for richer release notes."
    )
    return {
        "summary": f"{len(completed_tasks)} tasks completed in {sprint_name}.",
        "highlights": highlights,
        "known_issues": known_issues,
        "markdown": markdown,
        "source": "fallback",
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

def generate_task_metadata(
    title: str,
    priority: str,
    context: str = "Software Development",
    api_key: str | None = None,
    ai_config: dict | None = None,
) -> str:
    """
    Serviciu care apelează Gemini pentru a genera descrierea task-ului.
    """
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
        return _generate_text(
            prompt,
            ai_config=ai_config or ({"provider": "GEMINI", "api_key": api_key} if api_key else None),
            temperature=0.3,
        ) or "AI generated empty response."
        
    except Exception as e:
        print(f"AI Service Error: {e}")
        refined = refine_task_spec(
            title=title,
            description="",
            priority=priority,
            context=context,
            ai_config=ai_config,
        )
        return refined["markdown"]


def refine_task_spec(
    *,
    title: str,
    description: str | None = None,
    priority: str = "MEDIUM",
    context: str = "Software Development",
    api_key: str | None = None,
    ai_config: dict | None = None,
) -> dict:
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
        text = _generate_text(
            prompt,
            ai_config=ai_config or ({"provider": "GEMINI", "api_key": api_key} if api_key else None),
            temperature=0.25,
        )
        parsed = _extract_json_object(text or "{}")
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
            "source": _provider_source(ai_config),
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
        fallback["error"] = str(exc)
        return fallback


def estimate_story_points(
    *,
    title: str,
    description: str | None = None,
    priority: str = "MEDIUM",
    context: str = "Software Development",
    api_key: str | None = None,
    ai_config: dict | None = None,
) -> dict:
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
        text = _generate_text(
            prompt,
            ai_config=ai_config or ({"provider": "GEMINI", "api_key": api_key} if api_key else None),
            temperature=0.2,
        )
        parsed = _extract_json_object(text or "{}")
        points = int(parsed.get("story_points") or 3)
        allowed = [1, 2, 3, 5, 8, 13, 21]
        points = min(allowed, key=lambda value: abs(value - points))

        return {
            "story_points": points,
            "confidence": max(0, min(100, int(parsed.get("confidence") or 70))),
            "reasoning": str(parsed.get("reasoning") or "Estimated from task scope and implementation risk."),
            "risk_factors": [str(item) for item in parsed.get("risk_factors", [])][:5],
            "source": _provider_source(ai_config),
        }
    except Exception as exc:
        print(f"AI Estimator Error: {exc}")
        fallback = _fallback_story_points(title, description)
        fallback["source"] = "fallback_after_error"
        fallback["error"] = str(exc)
        return fallback


def generate_release_notes(
    *,
    sprint_name: str,
    sprint_goal: str | None,
    completed_tasks: list[dict],
    unfinished_tasks: list[dict],
    context: str = "Software Development",
    api_key: str | None = None,
    ai_config: dict | None = None,
) -> dict:
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
        text = _generate_text(
            prompt,
            ai_config=ai_config or ({"provider": "GEMINI", "api_key": api_key} if api_key else None),
            temperature=0.3,
        )
        parsed = _extract_json_object(text or "{}")
        return {
            "summary": str(parsed.get("summary") or ""),
            "highlights": [str(item) for item in parsed.get("highlights", [])][:10],
            "known_issues": [str(item) for item in parsed.get("known_issues", [])][:10],
            "markdown": str(parsed.get("markdown") or ""),
            "source": _provider_source(ai_config),
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
        fallback["error"] = str(exc)
        return fallback
