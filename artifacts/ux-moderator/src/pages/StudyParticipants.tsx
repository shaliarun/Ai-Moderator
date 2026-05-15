import { useState } from "react";
import { Link } from "wouter";
import {
  useGetStudy,
  getGetStudyQueryKey,
  type Participant,
  type InterviewSession,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ChevronRight,
  Users,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, STATUS_TONE } from "@/lib/format";

type StatusFilter = "all" | "pending" | "invited" | "completed" | "declined" | "accepted" | "rescheduled";

const CANONICAL_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "pending",   label: "Pending" },
  { value: "invited",   label: "Invited" },
  { value: "completed", label: "Completed" },
  { value: "declined",  label: "Declined" },
];

const EXTRA_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "accepted",    label: "Accepted" },
  { value: "rescheduled", label: "Rescheduled" },
];

export default function StudyParticipants({ id }: { id: string }) {
  const [filter, setFilter]   = useState<StatusFilter>("all");
  const [copied, setCopied]   = useState<string | null>(null);

  const studyQ = useGetStudy(id, {
    query: { enabled: !!id, queryKey: getGetStudyQueryKey(id) },
  });
  const study        = studyQ.data;
  const participants: Participant[]      = study?.participants ?? [];
  const sessions:     InterviewSession[] = study?.sessions ?? [];

  const sessionByParticipant = new Map<string, InterviewSession>();
  sessions.forEach((s) => {
    if (s.participantId) sessionByParticipant.set(s.participantId, s);
  });

  const filtered = filter === "all"
    ? participants
    : participants.filter((p) => p.status === filter);

  const counts: Record<StatusFilter, number> = {
    all:         participants.length,
    pending:     participants.filter((p) => p.status === "pending").length,
    invited:     participants.filter((p) => p.status === "invited").length,
    accepted:    participants.filter((p) => p.status === "accepted").length,
    completed:   participants.filter((p) => p.status === "completed").length,
    declined:    participants.filter((p) => p.status === "declined").length,
    rescheduled: participants.filter((p) => p.status === "rescheduled").length,
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  /* ── Loading skeleton ──────────────────────────────────── */
  if (studyQ.isLoading) {
    return (
      <div className="-mx-8 -my-10">
        <div className="h-[49px] border-b border-slate-100 bg-white" />
        <div className="px-8 py-6 space-y-4">
          <Skeleton className="h-7 w-56" />
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
          </div>
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  /* ── Error / not-found state ────────────────────────────── */
  if (studyQ.isError || !study) {
    return (
      <div className="-mx-8 -my-10">
        <div className="sticky top-0 z-20 flex items-center border-b border-slate-100 bg-white/95 px-8 py-3 backdrop-blur-sm">
          <Link
            href="/studies"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Users className="mb-4 h-10 w-10 text-slate-200" />
          <p className="text-base font-medium text-slate-500">Study not found</p>
          <p className="mt-1 text-sm text-slate-400">This study may have been deleted or the link is invalid.</p>
          <Link
            href="/studies"
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Back to studies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-8 -my-10">

      {/* ── Slim sticky top nav ──────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-8 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/studies/${id}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-1.5 text-sm">
            <Link href="/studies" className="text-slate-400 hover:text-indigo-600 transition-colors">
              Studies
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <Link
              href={`/studies/${id}`}
              className="text-slate-400 hover:text-indigo-600 transition-colors max-w-[180px] truncate"
            >
              {study.title}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-semibold text-slate-700">Participants</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4 text-slate-400" />
          <span>{participants.length} total</span>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="px-8 py-6">

        <div className="mb-5">
          <h1 className="text-xl font-semibold text-slate-900">All participants</h1>
          <p className="mt-1 text-sm text-slate-500">{study.title}</p>
        </div>

        {/* Status filter pills */}
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            ...CANONICAL_FILTERS,
            ...EXTRA_FILTERS.filter(({ value }) => counts[value] > 0),
          ].map(({ value, label }) => {
            const count = counts[value];
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
                )}
              >
                {label}
                <span className={cn(
                  "tabular-nums rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
            <Users className="mx-auto mb-3 h-9 w-9 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">No participants in this category</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Participant
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Chosen slot
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Session
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Invite link
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => {
                  const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/invite/${p.inviteToken}`;
                  const session   = sessionByParticipant.get(p.id);

                  return (
                    <tr key={p.id} className="group hover:bg-slate-50/60 transition-colors">
                      {/* Email / name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                            {(p.name ?? p.email)[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-700">{p.email}</p>
                            {p.name && (
                              <p className="truncate text-xs text-slate-400">{p.name}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STATUS_TONE[p.status] ?? "bg-slate-100 text-slate-600 border border-slate-200",
                        )}>
                          {p.status}
                        </span>
                        {p.screenerPassed === false && (
                          <span className="ml-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 border border-rose-200">
                            screener ✗
                          </span>
                        )}
                        {p.screenerPassed === true && (
                          <span className="ml-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">
                            screener ✓
                          </span>
                        )}
                      </td>

                      {/* Chosen slot */}
                      <td className="px-5 py-3.5 text-slate-500">
                        {p.chosenSlot ? formatDateTime(p.chosenSlot) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Session link */}
                      <td className="px-5 py-3.5">
                        {session ? (
                          <Link
                            href={`/sessions/${session.id}`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="capitalize">{session.status}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Copy invite link */}
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => copyLink(inviteUrl)}
                          title="Copy invite link"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          {copied === inviteUrl
                            ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</>
                            : <><Copy className="h-3 w-3" /> Copy link</>
                          }
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
