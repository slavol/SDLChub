import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner"; // <--- Import
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "SDLC Hub",
    template: "%s | SDLC Hub",
  },
  description: "Adaptive project management for Scrum, Kanban and Scrumban teams.",
  applicationName: "SDLC Hub",
  icons: {
    icon: [
      { url: "/favicon.ico?v=sdlc-hub-2", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.svg?v=sdlc-hub-2", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico?v=sdlc-hub-2",
    apple: "/apple-icon.svg?v=sdlc-hub-2",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`}>
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
