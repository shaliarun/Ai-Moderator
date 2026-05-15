import jsPDF from "jspdf";
import type { SessionDetail, StudyInsights } from "@workspace/api-client-react";

const MARGIN = 18;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  brand: [79, 70, 229] as [number, number, number],
  text: [28, 25, 23] as [number, number, number],
  muted: [120, 113, 108] as [number, number, number],
  light: [245, 245, 244] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  painPoint: [225, 29, 72] as [number, number, number],
  goal: [16, 185, 129] as [number, number, number],
  feature: [99, 102, 241] as [number, number, number],
  recommendation: [217, 119, 6] as [number, number, number],
};

function formatDate(iso?: string | Date): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(iso);
  }
}

export function exportSessionPdf(data: SessionDetail): void {
  const { session, transcript, study, insights } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const checkPageBreak = (needed: number) => {
    if (y + needed > 285) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const drawText = (
    text: string,
    x: number,
    fontSize: number,
    color: [number, number, number],
    style: "normal" | "bold" = "normal",
    maxWidth?: number
  ): number => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", style);
    const lines = doc.splitTextToSize(text, maxWidth ?? CONTENT_W);
    const lineH = fontSize * 0.4;
    checkPageBreak(lines.length * lineH + 2);
    doc.text(lines, x, y);
    const used = lines.length * lineH;
    y += used;
    return used;
  };

  const drawDivider = (color: [number, number, number] = COLORS.light) => {
    checkPageBreak(4);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
  };

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, PAGE_W, 36, "F");

  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  const titleText = doc.splitTextToSize(study?.title ?? "UX Research Session", CONTENT_W - 10);
  doc.text(titleText, MARGIN, 15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("UX Research · AI Moderator Report", MARGIN, 24);

  doc.setFontSize(8);
  doc.setTextColor(200, 195, 250);
  doc.text(`Generated ${formatDate(new Date())}`, PAGE_W - MARGIN, 24, { align: "right" });

  y = 44;

  // ── Participant info ──────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.light);
  doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, "F");

  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.setFont("helvetica", "bold");
  doc.text("PARTICIPANT", MARGIN + 5, y + 7);
  doc.text("STATUS", MARGIN + 65, y + 7);
  doc.text("DATE", MARGIN + 115, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.text);
  doc.text(session.participantEmail ?? "Anonymous", MARGIN + 5, y + 15);
  doc.text(session.status, MARGIN + 65, y + 15);
  doc.text(formatDate(session.createdAt), MARGIN + 115, y + 15);

  y += 26;

  // ── Insights ─────────────────────────────────────────────────────────────
  if (insights) {
    drawText("Insights", MARGIN, 13, COLORS.brand, "bold");
    y += 2;
    drawDivider();

    if (insights.summary) {
      drawText(insights.summary, MARGIN, 9.5, COLORS.text, "normal", CONTENT_W);
      y += 5;
    }

    const sections: Array<{
      title: string;
      items: string[];
      color: [number, number, number];
    }> = [
      { title: "Pain Points", items: insights.painPoints, color: COLORS.painPoint },
      { title: "User Goals", items: insights.userGoals, color: COLORS.goal },
      { title: "Feature Requests", items: insights.featureRequests, color: COLORS.feature },
      { title: "Recommendations", items: insights.recommendations, color: COLORS.recommendation },
    ];

    for (const section of sections) {
      checkPageBreak(12);

      doc.setFillColor(...section.color);
      doc.rect(MARGIN, y, 2.5, 5, "F");

      doc.setFontSize(8.5);
      doc.setTextColor(...section.color);
      doc.setFont("helvetica", "bold");
      doc.text(section.title.toUpperCase(), MARGIN + 5, y + 4);
      y += 8;

      if (section.items.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.muted);
        doc.setFont("helvetica", "italic");
        doc.text("No items identified.", MARGIN + 6, y + 3);
        y += 7;
      } else {
        for (const item of section.items) {
          const lines = doc.splitTextToSize(item, CONTENT_W - 8);
          const itemH = lines.length * 4 + 2;
          checkPageBreak(itemH + 2);

          doc.setFillColor(...section.color);
          doc.circle(MARGIN + 2.5, y + 1.5, 1, "F");

          doc.setFontSize(9);
          doc.setTextColor(...COLORS.text);
          doc.setFont("helvetica", "normal");
          doc.text(lines, MARGIN + 6, y + 3);
          y += itemH;
        }
      }
      y += 4;
    }
  }

  // ── Transcript ────────────────────────────────────────────────────────────
  if (transcript.length > 0) {
    checkPageBreak(14);
    drawText("Transcript", MARGIN, 13, COLORS.brand, "bold");
    y += 2;
    drawDivider();

    for (const turn of transcript) {
      const isAi = turn.speaker === "ai";
      const label = isAi ? "Moderator" : "Participant";
      const labelColor: [number, number, number] = isAi ? COLORS.muted : COLORS.brand;
      const lines = doc.splitTextToSize(turn.text, CONTENT_W - 4);
      const blockH = lines.length * 4 + 10;
      checkPageBreak(blockH + 3);

      if (!isAi) {
        doc.setFillColor(238, 238, 255);
        doc.roundedRect(MARGIN + 10, y, CONTENT_W - 10, blockH, 2, 2, "F");
      } else {
        doc.setFillColor(...COLORS.light);
        doc.roundedRect(MARGIN, y, CONTENT_W - 10, blockH, 2, 2, "F");
      }

      const bx = isAi ? MARGIN + 3 : MARGIN + 13;
      doc.setFontSize(7);
      doc.setTextColor(...labelColor);
      doc.setFont("helvetica", "bold");
      doc.text(label.toUpperCase(), bx, y + 5);

      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      doc.text(lines, bx, y + 9);

      y += blockH + 3;
    }
  }

  // ── Footer on each page ───────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${study?.title ?? "Session"} · Confidential`,
      MARGIN,
      294
    );
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, 294, { align: "right" });
  }

  const safeName = (study?.title ?? "session").replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`${safeName}_report.pdf`);
}

/* ── Study-level report export ───────────────────────────── */

type StudyMeta = {
  title: string;
  product: string;
  goal?: string;
  durationMinutes: number;
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function exportStudyReportPdf(study: StudyMeta, insightsData: StudyInsights): void {
  const { metrics, sessionInsights } = insightsData;
  const themeFrequency = insightsData.themeFrequency ?? [];
  const topQuotes      = insightsData.topQuotes ?? [];
  const tagSummary     = insightsData.tagSummary ?? [];
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const checkPageBreak = (needed: number) => {
    if (y + needed > 285) { doc.addPage(); y = MARGIN; }
  };

  const drawText = (
    text: string,
    x: number,
    fontSize: number,
    color: [number, number, number],
    style: "normal" | "bold" = "normal",
    maxWidth?: number,
  ): number => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", style);
    const lines = doc.splitTextToSize(text, maxWidth ?? CONTENT_W);
    const lineH = fontSize * 0.4;
    checkPageBreak(lines.length * lineH + 2);
    doc.text(lines, x, y);
    const used = lines.length * lineH;
    y += used;
    return used;
  };

  const drawDivider = (color: [number, number, number] = COLORS.light) => {
    checkPageBreak(4);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
  };

  const sectionHeading = (label: string) => {
    checkPageBreak(14);
    drawText(label, MARGIN, 13, COLORS.brand, "bold");
    y += 2;
    drawDivider();
  };

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, PAGE_W, 38, "F");

  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(study.title, CONTENT_W - 10);
  doc.text(titleLines, MARGIN, 15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${study.product} · ${study.durationMinutes} min sessions`, MARGIN, 26);
  doc.text("UX Research · Study Insights Report", MARGIN, 31);

  doc.setFontSize(8);
  doc.setTextColor(200, 195, 250);
  doc.text(`Generated ${formatDate(new Date())}`, PAGE_W - MARGIN, 31, { align: "right" });

  y = 46;

  // ── Study goal ───────────────────────────────────────────────────────────
  if (study.goal) {
    doc.setFillColor(...COLORS.light);
    const goalLines = doc.splitTextToSize(study.goal, CONTENT_W - 10);
    const goalH = goalLines.length * 4 + 8;
    doc.roundedRect(MARGIN, y, CONTENT_W, goalH, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "bold");
    doc.text("STUDY GOAL", MARGIN + 4, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.text(goalLines, MARGIN + 4, y + 10);
    y += goalH + 6;
  }

  // ── Key metrics ──────────────────────────────────────────────────────────
  if (metrics) {
    sectionHeading("Key Metrics");

    const mItems = [
      { label: "Completion Rate", value: `${Math.round(metrics.completionRate * 100)}%` },
      { label: "Avg Duration",    value: formatDuration(metrics.avgDurationSeconds) },
      { label: "Talk Ratio",      value: `${Math.round(metrics.avgTalkRatio * 100)}%` },
      { label: "Total Sessions",  value: String(metrics.totalSessions) },
      { label: "Completed",       value: String(metrics.completedSessions) },
    ];

    const colW = CONTENT_W / mItems.length;
    checkPageBreak(22);
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, "F");

    mItems.forEach((m, i) => {
      const cx = MARGIN + colW * i + colW / 2;
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.setFont("helvetica", "bold");
      doc.text(m.label.toUpperCase(), cx, y + 6, { align: "center" });
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.brand);
      doc.setFont("helvetica", "bold");
      doc.text(m.value, cx, y + 14, { align: "center" });
    });
    y += 26;
  }

  // ── Theme frequency ──────────────────────────────────────────────────────
  if (themeFrequency.length > 0) {
    sectionHeading("Theme Frequency");
    const maxCount = themeFrequency[0]?.count ?? 1;
    const barMaxW = CONTENT_W - 60;

    for (const t of themeFrequency) {
      checkPageBreak(8);
      const labelLines = doc.splitTextToSize(t.theme, 55);
      const rowH = Math.max(8, labelLines.length * 4);

      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "normal");
      doc.text(labelLines, MARGIN, y + 5);

      const barW = Math.max(2, (t.count / maxCount) * barMaxW);
      doc.setFillColor(...COLORS.brand);
      doc.roundedRect(MARGIN + 60, y + 1.5, barW, 4, 1, 1, "F");

      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(String(t.count), MARGIN + 60 + barW + 2, y + 5);

      y += rowH;
    }
    y += 4;
  }

  // ── Top quotes ───────────────────────────────────────────────────────────
  if (topQuotes.length > 0) {
    sectionHeading("Top Quotes");

    for (const q of topQuotes) {
      const lines = doc.splitTextToSize(q.text, CONTENT_W - 8);
      const blockH = lines.length * 4.2 + 12;
      checkPageBreak(blockH + 4);

      doc.setFillColor(255, 251, 235);
      doc.roundedRect(MARGIN, y, CONTENT_W, blockH, 2, 2, "F");
      doc.setDrawColor(253, 211, 77);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y, MARGIN, y + blockH);

      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      doc.setFont("helvetica", "italic");
      doc.text(lines, MARGIN + 5, y + 7);

      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.setFont("helvetica", "bold");
      doc.text(`— ${q.participantEmail}`, MARGIN + 5, y + blockH - 4);

      y += blockH + 4;
    }
  }

  // ── Tag summary ──────────────────────────────────────────────────────────
  if (tagSummary.length > 0) {
    sectionHeading("Annotation Summary");

    const tagColors: Record<string, [number, number, number]> = {
      "Insight":        [79, 70, 229],
      "Pain Point":     [225, 29, 72],
      "Quote":          [217, 119, 6],
      "Recommendation": [16, 185, 129],
      "Positive":       [20, 184, 166],
    };

    checkPageBreak(16);
    const pillW = 44;
    const pillH = 10;
    const pillGap = 4;
    let px = MARGIN;

    for (const t of tagSummary) {
      if (px + pillW > PAGE_W - MARGIN) {
        px = MARGIN;
        y += pillH + pillGap;
        checkPageBreak(pillH + pillGap);
      }
      const c = tagColors[t.tag] ?? ([100, 116, 139] as [number, number, number]);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.setGState(doc.GState({ opacity: 0.15 }));
      doc.roundedRect(px, y, pillW, pillH, 2, 2, "F");
      doc.setGState(doc.GState({ opacity: 1 }));

      doc.setTextColor(...c);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${t.tag} (${t.count})`, px + pillW / 2, y + 6.5, { align: "center" });

      px += pillW + pillGap;
    }
    y += pillH + 8;
  }

  // ── Per-session summaries ────────────────────────────────────────────────
  if (sessionInsights.length > 0) {
    sectionHeading("Per-Session Summaries");

    const insightSections = [
      { title: "Pain Points",      key: "painPoints"      as const, color: COLORS.painPoint },
      { title: "User Goals",       key: "userGoals"       as const, color: COLORS.goal },
      { title: "Feature Requests", key: "featureRequests" as const, color: COLORS.feature },
      { title: "Recommendations",  key: "recommendations" as const, color: COLORS.recommendation },
    ];

    sessionInsights.forEach((ins, idx) => {
      checkPageBreak(18);

      doc.setFillColor(...COLORS.brand);
      doc.setGState(doc.GState({ opacity: 0.08 }));
      doc.rect(MARGIN, y, CONTENT_W, 7, "F");
      doc.setGState(doc.GState({ opacity: 1 }));

      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.brand);
      doc.setFont("helvetica", "bold");
      doc.text(`Session ${idx + 1}`, MARGIN + 2, y + 5);
      y += 10;

      if (ins.summary) {
        const sumLines = doc.splitTextToSize(ins.summary, CONTENT_W);
        checkPageBreak(sumLines.length * 3.8 + 4);
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.text);
        doc.setFont("helvetica", "italic");
        doc.text(sumLines, MARGIN, y);
        y += sumLines.length * 3.8 + 4;
      }

      for (const sect of insightSections) {
        const items = ins[sect.key];
        if (!items || items.length === 0) continue;

        checkPageBreak(10);
        doc.setFillColor(...sect.color);
        doc.rect(MARGIN, y, 2, 4.5, "F");
        doc.setFontSize(7.5);
        doc.setTextColor(...sect.color);
        doc.setFont("helvetica", "bold");
        doc.text(sect.title.toUpperCase(), MARGIN + 4, y + 4);
        y += 7;

        for (const item of items) {
          const lines = doc.splitTextToSize(item, CONTENT_W - 8);
          const itemH = lines.length * 4 + 2;
          checkPageBreak(itemH);
          doc.setFillColor(...sect.color);
          doc.circle(MARGIN + 2, y + 1.5, 0.9, "F");
          doc.setFontSize(8.5);
          doc.setTextColor(...COLORS.text);
          doc.setFont("helvetica", "normal");
          doc.text(lines, MARGIN + 6, y + 3);
          y += itemH;
        }
        y += 3;
      }
      y += 5;
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.text(`${study.title} · Study Report · Confidential`, MARGIN, 294);
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, 294, { align: "right" });
  }

  const safeName = study.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`${safeName}_study_report.pdf`);
}
