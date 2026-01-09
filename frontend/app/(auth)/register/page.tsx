"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, UserPlus, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import api from "@/lib/axios";

const formSchema = z.object({
  full_name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // Stare nouă pentru succes

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { full_name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      // Apelăm endpoint-ul de register
      await api.post("/auth/register", {
          email: values.email,
          password: values.password,
          full_name: values.full_name
      });
      
      // NU mai facem login automat. Afișăm ecranul de succes.
      setIsSuccess(true);
      toast.success("Account created! Check your email.");

    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  }

  // --- ECRANUL DE SUCCES ---
  if (isSuccess) {
      return (
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 text-slate-50 shadow-2xl backdrop-blur-sm text-center p-6">
            <div className="flex justify-center mb-6">
                <div className="h-20 w-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/50">
                    <MailCheck className="h-10 w-10 text-green-500" />
                </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Check your email</h2>
            <p className="text-slate-400 mb-6">
                We sent a verification link to <strong>{form.getValues("email")}</strong>. 
                Please click the link to activate your account.
            </p>
            <Link href="/login">
                <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 hover:text-white">
                    Back to Login
                </Button>
            </Link>
        </Card>
      );
  }

  // --- FORMULARUL NORMAL ---
  return (
    <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 text-slate-50 shadow-2xl backdrop-blur-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
        <CardDescription className="text-center text-slate-400">
          Get started with your AI-powered workspace
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} className="bg-slate-950 border-slate-700" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <div className="grid grid-cols-2 gap-4">
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
                 <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Confirm</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="******" {...field} className="bg-slate-950 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create Account
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-slate-800 pt-4">
          <p className="text-sm text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-500 hover:underline font-medium">
                  Sign in
              </Link>
          </p>
      </CardFooter>
    </Card>
  );
}