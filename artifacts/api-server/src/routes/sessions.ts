import { Router, type IRouter } from "express";
import {
  db,
  studiesTable,
  participantsTable,
  sessionsTable,
  transcriptTurnsTable,
  insightsTable,
  turnTagsTable,
} from "@workspace/db";
import { eq, desc, asc, count, inArray } from "drizzle-orm";
import { StartSessionBody, SubmitSessionTurnBody } from "@workspace/api-zod";
import {
  generateNextTurn,
  generateInsightsFromTranscript,
  buildGreeting,
} from "../lib/anthropic-moderator";

const router: IRouter = Router();

async function turnCount(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(transcriptTurnsTable)
    .where(eq(transcriptTurnsTable.sessionId, sessionId));
  return row?.value ?? 0;
}

async function getTagsForTurns(turnIds: string[]): Promise<Map<string, string[]>> {
  if (turnIds.length === 0) return new Map();
  const rows = await db
    .select({ turnId: turnTagsTable.turnId, tag: turnTagsTable.tag })
    .from(turnTagsTable)
    .where(inArray(turnTagsTable.turnId, turnIds));
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const arr = map.get(row.turnId) ?? [];
    arr.push(row.tag);
    map.set(row.turnId, arr);
  }
  return map;
}

function serializeTurn(t: typeof transcriptTurnsTable.$inferSelect, tags: string[] = []) {
  return {
    id: t.id,
    sessionId: t.sessionId,
    speaker: t.speaker as "ai" | "participant",
    text: t.text,
    createdAt: t.createdAt.toISOString(),
    tags,
  };
}

async function serializeSession(s: typeof sessionsTable.$inferSelect) {
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, s.studyId));
  let participantEmail: string | undefined;
  if (s.participantId) {
    const [p] = await db.select().from(participantsTable).where(eq(participantsTable.id, s.participantId));
    participantEmail = p?.email;
  }

  const turns = await db
    .select({ speaker: transcriptTurnsTable.speaker })
    .from(transcriptTurnsTable)
    .where(eq(transcriptTurnsTable.sessionId, s.id));
  const aiTurnCount = turns.filter((t) => t.speaker === "ai").length;
  const participantTurnCount = turns.filter((t) => t.speaker === "participant").length;
  const durationSeconds = s.endedAt
    ? Math.round((s.endedAt.getTime() - s.createdAt.getTime()) / 1000)
    : undefined;

  return {
    id: s.id,
    studyId: s.studyId,
    studyTitle: study?.title,
    participantId: s.participantId ?? undefined,
    participantEmail,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    endedAt: s.endedAt?.toISOString(),
    turnCount: turns.length,
    durationSeconds,
    questionIndex: s.questionIndex,
    aiTurnCount,
    participantTurnCount,
  };
}

router.get("/sessions", async (_req, res) => {
  const rows = await db.select().from(sessionsTable).orderBy(desc(sessionsTable.createdAt));
  const result = await Promise.all(rows.map(serializeSession));
  res.json(result);
});

router.post("/sessions/start", async (req, res) => {
  const body = StartSessionBody.parse(req.body);
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, body.studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }
  const questions = study.questions;
  if (questions.length === 0) {
    res.status(400).json({ error: "Study has no questions" });
    return;
  }

  const [session] = await db
    .insert(sessionsTable)
    .values({
      studyId: study.id,
      participantId: body.participantId ?? null,
      status: "active",
      questionIndex: 0,
      followUpsAsked: 0,
    })
    .returning();
  if (!session) {
    res.status(500).json({ error: "Failed to start session" });
    return;
  }

  const greeting = buildGreeting(study.product);
  const firstQuestion = questions[0]!;

  await db.insert(transcriptTurnsTable).values([
    { sessionId: session.id, speaker: "ai", text: greeting },
    { sessionId: session.id, speaker: "ai", text: firstQuestion },
  ]);

  res.status(201).json({
    session: await serializeSession(session),
    greeting,
    firstQuestion,
  });
});

router.get("/sessions/:sessionId", async (req, res) => {
  const sessionId = req.params.sessionId;
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, session.studyId));
  const turns = await db
    .select()
    .from(transcriptTurnsTable)
    .where(eq(transcriptTurnsTable.sessionId, sessionId))
    .orderBy(asc(transcriptTurnsTable.createdAt));
  const [insightRow] = await db
    .select()
    .from(insightsTable)
    .where(eq(insightsTable.sessionId, sessionId));

  const turnIds = turns.map((t) => t.id);
  const tagsMap = await getTagsForTurns(turnIds);

  res.json({
    session: await serializeSession(session),
    transcript: turns.map((t) => serializeTurn(t, tagsMap.get(t.id) ?? [])),
    study: study
      ? {
          id: study.id,
          title: study.title,
          product: study.product,
          goal: study.goal,
          durationMinutes: study.durationMinutes,
          questions: study.questions,
          slots: study.slots,
          status: study.status,
          createdAt: study.createdAt.toISOString(),
          participantCount: 0,
          completedSessionCount: 0,
          videoStatus: study.videoStatus ?? "none",
          questionVideos: study.questionVideos ?? null,
          screenerQuestions: study.screenerQuestions ?? [],
        }
      : undefined,
    insights: insightRow
      ? {
          id: insightRow.id,
          sessionId: insightRow.sessionId,
          summary: insightRow.summary,
          painPoints: insightRow.painPoints,
          userGoals: insightRow.userGoals,
          featureRequests: insightRow.featureRequests,
          recommendations: insightRow.recommendations,
          createdAt: insightRow.createdAt.toISOString(),
        }
      : undefined,
  });
});

router.post("/sessions/:sessionId/turn", async (req, res) => {
  const sessionId = req.params.sessionId;
  const body = SubmitSessionTurnBody.parse(req.body);
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.status !== "active") {
    res.status(400).json({ error: "Session is not active" });
    return;
  }
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, session.studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }

  await db.insert(transcriptTurnsTable).values({
    sessionId,
    speaker: "participant",
    text: body.participantText,
  });

  const history = await db
    .select()
    .from(transcriptTurnsTable)
    .where(eq(transcriptTurnsTable.sessionId, sessionId))
    .orderBy(asc(transcriptTurnsTable.createdAt));

  const decision = await generateNextTurn({
    product: study.product,
    goal: study.goal,
    questions: study.questions,
    questionIndex: session.questionIndex,
    followUpsAsked: session.followUpsAsked,
    history: history.map((h) => ({ speaker: h.speaker as "ai" | "participant", text: h.text })),
    participantText: body.participantText,
    preferredLanguage: body.preferredLanguage,
  });

  await db.insert(transcriptTurnsTable).values({
    sessionId,
    speaker: "ai",
    text: decision.aiQuestion,
  });

  if (decision.action === "follow_up") {
    await db
      .update(sessionsTable)
      .set({ followUpsAsked: session.followUpsAsked + 1 })
      .where(eq(sessionsTable.id, sessionId));
  } else if (decision.action === "next_question") {
    await db
      .update(sessionsTable)
      .set({ questionIndex: session.questionIndex + 1, followUpsAsked: 0 })
      .where(eq(sessionsTable.id, sessionId));
  } else if (decision.action === "wrap_up") {
    await db
      .update(sessionsTable)
      .set({ status: "completed", endedAt: new Date() })
      .where(eq(sessionsTable.id, sessionId));
    if (session.participantId) {
      await db
        .update(participantsTable)
        .set({ status: "completed" })
        .where(eq(participantsTable.id, session.participantId));
    }
  }

  const finalTurns = await db
    .select()
    .from(transcriptTurnsTable)
    .where(eq(transcriptTurnsTable.sessionId, sessionId))
    .orderBy(asc(transcriptTurnsTable.createdAt));

  const tagsMap = await getTagsForTurns(finalTurns.map((t) => t.id));

  res.json({
    aiQuestion: decision.aiQuestion,
    isFinal: decision.isFinal,
    transcript: finalTurns.map((t) => serializeTurn(t, tagsMap.get(t.id) ?? [])),
  });
});

router.post("/sessions/:sessionId/end", async (req, res) => {
  const sessionId = req.params.sessionId;
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [updated] = await db
    .update(sessionsTable)
    .set({ status: "completed", endedAt: new Date() })
    .where(eq(sessionsTable.id, sessionId))
    .returning();
  if (session.participantId) {
    await db
      .update(participantsTable)
      .set({ status: "completed" })
      .where(eq(participantsTable.id, session.participantId));
  }
  res.json(await serializeSession(updated!));
});

router.post("/sessions/:sessionId/insights/generate", async (req, res) => {
  const sessionId = req.params.sessionId;
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, session.studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }
  const turns = await db
    .select()
    .from(transcriptTurnsTable)
    .where(eq(transcriptTurnsTable.sessionId, sessionId))
    .orderBy(asc(transcriptTurnsTable.createdAt));

  const result = await generateInsightsFromTranscript(
    study.product,
    study.goal,
    turns.map((t) => ({ speaker: t.speaker as "ai" | "participant", text: t.text })),
  );

  const [existing] = await db
    .select()
    .from(insightsTable)
    .where(eq(insightsTable.sessionId, sessionId));

  let row;
  if (existing) {
    [row] = await db
      .update(insightsTable)
      .set({
        summary: result.summary,
        painPoints: result.painPoints,
        userGoals: result.userGoals,
        featureRequests: result.featureRequests,
        recommendations: result.recommendations,
      })
      .where(eq(insightsTable.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(insightsTable)
      .values({
        sessionId,
        summary: result.summary,
        painPoints: result.painPoints,
        userGoals: result.userGoals,
        featureRequests: result.featureRequests,
        recommendations: result.recommendations,
      })
      .returning();
  }

  res.json({
    id: row!.id,
    sessionId: row!.sessionId,
    summary: row!.summary,
    painPoints: row!.painPoints,
    userGoals: row!.userGoals,
    featureRequests: row!.featureRequests,
    recommendations: row!.recommendations,
    createdAt: row!.createdAt.toISOString(),
  });
});

/* ── Turn tag endpoints ─────────────────────────────────── */
const VALID_TAGS = new Set(["Insight", "Pain Point", "Quote", "Recommendation", "Positive"]);

router.post("/sessions/:sessionId/turns/:turnId/tags", async (req, res) => {
  const { sessionId, turnId } = req.params;
  const { tag } = req.body as { tag: string };
  if (!tag || !VALID_TAGS.has(tag)) {
    res.status(400).json({ error: "Invalid tag. Must be one of: " + [...VALID_TAGS].join(", ") });
    return;
  }

  const [turn] = await db.select({ id: transcriptTurnsTable.id }).from(transcriptTurnsTable)
    .where(eq(transcriptTurnsTable.id, turnId));
  if (!turn) { res.status(404).json({ error: "Turn not found" }); return; }

  // Upsert: only add if not already there
  const existing = await db.select().from(turnTagsTable)
    .where(eq(turnTagsTable.turnId, turnId));
  const alreadyTagged = existing.some((t) => t.tag === tag);
  if (!alreadyTagged) {
    await db.insert(turnTagsTable).values({ sessionId, turnId, tag });
  }

  const updatedTags = await db.select({ tag: turnTagsTable.tag }).from(turnTagsTable)
    .where(eq(turnTagsTable.turnId, turnId));
  res.json({ turnId, tags: updatedTags.map((t) => t.tag) });
});

router.delete("/sessions/:sessionId/turns/:turnId/tags/:tag", async (req, res) => {
  const { turnId, tag } = req.params;
  const allTags = await db.select().from(turnTagsTable).where(eq(turnTagsTable.turnId, turnId));
  const toDelete = allTags.filter((t) => t.tag === tag);
  for (const td of toDelete) {
    await db.delete(turnTagsTable).where(eq(turnTagsTable.id, td.id));
  }
  const updatedTags = await db.select({ tag: turnTagsTable.tag }).from(turnTagsTable)
    .where(eq(turnTagsTable.turnId, turnId));
  res.json({ turnId, tags: updatedTags.map((t) => t.tag) });
});

export default router;
