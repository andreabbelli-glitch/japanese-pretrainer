import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

import {
  pitchAccentSessionStatusValues,
  pitchAccentTrialStatusValues
} from "./enums.ts";

export const pitchAccentSession = sqliteTable(
  "pitch_accent_session",
  {
    id: text("id").primaryKey(),
    status: text("status", {
      enum: pitchAccentSessionStatusValues
    }).notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    durationMs: integer("duration_ms"),
    totalTrials: integer("total_trials").notNull().default(0),
    totalAttempts: integer("total_attempts").notNull().default(0),
    correctAttempts: integer("correct_attempts").notNull().default(0),
    filtersJson: text("filters_json").notNull().default("{}"),
    patternStatsJson: text("pattern_stats_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("pitch_accent_session_status_started_idx").on(
      table.status,
      table.startedAt
    )
  ]
);

export const pitchAccentTrial = sqliteTable(
  "pitch_accent_trial",
  {
    trialId: text("trial_id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => pitchAccentSession.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    pairId: text("pair_id").notNull(),
    kana: text("kana").notNull(),
    correctOptionId: text("correct_option_id").notNull(),
    correctPatternKey: text("correct_pattern_key").notNull(),
    optionsJson: text("options_json").notNull(),
    status: text("status", {
      enum: pitchAccentTrialStatusValues
    })
      .notNull()
      .default("planned"),
    answeredAt: text("answered_at"),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    index("pitch_accent_trial_session_sort_idx").on(
      table.sessionId,
      table.sortOrder
    ),
    index("pitch_accent_trial_pair_idx").on(table.pairId)
  ]
);

export const pitchAccentAttemptLog = sqliteTable(
  "pitch_accent_attempt_log",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => pitchAccentSession.id, { onDelete: "cascade" }),
    trialId: text("trial_id")
      .notNull()
      .references(() => pitchAccentTrial.trialId, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    pairId: text("pair_id").notNull(),
    kana: text("kana").notNull(),
    chosenOptionId: text("chosen_option_id").notNull(),
    correctOptionId: text("correct_option_id").notNull(),
    isCorrect: integer("is_correct").notNull(),
    patternKey: text("pattern_key").notNull(),
    responseMs: integer("response_ms").notNull(),
    inputMethod: text("input_method"),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    uniqueIndex("pitch_accent_attempt_log_trial_unique").on(table.trialId),
    index("pitch_accent_attempt_log_session_created_idx").on(
      table.sessionId,
      table.createdAt
    ),
    index("pitch_accent_attempt_log_pair_created_idx").on(
      table.pairId,
      table.createdAt
    )
  ]
);
