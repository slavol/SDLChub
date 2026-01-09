import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white p-4">
      <div className="text-center max-w-2xl space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">
          SDLC AI Hub
        </h1>
        <p className="text-lg text-slate-400">
          The Enterprise Project Management platform powered by Gemini AI. 
          Seamlessly switch between Scrum, Kanban, and Scrumban.
        </p>
        
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link href="/login">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 font-semibold text-lg px-8">
              Login
            </Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800 font-semibold text-lg px-8">
              Register
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}