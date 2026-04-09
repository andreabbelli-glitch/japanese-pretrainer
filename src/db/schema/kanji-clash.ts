import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  kanjiClashPairModeValues,
  kanjiClashPairResultValues,
  kanjiClashPairStateValues,
  kanjiClashSchedulerVersionValues
} from "./enums.ts";

export const kanjiClashPairState = sqliteTable(
  "kanji_clash_pair_state",
  {
    pairKey: text("pair_key").primaryKey(),
    leftSubjectKey: text("left_subject_key").notNull(),
    rightSubjectKey: text("right_subject_key").notNull(),
    state: text("state", { enum: kanjiClashPairStateValues }).notNull(),
    stability: real("stability"),
    difficulty: real("difficulty"),
    dueAt: text("due_at"),
    lastReviewedAt: text("last_reviewed_at"),
    lastInteractionAt: text("last_interaction_at").notNull(),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    schedulerVersion: text("scheduler_version", {
      enum: kanjiClashSchedulerVersionValues
    })
      .notNull()
      .default("kanji_clash_fsrs_v1"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("kanji_clash_pair_state_due_idx").on(table.dueAt),
    index("kanji_clash_pair_state_interaction_idx").on(table.lastInteractionAt),
    index("kanji_clash_pair_state_state_idx").on(table.state)
  ]
);

export const kanjiClashPairLog = sqliteTable(
  "kanji_clash_pair_log",
  {
    id: text("id").primaryKey(),
    pairKey: text("pair_key")
      .notNull()
      .references(() => kanjiClashPairState.pairKey, { onDelete: "cascade" }),
    mode: text("mode", { enum: kanjiClashPairModeValues }).notNull(),
    answeredAt: text("answered_at").notNull(),
    targetSubjectKey: text("target_subject_key").notNull(),
    correctSubjectKey: text("correct_subject_key").notNull(),
    chosenSubjectKey: text("chosen_subject_key").notNull(),
    leftSubjectKey: text("left_subject_key").notNull(),
    rightSubjectKey: text("right_subject_key").notNull(),
    result: text("result", { enum: kanjiClashPairResultValues }).notNull(),
    previousState: text("previous_state", { enum: kanjiClashPairStateValues }),
    newState: text("new_state", { enum: kanjiClashPairStateValues }),
    scheduledDueAt: text("scheduled_due_at"),
    elapsedDays: real("elapsed_days"),
    responseMs: integer("response_ms"),
    schedulerVersion: text("scheduler_version", {
      enum: kanjiClashSchedulerVersionValues
    })
      .notNull()
      .default("kanji_clash_fsrs_v1")
  },
  (table) => [
    index("kanji_clash_pair_log_pair_answered_idx").on(
      table.pairKey,
      table.answeredAt
    ),
    index("kanji_clash_pair_log_mode_previous_answered_pair_idx").on(
      table.mode,
      table.previousState,
      table.answeredAt,
      table.pairKey
    ),
    index("kanji_clash_pair_log_target_answered_idx").on(
      table.targetSubjectKey,
      table.answeredAt
    )
  ]
);
