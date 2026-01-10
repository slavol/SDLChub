"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, LogIn, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { loginUser } from "@/services/auth";
import { getMyProjects } from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";

// Schema de validare
const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);
  const [isLoading, setIsLoading] = useState(false);
  
  // Stare pentru vizibilitatea parolei
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // 1. Login
      const data = await loginUser(values);
      setToken(data.access_token);
      toast.success("Welcome back!");

      // 2. Verificăm Invitațiile (Cerința A)
      if (data.has_pending_invites) {
        toast.info("You have pending invitations! Check your email or dashboard.");
      }

      // 3. Routing Inteligent (Dashboard vs Onboarding)
      try {
          const projects = await getMyProjects();
          if (projects.length > 0) {
              router.push("/dashboard");
          } else {
              router.push("/onboarding"); // "The Fork"
          }
      } catch (e) {
          router.push("/onboarding");
      }

    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 text-slate-50 shadow-2xl backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
           <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold">SD</div>
           SDLC Hub
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
                    <Input placeholder="john@example.com" {...field} className="bg-slate-950 border-slate-700 focus:border-blue-500" />
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
                    <div className="relative">
                        <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="******" 
                            {...field} 
                            className="bg-slate-950 border-slate-700 focus:border-blue-500 pr-10" 
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  {/* MODIFICARE AICI: Am mutat link-ul sub input, aliniat la dreapta */}
                  <div className="flex justify-end">
                    <Link href="/forgot-password" className="text-xs text-blue-500 hover:underline">
                        Forgot password?
                    </Link>
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Sign In
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-slate-800 pt-4">
          <p className="text-sm text-slate-400">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-500 hover:underline font-medium">
                  Sign up
              </Link>
          </p>
      </CardFooter>
    </Card>
  );
}