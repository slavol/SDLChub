"use client";

import { useEffect, useState } from "react";
import { getMyProjects } from "@/services/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertCircle, CheckCircle2, Clock, PlayCircle, GitPullRequest, ArrowUpRight } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- WIDGETS ---

const MetricCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
            <Icon className={`h-4 w-4 ${colorClass}`} />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-white">{value}</div>
            <p className={`text-xs mt-1 ${colorClass} opacity-80`}>{subtext}</p>
        </CardContent>
    </Card>
);

const SprintWidget = () => (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-900/50 border-slate-800">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Current Sprint</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
            <div className="flex justify-between items-end mb-2">
                <div className="text-2xl font-bold text-white">Sprint 4</div>
                <span className="text-xs text-slate-400">3 days left</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[70%] rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            </div>
            <p className="text-xs text-right text-blue-400 mt-2">70% Complete</p>
        </CardContent>
    </Card>
);

const MyTasksWidget = () => (
    <Card className="bg-slate-900/50 border-slate-800 col-span-1 md:col-span-2 h-full">
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                My Active Tasks <Badge variant="secondary" className="bg-slate-800">3</Badge>
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className={`w-2 h-2 rounded-full ${i === 1 ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                            <div>
                                <div className="text-sm font-medium text-slate-200 group-hover:text-blue-400 transition-colors">Implement OAuth Login with Google</div>
                                <div className="text-xs text-slate-500 mt-0.5">DEV-{100+i} • Auth Team</div>
                            </div>
                        </div>
                        <Badge className="bg-slate-800 text-slate-300 hover:bg-slate-700">In Progress</Badge>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);

export default function DashboardPage() {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const projects = await getMyProjects();
        if (projects.length > 0) {
            setProject(projects[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
      return (
        <div className="h-full flex items-center justify-center text-blue-500">
            <Loader2 className="w-10 h-10 animate-spin" />
        </div>
      );
  }

  if (!project) {
      return (
        <div className="flex flex-col items-center justify-center h-[80vh] text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">No projects found</h2>
            <p className="text-slate-400">You haven't joined or created any projects yet.</p>
            <Button variant="default" className="bg-blue-600">Create Project</Button>
        </div>
      );
  }

  const isScrum = project.methodology === "SCRUM" || project.methodology === "SCRUMBAN";
  const isKanban = project.methodology === "KANBAN";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
                <div className="flex items-center gap-3 text-slate-400">
                    <span>Overview for</span>
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 px-3 py-1">
                        {project.name}
                    </Badge>
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                        {project.methodology}
                    </Badge>
                </div>
            </div>
            <div className="flex gap-3">
                <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300">
                    <GitPullRequest className="w-4 h-4 mr-2"/> PRs (2)
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20">
                    <PlayCircle className="w-4 h-4 mr-2"/> Start Work
                </Button>
            </div>
        </div>

        {/* METRICS GRID - POLYMORPHIC */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Widget 1: Velocity / Throughput */}
            {isScrum ? (
                <MetricCard 
                    title="Velocity" 
                    value="24 pts" 
                    subtext="+12% vs last sprint" 
                    icon={Activity} 
                    colorClass="text-emerald-400"
                />
            ) : (
                <MetricCard 
                    title="Throughput" 
                    value="12 tasks" 
                    subtext="Per week average" 
                    icon={Activity} 
                    colorClass="text-blue-400"
                />
            )}

            {/* Widget 2: Methodology Specific */}
            {isScrum ? (
                <SprintWidget />
            ) : (
                <MetricCard 
                    title="Cycle Time" 
                    value="2.4 days" 
                    subtext="-10% improvement" 
                    icon={Clock} 
                    colorClass="text-purple-400"
                />
            )}

            {/* Widget 3: Bottlenecks (AI Powered) */}
            <MetricCard 
                title="AI Risk Radar" 
                value="2 Risks" 
                subtext="Tasks stuck in Review > 3 days" 
                icon={AlertCircle} 
                colorClass="text-red-400"
            />

            {/* Widget 4: Team Health */}
            <MetricCard 
                title="Team Health" 
                value="98%" 
                subtext="Based on workload balance" 
                icon={CheckCircle2} 
                colorClass="text-green-400"
            />
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <MyTasksWidget />
            
            {/* Activity Feed */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm h-full">
                <CardHeader>
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
                        {[
                            { user: "Alex", action: "moved", target: "DEV-101", where: "to QA", color: "text-blue-400" },
                            { user: "Maria", action: "commented on", target: "DEV-99", where: "", color: "text-purple-400" },
                            { user: "AI Bot", action: "flagged risk on", target: "DEV-105", where: "", color: "text-green-400" }
                        ].map((item, i) => (
                            <div key={i} className="relative pl-8 text-sm text-slate-400">
                                <div className="absolute left-[11px] top-[6px] w-2 h-2 rounded-full bg-slate-700 border-2 border-slate-950"></div>
                                <p>
                                    <span className={`font-bold ${item.color}`}>{item.user}</span> {item.action} <span className="text-white font-medium">{item.target}</span> {item.where}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">2 hours ago</p>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" className="w-full mt-4 text-xs text-slate-500 hover:text-slate-300">
                        View all activity <ArrowUpRight className="ml-1 w-3 h-3"/>
                    </Button>
                </CardContent>
            </Card>
        </div>

    </div>
  );
}