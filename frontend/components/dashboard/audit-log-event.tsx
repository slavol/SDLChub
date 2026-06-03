"use client";

import { AlertTriangle, ArrowRight, Bot, FileText, Github, History, MessageSquareText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

export type AuditEventData = {
  id: number | string;
  actor_name?: string | null;
  actor_avatar_url?: string | null;
  action: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at?: string | null;
};

type ParsedRisk = {
  severity?: string;
  category?: string;
  confidence?: number;
  source?: string;
  recommended_action?: string;
  comment_id?: number;
};

const actionLabels: Record<string, string> = {
  TASK_CREATED: "Created task",
  TASK_UPDATED: "Updated task",
  TASK_DELETED: "Deleted task",
  SUBTASK_CREATED: "Added subtask",
  SUBTASK_UPDATED: "Updated subtask",
  SUBTASK_DELETED: "Deleted subtask",
  COMMENT_ADDED: "Commented",
  COMMENT_UPDATED: "Edited comment",
  COMMENT_DELETED: "Deleted comment",
  COMMENT_RISK_DETECTED: "AI risk detected",
  ESTIMATE_INVALIDATED: "Invalidated estimate",
  DOCUMENTATION_GENERATED: "Generated documentation",
  GITHUB_COMMIT_LINKED: "Linked GitHub commit",
  GITHUB_PR_LINKED: "Linked GitHub pull request",
  PROJECT_UPDATED: "Updated project",
  PROJECT_DELETED: "Deleted project",
  PROJECT_ARCHIVED: "Archived project",
  PROJECT_RESTORED: "Restored project",
  PROJECT_WORKFLOW_UPDATED: "Updated workflow",
  METHODOLOGY_TRANSITION: "Changed methodology",
  ROLE_UPDATED: "Updated role",
  AI_SETTINGS_UPDATED: "Updated AI settings",
  GITHUB_PR_MANUAL_CONFIRM: "Confirmed pull request",
};

const fieldLabels: Record<string, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  priority: "Priority",
  story_points: "Story points",
  due_date: "Due date",
  assignee_id: "Assignee",
  assignee_name: "Assignee",
  team_id: "Delivery team",
  team_name: "Delivery team",
  sprint_id: "Sprint",
  comment: "Comment",
  "comment.body": "Comment",
  "comment.risk": "Risk signal",
  subtask: "Subtask",
  "subtask.title": "Subtask",
  "subtask.is_done": "Checklist status",
  methodology: "Methodology",
  workflow: "Workflow",
  workflow_config: "Workflow config",
  wip_limits: "WIP limits",
  columns: "Columns",
  key: "Key",
  label: "Label",
  order: "Order",
  enabled: "Visibility",
  color: "Color",
  ai_provider: "AI provider",
  "github.commit": "GitHub commit",
  "github.pull_request": "GitHub pull request",
};

const statusLabels: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
  true: "Done",
  false: "Open",
  None: "Not set",
  null: "Not set",
};

const severityStyles: Record<string, string> = {
  low: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  high: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  critical: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

export function formatAuditActionLabel(action: string) {
  return actionLabels[action] || humanize(action);
}

export function formatAuditFieldLabel(field?: string | null) {
  if (!field) return "Change";
  return fieldLabels[field] || humanize(field);
}

export function formatAuditDate(value?: string | null) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

function humanize(value: string) {
  return value
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseJson(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function cleanValue(value?: string | null) {
  if (value === undefined || value === null || value === "" || value === "-") {
    return "Not set";
  }

  const trimmed = String(value).trim();
  if (statusLabels[trimmed]) return statusLabels[trimmed];
  return trimmed;
}

function formatStructuredValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not set";

  if (Array.isArray(value)) {
    if (
      value.every(
        (item) =>
          item &&
          typeof item === "object" &&
          ("key" in item || "label" in item)
      )
    ) {
      return value
        .map((item) => {
          const column = item as Record<string, unknown>;
          const label = String(column.label || column.key || "Column");
          const key = column.key ? ` (${String(column.key)})` : "";
          const visibility = column.enabled === false ? "hidden" : "shown";
          return `${label}${key}: ${visibility}`;
        })
        .join("; ");
    }

    return value.map((item) => formatStructuredValue(item)).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const normalized =
          item === null || item === undefined || item === ""
            ? "No limit"
            : formatStructuredValue(item);
        return `${formatAuditFieldLabel(key)}: ${normalized}`;
      })
      .join("; ");
  }

  return String(value);
}

function isEmptyValue(value?: string | null) {
  return value === undefined || value === null || value === "" || value === "-";
}

function getRisk(event: AuditEventData): ParsedRisk | null {
  if (event.action !== "COMMENT_RISK_DETECTED" && event.field !== "comment.risk") return null;
  const parsed = parseJson(event.new_value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return null;
  return parsed as ParsedRisk;
}

function renderAuditIcon(action: string) {
  if (action.includes("COMMENT")) return <MessageSquareText className="h-3.5 w-3.5" />;
  if (action.includes("RISK")) return <AlertTriangle className="h-3.5 w-3.5" />;
  if (action.includes("GITHUB")) return <Github className="h-3.5 w-3.5" />;
  if (action.includes("DOCUMENTATION")) return <FileText className="h-3.5 w-3.5" />;
  if (action.includes("AI")) return <Bot className="h-3.5 w-3.5" />;
  return <History className="h-3.5 w-3.5" />;
}

function RiskDetails({ risk }: { risk: ParsedRisk }) {
  const severity = String(risk.severity || "signal").toLowerCase();

  return (
    <div className="mt-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase tracking-[0.16em]",
            severityStyles[severity] || "border-amber-500/25 bg-amber-500/10 text-amber-300"
          )}
        >
          {severity}
        </Badge>
        {risk.category && (
          <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
            {risk.category}
          </Badge>
        )}
        {typeof risk.confidence === "number" && (
          <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
            {Math.round(risk.confidence * 100)}% confidence
          </Badge>
        )}
        {risk.source && (
          <Badge variant="outline" className="border-violet-500/20 bg-violet-500/10 text-violet-200">
            {risk.source}
          </Badge>
        )}
      </div>
      <p className="text-sm leading-6 text-slate-200">
        {risk.recommended_action || "A risk signal was detected in the task discussion."}
      </p>
      {risk.comment_id && (
        <p className="mt-2 text-xs text-slate-500">Linked comment #{risk.comment_id}</p>
      )}
    </div>
  );
}

function ChangeDetails({ event, compact = false }: { event: AuditEventData; compact?: boolean }) {
  const risk = getRisk(event);
  const parsedNew = parseJson(event.new_value);

  if (risk) return <RiskDetails risk={risk} />;

  if (!event.field && !event.old_value && !event.new_value) return null;

  if (parsedNew && !Array.isArray(parsedNew) && typeof parsedNew === "object") {
    return (
      <div className={cn("mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3", compact && "mt-2")}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {formatAuditFieldLabel(event.field)}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {Object.entries(parsedNew as Record<string, unknown>).slice(0, 6).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-slate-950/80 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">{formatAuditFieldLabel(key)}</p>
              <p className="mt-1 break-words text-sm leading-6 text-slate-200">
                {formatStructuredValue(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isEmptyValue(event.old_value) && !isEmptyValue(event.new_value)) {
    return (
      <div className={cn("mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3", compact && "mt-2")}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {formatAuditFieldLabel(event.field)}
        </p>
        <p className="mt-2 break-words text-sm leading-6 text-emerald-200">{cleanValue(event.new_value)}</p>
      </div>
    );
  }

  if (!isEmptyValue(event.old_value) && isEmptyValue(event.new_value)) {
    return (
      <div className={cn("mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3", compact && "mt-2")}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Removed {formatAuditFieldLabel(event.field).toLowerCase()}
        </p>
        <p className="mt-2 break-words text-sm leading-6 text-rose-200">{cleanValue(event.old_value)}</p>
      </div>
    );
  }

  return (
    <div className={cn("mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3", compact && "mt-2")}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {formatAuditFieldLabel(event.field)}
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="min-w-0 rounded-xl bg-rose-500/10 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-rose-300/70">Before</p>
          <p className="mt-1 break-words text-sm text-rose-100">{cleanValue(event.old_value)}</p>
        </div>
        <ArrowRight className="hidden h-4 w-4 text-slate-600 md:block" />
        <div className="min-w-0 rounded-xl bg-emerald-500/10 px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/70">After</p>
          <p className="mt-1 break-words text-sm text-emerald-100">{cleanValue(event.new_value)}</p>
        </div>
      </div>
    </div>
  );
}

export function AuditChangeSummary({ event }: { event: AuditEventData }) {
  const risk = getRisk(event);
  if (risk) {
    return (
      <div className="mt-2 flex min-w-0 flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center">
        <Badge
          variant="outline"
          className={cn(
            "w-fit shrink-0 text-[10px] uppercase tracking-[0.14em]",
            severityStyles[String(risk.severity || "").toLowerCase()] ||
              "border-amber-500/25 bg-amber-500/10 text-amber-300"
          )}
        >
          {risk.severity || "Risk"}
        </Badge>
        <span className="min-w-0 max-w-full break-words leading-5 text-slate-400 sm:flex-1">
          {risk.recommended_action || "Risk signal detected"}
        </span>
      </div>
    );
  }

  if (!event.field && !event.old_value && !event.new_value) return null;

  if (isEmptyValue(event.old_value) && !isEmptyValue(event.new_value)) {
    return (
      <p className="mt-2 max-w-full break-words text-xs leading-5 text-slate-500">
        {formatAuditFieldLabel(event.field)} set to{" "}
        <span className="text-emerald-300">{cleanValue(event.new_value)}</span>
      </p>
    );
  }

  if (!isEmptyValue(event.old_value) && isEmptyValue(event.new_value)) {
    return (
      <p className="mt-2 max-w-full break-words text-xs leading-5 text-slate-500">
        Removed {formatAuditFieldLabel(event.field).toLowerCase()}:{" "}
        <span className="text-rose-300">{cleanValue(event.old_value)}</span>
      </p>
    );
  }

  return (
    <p className="mt-2 max-w-full break-words text-xs leading-5 text-slate-500">
      {formatAuditFieldLabel(event.field)} changed from{" "}
      <span className="text-slate-300">{cleanValue(event.old_value)}</span> to{" "}
      <span className="text-emerald-300">{cleanValue(event.new_value)}</span>
    </p>
  );
}

export function AuditLogEvent({
  event,
  className,
  compact = false,
}: {
  event: AuditEventData;
  className?: string;
  compact?: boolean;
}) {
  const actor = event.actor_name || "System";
  const icon = renderAuditIcon(event.action);

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/25",
        compact && "p-3",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          name={actor}
          src={event.actor_avatar_url}
          className={cn("h-10 w-10 shrink-0", compact && "h-9 w-9")}
          fallbackClassName="bg-violet-500/10 text-[10px] text-violet-200"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300">
                  {icon}
                </span>
                <p className="font-semibold text-slate-100">{formatAuditActionLabel(event.action)}</p>
                {event.field && (
                  <Badge variant="outline" className="border-slate-700 bg-slate-900 text-[10px] text-slate-400">
                    {formatAuditFieldLabel(event.field)}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">by {actor}</p>
            </div>
            <p className="whitespace-nowrap text-xs text-slate-600">{formatAuditDate(event.created_at)}</p>
          </div>
          <ChangeDetails event={event} compact={compact} />
        </div>
      </div>
    </div>
  );
}
