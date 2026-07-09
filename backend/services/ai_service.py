import json
import re
from functools import lru_cache
from pathlib import Path

import httpx

from backend.config import get_settings

settings = get_settings()

# Platform AI is local-first. It points to the Ollama server reachable over Tailscale
# so the same project can run from the desktop or laptop without changing code.
DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini"
DEFAULT_OLLAMA_MODEL = settings.local_ai_model or "qwen2.5-coder:7b"
DEFAULT_OLLAMA_BASE_URL = settings.local_ai_base_url or "http://100.121.227.11:11434"
DEFAULT_OLLAMA_PROVIDER_NAME = settings.local_ai_provider_name or "Qwen local (Ollama)"
DEFAULT_OLLAMA_AUTO_DETECT = settings.local_ai_auto_detect
DEFAULT_OLLAMA_CONNECT_TIMEOUT = settings.local_ai_connect_timeout_seconds or 5
DEFAULT_OLLAMA_READ_TIMEOUT = settings.local_ai_read_timeout_seconds or 120


class AIProviderError(RuntimeError):
    pass


class AIProviderConnectionError(AIProviderError):
    pass


def platform_ai_config() -> dict:
    return {
        "provider": "OLLAMA",
        "provider_name": DEFAULT_OLLAMA_PROVIDER_NAME,
        "base_url": DEFAULT_OLLAMA_BASE_URL,
        "model": DEFAULT_OLLAMA_MODEL,
        "api_key": None,
    }


def _normalize_openai_base_url(value: str | None) -> str:
    base_url = (value or "https://api.openai.com/v1").strip().rstrip("/")
    if base_url.endswith("/chat/completions"):
        return base_url
    return f"{base_url}/chat/completions"


def _normalize_ollama_base_url(value: str | None) -> str:
    base_url = (value or DEFAULT_OLLAMA_BASE_URL).strip().rstrip("/")
    if base_url.endswith("/api/generate"):
        return base_url.removesuffix("/api/generate")
    if base_url.endswith("/api"):
        return base_url.removesuffix("/api")
    return base_url


def _normalize_ollama_generate_url(value: str | None) -> str:
    return f"{_normalize_ollama_base_url(value)}/api/generate"


def _normalize_ollama_tags_url(value: str | None) -> str:
    return f"{_normalize_ollama_base_url(value)}/api/tags"


def _is_wsl() -> bool:
    try:
        return "microsoft" in Path("/proc/sys/kernel/osrelease").read_text().lower()
    except OSError:
        return False


def _wsl_windows_host_base_url() -> str | None:
    try:
        resolv_conf = Path("/etc/resolv.conf").read_text()
    except OSError:
        return None

    match = re.search(r"^nameserver\s+(\S+)", resolv_conf, flags=re.MULTILINE)
    if not match:
        return None

    return f"http://{match.group(1)}:11434"


def _ollama_candidate_base_urls(value: str | None) -> list[str]:
    configured = (value or DEFAULT_OLLAMA_BASE_URL or "").strip()
    candidates: list[str] = []

    # In WSL, Ollama installed on Windows is usually reachable through the Windows
    # host gateway from /etc/resolv.conf, not through 127.0.0.1 inside Linux.
    if DEFAULT_OLLAMA_AUTO_DETECT and _is_wsl():
        windows_host_url = _wsl_windows_host_base_url()
        if windows_host_url:
            candidates.append(windows_host_url)

    if configured and configured.lower() not in {"auto", "ollama"}:
        candidates.append(configured)

    if DEFAULT_OLLAMA_AUTO_DETECT:
        candidates.extend([
            "http://127.0.0.1:11434",
            "http://localhost:11434",
            "http://100.121.227.11:11434",
        ])

    normalized: list[str] = []
    for candidate in candidates:
        base_url = _normalize_ollama_base_url(candidate)
        if base_url not in normalized:
            normalized.append(base_url)

    return normalized or [_normalize_ollama_base_url(configured or DEFAULT_OLLAMA_BASE_URL)]


def _ollama_timeout(*, read_timeout: float | None = None) -> httpx.Timeout:
    return httpx.Timeout(
        connect=DEFAULT_OLLAMA_CONNECT_TIMEOUT,
        read=read_timeout or DEFAULT_OLLAMA_READ_TIMEOUT,
        write=10,
        pool=10,
    )


def _friendly_provider_error(provider: str, url: str, exc: httpx.RequestError) -> AIProviderConnectionError:
    if isinstance(exc, httpx.ConnectTimeout):
        message = (
            f"{provider} is not reachable at {url}. Connection timed out. "
            "Check that Ollama is running, Tailscale is connected, port 11434 is allowed, "
            "and Ollama is listening on the Tailscale interface with OLLAMA_HOST=0.0.0.0:11434."
        )
    elif isinstance(exc, httpx.ReadTimeout):
        message = (
            f"{provider} accepted the connection at {url}, but generation timed out. "
            "The model may still be loading or the machine may be overloaded."
        )
    else:
        message = f"{provider} request failed at {url}: {exc}"

    return AIProviderConnectionError(message)


def _raise_for_provider_status(provider: str, response: httpx.Response) -> None:
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = response.text.strip()[:300] or response.reason_phrase
        raise AIProviderError(
            f"{provider} returned HTTP {response.status_code}: {detail}"
        ) from exc


def _ollama_model_names(payload: dict) -> list[str]:
    models = payload.get("models", [])
    if not isinstance(models, list):
        return []

    names = []
    for item in models:
        if isinstance(item, dict) and item.get("name"):
            names.append(str(item["name"]))
    return names


@lru_cache(maxsize=16)
def _select_ollama_base_url(base_url: str | None, model: str | None) -> str:
    errors: list[str] = []
    selected_model = model or DEFAULT_OLLAMA_MODEL

    for candidate in _ollama_candidate_base_urls(base_url):
        tags_url = _normalize_ollama_tags_url(candidate)
        try:
            response = httpx.get(tags_url, timeout=_ollama_timeout(read_timeout=10))
            _raise_for_provider_status("Ollama", response)
        except httpx.RequestError as exc:
            errors.append(str(_friendly_provider_error("Ollama", tags_url, exc)))
            continue
        except AIProviderError as exc:
            errors.append(str(exc))
            continue

        available_models = _ollama_model_names(response.json())
        if selected_model and selected_model not in available_models:
            visible = ", ".join(available_models[:8]) or "no models returned"
            raise AIProviderError(
                f"Ollama is reachable at {candidate}, but model '{selected_model}' is not installed. "
                f"Available models: {visible}."
            )

        return candidate

    diagnostic = " | ".join(errors[:4]) or "No Ollama candidates were tested."
    raise AIProviderConnectionError(
        "Ollama is not reachable from WSL. "
        f"Tested: {', '.join(_ollama_candidate_base_urls(base_url))}. "
        f"Details: {diagnostic}"
    )


def _provider_source(ai_config: dict | None) -> str:
    if not ai_config:
        return f"platform_ollama:{DEFAULT_OLLAMA_PROVIDER_NAME}"
    provider = ai_config.get("provider", "OLLAMA").lower()
    provider_name = ai_config.get("provider_name") or provider
    return f"project_{provider}:{provider_name}"


def _generate_text(
    prompt: str,
    *,
    ai_config: dict | None = None,
    temperature: float = 0.25,
) -> str:
    active_config = ai_config or platform_ai_config()
    provider = str(active_config.get("provider", "OLLAMA")).upper()
    selected_api_key = active_config.get("api_key")
    model = active_config.get("model")

    if provider == "OPENAI_COMPATIBLE":
        # Custom hosted providers need a project-owned key. The encrypted value is
        # decrypted only on the backend and is never sent back to the browser.
        if not selected_api_key:
            raise ValueError("Project AI key is missing.")

        url = _normalize_openai_base_url(active_config.get("base_url"))
        try:
            response = httpx.post(
                url,
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
            _raise_for_provider_status("OpenAI-compatible provider", response)
        except httpx.RequestError as exc:
            raise _friendly_provider_error("OpenAI-compatible provider", url, exc) from exc

        payload = response.json()
        return str(payload["choices"][0]["message"]["content"])

    if provider == "OLLAMA":
        # Ollama does not need an API key, so project-owned local providers can be
        # configured with only base_url + model.
        selected_base_url = _select_ollama_base_url(active_config.get("base_url"), model)
        url = _normalize_ollama_generate_url(selected_base_url)
        try:
            response = httpx.post(
                url,
                json={
                    "model": model or DEFAULT_OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": temperature},
                },
                timeout=_ollama_timeout(),
            )
            _raise_for_provider_status("Ollama", response)
        except httpx.RequestError as exc:
            raise _friendly_provider_error("Ollama", url, exc) from exc

        payload = response.json()
        return str(payload.get("response") or "")

    raise ValueError(f"Unsupported AI provider: {provider}")


def resolve_project_ai_config(project) -> dict | None:
    """Return project-owned AI settings or None when the platform Ollama config should be used."""
    if not project or getattr(project, "ai_provider_mode", "PLATFORM") != "PROJECT":
        return None

    from backend.utils.secret_crypto import decrypt_secret

    return {
        "provider": getattr(project, "ai_provider", None) or "OLLAMA",
        "provider_name": getattr(project, "ai_provider_name", None) or getattr(project, "ai_provider", None) or DEFAULT_OLLAMA_PROVIDER_NAME,
        "api_key": decrypt_secret(getattr(project, "ai_api_key_encrypted", None))
        or (
            None
            if (getattr(project, "ai_provider", None) or "OLLAMA").upper() == "OLLAMA"
            else "__INVALID_PROJECT_AI_KEY__"
        ),
        "base_url": getattr(project, "ai_base_url", None),
        "model": getattr(project, "ai_model", None),
    }


def resolve_project_ai_api_key(project) -> str | None:
    config = resolve_project_ai_config(project)
    return config.get("api_key") if config else None


def test_ai_provider(
    *,
    provider: str,
    api_key: str | None = None,
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
    return test_ai_provider(provider="OPENAI_COMPATIBLE", api_key=api_key)


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

    # Offline scoring keeps the product usable when the local model is down,
    # but it intentionally stays conservative and explainable.
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
        f"Fallback generated without local AI context. Priority: {priority}. Context: {context}."
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


def _fallback_comment_risk_analysis(comment_body: str) -> dict:
    text = (comment_body or "").lower()
    high_keywords = [
        "blocked",
        "blocker",
        "blocking",
        "can't continue",
        "cannot continue",
        "production",
        "critical",
        "urgent",
        "blocaj",
        "blocat",
        "nu pot continua",
        "urgent",
    ]
    medium_keywords = [
        "stuck",
        "waiting",
        "dependency",
        "problem",
        "issue",
        "fails",
        "failing",
        "broken",
        "delay",
        "risk",
        "astept",
        "dependinta",
        "eroare",
        "nu merge",
        "intarziere",
    ]

    matched_high = [keyword for keyword in high_keywords if keyword in text]
    matched_medium = [keyword for keyword in medium_keywords if keyword in text]
    matched = matched_high or matched_medium

    if not matched:
        return {
            "risk_detected": False,
            "severity": "low",
            "category": "NONE",
            "summary": "No blocker or delivery risk signal was detected in this comment.",
            "recommended_action": "No action required.",
            "confidence": 70,
            "source": "fallback",
        }

    severity = "high" if matched_high else "medium"
    category = "BLOCKER" if matched_high else "RISK"
    excerpt = " ".join((comment_body or "").split())[:180]

    return {
        "risk_detected": True,
        "severity": severity,
        "category": category,
        "summary": f"Comment contains possible {category.lower()} signal: {excerpt}",
        "recommended_action": "Review the task owner, dependency and next action in the current workflow.",
        "confidence": 78 if severity == "high" else 68,
        "source": "fallback",
        "matched_keywords": matched[:5],
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
    """Generate a task description using the configured local or project AI provider."""
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
            ai_config=ai_config or ({"provider": "OPENAI_COMPATIBLE", "api_key": api_key} if api_key else None),
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
            ai_config=ai_config or ({"provider": "OPENAI_COMPATIBLE", "api_key": api_key} if api_key else None),
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
            ai_config=ai_config or ({"provider": "OPENAI_COMPATIBLE", "api_key": api_key} if api_key else None),
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


def analyze_comment_risk(
    *,
    task_title: str,
    task_key: str | None,
    task_status: str,
    task_priority: str,
    comment_body: str,
    context: str = "Software Development",
    ai_config: dict | None = None,
) -> dict:
    prompt = f"""
    Role: Senior delivery risk analyst.
    Analyze this task comment and detect whether it signals a blocker, bottleneck, dependency, scope risk,
    quality risk or delivery risk.

    Context: {context}
    Task: {task_key or "Task"} - {task_title}
    Status: {task_status}
    Priority: {task_priority}
    Comment: {comment_body}

    Return ONLY valid JSON:
    {{
      "risk_detected": true,
      "severity": "low | medium | high",
      "category": "BLOCKER | BOTTLENECK | DEPENDENCY | SCOPE | QUALITY | DELIVERY | NONE",
      "summary": "short business-readable explanation",
      "recommended_action": "concrete next action",
      "confidence": 0
    }}
    """

    try:
        text = _generate_text(prompt, ai_config=ai_config, temperature=0.1)
        parsed = _extract_json_object(text or "{}")
        severity = str(parsed.get("severity") or "low").lower()
        if severity not in {"low", "medium", "high"}:
            severity = "low"

        category = str(parsed.get("category") or "NONE").upper()
        if category not in {"BLOCKER", "BOTTLENECK", "DEPENDENCY", "SCOPE", "QUALITY", "DELIVERY", "NONE"}:
            category = "NONE"

        risk_detected = bool(parsed.get("risk_detected")) and category != "NONE"
        return {
            "risk_detected": risk_detected,
            "severity": severity,
            "category": category,
            "summary": str(parsed.get("summary") or "No delivery risk signal was detected."),
            "recommended_action": str(parsed.get("recommended_action") or "No action required."),
            "confidence": max(0, min(100, int(parsed.get("confidence") or 70))),
            "source": _provider_source(ai_config),
        }
    except Exception as exc:
        print(f"AI Comment Risk Error: {exc}")
        fallback = _fallback_comment_risk_analysis(comment_body)
        fallback["source"] = "fallback_after_error"
        fallback["error"] = str(exc)
        return fallback


def enhance_workload_suggestions(
    *,
    workload: dict,
    suggestions: list[dict],
    ai_config: dict | None = None,
) -> dict:
    compact_members = [
        {
            "user_id": member.get("user_id"),
            "name": member.get("full_name") or member.get("email"),
            "role": member.get("role_name"),
            "active_tasks": member.get("active_tasks"),
            "story_points": member.get("story_points"),
            "overdue_tasks": member.get("overdue_tasks"),
            "review_tasks": member.get("review_tasks"),
            "risk_score": member.get("risk_score"),
            "risk_factors": member.get("risk_factors", [])[:5],
        }
        for member in workload.get("members", [])[:12]
    ]
    compact_suggestions = [
        {
            "index": index,
            "type": suggestion.get("type"),
            "severity": suggestion.get("severity"),
            "task_key": suggestion.get("task_key"),
            "task_title": suggestion.get("task_title"),
            "from": suggestion.get("from_name"),
            "to": suggestion.get("to_name"),
            "current_reason": suggestion.get("reason"),
        }
        for index, suggestion in enumerate(suggestions[:8])
    ]

    prompt = f"""
    Role: Senior engineering manager.
    Convert deterministic workload balancing signals into concise, professional explanations.
    Keep the recommended reassignment targets unchanged. Do not invent new tasks or users.

    Project summary JSON:
    {json.dumps(workload.get("summary", {}), default=str)}

    Members JSON:
    {json.dumps(compact_members, default=str)}

    Deterministic suggestions JSON:
    {json.dumps(compact_suggestions, default=str)}

    Return ONLY valid JSON:
    {{
      "summary": "one concise paragraph",
      "suggestions": [
        {{
          "index": 0,
          "severity": "low | medium | high",
          "reason": "clear explanation grounded in the data"
        }}
      ]
    }}
    """

    try:
        text = _generate_text(prompt, ai_config=ai_config, temperature=0.2)
        parsed = _extract_json_object(text or "{}")
        suggestions_by_index = {}
        for item in parsed.get("suggestions", []):
            try:
                index = int(item.get("index"))
            except (TypeError, ValueError):
                continue
            suggestions_by_index[index] = item

        enhanced = []
        for index, suggestion in enumerate(suggestions):
            ai_item = suggestions_by_index.get(index, {})
            severity = str(ai_item.get("severity") or suggestion.get("severity") or "medium").lower()
            if severity not in {"low", "medium", "high"}:
                severity = suggestion.get("severity") or "medium"
            enhanced.append(
                {
                    **suggestion,
                    "severity": severity,
                    "reason": str(ai_item.get("reason") or suggestion.get("reason") or ""),
                }
            )

        return {
            "summary": str(parsed.get("summary") or ""),
            "suggestions": enhanced,
            "source": _provider_source(ai_config),
        }
    except Exception as exc:
        print(f"AI Workload Explanation Error: {exc}")
        return {
            "summary": "",
            "suggestions": suggestions,
            "source": "fallback_after_error",
            "error": str(exc),
        }


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
            ai_config=ai_config or ({"provider": "OPENAI_COMPATIBLE", "api_key": api_key} if api_key else None),
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
