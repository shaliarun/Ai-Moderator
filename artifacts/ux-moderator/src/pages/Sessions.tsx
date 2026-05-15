import { Link } from "wouter";
import { useListSessions } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, ArrowUpRight } from "lucide-react";
import { STATUS_TONE, formatRelative } from "@/lib/format";

export default function Sessions() {
  const { data, isLoading } = useListSessions();
  const sessions = data ?? [];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Conversations</p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-slate-900">Sessions</h1>
        <p className="mt-2 text-slate-500">Every interview the AI moderator has run for you.</p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border border-slate-100 bg-white p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
            <MessageCircle className="h-6 w-6 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No sessions yet</h3>
          <p className="mt-1.5 text-sm text-slate-500">
            Invite participants to a study — sessions will appear here once they begin.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-slate-100 bg-white shadow-sm">
          <ul className="divide-y divide-slate-50">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="group flex items-center justify-between px-5 py-4 transition hover:bg-slate-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {s.studyTitle ?? "Untitled study"}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {s.participantEmail ?? "Anonymous"}
                      <span className="mx-1.5 text-slate-300">·</span>
                      {s.turnCount} turns
                      <span className="mx-1.5 text-slate-300">·</span>
                      {formatRelative(s.createdAt)}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <Badge className={STATUS_TONE[s.status] ?? "bg-slate-100 text-slate-600"}>
                      {s.status}
                    </Badge>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
