import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { lesson } from "./content.ts";
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

export const userSetting = sqliteTable("user_setting", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull()
});
