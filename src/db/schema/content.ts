import {
  index,
  sqliteTable,
  text,
  uniqueIndex,
  integer
} from "drizzle-orm/sqlite-core";

import {
  contentImportStatusValues,
  lessonStatusValues,
  mediaStatusValues
} from "./enums.ts";

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    mediaType: text("media_type").notNull(),
    segmentKind: text("segment_kind").notNull(),
    language: text("language").notNull(),
    baseExplanationLanguage: text("base_explanation_language").notNull(),
    description: text("description"),
    status: text("status", { enum: mediaStatusValues })
      .notNull()
      .default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [uniqueIndex("media_slug_unique").on(table.slug)]
);

export const segment = sqliteTable(
  "segment",
  {
    id: text("id").primaryKey(),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull(),
    segmentType: text("segment_type").notNull(),
    notes: text("notes")
  },
  (table) => [
    uniqueIndex("segment_media_slug_unique").on(table.mediaId, table.slug),
    index("segment_media_order_idx").on(table.mediaId, table.orderIndex)
  ]
);

export const lesson = sqliteTable(
  "lesson",
  {
    id: text("id").primaryKey(),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    segmentId: text("segment_id").references(() => segment.id, {
      onDelete: "set null"
    }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull(),
    difficulty: text("difficulty"),
    summary: text("summary"),
    status: text("status", { enum: lessonStatusValues })
      .notNull()
      .default("active"),
    sourceFile: text("source_file").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    uniqueIndex("lesson_media_slug_unique").on(table.mediaId, table.slug),
    index("lesson_media_order_idx").on(table.mediaId, table.orderIndex),
    index("lesson_segment_order_idx").on(table.segmentId, table.orderIndex)
  ]
);

export const contentImport = sqliteTable(
  "content_import",
  {
    id: text("id").primaryKey(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    status: text("status", { enum: contentImportStatusValues }).notNull(),
    filesScanned: integer("files_scanned").notNull().default(0),
    filesChanged: integer("files_changed").notNull().default(0),
    message: text("message")
  },
  (table) => [
    index("content_import_status_idx").on(table.status, table.startedAt)
  ]
);

export const lessonContent = sqliteTable(
  "lesson_content",
  {
    lessonId: text("lesson_id")
      .primaryKey()
      .references(() => lesson.id, { onDelete: "cascade" }),
    markdownRaw: text("markdown_raw").notNull(),
    htmlRendered: text("html_rendered").notNull(),
    astJson: text("ast_json"),
    excerpt: text("excerpt"),
    lastImportId: text("last_import_id")
      .notNull()
      .references(() => contentImport.id)
  },
  (table) => [index("lesson_content_last_import_idx").on(table.lastImportId)]
);
