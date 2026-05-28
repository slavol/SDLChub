import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  markClassName?: string;
};

export function BrandMark({ className, markClassName }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-blue-400/20 bg-slate-950 shadow-lg shadow-blue-950/25",
        className
      )}
    >
      <svg
        viewBox="0 0 64 64"
        role="img"
        aria-label="SDLC Hub"
        className={cn("h-6 w-6", markClassName)}
      >
        <defs>
          <linearGradient id="sdlcHubMark" x1="10" y1="8" x2="54" y2="58">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="48%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        <path
          d="M32 7 53 18.8v25L32 57 11 43.8v-25L32 7Z"
          fill="#020617"
          stroke="url(#sdlcHubMark)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M20 24.2 32 17l12 7.2M20 39.8 32 47l12-7.2"
          fill="none"
          stroke="url(#sdlcHubMark)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M32 17v30M20 24.2v15.6M44 24.2v15.6"
          fill="none"
          stroke="#93c5fd"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="20" cy="24" r="4" fill="#38bdf8" />
        <circle cx="44" cy="24" r="4" fill="#2563eb" />
        <circle cx="20" cy="40" r="4" fill="#22c55e" />
        <circle cx="44" cy="40" r="4" fill="#38bdf8" />
        <circle cx="32" cy="17" r="4" fill="#60a5fa" />
        <circle cx="32" cy="47" r="4" fill="#22c55e" />
      </svg>
    </div>
  );
}
