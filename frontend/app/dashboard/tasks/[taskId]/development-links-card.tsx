import {
  ExternalLink,
  GitCommitHorizontal,
  Github,
  GitPullRequest,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitHubEventItem } from "@/services/github";

import { formatTaskDate, githubEventTone, shortSha } from "./task-detail-utils";

function GithubEventIcon({ event }: { event: GitHubEventItem }) {
  if (event.event_type === "pull_request") return <GitPullRequest className="h-4 w-4" />;
  if (event.event_type === "push") return <GitCommitHorizontal className="h-4 w-4" />;
  return <Github className="h-4 w-4" />;
}

export function DevelopmentLinksCard({
  events,
  taskKey,
}: {
  events: GitHubEventItem[];
  taskKey: string;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardHeader className="border-b border-slate-800/80">
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5 text-slate-200" />
          Development links
        </CardTitle>
        <p className="text-sm text-slate-500">
          GitHub commits and pull requests linked through task keys.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/25"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className={githubEventTone(event)}>
                    <span className="mr-1.5 inline-flex">
                      <GithubEventIcon event={event} />
                    </span>
                    {event.event_type === "pull_request"
                      ? "Pull request"
                      : event.event_type === "push"
                        ? "Commit"
                        : event.event_type}
                  </Badge>
                  {event.action && (
                    <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                      {event.action}
                    </Badge>
                  )}
                  {event.pull_request_number && (
                    <Badge variant="outline" className="border-purple-500/25 bg-purple-500/10 text-purple-200">
                      PR #{event.pull_request_number}
                    </Badge>
                  )}
                  {shortSha(event.commit_sha) && (
                    <Badge variant="outline" className="border-blue-500/25 bg-blue-500/10 font-mono text-blue-200">
                      {shortSha(event.commit_sha)}
                    </Badge>
                  )}
                </div>
                <p className="break-words font-semibold text-white">
                  {event.summary || "GitHub activity linked to this task"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {event.repository || "Repository unknown"} · {event.sender_login || "unknown sender"} · {formatTaskDate(event.created_at)}
                </p>
              </div>

              {event.url && (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                >
                  <a href={event.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open GitHub
                  </a>
                </Button>
              )}
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
            <Github className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">
              No linked GitHub activity yet
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Include {taskKey} in a commit message, PR title, PR body or branch name.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
