import { useState } from "react";
import {
  ArrowLeft, Clock, Users, CheckCircle2, FileText,
  Sparkles, MessageCircle, Send, Trash2, ChevronRight,
  Calendar, Plus, TrendingUp,
} from "lucide-react";

type Tab = "questions" | "sessions" | "insights";

const QUESTIONS = [
  "Can you tell me about the last trip you planned?",
  "Was it for leisure, work, or something else?",
  "Did you plan it yourself or with someone?",
  "How did you decide where to go?",
  "What triggered the idea for this trip?",
];

const SESSIONS = [
  { email: "alex@example.com", date: "Apr 22", duration: "38 min", insights: 3 },
  { email: "jamie@example.com", date: "Apr 22", duration: "41 min", insights: 4 },
  { email: "morgan@example.com", date: "Apr 23", duration: "35 min", insights: 2 },
  { email: "priya@example.com", date: "Apr 23", duration: "44 min", insights: 5 },
];

const INSIGHT_PILLS = [
  { label: "Price transparency confusing", kind: "Pain point", color: "rose" },
  { label: "Wants offline maps", kind: "Feature request", color: "amber" },
  { label: "Uses Instagram for inspiration", kind: "Behaviour", color: "violet" },
  { label: "Books 3+ weeks in advance", kind: "Behaviour", color: "violet" },
  { label: "Trusts peer reviews > ads", kind: "Goal", color: "indigo" },
  { label: "Cancellation policy major blocker", kind: "Pain point", color: "rose" },
  { label: "Price alert notifications needed", kind: "Feature request", color: "amber" },
];

const KIND_COLORS: Record<string, string> = {
  rose:   "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  amber:  "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
};

export function VariantB() {
  const [tab, setTab] = useState<Tab>("questions");
  const [emailInput, setEmailInput] = useState("");

  const TABS: { id: Tab; label: string; icon: typeof FileText; count: number }[] = [
    { id: "questions", label: "Questions", icon: FileText,      count: 5  },
    { id: "sessions",  label: "Sessions",  icon: MessageCircle, count: 13 },
    { id: "insights",  label: "Insights",  icon: Sparkles,      count: 7  },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF9] font-sans">

      {/* ── Slim top-nav bar ─────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-8 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors">Studies</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-semibold text-slate-700">UX Research on Travel Industry</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">active</span>
          <button className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors">
            <Trash2 className="h-3 w-3" /> Delete
          </button>
        </div>
      </div>

      <div className="flex gap-0 min-h-[calc(100vh-49px)]">

        {/* ── Main content ─────────────────────────────────── */}
        <div className="flex-1 px-8 py-6">

          {/* Study identity */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">UX Research on Travel Industry</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-600">Travel Buddy</span>
              <span className="text-slate-300">·</span>
              <Clock className="h-3.5 w-3.5" /><span>40 min</span>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 leading-relaxed border border-slate-100">
              Understand how users in India plan and book travel — from inspiration to post-trip review — to identify key pain points and opportunities for Travel Buddy.
            </div>
          </div>

          {/* Quick metrics strip */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { icon: Users,        label: "Participants",  value: "15",  accent: false },
              { icon: CheckCircle2, label: "Completed",     value: "13",  accent: true  },
              { icon: TrendingUp,   label: "Completion",    value: "87%", accent: false },
            ].map(({ icon: Icon, label, value, accent }) => (
              <div key={label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${accent ? "border-indigo-100 bg-indigo-50/60" : "border-slate-100 bg-white"} shadow-sm`}>
                <Icon className={`h-5 w-5 ${accent ? "text-indigo-500" : "text-slate-400"}`} />
                <div>
                  <p className={`text-xl font-semibold ${accent ? "text-indigo-700" : "text-slate-800"}`}>{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-100 mb-5">
            <nav className="-mb-px flex gap-1">
              {TABS.map(({ id, label, icon: Icon, count }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`inline-flex items-center gap-2 border-b-2 px-4 pb-3 pt-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-indigo-500" : "text-slate-400"}`} />
                    {label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>{count}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Questions */}
          {tab === "questions" && (
            <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {QUESTIONS.map((q, i) => (
                <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</div>
                  <p className="text-sm text-slate-700 leading-relaxed pt-0.5">{q}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sessions */}
          {tab === "sessions" && (
            <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              {SESSIONS.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">{s.email}</p>
                      <p className="text-xs text-slate-400">{s.date} · {s.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">{s.insights} insights</span>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Insights */}
          {tab === "insights" && (
            <div className="space-y-2">
              {INSIGHT_PILLS.map(({ label, kind, color }, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-5 py-3.5 shadow-sm hover:border-indigo-100 transition-colors">
                  <p className="text-sm text-slate-700">{label}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${KIND_COLORS[color]}`}>{kind}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-l border-slate-100 bg-white px-5 py-6">

          {/* Invite CTA */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-200">
            <Send className="mb-3 h-5 w-5 opacity-90" />
            <p className="text-sm font-semibold">Invite participants</p>
            <p className="mt-1 text-xs opacity-75">Add emails and send invites in one click.</p>
            <input
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="email@example.com"
              className="mt-3 w-full rounded-lg bg-white/20 px-3 py-2 text-xs placeholder:text-white/50 text-white outline-none focus:ring-2 focus:ring-white/40"
            />
            <button className="mt-2.5 w-full rounded-lg bg-white py-2 text-xs font-semibold text-indigo-700 hover:bg-white/90 transition-colors">
              Send invite
            </button>
          </div>

          {/* Upcoming slots */}
          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Upcoming slots</p>
            <div className="space-y-2">
              {[
                { date: "Apr 28", time: "10:00 AM", open: true },
                { date: "Apr 29", time: "2:00 PM",  open: true },
                { date: "Apr 30", time: "11:00 AM", open: false },
              ].map((slot, i) => (
                <div key={i} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs ${slot.open ? "border-slate-100" : "border-slate-50 opacity-50"}`}>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{slot.date} · {slot.time}</span>
                  </div>
                  {slot.open && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600 ring-1 ring-emerald-100 font-medium">open</span>
                  )}
                </div>
              ))}
            </div>
            <button className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-medium text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors">
              <Plus className="h-3 w-3" /> Add slot
            </button>
          </div>

          {/* Recent participants */}
          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Recent participants</p>
            <div className="space-y-2">
              {[
                { email: "alex@example.com", status: "completed" },
                { email: "jamie@example.com", status: "completed" },
                { email: "morgan@example.com", status: "pending" },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                      {p.email[0]?.toUpperCase()}
                    </div>
                    <span className="text-slate-600 truncate max-w-[110px]">{p.email}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${
                    p.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}>{p.status}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
