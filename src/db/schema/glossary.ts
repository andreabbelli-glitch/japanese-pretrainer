import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

import { media, segment } from "./content.ts";
import {
  entryLinkRoleValues,
  entryStatusValues,
  entryTypeValues,
  sourceTypeValues
} from "./enums.ts";

export const crossMediaGroup = sqliteTable(
  "cross_media_group",
  {
    id: text("id").primaryKey(),
    entryType: text("entry_type", { enum: entryTypeValues }).notNull(),
    groupKey: text("group_key").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    uniqueIndex("cross_media_group_type_key_unique").on(
      table.entryType,
      table.groupKey
    )
  ]
);

export const term = sqliteTable(
  "term",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    crossMediaGroupId: text("cross_media_group_id").references(
      () => crossMediaGroup.id,
      {
        onDelete: "set null"
      }
    ),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    segmentId: text("segment_id").references(() => segment.id, {
      onDelete: "set null"
    }),
    lemma: text("lemma").notNull(),
    reading: text("reading").notNull(),
    romaji: text("romaji").notNull(),
    pos: text("pos"),
    meaningIt: text("meaning_it").notNull(),
    meaningLiteralIt: text("meaning_literal_it"),
    notesIt: text("notes_it"),
    levelHint: text("level_hint"),
    audioSrc: text("audio_src"),
    audioSource: text("audio_source"),
    audioSpeaker: text("audio_speaker"),
    audioLicense: text("audio_license"),
    audioAttribution: text("audio_attribution"),
    audioPageUrl: text("audio_page_url"),
    searchLemmaNorm: text("search_lemma_norm").notNull(),
    searchReadingNorm: text("search_reading_norm").notNull(),
    searchRomajiNorm: text("search_romaji_norm").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("term_media_idx").on(table.mediaId),
    index("term_media_source_idx").on(table.mediaId, table.sourceId),
    index("term_cross_media_group_idx").on(table.crossMediaGroupId),
    index("term_segment_idx").on(table.segmentId),
    index("term_search_lemma_idx").on(table.searchLemmaNorm),
    index("term_search_reading_idx").on(table.searchReadingNorm),
    index("term_search_romaji_idx").on(table.searchRomajiNorm),
    uniqueIndex("term_media_source_unique").on(table.mediaId, table.sourceId)
  ]
);

export const termAlias = sqliteTable(
  "term_alias",
  {
    id: text("id").primaryKey(),
    termId: text("term_id")
      .notNull()
      .references(() => term.id, { onDelete: "cascade" }),
    aliasText: text("alias_text").notNull(),
    aliasNorm: text("alias_norm").notNull(),
    aliasType: text("alias_type").notNull()
  },
  (table) => [
    index("term_alias_term_idx").on(table.termId),
    uniqueIndex("term_alias_term_norm_type_unique").on(
      table.termId,
      table.aliasNorm,
      table.aliasType
    )
  ]
);

export const grammarPattern = sqliteTable(
  "grammar_pattern",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    crossMediaGroupId: text("cross_media_group_id").references(
      () => crossMediaGroup.id,
      {
        onDelete: "set null"
      }
    ),
    mediaId: text("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    segmentId: text("segment_id").references(() => segment.id, {
      onDelete: "set null"
    }),
    pattern: text("pattern").notNull(),
    title: text("title").notNull(),
    reading: text("reading"),
    meaningIt: text("meaning_it").notNull(),
    notesIt: text("notes_it"),
    levelHint: text("level_hint"),
    audioSrc: text("audio_src"),
    audioSource: text("audio_source"),
    audioSpeaker: text("audio_speaker"),
    audioLicense: text("audio_license"),
    audioAttribution: text("audio_attribution"),
    audioPageUrl: text("audio_page_url"),
    searchPatternNorm: text("search_pattern_norm").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => [
    index("grammar_media_idx").on(table.mediaId),
    index("grammar_media_source_idx").on(table.mediaId, table.sourceId),
    index("grammar_cross_media_group_idx").on(table.crossMediaGroupId),
    index("grammar_segment_idx").on(table.segmentId),
    index("grammar_search_pattern_idx").on(table.searchPatternNorm),
    uniqueIndex("grammar_media_source_unique").on(table.mediaId, table.sourceId)
  ]
);

export const grammarAlias = sqliteTable(
  "grammar_alias",
  {
    id: text("id").primaryKey(),
    grammarId: text("grammar_id")
      .notNull()
      .references(() => grammarPattern.id, { onDelete: "cascade" }),
    aliasText: text("alias_text").notNull(),
    aliasNorm: text("alias_norm").notNull()
  },
  (table) => [
    index("grammar_alias_grammar_idx").on(table.grammarId),
    uniqueIndex("grammar_alias_grammar_norm_unique").on(
      table.grammarId,
      table.aliasNorm
    )
  ]
);

export const entryLink = sqliteTable(
  "entry_link",
  {
    id: text("id").primaryKey(),
    entryType: text("entry_type", { enum: entryTypeValues }).notNull(),
    entryId: text("entry_id").notNull(),
    sourceType: text("source_type", { enum: sourceTypeValues }).notNull(),
    sourceId: text("source_id").notNull(),
    linkRole: text("link_role", { enum: entryLinkRoleValues }).notNull(),
    sortOrder: integer("sort_order")
  },
  (table) => [
    index("entry_link_entry_idx").on(table.entryType, table.entryId),
    index("entry_link_source_idx").on(table.sourceType, table.sourceId),
    uniqueIndex("entry_link_unique").on(
      table.entryType,
      table.entryId,
      table.sourceType,
      table.sourceId,
      table.linkRole
    )
  ]
);

export const entryStatus = sqliteTable(
  "entry_status",
  {
    id: text("id").primaryKey(),
    entryType: text("entry_type", { enum: entryTypeValues }).notNull(),
    entryId: text("entry_id").notNull(),
    status: text("status", { enum: entryStatusValues }).notNull(),
    reason: text("reason"),
    setAt: text("set_at").notNull()
  },
  (table) => [
    uniqueIndex("entry_status_entry_unique").on(table.entryType, table.entryId)
  ]
);
