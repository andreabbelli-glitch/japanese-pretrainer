import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

import {
  katakanaItemStatusValues,
  katakanaSessionStatusValues,
  katakanaTrialModeValues,
  katakanaTrialStatusValues
} from "./enums.ts";

export const katakanaItemState = sqliteTable(
  "katakana_item_state",
  {
    itemId: text("item_id").primaryKey(),
    status: text("status", { enum: katakanaItemStatusValues }).notNull(),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    correctStreak: integer("correct_streak").notNull().default(0),
    slowStreak: integer("slow_streak").notNull().default(0),
    lastAttemptAt: text("last_attempt_at"),
    lastCorrectAt: text("last_correct_at"),
    lastResponseMs: integer("last_response_ms"),
    lastErrorTagsJson: text("last_error_tags_json").notNull().default("[]"),
    seenCount: integer("seen_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    slowCorrectCount: integer("slow_correct_count").notNull().default(0),
    bestRtMs: integer("best_rt_ms"),
    recentResponseMsJson: text("recent_response_ms_json")
      .notNull()
      .default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("katakana_item_state_status_idx").on(table.status),
    index("katakana_item_state_updated_idx").on(table.updatedAt)
  ]
);

export const katakanaSession = sqliteTable(
  "katakana_session",
  {
    id: text("id").primaryKey(),
    status: text("status", { enum: katakanaSessionStatusValues }).notNull(),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    durationMs: integer("duration_ms"),
    totalAttempts: integer("total_attempts").notNull().default(0),
    correctAttempts: integer("correct_attempts").notNull().default(0),
    slowCorrectCount: integer("slow_correct_count").notNull().default(0),
    medianRtMs: integer("median_rt_ms"),
    p90RtMs: integer("p90_rt_ms"),
    mainErrorTagsJson: text("main_error_tags_json").notNull().default("[]"),
    mainConfusionsJson: text("main_confusions_json").notNull().default("[]"),
    recommendedFocusJson: text("recommended_focus_json")
      .notNull()
      .default("[]"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("katakana_session_status_started_idx").on(
      table.status,
      table.startedAt
    )
  ]
);

export const katakanaExerciseBlock = sqliteTable(
  "katakana_exercise_block",
  {
    blockId: text("block_id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => katakanaSession.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    mode: text("mode", { enum: katakanaTrialModeValues }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    title: text("title"),
    itemType: text("item_type"),
    focusChunksJson: text("focus_chunks_json").notNull().default("[]"),
    metricsJson: text("metrics_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("katakana_exercise_block_session_sort_idx").on(
      table.sessionId,
      table.sortOrder
    ),
    index("katakana_exercise_block_exercise_sort_idx").on(
      table.exerciseId,
      table.sortOrder
    )
  ]
);

export const katakanaTrial = sqliteTable(
  "katakana_trial",
  {
    trialId: text("trial_id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => katakanaSession.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id"),
    blockId: text("block_id").references(() => katakanaExerciseBlock.blockId, {
      onDelete: "set null"
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    itemId: text("item_id").notNull(),
    mode: text("mode", { enum: katakanaTrialModeValues }).notNull(),
    promptSurface: text("prompt_surface").notNull(),
    expectedSurface: text("expected_surface"),
    itemType: text("item_type"),
    featuresJson: text("features_json").notNull().default("[]"),
    focusChunksJson: text("focus_chunks_json").notNull().default("[]"),
    selfRating: text("self_rating"),
    wasPseudo: integer("was_pseudo").notNull().default(0),
    wasTransfer: integer("was_transfer").notNull().default(0),
    wasRepair: integer("was_repair").notNull().default(0),
    metricsJson: text("metrics_json").notNull().default("{}"),
    optionItemIdsJson: text("option_item_ids_json").notNull(),
    correctItemId: text("correct_item_id").notNull(),
    targetRtMs: integer("target_rt_ms").notNull(),
    exposureMs: integer("exposure_ms"),
    shownAt: text("shown_at"),
    answeredAt: text("answered_at"),
    status: text("status", { enum: katakanaTrialStatusValues }).notNull()
  },
  (table) => [
    index("katakana_trial_session_status_idx").on(
      table.sessionId,
      table.status
    ),
    index("katakana_trial_session_sort_idx").on(
      table.sessionId,
      table.sortOrder
    ),
    index("katakana_trial_block_sort_idx").on(table.blockId, table.sortOrder)
  ]
);

export const katakanaAttemptLog = sqliteTable(
  "katakana_attempt_log",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => katakanaSession.id, { onDelete: "cascade" }),
    trialId: text("trial_id")
      .notNull()
      .references(() => katakanaTrial.trialId, { onDelete: "cascade" }),
    exerciseId: text("exercise_id"),
    blockId: text("block_id").references(() => katakanaExerciseBlock.blockId, {
      onDelete: "set null"
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    itemId: text("item_id").notNull(),
    mode: text("mode", { enum: katakanaTrialModeValues }).notNull(),
    promptSurface: text("prompt_surface").notNull(),
    expectedSurface: text("expected_surface"),
    itemType: text("item_type"),
    featuresJson: text("features_json").notNull().default("[]"),
    focusChunksJson: text("focus_chunks_json").notNull().default("[]"),
    selfRating: text("self_rating"),
    wasPseudo: integer("was_pseudo").notNull().default(0),
    wasTransfer: integer("was_transfer").notNull().default(0),
    wasRepair: integer("was_repair").notNull().default(0),
    metricsJson: text("metrics_json").notNull().default("{}"),
    expectedAnswer: text("expected_answer").notNull(),
    userAnswer: text("user_answer").notNull(),
    isCorrect: integer("is_correct").notNull(),
    responseMs: integer("response_ms").notNull(),
    exposureMs: integer("exposure_ms"),
    errorTagsJson: text("error_tags_json").notNull().default("[]"),
    confusedWithItemId: text("confused_with_item_id"),
    inputMethod: text("input_method"),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    uniqueIndex("katakana_attempt_log_trial_unique").on(table.trialId),
    index("katakana_attempt_log_session_created_idx").on(
      table.sessionId,
      table.createdAt
    ),
    index("katakana_attempt_log_item_created_idx").on(
      table.itemId,
      table.createdAt
    ),
    index("katakana_attempt_log_session_sort_idx").on(
      table.sessionId,
      table.sortOrder
    ),
    index("katakana_attempt_log_block_sort_idx").on(
      table.blockId,
      table.sortOrder
    )
  ]
);

export const katakanaExerciseResult = sqliteTable(
  "katakana_exercise_result",
  {
    resultId: text("result_id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => katakanaSession.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    blockId: text("block_id").references(() => katakanaExerciseBlock.blockId, {
      onDelete: "set null"
    }),
    trialId: text("trial_id").references(() => katakanaTrial.trialId, {
      onDelete: "set null"
    }),
    sortOrder: integer("sort_order").notNull(),
    isCorrect: integer("is_correct"),
    selfRating: text("self_rating"),
    metricsJson: text("metrics_json").notNull().default("{}"),
    createdAt: text("created_at").notNull()
  },
  (table) => [
    index("katakana_exercise_result_session_sort_idx").on(
      table.sessionId,
      table.sortOrder
    ),
    index("katakana_exercise_result_exercise_sort_idx").on(
      table.exerciseId,
      table.sortOrder
    ),
    index("katakana_exercise_result_block_sort_idx").on(
      table.blockId,
      table.sortOrder
    )
  ]
);

export const katakanaConfusionEdge = sqliteTable(
  "katakana_confusion_edge",
  {
    edgeId: text("edge_id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => katakanaSession.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id"),
    blockId: text("block_id").references(() => katakanaExerciseBlock.blockId, {
      onDelete: "set null"
    }),
    expectedItemId: text("expected_item_id").notNull(),
    observedItemId: text("observed_item_id").notNull(),
    confusionCount: integer("confusion_count").notNull().default(1),
    sortOrder: integer("sort_order").notNull(),
    metricsJson: text("metrics_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("katakana_confusion_edge_session_sort_idx").on(
      table.sessionId,
      table.sortOrder
    ),
    index("katakana_confusion_edge_exercise_sort_idx").on(
      table.exerciseId,
      table.sortOrder
    ),
    index("katakana_confusion_edge_pair_idx").on(
      table.expectedItemId,
      table.observedItemId
    )
  ]
);
