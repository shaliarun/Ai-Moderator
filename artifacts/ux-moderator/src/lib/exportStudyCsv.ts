import type { StudyInsights } from "@workspace/api-client-react";

type StudyMeta = {
  title: string;
  product: string;
  goal?: string;
  durationMinutes: number;
};

function escape(value: string | number | undefined | null): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | undefined | null)[]): string {
  return cells.map(escape).join(",");
}

function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function exportStudyCsv(study: StudyMeta, insights: StudyInsights): void {
  const { metrics, sessionInsights } = insights;
  const themeFrequency = insights.themeFrequency ?? [];
  const topQuotes      = insights.topQuotes ?? [];
  const tagSummary     = insights.tagSummary ?? [];
  const lines: string[] = [];

  lines.push(row("Study Report:", study.title));
  lines.push(row("Product:", study.product));
  if (study.goal) lines.push(row("Goal:", study.goal));
  lines.push(row("Duration (min):", study.durationMinutes));
  lines.push(row("Generated:", new Date().toLocaleDateString()));
  lines.push("");

  lines.push(row("=== KEY METRICS ==="));
  lines.push(row("Metric", "Value"));
  if (metrics) {
    lines.push(row("Completion Rate", formatPct(metrics.completionRate)));
    lines.push(row("Avg Duration", formatDuration(metrics.avgDurationSeconds)));
    lines.push(row("Talk Ratio (participant)", formatPct(metrics.avgTalkRatio)));
    lines.push(row("Total Sessions", metrics.totalSessions));
    lines.push(row("Completed Sessions", metrics.completedSessions));
  }
  lines.push("");

  lines.push(row("=== THEME FREQUENCY ==="));
  lines.push(row("Theme", "Count"));
  for (const t of themeFrequency) {
    lines.push(row(t.theme, t.count));
  }
  lines.push("");

  lines.push(row("=== TOP QUOTES ==="));
  lines.push(row("Participant", "Quote"));
  for (const q of topQuotes) {
    lines.push(row(q.participantEmail, q.text));
  }
  lines.push("");

  lines.push(row("=== TAG SUMMARY ==="));
  lines.push(row("Tag", "Count"));
  for (const t of tagSummary) {
    lines.push(row(t.tag, t.count));
  }
  lines.push("");

  lines.push(row("=== PER-SESSION SUMMARIES ==="));
  lines.push(row("Session #", "Summary", "Pain Points", "User Goals", "Feature Requests", "Recommendations"));
  sessionInsights.forEach((ins, i) => {
    lines.push(row(
      i + 1,
      ins.summary,
      ins.painPoints.join("; "),
      ins.userGoals.join("; "),
      ins.featureRequests.join("; "),
      ins.recommendations.join("; "),
    ));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = study.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  a.download = `${safeName}_report.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
