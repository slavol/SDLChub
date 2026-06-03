"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function ThemeModeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const activeTheme = theme || "system";
  const resolved = resolvedTheme || "dark";
  const ActiveIcon = resolved === "light" ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start rounded-xl border-slate-800 bg-slate-900/60 text-slate-300 hover:border-blue-500/35 hover:bg-slate-900 hover:text-white",
            className
          )}
          aria-label="Change theme"
        >
          <ActiveIcon className="mr-2 h-4 w-4" />
          <span className="flex-1 text-left text-[13px] font-semibold">
            Theme
          </span>
          <span className="text-xs text-slate-500">
            {activeTheme === "system"
              ? "System"
              : activeTheme === "light"
                ? "Light"
                : "Dark"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-56 border-slate-800 bg-slate-950 p-2 text-slate-100 shadow-2xl shadow-slate-950/40"
      >
        <DropdownMenuLabel className="px-2 text-xs uppercase tracking-wide text-slate-500">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-800" />
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const selected = activeTheme === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className={cn(
                "cursor-pointer rounded-xl px-2 py-2 text-slate-200 focus:bg-slate-900 focus:text-white",
                selected && "bg-blue-500/10 text-blue-200"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{option.label}</span>
              {selected && (
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                  Active
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
