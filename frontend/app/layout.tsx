import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// Importăm Toaster din componenta UI 'sonner' pe care tocmai ai instalat-o
import { Toaster } from "@/components/ui/sonner"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SDLC AI Hub",
  description: "AI-Powered Project Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Am scos comentariul de aici pentru a evita eroarea de Hydration
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}