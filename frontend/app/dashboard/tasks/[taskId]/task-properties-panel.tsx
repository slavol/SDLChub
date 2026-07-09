import Link from "next/link";
import { ArrowRight, Gauge, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { ProjectMember, ProjectTeam } from "@/services/project";
import { TaskDetail, TaskPriority, TaskStatus } from "@/services/task";

import {
  priorityOptions,
  statusLabels,
  statusOptions,
  toDateInputValue,
} from "./task-detail-utils";

type TaskPropertiesPanelProps = {
  task: TaskDetail;
  members: ProjectMember[];
  teams: ProjectTeam[];
  supportsStoryPoints: boolean;
  canMoveTask: boolean;
  canUpdateTask: boolean;
  canUseAi: boolean;
  canAssignTask: boolean;
  aiWorking: boolean;
  patchLocalTask: (updates: Partial<TaskDetail>) => void;
  onEstimateWithAi: () => void;
  onInvalidateEstimate: () => void;
  onAssigneeChange: (value: string) => void;
  onTeamChange: (value: string) => void;
};

export function TaskPropertiesPanel({
  task,
  members,
  teams,
  supportsStoryPoints,
  canMoveTask,
  canUpdateTask,
  canUseAi,
  canAssignTask,
  aiWorking,
  patchLocalTask,
  onEstimateWithAi,
  onInvalidateEstimate,
  onAssigneeChange,
  onTeamChange,
}: TaskPropertiesPanelProps) {
  return (
    <aside className="xl:self-start">
      <div className="space-y-4 xl:sticky xl:top-6">
        <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
          <CardHeader className="border-b border-slate-800/80">
            <CardTitle className="text-base">Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={task.status}
                onValueChange={(value) =>
                  patchLocalTask({ status: value as TaskStatus })
                }
                disabled={!canMoveTask}
              >
                <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={task.priority}
                onValueChange={(value) =>
                  patchLocalTask({ priority: value as TaskPriority })
                }
                disabled={!canUpdateTask}
              >
                <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                  {priorityOptions.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {supportsStoryPoints ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Story Points</Label>
                  {canUseAi && canUpdateTask && (
                    <button
                      type="button"
                      onClick={onEstimateWithAi}
                      disabled={aiWorking}
                      className="inline-flex items-center text-xs text-blue-300 transition hover:text-blue-200 disabled:opacity-50"
                    >
                      {aiWorking ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      Estimate
                    </button>
                  )}
                </div>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={task.story_points ?? ""}
                  onChange={(event) =>
                    patchLocalTask({
                      story_points: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                  disabled={!canUpdateTask}
                  className="h-11 border-slate-700 bg-slate-950"
                />
                {canUpdateTask && task.story_points !== null && task.story_points !== undefined && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onInvalidateEstimate}
                    className="h-10 w-full border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                  >
                    <Gauge className="mr-2 h-4 w-4" />
                    Invalidate estimate
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm font-medium text-slate-300">
                  Story Points disabled
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Kanban work is tracked by flow, not sprint estimation.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Target Date</Label>
              <Input
                type="date"
                value={toDateInputValue(task.due_date)}
                onChange={(event) =>
                  patchLocalTask({
                    due_date: event.target.value
                      ? `${event.target.value}T23:59:00`
                      : null,
                  })
                }
                disabled={!canUpdateTask}
                className="h-11 border-slate-700 bg-slate-950"
              />
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                value={task.assignee_id ? String(task.assignee_id) : "unassigned"}
                onValueChange={onAssigneeChange}
                disabled={!canAssignTask}
              >
                <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem
                      key={member.membership_id}
                      value={String(member.user.id)}
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={member.user.full_name}
                          email={member.user.email}
                          src={member.user.avatar_url}
                          className="h-5 w-5"
                          fallbackClassName="bg-blue-900 text-[9px] text-blue-100"
                        />
                        {member.user.full_name || member.user.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Delivery Team</Label>
              <Select
                value={task.team_id ? String(task.team_id) : "none"}
                onValueChange={onTeamChange}
                disabled={!canAssignTask}
              >
                <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                  <SelectValue placeholder="No team" />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                  <SelectItem value="none">No team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900"
          asChild
        >
          <Link href="/dashboard/board">
            Open on board
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
