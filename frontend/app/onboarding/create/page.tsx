"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Loader2, Sparkles, ArrowRight, CheckCircle2, ArrowLeft, 
  Upload, Plus, Trash2, Users, X, Image as ImageIcon, Settings 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

import { analyzeProjectNeeds, createWorkspace, createProject, AIAnalysisResponse } from "@/services/project";
import api from "@/lib/axios";

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

export default function CreateWorkspaceWizard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- STATE ---
  const [basicInfo, setBasicInfo] = useState({
    workspaceName: "",
    projectName: "",
    projectKey: "",
    description: ""
  });
  
  // Logo State
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [aiAnswers, setAiAnswers] = useState(initialAiAnswers);
  const [aiResult, setAiResult] = useState<AIAnalysisResponse | null>(null);
  const [selectedMethodology, setSelectedMethodology] = useState<string>(""); 

  // Roles State
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRoleIndex, setSelectedRoleIndex] = useState(0);

  // --- CONFIG ÎNTREBĂRI (Pentru Pasul 2) ---
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

  // --- HANDLERS PAS 1 (LOGO) ---
  const handleLogoClick = () => fileInputRef.current?.click();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
    }
  };

  const removeLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStep1Submit = () => {
    if (!basicInfo.workspaceName || !basicInfo.projectName || !basicInfo.projectKey) {
      toast.error("Please fill in required fields");
      return;
    }
    setStep(2);
  };

  // --- HANDLERS PAS 2 (AI) ---
  const handleAnalyze = async () => {
    if (Object.values(aiAnswers).some(val => val === "")) {
      toast.error("Please answer all questions so AI can help.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await analyzeProjectNeeds(aiAnswers);
      setAiResult(result);
      setSelectedMethodology(result.recommended); 
      setStep(3);
    } catch (error) {
      toast.error("AI Service unavailable.");
      // Fallback manual
      setAiResult({ recommended: "SCRUM", confidence_score: 0, reasoning: "Manual selection required.", pros: [], cons: [] });
      setSelectedMethodology("SCRUM");
      setStep(3);
    } finally {
      setIsLoading(false);
    }
  };

  // --- HANDLERS PAS 3 (SELECTION) ---
  const handleConfirmMethodology = () => {
      let defaultRoles: RoleDefinition[] = [];
      
      // LOGICA ACTUALIZATĂ PENTRU ROLURI CORECTE
      if (selectedMethodology === "SCRUM") {
          defaultRoles = [
              { name: "Product Owner", description: "Manages the Backlog & Vision", emails: [] },
              { name: "Scrum Master", description: "Servant Leader & Facilitator", emails: [] },
              { name: "Developer", description: "Builds the product increments", emails: [] }
          ];
      } else if (selectedMethodology === "KANBAN") {
          defaultRoles = [
              { name: "Service Request Manager", description: "Manages incoming work & prioritization", emails: [] },
              { name: "Service Delivery Manager", description: "Manages flow & removes blockers", emails: [] },
              { name: "Team Member", description: "Executes work items", emails: [] }
          ];
      } else if (selectedMethodology === "SCRUMBAN") {
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

  // --- HANDLERS PAS 4 (ROLES) ---
  const getAiRoles = async () => {
      setIsAiLoading(true);
      try {
          const res = await api.post("/projects/ai-roles", {
              methodology: selectedMethodology,
              project_description: basicInfo.description || basicInfo.projectName
          });
          if (res.data.roles && res.data.roles.length > 0) {
              const aiRoles = res.data.roles.map((r: any) => ({
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
      } catch (e) {
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
    setSelectedRoleIndex(roles.length); // Selectează noul rol imediat
  };

  const handleDeleteRole = (index: number) => {
    if (roles.length <= 1) {
      toast.error("You need at least one role.");
      return;
    }
    const newRoles = roles.filter((_, i) => i !== index);
    setRoles(newRoles);
    setSelectedRoleIndex(0);
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
      // 1. Create Workspace (TODO: Trimite și Logo-ul la backend în viitor)
      const ws = await createWorkspace(basicInfo.workspaceName);
      
      // 2. Create Project
      await createProject(ws.id, {
        name: basicInfo.projectName,
        key: basicInfo.projectKey,
        methodology: selectedMethodology, 
        description: basicInfo.description
      });

      console.log("Final Invite List:", roles);
      
      toast.success("Workspace & Team setup complete!");
      router.push("/dashboard");

    } catch (error) {
      console.error(error);
      toast.error("Failed setup.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-50">
      
      <div className="w-full max-w-5xl mb-8">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Identity</span>
            <span>AI Interview</span>
            <span>Decision</span>
            <span>Team & Roles</span>
        </div>
        <Progress value={(step / 4) * 100} className="h-2" />
      </div>

      <Card className="w-full max-w-5xl bg-slate-900 border-slate-800 shadow-2xl overflow-hidden min-h-[600px] flex flex-col">
        
        {/* --- STEP 1: BASICS --- */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Project Basics</CardTitle>
              <CardDescription>Establish your workspace identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 flex-1">
              <div className="flex flex-col md:flex-row gap-10">
                  
                  {/* LOGO UPLOAD FUNCȚIONAL */}
                  <div className="shrink-0 flex flex-col gap-2">
                      <Label>Logo</Label>
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
                            "w-40 h-40 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer transition relative overflow-hidden group",
                            logoPreview ? "border-blue-500 bg-slate-950" : "hover:border-blue-500 hover:bg-slate-800/50"
                        )}
                      >
                          {logoPreview ? (
                              <>
                                <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                                <div onClick={removeLogo} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                    <X className="w-8 h-8 text-white" />
                                </div>
                              </>
                          ) : (
                              <>
                                <ImageIcon className="w-10 h-10 text-slate-500 mb-2 group-hover:text-blue-400 transition" />
                                <span className="text-xs text-slate-400">Click to Upload</span>
                              </>
                          )}
                      </div>
                  </div>
                  
                  <div className="flex-1 space-y-6">
                    <div className="space-y-2">
                        <Label>Workspace Name</Label>
                        <Input 
                            placeholder="e.g. Acme Innovations"
                            value={basicInfo.workspaceName}
                            onChange={(e) => setBasicInfo({...basicInfo, workspaceName: e.target.value})}
                            className="bg-slate-950 border-slate-700 h-11 text-lg"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-2 space-y-2">
                            <Label>Project Name</Label>
                            <Input 
                                placeholder="e.g. SuperApp Rewrite"
                                value={basicInfo.projectName}
                                onChange={(e) => setBasicInfo({...basicInfo, projectName: e.target.value})}
                                className="bg-slate-950 border-slate-700 h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Key</Label>
                            <Input 
                                placeholder="APP"
                                value={basicInfo.projectKey}
                                onChange={(e) => setBasicInfo({...basicInfo, projectKey: e.target.value.toUpperCase()})}
                                maxLength={4}
                                className="bg-slate-950 border-slate-700 font-mono uppercase h-11"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Short Description</Label>
                        <Textarea 
                            placeholder="Briefly describe the goal..."
                            className="bg-slate-950 border-slate-700 resize-none h-20"
                            value={basicInfo.description}
                            onChange={(e) => setBasicInfo({...basicInfo, description: e.target.value})}
                        />
                    </div>
                  </div>
              </div>

              <div className="flex justify-end mt-auto pt-4">
                <Button onClick={handleStep1Submit} className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-md">
                    Next Step <ArrowRight className="ml-2 w-5 h-5"/>
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* --- STEP 2: AI INTERVIEW (DESIGN NOU & INPUT LIBER) --- */}
        {step === 2 && (
             <>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Sparkles className="text-purple-500 w-6 h-6" /> Methodology Advisor
               </CardTitle>
               <CardDescription>Tell us about your team. You can use the hints or type your own specifics.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-8 pb-10">
                
                {/* LISTA DE ÎNTREBĂRI UNA SUB ALTA */}
                <div className="space-y-8">
                    {questions.map((q, idx) => (
                        <div key={idx} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            <Label className="text-base font-medium text-slate-200">{q.question}</Label>
                            
                            {/* Input Liber */}
                            <Input 
                                placeholder={q.placeholder}
                                value={(aiAnswers as any)[q.key]}
                                onChange={(e) => setAiAnswers({...aiAnswers, [q.key]: e.target.value})}
                                className="bg-slate-950 border-slate-700 h-12"
                            />

                            {/* Hints / Sugestii */}
                            <div className="flex flex-wrap gap-2">
                                {q.hints.map((hint) => (
                                    <Badge 
                                        key={hint} 
                                        variant="outline" 
                                        className="cursor-pointer hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-500/50 transition py-1.5 px-3"
                                        onClick={() => setAiAnswers({...aiAnswers, [q.key]: hint})}
                                    >
                                        {hint}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between pt-8 border-t border-slate-800">
                    <Button variant="ghost" onClick={() => setStep(1)} size="lg"><ArrowLeft className="mr-2 w-4 h-4"/> Back</Button>
                    <Button onClick={handleAnalyze} disabled={isLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-md shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                        {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Processing...</> : <><Sparkles className="mr-2 h-5 w-5"/> Analyze & Recommend</>}
                    </Button>
                </div>
             </CardContent>
             </>
        )}

        {/* --- STEP 3: SELECTION --- */}
        {step === 3 && aiResult && (
             <>
             <CardHeader>
              <CardTitle className="text-center text-3xl">
                We recommend: <span className="text-blue-400 underline decoration-blue-500/30 underline-offset-4">{aiResult.recommended}</span>
              </CardTitle>
              <CardDescription className="text-center flex justify-center items-center gap-2 mt-2">
                Confidence: <Badge variant="secondary" className={aiResult.confidence_score > 80 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}>{aiResult.confidence_score}%</Badge>
              </CardDescription>
              
              <div className="bg-slate-950/80 p-6 rounded-xl border border-slate-800 mt-6 mx-auto max-w-3xl text-center shadow-inner">
                <p className="text-slate-300 italic text-lg leading-relaxed">"{aiResult.reasoning}"</p>
              </div>
            </CardHeader>

            <CardContent className="space-y-8 flex-1 flex flex-col">
              
              <div className="flex-1">
                  <h4 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-widest text-center">
                      Select Methodology
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {["SCRUM", "KANBAN", "SCRUMBAN"].map((method) => (
                          <div 
                            key={method}
                            onClick={() => setSelectedMethodology(method)}
                            className={cn(
                                "cursor-pointer p-6 rounded-2xl border-2 transition-all duration-300 relative flex flex-col items-center justify-center min-h-[160px] group",
                                selectedMethodology === method 
                                    ? "border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-105 z-10" 
                                    : "border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800 opacity-70 hover:opacity-100"
                            )}
                          >
                              {aiResult.recommended === method && (
                                  <div className="absolute -top-3">
                                      <Badge className="bg-purple-600 hover:bg-purple-700 border-none shadow-lg px-3 py-1">Best Fit</Badge>
                                  </div>
                              )}
                              
                              <h5 className={cn("font-bold text-xl mb-2 group-hover:text-blue-300", selectedMethodology === method ? "text-white" : "text-slate-400")}>
                                  {method}
                              </h5>
                              <p className="text-xs text-slate-500 text-center leading-relaxed px-2">
                                  {method === "SCRUM" && "Fixed sprints. Clear roles. Predictable velocity."}
                                  {method === "KANBAN" && "Continuous flow. No sprints. WIP limits."}
                                  {method === "SCRUMBAN" && "Hybrid. Planning buckets with continuous execution."}
                              </p>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-800">
                 <Button variant="ghost" onClick={() => setStep(2)} size="lg">
                    <ArrowLeft className="mr-2 w-4 h-4"/> Back to Questions
                </Button>
                <Button onClick={handleConfirmMethodology} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px] py-6 text-md">
                    Configure Team & Roles <ArrowRight className="ml-2 w-5 h-5"/>
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* --- STEP 4: TEAM & ROLES (COMPLET EDITABIL) --- */}
        {step === 4 && (
          <>
            <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Team Structure</CardTitle>
                        <CardDescription>Customize roles for <strong>{selectedMethodology}</strong>. You are in control.</CardDescription>
                    </div>
                    <Button variant="outline" onClick={getAiRoles} disabled={isAiLoading} className="border-purple-500 text-purple-400 hover:bg-purple-500/10">
                        {isAiLoading ? <Loader2 className="animate-spin mr-2 w-4 h-4"/> : <Sparkles className="mr-2 w-4 h-4"/>}
                        Suggest AI Roles
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 flex flex-col">
                
                <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-[400px]">
                    
                    {/* Lista de Roluri (Stânga) */}
                    <div className="w-full md:w-1/3 flex flex-col border-r border-slate-800 pr-4">
                        <Label className="text-xs text-slate-500 uppercase tracking-widest mb-3">Roles List</Label>
                        
                        <div className="space-y-2 flex-1 overflow-y-auto max-h-[400px]">
                            {roles.map((role, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedRoleIndex(idx)}
                                    className={cn(
                                        "p-4 rounded-lg cursor-pointer border transition flex flex-col gap-1 relative group",
                                        selectedRoleIndex === idx 
                                            ? "bg-blue-600/10 border-blue-500 shadow-md" 
                                            : "bg-slate-950 border-slate-800 hover:bg-slate-900 hover:border-slate-700"
                                    )}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={cn("font-bold text-sm", selectedRoleIndex === idx ? "text-blue-400" : "text-slate-200")}>
                                            {role.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{role.emails.length}</Badge>
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

                        {/* Buton Adaugare Rol Manual */}
                        <Button variant="outline" className="mt-4 border-dashed border-slate-700 text-slate-400 hover:text-white w-full" onClick={handleAddCustomRole}>
                            <Plus className="w-4 h-4 mr-2"/> Create Custom Role
                        </Button>
                    </div>

                    {/* Detalii Rol & Membri (Dreapta) */}
                    <div className="flex-1 flex flex-col bg-slate-950/50 p-6 rounded-xl border border-slate-800">
                        {roles[selectedRoleIndex] ? (
                            <>
                                {/* HEADER EDITABIL PENTRU ROL */}
                                <div className="mb-8 space-y-4 border-b border-slate-800 pb-6">
                                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                                        <Settings className="w-4 h-4"/> <span className="text-xs font-bold uppercase tracking-wider">Role Settings</span>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">Role Name</Label>
                                        <Input 
                                            value={roles[selectedRoleIndex].name}
                                            onChange={(e) => handleUpdateRole('name', e.target.value)}
                                            className="bg-slate-900 border-slate-700 font-bold text-lg h-10"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">Description</Label>
                                        <Textarea 
                                            value={roles[selectedRoleIndex].description}
                                            onChange={(e) => handleUpdateRole('description', e.target.value)}
                                            className="bg-slate-900 border-slate-700 resize-none h-16 text-sm text-slate-300"
                                        />
                                    </div>
                                </div>
                                
                                {/* ADĂUGARE MEMBRI */}
                                <div className="flex-1 flex flex-col">
                                    <Label className="mb-3 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-slate-500"/> Assign Members
                                    </Label>
                                    
                                    <div className="flex gap-2 mb-4">
                                        <Input 
                                            placeholder="colleague@company.com" 
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="bg-slate-900 border-slate-700"
                                            onKeyDown={(e) => e.key === "Enter" && addEmailToRole()}
                                        />
                                        <Button onClick={addEmailToRole} className="bg-blue-600 hover:bg-blue-700 shrink-0">
                                            <Plus className="w-4 h-4"/>
                                        </Button>
                                    </div>

                                    <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px] pr-2">
                                        {roles[selectedRoleIndex].emails.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-600 border border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                                                <Users className="w-8 h-8 mb-2 opacity-20"/>
                                                <p className="text-sm italic">No members assigned yet.</p>
                                            </div>
                                        )}
                                        {roles[selectedRoleIndex].emails.map((email, eIdx) => (
                                            <div key={eIdx} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg text-sm border border-slate-800 group hover:border-slate-600 transition">
                                                <span className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    {email}
                                                </span>
                                                <button onClick={() => removeEmail(selectedRoleIndex, eIdx)} className="text-slate-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition">
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

                <div className="flex justify-between pt-6 border-t border-slate-800">
                    <Button variant="ghost" onClick={() => setStep(3)} size="lg"><ArrowLeft className="mr-2 w-4 h-4"/> Change Methodology</Button>
                    <Button onClick={handleFinalSubmit} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white w-1/3 py-6 text-lg shadow-[0_0_25px_rgba(22,163,74,0.3)]">
                        {isLoading ? <Loader2 className="animate-spin mr-2"/> : "Launch Project 🚀"}
                    </Button>
                </div>

            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}