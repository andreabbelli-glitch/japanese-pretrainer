import type { ContentBlock, SourceRange, ValidationIssue } from "../types";

export interface ParsedYamlBlock {
  data: Record<string, unknown> | null;
  issues: ValidationIssue[];
}

export interface RawStructuredBlock {
  index: number;
  blockType: string;
  raw: string;
  placeholder: string;
  data: Record<string, unknown> | null;
  position?: SourceRange;
  fieldRanges?: Record<string, SourceRange>;
}

export interface RawStructuredBlockNode {
  type: "structuredBlock";
  blockIndex: number;
  blockType: string;
  position?: SourceRange;
}

export interface DraftMarkdownDocument {
  raw: string;
  blocks: Array<ContentBlock | RawStructuredBlockNode>;
}

export interface ParsedMediaDraft {
  kind: "media";
  sourceFile: string;
  folderSlug: string;
  frontmatter: Record<string, unknown> | null;
  body: DraftMarkdownDocument;
}

export interface ParsedLessonDraft {
  kind: "lesson";
  sourceFile: string;
  frontmatter: Record<string, unknown> | null;
  body: DraftMarkdownDocument;
}

export interface ParsedCardsDraft {
  kind: "cards";
  sourceFile: string;
  frontmatter: Record<string, unknown> | null;
  body: DraftMarkdownDocument;
}

export type ParsedDocumentDraft =
  | ParsedMediaDraft
  | ParsedLessonDraft
  | ParsedCardsDraft;
