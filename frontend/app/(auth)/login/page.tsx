"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link"; // <--- AM ADĂUGAT IMPORTUL ASTA
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { loginUser, getMyWorkspaces } from "@/services/auth";
import { checkPendingInvites, joinByCode } from "@/services/invitations"; 

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // Stare pentru Invitație Găsită
  const [pendingInvite, setPendingInvite] = useState<any>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // 1. Login
      const response = await loginUser(values);
      localStorage.setItem("token", response.access_token);
      toast.success("Welcome back!");

      // 2. VERIFICARE INVITAȚII (Fluxul A)
      const inviteCheck = await checkPendingInvites();
      
      if (inviteCheck.has_pending) {
        // Cazul A: Invitație găsită -> Deschidem Dialogul
        setPendingInvite(inviteCheck);
        setShowInviteDialog(true);
        setIsLoading(false); 
        return; 
      }

      // 3. Dacă nu are invitații, verificăm dacă are deja workspace-uri
      handleRouting();

    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || "Invalid credentials.";
      toast.error(msg);
      setIsLoading(false);
    }
  }

  const handleRouting = async () => {
      const workspaces = await getMyWorkspaces();
      if (workspaces.length > 0) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding"); // Cazul B: The Fork
      }
  };

  const acceptInvite = async () => {
    try {
        await joinByCode(pendingInvite.code); 
        toast.success(`Joined ${pendingInvite.workspace_name} successfully!`);
        router.push("/dashboard");
    } catch (e) {
        toast.error("Failed to join.");
    }
  };

  const declineInvite = () => {
      setShowInviteDialog(false);
      handleRouting(); 
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 bg-slate-950">
      
      {/* Dialog Confirmare Invitație Automată */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Invitation Found!</DialogTitle>
            <DialogDescription>
              We found a pending invitation for <strong>{pendingInvite?.workspace_name}</strong> associated with your email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
             <Mail className="w-12 h-12 text-blue-500" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={declineInvite}>Skip / Create my own</Button>
            <Button onClick={acceptInvite} className="bg-blue-600 hover:bg-blue-700">Accept & Join</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-50 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-blue-500 flex items-center justify-center gap-2">
            <LogIn className="w-6 h-6" /> Login
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Enter your credentials to access your workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" {...field} className="bg-slate-950 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="******" {...field} className="bg-slate-950 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </Form>

          {/* --- LINK CĂTRE REGISTER ADĂUGAT AICI --- */}
          <div className="mt-4 text-center text-sm text-slate-400">
            Don't have an account?{" "}
            <Link href="/register" className="text-blue-400 hover:underline">
              Sign Up
            </Link>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}