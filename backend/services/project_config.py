import json


# These permission dictionaries are the canonical backend source used by project creation,
# role editing and per-methodology permission normalization.
PROJECT_ADMIN_PERMISSIONS = {
    "PROJECT_UPDATE": True,
    "PROJECT_DELETE": True,
    "MEMBER_INVITE": True,
    "MEMBER_REMOVE": True,
    "ROLE_MANAGE": True,
    "TEAM_MANAGE": True,
    "TASK_CREATE": True,
    "TASK_UPDATE": True,
    "TASK_DELETE": True,
    "TASK_ASSIGN": True,
    "TASK_MOVE": True,
    "SPRINT_CREATE": True,
    "SPRINT_UPDATE": True,
    "SPRINT_START": True,
    "SPRINT_CLOSE": True,
    "SPRINT_DELETE": True,
    "AI_USE": True,
    "REPORT_VIEW": True,
    "SETTINGS_MANAGE": True,
    "CALENDAR_CREATE": True,
    "CALENDAR_UPDATE": True,
    "CALENDAR_DELETE": True,
}


DEFAULT_ROLE_PERMISSIONS = {
    "TASK_CREATE": True,
    "TASK_UPDATE": True,
    "TASK_ASSIGN": True,
    "TASK_COMMENT": True,
    "TASK_MOVE": True,
    "TEAM_MANAGE": False,
    "SPRINT_CREATE": False,
    "SPRINT_UPDATE": False,
    "SPRINT_START": False,
    "SPRINT_CLOSE": False,
    "SPRINT_DELETE": False,
    "AI_USE": True,
    "REPORT_VIEW": True,
    "CALENDAR_CREATE": True,
    "CALENDAR_UPDATE": False,
    "CALENDAR_DELETE": False,
}


# Scrum-only controls are forcibly disabled for Kanban projects even if a role payload
# accidentally sends them as true.
SPRINT_PERMISSION_KEYS = {
    "SPRINT_CREATE",
    "SPRINT_UPDATE",
    "SPRINT_START",
    "SPRINT_CLOSE",
    "SPRINT_DELETE",
}


# Workflow config is stored as JSON on the project so each project can rename columns,
# hide lanes and tune WIP limits without schema changes.
DEFAULT_WORKFLOW_CONFIG = {
    "wip_limits": {
        "TODO": None,
        "IN_PROGRESS": 3,
        "REVIEW": 2,
        "DONE": None,
    },
    "columns": [
        {"key": "TODO", "label": "To Do", "enabled": True, "order": 0, "color": "bg-slate-500"},
        {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
        {"key": "REVIEW", "label": "Code Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
        {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
    ],
}


METHODOLOGY_WORKFLOW_PRESETS = {
    "SCRUM": {
        "wip_limits": {
            "TODO": None,
            "IN_PROGRESS": None,
            "REVIEW": None,
            "DONE": None,
        },
        "columns": [
            {"key": "TODO", "label": "Sprint To Do", "enabled": True, "order": 0, "color": "bg-slate-500"},
            {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
            {"key": "REVIEW", "label": "Sprint Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
            {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
        ],
    },
    "KANBAN": {
        "wip_limits": {
            "TODO": None,
            "IN_PROGRESS": 5,
            "REVIEW": 3,
            "DONE": None,
        },
        "columns": [
            {"key": "TODO", "label": "Intake", "enabled": True, "order": 0, "color": "bg-slate-500"},
            {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
            {"key": "REVIEW", "label": "Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
            {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
        ],
    },
    "SCRUMBAN": {
        "wip_limits": {
            "TODO": None,
            "IN_PROGRESS": 4,
            "REVIEW": 2,
            "DONE": None,
        },
        "columns": [
            {"key": "TODO", "label": "Ready", "enabled": True, "order": 0, "color": "bg-slate-500"},
            {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
            {"key": "REVIEW", "label": "Code Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
            {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
        ],
    },
}


def parse_permissions(raw_permissions: str | None) -> dict:
    if not raw_permissions:
        return {}
    try:
        parsed = json.loads(raw_permissions)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def normalize_permissions_for_methodology(
    methodology: str,
    permissions: dict | None,
) -> dict[str, bool]:
    normalized = {
        str(key): bool(value)
        for key, value in (permissions or {}).items()
    }

    # Sprint actions are intentionally hidden/disabled for pure Kanban projects.
    if methodology == "KANBAN":
        for key in SPRINT_PERMISSION_KEYS:
            normalized[key] = False

    return normalized


def workflow_config_for_methodology(methodology: str) -> dict:
    normalized_methodology = methodology.upper()
    preset = METHODOLOGY_WORKFLOW_PRESETS.get(normalized_methodology, DEFAULT_WORKFLOW_CONFIG)
    return json.loads(json.dumps(preset))


def parse_workflow_config(raw_config: str | None, base_config: dict | None = None) -> dict:
    config = json.loads(json.dumps(base_config or DEFAULT_WORKFLOW_CONFIG))
    if not raw_config:
        return config

    try:
        parsed = json.loads(raw_config)
    except Exception:
        return config

    if not isinstance(parsed, dict):
        return config

    raw_limits = parsed.get("wip_limits")
    if isinstance(raw_limits, dict):
        for status_key in DEFAULT_WORKFLOW_CONFIG["wip_limits"]:
            value = raw_limits.get(status_key)
            if value is None or value == "":
                config["wip_limits"][status_key] = None
                continue

            try:
                normalized_value = int(value)
            except (TypeError, ValueError):
                continue

            config["wip_limits"][status_key] = max(0, normalized_value)

    allowed_statuses = set(config["wip_limits"].keys())
    default_columns = {
        column["key"]: column.copy()
        for column in config["columns"]
    }
    raw_columns = parsed.get("columns")
    if isinstance(raw_columns, list):
        for raw_column in raw_columns:
            if not isinstance(raw_column, dict):
                continue

            status_key = str(raw_column.get("key", "")).upper()
            if status_key not in allowed_statuses:
                continue

            # Only known workflow states may be customized; this protects the board,
            # reports and methodology transitions from unsupported status keys.
            next_column = default_columns[status_key].copy()
            label = str(raw_column.get("label") or next_column["label"]).strip()
            next_column["label"] = label[:40] or next_column["label"]
            next_column["enabled"] = bool(raw_column.get("enabled", True))
            next_column["color"] = str(raw_column.get("color") or next_column["color"])[:80]

            try:
                next_column["order"] = int(raw_column.get("order", next_column["order"]))
            except (TypeError, ValueError):
                next_column["order"] = int(next_column["order"])

            default_columns[status_key] = next_column

    config["columns"] = sorted(default_columns.values(), key=lambda column: (column["order"], column["key"]))
    return config


def project_workflow_config(project) -> dict:
    base_config = workflow_config_for_methodology(project.methodology)
    if project.workflow_config:
        return parse_workflow_config(project.workflow_config, base_config)
    return base_config
