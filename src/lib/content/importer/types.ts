import type { DatabaseClient } from "../../../db/client.ts";
import type {
  card,
  cardEntryLink,
  contentImport,
  entryLink,
  grammarAlias,
  grammarPattern,
  lesson,
  lessonContent,
  media,
  segment,
  term,
  termAlias
} from "../../../db/schema/index.ts";

import type {
  ContentParseResult,
  NormalizedContentWorkspace,
  ValidationIssue
} from "../types.ts";

export interface ImportContentOptions {
  contentRoot: string;
  database?: DatabaseClient;
  importId?: string;
  mediaSlugs?: string[];
  now?: Date;
}

export interface ImportSyncSummary {
  archivedCardIds: string[];
  archivedLessonIds: string[];
  archivedMediaIds: string[];
  prunedGrammarIds: string[];
  prunedTermIds: string[];
}

export interface ImportContentSuccessResult {
  filesChanged: number;
  filesScanned: number;
  importId: string;
  issues: ValidationIssue[];
  parseResult: ContentParseResult<NormalizedContentWorkspace>;
  status: "completed";
  summary: ImportSyncSummary;
}

export interface ImportContentFailedResult {
  filesChanged: number;
  filesScanned: number;
  importId: string;
  issues: ValidationIssue[];
  message: string;
  parseResult: ContentParseResult<NormalizedContentWorkspace>;
  status: "failed";
}

export type ImportContentResult =
  | ImportContentSuccessResult
  | ImportContentFailedResult;

export interface ImportSourceDocument {
  entityIds: {
    cards: string[];
    grammarPatterns: string[];
    lessons: string[];
    terms: string[];
  };
  kind: "media" | "lesson" | "cards";
  sourceFile: string;
}

export interface MediaImportPlan {
  cards: CardImportPlan[];
  entryLinks: Array<typeof entryLink.$inferInsert>;
  grammarPatterns: GrammarImportPlan[];
  lessonContents: LessonContentImportPlan[];
  lessons: LessonImportPlan[];
  media: MediaRowPlan;
  segments: Array<typeof segment.$inferInsert>;
  sourceDocuments: ImportSourceDocument[];
  terms: TermImportPlan[];
}

export interface MediaRowPlan {
  row: typeof media.$inferInsert;
  sourceFile: string;
}

export interface LessonImportPlan {
  row: typeof lesson.$inferInsert;
  sourceFile: string;
}

export interface LessonContentImportPlan {
  row: typeof lessonContent.$inferInsert;
  sourceFile: string;
}

export interface TermImportPlan {
  aliases: Array<typeof termAlias.$inferInsert>;
  row: typeof term.$inferInsert;
  sourceFile: string;
}

export interface GrammarImportPlan {
  aliases: Array<typeof grammarAlias.$inferInsert>;
  row: typeof grammarPattern.$inferInsert;
  sourceFile: string;
}

export interface CardImportPlan {
  entryLinks: Array<typeof entryLink.$inferInsert>;
  row: typeof card.$inferInsert;
  sourceFile: string;
  sourceFileId: string;
  termLinks: Array<typeof cardEntryLink.$inferInsert>;
}

export interface ExistingMediaState {
  cards: Array<
    typeof card.$inferSelect & {
      entryLinks: Array<typeof cardEntryLink.$inferSelect>;
    }
  >;
  entryLinks: Array<typeof entryLink.$inferSelect>;
  grammarPatterns: Array<
    typeof grammarPattern.$inferSelect & {
      aliases: Array<typeof grammarAlias.$inferSelect>;
    }
  >;
  lessonContents: Array<typeof lessonContent.$inferSelect>;
  lessons: Array<typeof lesson.$inferSelect>;
  media: typeof media.$inferSelect | null;
  segments: Array<typeof segment.$inferSelect>;
  terms: Array<
    typeof term.$inferSelect & {
      aliases: Array<typeof termAlias.$inferSelect>;
    }
  >;
}

export interface ContentImportUpdate {
  row: Partial<typeof contentImport.$inferInsert> & { id: string };
}
