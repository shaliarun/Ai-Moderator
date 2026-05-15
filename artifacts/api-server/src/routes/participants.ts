import { Router, type IRouter } from "express";
import { db, studiesTable, participantsTable, sessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { AddParticipantsBody, RespondToInviteBody } from "@workspace/api-zod";
import type { ScreenerQuestion } from "@workspace/db";

/* ── Email transport ──────────────────────────────────────── */
async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (process.env.REPL_ID) {
    // On Replit: use the managed Google-Mail connector
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    const connectors = new ReplitConnectors();
    const lines = [
      `To: ${opts.to}`,
      "Content-Type: text/html; charset=utf-8",
      "MIME-Version: 1.0",
      `Subject: ${opts.subject}`,
      "",
      opts.html,
    ];
    const raw = Buffer.from(lines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const resp = await connectors.proxy("google-mail", "/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Gmail API ${resp.status}: ${txt.slice(0, 200)}`);
    }
    return;
  }

  // Local: use SMTP via nodemailer
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    throw new Error(
      "Email not configured. Set SMTP_USER and SMTP_PASS in .env (e.g. Gmail address + App Password).",
    );
  }
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: smtpUser, pass: smtpPass },
  });
  await transporter.sendMail({
    from: smtpUser,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}


function inviteHtml(opts: {
  studyTitle: string;
  product: string;
  goal: string;
  durationMinutes: number;
  inviteUrl: string;
}) {
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#FAF8F4;padding:24px;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:32px;">
    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#78716c;">Insightly · Research invitation</div>
    <h1 style="margin:8px 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.01em;">${opts.studyTitle}</h1>
    <p style="margin:0 0 12px;line-height:1.6;color:#44403c;">You're invited to take part in a short ${opts.durationMinutes}-minute conversation about <strong>${opts.product}</strong>.</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#44403c;">${opts.goal}</p>
    <p style="margin:0 0 20px;line-height:1.6;color:#44403c;">An AI research moderator will guide the chat. There are no right or wrong answers — we just want to hear about your experience.</p>
    <a href="${opts.inviteUrl}" style="display:inline-block;background:#1c1917;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:500;">Accept and choose a time</a>
    <p style="margin:24px 0 0;font-size:12px;color:#a8a29e;">If the button doesn't work, paste this link into your browser:<br/><span style="color:#57534e;word-break:break-all;">${opts.inviteUrl}</span></p>
  </div>
  <p style="text-align:center;font-size:11px;color:#a8a29e;margin-top:16px;">Sent via Insightly</p>
</body></html>`;
}

const router: IRouter = Router();

function getFrontendOrigin(req: Parameters<Parameters<IRouter["post"]>[1]>[0]): string {
  const configured =
    process.env.FRONTEND_URL ??
    process.env.PUBLIC_APP_URL ??
    process.env.ALLOWED_ORIGINS?.split(",")[0];

  return (configured ?? `${req.protocol}://${req.get("host")}`).trim().replace(/\/+$/, "");
}

function serializeParticipant(p: typeof participantsTable.$inferSelect) {
  return {
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
  };
}

router.get("/studies/:studyId/participants", async (req, res) => {
  const rows = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.studyId, req.params.studyId))
    .orderBy(desc(participantsTable.createdAt));
  res.json(rows.map(serializeParticipant));
});

router.post("/studies/:studyId/participants", async (req, res) => {
  const studyId = req.params.studyId;
  const body = AddParticipantsBody.parse(req.body);
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }
  const inserted = await db
    .insert(participantsTable)
    .values(body.emails.map((email) => ({ studyId, email, status: "pending" as const })))
    .returning();
  res.status(201).json(inserted.map(serializeParticipant));
});

router.post("/studies/:studyId/send-invites", async (req, res) => {
  const studyId = req.params.studyId;
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }
  const pending = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.studyId, studyId));
  const toSend = pending.filter((p) => p.status === "pending");

  const host = getFrontendOrigin(req);
  const subject = `You're invited: ${study.title}`;

  const invites: { email: string; inviteUrl: string; delivered: boolean; error?: string }[] = [];

  for (const p of toSend) {
    const inviteUrl = `${host}/invite/${p.inviteToken}`;
    const html = inviteHtml({
      studyTitle: study.title,
      product: study.product,
      goal: study.goal,
      durationMinutes: study.durationMinutes,
      inviteUrl,
    });
    let delivered = false;
    let errorMsg: string | undefined;
    try {
      await sendEmail({ to: p.email, subject, html });
      delivered = true;
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    if (delivered) {
      await db
        .update(participantsTable)
        .set({ status: "invited" })
        .where(eq(participantsTable.id, p.id));
    }
    invites.push({ email: p.email, inviteUrl, delivered, ...(errorMsg ? { error: errorMsg } : {}) });
  }

  const sent = invites.filter((i) => i.delivered).length;
  req.log.info({ studyId, sent, attempted: invites.length }, "Invites processed via Gmail");
  res.json({ sent, invites });
});

router.get("/invites/:token", async (req, res) => {
  const [p] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.inviteToken, req.params.token));
  if (!p) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, p.studyId));
  if (!study) {
    res.status(404).json({ error: "Study not found" });
    return;
  }
  res.json({
    participant: serializeParticipant(p),
    study: {
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
      screenerQuestions: study.screenerQuestions ?? [],
    },
  });
});

router.post("/invites/:token", async (req, res) => {
  const body = RespondToInviteBody.parse(req.body);
  const [p] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.inviteToken, req.params.token));
  if (!p) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  const updates: Partial<typeof participantsTable.$inferInsert> = {
    respondedAt: new Date(),
    name: body.name ?? p.name ?? null,
  };
  if (body.action === "accept") {
    updates.status = "accepted";
    if (body.chosenSlot) updates.chosenSlot = new Date(body.chosenSlot);
  } else if (body.action === "decline") {
    updates.status = "declined";
  } else if (body.action === "reschedule") {
    updates.status = "rescheduled";
    if (body.suggestedSlot) updates.suggestedSlot = new Date(body.suggestedSlot);
  }

  const [updated] = await db
    .update(participantsTable)
    .set(updates)
    .where(eq(participantsTable.id, p.id))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Update failed" });
    return;
  }
  res.json(serializeParticipant(updated));
});

/* ── Screener check ─────────────────────────────────────── */
router.post("/invites/:token/screener-check", async (req, res) => {
  const [p] = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.inviteToken, req.params.token));
  if (!p) { res.status(404).json({ error: "Invite not found" }); return; }

  const [study] = await db.select().from(studiesTable).where(eq(studiesTable.id, p.studyId));
  if (!study) { res.status(404).json({ error: "Study not found" }); return; }

  const screenerQuestions = (study.screenerQuestions ?? []) as ScreenerQuestion[];
  if (screenerQuestions.length === 0) {
    res.json({ qualified: true });
    return;
  }

  const answers: { questionId: string; answer: string }[] = req.body.answers ?? [];

  // Evaluate each answer: disqualify if any answer matches the disqualifyIf value
  let qualified = true;
  for (const q of screenerQuestions) {
    const answer = answers.find((a) => a.questionId === q.id);
    if (answer && answer.answer === q.disqualifyIf) {
      qualified = false;
      break;
    }
  }

  // Persist the screener result and answers on the participant record
  await db
    .update(participantsTable)
    .set({ screenerPassed: qualified, screenerAnswers: answers })
    .where(eq(participantsTable.id, p.id));

  res.json({ qualified });
});

export default router;
