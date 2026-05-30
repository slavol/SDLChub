"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  confirmPullRequestTransition,
  getProjectPullRequests,
  GitHubPullRequestItem,
} from "@/services/github";
import { getMyProjects, Project } from "@/services/project";
import { useProjectStore } from "@/store/use-project-store";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusTone(status?: string | null) {
  if (status === "DONE") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  if (status === "REVIEW") return "border-purple-500/25 bg-purple-500/10 text-purple-200";
  if (status === "IN_PROGRESS") return "border-blue-500/25 bg-blue-500/10 text-blue-200";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export default function PullRequestsPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [pullRequests, setPullRequests] = useState<GitHubPullRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<GitHubPullRequestItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<"REVIEW" | "DONE">("REVIEW");
  const [note, setNote] = useState("");

  const projectId = project?.id || currentProject?.id || null;
  const { can } = useProjectPermissions(projectId);
  const canUpdateTask = can("TASK_UPDATE");

  const loadPullRequests = useCallback(async () => {
    setLoading(true);

    try {
      let selectedProject = currentProject;

      if (!selectedProject) {
        const projects = await getMyProjects();
        selectedProject = projects[0] ?? null;

        if (selectedProject) {
          setCurrentProject(selectedProject);
        }
      }

      if (!selectedProject) {
        setProject(null);
        setPullRequests([]);
        return;
      }

      setProject(selectedProject);
      setPullRequests(await getProjectPullRequests(selectedProject.id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load pull requests."));
    } finally {
      setLoading(false);
    }
  }, [currentProject, setCurrentProject]);

  useEffect(() => {
    loadPullRequests();
  }, [loadPullRequests]);

  const stats = useMemo(() => {
    return {
      total: pullRequests.length,
      review: pullRequests.filter((item) => item.task_status === "REVIEW").length,
      done: pullRequests.filter((item) => item.task_status === "DONE").length,
      mapped: pullRequests.filter((item) => item.mapped_user_id).length,
    };
  }, [pullRequests]);

  const openConfirm = (item: GitHubPullRequestItem, status: "REVIEW" | "DONE") => {
    setSelected(item);
    setTargetStatus(status);
    setNote("");
  };

  const handleConfirm = async () => {
    if (!selected) return;

    setConfirming(true);
    try {
      const updated = await confirmPullRequestTransition(selected.id, targetStatus, note.trim() || undefined);
      setPullRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success(`Pull request confirmed: ${targetStatus}`);
      setSelected(null);
      setNote("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not confirm pull request."));
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-blue-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <Button
            asChild
            variant="ghost"
            className="mb-4 px-0 text-slate-400 hover:bg-transparent hover:text-white"
          >
            <Link href="/dashboard/devops">
              <ArrowLeft className="mr-2 h-4 w-4" />
              DevOps events
            </Link>
          </Button>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-200">
            <GitPullRequest className="h-3.5 w-3.5" />
            Pull Request Control
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Pull requests for {project?.name || "project"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Review GitHub PR events, mapped authors and manually confirm task transitions when automation needs human approval.
          </p>
        </div>

        <Button
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={loadPullRequests}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          ["Events", stats.total, "text-white"],
          ["In review", stats.review, "text-purple-200"],
          ["Done", stats.done, "text-emerald-200"],
          ["Mapped users", stats.mapped, "text-blue-200"],
        ].map(([label, value, tone]) => (
          <Card key={label} className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className={cn("mt-1 text-3xl font-bold", tone)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {pullRequests.map((item) => (
          <Card key={item.id} className="border-slate-800 bg-slate-900/75">
            <CardContent className="flex flex-col gap-4 p-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border-purple-500/25 bg-purple-500/10 text-purple-200">
                    PR #{item.pull_request_number || "-"}
                  </Badge>
                  {item.action && (
                    <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                      {item.action}
                    </Badge>
                  )}
                  {item.task_status && (
                    <Badge className={statusTone(item.task_status)}>
                      {item.task_status.replace("_", " ")}
                    </Badge>
                  )}
                  {item.task_key && (
                    <Link href={item.task_id ? `/dashboard/tasks/${item.task_id}` : "#"}>
                      <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                        {item.task_key}
                      </Badge>
                    </Link>
                  )}
                </div>

                <h2 className="text-lg font-semibold text-white">
                  {item.summary || item.task_title || "Pull request event"}
                </h2>
                {item.task_title && (
                  <p className="mt-2 text-sm text-slate-400">{item.task_title}</p>
                )}
                <p className="mt-3 text-sm text-slate-500">
                  {item.repository || "Unknown repository"} • {formatDate(item.created_at)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  GitHub: {item.sender_login || "unknown"}
                  {" • "}
                  SDLC: {item.mapped_user_name || item.mapped_user_email || "not mapped"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                {item.url && (
                  <Button
                    asChild
                    variant="outline"
                    className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                  >
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      GitHub
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!canUpdateTask || !item.task_id}
                  onClick={() => openConfirm(item, "REVIEW")}
                  className="border-purple-500/25 bg-purple-500/10 text-purple-100 hover:bg-purple-500/15 disabled:opacity-50"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Confirm review
                </Button>
                <Button
                  disabled={!canUpdateTask || !item.task_id}
                  onClick={() => openConfirm(item, "DONE")}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm done
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {pullRequests.length === 0 && (
          <Card className="border-dashed border-slate-800 bg-slate-900/60">
            <CardContent className="p-10 text-center">
              <GitPullRequest className="mx-auto mb-3 h-8 w-8 text-slate-500" />
              <h2 className="text-lg font-semibold text-white">No pull request events yet</h2>
              <p className="mt-2 text-sm text-slate-500">
                GitHub webhooks will appear here after a PR references a task key.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Confirm PR transition</DialogTitle>
            <DialogDescription className="text-slate-500">
              This will move the linked task to {targetStatus} and record a task audit entry.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-white">
              {selected?.task_key || "Task"} • PR #{selected?.pull_request_number || "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">{selected?.summary}</p>
          </div>

          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional confirmation note..."
            className="min-h-28 border-slate-700 bg-slate-900"
          />

          <DialogFooter>
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              onClick={() => setSelected(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className={targetStatus === "DONE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-purple-600 hover:bg-purple-700"}
            >
              {confirming ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Confirm {targetStatus}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
