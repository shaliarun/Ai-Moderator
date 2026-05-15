import { Link, useLocation } from "wouter";
import { LayoutDashboard, FlaskConical, Headphones, Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/studies", label: "Studies", icon: FlaskConical },
  { href: "/sessions", label: "Sessions", icon: Headphones },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 shrink-0 flex flex-col bg-gradient-to-b from-[hsl(243_72%_11%)] via-[hsl(248_68%_13%)] to-[hsl(258_65%_15%)] px-3 py-6">

          {/* Logo */}
          <div className="mb-8 flex items-center gap-3 px-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 via-indigo-500 to-purple-600 shadow-lg shadow-indigo-900/50">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight text-white">Insightly</div>
              <div className="text-[10px] uppercase tracking-widest text-indigo-300/70">Research lab</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => {
              const active = n.href === "/" ? location === "/" : location.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-900/50"
                      : "text-indigo-200/70 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-indigo-200" : "text-indigo-400/60")} />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          {/* AI badge */}
          <div className="mx-1 rounded-xl border border-indigo-700/40 bg-gradient-to-br from-indigo-900/60 to-violet-900/40 p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/20">
                <Bot className="h-3.5 w-3.5 text-violet-300" />
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[hsl(243_68%_13%)]" />
                </span>
              </div>
              <div className="text-xs font-semibold text-indigo-100">AI moderator on duty</div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-indigo-300/60">
              Sessions run autonomously — review transcripts &amp; insights when ready.
            </p>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
