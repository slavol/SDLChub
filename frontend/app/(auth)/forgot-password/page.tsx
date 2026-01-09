"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import api from "@/lib/axios";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await api.post("/auth/forgot-password", values);
      setIsSuccess(true);
      toast.success("Reset link sent!");
    } catch (error) {
      // Chiar și la eroare, uneori e bine să arătăm succes fals pt securitate, dar aici afișăm eroare generică
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
      return (
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 text-slate-50 shadow-2xl backdrop-blur-sm p-6 text-center">
            <div className="flex justify-center mb-6">
                <div className="h-20 w-20 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/50">
                    <Mail className="h-10 w-10 text-blue-500" />
                </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Check your email</h2>
            <p className="text-slate-400 mb-6">
                We sent a password reset link to <strong>{form.getValues("email")}</strong>.
            </p>
            <Link href="/login">
                <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 hover:text-white">
                    Back to Login
                </Button>
            </Link>
        </Card>
      );
  }

  return (
    <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 text-slate-50 shadow-2xl backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Forgot Password?</CardTitle>
        <CardDescription className="text-center text-slate-400">
          Enter your email and we'll send you a reset link
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
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Reset Link"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center border-t border-slate-800 pt-4">
          <Link href="/login" className="flex items-center text-sm text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
          </Link>
      </CardFooter>
    </Card>
  );
}