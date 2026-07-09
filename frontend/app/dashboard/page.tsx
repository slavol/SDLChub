"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  GitPullRequest,
  KanbanSquare,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDebouncedRealtimeEvent } from "@/hooks/use-realtime-event";
import { pickWorkspaceProject } from "@/lib/project-selection";
import {
  getMyProjects,
  getProjectDashboard,
  Project,
  ProjectDashboardData,
} from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";
import { DashboardPageSkeleton } from "./dashboard-components";
import {
  DashboardActivityCard,
  DashboardHero,
  DeliverySignalsCard,
  FlowStatusCard,
  MyActiveTasksCard,
  RiskRadarCard,
  WorkDistributionCard,
} from "./dashboard-sections";
import type {
  DashboardMetricCardConfig,
  DashboardSignalConfig,
} from "./dashboard-utils";

export default function DashboardPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [dashboard, setDashboard] = useState<ProjectDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Sectiunea de activitate ramane inchisa initial ca dashboard-ul sa fie aerisit.
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);

  // Pagina ramane containerul de date: alege proiectul, incarca agregatele si le paseaza componentelor vizuale.
  const loadDashboard = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);

      try {
        let selectedProject = currentProject;

        if (!selectedProject) {
          const projects = await getMyProjects();
          selectedProject = pickWorkspaceProject(projects, currentProject);

          if (selectedProject) {
            setCurrentProject(selectedProject);
          }
        }

        setProject(selectedProject);

        if (!selectedProject) {
          setDashboard(null);
          return;
        }

        const remoteDashboard = await getProjectDashboard(selectedProject.id);
        setDashboard(remoteDashboard);
        setProject(remoteDashboard.project);
      } finally {
        setLoading(false);
      }
    },
    [currentProject, setCurrentProject]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Evenimentele realtime pot veni in rafale; debounce-ul evita refresh-uri dese ale dashboard-ului.
  useDebouncedRealtimeEvent(
    () => loadDashboard(false),
    [project?.id, loadDashboard],
    350,
    (message) => {
      if (!project?.id || (message.project_id && message.project_id !== project.id)) return false;
      return (
        message.type === "task.changed" ||
        message.type === "sprint.changed" ||
        message.type === "calendar.changed" ||
        message.type === "user.updated"
      );
    }
  );

  const metrics = useMemo(
    () =>
      dashboard?.metrics ?? {
        total_tasks: 0,
        active_tasks: 0,
        completed_tasks: 0,
        backlog_tasks: 0,
        unassigned_tasks: 0,
        due_soon_tasks: 0,
        overdue_tasks: 0,
        critical_open_tasks: 0,
        review_tasks: 0,
        completion_rate: 0,
        team_members_count: 0,
        team_health_score: 0,
        total_story_points: 0,
        completed_story_points: 0,
      },
    [dashboard?.metrics]
  );
  const isScrumLike =
    project?.methodology === "SCRUM" || project?.methodology === "SCRUMBAN";

  const statusDistribution = dashboard?.status_distribution || {};
  const totalTasks = metrics?.total_tasks || 0;
  const reviewCount = statusDistribution.REVIEW || 0;
  const inProgressCount = statusDistribution.IN_PROGRESS || 0;
  const todoCount = statusDistribution.TODO || 0;
  const doneCount = statusDistribution.DONE || metrics?.completed_tasks || 0;
  const storyPointProgress = metrics?.total_story_points
    ? Math.round(
        ((metrics.completed_story_points || 0) / metrics.total_story_points) * 100
      )
    : 0;

  // Cardurile sunt configurate ca date pentru a pastra JSX-ul de randare simplu si reutilizabil.
  const metricCards = useMemo<DashboardMetricCardConfig[]>(
    () => [
      {
        title: isScrumLike ? "Velocity Signal" : "Throughput",
        value: isScrumLike
          ? `${metrics?.completed_story_points || 0}/${metrics?.total_story_points || 0}`
          : String(metrics?.completed_tasks || 0),
        subtext: isScrumLike
          ? `${storyPointProgress}% of story points completed`
          : `${metrics?.active_tasks || 0} active items in flow`,
        icon: isScrumLike ? Target : KanbanSquare,
        tone: "blue" as const,
      },
      {
        title: "Completion",
        value: `${metrics?.completion_rate || 0}%`,
        subtext: `${doneCount} of ${totalTasks} tasks completed`,
        icon: CheckCircle2,
        tone: "green" as const,
      },
      {
        title: "My Active Work",
        value: String(dashboard?.my_active_tasks.length || 0),
        subtext: currentUser?.full_name
          ? `Assigned to ${currentUser.full_name}`
          : "Assigned to you",
        icon: Zap,
        tone: "yellow" as const,
      },
      {
        title: "Team Health",
        value: `${metrics?.team_health_score || 0}%`,
        subtext: `${metrics?.team_members_count || 0} members on this project`,
        icon: ShieldCheck,
        tone:
          metrics.team_health_score >= 80
            ? ("green" as const)
            : metrics.team_health_score >= 55
            ? ("yellow" as const)
            : ("red" as const),
      },
    ],
    [
      currentUser?.full_name,
      dashboard?.my_active_tasks.length,
      doneCount,
      isScrumLike,
      metrics,
      storyPointProgress,
      totalTasks,
    ]
  );

  const deliverySignals: DashboardSignalConfig[] = [
    {
      title: "Overdue",
      value: String(metrics.overdue_tasks || 0),
      detail: "Open tasks past target date",
      icon: AlertTriangle,
      tone: (metrics.overdue_tasks || 0) > 0 ? ("red" as const) : ("green" as const),
    },
    {
      title: "Due Soon",
      value: String(metrics.due_soon_tasks || 0),
      detail: "Open tasks due in the next 7 days",
      icon: CalendarDays,
      tone: "blue" as const,
    },
    {
      title: "Critical Open",
      value: String(metrics.critical_open_tasks || 0),
      detail: "Critical priority work not done",
      icon: Zap,
      tone: (metrics.critical_open_tasks || 0) > 0 ? ("red" as const) : ("green" as const),
    },
    {
      title: "Review Queue",
      value: String(metrics.review_tasks ?? reviewCount),
      detail: "Items waiting for validation",
      icon: GitPullRequest,
      tone: (metrics.review_tasks || reviewCount) > 0 ? ("yellow" as const) : ("green" as const),
    },
    {
      title: "Unassigned",
      value: String(metrics.unassigned_tasks || 0),
      detail: "Active work without owner",
      icon: UserRound,
      tone: (metrics.unassigned_tasks || 0) > 0 ? ("yellow" as const) : ("green" as const),
    },
    {
      title: "Backlog",
      value: String(metrics.backlog_tasks || 0),
      detail: isScrumLike ? "Items not planned in sprint" : "Intake queue size",
      icon: Layers3,
      tone: "purple" as const,
    },
  ];

  if (loading) {
    return <DashboardPageSkeleton />;
  }

  if (!project || !dashboard) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-950/20">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">No project selected</h2>
          <p className="mt-2 text-slate-400">
            Create or select a project to open the workspace.
          </p>
          <Button
            className="mt-6 bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/project-wizard")}
          >
            Create Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 text-slate-50 sm:px-6 md:p-8">
      <DashboardHero
        project={project}
        healthScore={metrics.team_health_score}
        metricCards={metricCards}
      />

      <div className="space-y-6">
        <div className="space-y-6">
          <DeliverySignalsCard signals={deliverySignals} />

          <WorkDistributionCard
            isScrumLike={isScrumLike}
            statusDistribution={statusDistribution}
            totalTasks={totalTasks}
            reviewCount={reviewCount}
            inProgressCount={inProgressCount}
          />

          <MyActiveTasksCard tasks={dashboard.my_active_tasks} />
        </div>

        <aside className="grid min-w-0 h-fit gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <FlowStatusCard
            dashboard={dashboard}
            isScrumLike={isScrumLike}
            todoCount={todoCount}
            inProgressCount={inProgressCount}
            reviewCount={reviewCount}
          />

          <RiskRadarCard dashboard={dashboard} />

          <DashboardActivityCard
            dashboard={dashboard}
            isExpanded={isActivityExpanded}
            onToggle={() => setIsActivityExpanded((current) => !current)}
          />
        </aside>
      </div>
    </div>
  );
}
