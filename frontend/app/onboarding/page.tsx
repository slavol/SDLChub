"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Users, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/use-auth-store";
import api from "@/lib/axios";

export default function OnboardingPage() {
  const router = useRouter();
  const { logout, isAuthenticated } = useAuthStore();
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  // Protecție simplă: Dacă nu e logat, îl trimitem la login
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleCreateProject = () => {
    // Aici vom merge către Wizard-ul AI (pasul următor)
    router.push("/project-wizard"); 
  };

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) return;
    
    setIsJoining(true);
    try {
      // Vom implementa acest endpoint imediat
      await api.post("/projects/join", { code: inviteCode });
      toast.success("Joined project successfully!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Invalid invitation code.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header Simplu */}
      <header className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 font-bold text-xl">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm">SD</div>
            SDLC Hub
        </div>
        <Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
        <div className="max-w-4xl w-full space-y-8 text-center">
            <div className="space-y-2">
                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Welcome to your workspace
                </h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                    You don't have any active projects yet. How would you like to get started?
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                {/* OPTIUNEA 1: AI WIZARD */}
                <Card className="bg-slate-900/50 border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group hover:shadow-2xl hover:shadow-blue-500/10" onClick={handleCreateProject}>
                    <CardHeader>
                        <div className="mx-auto h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-blue-500/20">
                            <Sparkles className="h-8 w-8 text-blue-500" />
                        </div>
                        <CardTitle className="text-2xl">Create with AI</CardTitle>
                        <CardDescription className="text-slate-400">
                            Launch a new project. Our AI will help you choose the best methodology (Scrum/Kanban) and define roles.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 group-hover:translate-x-1 transition-transform">
                            Start Wizard <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>

                {/* OPTIUNEA 2: JOIN TEAM */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Card className="bg-slate-900/50 border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer group hover:shadow-2xl hover:shadow-purple-500/10">
                            <CardHeader>
                                <div className="mx-auto h-16 w-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 border border-purple-500/20">
                                    <Users className="h-8 w-8 text-purple-500" />
                                </div>
                                <CardTitle className="text-2xl">Join a Team</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Have an invitation code? Enter it here to join an existing project and start collaborating.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 hover:text-white">
                                    Enter Code <Plus className="ml-2 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                    
                    {/* MODALA PENTRU COD */}
                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-50">
                        <DialogHeader>
                            <DialogTitle>Join Project</DialogTitle>
                            <DialogDescription>
                                Enter the invitation code shared by your project manager.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="code">Invitation Code</Label>
                                <Input 
                                    id="code" 
                                    placeholder="e.g. prj_123_abc" 
                                    className="bg-slate-950 border-slate-700"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleJoinTeam} disabled={isJoining} className="bg-purple-600 hover:bg-purple-700 text-white">
                                {isJoining ? "Joining..." : "Join Project"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
      </main>
    </div>
  );
}