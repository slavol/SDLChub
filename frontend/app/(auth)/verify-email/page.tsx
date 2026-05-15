"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import api from "@/lib/axios";
import { getApiErrorMessage } from "@/lib/api-error";

function VerifyContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("Verifying your email...");

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus("error");
                setMessage("Invalid verification link.");
                return;
            }

            try {
                await api.get(`/auth/verify-email?token=${token}`);
                setStatus("success");
                setMessage("Your email has been successfully verified! You can now login.");
            } catch (error: unknown) {
                setStatus("error");
                setMessage(getApiErrorMessage(error, "Verification failed. The link might be expired."));
            }
        };

        verify();
    }, [token]);

    return (
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 text-slate-50 shadow-2xl backdrop-blur-sm p-6 text-center">
            <div className="flex justify-center mb-6">
                {status === "loading" && <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />}
                {status === "success" && <CheckCircle2 className="h-16 w-16 text-green-500" />}
                {status === "error" && <XCircle className="h-16 w-16 text-red-500" />}
            </div>

            <h2 className="text-2xl font-bold mb-2">
                {status === "loading" && "Verifying..."}
                {status === "success" && "Verified!"}
                {status === "error" && "Verification Failed"}
            </h2>
            
            <p className="text-slate-400 mb-8">{message}</p>

            {status !== "loading" && (
                <Link href="/login">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        Go to Login
                    </Button>
                </Link>
            )}
        </Card>
    );
}

export default function VerifyEmailPage() {
    return (
        // Suspense este necesar în Next.js când folosim useSearchParams
        <Suspense fallback={<div className="text-white">Loading...</div>}>
            <VerifyContent />
        </Suspense>
    );
}
