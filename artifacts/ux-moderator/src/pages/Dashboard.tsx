import { Link } from "wouter";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  type ActivityItem,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import {
  ArrowUpRight,
  FlaskConical,
  Users,
  MessageCircle,
  Mail,
  Sparkles,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { formatRelative } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  study_created:      FlaskConical,
  participant_added:  Users,
  invite_accepted:    Mail,
  invite_declined:    Mail,
  session_completed:  CheckCircle2,
  insights_generated: Sparkles,
};

const KIND_COLOR: Record<string, string> = {
  study_created:      "bg-indigo-50 text-indigo-600",
  participant_added:  "bg-violet-50 text-violet-600",
  invite_accepted:    "bg-emerald-50 text-emerald-600",
  invite_declined:    "bg-rose-50 text-rose-600",
  session_completed:  "bg-emerald-50 text-emerald-600",
  insights_generated: "bg-amber-50 text-amber-600",
};

export default function Dashboard() {
  const summary  = useGetDashboardSummary();
  const activity = useGetRecentActivity();
  const items    = (activity.data ?? []) as ActivityItem[];

  const stats = [
    {
      label: "Studies",
      value: summary.data?.totalStudies,
      sub: `${summary.data?.activeStudies ?? 0} active`,
      icon: FlaskConical,
      gradient: "from-indigo-500 to-violet-600",
      glow: "shadow-indigo-200",
      border: "border-indigo-100/60",
      hover: "hover:border-indigo-200",
    },
    {
      label: "Participants",
      value: summary.data?.totalParticipants,
      sub: `${summary.data?.pendingInvites ?? 0} awaiting reply`,
      icon: Users,
      gradient: "from-violet-500 to-purple-600",
      glow: "shadow-violet-200",
      border: "border-violet-100/60",
      hover: "hover:border-violet-200",
    },
    {
      label: "Sessions",
      value: summary.data?.completedSessions,
      sub: "AI-moderated",
      icon: MessageCircle,
      gradient: "from-emerald-500 to-teal-600",
      glow: "shadow-emerald-200",
      border: "border-emerald-100/60",
      hover: "hover:border-emerald-200",
    },
    {
      label: "Insight reports",
      value: summary.data?.totalInsights,
      sub: "ready to read",
      icon: BarChart3,
      gradient: "from-amber-500 to-orange-500",
      glow: "shadow-amber-200",
      border: "border-amber-100/60",
      hover: "hover:border-amber-200",
    },
  ];

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Overview</p>
          <h1 className="mt-1.5 bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Your research lab
          </h1>
          <p className="mt-2 text-slate-500">
            A calm view of every study, every session, every insight.
          </p>
        </div>
        <Link
          href="/studies/new"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-300/40 transition hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg hover:shadow-indigo-300/50 active:scale-95"
        >
          New study
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              className={`group border bg-white/80 backdrop-blur-sm p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${s.border} ${s.hover}`}
            >
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} shadow-md ${s.glow}`}>
                <Icon className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                {summary.isLoading ? <Skeleton className="h-8 w-16" /> : (s.value ?? 0)}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-700">{s.label}</div>
              <div className="mt-0.5 text-xs text-slate-400">{s.sub}</div>
            </Card>
          );
        })}
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Recent activity
        </h2>
        <Card className="overflow-hidden border border-slate-100/80 bg-white/80 backdrop-blur-sm shadow-sm">
          {activity.isLoading ? (
            <div className="space-y-px p-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-violet-50">
                <Sparkles className="h-5 w-5 text-indigo-300" />
              </div>
              <p className="text-sm font-medium text-slate-600">Nothing yet</p>
              <p className="mt-1 text-xs text-slate-400">Create a study to get started.</p>
              <Link
                href="/studies/new"
                className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:underline"
              >
                Create your first study →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {items.map((it) => {
                const Icon  = KIND_ICON[it.kind] ?? Sparkles;
                const color = KIND_COLOR[it.kind] ?? "bg-slate-50 text-slate-500";
                const nameMatch = it.message.match(/[""]([^""]+)[""]/);
                const initials = nameMatch
                  ? nameMatch[1].split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
                  : it.kind.slice(0, 2).toUpperCase();
                const node  = (
                  <div className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-transparent">
                    <div className="relative shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-[10px] font-bold text-indigo-700">
                        {initials}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${color}`}>
                        <Icon className="h-2.5 w-2.5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-slate-800">{it.message}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{formatRelative(it.createdAt)}</div>
                    </div>
                    {it.studyId && (
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    )}
                  </div>
                );
                return (
                  <li key={it.id}>
                    {it.studyId ? (
                      <Link href={`/studies/${it.studyId}`} className="block">{node}</Link>
                    ) : (
                      node
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
