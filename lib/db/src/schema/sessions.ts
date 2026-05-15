import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { studiesTable } from "./studies";
import { participantsTable } from "./participants";

export interface ScreenerAnswer {
  questionId: string;
  answer: string;
}

export type TurnTagType = "Insight" | "Pain Point" | "Quote" | "Recommendation" | "Positive";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  studyId: text("study_id").notNull().references(() => studiesTable.id, { onDelete: "cascade" }),
  participantId: text("participant_id").references(() => participantsTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  questionIndex: integer("question_index").notNull().default(0),
  followUpsAsked: integer("follow_ups_asked").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  screenerAnswers: jsonb("screener_answers").$type<ScreenerAnswer[]>(),
});

export const transcriptTurnsTable = pgTable("transcript_turns", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  speaker: text("speaker").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const turnTagsTable = pgTable("turn_tags", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  turnId: text("turn_id").notNull().references(() => transcriptTurnsTable.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InterviewSessionRow = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;
export type TranscriptTurnRow = typeof transcriptTurnsTable.$inferSelect;
export type InsertTranscriptTurn = typeof transcriptTurnsTable.$inferInsert;
export type TurnTagRow = typeof turnTagsTable.$inferSelect;
