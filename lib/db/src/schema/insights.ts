import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { sessionsTable } from "./sessions";

export const insightsTable = pgTable("insights", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  sessionId: text("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }).unique(),
  summary: text("summary").notNull(),
  painPoints: jsonb("pain_points").$type<string[]>().notNull(),
  userGoals: jsonb("user_goals").$type<string[]>().notNull(),
  featureRequests: jsonb("feature_requests").$type<string[]>().notNull(),
  recommendations: jsonb("recommendations").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsightRow = typeof insightsTable.$inferSelect;
export type InsertInsight = typeof insightsTable.$inferInsert;
