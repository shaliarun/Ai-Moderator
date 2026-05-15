import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListStudies,
  useDeleteStudy,
  getListStudiesQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FlaskConical, ArrowUpRight, Users, Trash2 } from "lucide-react";
import { STATUS_TONE, formatRelative } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const STATUS_STRIP: Record<string, string> = {
  active:    "bg-indigo-400",
  draft:     "bg-slate-300",
  completed: "bg-emerald-400",
  archived:  "bg-slate-300",
};

export default function Studies() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data, isLoading } = useListStudies();
  const studies = data ?? [];
  const deleteMut = useDeleteStudy();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, studyId: string) => {
    e.stopPropagation();
    setConfirmId(studyId);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmId) return;
    deleteMut.mutate(
      { studyId: confirmId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListStudiesQueryKey() });
          toast.success("Study deleted");
          setConfirmId(null);
        },
        onError: () => {
          toast.error("Could not delete study");
          setConfirmId(null);
        },
      },
    );
  };

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Your work</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900">Studies</h1>
          <p className="mt-2 text-slate-500">Every research study you've designed and launched.</p>
        </div>
        <Link
          href="/studies/new"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-300/40 transition hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg hover:shadow-indigo-300/50 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          New study
        </Link>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : studies.length === 0 ? (
        <Card className="border border-slate-100 bg-white p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
            <FlaskConical className="h-6 w-6 text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No studies yet</h3>
          <p className="mt-1.5 text-sm text-slate-500">
            Create your first study and let the AI moderator do the interviews.
          </p>
          <Link
            href="/studies/new"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-300/40 hover:from-indigo-700 hover:to-violet-700 transition"
          >
            Create your first study <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {studies.map((s) => {
            const strip = STATUS_STRIP[s.status] ?? "bg-slate-200";
            const isPending = deleteMut.isPending && confirmId === s.id;
            const isConfirming = confirmId === s.id && !isPending;
            return (
              <div
                key={s.id}
                role="link"
                tabIndex={0}
                onClick={() => !confirmId && navigate(`/studies/${s.id}`)}
                onKeyDown={(e) => e.key === "Enter" && !confirmId && navigate(`/studies/${s.id}`)}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md hover:border-indigo-100"
              >
                {/* Status color strip */}
                <div className={`absolute inset-y-0 left-0 w-1 ${strip}`} />

                <div className="flex items-start justify-between gap-4 px-6 py-5 pl-7">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {s.title}
                      </h3>
                      <Badge className={STATUS_TONE[s.status] ?? "bg-slate-100 text-slate-600"}>
                        {s.status}
                      </Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{s.goal}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="font-medium text-slate-500">{s.product}</span>
                      <span className="text-slate-300">·</span>
                      <span>{s.durationMinutes} min</span>
                      <span className="text-slate-300">·</span>
                      <span>{s.questions.length} questions</span>
                      <span className="text-slate-300">·</span>
                      <span>Created {formatRelative(s.createdAt)}</span>
                    </div>
                  </div>

                  {/* Stats + always-visible actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Participant chip */}
                    <div className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                      <Users className="h-3 w-3 text-slate-400" />
                      {s.participantCount}
                    </div>
                    {/* Completion chip */}
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                      {s.completedSessionCount} done
                    </div>

                    {/* Always-visible quick actions */}
                    <div className="flex items-center gap-1 pl-1">
                      {/* Delete — inline confirm */}
                      {isConfirming ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-rose-600 font-medium">Delete?</span>
                          <button
                            type="button"
                            onClick={confirmDelete}
                            className="rounded-lg px-2 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setConfirmId(null); }}
                            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, s.id)}
                          disabled={isPending}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
