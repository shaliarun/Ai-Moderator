import { Router, type IRouter } from "express";
import {
  db,
  studiesTable,
  participantsTable,
  sessionsTable,
  insightsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  const studies = await db.select().from(studiesTable);
  const participants = await db.select().from(participantsTable);
  const sessions = await db.select().from(sessionsTable);
  const insights = await db.select().from(insightsTable);

  res.json({
    totalStudies: studies.length,
    activeStudies: studies.filter((s) => s.status === "active").length,
    totalParticipants: participants.length,
    completedSessions: sessions.filter((s) => s.status === "completed").length,
    pendingInvites: participants.filter((p) => p.status === "invited" || p.status === "pending").length,
    totalInsights: insights.length,
  });
});

router.get("/dashboard/recent-activity", async (_req, res) => {
  const studies = await db
    .select()
    .from(studiesTable)
    .orderBy(desc(studiesTable.createdAt))
    .limit(10);
  const participants = await db
    .select()
    .from(participantsTable)
    .orderBy(desc(participantsTable.createdAt))
    .limit(20);
  const sessions = await db
    .select()
    .from(sessionsTable)
    .orderBy(desc(sessionsTable.createdAt))
    .limit(20);
  const insights = await db
    .select()
    .from(insightsTable)
    .orderBy(desc(insightsTable.createdAt))
    .limit(20);

  const studyById = new Map(studies.map((s) => [s.id, s]));
  async function studyTitle(id: string): Promise<string | undefined> {
    if (studyById.has(id)) return studyById.get(id)!.title;
    const [s] = await db.select().from(studiesTable).where(eq(studiesTable.id, id));
    if (s) studyById.set(id, s);
    return s?.title;
  }

  type Item = {
    id: string;
    kind: string;
    message: string;
    studyId?: string;
    studyTitle?: string;
    createdAt: string;
  };
  const items: Item[] = [];

  for (const s of studies) {
    items.push({
      id: `study-${s.id}`,
      kind: "study_created",
      message: `New study "${s.title}" created`,
      studyId: s.id,
      studyTitle: s.title,
      createdAt: s.createdAt.toISOString(),
    });
  }
  for (const p of participants) {
    const title = await studyTitle(p.studyId);
    if (p.status === "accepted") {
      items.push({
        id: `accept-${p.id}`,
        kind: "invite_accepted",
        message: `${p.email} accepted invite to "${title ?? "study"}"`,
        studyId: p.studyId,
        studyTitle: title,
        createdAt: (p.respondedAt ?? p.createdAt).toISOString(),
      });
    } else if (p.status === "declined") {
      items.push({
        id: `decline-${p.id}`,
        kind: "invite_declined",
        message: `${p.email} declined invite to "${title ?? "study"}"`,
        studyId: p.studyId,
        studyTitle: title,
        createdAt: (p.respondedAt ?? p.createdAt).toISOString(),
      });
    } else {
      items.push({
        id: `part-${p.id}`,
        kind: "participant_added",
        message: `${p.email} added to "${title ?? "study"}"`,
        studyId: p.studyId,
        studyTitle: title,
        createdAt: p.createdAt.toISOString(),
      });
    }
  }
  for (const s of sessions) {
    if (s.status === "completed") {
      const title = await studyTitle(s.studyId);
      items.push({
        id: `sess-${s.id}`,
        kind: "session_completed",
        message: `Interview session completed for "${title ?? "study"}"`,
        studyId: s.studyId,
        studyTitle: title,
        createdAt: (s.endedAt ?? s.createdAt).toISOString(),
      });
    }
  }
  for (const i of insights) {
    const sessionRow = sessions.find((s) => s.id === i.sessionId);
    const title = sessionRow ? await studyTitle(sessionRow.studyId) : undefined;
    items.push({
      id: `ins-${i.id}`,
      kind: "insights_generated",
      message: `AI insights generated for "${title ?? "study"}"`,
      studyId: sessionRow?.studyId,
      studyTitle: title,
      createdAt: i.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(items.slice(0, 20));
});

export default router;
