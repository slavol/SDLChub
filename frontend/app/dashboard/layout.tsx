import { Sidebar } from "@/components/dashboard/sidebar";
import { UserNav } from "@/components/dashboard/user-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full relative bg-slate-950">
      
      {/* Sidebar - Hidden on mobile (for now), fixed on desktop */}
      <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80]">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main className="md:pl-72 pb-10 min-h-screen">
        {/* Top Header (Navbar) */}
        <div className="flex items-center justify-end p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
           <div className="flex items-center gap-x-4">
              <div className="text-sm text-slate-400 mr-2">
                 Workspace: <span className="text-white font-medium">Acme Corp</span>
              </div>
              <UserNav />
           </div>
        </div>
        
        {/* Page Content */}
        <div className="p-8">
            {children}
        </div>
      </main>
    </div>
  );
}