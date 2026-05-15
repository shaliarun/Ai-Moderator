import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export interface ScreenerQuestion {
  id: string;
  text: string;
  type: "yes_no" | "multiple_choice";
  options?: string[];
  disqualifyIf: string;
}

export const studiesTable = pgTable("studies", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  title: text("title").notNull(),
  product: text("product").notNull(),
  goal: text("goal").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  questions: jsonb("questions").$type<string[]>().notNull(),
  slots: jsonb("slots").$type<string[]>().notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  videoStatus: text("video_status").default("none"),
  questionVideos: jsonb("question_videos").$type<{
    greetingText: string;
    greeting: string;
    questions: string[];
  }>(),
  screenerQuestions: jsonb("screener_questions").$type<ScreenerQuestion[]>(),
});

export type Study = typeof studiesTable.$inferSelect;
export type InsertStudy = typeof studiesTable.$inferInsert;
