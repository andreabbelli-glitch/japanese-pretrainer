import type { EntryType } from "../../domain/content.ts";

export const issueCategoryValues = [
  "syntax",
  "schema",
  "reference",
  "integrity"
] as const;

export type IssueCategory = (typeof issueCategoryValues)[number];

export interface SourcePoint {
  line: number;
  column: number;
  offset?: number;
}

export interface SourceRange {
  start: SourcePoint;
  end: SourcePoint;
}

export interface SourceLocation {
  filePath: string;
  range?: SourceRange;
}

export interface ValidationIssue {
  code: string;
  category: IssueCategory;
  message: string;
  location: SourceLocation;
  path?: string;
  hint?: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface RichTextFragment {
  raw: string;
  nodes: InlineNode[];
}

export type InlineNode =
  | {
      type: "text";
      value: string;
    }
  | {
      type: "furigana";
      raw: string;
      base: string;
      reading: string;
    }
  | {
      type: "reference";
      raw: string;
      display: string;
      targetType: EntryType;
      targetId: string;
      children: InlineNode[];
    }
  | {
      type: "emphasis";
      children: InlineNode[];
    }
  | {
      type: "strong";
      children: InlineNode[];
    }
  | {
      type: "inlineCode";
      children: InlineNode[];
    }
  | {
      type: "link";
      url: string;
      title?: string | null;
      children: InlineNode[];
    }
  | {
      type: "break";
    };

export interface MarkdownDocument {
  raw: string;
  blocks: ContentBlock[];
}

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | BlockquoteBlock
  | CodeBlock
  | ThematicBreakBlock
  | ImageBlock
  | ExampleSentenceBlock
  | TermDefinitionBlock
  | GrammarDefinitionBlock
  | CardDefinitionBlock;

export interface ParagraphBlock {
  type: "paragraph";
  position?: SourceRange;
  children: InlineNode[];
}

export interface HeadingBlock {
  type: "heading";
  depth: number;
  position?: SourceRange;
  children: InlineNode[];
}

export interface ListBlock {
  type: "list";
  ordered: boolean;
  start: number | null;
  position?: SourceRange;
  items: ListItemBlock[];
}

export interface ListItemBlock {
  type: "listItem";
  position?: SourceRange;
  children: ContentBlock[];
}

export interface BlockquoteBlock {
  type: "blockquote";
  position?: SourceRange;
  children: ContentBlock[];
}

export interface CodeBlock {
  type: "code";
  lang: string | null;
  meta: string | null;
  position?: SourceRange;
  value: string;
}

export interface ThematicBreakBlock {
  type: "thematicBreak";
  position?: SourceRange;
}

export interface ImageBlock {
  type: "image";
  position?: SourceRange;
  src: string;
  alt: string;
  cardId?: string;
  caption?: RichTextFragment;
}

export interface ExampleSentenceBlock {
  type: "exampleSentence";
  position?: SourceRange;
  sentence: RichTextFragment;
  translationIt: RichTextFragment;
  revealMode?: "default" | "sentence";
}

export interface MediaFrontmatter {
  id: string;
  slug: string;
  title: string;
  mediaType: string;
  segmentKind: string;
  language: string;
  baseExplanationLanguage: string;
  status?: string;
  subtitle?: string;
  description?: string;
  tags: string[];
  coverImage?: string;
  notes?: string;
}

export interface LessonFrontmatter {
  id: string;
  mediaId: string;
  slug: string;
  title: string;
  order: number;
  segmentRef?: string;
  difficulty?: string;
  tags: string[];
  status?: string;
  summary?: string;
  prerequisites: string[];
}

export interface CardsFrontmatter {
  id: string;
  mediaId: string;
  slug: string;
  title: string;
  order: number;
  segmentRef?: string;
}

export interface DefinitionSource {
  filePath: string;
  documentId?: string;
  documentKind: "lesson" | "cards";
  documentOrder?: number;
  sequence: number;
  segmentRef?: string;
}

export interface EntryAudioMetadata {
  audioSrc: string;
  audioSource?: string;
  audioSpeaker?: string;
  audioLicense?: string;
  audioAttribution?: string;
  audioPageUrl?: string;
}

export interface EntryPitchAccentMetadata {
  pitchAccent?: number;
  pitchAccentSource?: string;
  pitchAccentPageUrl?: string;
}

export interface NormalizedTerm {
  kind: "term";
  id: string;
  crossMediaGroup?: string;
  lemma: string;
  reading: string;
  romaji: string;
  meaningIt: string;
  pos?: string;
  meaningLiteralIt?: string;
  notesIt?: RichTextFragment;
  levelHint?: string;
  aliases: string[];
  segmentRef?: string;
  audio?: EntryAudioMetadata;
  pitchAccent?: number;
  pitchAccentSource?: string;
  pitchAccentPageUrl?: string;
  source: DefinitionSource;
}

export interface NormalizedGrammarPattern {
  kind: "grammar";
  id: string;
  crossMediaGroup?: string;
  pattern: string;
  title: string;
  reading?: string;
  meaningIt: string;
  notesIt?: RichTextFragment;
  levelHint?: string;
  aliases: string[];
  segmentRef?: string;
  audio?: EntryAudioMetadata;
  pitchAccent?: number;
  pitchAccentSource?: string;
  pitchAccentPageUrl?: string;
  source: DefinitionSource;
}

export interface NormalizedCard {
  kind: "card";
  id: string;
  entryType: EntryType;
  entryId: string;
  cardType: string;
  front: RichTextFragment;
  back: RichTextFragment;
  exampleJp?: RichTextFragment;
  exampleIt?: RichTextFragment;
  notesIt?: RichTextFragment;
  tags: string[];
  source: DefinitionSource;
}

export interface TermDefinitionBlock {
  type: "termDefinition";
  position?: SourceRange;
  entry: NormalizedTerm;
}

export interface GrammarDefinitionBlock {
  type: "grammarDefinition";
  position?: SourceRange;
  entry: NormalizedGrammarPattern;
}

export interface CardDefinitionBlock {
  type: "cardDefinition";
  position?: SourceRange;
  card: NormalizedCard;
}

export interface CollectedReference {
  referenceType: EntryType;
  targetId: string;
  display: string;
  raw: string;
  sourceFile: string;
  sourceDocumentKind: "media" | "lesson" | "cards";
  sourceDocumentId?: string;
  sourcePath: string;
  location?: SourceRange;
}

export interface NormalizedMediaDocument {
  kind: "media";
  sourceFile: string;
  folderSlug: string;
  frontmatter: MediaFrontmatter;
  body: MarkdownDocument;
}

export interface NormalizedLessonDocument {
  kind: "lesson";
  sourceFile: string;
  frontmatter: LessonFrontmatter;
  body: MarkdownDocument;
  declaredTermIds: string[];
  declaredGrammarIds: string[];
  referenceIds: string[];
}

export interface NormalizedCardsDocument {
  kind: "cards";
  sourceFile: string;
  frontmatter: CardsFrontmatter;
  body: MarkdownDocument;
  declaredTermIds: string[];
  declaredGrammarIds: string[];
  declaredCardIds: string[];
  referenceIds: string[];
}

export interface NormalizedMediaBundle {
  mediaDirectory: string;
  mediaSlug: string;
  media: NormalizedMediaDocument | null;
  lessons: NormalizedLessonDocument[];
  cardFiles: NormalizedCardsDocument[];
  terms: NormalizedTerm[];
  grammarPatterns: NormalizedGrammarPattern[];
  cards: NormalizedCard[];
  references: CollectedReference[];
}

export interface NormalizedContentWorkspace {
  contentRoot: string;
  bundles: NormalizedMediaBundle[];
}

export interface ContentParseResult<T> {
  ok: boolean;
  data: T;
  issues: ValidationIssue[];
}
