import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSession,
  useGenerateInsights,
  customFetch,
  getGetSessionQueryKey,
  getGetStudyInsightsQueryKey,
  getGetDashboardSummaryQueryKey,
  type TranscriptTurn,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Download, Tag, X, Clock, MessageCircle, Activity, HelpCircle } from "lucide-react";
import { STATUS_TONE, formatRelative, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { exportSessionPdf } from "@/lib/exportPdf";
import { cn } from "@/lib/utils";

const TURN_TAGS = ["Insight", "Pain Point", "Quote", "Recommendation", "Positive"] as const;
type TurnTag = typeof TURN_TAGS[number];

const TAG_STYLES: Record<TurnTag, { pill: string; dot: string }> = {
  "Insight":        { pill: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-400" },
  "Pain Point":     { pill: "bg-rose-100 text-rose-700 border-rose-200",       dot: "bg-rose-400" },
  "Quote":          { pill: "bg-amber-100 text-amber-700 border-amber-200",    dot: "bg-amber-400" },
  "Recommendation": { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  "Positive":       { pill: "bg-teal-100 text-teal-700 border-teal-200",      dot: "bg-teal-400" },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default function SessionDetail({ id }: { id: string }) {
  const qc       = useQueryClient();
  const sessionQ = useGetSession(id, { query: { enabled: !!id, queryKey: getGetSessionQueryKey(id) } });
  const genMut   = useGenerateInsights();

  // Local tag state: turnId -> tag[]
  const [localTags, setLocalTags] = useState<Record<string, string[]>>({});
  const [tagsInitialized, setTagsInitialized] = useState(false);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const popoverRef = useRef<HTMLOListElement>(null);

  // Close popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Initialize tags from server data
  useEffect(() => {
    if (!tagsInitialized && sessionQ.data?.transcript) {
      const tags: Record<string, string[]> = {};
      for (const turn of sessionQ.data.transcript) {
        if (turn.tags && turn.tags.length > 0) {
          tags[turn.id] = turn.tags;
        }
      }
      setLocalTags(tags);
      setTagsInitialized(true);
    }
  }, [tagsInitialized, sessionQ.data?.transcript]);

  if (sessionQ.isLoading || !sessionQ.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
        <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const { session, transcript, study, insights } = sessionQ.data;

  const generate = () => {
    genMut.mutate({ sessionId: id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey(id) });
        if (study) qc.invalidateQueries({ queryKey: getGetStudyInsightsQueryKey(study.id) });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast.success("Insights ready");
      },
      onError: () => toast.error("Could not generate insights."),
    });
  };

  const toggleTag = async (turnId: string, tag: string) => {
    const current = localTags[turnId] ?? [];
    const hasTag = current.includes(tag);

    // Optimistic update
    setLocalTags((prev) => ({
      ...prev,
      [turnId]: hasTag ? current.filter((t) => t !== tag) : [...current, tag],
    }));

    try {
      if (hasTag) {
        const data = await customFetch<{ turnId: string; tags: string[] }>(`/api/sessions/${id}/turns/${turnId}/tags/${encodeURIComponent(tag)}`, {
          method: "DELETE",
        });
        setLocalTags((prev) => ({ ...prev, [turnId]: data.tags }));
      } else {
        const data = await customFetch<{ turnId: string; tags: string[] }>(`/api/sessions/${id}/turns/${turnId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag }),
        });
        setLocalTags((prev) => ({ ...prev, [turnId]: data.tags }));
        if (study) qc.invalidateQueries({ queryKey: getGetStudyInsightsQueryKey(study.id) });
      }
    } catch {
      // Revert optimistic update
      setLocalTags((prev) => ({ ...prev, [turnId]: current }));
      toast.error("Could not save tag.");
    }
  };

  // Session metrics
  const durationSeconds = (session as { durationSeconds?: number }).durationSeconds;
  const aiTurnCount = (session as { aiTurnCount?: number }).aiTurnCount ?? 0;
  const participantTurnCount = (session as { participantTurnCount?: number }).participantTurnCount ?? 0;
  const totalTurns = aiTurnCount + participantTurnCount;
  const talkRatio = totalTurns > 0 ? Math.round((participantTurnCount / totalTurns) * 100) : 0;
  const questionIndex = (session as { questionIndex?: number }).questionIndex ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors"
        >
          ← All sessions
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {study?.title ?? "Session"}
          </h1>
          <Badge className={STATUS_TONE[session.status] ?? "bg-slate-100"}>{session.status}</Badge>
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {session.participantEmail ?? "Anonymous"}
          <span className="mx-1.5 text-slate-300">·</span>
          {formatRelative(session.createdAt)}
        </div>

        {/* Session metrics row */}
        <div className="mt-4 flex flex-wrap gap-3">
          {durationSeconds !== undefined && durationSeconds > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {formatDuration(durationSeconds)}
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            {questionIndex} of {study?.questions?.length ?? "?"} questions answered
          </div>
          {totalTurns > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Activity className="h-3.5 w-3.5 text-slate-400" />
              {talkRatio}% participant talk ratio
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <MessageCircle className="h-3.5 w-3.5 text-slate-400" />
            {transcript.length} turns
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">

        {/* Transcript */}
        <Card className="border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-50 px-6 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Transcript
              <span className="ml-2 text-[10px] font-normal normal-case text-slate-300">
                click the tag icon to annotate turns
              </span>
            </h2>
          </div>

          {transcript.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              No turns recorded yet.
            </div>
          ) : (
            <ol className="space-y-1 p-6" ref={popoverRef}>
              {transcript.map((t, idx) => {
                const isAi  = t.speaker === "ai";
                const showTimestamp = idx === 0 || (idx % 4 === 0);
                const turnTags = localTags[t.id] ?? [];
                const isPopoverOpen = openPopover === t.id;

                return (
                  <li key={t.id}>
                    {showTimestamp && (
                      <div className="my-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="text-[10px] text-slate-400">
                          {formatDateTime(t.createdAt)}
                        </span>
                        <div className="h-px flex-1 bg-slate-100" />
                      </div>
                    )}
                    <div className={`flex gap-2 ${isAi ? "pr-6" : "pl-6 flex-row-reverse"}`}>
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold self-end mb-1 ${
                        isAi ? "bg-indigo-100 text-indigo-500" : "bg-slate-100 text-slate-500"
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1 relative">
                        <div className={`mb-1 flex items-center gap-2 ${isAi ? "" : "flex-row-reverse"}`}>
                          <span className={`text-[10px] font-semibold uppercase tracking-widest ${
                            isAi ? "text-indigo-400" : "text-slate-400"
                          }`}>
                            {isAi ? "Moderator" : "Participant"}
                          </span>
                          {/* Tag chips */}
                          {turnTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {turnTags.map((tag) => {
                                const style = TAG_STYLES[tag as TurnTag] ?? { pill: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" };
                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleTag(t.id, tag)}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-70",
                                      style.pill,
                                    )}
                                    title={`Remove ${tag}`}
                                  >
                                    {tag}
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className={`group relative ${isAi ? "" : "flex justify-end"}`}>
                          <div className={
                            isAi
                              ? "rounded-2xl rounded-tl-sm border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-slate-800"
                              : "rounded-2xl rounded-tr-sm bg-slate-800 px-4 py-3 text-sm leading-relaxed text-white"
                          }>
                            {t.text}
                          </div>
                          {/* Tag button */}
                          <div className={`absolute ${isAi ? "-right-7" : "-left-7"} top-1/2 -translate-y-1/2 z-10`}>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenPopover(isPopoverOpen ? null : t.id)}
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                                  isPopoverOpen
                                    ? "border-indigo-300 bg-indigo-100 text-indigo-600 opacity-100"
                                    : "border-slate-200 bg-white text-slate-400 opacity-0 group-hover:opacity-100 hover:border-indigo-300 hover:text-indigo-500",
                                )}
                                title="Tag this turn"
                              >
                                <Tag className="h-2.5 w-2.5" />
                              </button>

                              {/* Popover */}
                              {isPopoverOpen && (
                                <div className={cn(
                                  "absolute top-6 z-50 rounded-xl border border-slate-100 bg-white p-2 shadow-lg",
                                  isAi ? "right-0" : "left-0",
                                  "w-44",
                                )}>
                                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Tag as</p>
                                  {TURN_TAGS.map((tag) => {
                                    const style = TAG_STYLES[tag];
                                    const selected = turnTags.includes(tag);
                                    return (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() => { toggleTag(t.id, tag); setOpenPopover(null); }}
                                        className={cn(
                                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                                          selected
                                            ? cn(style.pill, "border")
                                            : "text-slate-700 hover:bg-slate-50",
                                        )}
                                      >
                                        <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
                                        {tag}
                                        {selected && <Check className="ml-auto h-3 w-3" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Insights */}
        <div className="space-y-4">
          <Card className="border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-50 px-6 py-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Insights</h2>
              {insights && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportSessionPdf(sessionQ.data)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                  <Button size="sm" variant="ghost" onClick={generate} disabled={genMut.isPending}>
                    Regenerate
                  </Button>
                </div>
              )}
            </div>

            {!insights ? (
              <div className="p-6">
                <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-900">Ready to analyze</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-700">
                    Let the AI extract themes, pain points, and recommendations from this transcript.
                  </p>
                  <Button
                    onClick={generate}
                    disabled={genMut.isPending}
                    size="sm"
                    className="mt-3 bg-amber-500 text-white hover:bg-amber-600"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {genMut.isPending ? "Reading…" : "Generate insights"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-6">
                <div className="relative rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <span className="absolute -top-3 left-3 font-serif text-4xl leading-none text-indigo-200 select-none">"</span>
                  <p className="relative text-sm leading-relaxed text-slate-700">{insights.summary}</p>
                </div>
                <InsightCard title="Pain points"       items={insights.painPoints}      tone="rose" />
                <InsightCard title="User goals"        items={insights.userGoals}        tone="emerald" />
                <InsightCard title="Feature requests"  items={insights.featureRequests}  tone="indigo" />
                <InsightCard title="Recommendations"   items={insights.recommendations}  tone="amber" />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function InsightCard({
  title, items, tone,
}: {
  title: string;
  items: string[];
  tone: "rose" | "emerald" | "indigo" | "amber";
}) {
  if (items.length === 0) return null;
  const cfg = {
    rose:    { bg: "bg-rose-50",    border: "border-rose-100",    pill: "bg-rose-100 text-rose-700",    dot: "bg-rose-400" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100", pill: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-400" },
    indigo:  { bg: "bg-indigo-50",  border: "border-indigo-100",  pill: "bg-indigo-100 text-indigo-700",  dot: "bg-indigo-400" },
    amber:   { bg: "bg-amber-50",   border: "border-amber-100",   pill: "bg-amber-100 text-amber-700",    dot: "bg-amber-400" },
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${cfg.pill}`}>
          {title}
        </span>
        <span className="text-[11px] text-slate-400">{items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
            <span className="text-sm leading-relaxed text-slate-700">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
