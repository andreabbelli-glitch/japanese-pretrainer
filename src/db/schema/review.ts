import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

import { media, segment } from "./content.ts";
import {
  cardRelationshipTypeValues,
  cardStatusValues,
  entryTypeValues,
  reviewRatingValues,
  reviewSchedulerVersionValues,
  reviewStateValues
} from "./enums.ts";

export const card = sqliteTable(
  "card",
  {
    id: text("id").primaryKey(),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    segmentId: text("segment_id").references(() => segment.id, {
      onDelete: "set null"
    }),
    sourceFile: text("source_file").notNull(),
    cardType: text("card_type").notNull(),
    front: text("front").notNull(),
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
    index("card_segment_order_idx").on(table.segmentId, table.orderIndex)
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
    index("card_entry_link_card_idx").on(table.cardId),
    index("card_entry_link_entry_idx").on(table.entryType, table.entryId),
    uniqueIndex("card_entry_link_unique").on(
      table.cardId,
      table.entryType,
      table.entryId,
      table.relationshipType
    )
  ]
);

export const reviewState = sqliteTable(
  "review_state",
  {
    cardId: text("card_id")
      .primaryKey()
      .references(() => card.id, { onDelete: "cascade" }),
    state: text("state", { enum: reviewStateValues }).notNull(),
    stability: real("stability"),
    difficulty: real("difficulty"),
    dueAt: text("due_at"),
    lastReviewedAt: text("last_reviewed_at"),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    schedulerVersion: text("scheduler_version", {
      enum: reviewSchedulerVersionValues
    })
      .notNull()
      .default("legacy_simple"),
    manualOverride: integer("manual_override", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [index("review_state_due_idx").on(table.dueAt)]
);

export const reviewLog = sqliteTable(
  "review_log",
  {
    id: text("id").primaryKey(),
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
      .default("legacy_simple")
  },
  (table) => [
    index("review_log_card_answered_idx").on(table.cardId, table.answeredAt)
  ]
);
