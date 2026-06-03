"use client";
import Image from "next/image";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Loader2, Sparkles, ArrowRight, ArrowLeft, 
  Plus, Trash2, Users, X, Image as ImageIcon, Settings, BrainCircuit, Rocket,
  Github, GitBranch, PlugZap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/use-project-store";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

// --- IMPORTURILE CORECTE DIN SERVICE (LOGICA V1) ---
import { 
    getAIRecommendation, 
    getAIRoles, 
    createProjectFull, 
    AIRecommendationResponse 
} from "@/services/project";
import { upsertProjectGitHubIntegration } from "@/services/github";

// --- TIPURI ---
interface RoleDefinition {
  name: string;
  description: string;
  emails: string[]; 
}

interface QuestionConfig {
  key: keyof typeof initialAiAnswers;
  question: string;
  placeholder: string;
  hints: string[];
}

const initialAiAnswers = {
  team_size: "",
  work_nature: "",
  volatility: "",
  experience: "",
  metrics: ""
};

function normalizeWebhookUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/github/webhook")) return trimmed;
  return `${trimmed}/github/webhook`;
}

function repoUrlFromFullName(value: string) {
  const repo = value
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  return repo.includes("/") ? `https://github.com/${repo}` : "";
}

export default function ProjectWizard() {
  const router = useRouter();
  const { setCurrentProject } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- STATE ---
  const [basicInfo, setBasicInfo] = useState({
    projectName: "",
    projectKey: "",
    description: ""
  });
  
  // Logo State (Doar vizual momentan)
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [aiAnswers, setAiAnswers] = useState(initialAiAnswers);
  const [aiResult, setAiResult] = useState<AIRecommendationResponse | null>(null);
  const [selectedMethodology, setSelectedMethodology] = useState<string>(""); 

  // Roles State
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);
  const [githubSetup, setGithubSetup] = useState({
    enabled: false,
    repositoryFullName: "",
    repositoryUrl: "",
    defaultBranch: "main",
    publicBaseUrl: "",
    autoLinkCommits: true,
    autoTransitionPrs: true,
  });

  // --- CONFIG ÎNTREBĂRI (Pasul 2) ---
  const questions: QuestionConfig[] = [
    {
      key: "team_size",
      question: "How many people will actively work on this project?",
      placeholder: "e.g. 5 developers",
      hints: ["Small (3-5)", "Medium (6-9)", "Large (10+)", "Just me"]
    },
    {
      key: "experience",
      question: "How experienced is the team with Agile methodologies?",
      placeholder: "e.g. Mixed seniors and juniors",
      hints: ["Junior / Learning", "Experienced Agile Team", "Expert / Autonomous"]
    },
    {
      key: "work_nature",
      question: "What is the primary nature of the work?",
      placeholder: "e.g. Building a new MVP from scratch",
      hints: ["New Features (Planned)", "Maintenance & Bugs (Reactive)", "Research & R&D"]
    },
    {
      key: "volatility",
      question: "How often do priorities or requirements change?",
      placeholder: "e.g. We stick to the plan for 2 weeks",
      hints: ["Low (Stable)", "Medium (Sprint changes)", "High (Daily urgent changes)"]
    },
    {
      key: "metrics",
      question: "What is the most important success metric right now?",
      placeholder: "e.g. Shipping fast",
      hints: ["Predictability (Deadlines)", "Speed (Cycle Time)", "Quality (Bug-free)"]
    }
  ];

  // --- HANDLERS PAS 1 (LOGO & IDENTITY) ---
  const handleLogoClick = () => fileInputRef.current?.click();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStep1Submit = () => {
    if (!basicInfo.projectName || !basicInfo.projectKey) {
      toast.error("Please fill in Project Name and Key");
      return;
    }
    setStep(2);
  };

  // --- HANDLERS PAS 2 (AI ANALYSIS) ---
  const handleAnalyze = async () => {
    if (Object.values(aiAnswers).some(val => val.trim() === "")) {
      toast.error("Please answer all questions so AI can help.");
      return;
    }
    setIsLoading(true);
    try {
      // APEL CORECT CĂTRE SERVICE V1
      const result = await getAIRecommendation(aiAnswers);
      setAiResult(result);
      setSelectedMethodology(result.recommended); 
      setStep(3);
    } catch (error) {
      console.error(error);
      toast.error("AI Service unavailable. Using manual mode.");
      // Fallback manual
      setAiResult({ 
          recommended: "SCRUM", 
          confidence_score: 0, 
          reasoning: "Manual selection required due to AI timeout.", 
          pros: [], 
          cons: [] 
      });
      setSelectedMethodology("SCRUM");
      setStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  // --- HANDLERS PAS 3 (METHODOLOGY SELECTION) ---
  const handleConfirmMethodology = () => {
      let defaultRoles: RoleDefinition[] = [];
      
      if (selectedMethodology === "SCRUM") {
          defaultRoles = [
              { name: "Product Owner", description: "Manages the Backlog & Vision", emails: [] },
              { name: "Scrum Master", description: "Servant Leader & Facilitator", emails: [] },
              { name: "Developer", description: "Builds the product increments", emails: [] }
          ];
      } else if (selectedMethodology === "KANBAN") {
          defaultRoles = [
              { name: "Project Manager", description: "Manages incoming work & prioritization", emails: [] },
              { name: "Flow Manager", description: "Manages flow & removes blockers", emails: [] },
              { name: "Developer", description: "Executes work items", emails: [] }
          ];
      } else {
           defaultRoles = [
              { name: "Product Owner", description: "Prioritizes high-level items", emails: [] },
              { name: "Flow Master", description: "Ensures continuous flow & limits WIP", emails: [] },
              { name: "Developer", description: "Executes tasks", emails: [] }
          ];
      }
      
      setRoles(defaultRoles);
      setSelectedRoleIndex(0);
      setStep(4);
  };

  // --- HANDLERS PAS 4 (ROLES & TEAM) ---
  const handleGetAiRoles = async () => {
      setIsAiLoading(true);
      try {
          // APEL CORECT CĂTRE SERVICE V1
          const res = await getAIRoles({
              methodology: selectedMethodology,
              description: basicInfo.description || basicInfo.projectName
          });
          
          if (res.roles && res.roles.length > 0) {
              const aiRoles = res.roles.map((r) => ({
                  name: r.name,
                  description: r.description,
                  emails: []
              }));
              setRoles(aiRoles);
              setSelectedRoleIndex(0);
              toast.success("Roles generated by AI!");
          } else {
             toast.info("AI couldn't suggest roles, keeping defaults.");
          }
      } catch {
          toast.error("AI Role suggestion failed");
      } finally {
          setIsAiLoading(false);
      }
  };

  const handleAddCustomRole = () => {
    const newRole: RoleDefinition = {
      name: "New Role",
      description: "Description of the role...",
      emails: []
    };
    setRoles([...roles, newRole]);
    setSelectedRoleIndex(roles.length);
  };

  const handleDeleteRole = (index: number) => {
    if (roles.length <= 1) {
      toast.error("You need at least one role.");
      return;
    }
    const newRoles = roles.filter((_, i) => i !== index);
    setRoles(newRoles);
    if (index === selectedRoleIndex) {
        setSelectedRoleIndex(0);
    } else if (index < selectedRoleIndex) {
        setSelectedRoleIndex(selectedRoleIndex - 1);
    }
  };

  const handleUpdateRole = (field: 'name' | 'description', value: string) => {
    const newRoles = [...roles];
    newRoles[selectedRoleIndex] = {
      ...newRoles[selectedRoleIndex],
      [field]: value
    };
    setRoles(newRoles);
  };

  const addEmailToRole = () => {
      if (!inviteEmail || !inviteEmail.includes("@")) {
          toast.error("Invalid email");
          return;
      }
      if (!roles[selectedRoleIndex]) return;

      if (roles[selectedRoleIndex].emails.includes(inviteEmail)) {
          toast.warning("Email already added to this role");
          return;
      }

      const newRoles = [...roles];
      newRoles[selectedRoleIndex].emails.push(inviteEmail);
      setRoles(newRoles);
      setInviteEmail("");
      toast.success(`Added to ${newRoles[selectedRoleIndex].name}`);
  };

  const removeEmail = (roleIndex: number, emailIndex: number) => {
      const newRoles = [...roles];
      newRoles[roleIndex].emails.splice(emailIndex, 1);
      setRoles(newRoles);
  };

  // --- FINAL SUBMIT ---
  const handleFinalSubmit = async () => {
    setIsLoading(true);
    try {
      const project = await createProjectFull({
        name: basicInfo.projectName,
        key: basicInfo.projectKey,
        description: basicInfo.description,
        methodology: selectedMethodology,
        roles,
      });

      if (githubSetup.enabled) {
        const repositoryFullName = githubSetup.repositoryFullName.trim();
        if (!repositoryFullName || !repositoryFullName.includes("/")) {
          toast.warning("Project created. GitHub setup was skipped because repository format is incomplete.");
        } else {
          try {
            await upsertProjectGitHubIntegration(project.id, {
              repository_full_name: repositoryFullName,
              repository_url: githubSetup.repositoryUrl.trim() || repoUrlFromFullName(repositoryFullName),
              default_branch: githubSetup.defaultBranch.trim() || "main",
              webhook_url: normalizeWebhookUrl(githubSetup.publicBaseUrl) || null,
              auto_link_commits: githubSetup.autoLinkCommits,
              auto_transition_prs: githubSetup.autoTransitionPrs,
            });
            toast.success("GitHub repository connected to the project.");
          } catch {
            toast.warning("Project created. GitHub setup can be completed later from DevOps.");
          }
        }
      }

      setCurrentProject(project);
      
      toast.success("Project launched successfully! 🚀");
      router.push("/dashboard");

    } catch (error) {
      console.error(error);
      toast.error("Failed to create project. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-50 relative">
      
      {/* CANCEL BUTTON */}
      <div className="absolute top-6 right-6">
          <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full h-10 w-10 p-0" onClick={() => router.push('/onboarding')}>
              <X className="w-5 h-5" />
          </Button>
      </div>

      <div className="w-full max-w-5xl mb-8">
        <div className="mb-2 grid grid-cols-2 gap-2 text-xs font-medium tracking-wide text-slate-400 sm:grid-cols-5 sm:text-sm">
            <span className={step >= 1 ? "text-blue-400 transition-colors" : ""}>Identity</span>
            <span className={step >= 2 ? "text-blue-400 transition-colors" : ""}>AI Interview</span>
            <span className={step >= 3 ? "text-blue-400 transition-colors" : ""}>Decision</span>
            <span className={step >= 4 ? "text-blue-400 transition-colors" : ""}>Team & Roles</span>
            <span className={step >= 5 ? "text-blue-400 transition-colors" : ""}>DevOps Setup</span>
        </div>
        <Progress value={(step / 5) * 100} className="h-1 bg-slate-800" />
      </div>

      <Card className="w-full max-w-5xl bg-slate-900 border-slate-800 shadow-2xl overflow-hidden min-h-[600px] flex flex-col backdrop-blur-sm bg-slate-900/80">
        
        {/* --- STEP 1: BASICS --- */}
        {step === 1 && (
          <>
            <CardHeader className="border-b border-slate-800/50 pb-8 pt-8 px-8">
              <CardTitle className="text-3xl">Project Basics</CardTitle>
              <CardDescription className="text-lg">Establish your project identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 flex-1 p-8">
              <div className="flex flex-col md:flex-row gap-12">
                  
                  {/* LOGO UPLOAD (Cosmetic) */}
                  <div className="shrink-0 flex flex-col gap-3">
                      <Label className="text-base">Project Logo</Label>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange}
                      />
                      <div 
                        onClick={handleLogoClick}
                        className={cn(
                            "w-48 h-48 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden group bg-slate-950",
                            logoPreview ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]" : "hover:border-blue-500 hover:bg-slate-900"
                        )}
                      >
                          {logoPreview ? (
                              <>
                                <Image
                                  src={logoPreview}
                                  alt="Logo Preview"
                                  fill
                                  sizes="192px"
                                  className="object-cover"
                                  unoptimized
                                />
                                <div onClick={removeLogo} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                    <X className="w-8 h-8 text-white" />
                                </div>
                              </>
                          ) : (
                              <>
                                <div className="bg-slate-800 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                    <ImageIcon className="w-8 h-8 text-slate-400 group-hover:text-blue-400" />
                                </div>
                                <span className="text-sm font-medium text-slate-400 group-hover:text-white">Click to Upload</span>
                              </>
                          )}
                      </div>
                  </div>
                  
                  {/* FORMULAR PROIECT */}
                  <div className="flex-1 space-y-8">
                    <div className="grid gap-8 md:grid-cols-3">
                        <div className="space-y-3 md:col-span-2">
                            <Label className="text-base">Project Name</Label>
                            <Input 
                                placeholder="e.g. SuperApp Rewrite"
                                value={basicInfo.projectName}
                                onChange={(e) => setBasicInfo({...basicInfo, projectName: e.target.value})}
                                className="bg-slate-950 border-slate-700 h-12 text-lg focus:border-blue-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-base">Key</Label>
                            <Input 
                                placeholder="APP"
                                value={basicInfo.projectKey}
                                onChange={(e) => setBasicInfo({...basicInfo, projectKey: e.target.value.toUpperCase()})}
                                maxLength={5}
                                className="bg-slate-950 border-slate-700 font-mono uppercase h-12 text-lg tracking-wider text-center focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Label className="text-base">Short Description</Label>
                        <Textarea 
                            placeholder="Briefly describe the goal..."
                            className="bg-slate-950 border-slate-700 resize-none h-32 text-base focus:border-blue-500 transition-colors"
                            value={basicInfo.description}
                            onChange={(e) => setBasicInfo({...basicInfo, description: e.target.value})}
                        />
                    </div>
                  </div>
              </div>

              <div className="flex justify-end mt-auto pt-4">
                <Button onClick={handleStep1Submit} className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg font-medium shadow-lg hover:shadow-blue-500/20 transition-all duration-300">
                    Next Step <ArrowRight className="ml-2 w-5 h-5"/>
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* --- STEP 2: AI INTERVIEW --- */}
        {step === 2 && (
             <>
             <CardHeader className="border-b border-slate-800/50 pb-8 pt-8 px-8">
               <CardTitle className="flex items-center gap-3 text-3xl">
                 <Sparkles className="text-purple-500 w-8 h-8" /> Methodology Advisor
               </CardTitle>
               <CardDescription className="text-lg">Tell us about your team. Our AI will analyze your context.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-8 pb-10 p-8 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                
                <div className="space-y-10">
                    {questions.map((q, idx) => (
                        <div key={idx} className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both" style={{ animationDelay: `${idx * 150}ms` }}>
                            <Label className="text-lg font-medium text-slate-200">{q.question}</Label>
                            
                            <Input 
                                placeholder={q.placeholder}
                                value={aiAnswers[q.key]}
                                onChange={(e) => setAiAnswers({...aiAnswers, [q.key]: e.target.value})}
                                className="bg-slate-950 border-slate-700 h-14 text-lg focus:border-purple-500 transition-colors"
                            />

                            <div className="flex flex-wrap gap-2">
                                {q.hints.map((hint) => (
                                    <Badge 
                                        key={hint} 
                                        variant="outline" 
                                        className="cursor-pointer hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/50 transition py-1.5 px-3 text-slate-400 text-sm font-normal"
                                        onClick={() => setAiAnswers({...aiAnswers, [q.key]: hint})}
                                    >
                                        {hint}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between pt-8 border-t border-slate-800/50 mt-8">
                    <Button variant="ghost" onClick={() => setStep(1)} size="lg" className="text-slate-400 hover:text-white"><ArrowLeft className="mr-2 w-5 h-5"/> Back</Button>
                    <Button onClick={handleAnalyze} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] transition-all duration-300">
                        {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Processing...</> : <><BrainCircuit className="mr-2 h-5 w-5"/> Analyze & Recommend</>}
                    </Button>
                </div>
             </CardContent>
             </>
        )}

        {/* --- STEP 3: SELECTION --- */}
        {step === 3 && aiResult && (
             <>
             <CardHeader className="pb-2 pt-10">
              <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 rounded-full mb-2">
                     <BrainCircuit className="w-10 h-10 text-blue-400" />
                  </div>
                  <CardTitle className="text-4xl">
                    We recommend: <span className="text-blue-400 underline decoration-blue-500/30 underline-offset-8 decoration-4">{aiResult.recommended}</span>
                  </CardTitle>
                  <CardDescription className="flex justify-center items-center gap-3 mt-2 text-lg">
                    AI Confidence: 
                    <Badge className={cn("text-base px-3 py-1", aiResult.confidence_score > 80 ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-yellow-500/20 text-yellow-400")}>
                        {aiResult.confidence_score}%
                    </Badge>
                  </CardDescription>
              </div>
              
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 mt-8 mx-auto max-w-3xl text-center shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <p className="text-slate-300 italic text-xl leading-relaxed relative z-10">{aiResult.reasoning}</p>
                <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-blue-500/5 z-0 group-hover:text-blue-500/10 transition-colors duration-500" />
              </div>
            </CardHeader>

            <CardContent className="space-y-8 flex-1 flex flex-col p-8">
              
              <div className="flex-1 mt-6">
                  <h4 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-[0.2em] text-center">
                      Select Methodology to Proceed
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {["SCRUM", "KANBAN", "SCRUMBAN"].map((method) => (
                          <div 
                            key={method}
                            onClick={() => setSelectedMethodology(method)}
                            className={cn(
                                "cursor-pointer p-8 rounded-2xl border-2 transition-all duration-300 relative flex flex-col items-center justify-center min-h-[200px] group",
                                selectedMethodology === method 
                                    ? "border-blue-500 bg-blue-900/10 shadow-[0_0_40px_rgba(59,130,246,0.2)] scale-105 z-10" 
                                    : "border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800 opacity-60 hover:opacity-100 hover:-translate-y-1"
                            )}
                          >
                              {aiResult.recommended === method && (
                                  <div className="absolute -top-4">
                                      <Badge className="bg-purple-600 hover:bg-purple-700 border-none shadow-lg px-4 py-1.5 text-sm uppercase tracking-wider font-bold">Best Fit</Badge>
                                  </div>
                              )}
                              
                              <h5 className={cn("font-bold text-2xl mb-3 group-hover:text-blue-300 transition-colors", selectedMethodology === method ? "text-white" : "text-slate-400")}>
                                  {method}
                              </h5>
                              <p className="text-sm text-slate-500 text-center leading-relaxed px-2 group-hover:text-slate-400">
                                  {method === "SCRUM" && "Fixed sprints. Clear roles. Predictable velocity."}
                                  {method === "KANBAN" && "Continuous flow. No sprints. WIP limits."}
                                  {method === "SCRUMBAN" && "Hybrid. Planning buckets with continuous execution."}
                              </p>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="flex justify-between pt-8 border-t border-slate-800">
                 <Button variant="ghost" onClick={() => setStep(2)} size="lg" className="text-slate-400 hover:text-white">
                    <ArrowLeft className="mr-2 w-5 h-5"/> Back to Questions
                </Button>
                <Button onClick={handleConfirmMethodology} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px] py-6 text-lg font-medium shadow-lg hover:shadow-blue-500/20 transition-all">
                    Configure Team & Roles <ArrowRight className="ml-2 w-5 h-5"/>
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* --- STEP 4: TEAM & ROLES --- */}
        {step === 4 && (
          <>
            <CardHeader className="pb-4 border-b border-slate-800/50 pt-8 px-8">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-2xl">Team Structure</CardTitle>
                        <CardDescription className="text-base mt-1">
                            Customize roles for <strong className="text-blue-400">{selectedMethodology}</strong>.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={handleGetAiRoles} disabled={isAiLoading} className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500">
                        {isAiLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4"/> : <Sparkles className="mr-2 w-4 h-4"/>}
                        Suggest AI Roles
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 flex flex-col p-8">
                
                <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-[400px]">
                    
                    {/* Lista de Roluri (Stânga) */}
                    <div className="w-full md:w-1/3 flex flex-col border-r border-slate-800 pr-8">
                        <Label className="text-xs text-slate-500 uppercase tracking-widest mb-4 font-bold">Roles List</Label>
                        
                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                            {roles.map((role, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedRoleIndex(idx)}
                                    className={cn(
                                        "p-4 rounded-xl cursor-pointer border transition-all duration-200 flex flex-col gap-1 relative group",
                                        selectedRoleIndex === idx 
                                            ? "bg-blue-600/10 border-blue-500 shadow-[inset_4px_0_0_0_#3b82f6]" 
                                            : "bg-slate-950 border-slate-800 hover:bg-slate-900 hover:border-slate-700"
                                    )}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={cn("font-bold text-sm", selectedRoleIndex === idx ? "text-blue-400" : "text-slate-200")}>
                                            {role.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {role.emails.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-green-500/20 text-green-400">{role.emails.length}</Badge>}
                                            {roles.length > 1 && (
                                                <Trash2 
                                                    className="w-4 h-4 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteRole(idx); }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 line-clamp-1">{role.description}</div>
                                </div>
                            ))}
                        </div>

                        <Button variant="outline" className="mt-4 border-dashed border-slate-700 text-slate-400 hover:text-white w-full hover:bg-slate-800" onClick={handleAddCustomRole}>
                            <Plus className="w-4 h-4 mr-2"/> Create Custom Role
                        </Button>
                    </div>

                    {/* Detalii Rol (Dreapta) */}
                    <div className="flex-1 flex flex-col bg-slate-950/30 p-8 rounded-2xl border border-slate-800 shadow-inner">
                        {roles[selectedRoleIndex] ? (
                            <>
                                {/* HEADER EDITABIL PENTRU ROL */}
                                <div className="mb-8 space-y-6 border-b border-slate-800 pb-8">
                                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                                        <Settings className="w-4 h-4"/> <span className="text-xs font-bold uppercase tracking-wider">Role Configuration</span>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 uppercase font-bold">Role Name</Label>
                                        <Input 
                                            value={roles[selectedRoleIndex].name}
                                            onChange={(e) => handleUpdateRole('name', e.target.value)}
                                            className="bg-slate-900 border-slate-700 font-bold text-xl h-12 focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 uppercase font-bold">Description</Label>
                                        <Textarea 
                                            value={roles[selectedRoleIndex].description}
                                            onChange={(e) => handleUpdateRole('description', e.target.value)}
                                            className="bg-slate-900 border-slate-700 resize-none h-24 text-base text-slate-300 focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                
                                {/* ADĂUGARE MEMBRI */}
                                <div className="flex-1 flex flex-col">
                                    <Label className="mb-4 flex items-center gap-2 text-slate-300">
                                        <Users className="w-4 h-4 text-slate-500"/> Assign Members <span className="text-xs text-slate-500 font-normal ml-auto">(Invite by email)</span>
                                    </Label>
                                    
                                    <div className="flex gap-3 mb-6">
                                        <Input 
                                            placeholder="colleague@company.com" 
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="bg-slate-900 border-slate-700 h-11"
                                            onKeyDown={(e) => e.key === "Enter" && addEmailToRole()}
                                        />
                                        <Button onClick={addEmailToRole} className="bg-blue-600 hover:bg-blue-700 shrink-0 w-12 h-11 p-0">
                                            <Plus className="w-5 h-5"/>
                                        </Button>
                                    </div>

                                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px] pr-2">
                                        {roles[selectedRoleIndex].emails.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-24 text-slate-600 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                                                <Users className="w-6 h-6 mb-2 opacity-30"/>
                                                <p className="text-sm italic">No members assigned yet.</p>
                                            </div>
                                        )}
                                        {roles[selectedRoleIndex].emails.map((email, eIdx) => (
                                            <div key={eIdx} className="flex justify-between items-center bg-slate-900 p-3 pl-4 rounded-lg text-sm border border-slate-800 group hover:border-slate-600 transition animate-in fade-in slide-in-from-left-2">
                                                <span className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                                                    <span className="text-slate-200">{email}</span>
                                                </span>
                                                <button onClick={() => removeEmail(selectedRoleIndex, eIdx)} className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100">
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">
                                <p>Select a role to edit.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col justify-between gap-3 border-t border-slate-800 pt-8 sm:flex-row sm:items-center mt-4">
                    <Button variant="ghost" onClick={() => setStep(3)} size="lg" className="text-slate-400 hover:text-white"><ArrowLeft className="mr-2 w-5 h-5"/> Change Methodology</Button>
                    <Button onClick={() => setStep(5)} className="w-full bg-blue-600 py-6 text-xl font-bold text-white shadow-[0_0_30px_rgba(37,99,235,0.35)] transition-all duration-500 hover:bg-blue-700 hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] sm:w-auto lg:w-1/3">
                        <span className="flex items-center">Continue to DevOps <ArrowRight className="ml-2 w-6 h-6"/></span>
                    </Button>
                </div>

            </CardContent>
          </>
        )}

        {/* --- STEP 5: OPTIONAL DEVOPS SETUP --- */}
        {step === 5 && (
          <>
            <CardHeader className="border-b border-slate-800/50 px-8 pb-6 pt-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                    <Github className="h-3.5 w-3.5" />
                    Optional repository connection
                  </div>
                  <CardTitle className="text-3xl">DevOps Setup</CardTitle>
                  <CardDescription className="mt-2 max-w-2xl text-base">
                    Connect GitHub now if you already know the repository. You can skip this and configure it once from the DevOps tab later.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant={githubSetup.enabled ? "default" : "outline"}
                  onClick={() =>
                    setGithubSetup((current) => ({ ...current, enabled: !current.enabled }))
                  }
                  className={githubSetup.enabled ? "bg-blue-600 hover:bg-blue-700" : "border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"}
                >
                  <PlugZap className="mr-2 h-4 w-4" />
                  {githubSetup.enabled ? "Repository setup on" : "Enable setup"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-6 p-8">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <Github className="mb-4 h-6 w-6 text-slate-300" />
                  <p className="font-semibold text-white">One-time setup</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    After saving it here, the repository details are shown in Settings and managed from DevOps.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <GitBranch className="mb-4 h-6 w-6 text-blue-300" />
                  <p className="font-semibold text-white">Task automation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Commit messages and pull requests can link to keys like {basicInfo.projectKey || "APP"}-123.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                  <Settings className="mb-4 h-6 w-6 text-purple-300" />
                  <p className="font-semibold text-white">Safe to skip</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    The project launches normally even when the repository is not ready yet.
                  </p>
                </div>
              </div>

              {githubSetup.enabled ? (
                <div className="rounded-3xl border border-blue-500/20 bg-blue-500/[0.06] p-6">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Repository</Label>
                      <Input
                        value={githubSetup.repositoryFullName}
                        onChange={(event) => {
                          const value = event.target.value;
                          setGithubSetup((current) => ({
                            ...current,
                            repositoryFullName: value,
                            repositoryUrl: current.repositoryUrl || repoUrlFromFullName(value),
                          }));
                        }}
                        placeholder="owner/repository"
                        className="h-12 border-slate-700 bg-slate-950 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Default branch</Label>
                      <Input
                        value={githubSetup.defaultBranch}
                        onChange={(event) =>
                          setGithubSetup((current) => ({
                            ...current,
                            defaultBranch: event.target.value,
                          }))
                        }
                        placeholder="main"
                        className="h-12 border-slate-700 bg-slate-950 text-base"
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Repository URL</Label>
                      <Input
                        value={githubSetup.repositoryUrl}
                        onChange={(event) =>
                          setGithubSetup((current) => ({
                            ...current,
                            repositoryUrl: event.target.value,
                          }))
                        }
                        placeholder="https://github.com/owner/repository"
                        className="h-12 border-slate-700 bg-slate-950 text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Public backend / ngrok URL</Label>
                      <Input
                        value={githubSetup.publicBaseUrl}
                        onChange={(event) =>
                          setGithubSetup((current) => ({
                            ...current,
                            publicBaseUrl: event.target.value,
                          }))
                        }
                        placeholder="https://abc123.ngrok-free.app"
                        className="h-12 border-slate-700 bg-slate-950 text-base"
                      />
                      <p className="text-xs text-slate-500">
                        If filled, SDLC Hub stores {normalizeWebhookUrl(githubSetup.publicBaseUrl) || "/github/webhook"} as the webhook payload URL.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setGithubSetup((current) => ({
                          ...current,
                          autoLinkCommits: !current.autoLinkCommits,
                        }))
                      }
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        githubSetup.autoLinkCommits
                          ? "border-blue-500/30 bg-blue-500/10"
                          : "border-slate-800 bg-slate-950"
                      )}
                    >
                      <p className="font-semibold text-white">Auto-link commits</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Link commits containing project task keys to their issues.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setGithubSetup((current) => ({
                          ...current,
                          autoTransitionPrs: !current.autoTransitionPrs,
                        }))
                      }
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        githubSetup.autoTransitionPrs
                          ? "border-purple-500/30 bg-purple-500/10"
                          : "border-slate-800 bg-slate-950"
                      )}
                    >
                      <p className="font-semibold text-white">PR smart transitions</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Pull request activity can suggest moving tasks toward Review.
                      </p>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-950/50 p-8 text-center">
                  <Github className="mx-auto mb-4 h-10 w-10 text-slate-600" />
                  <p className="text-lg font-semibold text-white">Repository setup skipped for now</p>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    DevOps remains available after launch. The owner can connect GitHub once from the DevOps tab and the saved details will appear in Settings.
                  </p>
                </div>
              )}

              <div className="mt-auto flex flex-col justify-between gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:items-center">
                <Button variant="ghost" onClick={() => setStep(4)} size="lg" className="text-slate-400 hover:text-white">
                  <ArrowLeft className="mr-2 h-5 w-5" /> Back to Team
                </Button>
                <Button
                  onClick={handleFinalSubmit}
                  disabled={isLoading}
                  className="bg-green-600 px-8 py-6 text-lg font-bold text-white shadow-[0_0_30px_rgba(22,163,74,0.35)] transition-all duration-500 hover:bg-green-700 hover:shadow-[0_0_40px_rgba(22,163,74,0.5)]"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <span className="flex items-center">
                      Launch Project <Rocket className="ml-2 h-5 w-5 animate-pulse" />
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
