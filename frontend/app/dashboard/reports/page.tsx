"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Download,
  CheckCircle2,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  Timer,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  getMyProjects,
  downloadProjectStatusReportPdf,
  getProjectReportsOverview,
  Project,
  ProjectReportsOverview,
  ReportDistributionPoint,
} from "@/services/project";
import { generateSprintReleaseNotes, SprintReleaseNotes } from "@/services/sprint";
import { useProjectStore } from "@/store/use-project-store";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatStatus(value: string) {
  return value.replace("_", " ");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 text-center">
      <div>
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  danger = false,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: typeof BarChart3;
  danger?: boolean;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/70">
      <CardContent className="p-5">
        <div
          className={cn(
            "mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border",
            danger
              ? "border-red-500/20 bg-red-500/10"
              : "border-blue-500/20 bg-blue-500/10"
          )}
        >
          <Icon className={cn("h-5 w-5", danger ? "text-red-300" : "text-blue-300")} />
        </div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className={cn("mt-1 text-3xl font-bold", danger ? "text-red-300" : "text-white")}>
          {value}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/70">
      <CardContent className="p-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function DistributionLegend({ data }: { data: ReportDistributionPoint[] }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 text-slate-300">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            {formatStatus(item.name)}
          </span>
          <span className="font-semibold text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [report, setReport] = useState<ProjectReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<SprintReleaseNotes | null>(null);

  const loadReports = useCallback(async () => {
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
        setReport(null);
        return;
      }

      setProject(selectedProject);

      const remoteReport = await getProjectReportsOverview(selectedProject.id);
      setReport(remoteReport);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load reports."));
    } finally {
      setLoading(false);
    }
  }, [currentProject, setCurrentProject]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExportPdf = async () => {
    if (!project) return;

    setExportingPdf(true);

    try {
      const blob = await downloadProjectStatusReportPdf(project.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeKey = project.key || "project";

      link.href = url;
      link.download = `${safeKey}-status-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF report exported.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not export PDF report."));
    } finally {
      setExportingPdf(false);
    }
  };

  const handleGenerateReleaseNotes = async () => {
    const latestSprint = report?.velocity?.[report.velocity.length - 1];
    if (!latestSprint) return;

    setGeneratingNotes(true);
    try {
      const notes = await generateSprintReleaseNotes(latestSprint.sprint_id);
      setReleaseNotes(notes);
      toast.success("Release notes generated.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not generate release notes."));
    } finally {
      setGeneratingNotes(false);
    }
  };

  const velocityData = useMemo(
    () =>
      (report?.velocity || []).map((item) => ({
        name: item.name,
        Done: item.done_points,
        Planned: item.total_points,
        "Done tasks": item.done_tasks,
      })),
    [report?.velocity]
  );

  const activeSprintData = useMemo(() => {
    if (!report?.active_sprint) return [];

    return [
      {
        name: "Done",
        value: report.active_sprint.done_points,
      },
      {
        name: "Remaining",
        value: report.active_sprint.remaining_points,
      },
    ];
  }, [report?.active_sprint]);

  const statusDistribution = report?.status_distribution || [];
  const priorityDistribution = report?.priority_distribution || [];
  const statusAge = report?.status_age || [];
  const statusChanges = report?.status_change_counts || [];
  const sprintBurndown = report?.sprint_burndown || [];
  const cumulativeFlow = report?.cumulative_flow || [];
  const leadTimeDistribution = report?.lead_time_distribution || [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-blue-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!project || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <Card className="max-w-lg border-slate-800 bg-slate-900/80">
          <CardContent className="p-8 text-center">
            <BarChart3 className="mx-auto mb-4 h-10 w-10 text-blue-300" />
            <h1 className="text-xl font-semibold text-white">No project selected</h1>
            <p className="mt-2 text-sm text-slate-400">
              Create or join a project before viewing reports.
            </p>
            <Button asChild className="mt-5 bg-blue-600 hover:bg-blue-700">
              <Link href="/onboarding">Go to onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = report.summary;

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
            <BarChart3 className="h-3.5 w-3.5" />
            Reports v2
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Delivery reports for {project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Track velocity, burndown, cumulative flow, lead time, bottlenecks and delivery health using tasks, sprints and audit logs.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="w-fit border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={loadReports}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button
            className="w-fit bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export PDF
          </Button>

          <Button
            variant="outline"
            className="w-fit border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleGenerateReleaseNotes}
            disabled={generatingNotes || !report.velocity.length}
          >
            {generatingNotes ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Release Notes
          </Button>
        </div>
      </div>

      {releaseNotes && (
        <Card className="mb-6 border-blue-500/20 bg-blue-500/10">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-300" />
                  <h2 className="text-lg font-semibold text-white">Generated release notes</h2>
                </div>
                <p className="text-sm leading-6 text-blue-100/80">{releaseNotes.summary}</p>
              </div>
              <Badge className="w-fit border-blue-500/30 bg-blue-500/10 text-blue-200">
                {releaseNotes.source || "ai"}
              </Badge>
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm leading-6 text-slate-200">
              {releaseNotes.markdown}
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Completion"
          value={formatPercent(metrics.completion_rate)}
          subtitle={`${metrics.done_tasks}/${metrics.total_tasks} tasks completed`}
          icon={CheckCircle2}
        />
        <MetricCard
          title="Story points"
          value={formatPercent(metrics.story_point_completion_rate)}
          subtitle={`${metrics.completed_story_points}/${metrics.total_story_points} points completed`}
          icon={Gauge}
        />
        <MetricCard
          title="Cycle time"
          value={`${metrics.average_cycle_time_days}d`}
          subtitle="Average time from creation to Done"
          icon={Timer}
        />
        <MetricCard
          title="Overdue"
          value={metrics.overdue_tasks}
          subtitle={`${metrics.due_soon_tasks} tasks due in the next 7 days`}
          icon={AlertTriangle}
          danger={metrics.overdue_tasks > 0}
        />
      </div>

      {report.bottleneck && report.bottleneck.tasks > 0 && (
        <Card className="mb-6 border-amber-500/20 bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                <h2 className="text-lg font-semibold text-white">Bottleneck signal</h2>
              </div>
              <p className="text-sm leading-6 text-amber-100/80">
                {formatStatus(report.bottleneck.status)} has the highest average age:
                {" "}
                <strong>{report.bottleneck.average_age_days} days</strong>
                {" "}across {report.bottleneck.tasks} active tasks.
              </p>
            </div>
            <Badge className="w-fit border-amber-500/30 bg-amber-500/10 text-amber-200">
              max {report.bottleneck.max_age_days}d
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Velocity chart"
          description="Done story points compared with planned sprint points."
        >
          {velocityData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                  />
                  <Bar dataKey="Planned" fill="var(--chart-2)" radius={[8, 8, 0, 0]} activeBar={false} />
                  <Bar dataKey="Done" fill="var(--chart-1)" radius={[8, 8, 0, 0]} activeBar={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No closed sprint with story points yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Active sprint burnup"
          description="Done vs remaining story points for the active sprint."
        >
          {activeSprintData.length > 0 && activeSprintData.some((item) => item.value > 0) ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeSprintData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={4}
                  >
                    {activeSprintData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No active sprint data available." />
          )}
        </ChartCard>

        <ChartCard
          title="Sprint burndown"
          description="Remaining story points against the ideal line for the active sprint."
        >
          {sprintBurndown.length > 0 && sprintBurndown.some((item) => item.remaining_points > 0 || item.done_points > 0) ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sprintBurndown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={false}
                    labelFormatter={(value) => formatShortDate(String(value ?? ""))}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="remaining_points"
                    name="Remaining"
                    stroke="var(--chart-5)"
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal_remaining"
                    name="Ideal"
                    stroke="var(--chart-2)"
                    strokeDasharray="6 6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No active sprint date range available." />
          )}
        </ChartCard>

        <ChartCard
          title="Cumulative flow"
          description="Historical workflow shape reconstructed from task status audit logs."
        >
          {cumulativeFlow.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={false}
                    labelFormatter={(value) => formatShortDate(String(value ?? ""))}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                  />
                  <Area type="monotone" dataKey="TODO" stackId="1" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.45} />
                  <Area type="monotone" dataKey="IN_PROGRESS" stackId="1" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.45} />
                  <Area type="monotone" dataKey="REVIEW" stackId="1" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.45} />
                  <Area type="monotone" dataKey="DONE" stackId="1" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.45} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No historical flow data yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Lead time by priority"
          description="Average days from task creation to Done, grouped by priority."
        >
          {leadTimeDistribution.some((item) => item.tasks > 0) ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTimeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatStatus}
                  />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                    labelFormatter={(value) => formatStatus(String(value ?? ""))}
                  />
                  <Bar dataKey="value" name="Avg days" fill="var(--chart-1)" radius={[8, 8, 0, 0]} activeBar={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No completed tasks for lead time yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Status distribution"
          description="Current task distribution by workflow status."
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                    cursor={false}
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <DistributionLegend data={statusDistribution} />
        </ChartCard>

        <ChartCard
          title="Priority distribution"
          description="Current task distribution by delivery priority."
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                    cursor={false}
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid #1e293b",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                />
                <Bar dataKey="value" fill="var(--chart-4)" radius={[8, 8, 0, 0]} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Bottleneck age"
          description="Average and maximum age of active tasks in each status."
        >
          {statusAge.some((item) => item.tasks > 0) ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={statusAge}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis
                    dataKey="status"
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatStatus}
                  />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                    labelFormatter={(value) => formatStatus(String(value ?? ""))}
                  />
                  <Area
                    type="monotone"
                    dataKey="average_age_days"
                    stroke="var(--chart-1)"
                    fill="var(--chart-1)"
                    fillOpacity={0.25}
                    name="Average age"
                  />
                  <Area
                    type="monotone"
                    dataKey="max_age_days"
                    stroke="var(--chart-5)"
                    fill="var(--chart-5)"
                    fillOpacity={0.18}
                    name="Max age"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No active status age data yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Status movement"
          description="Audit-based count of status transitions into each workflow state."
        >
          {statusChanges.some((item) => item.value > 0) ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChanges}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatStatus}
                  />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                    }}
                    labelFormatter={(value) => formatStatus(String(value ?? ""))}
                  />
                  <Bar dataKey="value" fill="var(--chart-3)" radius={[8, 8, 0, 0]} activeBar={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No status transitions recorded yet." />
          )}
        </ChartCard>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-blue-300" />
          <h2 className="text-lg font-semibold text-white">What this report includes</h2>
        </div>
        <p className="text-sm leading-6 text-slate-400">
          Velocity uses closed sprints and completed story points. Burndown and cumulative flow are reconstructed from sprint dates, task status and audit logs. Lead time is approximated from task creation to the first audit event where the task reached Done.
        </p>
      </div>
    </div>
  );
}
