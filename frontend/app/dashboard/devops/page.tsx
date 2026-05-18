"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  GitBranch,
  Github,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { getProjectGitHubEvents, GitHubEventItem } from "@/services/github";
import { getMyProjects, Project } from "@/services/project";
import { useProjectStore } from "@/store/use-project-store";

type EventFilter = "all" | "push" | "pull_request";

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventIcon(event: GitHubEventItem) {
  if (event.event_type === "pull_request") return GitPullRequest;
  if (event.event_type === "push") return GitCommitHorizontal;
  return GitBranch;
}

function eventTone(event: GitHubEventItem) {
  if (event.event_type === "pull_request") {
    if (event.action === "closed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    return "border-purple-500/20 bg-purple-500/10 text-purple-200";
  }

  if (event.event_type === "push") {
    return "border-blue-500/20 bg-blue-500/10 text-blue-200";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

export default function DevOpsPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [events, setEvents] = useState<GitHubEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EventFilter>("all");

  const loadEvents = useCallback(async () => {
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
        setEvents([]);
        return;
      }

      setProject(selectedProject);

      const remoteEvents = await getProjectGitHubEvents(
        selectedProject.id,
        filter === "all" ? null : filter,
        120
      );

      setEvents(remoteEvents);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load GitHub events."));
    } finally {
      setLoading(false);
    }
  }, [currentProject, filter, setCurrentProject]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const stats = useMemo(() => {
    return {
      total: events.length,
      commits: events.filter((event) => event.event_type === "push").length,
      prs: events.filter((event) => event.event_type === "pull_request").length,
    };
  }, [events]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-blue-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <Card className="max-w-lg border-slate-800 bg-slate-900/80">
          <CardContent className="p-8 text-center">
            <Github className="mx-auto mb-4 h-10 w-10 text-blue-300" />
            <h1 className="text-xl font-semibold text-white">No project selected</h1>
            <p className="mt-2 text-sm text-slate-400">
              Create or join a project before reviewing DevOps events.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
            <Github className="h-3.5 w-3.5" />
            GitHub / DevOps
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            DevOps events for {project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Track commits and pull requests linked to SDLC Hub task keys.
          </p>
        </div>

        <Button
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
          onClick={loadEvents}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Events</p>
            <p className="mt-1 text-3xl font-bold text-white">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Commits</p>
            <p className="mt-1 text-3xl font-bold text-blue-300">{stats.commits}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Pull requests</p>
            <p className="mt-1 text-3xl font-bold text-purple-300">{stats.prs}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["push", "Commits"],
          ["pull_request", "Pull requests"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant="outline"
            className={cn(
              "border-slate-800",
              filter === value
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800"
            )}
            onClick={() => setFilter(value as EventFilter)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {events.map((event) => {
          const Icon = eventIcon(event);

          return (
            <Card key={event.id} className="border-slate-800 bg-slate-900/70">
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${eventTone(event)}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                        {event.event_type}
                      </Badge>
                      {event.action && (
                        <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-200">
                          {event.action}
                        </Badge>
                      )}
                      {event.task_key && (
                        <Link href={event.task_id ? `/dashboard/tasks/${event.task_id}` : "#"}>
                          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
                            {event.task_key}
                          </Badge>
                        </Link>
                      )}
                    </div>

                    <h2 className="font-semibold text-white">
                      {event.summary || "GitHub event"}
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      {event.repository || "Unknown repository"}
                      {event.sender_login ? ` • ${event.sender_login}` : ""}
                      {" • "}
                      {formatDate(event.created_at)}
                    </p>

                    {event.commit_sha && (
                      <p className="mt-1 font-mono text-xs text-slate-600">
                        {event.commit_sha.slice(0, 12)}
                      </p>
                    )}
                  </div>
                </div>

                {event.url && (
                  <Button
                    asChild
                    variant="outline"
                    className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                  >
                    <a href={event.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {events.length === 0 && (
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-10 text-center">
              <Github className="mx-auto mb-4 h-10 w-10 text-slate-600" />
              <h2 className="text-lg font-semibold text-white">No GitHub events yet</h2>
              <p className="mt-2 text-sm text-slate-500">
                Send a GitHub webhook containing a task key such as {project.key}-1.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
