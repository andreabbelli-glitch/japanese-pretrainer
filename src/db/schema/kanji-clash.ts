import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  kanjiClashManualContrastDirectionValues,
  kanjiClashManualContrastSourceValues,
  kanjiClashManualContrastStatusValues,
  kanjiClashManualContrastSchedulerVersionValues,
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

export const kanjiClashManualContrast = sqliteTable(
  "kanji_clash_manual_contrast",
  {
    contrastKey: text("contrast_key").primaryKey(),
    subjectAKey: text("subject_a_key").notNull(),
    subjectBKey: text("subject_b_key").notNull(),
    status: text("status", { enum: kanjiClashManualContrastStatusValues })
      .notNull()
      .default("active"),
    source: text("source", { enum: kanjiClashManualContrastSourceValues })
      .notNull()
      .default("manual"),
    timesConfirmed: integer("times_confirmed").notNull().default(0),
    lastConfirmedAt: text("last_confirmed_at"),
    lastForcedAt: text("last_forced_at"),
    forcedDueAt: text("forced_due_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    uniqueIndex("kanji_clash_manual_contrast_subject_unique").on(
      table.subjectAKey,
      table.subjectBKey
    ),
    index("kanji_clash_manual_contrast_status_idx").on(table.status),
    index("kanji_clash_manual_contrast_source_idx").on(table.source),
    index("kanji_clash_manual_contrast_forced_due_idx").on(table.forcedDueAt),
    index("kanji_clash_manual_contrast_updated_idx").on(table.updatedAt)
  ]
);

export const kanjiClashManualContrastRoundState = sqliteTable(
  "kanji_clash_manual_contrast_round_state",
  {
    roundKey: text("round_key").primaryKey(),
    contrastKey: text("contrast_key")
      .notNull()
      .references(() => kanjiClashManualContrast.contrastKey, {
        onDelete: "cascade"
      }),
    direction: text("direction", {
      enum: kanjiClashManualContrastDirectionValues
    }).notNull(),
    targetSubjectKey: text("target_subject_key").notNull(),
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
      enum: kanjiClashManualContrastSchedulerVersionValues
    })
      .notNull()
      .default("kanji_clash_manual_contrast_fsrs_v1"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    uniqueIndex("kanji_clash_manual_contrast_round_state_unique").on(
      table.contrastKey,
      table.direction
    ),
    index("kanji_clash_manual_contrast_round_state_due_idx").on(table.dueAt),
    index("kanji_clash_manual_contrast_round_state_interaction_idx").on(
      table.lastInteractionAt
    ),
    index("kanji_clash_manual_contrast_round_state_state_idx").on(table.state)
  ]
);

export const kanjiClashManualContrastRoundLog = sqliteTable(
  "kanji_clash_manual_contrast_round_log",
  {
    id: text("id").primaryKey(),
    roundKey: text("round_key")
      .notNull()
      .references(() => kanjiClashManualContrastRoundState.roundKey, {
        onDelete: "cascade"
      }),
    contrastKey: text("contrast_key")
      .notNull()
      .references(() => kanjiClashManualContrast.contrastKey, {
        onDelete: "cascade"
      }),
    direction: text("direction", {
      enum: kanjiClashManualContrastDirectionValues
    }).notNull(),
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
      enum: kanjiClashManualContrastSchedulerVersionValues
    })
      .notNull()
      .default("kanji_clash_manual_contrast_fsrs_v1")
  },
  (table) => [
    index("kanji_clash_manual_contrast_round_log_round_answered_idx").on(
      table.roundKey,
      table.answeredAt
    ),
    index(
      "kanji_clash_manual_contrast_round_log_contrast_direction_answered_idx"
    ).on(table.contrastKey, table.direction, table.answeredAt),
    index("kanji_clash_manual_contrast_round_log_target_answered_idx").on(
      table.targetSubjectKey,
      table.answeredAt
    )
  ]
);
