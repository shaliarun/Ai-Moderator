import { useState } from "react";
import {
  ArrowLeft, Clock, Users, CheckCircle2, BarChart3, FileText,
  Sparkles, MessageCircle, Send, Trash2, ChevronRight, Calendar,
} from "lucide-react";

type Tab = "script" | "participants" | "sessions" | "insights";

const QUESTIONS = [
  "Can you tell me about the last trip you planned?",
  "Was it for leisure, work, or something else?",
  "Did you plan it yourself or with someone?",
  "How did you decide where to go?",
  "What triggered the idea for this trip?",
];

const PARTICIPANTS = [
  { email: "alex@example.com", status: "completed", slot: "Apr 22, 10:00 AM" },
  { email: "jamie@example.com", status: "completed", slot: "Apr 22, 11:00 AM" },
  { email: "morgan@example.com", status: "pending", slot: null },
  { email: "taylor@example.com", status: "invited", slot: null },
  { email: "casey@example.com", status: "declined", slot: null },
];

const STATUS_PILL: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  pending:   "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  invited:   "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  declined:  "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

const INSIGHTS = [
  { category: "Pain Points", count: 4, color: "rose", icon: "⚡", items: ["Price transparency confusing on booking", "Real-time flight updates missing", "Cancellation policy hard to find"] },
  { category: "Goals", count: 3, color: "indigo", icon: "🎯", items: ["Find best value for money", "Stress-free itinerary planning", "Easy group coordination"] },
  { category: "Feature Requests", count: 3, color: "amber", icon: "💡", items: ["Offline trip maps", "Price alert notifications", "Group booking discounts"] },
];

export function VariantA() {
  const [tab, setTab] = useState<Tab>("script");

  const TABS: { id: Tab; label: string; icon: typeof FileText; count: number }[] = [
    { id: "script",       label: "Script",       icon: FileText,       count: 5  },
    { id: "participants", label: "Participants",  icon: Users,          count: 15 },
    { id: "sessions",     label: "Sessions",      icon: MessageCircle,  count: 13 },
    { id: "insights",     label: "Insights",      icon: Sparkles,       count: 4  },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF9] font-sans">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white px-8 pb-0 pt-6 shadow-sm">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="hover:text-indigo-600 cursor-pointer transition-colors">Studies</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600 font-medium">UX Research on Travel Industry</span>
        </div>

        {/* Title row */}
        <div className="mt-3 flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  UX Research on Travel Industry
                </h1>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                  active
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                <span className="font-medium text-slate-500">Travel Buddy</span>
                <span>·</span>
                <Clock className="h-3.5 w-3.5" />
                <span>40 min</span>
                <span>·</span>
                <span>Created Apr 21, 2025</span>
              </div>
            </div>
          </div>

          {/* Primary actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors">
              <Send className="h-4 w-4" /> Invite participants
            </button>
          </div>
        </div>

        {/* ── Stats strip ──────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100">
          {[
            { icon: Users,        label: "Participants",  value: "15",  sub: "total enrolled"    },
            { icon: CheckCircle2, label: "Completed",     value: "13",  sub: "sessions done", accent: true },
            { icon: BarChart3,    label: "Completion",    value: "87%", sub: "response rate"     },
            { icon: Calendar,     label: "Time slots",    value: "8",   sub: "available"         },
          ].map(({ icon: Icon, label, value, sub, accent }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent ? "bg-indigo-50" : "bg-slate-50"}`}>
                <Icon className={`h-4 w-4 ${accent ? "text-indigo-500" : "text-slate-400"}`} />
              </div>
              <div>
                <div className={`text-xl font-semibold tracking-tight ${accent ? "text-indigo-600" : "text-slate-800"}`}>{value}</div>
                <div className="text-xs text-slate-400">{label} · {sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tab bar ──────────────────────────────────────── */}
        <nav className="-mb-px mt-1 flex gap-1">
          {TABS.map(({ id, label, icon: Icon, count }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 border-b-2 px-4 pb-3 pt-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-indigo-500" : "text-slate-400"}`} />
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                }`}>{count}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <div className="mx-auto max-w-4xl px-8 py-7">

        {/* Script tab */}
        {tab === "script" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Interview script</h2>
              <span className="text-xs text-slate-400">5 questions · ~40 min</span>
            </div>
            <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {QUESTIONS.map((q, i) => (
                <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>

            {/* Goal */}
            <div className="mt-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Study goal</p>
              <p className="text-sm text-slate-600 leading-relaxed">Understand how users in India plan and book travel — from inspiration to post-trip review — to identify key pain points and opportunities for Travel Buddy.</p>
            </div>
          </div>
        )}

        {/* Participants tab */}
        {tab === "participants" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Participants</h2>
              <button className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors">
                <Send className="h-3 w-3" /> Add & invite
              </button>
            </div>
            <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {PARTICIPANTS.map((p, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {p.email[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{p.email}</p>
                      {p.slot && <p className="text-xs text-slate-400">{p.slot}</p>}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[p.status]}`}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions tab */}
        {tab === "sessions" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Recent sessions</h2>
            <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {PARTICIPANTS.filter(p => p.status === "completed").map((p, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{p.email}</p>
                      <p className="text-xs text-slate-400">{p.slot} · 38 min</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">3 insights</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights tab */}
        {tab === "insights" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">AI-generated insights</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {INSIGHTS.map(({ category, count, icon, items }) => (
                <div key={category} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg">{icon}</span>
                    <span className="text-xs font-bold text-slate-400">{count}</span>
                  </div>
                  <p className="font-semibold text-sm text-slate-800 mb-3">{category}</p>
                  <ul className="space-y-2">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
