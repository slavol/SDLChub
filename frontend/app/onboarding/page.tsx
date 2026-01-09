"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Briefcase, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { joinByCode } from "@/services/invitations";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardingPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode) {
      toast.error("Please enter a code");
      return;
    }
    setIsJoining(true);
    try {
      await joinByCode(inviteCode);
      toast.success("Successfully joined workspace!");
      router.push("/dashboard");
    } catch (error: any) {
        console.error(error);
        toast.error(error.response?.data?.detail || "Invalid code");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreate = () => {
    // Aici vom merge la Wizard-ul AI în pasul următor
    router.push("/onboarding/create");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-10 space-y-4">
        <h1 className="text-4xl font-bold text-white">Welcome to SDLC AI Hub</h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Let's set up your workspace. You can either join an existing team or create a new organization from scratch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        
        {/* OPTIUNEA A: JOIN TEAM */}
        <Card className="bg-slate-900 border-slate-800 hover:border-blue-500/50 transition duration-300">
          <CardHeader>
            <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <CardTitle className="text-xl text-white">Join a Team</CardTitle>
            <CardDescription className="text-slate-400">
              Have an invitation code? Enter it below to join your colleagues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              placeholder="Enter Invite Code (e.g., TEAM-X92)" 
              className="bg-slate-950 border-slate-700 text-white"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700" 
              onClick={handleJoin}
              disabled={isJoining}
            >
              {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Workspace
            </Button>
          </CardContent>
        </Card>

        {/* OPTIUNEA B: CREATE WORKSPACE */}
        <Card className="bg-slate-900 border-slate-800 hover:border-purple-500/50 transition duration-300">
          <CardHeader>
            <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
              <Briefcase className="w-6 h-6 text-purple-500" />
            </div>
            <CardTitle className="text-xl text-white">Create New Workspace</CardTitle>
            <CardDescription className="text-slate-400">
              Start a new organization and project. We'll help you pick the right methodology.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col justify-end h-full pt-8">
            <Button 
              variant="outline" 
              className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={handleCreate}
            >
              Start Setup Wizard <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}