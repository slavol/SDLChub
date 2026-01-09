"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMyWorkspaces } from "@/services/auth"; // Importăm serviciul

export default function DashboardPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  useEffect(() => {
    // Verificăm dacă avem token
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Încărcăm workspace-urile
    getMyWorkspaces()
      .then((data) => setWorkspaces(data))
      .catch((err) => console.error(err));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        <Button onClick={handleLogout} variant="destructive">Logout</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card pentru Workspace-uri existente */}
        {workspaces.map((ws) => (
            <div key={ws.id} className="p-6 bg-slate-900 border border-slate-800 rounded-lg shadow-sm hover:border-blue-500 cursor-pointer transition">
                <h2 className="text-xl font-semibold mb-2">{ws.name}</h2>
                <p className="text-slate-400 text-sm">Created: {new Date(ws.created_at).toLocaleDateString()}</p>
            </div>
        ))}

        {/* Card pentru Creare Nouă (Placeholder) */}
        <div className="p-6 border-2 border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 cursor-pointer transition h-40">
            + Create New Workspace
        </div>
      </div>
    </div>
  );
}