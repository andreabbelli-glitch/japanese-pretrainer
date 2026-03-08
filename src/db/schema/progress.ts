import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { lesson, media } from "./content.ts";
import { lessonProgressStatusValues } from "./enums.ts";

export const lessonProgress = sqliteTable("lesson_progress", {
  lessonId: text("lesson_id")
    .primaryKey()
    .references(() => lesson.id, { onDelete: "cascade" }),
  status: text("status", { enum: lessonProgressStatusValues }).notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  lastOpenedAt: text("last_opened_at")
});

export const mediaProgress = sqliteTable("media_progress", {
  mediaId: text("media_id")
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  lessonsCompleted: integer("lessons_completed").notNull().default(0),
  lessonsTotal: integer("lessons_total").notNull().default(0),
  entriesKnown: integer("entries_known").notNull().default(0),
  entriesTotal: integer("entries_total").notNull().default(0),
  cardsDue: integer("cards_due").notNull().default(0),
  updatedAt: text("updated_at").notNull()
});

export const userSetting = sqliteTable("user_setting", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull()
});
