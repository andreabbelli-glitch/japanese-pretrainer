import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

import { lesson, media, segment } from "./content.ts";
import {
  cardRelationshipTypeValues,
  cardStatusValues,
  entryTypeValues,
  reviewRatingValues,
  reviewSchedulerVersionValues,
  reviewSubjectKindValues,
  reviewStateValues
} from "./enums.ts";

export const card = sqliteTable(
  "card",
  {
    id: text("id").primaryKey(),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").references(() => lesson.id, {
      onDelete: "set null"
    }),
    segmentId: text("segment_id").references(() => segment.id, {
      onDelete: "set null"
    }),
    sourceFile: text("source_file").notNull(),
    cardType: text("card_type").notNull(),
    front: text("front").notNull(),
    normalizedFront: text("normalized_front"),
    back: text("back").notNull(),
    exampleJp: text("example_jp"),
    exampleIt: text("example_it"),
    notesIt: text("notes_it"),
    status: text("status", { enum: cardStatusValues })
      .notNull()
      .default("active"),
    orderIndex: integer("order_index"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("card_media_order_idx").on(table.mediaId, table.orderIndex),
    index("card_lesson_idx").on(table.lessonId),
    index("card_segment_order_idx").on(table.segmentId, table.orderIndex),
    index("card_status_type_idx").on(table.status, table.cardType)
  ]
);

export const cardEntryLink = sqliteTable(
  "card_entry_link",
  {
    id: text("id").primaryKey(),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    entryType: text("entry_type", { enum: entryTypeValues }).notNull(),
    entryId: text("entry_id").notNull(),
    relationshipType: text("relationship_type", {
      enum: cardRelationshipTypeValues
    }).notNull()
  },
  (table) => [
    index("card_entry_link_card_rel_idx").on(
      table.cardId,
      table.relationshipType
    ),
    index("card_entry_link_entry_idx").on(table.entryType, table.entryId),
    uniqueIndex("card_entry_link_unique").on(
      table.cardId,
      table.entryType,
      table.entryId,
      table.relationshipType
    )
  ]
);

export const reviewSubjectState = sqliteTable(
  "review_subject_state",
  {
    subjectKey: text("subject_key").primaryKey(),
    subjectType: text("subject_type", { enum: reviewSubjectKindValues }).notNull(),
    entryType: text("entry_type", { enum: entryTypeValues }),
    crossMediaGroupId: text("cross_media_group_id"),
    entryId: text("entry_id"),
    cardId: text("card_id").references(() => card.id, { onDelete: "set null" }),
    state: text("state", { enum: reviewStateValues }).notNull(),
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
      enum: reviewSchedulerVersionValues
    })
      .notNull()
      .default("fsrs_v1"),
    manualOverride: integer("manual_override", { mode: "boolean" })
      .notNull()
      .default(false),
    suspended: integer("suspended", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("review_subject_state_due_idx").on(table.dueAt),
    index("review_subject_state_interaction_idx").on(table.lastInteractionAt),
    index("review_subject_state_card_idx").on(table.cardId),
    index("review_subject_state_entry_idx").on(
      table.entryType,
      table.crossMediaGroupId,
      table.entryId
    )
  ]
);

export const reviewSubjectLog = sqliteTable(
  "review_subject_log",
  {
    id: text("id").primaryKey(),
    subjectKey: text("subject_key")
      .notNull()
      .references(() => reviewSubjectState.subjectKey, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    answeredAt: text("answered_at").notNull(),
    rating: text("rating", { enum: reviewRatingValues }).notNull(),
    previousState: text("previous_state", { enum: reviewStateValues }),
    newState: text("new_state", { enum: reviewStateValues }),
    scheduledDueAt: text("scheduled_due_at"),
    elapsedDays: real("elapsed_days"),
    responseMs: integer("response_ms"),
    schedulerVersion: text("scheduler_version", {
      enum: reviewSchedulerVersionValues
    })
      .notNull()
      .default("fsrs_v1")
  },
  (table) => [
    index("review_subject_log_subject_answered_idx").on(
      table.subjectKey,
      table.answeredAt
    ),
    index("review_subject_log_card_answered_idx").on(table.cardId, table.answeredAt)
  ]
);
