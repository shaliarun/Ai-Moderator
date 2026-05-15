export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatRelative(iso?: string): string {
  if (!iso) return "";
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.round((now - t) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return formatDateTime(iso);
}

export const STATUS_TONE: Record<string, string> = {
  active:      "bg-indigo-50 text-indigo-700 border border-indigo-200",
  draft:       "bg-slate-100 text-slate-600 border border-slate-200",
  completed:   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  archived:    "bg-slate-100 text-slate-500 border border-slate-200",
  pending:     "bg-amber-50 text-amber-700 border border-amber-200",
  invited:     "bg-violet-50 text-violet-700 border border-violet-200",
  accepted:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  declined:    "bg-rose-50 text-rose-700 border border-rose-200",
  rescheduled: "bg-blue-50 text-blue-700 border border-blue-200",
  abandoned:   "bg-slate-100 text-slate-500 border border-slate-200",
};
