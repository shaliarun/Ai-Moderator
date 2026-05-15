import { Router, type IRouter } from "express";
import { db, studiesTable, participantsTable, sessionsTable, insightsTable, turnTagsTable, transcriptTurnsTable } from "@workspace/db";
import { eq, sql, desc, asc, inArray, and } from "drizzle-orm";
import { CreateStudyBody } from "@workspace/api-zod";
import type { ScreenerQuestion } from "@workspace/db";

const router: IRouter = Router();


async function serializeStudy(s: typeof studiesTable.$inferSelect) {
  const [counts] = await db
    .select({
      participants: sql<number>`count(distinct ${participantsTable.id})::int`,
      completed: sql<number>`count(distinct case when ${sessionsTable.status} = 'completed' then ${sessionsTable.id} end)::int`,
    })
    .from(studiesTable)
    .leftJoin(participantsTable, eq(participantsTable.studyId, studiesTable.id))
    .leftJoin(sessionsTable, eq(sessionsTable.studyId, studiesTable.id))
    .where(eq(studiesTable.id, s.id))
    .groupBy(studiesTable.id);

  return {
    id: s.id,
    title: s.title,
    product: s.product,
    goal: s.goal,
    durationMinutes: s.durationMinutes,
    questions: s.questions,
    slots: s.slots,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    participantCount: counts?.participants ?? 0,
    completedSessionCount: counts?.completed ?? 0,
    videoStatus: s.videoStatus ?? "none",
    questionVideos: s.questionVideos ?? null,
    screenerQuestions: s.screenerQuestions ?? [],
  };
}

router.get("/studies", async (_req, res) => {
  const rows = await db.select().from(studiesTable).orderBy(desc(studiesTable.createdAt));
  const result = await Promise.all(rows.map(serializeStudy));
  res.json(result);
});

router.post("/studies", async (req, res) => {
  const body = CreateStudyBody.parse(req.body);
  const [row] = await db
    .insert(studiesTable)
    .values({
      title: body.title,
      product: body.product,
      goal: body.goal,
      durationMinutes: body.durationMinutes,
      questions: body.questions,
      slots: body.slots.map((s) => new Date(s).toISOString()),
      status: "active",
    })
    .returning();
  if (!row) {
    res.status(500).json({ error: "Failed to create study" });
    return;
  }
  res.status(201).json(await serializeStudy(row));
});

router.get("/studies/:studyId", async (req, res) => {
  const studyId = req.params.studyId;
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }

  const participants = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.studyId, studyId))
    .orderBy(desc(participantsTable.createdAt));

  const sessionsRaw = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.studyId, studyId))
    .orderBy(desc(sessionsTable.createdAt));

  const participantById = new Map(participants.map((p) => [p.id, p]));

  const summary = await serializeStudy(study);
  res.json({
    ...summary,
    participants: participants.map((p) => ({
      id: p.id,
      studyId: p.studyId,
      email: p.email,
      name: p.name ?? undefined,
      status: p.status,
      inviteToken: p.inviteToken,
      chosenSlot: p.chosenSlot?.toISOString(),
      suggestedSlot: p.suggestedSlot?.toISOString(),
      respondedAt: p.respondedAt?.toISOString(),
      createdAt: p.createdAt.toISOString(),
      screenerPassed: p.screenerPassed ?? undefined,
      screenerAnswers: p.screenerAnswers ?? undefined,
    })),
    sessions: sessionsRaw.map((s) => {
      const p = s.participantId ? participantById.get(s.participantId) : undefined;
      const durationSeconds = s.endedAt
        ? Math.round((s.endedAt.getTime() - s.createdAt.getTime()) / 1000)
        : undefined;
      return {
        id: s.id,
        studyId: s.studyId,
        studyTitle: study.title,
        participantId: s.participantId ?? undefined,
        participantEmail: p?.email,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        endedAt: s.endedAt?.toISOString(),
        turnCount: 0,
        durationSeconds,
        questionIndex: s.questionIndex,
      };
    }),
  });
});

/* ── Slot management ─────────────────────────────────────── */
router.post("/studies/:studyId/slots", async (req, res) => {
  const studyId = req.params.studyId;
  const { slot } = req.body as { slot?: string };
  if (!slot || isNaN(Date.parse(slot))) {
    res.status(400).json({ error: "slot must be a valid ISO date-time string" });
    return;
  }
  const [study] = await db.select({ slots: studiesTable.slots }).from(studiesTable).where(eq(studiesTable.id, studyId));
  if (!study) { res.status(404).json({ error: "Study not found" }); return; }
  const newSlots = [...study.slots, new Date(slot).toISOString()].sort();
  await db.update(studiesTable).set({ slots: newSlots }).where(eq(studiesTable.id, studyId));
  res.json({ slots: newSlots });
});

router.delete("/studies/:studyId/slots/:slotIndex", async (req, res) => {
  const studyId = req.params.studyId;
  const slotIndex = parseInt(req.params.slotIndex, 10);
  const [study] = await db.select({ slots: studiesTable.slots }).from(studiesTable).where(eq(studiesTable.id, studyId));
  if (!study) { res.status(404).json({ error: "Study not found" }); return; }
  if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= study.slots.length) {
    res.status(400).json({ error: "Invalid slot index" });
    return;
  }
  const newSlots = study.slots.filter((_, i) => i !== slotIndex);
  await db.update(studiesTable).set({ slots: newSlots }).where(eq(studiesTable.id, studyId));
  res.json({ slots: newSlots });
});

/* ── Screener GET/PUT ─────────────────────────────────────── */
router.get("/studies/:studyId/screener", async (req, res) => {
  const [study] = await db.select({ screenerQuestions: studiesTable.screenerQuestions }).from(studiesTable).where(eq(studiesTable.id, req.params.studyId));
  if (!study) { res.status(404).json({ error: "Study not found" }); return; }
  res.json({ questions: study.screenerQuestions ?? [] });
});

router.put("/studies/:studyId/screener", async (req, res) => {
  const questions: ScreenerQuestion[] = req.body.questions ?? [];
  if (!Array.isArray(questions) || questions.length > 3) {
    res.status(400).json({ error: "questions must be an array of up to 3 items" });
    return;
  }
  const [study] = await db.select({ id: studiesTable.id }).from(studiesTable).where(eq(studiesTable.id, req.params.studyId));
  if (!study) { res.status(404).json({ error: "Study not found" }); return; }
  await db.update(studiesTable).set({ screenerQuestions: questions }).where(eq(studiesTable.id, req.params.studyId));
  res.json({ questions });
});

router.patch("/studies/:studyId", async (req, res) => {
  const studyId = req.params.studyId;
  const body = req.body as {
    title?: string;
    product?: string;
    goal?: string;
    durationMinutes?: number;
    questions?: string[];
  };
  const updates: Partial<typeof studiesTable.$inferInsert> = {};
  if (body.title     !== undefined) updates.title           = body.title;
  if (body.product   !== undefined) updates.product         = body.product;
  if (body.goal      !== undefined) updates.goal            = body.goal;
  if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
  if (body.questions !== undefined) updates.questions       = body.questions;
  const [updated] = await db
    .update(studiesTable)
    .set(updates)
    .where(eq(studiesTable.id, studyId))
    .returning();
  if (!updated) { res.status(404).json({ error: "Study not found" }); return; }
  res.json(await serializeStudy(updated));
});

router.delete("/studies/:studyId", async (req, res) => {
  const studyId = req.params.studyId;
  const [study] = await db.select({ id: studiesTable.id }).from(studiesTable).where(eq(studiesTable.id, studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }
  await db.delete(insightsTable).where(
    eq(insightsTable.sessionId, sql`any(select id from ${sessionsTable} where study_id = ${studyId})`)
  );
  await db.delete(sessionsTable).where(eq(sessionsTable.studyId, studyId));
  await db.delete(participantsTable).where(eq(participantsTable.studyId, studyId));
  await db.delete(studiesTable).where(eq(studiesTable.id, studyId));
  res.status(204).send();
});

router.get("/studies/:studyId/tagged-turns", async (req, res) => {
  const studyId = req.params.studyId;
  const tagFilter = typeof req.query.tag === "string" ? req.query.tag : undefined;

  const [study] = await db.select({ id: studiesTable.id }).from(studiesTable).where(eq(studiesTable.id, studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }

  const sessions = await db
    .select({ id: sessionsTable.id, participantId: sessionsTable.participantId })
    .from(sessionsTable)
    .where(eq(sessionsTable.studyId, studyId));

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) {
    res.json({ studyId, tag: tagFilter ?? null, turns: [] });
    return;
  }

  const tags = await db
    .select()
    .from(turnTagsTable)
    .where(
      tagFilter
        ? and(inArray(turnTagsTable.sessionId, sessionIds), eq(turnTagsTable.tag, tagFilter))
        : inArray(turnTagsTable.sessionId, sessionIds),
    );

  if (tags.length === 0) {
    res.json({ studyId, tag: tagFilter ?? null, turns: [] });
    return;
  }

  const turnIds = tags.map((t) => t.turnId);
  const turns = await db
    .select()
    .from(transcriptTurnsTable)
    .where(inArray(transcriptTurnsTable.id, turnIds));

  const participantIds = [...new Set(sessions.filter((s) => s.participantId).map((s) => s.participantId!))];
  const participants = participantIds.length > 0
    ? await db.select({ id: participantsTable.id, email: participantsTable.email }).from(participantsTable).where(inArray(participantsTable.id, participantIds))
    : [];
  const participantEmailById = new Map(participants.map((p) => [p.id, p.email]));
  const sessionParticipantMap = new Map(sessions.map((s) => [s.id, s.participantId]));

  const turnMap = new Map(turns.map((t) => [t.id, t]));

  const result = tags.flatMap((tt) => {
    const turn = turnMap.get(tt.turnId);
    if (!turn) return [];
    const participantId = sessionParticipantMap.get(tt.sessionId);
    const email = participantId ? (participantEmailById.get(participantId) ?? "Anonymous") : "Anonymous";
    return [{
      turnId: tt.turnId,
      sessionId: tt.sessionId,
      tag: tt.tag,
      text: turn.text,
      speaker: turn.speaker,
      createdAt: turn.createdAt.toISOString(),
      participantEmail: email,
    }];
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ studyId, tag: tagFilter ?? null, turns: result });
});

router.get("/studies/:studyId/insights", async (req, res) => {
  const studyId = req.params.studyId;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.studyId, studyId));
  const sessionIds = sessions.map((s) => s.id);

  if (sessionIds.length === 0) {
    res.json({
      studyId,
      sessionInsights: [],
      metrics: { completionRate: 0, avgDurationSeconds: 0, avgTalkRatio: 0, totalSessions: 0, completedSessions: 0 },
      tagSummary: [],
      topQuotes: [],
      themeFrequency: [],
    });
    return;
  }

  const allInsights = await db.select().from(insightsTable);
  const sessionInsights = allInsights
    .filter((i) => sessionIds.includes(i.sessionId))
    .map((i) => ({
      id: i.id,
      sessionId: i.sessionId,
      summary: i.summary,
      painPoints: i.painPoints,
      userGoals: i.userGoals,
      featureRequests: i.featureRequests,
      recommendations: i.recommendations,
      createdAt: i.createdAt.toISOString(),
    }));

  // Compute study-level metrics
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const completionRate = sessions.length > 0 ? completedSessions.length / sessions.length : 0;

  const durationsWithEnd = completedSessions
    .filter((s) => s.endedAt)
    .map((s) => Math.round((s.endedAt!.getTime() - s.createdAt.getTime()) / 1000));
  const avgDurationSeconds = durationsWithEnd.length > 0
    ? durationsWithEnd.reduce((a, b) => a + b, 0) / durationsWithEnd.length
    : 0;

  // Get all transcript turns for talk ratio
  const allTurns = await db
    .select({ sessionId: transcriptTurnsTable.sessionId, speaker: transcriptTurnsTable.speaker })
    .from(transcriptTurnsTable)
    .where(inArray(transcriptTurnsTable.sessionId, sessionIds));

  const talkRatioBySession: Record<string, { ai: number; participant: number }> = {};
  for (const t of allTurns) {
    if (!talkRatioBySession[t.sessionId]) talkRatioBySession[t.sessionId] = { ai: 0, participant: 0 };
    if (t.speaker === "participant") talkRatioBySession[t.sessionId].participant++;
    else talkRatioBySession[t.sessionId].ai++;
  }
  const talkRatios = Object.values(talkRatioBySession)
    .filter((r) => r.ai + r.participant > 0)
    .map((r) => r.participant / (r.ai + r.participant));
  const avgTalkRatio = talkRatios.length > 0 ? talkRatios.reduce((a, b) => a + b, 0) / talkRatios.length : 0;

  // Turn tags: tag summary and top quotes
  const allTurnTags = await db
    .select()
    .from(turnTagsTable)
    .where(inArray(turnTagsTable.sessionId, sessionIds));

  // Tag summary count
  const tagCounts: Record<string, number> = {};
  for (const tt of allTurnTags) {
    tagCounts[tt.tag] = (tagCounts[tt.tag] ?? 0) + 1;
  }
  const tagSummary = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  // Top quotes: turns tagged as "Quote"
  const quoteTags = allTurnTags.filter((tt) => tt.tag === "Quote");
  const quoteParticipants: Record<string, string> = {};
  for (const s of sessions) {
    if (s.participantId) {
      // resolve later via participantsTable
    }
  }

  let topQuotes: { turnId: string; sessionId: string; text: string; participantEmail: string }[] = [];
  if (quoteTags.length > 0) {
    const quoteTurnIds = quoteTags.map((qt) => qt.turnId);
    const quoteTurns = await db
      .select()
      .from(transcriptTurnsTable)
      .where(inArray(transcriptTurnsTable.id, quoteTurnIds));

    const participantsForSessions = await db
      .select()
      .from(participantsTable)
      .where(inArray(participantsTable.id, sessions.filter((s) => s.participantId).map((s) => s.participantId!)));
    const participantEmailById = new Map(participantsForSessions.map((p) => [p.id, p.email]));
    const sessionParticipantMap = new Map(sessions.map((s) => [s.id, s.participantId]));

    topQuotes = quoteTurns.map((qt) => {
      const participantId = sessionParticipantMap.get(qt.sessionId);
      const email = participantId ? (participantEmailById.get(participantId) ?? "Anonymous") : "Anonymous";
      return { turnId: qt.id, sessionId: qt.sessionId, text: qt.text, participantEmail: email };
    });
  }

  // Theme frequency: aggregate pain points, feature requests from insights (count unique phrases)
  const allThemes: string[] = [];
  for (const ins of sessionInsights) {
    allThemes.push(...ins.painPoints, ...ins.featureRequests);
  }
  const themeCounts: Record<string, number> = {};
  for (const theme of allThemes) {
    const key = theme.slice(0, 60); // group by first 60 chars
    themeCounts[key] = (themeCounts[key] ?? 0) + 1;
  }
  const themeFrequency = Object.entries(themeCounts)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({
    studyId,
    sessionInsights,
    metrics: {
      completionRate,
      avgDurationSeconds,
      avgTalkRatio,
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
    },
    tagSummary,
    topQuotes,
    themeFrequency,
  });
});

export default router;
