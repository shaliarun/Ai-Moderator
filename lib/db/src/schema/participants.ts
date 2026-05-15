import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { studiesTable } from "./studies";

export const participantsTable = pgTable("participants", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  studyId: text("study_id").notNull().references(() => studiesTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  status: text("status").notNull().default("pending"),
  inviteToken: text("invite_token").notNull().unique().$defaultFn(() => nanoid(24)),
  chosenSlot: timestamp("chosen_slot", { withTimezone: true }),
  suggestedSlot: timestamp("suggested_slot", { withTimezone: true }),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  screenerPassed: boolean("screener_passed"),
  screenerAnswers: jsonb("screener_answers").$type<{ questionId: string; answer: string }[]>(),
});

export type Participant = typeof participantsTable.$inferSelect;
export type InsertParticipant = typeof participantsTable.$inferInsert;
