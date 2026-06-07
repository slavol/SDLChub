"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/use-auth-store";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  GitPullRequest,
  KanbanSquare,
  Sparkles,
  BarChart,
  ShieldCheck,
  ChevronRight,
  ListTodo,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full bg-blue-500/20"></div>
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-r-2 border-blue-500"></div>
          </div>
          <p className="text-sm font-medium text-slate-400 animate-pulse">
            Se încarcă dashboard-ul...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#030712] text-slate-50 selection:bg-blue-500/30 font-sans overflow-x-hidden">
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#030712]/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <BrandMark className="h-8 w-8 rounded-lg" markClassName="h-5 w-5" />
            <span className="text-xl font-bold tracking-tight text-white">SDLC Hub</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-slate-300 hover:text-white transition-colors">
              Autentificare
            </Link>
            <Link href="/register">
              <Button className="h-9 rounded-full bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-200">
                Înregistrare
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 lg:pt-24 text-center">
          <Badge 
            variant="outline" 
            className="mb-8 rounded-full border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-300 backdrop-blur-md inline-flex items-center"
          >
            <Sparkles className="mr-2 h-4 w-4 text-indigo-400" />
            Productivitate amplificată de AI
          </Badge>
          
          <h1 className="mx-auto mb-6 max-w-4xl bg-gradient-to-b from-white to-slate-400 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-7xl">
            Ciclul de viață al software-ului, <br className="hidden sm:block" /> adus la perfecțiune.
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400 sm:text-xl leading-relaxed">
            Platforma centralizată pentru echipe moderne. Gestionează fără efort sprint-uri Scrum, fluxuri Kanban sau tranziții Scrumban, susținute de asistență AI pentru estimări și planificare.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button 
                size="lg" 
                className="group relative overflow-hidden rounded-full bg-blue-600 px-8 py-6 text-base font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]"
              >
                Creează un spațiu de lucru
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Abstract App Mockup UI */}
        <section id="mockup" className="relative mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-[#0A0F1C] p-2 shadow-2xl shadow-blue-900/20">
            <div className="rounded-xl border border-white/5 bg-[#030712] overflow-hidden flex flex-col h-[500px]">
              <div className="flex items-center border-b border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="mx-auto flex items-center rounded-md bg-white/5 px-3 py-1 text-xs text-slate-400">
                  <BrandMark className="mr-2 h-4 w-4 rounded" markClassName="h-3 w-3" /> SDLC Hub - Active Sprint
                </div>
              </div>
              <div className="flex flex-1 overflow-hidden">
                <div className="hidden w-48 border-r border-white/5 bg-white/[0.01] p-4 sm:flex flex-col gap-4">
                  <div className="h-6 w-24 rounded bg-white/10"></div>
                  <div className="mt-4 flex flex-col gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-4 w-full rounded bg-white/5"></div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 p-6 grid grid-cols-3 gap-4 bg-gradient-to-br from-transparent to-blue-900/5">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-400">TO DO (3)</span>
                      <div className="h-4 w-4 rounded bg-white/10"></div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3 shadow-sm">
                      <div className="mb-2 h-3 w-16 rounded bg-blue-500/40"></div>
                      <div className="mb-3 h-4 w-full rounded bg-white/10"></div>
                      <div className="flex justify-between items-center">
                        <div className="h-6 w-6 rounded-full bg-indigo-500/50"></div>
                        <span className="text-[10px] text-slate-500">SDLC-102</span>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/5 p-3 shadow-sm">
                      <div className="mb-2 h-3 w-20 rounded bg-purple-500/40"></div>
                      <div className="mb-3 h-4 w-3/4 rounded bg-white/10"></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-blue-400 mb-2">IN PROGRESS (1)</span>
                    <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 shadow-sm">
                      <div className="mb-2 h-3 w-24 rounded bg-yellow-500/40"></div>
                      <div className="mb-3 h-4 w-full rounded bg-white/20"></div>
                      <div className="h-4 w-5/6 rounded bg-white/10 mb-3"></div>
                      <div className="flex justify-between items-center">
                        <div className="h-6 w-6 rounded-full bg-emerald-500/50"></div>
                        <span className="text-[10px] text-slate-500">SDLC-099</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-emerald-400 mb-2">DONE (4)</span>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 opacity-60">
                      <div className="mb-2 h-3 w-12 rounded bg-green-500/40"></div>
                      <div className="mb-1 h-4 w-full rounded bg-white/10 line-through"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid Features */}
        <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32">
          <div className="mb-16">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Arhitectură completă pentru livrare agilă.
            </h2>
            <p className="max-w-2xl text-slate-400 text-lg">
              De la faza de abstractizare și planificare până la execuție, SDLC Hub îți oferă flexibilitatea de a folosi metodologia potrivită echipei tale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px]">
            <div className="md:col-span-2 row-span-1 rounded-3xl border border-white/10 bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 h-40 w-40 rounded-full bg-blue-600/20 blur-3xl transition-all group-hover:bg-blue-500/30"></div>
              <KanbanSquare className="mb-4 h-8 w-8 text-blue-400" />
              <h3 className="mb-2 text-2xl font-semibold text-white">Scrum, Kanban & Scrumban</h3>
              <p className="text-slate-400 max-w-md">
                Nu ești forțat într-un singur tipar. Alternează între sprint-uri cu timebox fix și flux continuu, sau combină-le perfect prin Scrumban.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-colors">
              <Sparkles className="mb-4 h-8 w-8 text-indigo-400" />
              <h3 className="mb-2 text-xl font-semibold text-white">Estimări AI</h3>
              <p className="text-sm text-slate-400">
                Modele integrate care analizează complexitatea task-urilor tale și sugerează Story Points automate și realiste.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-colors">
              <ListTodo className="mb-4 h-8 w-8 text-emerald-400" />
              <h3 className="mb-2 text-xl font-semibold text-white">Backlog Inteligent</h3>
              <p className="text-sm text-slate-400">
                Filtrează, prioritizează și creează ierarhii complexe din Epic-uri direct în backlog, fără efort.
              </p>
            </div>

            <div className="md:col-span-2 row-span-1 rounded-3xl border border-white/10 bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
              <div className="absolute bottom-0 right-0 -mb-8 -mr-8 h-40 w-40 rounded-full bg-purple-600/20 blur-3xl transition-all group-hover:bg-purple-500/30"></div>
              <BarChart className="mb-4 h-8 w-8 text-purple-400" />
              <h3 className="mb-2 text-2xl font-semibold text-white">Analytics & Diagrame</h3>
              <p className="text-slate-400 max-w-md">
                Generează instant rapoarte de Burndown, diagrame de flux cumulativ (CFD) și rapoarte de viteză pentru a optimiza predicțiile lansărilor.
              </p>
            </div>
          </div>
        </section>


        {/* CTA Bottom Section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent px-6 py-20 text-center sm:px-16">
            <div className="absolute left-1/2 top-0 -z-10 h-[300px] w-full max-w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-[100px]" />
            
            <h2 className="mx-auto mb-6 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
              Gata să transformi dezvoltarea?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-lg text-slate-400">
              Creează cont acum și primești acces imediat la workspace-ul tău. Nu este necesar card de credit.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="rounded-full bg-white px-8 py-6 text-base font-semibold text-slate-950 transition-all hover:bg-slate-200">
                  Înregistrare
                  <ChevronRight className="ml-1 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Professional Footer */}
      <footer className="border-t border-white/10 bg-[#030712] pt-16 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <BrandMark className="h-6 w-6 rounded" markClassName="h-4 w-4" />
                <span className="text-lg font-bold text-white">SDLC Hub</span>
              </div>
              <p className="text-sm text-slate-400 max-w-xs mb-6">
                Platforma completă de Project Management pentru metodologii Agile. Optimizată pentru performanță.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Produs</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-blue-400 transition-colors">Funcționalități</a></li>
                <li><a href="#integrations" className="hover:text-blue-400 transition-colors">Integrări</a></li>
                <li><a href="#pricing" className="hover:text-blue-400 transition-colors">Prețuri</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Metodologii</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-blue-400 transition-colors">Scrum Framework</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Kanban Boards</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Scrumban</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Companie</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-blue-400 transition-colors">Despre noi</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Confidențialitate</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} SDLC Hub. Toate drepturile rezervate.
            </p>
            <div className="flex gap-4 text-slate-500">
              <GitPullRequest className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
              <ShieldCheck className="h-5 w-5 hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
