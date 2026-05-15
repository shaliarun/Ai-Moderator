import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStudy,
  useAddParticipants,
  useSendInvites,
  useGetStudyInsights,
  useGetStudyTaggedTurns,
  useDeleteStudy,
  useAddStudySlot,
  useRemoveStudySlot,
  getGetStudyQueryKey,
  getGetStudyInsightsQueryKey,
  getGetStudyTaggedTurnsQueryKey,
  getGetDashboardSummaryQueryKey,
  getListStudiesQueryKey,
  type Participant,
  type InterviewSession,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Clock, Users, CheckCircle2, FileText,
  Sparkles, MessageCircle, Send, Trash2, ChevronRight,
  Calendar, Plus, TrendingUp, Upload, Copy, Check,
  Pencil, X, BarChart2, Quote, Tag, LayoutDashboard,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { STATUS_TONE, formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { exportStudyReportPdf } from "@/lib/exportPdf";
import { exportStudyCsv } from "@/lib/exportStudyCsv";

type Tab = "overview" | "sessions" | "insights";

const TAG_COLORS: Record<string, string> = {
  "Insight":        "bg-indigo-100 text-indigo-700",
  "Pain Point":     "bg-rose-100 text-rose-700",
  "Quote":          "bg-amber-100 text-amber-700",
  "Recommendation": "bg-emerald-100 text-emerald-700",
  "Positive":       "bg-teal-100 text-teal-700",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function StudyDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  /* ── State ─────────────────────────────────────────────── */
  const [activeTab, setActiveTab]         = useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emails, setEmails]               = useState("");
  const [importStatus, setImportStatus]   = useState<string | null>(null);
  const [copied, setCopied]               = useState<string | null>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  // Slot management state
  const [showAddSlot, setShowAddSlot]     = useState(false);
  const [newSlotValue, setNewSlotValue]   = useState("");

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);

  // Tag drill-down
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const studyQ    = useGetStudy(id, { query: { enabled: !!id, queryKey: getGetStudyQueryKey(id) } });
  const insightsQ = useGetStudyInsights(id, { query: { enabled: !!id, queryKey: getGetStudyInsightsQueryKey(id) } });
  const taggedTurnsQ = useGetStudyTaggedTurns(
    id,
    selectedTag ? { tag: selectedTag } : {},
    { query: { enabled: !!id && selectedTag !== null, queryKey: getGetStudyTaggedTurnsQueryKey(id, selectedTag ? { tag: selectedTag } : {}) } },
  );
  const study        = studyQ.data;
  const participants: Participant[]      = study?.participants ?? [];
  const sessions:     InterviewSession[] = study?.sessions ?? [];

  /* ── Mutations ─────────────────────────────────────────── */
  const addMut       = useAddParticipants();
  const sendMut      = useSendInvites();
  const deleteMut    = useDeleteStudy();
  const addSlotMut   = useAddStudySlot();
  const removeSlotMut = useRemoveStudySlot();

  const refetch = () => {
    qc.invalidateQueries({ queryKey: getGetStudyQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  /* ── Handlers ──────────────────────────────────────────── */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);
    try {
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const found = new Set<string>();
      const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        for (const row of rows)
          for (const v of Object.values(row)) {
            String(v ?? "").match(re)?.forEach((m) => found.add(m.toLowerCase()));
          }
      }
      if (found.size === 0) {
        setImportStatus("No email addresses found in that file.");
      } else {
        const merged = new Set(
          (emails.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean) as string[])
            .concat(Array.from(found)),
        );
        setEmails(Array.from(merged).join(", "));
        setImportStatus(`Imported ${found.size} email${found.size === 1 ? "" : "s"} from ${file.name}.`);
      }
    } catch (err) {
      setImportStatus(`Could not read that file: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addParticipants = () => {
    const list = emails
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
    if (list.length === 0) { toast.error("Add one or more valid email addresses."); return; }
    addMut.mutate(
      { studyId: id, data: { emails: list } },
      {
        onSuccess: () => { setEmails(""); refetch(); toast.success(`Added ${list.length} participant${list.length === 1 ? "" : "s"}`); },
        onError:   () => toast.error("Could not add participants."),
      },
    );
  };

  const sendInvites = () => {
    sendMut.mutate(
      { studyId: id },
      {
        onSuccess: (res) => {
          refetch();
          const invites = (res.invites ?? []) as Array<{ delivered?: boolean; error?: string }>;
          const failed = invites.filter((invite) => invite.delivered === false);
          if (failed.length > 0) {
            toast.error(failed[0]?.error ?? "Could not send invite email.");
          } else if ((res.sent ?? 0) === 0) {
            toast("No pending participants to invite.");
          } else {
            toast.success(`Invites sent to ${res.sent} participant${res.sent === 1 ? "" : "s"}`);
          }
        },
        onError: () => toast.error("Could not send invites."),
      },
    );
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleAddSlot = () => {
    if (!newSlotValue) { toast.error("Pick a date and time first."); return; }
    const iso = new Date(newSlotValue).toISOString();
    addSlotMut.mutate(
      { studyId: id, data: { slot: iso } },
      {
        onSuccess: () => {
          setShowAddSlot(false);
          setNewSlotValue("");
          refetch();
          toast.success("Slot added");
        },
        onError: () => toast.error("Could not add slot."),
      },
    );
  };

  const handleRemoveSlot = (index: number) => {
    removeSlotMut.mutate(
      { studyId: id, slotIndex: index },
      {
        onSuccess: () => { refetch(); toast.success("Slot removed"); },
        onError: () => toast.error("Could not remove slot."),
      },
    );
  };

  const handleDeleteConfirm = () => {
    deleteMut.mutate({ studyId: id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStudiesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast.success("Study deleted");
        navigate("/studies");
      },
      onError: () => toast.error("Could not delete study."),
    });
  };

  /* ── Loading skeleton ──────────────────────────────────── */
  if (studyQ.isLoading || !study) {
    return (
      <div className="-mx-8 -my-10">
        <div className="h-[49px] border-b border-slate-100 bg-white" />
        <div className="flex min-h-[calc(100vh-49px)]">
          <div className="flex-1 space-y-4 px-8 py-6">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          </div>
          <div className="w-72 shrink-0 border-l border-slate-100 bg-white px-5 py-6 space-y-4">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Derived values ────────────────────────────────────── */
  const insightsData  = insightsQ.data;
  const allInsights   = insightsData?.sessionInsights ?? [];
  const tagSummary    = insightsData?.tagSummary ?? [];
  const topQuotes     = insightsData?.topQuotes ?? [];
  const pendingCount  = participants.filter(p => p.status === "pending").length;
  const completionPct = study.participantCount > 0
    ? Math.round((study.completedSessionCount / study.participantCount) * 100)
    : 0;

  const STATUS_SIDEBAR: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700",
    pending:   "bg-amber-50 text-amber-700",
    invited:   "bg-violet-50 text-violet-700",
    declined:  "bg-rose-50 text-rose-700",
    active:    "bg-indigo-50 text-indigo-700",
  };

  /* insight count per session (sum of all 4 categories in that session's insight record) */
  const insightCountBySession = new Map<string, number>();
  allInsights.forEach((ins) => {
    const n = ins.painPoints.length + ins.userGoals.length + ins.featureRequests.length + ins.recommendations.length;
    insightCountBySession.set(ins.sessionId, n);
  });

  const TABS: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: "overview",  label: "Overview",  icon: LayoutDashboard, count: study.questions.length },
    { id: "sessions",  label: "Sessions",  icon: MessageCircle,   count: sessions.length },
    { id: "insights",  label: "Insights",  icon: Sparkles,        count: allInsights.length },
  ];

  return (
    /* Break out of AppLayout's px-8 py-10 padding so our nav can be flush */
    <div className="-mx-8 -my-10">

      {/* ── Slim sticky top nav ──────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-8 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <Link
            href="/studies"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-1.5 text-sm">
            <Link href="/studies" className="text-slate-400 hover:text-indigo-600 transition-colors">
              Studies
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="max-w-xs truncate font-semibold text-slate-700">{study.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
            {study.status}
          </span>
          <Link
            href={`/studies/${id}/edit`}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Edit
          </Link>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-rose-600">Delete study?</span>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteMut.isPending}
                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-60"
              >
                {deleteMut.isPending ? "Deleting…" : "Yes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Body: main content + sidebar ─────────────────────── */}
      <div className="flex min-h-[calc(100vh-49px)]">

        {/* ── Main content ───────────────────────────────────── */}
        <div className="flex-1 min-w-0 px-8 py-6">

          {/* Study identity */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{study.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-600">{study.product}</span>
              <span className="text-slate-300">·</span>
              <Clock className="h-3.5 w-3.5" />
              <span>{study.durationMinutes} min</span>
            </div>
            {study.goal && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 leading-relaxed">
                {study.goal}
              </div>
            )}
          </div>

          {/* Metrics strip */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[
              { icon: Users,        label: "Participants", value: study.participantCount,       accent: false },
              { icon: CheckCircle2, label: "Completed",    value: study.completedSessionCount,  accent: true  },
              { icon: TrendingUp,   label: "Completion",   value: `${completionPct}%`,           accent: false },
            ].map(({ icon: Icon, label, value, accent }) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm",
                  accent ? "border-indigo-100 bg-indigo-50/60" : "border-slate-100 bg-white",
                )}
              >
                <Icon className={cn("h-5 w-5", accent ? "text-indigo-500" : "text-slate-400")} />
                <div>
                  <p className={cn("text-xl font-semibold tabular-nums", accent ? "text-indigo-700" : "text-slate-800")}>{value}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="border-b border-slate-100 mb-5">
            <nav className="-mb-px flex gap-1">
              {TABS.map(({ id, label, icon: Icon, count }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      "inline-flex items-center gap-2 border-b-2 px-4 pb-3 pt-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-indigo-500" : "text-slate-400")} />
                    {label}
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      active ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500",
                    )}>{count}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ── Overview tab ───────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                {study.questions.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                    <p className="text-sm text-slate-400">No questions added yet.</p>
                  </div>
                ) : (
                  study.questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {i + 1}
                      </div>
                      <p className="pt-0.5 text-sm leading-relaxed text-slate-700">{q}</p>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* ── Sessions tab ───────────────────────────────────── */}
          {activeTab === "sessions" && (
            sessions.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white py-14 text-center shadow-sm">
                <MessageCircle className="mx-auto mb-3 h-9 w-9 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">No sessions yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Sessions are created when participants join their interview.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                {sessions.map((s) => {
                  const insightCount  = insightCountBySession.get(s.id) ?? 0;
                  const hasInsights   = insightCount > 0;
                  const totalTurns    = (s.aiTurnCount ?? 0) + (s.participantTurnCount ?? 0);
                  const talkPct       = totalTurns > 0
                    ? Math.round(((s.participantTurnCount ?? 0) / totalTurns) * 100)
                    : null;
                  const totalQs       = study.questions.length;
                  const progressPct   = s.status === "completed"
                    ? 100
                    : totalQs > 0 && s.questionIndex != null
                      ? Math.min(100, Math.round((s.questionIndex / totalQs) * 100))
                      : null;

                  return (
                    <Link
                      key={s.id}
                      href={`/sessions/${s.id}`}
                      className="group flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Status avatar */}
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        s.status === "completed" ? "bg-emerald-50" : "bg-slate-100",
                      )}>
                        <CheckCircle2 className={cn(
                          "h-4.5 w-4.5",
                          s.status === "completed" ? "text-emerald-500" : "text-slate-300",
                        )} />
                      </div>

                      {/* Identity + meta */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">
                          {s.participantEmail ?? "Anonymous"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="text-xs text-slate-400">{formatDateTime(s.createdAt)}</span>
                          {s.durationSeconds != null && s.durationSeconds > 0 && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Clock className="h-3 w-3" />
                                {formatDuration(s.durationSeconds)}
                              </span>
                            </>
                          )}
                          {talkPct !== null && (
                            <>
                              <span className="text-slate-200">·</span>
                              <span className="text-xs text-slate-400">{talkPct}% talk</span>
                            </>
                          )}
                        </div>
                        {/* Interview progress bar */}
                        {progressPct !== null && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={cn(
                                  "absolute inset-y-0 left-0 rounded-full transition-all",
                                  progressPct === 100 ? "bg-emerald-400" : "bg-indigo-400",
                                )}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {progressPct === 100 ? "complete" : `${progressPct}%`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Insight badge + status + chevron */}
                      <div className="flex shrink-0 items-center gap-2.5">
                        {hasInsights ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                            {insightCount} insight{insightCount === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-slate-100">
                            No insights
                          </span>
                        )}
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                          s.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : s.status === "active"
                              ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
                              : "bg-slate-50 text-slate-600 ring-slate-200",
                        )}>{s.status}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          )}


          {/* ── Insights tab ───────────────────────────────────── */}
          {activeTab === "insights" && (
            allInsights.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white py-12 text-center shadow-sm">
                <Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">No insights yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Generate insights on individual sessions and they'll appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Export button */}
                <div className="flex justify-end">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setExportOpen((v) => !v)}
                      className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export report
                    </button>
                    {exportOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                        <div className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                            onClick={() => {
                              setExportOpen(false);
                              if (!insightsData) { toast.error("Insights not loaded yet."); return; }
                              exportStudyReportPdf(
                                { title: study.title, product: study.product, goal: study.goal ?? undefined, durationMinutes: study.durationMinutes },
                                insightsData,
                              );
                              toast.success("PDF exported");
                            }}
                          >
                            <FileText className="h-3.5 w-3.5 text-indigo-400" />
                            Download PDF
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-t border-slate-50"
                            onClick={() => {
                              setExportOpen(false);
                              if (!insightsData) { toast.error("Insights not loaded yet."); return; }
                              exportStudyCsv(
                                { title: study.title, product: study.product, goal: study.goal ?? undefined, durationMinutes: study.durationMinutes },
                                insightsData,
                              );
                              toast.success("CSV exported");
                            }}
                          >
                            <BarChart2 className="h-3.5 w-3.5 text-emerald-400" />
                            Download CSV
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {/* Top Quotes */}
                {topQuotes.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-50 px-5 py-3.5">
                      <Quote className="h-4 w-4 text-amber-400" />
                      <span className="text-sm font-semibold text-slate-800">Top quotes</span>
                      <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">{topQuotes.length}</span>
                    </div>
                    <div className="space-y-3 p-5">
                      {topQuotes.map((q, i) => (
                        <blockquote key={i} className="relative rounded-xl border border-amber-100 bg-amber-50 px-5 py-4">
                          <span className="absolute -top-3 left-3 font-serif text-4xl leading-none text-amber-200 select-none">"</span>
                          <p className="relative text-sm leading-relaxed text-slate-700">{q.text}</p>
                          <p className="mt-2 text-xs text-amber-600/80">— {q.participantEmail}</p>
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tag summary */}
                {tagSummary.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-50 px-5 py-3.5">
                      <Tag className="h-4 w-4 text-violet-400" />
                      <span className="text-sm font-semibold text-slate-800">Annotation summary</span>
                      <span className="ml-auto text-xs text-slate-400">Click a tag to explore</span>
                    </div>
                    <div className="flex flex-wrap gap-3 p-5">
                      {tagSummary.map((t) => (
                        <button
                          key={t.tag}
                          type="button"
                          onClick={() => setSelectedTag(selectedTag === t.tag ? null : t.tag)}
                          className={cn(
                            "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                            TAG_COLORS[t.tag] ?? "bg-slate-100 text-slate-700",
                            selectedTag === t.tag ? "ring-2 ring-offset-1 ring-current scale-105 shadow-sm" : "hover:scale-105 hover:shadow-sm",
                          )}
                        >
                          <span>{t.tag}</span>
                          <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[11px] font-bold">{t.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tag drill-down panel */}
                {selectedTag !== null && (
                  <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-violet-50 bg-violet-50/60 px-5 py-3.5">
                      <Tag className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-semibold text-slate-800">
                        <span className={cn("mr-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", TAG_COLORS[selectedTag] ?? "bg-slate-100 text-slate-700")}>{selectedTag}</span>
                        turns across all sessions
                      </span>
                      {taggedTurnsQ.data && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-600">{taggedTurnsQ.data.turns.length}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedTag(null)}
                        className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-violet-100 hover:text-slate-600 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {taggedTurnsQ.isLoading ? (
                      <div className="space-y-3 p-5">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                        ))}
                      </div>
                    ) : taggedTurnsQ.data?.turns.length === 0 ? (
                      <div className="py-10 text-center">
                        <Tag className="mx-auto mb-3 h-7 w-7 text-slate-200" />
                        <p className="text-sm text-slate-400">No turns tagged as "{selectedTag}" yet.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {taggedTurnsQ.data?.turns.map((t) => (
                          <div key={`${t.turnId}-${t.tag}`} className="px-5 py-4">
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">{t.participantEmail}</span>
                              <span className="text-slate-200">·</span>
                              <Link
                                href={`/sessions/${t.sessionId}`}
                                className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition-colors"
                              >
                                View session
                              </Link>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-700">{t.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Session insights */}
                {allInsights.map((ins) => (
                  <div key={ins.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                    <div className="border-b border-slate-50 px-5 py-3.5">
                      <p className="text-sm text-slate-600 leading-relaxed">{ins.summary}</p>
                    </div>
                    <div className="grid gap-0 divide-y divide-slate-50 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      <InsightSection title="Pain points"      items={ins.painPoints}      tone="rose" />
                      <InsightSection title="User goals"       items={ins.userGoals}       tone="emerald" />
                      <InsightSection title="Feature requests" items={ins.featureRequests} tone="indigo" />
                      <InsightSection title="Recommendations"  items={ins.recommendations} tone="amber" />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* ── Right sidebar ──────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-l border-slate-100 bg-white px-5 py-6 space-y-6">

          {/* Invite CTA card */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-200">
            <Send className="mb-3 h-5 w-5 opacity-90" />
            <p className="text-sm font-semibold">Invite participants</p>
            <p className="mt-1 text-xs opacity-75">Add emails and send invites in one click.</p>
            <textarea
              value={emails}
              onChange={e => setEmails(e.target.value)}
              rows={2}
              placeholder="alex@example.com, jamie@example.com"
              className="mt-3 w-full resize-none rounded-lg bg-white/20 px-3 py-2 text-xs placeholder:text-white/50 text-white outline-none focus:ring-2 focus:ring-white/40"
            />
            {importStatus && <p className="mt-1 text-[11px] text-white/70">{importStatus}</p>}
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={addParticipants}
                disabled={addMut.isPending}
                className="flex-1 rounded-lg bg-white py-2 text-xs font-semibold text-indigo-700 hover:bg-white/90 transition-colors disabled:opacity-60"
              >
                {addMut.isPending ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/30 transition-colors"
              >
                <Upload className="h-3 w-3" /> Import
              </button>
            </div>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={sendInvites}
                disabled={sendMut.isPending}
                className="mt-2 w-full rounded-lg border border-white/30 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-60"
              >
                {sendMut.isPending ? "Sending…" : `Send ${pendingCount} invite${pendingCount === 1 ? "" : "s"}`}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          </div>

          {/* Upcoming slots */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Upcoming slots</p>
              <button
                type="button"
                onClick={() => { setShowAddSlot((v) => !v); setNewSlotValue(""); }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add slot
              </button>
            </div>

            {showAddSlot && (
              <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
                <input
                  type="datetime-local"
                  value={newSlotValue}
                  onChange={(e) => setNewSlotValue(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    disabled={addSlotMut.isPending}
                    className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {addSlotMut.isPending ? "Saving…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddSlot(false); setNewSlotValue(""); }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {study.slots.length === 0 ? (
              <p className="text-xs text-slate-400">No slots added yet.</p>
            ) : (
              <div className="space-y-2">
                {study.slots.map((slot, i) => (
                  <div key={i} className="group flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1 text-slate-600 truncate">{formatDateTime(slot)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(i)}
                      disabled={removeSlotMut.isPending}
                      className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500 transition-all disabled:opacity-40"
                      title="Remove slot"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent participants */}
          {participants.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Participants</p>
                <Link
                  href={`/studies/${id}/participants`}
                  className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {participants.slice(0, 6).map((p) => {
                  const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/invite/${p.inviteToken}`;
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                        {(p.name ?? p.email)[0]?.toUpperCase()}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-slate-600">{p.email}</span>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 font-medium",
                        STATUS_SIDEBAR[p.status] ?? "bg-slate-50 text-slate-600",
                      )}>{p.status}</span>
                      <button
                        onClick={() => copyLink(inviteUrl)}
                        className="shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-indigo-500 transition-colors"
                      >
                        {copied === inviteUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  );
                })}
                {participants.length > 6 && (
                  <Link
                    href={`/studies/${id}/participants`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    View all {participants.length} participants
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */
function InsightSection({ title, items, tone }: {
  title: string;
  items: string[];
  tone: "rose" | "emerald" | "indigo" | "amber";
}) {
  const dot = { rose: "bg-rose-400", emerald: "bg-emerald-400", indigo: "bg-indigo-400", amber: "bg-amber-400" }[tone];
  return (
    <div className="px-5 py-4">
      <InsightPill label={title} tone={tone} />
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-300">—</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightPill({ label, tone }: { label: string; tone: "rose" | "emerald" | "indigo" | "amber" }) {
  const cls = {
    rose:    "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    indigo:  "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    amber:   "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  }[tone];
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>;
}
