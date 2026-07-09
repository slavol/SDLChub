import type { ElementType } from "react";

import type { DashboardRiskCard } from "@/services/project";

// Helper-ele vizuale sunt separate de pagina pentru ca dashboard-ul sa ramana concentrat pe date.
export const statusLabels: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

export const severityStyles: Record<DashboardRiskCard["severity"], string> = {
  low: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  high: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

export const statusStyles: Record<string, string> = {
  TODO: "border-slate-700 bg-slate-800/70 text-slate-300",
  IN_PROGRESS: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  REVIEW: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  DONE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

export const priorityStyles: Record<string, string> = {
  LOW: "border-slate-700 bg-slate-800/70 text-slate-300",
  MEDIUM: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  HIGH: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  CRITICAL: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

export type MetricTone = "blue" | "green" | "purple" | "yellow" | "red";

export type DashboardMetricCardConfig = {
  title: string;
  value: string;
  subtext: string;
  icon: ElementType;
  tone: MetricTone;
};

export type DashboardSignalConfig = {
  title: string;
  value: string;
  detail: string;
  icon: ElementType;
  tone: MetricTone;
};

export const metricToneClass: Record<MetricTone, string> = {
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  purple: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  yellow: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  red: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

// Formatam timpul relativ local, fara librarii suplimentare, fiind suficient pentru lista scurta de activitate.
export function formatRelativeTime(value?: string | null) {
  if (!value) return "recently";
  const date = new Date(value);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (Number.isNaN(diffMinutes)) return "recently";
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// Afisam termenele in format scurt pentru carduri compacte si randuri de task.
export function formatShortDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

// Initialele sunt fallback-ul comun cand utilizatorul nu are avatar incarcat.
export function getInitials(name?: string | null) {
  if (!name) return "SY";
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "SY";
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}
