export const statusStyles: Record<string, string> = {
  OPEN: "border-amber-500/35 bg-amber-500/10 text-amber-200",
  IN_PROGRESS: "border-blue-500/35 bg-blue-500/10 text-blue-200",
  RESOLVED: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  CLOSED: "border-slate-500/35 bg-slate-500/10 text-slate-300",
};

export const ticketStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function formatAdminDate(value?: string | null) {
  if (!value) return "No date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function parseErrorDetail(detail?: string | null): Record<string, unknown> {
  if (!detail) return {};

  try {
    const parsed = JSON.parse(detail);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }

    return { detail: parsed };
  } catch {
    return { detail };
  }
}

export function formatErrorDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
