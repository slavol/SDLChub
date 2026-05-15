"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";

const formSchema = z.object({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!token) {
        toast.error("Invalid or missing token.");
        return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
          token: token,
          new_password: values.password
      });
      
      toast.success("Password reset successfully!");
      router.push("/login");

    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to reset password."));
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
      return <div className="text-red-500 text-center">Invalid link.</div>;
  }

  return (
    <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 text-slate-50 shadow-2xl backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Set new password</CardTitle>
        <CardDescription className="text-center text-slate-400">
          Enter your new password below
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
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
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} className="bg-slate-950 border-slate-700" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              Update Password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="text-white">Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    );
}
