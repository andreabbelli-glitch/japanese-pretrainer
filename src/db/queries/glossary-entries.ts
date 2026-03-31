export {
  getGlossaryEntriesByCrossMediaGroupIds,
  getGlossaryEntriesByIds,
  getGlossaryEntryById,
  getGlossaryEntryBySourceId,
  listGlossaryEntriesByKind,
  listGlossarySegmentsByMediaId,
  listGrammarEntryReviewSummaries,
  listGrammarEntrySummaries,
  listTermEntryReviewSummaries,
  listTermEntrySummaries
} from "./glossary-entry-summaries.ts";
export type {
  GrammarEntryReviewSummary,
  GrammarGlossaryEntry,
  GrammarGlossaryEntrySummary,
  GlossarySegment,
  TermEntryReviewSummary,
  TermGlossaryEntry,
  TermGlossaryEntrySummary
} from "./glossary-entry-summaries.ts";
export {
  listEntryCardConnections,
  listEntryCardCounts,
  listEntryLessonConnections
} from "./glossary-entry-connections.ts";
export type {
  EntryCardConnection,
  EntryCardCount,
  EntryLessonConnection,
  GlossaryEntryRef
} from "./glossary-entry-connections.ts";
export {
  getGlobalGlossaryAggregateStats,
  listGlossaryPreviewEntries,
  listGlossaryProgressSummaries,
  listGlossaryShellCounts
} from "./glossary-entry-analytics.ts";
export type {
  GlossaryPreviewEntryState,
  GlossaryProgressSummary,
  GlossaryShellCounts
} from "./glossary-entry-analytics.ts";
