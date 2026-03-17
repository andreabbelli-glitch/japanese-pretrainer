import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  entryTypeValues,
  lessonStatusValues,
  mediaStatusValues
} from "../../domain/content.ts";

import { parseFrontmatter } from "./parser/frontmatter.ts";
import {
  applyPronunciationManifest,
  normalizeEntryAudioMetadata,
  loadPronunciationManifest
} from "./pronunciations-manifest.ts";
import {
  isSupportedImageAssetPath,
  isValidMediaAssetPath,
  isWithinMediaAssetRoot,
  resolveMediaAssetAbsolutePath
} from "../media-assets.ts";
import type {
  ParsedDocumentDraft,
  RawStructuredBlock
} from "./parser/internal.ts";
import {
  parseInlineFragment,
  parseMarkdownDocument
} from "./parser/markdown.ts";
import { extractStructuredBlocks } from "./parser/structured-blocks.ts";
import { createIssue, isStringArray, isUrlSafeSlug } from "./parser/utils.ts";
import type {
  CardDefinitionBlock,
  CardsFrontmatter,
  CollectedReference,
  ContentBlock,
  ContentParseResult,
  ExampleSentenceBlock,
  GrammarDefinitionBlock,
  ImageBlock,
  InlineNode,
  LessonFrontmatter,
  MarkdownDocument,
  MediaFrontmatter,
  NormalizedCard,
  NormalizedCardsDocument,
  NormalizedContentWorkspace,
  NormalizedGrammarPattern,
  NormalizedLessonDocument,
  NormalizedMediaBundle,
  NormalizedMediaDocument,
  NormalizedTerm,
  SourceRange,
  TermDefinitionBlock,
  ValidationIssue
} from "./types.ts";

interface ParsedDocumentState {
  draft: ParsedDocumentDraft;
  rawId?: string;
  frontmatterFieldRanges: Record<string, SourceRange>;
  frontmatterFieldStyles: Record<string, string>;
  structuredBlocks: RawStructuredBlock[];
  references: CollectedReference[];
  issues: ValidationIssue[];
}

interface TermRecord {
  value: NormalizedTerm;
  sourcePath: string;
  position?: SourceRange;
  references: CollectedReference[];
}

interface GrammarRecord {
  value: NormalizedGrammarPattern;
  sourcePath: string;
  position?: SourceRange;
  references: CollectedReference[];
}

interface CardRecord {
  value: NormalizedCard;
  sourcePath: string;
  position?: SourceRange;
}

interface DocumentSourceContext {
  filePath: string;
  documentKind: "lesson" | "cards";
  documentId?: string;
  documentOrder?: number;
  documentSegmentRef?: string;
  mediaDirectory: string;
}

interface MarkdownDirectoryInspection {
  markdownFiles: string[];
  issues: ValidationIssue[];
}

export async function parseMediaDirectory(
  mediaDirectory: string
): Promise<ContentParseResult<NormalizedMediaBundle>> {
  const issues: ValidationIssue[] = [];
  const mediaSlug = path.basename(mediaDirectory);
  const mediaFilePath = path.join(mediaDirectory, "media.md");
  const textbookDirectory = path.join(mediaDirectory, "textbook");
  const cardsDirectory = path.join(mediaDirectory, "cards");

  const [mediaFileExists, textbookInspection, cardsInspection] =
    await Promise.all([
      fileExists(mediaFilePath),
      inspectRequiredMarkdownDirectory(textbookDirectory, "textbook"),
      inspectRequiredMarkdownDirectory(cardsDirectory, "cards")
    ]);

  issues.push(...textbookInspection.issues, ...cardsInspection.issues);

  if (!mediaFileExists) {
    issues.push(
      createIssue({
        code: "media.missing-file",
        category: "integrity",
        message: "Media directory is missing media.md.",
        filePath: mediaFilePath,
        hint: "Add content/media/<slug>/media.md to describe the media package."
      })
    );
  }

  const parsedStates = await Promise.all([
    ...(mediaFileExists ? [parseDocumentFile(mediaFilePath, "media")] : []),
    ...textbookInspection.markdownFiles.map((filePath) =>
      parseDocumentFile(filePath, "lesson")
    ),
    ...cardsInspection.markdownFiles.map((filePath) =>
      parseDocumentFile(filePath, "cards")
    )
  ]);

  for (const state of parsedStates) {
    issues.push(...state.issues);
  }

  const mediaState = parsedStates.find(
    (
      state
    ): state is ParsedDocumentState & {
      draft: ParsedDocumentDraft & { kind: "media" };
    } => state.draft.kind === "media"
  );
  const lessonStates = parsedStates.filter(
    (
      state
    ): state is ParsedDocumentState & {
      draft: ParsedDocumentDraft & { kind: "lesson" };
    } => state.draft.kind === "lesson"
  );
  const cardsStates = parsedStates.filter(
    (
      state
    ): state is ParsedDocumentState & {
      draft: ParsedDocumentDraft & { kind: "cards" };
    } => state.draft.kind === "cards"
  );

  const normalizedMedia = mediaState
    ? normalizeMediaDocument(mediaState, mediaSlug, issues)
    : null;

  const expectedMediaId =
    normalizedMedia?.frontmatter.id ?? mediaState?.rawId ?? undefined;

  const lessonResults = await Promise.all(
    lessonStates.map((state) =>
      normalizeLessonDocument(state, mediaDirectory, issues, expectedMediaId)
    )
  );
  const cardsResults = await Promise.all(
    cardsStates.map((state) =>
      normalizeCardsDocument(state, mediaDirectory, issues, expectedMediaId)
    )
  );

  validateDuplicateIds(
    {
      media: mediaState ? [mediaState] : [],
      lessons: lessonStates,
      cardFiles: cardsStates
    },
    issues
  );

  const terms = lessonResults
    .flatMap((result) => result.terms)
    .concat(cardsResults.flatMap((result) => result.terms));
  const grammarPatterns = lessonResults
    .flatMap((result) => result.grammarPatterns)
    .concat(cardsResults.flatMap((result) => result.grammarPatterns));
  const cards = cardsResults.flatMap((result) => result.cards);
  const references = [
    ...(mediaState?.references ?? []),
    ...lessonResults.flatMap((result) => result.references),
    ...cardsResults.flatMap((result) => result.references)
  ];
  const pronunciationManifestResult =
    await loadPronunciationManifest(mediaDirectory);

  issues.push(...pronunciationManifestResult.issues);
  applyPronunciationManifest({
    grammarPatterns: grammarPatterns.map((record) => record.value),
    issues,
    manifest: pronunciationManifestResult.manifest,
    terms: terms.map((record) => record.value)
  });

  validateReferences(terms, grammarPatterns, cards, references, issues);

  const bundle: NormalizedMediaBundle = {
    mediaDirectory,
    mediaSlug,
    media: normalizedMedia,
    lessons: lessonResults
      .map((result) => result.document)
      .filter(
        (document): document is NormalizedLessonDocument => document !== null
      ),
    cardFiles: cardsResults
      .map((result) => result.document)
      .filter(
        (document): document is NormalizedCardsDocument => document !== null
      ),
    terms: terms.map((record) => record.value),
    grammarPatterns: grammarPatterns.map((record) => record.value),
    cards: cards.map((record) => record.value),
    references
  };

  return {
    ok: issues.length === 0,
    data: bundle,
    issues: sortIssues(issues)
  };
}

export async function parseContentRoot(
  contentRoot: string
): Promise<ContentParseResult<NormalizedContentWorkspace>> {
  const mediaRoot = path.join(contentRoot, "media");
  const issues: ValidationIssue[] = [];
  const mediaRootStat = await getStat(mediaRoot);

  if (!mediaRootStat) {
    issues.push(
      createIssue({
        code: "content-root.missing-media-directory",
        category: "integrity",
        message: "Content root is missing the media directory.",
        filePath: mediaRoot,
        hint: "Create content/media and place one subdirectory per media package inside it."
      })
    );

    return {
      ok: false,
      data: {
        contentRoot,
        bundles: []
      },
      issues: sortIssues(issues)
    };
  }

  if (!mediaRootStat.isDirectory()) {
    issues.push(
      createIssue({
        code: "content-root.invalid-media-directory",
        category: "integrity",
        message: "Content root media path is not a directory.",
        filePath: mediaRoot,
        hint: "Replace the media path with a directory containing the content bundles."
      })
    );

    return {
      ok: false,
      data: {
        contentRoot,
        bundles: []
      },
      issues: sortIssues(issues)
    };
  }

  let mediaDirectories: string[] = [];

  try {
    const mediaEntries = await readdir(mediaRoot, { withFileTypes: true });
    mediaDirectories = mediaEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(mediaRoot, entry.name))
      .sort();
  } catch (error) {
    issues.push(
      createIssue({
        code: "content-root.unreadable-media-directory",
        category: "integrity",
        message: "Content root media directory could not be read.",
        filePath: mediaRoot,
        hint: "Check filesystem permissions for the media directory.",
        details: {
          error:
            error instanceof Error && error.message.length > 0
              ? error.message
              : String(error)
        }
      })
    );

    return {
      ok: false,
      data: {
        contentRoot,
        bundles: []
      },
      issues: sortIssues(issues)
    };
  }

  const results = await Promise.all(
    mediaDirectories.map((directory) => parseMediaDirectory(directory))
  );
  issues.push(...results.flatMap((result) => result.issues));
  validateWorkspaceDuplicateIds(
    results.map((result) => result.data),
    issues
  );

  return {
    ok: issues.length === 0,
    data: {
      contentRoot,
      bundles: results.map((result) => result.data)
    },
    issues: sortIssues(issues)
  };
}

async function parseDocumentFile(
  filePath: string,
  kind: ParsedDocumentDraft["kind"]
): Promise<ParsedDocumentState> {
  const rawSource = await readFile(filePath, "utf8");
  const source = rawSource.replaceAll("\r\n", "\n");
  const frontmatter = parseFrontmatter(source, filePath);
  const rawId = asString(frontmatter.data?.id);
  const extraction = extractStructuredBlocks(
    frontmatter.body,
    filePath,
    frontmatter.bodyLineOffset
  );
  const structuredBlockLookup = new Map(
    extraction.blocks.map((block) => [block.placeholder, block.index])
  );
  const markdown = parseMarkdownDocument({
    source: extraction.transformedSource,
    rawSource: frontmatter.body,
    filePath,
    documentKind: kind,
    documentId: rawId,
    lineOffset: frontmatter.bodyLineOffset,
    structuredBlockLookup
  });

  return {
    draft:
      kind === "media"
        ? {
            kind,
            sourceFile: filePath,
            folderSlug: path.basename(path.dirname(filePath)),
            frontmatter: frontmatter.data,
            body: markdown.document
          }
        : {
            kind,
            sourceFile: filePath,
            frontmatter: frontmatter.data,
            body: markdown.document
          },
    rawId,
    frontmatterFieldRanges: frontmatter.fieldRanges,
    frontmatterFieldStyles: frontmatter.fieldStyles,
    structuredBlocks: extraction.blocks,
    references: markdown.references,
    issues: [...frontmatter.issues, ...extraction.issues, ...markdown.issues]
  };
}

function normalizeMediaDocument(
  state: ParsedDocumentState & {
    draft: ParsedDocumentDraft & { kind: "media" };
  },
  mediaSlug: string,
  issues: ValidationIssue[]
): NormalizedMediaDocument | null {
  const frontmatter = normalizeMediaFrontmatter(
    state.draft.frontmatter,
    state.draft.sourceFile,
    state.frontmatterFieldRanges,
    state.frontmatterFieldStyles,
    issues
  );
  const body = resolveMediaBody(state, issues);

  if (!frontmatter) {
    return null;
  }

  if (frontmatter.slug !== mediaSlug) {
    issues.push(
      createIssue({
        code: "media.slug-folder-mismatch",
        category: "integrity",
        message: "Media slug does not match the containing directory.",
        filePath: state.draft.sourceFile,
        path: "frontmatter.slug",
        hint: `Expected '${mediaSlug}'.`
      })
    );
  }

  return {
    kind: "media",
    sourceFile: state.draft.sourceFile,
    folderSlug: mediaSlug,
    frontmatter,
    body
  };
}

async function normalizeLessonDocument(
  state: ParsedDocumentState & {
    draft: ParsedDocumentDraft & { kind: "lesson" };
  },
  mediaDirectory: string,
  issues: ValidationIssue[],
  expectedMediaId?: string
): Promise<{
  document: NormalizedLessonDocument | null;
  terms: TermRecord[];
  grammarPatterns: GrammarRecord[];
  references: CollectedReference[];
}> {
  const frontmatter = normalizeLessonFrontmatter(
    state.draft.frontmatter,
    state.draft.sourceFile,
    state.frontmatterFieldRanges,
    state.frontmatterFieldStyles,
    issues
  );

  if (
    frontmatter &&
    expectedMediaId &&
    frontmatter.mediaId !== expectedMediaId
  ) {
    issues.push(
      createIssue({
        code: "frontmatter.media-id-mismatch",
        category: "reference",
        message: "Lesson media_id does not match media.md.",
        filePath: state.draft.sourceFile,
        path: "frontmatter.media_id",
        hint: `Use '${expectedMediaId}' to match the media package.`,
        details: {
          expectedMediaId,
          actualMediaId: frontmatter.mediaId
        }
      })
    );
  }

  const sourceContext: DocumentSourceContext = {
    filePath: state.draft.sourceFile,
    documentKind: "lesson",
    documentId: frontmatter?.id ?? state.rawId,
    documentOrder: frontmatter?.order,
    documentSegmentRef: frontmatter?.segmentRef,
    mediaDirectory
  };
  const resolved = await resolveStructuredBody(
    state,
    sourceContext,
    issues,
    new Set(["term", "grammar", "example_sentence", "image"])
  );

  return {
    document: frontmatter
      ? {
          kind: "lesson",
          sourceFile: state.draft.sourceFile,
          frontmatter,
          body: resolved.body,
          declaredTermIds: resolved.terms.map((record) => record.value.id),
          declaredGrammarIds: resolved.grammarPatterns.map(
            (record) => record.value.id
          ),
          referenceIds: dedupeStrings(
            resolved.references.map(
              (reference) => `${reference.referenceType}:${reference.targetId}`
            )
          )
        }
      : null,
    terms: resolved.terms,
    grammarPatterns: resolved.grammarPatterns,
    references: resolved.references
  };
}

async function normalizeCardsDocument(
  state: ParsedDocumentState & {
    draft: ParsedDocumentDraft & { kind: "cards" };
  },
  mediaDirectory: string,
  issues: ValidationIssue[],
  expectedMediaId?: string
): Promise<{
  document: NormalizedCardsDocument | null;
  terms: TermRecord[];
  grammarPatterns: GrammarRecord[];
  cards: CardRecord[];
  references: CollectedReference[];
}> {
  const frontmatter = normalizeCardsFrontmatter(
    state.draft.frontmatter,
    state.draft.sourceFile,
    state.frontmatterFieldRanges,
    state.frontmatterFieldStyles,
    issues
  );

  if (
    frontmatter &&
    expectedMediaId &&
    frontmatter.mediaId !== expectedMediaId
  ) {
    issues.push(
      createIssue({
        code: "frontmatter.media-id-mismatch",
        category: "reference",
        message: "Cards file media_id does not match media.md.",
        filePath: state.draft.sourceFile,
        path: "frontmatter.media_id",
        hint: `Use '${expectedMediaId}' to match the media package.`,
        details: {
          expectedMediaId,
          actualMediaId: frontmatter.mediaId
        }
      })
    );
  }

  const sourceContext: DocumentSourceContext = {
    filePath: state.draft.sourceFile,
    documentKind: "cards",
    documentId: frontmatter?.id ?? state.rawId,
    documentOrder: frontmatter?.order,
    documentSegmentRef: frontmatter?.segmentRef,
    mediaDirectory
  };
  const resolved = await resolveStructuredBody(
    state,
    sourceContext,
    issues,
    new Set(["term", "grammar", "card"])
  );

  for (const [index, block] of resolved.body.blocks.entries()) {
    if (
      block.type !== "termDefinition" &&
      block.type !== "grammarDefinition" &&
      block.type !== "cardDefinition"
    ) {
      issues.push(
        createIssue({
          code: "cards.free-text-not-allowed",
          category: "schema",
          message:
            "Cards files may only contain structured term, grammar, or card blocks.",
          filePath: state.draft.sourceFile,
          path: `body.blocks[${index}]`,
          range: block.position,
          hint: "Move descriptive text into textbook files or remove it."
        })
      );
    }
  }

  if (resolved.cards.length === 0) {
    issues.push(
      createIssue({
        code: "cards.missing-card-block",
        category: "schema",
        message: "Cards files must contain at least one :::card block.",
        filePath: state.draft.sourceFile,
        hint: "Add one or more card blocks to the file."
      })
    );
  }

  return {
    document: frontmatter
      ? {
          kind: "cards",
          sourceFile: state.draft.sourceFile,
          frontmatter,
          body: resolved.body,
          declaredTermIds: resolved.terms.map((record) => record.value.id),
          declaredGrammarIds: resolved.grammarPatterns.map(
            (record) => record.value.id
          ),
          declaredCardIds: resolved.cards.map((record) => record.value.id),
          referenceIds: dedupeStrings(
            resolved.references.map(
              (reference) => `${reference.referenceType}:${reference.targetId}`
            )
          )
        }
      : null,
    terms: resolved.terms,
    grammarPatterns: resolved.grammarPatterns,
    cards: resolved.cards,
    references: resolved.references
  };
}

function resolveMediaBody(
  state: ParsedDocumentState & {
    draft: ParsedDocumentDraft & { kind: "media" };
  },
  issues: ValidationIssue[]
): MarkdownDocument {
  const blocks: ContentBlock[] = [];

  for (const [index, block] of state.draft.body.blocks.entries()) {
    if (block.type === "structuredBlock") {
      const rawBlock = state.structuredBlocks[block.blockIndex];

      issues.push(
        createIssue({
          code: "structured-block.not-allowed",
          category: "schema",
          message: `Structured block '${rawBlock?.blockType ?? "unknown"}' is not allowed in media.md.`,
          filePath: state.draft.sourceFile,
          path: `body.blocks[${index}]`,
          range: rawBlock?.position,
          hint: "Keep media.md to metadata and free markdown content."
        })
      );
      continue;
    }

    blocks.push(block);
  }

  return {
    raw: state.draft.body.raw,
    blocks
  };
}

async function resolveStructuredBody(
  state: ParsedDocumentState,
  sourceContext: DocumentSourceContext,
  issues: ValidationIssue[],
  allowedBlockTypes: Set<string>
): Promise<{
  body: MarkdownDocument;
  terms: TermRecord[];
  grammarPatterns: GrammarRecord[];
  cards: CardRecord[];
  references: CollectedReference[];
}> {
  const blocks: ContentBlock[] = [];
  const terms: TermRecord[] = [];
  const grammarPatterns: GrammarRecord[] = [];
  const cards: CardRecord[] = [];
  const references = [...state.references];

  for (const [index, block] of state.draft.body.blocks.entries()) {
    const sourcePath = `body.blocks[${index}]`;

    if (block.type !== "structuredBlock") {
      blocks.push(block);
      continue;
    }

    const rawBlock = state.structuredBlocks[block.blockIndex];

    if (!rawBlock) {
      issues.push(
        createIssue({
          code: "structured-block.missing",
          category: "integrity",
          message:
            "Structured block could not be resolved from the markdown body.",
          filePath: state.draft.sourceFile,
          path: sourcePath
        })
      );
      continue;
    }

    if (!allowedBlockTypes.has(rawBlock.blockType)) {
      issues.push(
        createIssue({
          code: "structured-block.not-allowed",
          category: "schema",
          message: `Structured block '${rawBlock.blockType}' is not allowed in this file.`,
          filePath: state.draft.sourceFile,
          path: sourcePath,
          range: rawBlock.position
        })
      );
      continue;
    }

    if (rawBlock.blockType === "term") {
      const term = await normalizeTermBlock(
        rawBlock,
        sourceContext,
        sourcePath,
        issues
      );

      if (term) {
        const node: TermDefinitionBlock = {
          type: "termDefinition",
          position: rawBlock.position,
          entry: term.value
        };

        blocks.push(node);
        terms.push(term);
        references.push(...term.references);
      }

      continue;
    }

    if (rawBlock.blockType === "grammar") {
      const grammar = await normalizeGrammarBlock(
        rawBlock,
        sourceContext,
        sourcePath,
        issues
      );

      if (grammar) {
        const node: GrammarDefinitionBlock = {
          type: "grammarDefinition",
          position: rawBlock.position,
          entry: grammar.value
        };

        blocks.push(node);
        grammarPatterns.push(grammar);
        references.push(...grammar.references);
      }

      continue;
    }

    if (rawBlock.blockType === "card") {
      const card = normalizeCardBlock(
        rawBlock,
        sourceContext,
        sourcePath,
        issues
      );

      if (card) {
        const node: CardDefinitionBlock = {
          type: "cardDefinition",
          position: rawBlock.position,
          card: card.value
        };

        blocks.push(node);
        cards.push(card);
        references.push(...card.references);
      }

      continue;
    }

    if (rawBlock.blockType === "example_sentence") {
      const exampleSentence = normalizeExampleSentenceBlock(
        rawBlock,
        sourceContext,
        sourcePath,
        issues
      );

      if (exampleSentence) {
        blocks.push(exampleSentence.block);
        references.push(...exampleSentence.references);
      }

      continue;
    }

    if (rawBlock.blockType === "image") {
      const image = await normalizeImageBlock(
        rawBlock,
        sourceContext,
        sourcePath,
        issues
      );

      if (image) {
        blocks.push(image.block);
        references.push(...image.references);
      }

      continue;
    }

    issues.push(
      createIssue({
        code: "structured-block.unknown-type",
        category: "schema",
        message: `Unsupported structured block '${rawBlock.blockType}'.`,
        filePath: state.draft.sourceFile,
        path: sourcePath,
        range: rawBlock.position,
        hint: "Use supported structured blocks such as :::term, :::grammar, :::card, :::example_sentence, or :::image."
      })
    );
  }

  return {
    body: {
      raw: state.draft.body.raw,
      blocks
    },
    terms,
    grammarPatterns,
    cards,
    references
  };
}

function normalizeMediaFrontmatter(
  raw: Record<string, unknown> | null,
  filePath: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
): MediaFrontmatter | null {
  const scope = "frontmatter";

  if (!raw) {
    return null;
  }

  reportUnknownKeys(
    raw,
    [
      "id",
      "slug",
      "title",
      "media_type",
      "segment_kind",
      "language",
      "base_explanation_language",
      "subtitle",
      "description",
      "tags",
      "cover_image",
      "notes",
      "status"
    ],
    filePath,
    scope,
    issues
  );
  reportUnsafeYamlPlainScalars(
    raw,
    ["description", "notes"],
    filePath,
    scope,
    fieldRanges,
    fieldStyles,
    issues
  );

  const id = readRequiredString(raw, "id", filePath, scope, issues);
  const slug = readRequiredString(raw, "slug", filePath, scope, issues);
  const title = readRequiredString(raw, "title", filePath, scope, issues);
  const mediaType = readRequiredString(
    raw,
    "media_type",
    filePath,
    scope,
    issues
  );
  const segmentKind = readRequiredString(
    raw,
    "segment_kind",
    filePath,
    scope,
    issues
  );
  const language = readRequiredString(raw, "language", filePath, scope, issues);
  const baseExplanationLanguage = readRequiredString(
    raw,
    "base_explanation_language",
    filePath,
    scope,
    issues
  );
  const subtitle = readOptionalString(raw, "subtitle", filePath, scope, issues);
  const description = readOptionalString(
    raw,
    "description",
    filePath,
    scope,
    issues
  );
  const tags =
    readOptionalStringArray(raw, "tags", filePath, scope, issues) ?? [];
  const coverImage = readOptionalString(
    raw,
    "cover_image",
    filePath,
    scope,
    issues
  );
  const notes = readOptionalString(raw, "notes", filePath, scope, issues);
  const status = readOptionalString(raw, "status", filePath, scope, issues);

  if (slug && !isUrlSafeSlug(slug)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-slug",
        category: "schema",
        message: "Slug must be URL-safe.",
        filePath,
        path: `${scope}.slug`,
        hint: "Use a path-safe slug without spaces or slashes."
      })
    );
  }

  if (status && !(mediaStatusValues as readonly string[]).includes(status)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-status",
        category: "schema",
        message: `Invalid media status '${status}'.`,
        filePath,
        path: `${scope}.status`,
        hint: `Use one of: ${mediaStatusValues.join(", ")}.`
      })
    );
  }

  if (
    !id ||
    !slug ||
    !title ||
    !mediaType ||
    !segmentKind ||
    !language ||
    !baseExplanationLanguage
  ) {
    return null;
  }

  return {
    id,
    slug,
    title,
    mediaType,
    segmentKind,
    language,
    baseExplanationLanguage,
    subtitle: subtitle ?? undefined,
    description: description ?? undefined,
    status: status ?? undefined,
    tags,
    coverImage: coverImage ?? undefined,
    notes: notes ?? undefined
  };
}

function normalizeLessonFrontmatter(
  raw: Record<string, unknown> | null,
  filePath: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
): LessonFrontmatter | null {
  const scope = "frontmatter";

  if (!raw) {
    return null;
  }

  reportUnknownKeys(
    raw,
    [
      "id",
      "media_id",
      "slug",
      "title",
      "order",
      "segment_ref",
      "difficulty",
      "tags",
      "status",
      "summary",
      "prerequisites"
    ],
    filePath,
    scope,
    issues
  );
  reportUnsafeYamlPlainScalars(
    raw,
    ["summary"],
    filePath,
    scope,
    fieldRanges,
    fieldStyles,
    issues
  );

  const id = readRequiredString(raw, "id", filePath, scope, issues);
  const mediaId = readRequiredString(raw, "media_id", filePath, scope, issues);
  const slug = readRequiredString(raw, "slug", filePath, scope, issues);
  const title = readRequiredString(raw, "title", filePath, scope, issues);
  const order = readRequiredInteger(raw, "order", filePath, scope, issues);
  const segmentRef = readOptionalString(
    raw,
    "segment_ref",
    filePath,
    scope,
    issues
  );
  const difficulty = readOptionalString(
    raw,
    "difficulty",
    filePath,
    scope,
    issues
  );
  const tags =
    readOptionalStringArray(raw, "tags", filePath, scope, issues) ?? [];
  const status = readOptionalString(raw, "status", filePath, scope, issues);
  const summary = readOptionalString(raw, "summary", filePath, scope, issues);
  const prerequisites =
    readOptionalStringArray(raw, "prerequisites", filePath, scope, issues) ??
    [];

  if (summary && containsUnsupportedLessonSummaryMarkup(summary)) {
    issues.push(
      createIssue({
        code: "frontmatter.summary-plain-text-only",
        category: "schema",
        message:
          "Lesson summary must be plain text; semantic links, furigana markup, and inline code are rendered literally in the UI.",
        filePath,
        path: `${scope}.summary`,
        range: fieldRanges.summary,
        hint: "Rewrite the summary as plain text without semantic links, furigana markup, or backticks.",
        details: {
          field: "summary"
        }
      })
    );
  }

  if (slug && !isUrlSafeSlug(slug)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-slug",
        category: "schema",
        message: "Lesson slug must be URL-safe.",
        filePath,
        path: `${scope}.slug`
      })
    );
  }

  if (status && !(lessonStatusValues as readonly string[]).includes(status)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-status",
        category: "schema",
        message: `Invalid lesson status '${status}'.`,
        filePath,
        path: `${scope}.status`,
        hint: `Use one of: ${lessonStatusValues.join(", ")}.`
      })
    );
  }

  if (!id || !mediaId || !slug || !title || order === undefined) {
    return null;
  }

  return {
    id,
    mediaId,
    slug,
    title,
    order,
    segmentRef: segmentRef ?? undefined,
    difficulty: difficulty ?? undefined,
    tags,
    status: status ?? undefined,
    summary: summary ?? undefined,
    prerequisites
  };
}

function normalizeCardsFrontmatter(
  raw: Record<string, unknown> | null,
  filePath: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
): CardsFrontmatter | null {
  const scope = "frontmatter";

  if (!raw) {
    return null;
  }

  reportUnknownKeys(
    raw,
    ["id", "media_id", "slug", "title", "order", "segment_ref"],
    filePath,
    scope,
    issues
  );

  const id = readRequiredString(raw, "id", filePath, scope, issues);
  const mediaId = readRequiredString(raw, "media_id", filePath, scope, issues);
  const slug = readRequiredString(raw, "slug", filePath, scope, issues);
  const title = readRequiredString(raw, "title", filePath, scope, issues);
  const order = readRequiredInteger(raw, "order", filePath, scope, issues);
  const segmentRef = readOptionalString(
    raw,
    "segment_ref",
    filePath,
    scope,
    issues
  );

  if (slug && !isUrlSafeSlug(slug)) {
    issues.push(
      createIssue({
        code: "frontmatter.invalid-slug",
        category: "schema",
        message: "Cards slug must be URL-safe.",
        filePath,
        path: `${scope}.slug`
      })
    );
  }

  if (!id || !mediaId || !slug || !title || order === undefined) {
    return null;
  }

  return {
    id,
    mediaId,
    slug,
    title,
    order,
    segmentRef: segmentRef ?? undefined
  };
}

async function normalizeTermBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): Promise<TermRecord | null> {
  if (!rawBlock.data) {
    return null;
  }

  reportUnknownKeys(
    rawBlock.data,
    [
      "id",
      "cross_media_group",
      "lemma",
      "reading",
      "romaji",
      "meaning_it",
      "pos",
      "meaning_literal_it",
      "notes_it",
      "level_hint",
      "aliases",
      "segment_ref",
      "audio_src",
      "audio_source",
      "audio_speaker",
      "audio_license",
      "audio_attribution",
      "audio_page_url",
      "pitch_accent"
    ],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  reportUnsafeYamlPlainScalars(
    rawBlock.data,
    ["notes_it"],
    sourceContext.filePath,
    sourcePath,
    rawBlock.fieldRanges ?? {},
    rawBlock.fieldStyles ?? {},
    issues
  );

  const id = readRequiredString(
    rawBlock.data,
    "id",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const crossMediaGroup = readOptionalString(
    rawBlock.data,
    "cross_media_group",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const lemma = readRequiredString(
    rawBlock.data,
    "lemma",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const reading = readRequiredString(
    rawBlock.data,
    "reading",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const romaji = readRequiredString(
    rawBlock.data,
    "romaji",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const meaningIt = readRequiredString(
    rawBlock.data,
    "meaning_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const pos = readOptionalString(
    rawBlock.data,
    "pos",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const meaningLiteralIt = readOptionalString(
    rawBlock.data,
    "meaning_literal_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const notesIt = readOptionalString(
    rawBlock.data,
    "notes_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const levelHint = readOptionalString(
    rawBlock.data,
    "level_hint",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const aliases =
    readOptionalStringArray(
      rawBlock.data,
      "aliases",
      sourceContext.filePath,
      sourcePath,
      issues,
      rawBlock.position
    ) ?? [];
  const segmentRef = readOptionalString(
    rawBlock.data,
    "segment_ref",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const audio = await normalizeEntryAudioMetadata({
    filePath: sourceContext.filePath,
    mediaDirectory: sourceContext.mediaDirectory,
    range: rawBlock.position,
    sourcePath,
    values: rawBlock.data
  });
  const pitchAccent = readOptionalPitchAccent(
    rawBlock.data,
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );

  issues.push(...audio.issues);

  if (crossMediaGroup && !isUrlSafeSlug(crossMediaGroup)) {
    issues.push(
      createIssue({
        code: "structured-block.invalid-cross-media-group",
        category: "schema",
        message:
          "Field 'cross_media_group' must use a URL-safe slug-like identifier.",
        filePath: sourceContext.filePath,
        path: `${sourcePath}.cross_media_group`,
        range: rawBlock.fieldRanges?.cross_media_group ?? rawBlock.position,
        hint: "Use lowercase ASCII with numbers and hyphens, for example 'shared-cost-ui'."
      })
    );
  }

  if (!id || !lemma || !reading || !romaji || !meaningIt) {
    return null;
  }

  const notesRange = rawBlock.fieldRanges?.notes_it ?? rawBlock.position;
  const notesFragment = notesIt
    ? parseInlineFragment({
        source: notesIt,
        filePath: sourceContext.filePath,
        documentKind: sourceContext.documentKind,
        documentId: sourceContext.documentId,
        sourcePath: `${sourcePath}.notes_it`,
        fragmentOrigin: notesRange?.start,
        fallbackRange: notesRange
      })
    : null;

  issues.push(...(notesFragment?.issues ?? []));

  return {
    value: {
      kind: "term",
      id,
      crossMediaGroup: crossMediaGroup ?? undefined,
      lemma,
      reading,
      romaji,
      meaningIt,
      pos: pos ?? undefined,
      meaningLiteralIt: meaningLiteralIt ?? undefined,
      notesIt: notesFragment?.fragment,
      levelHint: levelHint ?? undefined,
      aliases,
      segmentRef: segmentRef ?? undefined,
      audio: audio.value ?? undefined,
      pitchAccent,
      source: {
        filePath: sourceContext.filePath,
        documentId: sourceContext.documentId,
        documentKind: sourceContext.documentKind,
        documentOrder: sourceContext.documentOrder,
        sequence: rawBlock.index,
        segmentRef: sourceContext.documentSegmentRef
      }
    },
    sourcePath,
    position: rawBlock.position,
    references: notesFragment?.references ?? []
  };
}

async function normalizeGrammarBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): Promise<GrammarRecord | null> {
  if (!rawBlock.data) {
    return null;
  }

  reportUnknownKeys(
    rawBlock.data,
    [
      "id",
      "cross_media_group",
      "pattern",
      "title",
      "reading",
      "meaning_it",
      "notes_it",
      "level_hint",
      "aliases",
      "segment_ref",
      "audio_src",
      "audio_source",
      "audio_speaker",
      "audio_license",
      "audio_attribution",
      "audio_page_url",
      "pitch_accent"
    ],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  reportUnsafeYamlPlainScalars(
    rawBlock.data,
    ["notes_it"],
    sourceContext.filePath,
    sourcePath,
    rawBlock.fieldRanges ?? {},
    rawBlock.fieldStyles ?? {},
    issues
  );

  const id = readRequiredString(
    rawBlock.data,
    "id",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const crossMediaGroup = readOptionalString(
    rawBlock.data,
    "cross_media_group",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const pattern = readRequiredString(
    rawBlock.data,
    "pattern",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const title = readRequiredString(
    rawBlock.data,
    "title",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const meaningIt = readRequiredString(
    rawBlock.data,
    "meaning_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const reading = readOptionalString(
    rawBlock.data,
    "reading",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const notesIt = readOptionalString(
    rawBlock.data,
    "notes_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const levelHint = readOptionalString(
    rawBlock.data,
    "level_hint",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const aliases =
    readOptionalStringArray(
      rawBlock.data,
      "aliases",
      sourceContext.filePath,
      sourcePath,
      issues,
      rawBlock.position
    ) ?? [];
  const segmentRef = readOptionalString(
    rawBlock.data,
    "segment_ref",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const audio = await normalizeEntryAudioMetadata({
    filePath: sourceContext.filePath,
    mediaDirectory: sourceContext.mediaDirectory,
    range: rawBlock.position,
    sourcePath,
    values: rawBlock.data
  });
  const pitchAccent = readOptionalPitchAccent(
    rawBlock.data,
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );

  issues.push(...audio.issues);

  if (crossMediaGroup && !isUrlSafeSlug(crossMediaGroup)) {
    issues.push(
      createIssue({
        code: "structured-block.invalid-cross-media-group",
        category: "schema",
        message:
          "Field 'cross_media_group' must use a URL-safe slug-like identifier.",
        filePath: sourceContext.filePath,
        path: `${sourcePath}.cross_media_group`,
        range: rawBlock.fieldRanges?.cross_media_group ?? rawBlock.position,
        hint: "Use lowercase ASCII with numbers and hyphens, for example 'shared-cost-ui'."
      })
    );
  }

  if (!id || !pattern || !title || !meaningIt) {
    return null;
  }

  const notesRange = rawBlock.fieldRanges?.notes_it ?? rawBlock.position;
  const notesFragment = notesIt
    ? parseInlineFragment({
        source: notesIt,
        filePath: sourceContext.filePath,
        documentKind: sourceContext.documentKind,
        documentId: sourceContext.documentId,
        sourcePath: `${sourcePath}.notes_it`,
        fragmentOrigin: notesRange?.start,
        fallbackRange: notesRange
      })
    : null;

  issues.push(...(notesFragment?.issues ?? []));

  return {
    value: {
      kind: "grammar",
      id,
      crossMediaGroup: crossMediaGroup ?? undefined,
      pattern,
      title,
      reading: reading ?? undefined,
      meaningIt,
      notesIt: notesFragment?.fragment,
      levelHint: levelHint ?? undefined,
      aliases,
      segmentRef: segmentRef ?? undefined,
      audio: audio.value ?? undefined,
      pitchAccent,
      source: {
        filePath: sourceContext.filePath,
        documentId: sourceContext.documentId,
        documentKind: sourceContext.documentKind,
        documentOrder: sourceContext.documentOrder,
        sequence: rawBlock.index,
        segmentRef: sourceContext.documentSegmentRef
      }
    },
    sourcePath,
    position: rawBlock.position,
    references: notesFragment?.references ?? []
  };
}

function normalizeCardBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): (CardRecord & { references: CollectedReference[] }) | null {
  if (!rawBlock.data) {
    return null;
  }

  reportUnknownKeys(
    rawBlock.data,
    [
      "id",
      "entry_type",
      "entry_id",
      "card_type",
      "front",
      "back",
      "example_jp",
      "example_it",
      "tags",
      "notes_it"
    ],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  reportUnsafeYamlPlainScalars(
    rawBlock.data,
    ["front", "back", "example_jp", "example_it", "notes_it"],
    sourceContext.filePath,
    sourcePath,
    rawBlock.fieldRanges ?? {},
    rawBlock.fieldStyles ?? {},
    issues
  );

  const id = readRequiredString(
    rawBlock.data,
    "id",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const entryType = readRequiredString(
    rawBlock.data,
    "entry_type",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const entryId = readRequiredString(
    rawBlock.data,
    "entry_id",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const cardType = readRequiredString(
    rawBlock.data,
    "card_type",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const front = readRequiredString(
    rawBlock.data,
    "front",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const back = readRequiredString(
    rawBlock.data,
    "back",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const tags =
    readOptionalStringArray(
      rawBlock.data,
      "tags",
      sourceContext.filePath,
      sourcePath,
      issues,
      rawBlock.position
    ) ?? [];
  const notesIt = readOptionalString(
    rawBlock.data,
    "notes_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const exampleJp = readOptionalString(
    rawBlock.data,
    "example_jp",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const exampleIt = readOptionalString(
    rawBlock.data,
    "example_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );

  if ((exampleJp && !exampleIt) || (!exampleJp && exampleIt)) {
    issues.push(
      createIssue({
        code: "schema.card-example-pair",
        category: "schema",
        message:
          "Card example fields must provide both 'example_jp' and 'example_it'.",
        filePath: sourceContext.filePath,
        path: sourcePath,
        range: rawBlock.position,
        hint: "Either omit the example entirely or provide both the Japanese sentence and the Italian translation."
      })
    );
  }

  if (
    entryType &&
    !entryTypeValues.includes(entryType as (typeof entryTypeValues)[number])
  ) {
    issues.push(
      createIssue({
        code: "structured-block.invalid-entry-type",
        category: "schema",
        message: `Card entry_type '${entryType}' is not supported.`,
        filePath: sourceContext.filePath,
        path: `${sourcePath}.entry_type`,
        range: rawBlock.position,
        hint: `Use one of: ${entryTypeValues.join(", ")}.`
      })
    );
  }

  if (!id || !entryType || !entryId || !cardType || !front || !back) {
    return null;
  }

  const frontRange = rawBlock.fieldRanges?.front ?? rawBlock.position;
  const backRange = rawBlock.fieldRanges?.back ?? rawBlock.position;
  const exampleJpRange = rawBlock.fieldRanges?.example_jp ?? rawBlock.position;
  const exampleItRange = rawBlock.fieldRanges?.example_it ?? rawBlock.position;
  const notesRange = rawBlock.fieldRanges?.notes_it ?? rawBlock.position;
  const frontFragment = parseInlineFragment({
    source: front,
    filePath: sourceContext.filePath,
    documentKind: sourceContext.documentKind,
    documentId: sourceContext.documentId,
    sourcePath: `${sourcePath}.front`,
    fragmentOrigin: frontRange?.start,
    fallbackRange: frontRange
  });
  const backFragment = parseInlineFragment({
    source: back,
    filePath: sourceContext.filePath,
    documentKind: sourceContext.documentKind,
    documentId: sourceContext.documentId,
    sourcePath: `${sourcePath}.back`,
    fragmentOrigin: backRange?.start,
    fallbackRange: backRange
  });
  const notesFragment = notesIt
    ? parseInlineFragment({
        source: notesIt,
        filePath: sourceContext.filePath,
        documentKind: sourceContext.documentKind,
        documentId: sourceContext.documentId,
        sourcePath: `${sourcePath}.notes_it`,
        fragmentOrigin: notesRange?.start,
        fallbackRange: notesRange
      })
    : null;
  const exampleJpFragment =
    exampleJp && exampleIt
      ? parseInlineFragment({
          source: exampleJp,
          filePath: sourceContext.filePath,
          documentKind: sourceContext.documentKind,
          documentId: sourceContext.documentId,
          sourcePath: `${sourcePath}.example_jp`,
          fragmentOrigin: exampleJpRange?.start,
          fallbackRange: exampleJpRange
        })
      : null;
  const exampleItFragment =
    exampleJp && exampleIt
      ? parseInlineFragment({
          source: exampleIt,
          filePath: sourceContext.filePath,
          documentKind: sourceContext.documentKind,
          documentId: sourceContext.documentId,
          sourcePath: `${sourcePath}.example_it`,
          fragmentOrigin: exampleItRange?.start,
          fallbackRange: exampleItRange
        })
      : null;

  issues.push(
    ...frontFragment.issues,
    ...backFragment.issues,
    ...(exampleJpFragment?.issues ?? []),
    ...(exampleItFragment?.issues ?? []),
    ...(notesFragment?.issues ?? [])
  );

  return {
    value: {
      kind: "card",
      id,
      entryType: entryType as (typeof entryTypeValues)[number],
      entryId,
      cardType,
      front: frontFragment.fragment,
      back: backFragment.fragment,
      exampleJp: exampleJpFragment?.fragment,
      exampleIt: exampleItFragment?.fragment,
      notesIt: notesFragment?.fragment,
      tags,
      source: {
        filePath: sourceContext.filePath,
        documentId: sourceContext.documentId,
        documentKind: sourceContext.documentKind,
        documentOrder: sourceContext.documentOrder,
        sequence: rawBlock.index,
        segmentRef: sourceContext.documentSegmentRef
      }
    },
    sourcePath,
    position: rawBlock.position,
    references: [
      ...frontFragment.references,
      ...backFragment.references,
      ...(exampleJpFragment?.references ?? []),
      ...(exampleItFragment?.references ?? []),
      ...(notesFragment?.references ?? [])
    ]
  };
}

function normalizeExampleSentenceBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): { block: ExampleSentenceBlock; references: CollectedReference[] } | null {
  if (!rawBlock.data) {
    return null;
  }

  reportUnknownKeys(
    rawBlock.data,
    ["jp", "translation_it", "reveal_mode"],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  reportUnsafeYamlPlainScalars(
    rawBlock.data,
    ["jp", "translation_it"],
    sourceContext.filePath,
    sourcePath,
    rawBlock.fieldRanges ?? {},
    rawBlock.fieldStyles ?? {},
    issues
  );

  const sentence = readRequiredString(
    rawBlock.data,
    "jp",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const translationIt = readRequiredString(
    rawBlock.data,
    "translation_it",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const revealMode = readOptionalString(
    rawBlock.data,
    "reveal_mode",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );

  if (!sentence || !translationIt) {
    return null;
  }

  if (
    revealMode !== undefined &&
    revealMode !== "default" &&
    revealMode !== "sentence"
  ) {
    issues.push(
      createIssue({
        code: "schema.invalid-enum",
        category: "schema",
        message:
          "Field 'reveal_mode' must be either 'default' or 'sentence'.",
        filePath: sourceContext.filePath,
        path: `${sourcePath}.reveal_mode`,
        range: rawBlock.fieldRanges?.reveal_mode ?? rawBlock.position
      })
    );
  }

  const sentenceRange = rawBlock.fieldRanges?.jp ?? rawBlock.position;
  const translationRange =
    rawBlock.fieldRanges?.translation_it ?? rawBlock.position;
  const sentenceFragment = parseInlineFragment({
    source: sentence,
    filePath: sourceContext.filePath,
    documentKind: sourceContext.documentKind,
    documentId: sourceContext.documentId,
    sourcePath: `${sourcePath}.jp`,
    fragmentOrigin: sentenceRange?.start,
    fallbackRange: sentenceRange
  });
  const translationFragment = parseInlineFragment({
    source: translationIt,
    filePath: sourceContext.filePath,
    documentKind: sourceContext.documentKind,
    documentId: sourceContext.documentId,
    sourcePath: `${sourcePath}.translation_it`,
    fragmentOrigin: translationRange?.start,
    fallbackRange: translationRange
  });

  issues.push(...sentenceFragment.issues, ...translationFragment.issues);

  return {
    block: {
      type: "exampleSentence",
      position: rawBlock.position,
      sentence: sentenceFragment.fragment,
      translationIt: translationFragment.fragment,
      revealMode:
        revealMode === "default" || revealMode === "sentence"
          ? revealMode
          : undefined
    },
    references: [
      ...sentenceFragment.references,
      ...translationFragment.references
    ]
  };
}

async function normalizeImageBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): Promise<{ block: ImageBlock; references: CollectedReference[] } | null> {
  if (!rawBlock.data) {
    return null;
  }

  reportUnknownKeys(
    rawBlock.data,
    ["src", "alt", "card_id", "caption"],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  reportUnsafeYamlPlainScalars(
    rawBlock.data,
    ["caption"],
    sourceContext.filePath,
    sourcePath,
    rawBlock.fieldRanges ?? {},
    rawBlock.fieldStyles ?? {},
    issues
  );

  const src = readRequiredString(
    rawBlock.data,
    "src",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const alt = readRequiredString(
    rawBlock.data,
    "alt",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const caption = readOptionalString(
    rawBlock.data,
    "caption",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );
  const cardId = readOptionalString(
    rawBlock.data,
    "card_id",
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );

  if (!src || !alt) {
    return null;
  }

  if (!isValidMediaAssetPath(src) || !src.startsWith("assets/")) {
    issues.push(
      createIssue({
        code: "image.invalid-src",
        category: "schema",
        message:
          "Image src must be a relative media asset path rooted at assets/.",
        filePath: sourceContext.filePath,
        path: `${sourcePath}.src`,
        range: rawBlock.fieldRanges?.src ?? rawBlock.position,
        hint: "Use paths like assets/duel-plays/deck-edit.webp."
      })
    );
    return null;
  }

  if (!isSupportedImageAssetPath(src)) {
    issues.push(
      createIssue({
        code: "image.unsupported-extension",
        category: "schema",
        message: "Image src must point to a supported image format.",
        filePath: sourceContext.filePath,
        path: `${sourcePath}.src`,
        range: rawBlock.fieldRanges?.src ?? rawBlock.position,
        hint: "Use png, jpg, jpeg, webp, gif, svg, or avif files."
      })
    );
    return null;
  }

  const resolvedAssetPath = resolveMediaAssetAbsolutePath(
    sourceContext.mediaDirectory,
    src
  );

  if (
    !isWithinMediaAssetRoot(
      resolvedAssetPath.assetRoot,
      resolvedAssetPath.absolutePath
    )
  ) {
    issues.push(
      createIssue({
        code: "image.invalid-src",
        category: "schema",
        message:
          "Image src escapes the media asset directory and is not allowed.",
        filePath: sourceContext.filePath,
        path: `${sourcePath}.src`,
        range: rawBlock.fieldRanges?.src ?? rawBlock.position
      })
    );
    return null;
  }

  const assetExists = await fileExists(resolvedAssetPath.absolutePath);

  if (!assetExists) {
    issues.push(
      createIssue({
        code: "image.missing-asset",
        category: "integrity",
        message: `Image asset '${src}' does not exist in this media bundle.`,
        filePath: sourceContext.filePath,
        path: `${sourcePath}.src`,
        range: rawBlock.fieldRanges?.src ?? rawBlock.position,
        hint: "Add the file under content/media/<slug>/assets/ or fix the src path."
      })
    );
    return null;
  }

  const captionRange = rawBlock.fieldRanges?.caption ?? rawBlock.position;
  const captionFragment =
    typeof caption === "string"
      ? parseInlineFragment({
          source: caption,
          filePath: sourceContext.filePath,
          documentKind: sourceContext.documentKind,
          documentId: sourceContext.documentId,
          sourcePath: `${sourcePath}.caption`,
          fragmentOrigin: captionRange?.start,
          fallbackRange: captionRange
        })
      : null;

  issues.push(...(captionFragment?.issues ?? []));
  reportImageAltKanjiIssue(
    alt,
    sourceContext.filePath,
    `${sourcePath}.alt`,
    rawBlock.fieldRanges?.alt ?? rawBlock.position,
    issues
  );

  if (captionFragment) {
    reportImageCaptionKanjiIssue(
      captionFragment.fragment.nodes,
      sourceContext.filePath,
      `${sourcePath}.caption`,
      captionRange,
      issues
    );
  }

  return {
    block: {
      type: "image",
      position: rawBlock.position,
      src,
      alt,
      cardId: cardId ?? undefined,
      caption: captionFragment?.fragment
    },
    references: [...(captionFragment?.references ?? [])]
  };
}

const bareKanjiPattern = /\p{Script=Han}/u;

function reportImageAltKanjiIssue(
  alt: string,
  filePath: string,
  sourcePath: string,
  range: SourceRange | undefined,
  issues: ValidationIssue[]
) {
  if (!bareKanjiPattern.test(alt)) {
    return;
  }

  issues.push(
    createIssue({
      code: "image.alt-bare-kanji",
      category: "schema",
      message:
        "Image alt text contains kanji, but alt strings cannot render furigana or semantic references.",
      filePath,
      path: sourcePath,
      range,
      hint: "Rewrite the alt in Italian or with kana/katakana only; keep kanji support in the visible caption instead."
    })
  );
}

function reportImageCaptionKanjiIssue(
  nodes: InlineNode[],
  filePath: string,
  sourcePath: string,
  range: SourceRange | undefined,
  issues: ValidationIssue[]
) {
  if (!inlineNodesContainBareKanji(nodes)) {
    return;
  }

  issues.push(
    createIssue({
      code: "image.caption-bare-kanji",
      category: "schema",
      message:
        "Image caption contains visible kanji outside furigana markup.",
      filePath,
      path: sourcePath,
      range,
      hint: "Annotate visible labels with furigana, or use a semantic reference whose label is fully annotated, for example [{{報酬確認|ほうしゅうかくにん}}](term:...)."
    })
  );
}

function inlineNodesContainBareKanji(nodes: InlineNode[]): boolean {
  return nodes.some((node) => {
    switch (node.type) {
      case "text":
        return bareKanjiPattern.test(node.value);
      case "furigana":
      case "break":
        return false;
      case "reference":
      case "emphasis":
      case "strong":
      case "inlineCode":
      case "link":
        return inlineNodesContainBareKanji(node.children);
    }
  });
}

function validateDuplicateIds(
  input: {
    media: ParsedDocumentState[];
    lessons: ParsedDocumentState[];
    cardFiles: ParsedDocumentState[];
  },
  issues: ValidationIssue[]
) {
  const registry = new Map<
    string,
    Array<{ filePath: string; path: string; range?: SourceRange }>
  >();

  const register = (
    namespace: string,
    id: string | undefined,
    filePath: string,
    idPath: string,
    range?: SourceRange
  ) => {
    if (!id) {
      return;
    }

    const key = `${namespace}:${id}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({ filePath, path: idPath, range });
    registry.set(key, occurrences);
  };

  for (const state of input.media) {
    register("media", state.rawId, state.draft.sourceFile, "frontmatter.id");
  }

  for (const state of input.lessons) {
    register("lesson", state.rawId, state.draft.sourceFile, "frontmatter.id");

    for (const block of state.structuredBlocks) {
      if (block.blockType === "term") {
        register(
          "term",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }

      if (block.blockType === "grammar") {
        register(
          "grammar",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }
    }
  }

  for (const state of input.cardFiles) {
    register(
      "cards-file",
      state.rawId,
      state.draft.sourceFile,
      "frontmatter.id"
    );

    for (const block of state.structuredBlocks) {
      if (block.blockType === "term") {
        register(
          "term",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }

      if (block.blockType === "grammar") {
        register(
          "grammar",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }

      if (block.blockType === "card") {
        register(
          "card",
          asString(block.data?.id),
          state.draft.sourceFile,
          `structuredBlocks[${block.index}].id`,
          block.position
        );
      }
    }
  }

  for (const [key, occurrences] of registry.entries()) {
    if (occurrences.length < 2) {
      continue;
    }

    const [namespace, id] = key.split(":");
    const first = occurrences[0];

    issues.push(
      createIssue({
        code: "id.duplicate",
        category: "integrity",
        message: `Duplicate ${namespace} id '${id}' found in content files.`,
        filePath: first?.filePath ?? "",
        path: first?.path,
        range: first?.range,
        hint: "Keep IDs unique within their content namespace.",
        details: {
          namespace,
          id,
          count: occurrences.length
        }
      })
    );
  }
}

function validateWorkspaceDuplicateIds(
  bundles: NormalizedMediaBundle[],
  issues: ValidationIssue[]
) {
  const registry = new Map<
    string,
    Array<{
      mediaDirectory: string;
      filePath: string;
      path: string;
      range?: SourceRange;
    }>
  >();

  const register = (
    mediaDirectory: string,
    namespace: string,
    id: string | undefined,
    filePath: string,
    idPath: string,
    range?: SourceRange
  ) => {
    if (!id) {
      return;
    }

    const key = `${namespace}:${id}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({
      mediaDirectory,
      filePath,
      path: idPath,
      range
    });
    registry.set(key, occurrences);
  };

  for (const bundle of bundles) {
    if (bundle.media) {
      register(
        bundle.mediaDirectory,
        "media",
        bundle.media.frontmatter.id,
        bundle.media.sourceFile,
        "frontmatter.id"
      );
    }

    for (const lesson of bundle.lessons) {
      register(
        bundle.mediaDirectory,
        "lesson",
        lesson.frontmatter.id,
        lesson.sourceFile,
        "frontmatter.id"
      );
      registerDefinitionIds(
        bundle.mediaDirectory,
        lesson.sourceFile,
        lesson.body.blocks,
        registry
      );
    }

    for (const cardsFile of bundle.cardFiles) {
      register(
        bundle.mediaDirectory,
        "cards-file",
        cardsFile.frontmatter.id,
        cardsFile.sourceFile,
        "frontmatter.id"
      );
      registerDefinitionIds(
        bundle.mediaDirectory,
        cardsFile.sourceFile,
        cardsFile.body.blocks,
        registry
      );
    }
  }

  for (const [key, occurrences] of registry.entries()) {
    if (occurrences.length < 2) {
      continue;
    }

    const mediaDirectories = new Set(
      occurrences.map((occurrence) => occurrence.mediaDirectory)
    );

    if (mediaDirectories.size < 2) {
      continue;
    }

    const separatorIndex = key.indexOf(":");
    const namespace = key.slice(0, separatorIndex);
    const id = key.slice(separatorIndex + 1);

    if (namespace === "term" || namespace === "grammar") {
      continue;
    }

    const first = occurrences[0];

    issues.push(
      createIssue({
        code: "id.duplicate",
        category: "integrity",
        message: `Duplicate ${namespace} id '${id}' found across media bundles.`,
        filePath: first?.filePath ?? "",
        path: first?.path,
        range: first?.range,
        hint: "Keep IDs unique across the entire content workspace.",
        details: {
          namespace,
          id,
          count: occurrences.length,
          mediaBundleCount: mediaDirectories.size
        }
      })
    );
  }

  validateCrossMediaGroupUsage(bundles, issues);
}

function validateCrossMediaGroupUsage(
  bundles: NormalizedMediaBundle[],
  issues: ValidationIssue[]
) {
  const registry = new Map<
    string,
    Array<{
      entryId: string;
      filePath: string;
      mediaId: string | undefined;
      mediaSlug: string;
      path: string;
      range?: SourceRange;
    }>
  >();

  const register = (input: {
    entryId: string;
    entryType: "term" | "grammar";
    filePath: string;
    groupKey?: string;
    mediaId: string | undefined;
    mediaSlug: string;
    path: string;
    range?: SourceRange;
  }) => {
    if (!input.groupKey) {
      return;
    }

    const key = `${input.entryType}:${input.groupKey}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({
      entryId: input.entryId,
      filePath: input.filePath,
      mediaId: input.mediaId,
      mediaSlug: input.mediaSlug,
      path: input.path,
      range: input.range
    });
    registry.set(key, occurrences);
  };

  for (const bundle of bundles) {
    const mediaId = bundle.media?.frontmatter.id;

    for (const lesson of bundle.lessons) {
      for (const [index, block] of lesson.body.blocks.entries()) {
        if (block.type === "termDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "term",
            filePath: lesson.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }

        if (block.type === "grammarDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "grammar",
            filePath: lesson.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }
      }
    }

    for (const cardsFile of bundle.cardFiles) {
      for (const [index, block] of cardsFile.body.blocks.entries()) {
        if (block.type === "termDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "term",
            filePath: cardsFile.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }

        if (block.type === "grammarDefinition") {
          register({
            entryId: block.entry.id,
            entryType: "grammar",
            filePath: cardsFile.sourceFile,
            groupKey: block.entry.crossMediaGroup,
            mediaId,
            mediaSlug: bundle.mediaSlug,
            path: `body.blocks[${index}].entry.cross_media_group`,
            range: block.position
          });
        }
      }
    }
  }

  const groupKeyTypes = new Map<string, Set<"term" | "grammar">>();

  for (const key of registry.keys()) {
    const separatorIndex = key.indexOf(":");
    const entryType = key.slice(0, separatorIndex) as "term" | "grammar";
    const groupKey = key.slice(separatorIndex + 1);
    const types = groupKeyTypes.get(groupKey) ?? new Set<"term" | "grammar">();

    types.add(entryType);
    groupKeyTypes.set(groupKey, types);
  }

  for (const [groupKey, entryTypes] of groupKeyTypes.entries()) {
    if (entryTypes.size < 2) {
      continue;
    }

    const firstType = [...entryTypes][0];
    const firstOccurrence = registry.get(`${firstType}:${groupKey}`)?.[0];

    issues.push(
      createIssue({
        code: "cross-media-group.entry-type-mismatch",
        category: "integrity",
        message: `Cross-media group '${groupKey}' cannot mix term and grammar entries.`,
        filePath: firstOccurrence?.filePath ?? "",
        path: firstOccurrence?.path,
        range: firstOccurrence?.range,
        hint: "Reuse the same cross_media_group only for the same entry kind across different media."
      })
    );
  }

  for (const [key, occurrences] of registry.entries()) {
    const [entryType, groupKey] = key.split(":");
    const mediaKeys = new Map<string, (typeof occurrences)[number][]>();

    for (const occurrence of occurrences) {
      const mediaKey = occurrence.mediaId ?? occurrence.mediaSlug;
      const rows = mediaKeys.get(mediaKey) ?? [];
      rows.push(occurrence);
      mediaKeys.set(mediaKey, rows);
    }

    for (const mediaOccurrences of mediaKeys.values()) {
      if (mediaOccurrences.length < 2) {
        continue;
      }

      const first = mediaOccurrences[0];

      issues.push(
        createIssue({
          code: "cross-media-group.duplicate-media-entry",
          category: "integrity",
          message: `Cross-media group '${groupKey}' has multiple ${entryType} entries in the same media.`,
          filePath: first?.filePath ?? "",
          path: first?.path,
          range: first?.range,
          hint: "Keep at most one local entry per media inside the same cross-media group."
        })
      );
    }
  }
}

function registerDefinitionIds(
  mediaDirectory: string,
  sourceFile: string,
  blocks: ContentBlock[],
  registry: Map<
    string,
    Array<{
      mediaDirectory: string;
      filePath: string;
      path: string;
      range?: SourceRange;
    }>
  >
) {
  for (const [index, block] of blocks.entries()) {
    let namespace: string | null = null;
    let id: string | undefined;
    let idPath: string | undefined;

    if (block.type === "termDefinition") {
      namespace = "term";
      id = block.entry.id;
      idPath = `body.blocks[${index}].entry.id`;
    } else if (block.type === "grammarDefinition") {
      namespace = "grammar";
      id = block.entry.id;
      idPath = `body.blocks[${index}].entry.id`;
    } else if (block.type === "cardDefinition") {
      namespace = "card";
      id = block.card.id;
      idPath = `body.blocks[${index}].card.id`;
    }

    if (!namespace || !id || !idPath) {
      continue;
    }

    const key = `${namespace}:${id}`;
    const occurrences = registry.get(key) ?? [];
    occurrences.push({
      mediaDirectory,
      filePath: sourceFile,
      path: idPath,
      range: block.position
    });
    registry.set(key, occurrences);
  }
}

function validateReferences(
  terms: TermRecord[],
  grammarPatterns: GrammarRecord[],
  cards: CardRecord[],
  references: CollectedReference[],
  issues: ValidationIssue[]
) {
  const termIds = new Set(terms.map((record) => record.value.id));
  const grammarIds = new Set(grammarPatterns.map((record) => record.value.id));

  for (const reference of references) {
    const exists =
      reference.referenceType === "term"
        ? termIds.has(reference.targetId)
        : grammarIds.has(reference.targetId);

    if (!exists) {
      issues.push(
        createIssue({
          code: "reference.missing-target",
          category: "reference",
          message: `Reference target '${reference.referenceType}:${reference.targetId}' does not exist.`,
          filePath: reference.sourceFile,
          path: reference.sourcePath,
          range: reference.location,
          hint: "Declare the target entry with a matching :::term or :::grammar block."
        })
      );
    }
  }

  for (const card of cards) {
    const exists =
      card.value.entryType === "term"
        ? termIds.has(card.value.entryId)
        : grammarIds.has(card.value.entryId);

    if (!exists) {
      issues.push(
        createIssue({
          code: "card.missing-entry",
          category: "reference",
          message: `Card '${card.value.id}' points to missing entry '${card.value.entryType}:${card.value.entryId}'.`,
          filePath: card.value.source.filePath,
          path: `${card.sourcePath}.entry_id`,
          range: card.position,
          hint: "Create the referenced entry or point the card to an existing term/grammar ID."
        })
      );
    }
  }
}

function reportUnsafeYamlPlainScalars(
  raw: Record<string, unknown>,
  keys: string[],
  filePath: string,
  pathPrefix: string,
  fieldRanges: Record<string, SourceRange>,
  fieldStyles: Record<string, string>,
  issues: ValidationIssue[]
) {
  for (const key of keys) {
    const value = raw[key];
    const reason =
      typeof value === "string"
        ? getUnsafeYamlPlainScalarReason(key, value)
        : null;

    if (
      typeof value !== "string" ||
      fieldStyles[key] !== "PLAIN" ||
      reason === null
    ) {
      continue;
    }

    issues.push(
      createIssue({
        code: "yaml.unsafe-plain-scalar",
        category: "syntax",
        message: formatUnsafeYamlPlainScalarMessage(key, reason.kind),
        filePath,
        path: `${pathPrefix}.${key}`,
        range: fieldRanges[key],
        hint: formatUnsafeYamlPlainScalarHint(key, reason.kind),
        details: {
          field: key,
          scalarStyle: "plain",
          reason: reason.kind
        }
      })
    );
  }
}

function getUnsafeYamlPlainScalarReason(key: string, value: string) {
  if (usesDescriptivePlainScalar(key, value)) {
    return {
      kind: "descriptive-prose" as const
    };
  }

  if (containsUnsafeInlineYamlContent(value)) {
    return {
      kind: "markdown-rich" as const
    };
  }

  if (isCardTextExamplePlainScalar(key, value)) {
    return {
      kind: "card-text-example" as const
    };
  }

  return null;
}

function usesDescriptivePlainScalar(key: string, value: string) {
  return (
    ["notes_it", "summary", "description", "notes"].includes(key) &&
    value.trim().length > 0
  );
}

function containsUnsafeInlineYamlContent(value: string) {
  return (
    value.includes(":") ||
    value.includes("：") ||
    /\{\{[^|}]+\|[^}]+\}\}/.test(value) ||
    /\[[^\]]+\]\((?:term|grammar):[^)]+\)/.test(value) ||
    /`[^`]+`/.test(value)
  );
}

function containsUnsupportedLessonSummaryMarkup(value: string) {
  return (
    /\[[^\]]+\]\((?:term|grammar):[^)]+\)/.test(value) ||
    /\{\{[^|}]+\|[^}]+\}\}/.test(value) ||
    /`[^`]+`/.test(value)
  );
}

function isCardTextExamplePlainScalar(key: string, value: string) {
  if (
    key !== "front" &&
    key !== "back" &&
    key !== "example_jp" &&
    key !== "example_it"
  ) {
    return false;
  }

  return (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value) &&
    (/[。！？]/u.test(value) || (value.includes("、") && value.length >= 12))
  );
}

function formatUnsafeYamlPlainScalarMessage(
  key: string,
  reason: "descriptive-prose" | "markdown-rich" | "card-text-example"
) {
  if (reason === "descriptive-prose") {
    return `Field '${key}' uses a plain YAML scalar for descriptive prose.`;
  }

  if (reason === "card-text-example") {
    return `Field '${key}' uses a plain YAML scalar for a full card-text example.`;
  }

  return `Field '${key}' uses a plain YAML scalar that is fragile for markdown-rich content.`;
}

function formatUnsafeYamlPlainScalarHint(
  key: string,
  reason: "descriptive-prose" | "markdown-rich" | "card-text-example"
) {
  if (reason === "card-text-example") {
    return `Rewrite '${key}' as a block scalar with >- when embedding full rules-text examples.`;
  }

  return `Rewrite '${key}' as a block scalar with >- to keep the value stable.`;
}

function reportUnknownKeys(
  raw: Record<string, unknown>,
  allowedKeys: string[],
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(raw)) {
    if (allowed.has(key)) {
      continue;
    }

    issues.push(
      createIssue({
        code: "schema.unknown-field",
        category: "schema",
        message: `Unknown field '${key}'.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range,
        hint: "Remove unsupported fields or update the formal content spec first."
      })
    );
  }
}

function readRequiredString(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(
      createIssue({
        code: "schema.required-string",
        category: "schema",
        message: `Field '${key}' must be a non-empty string.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

function readOptionalString(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(
      createIssue({
        code: "schema.invalid-string",
        category: "schema",
        message: `Field '${key}' must be a non-empty string when provided.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

function readOptionalStringArray(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (value === undefined) {
    return undefined;
  }

  if (!isStringArray(value) || value.some((item) => item.trim().length === 0)) {
    issues.push(
      createIssue({
        code: "schema.invalid-string-array",
        category: "schema",
        message: `Field '${key}' must be an array of non-empty strings.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

function readOptionalPitchAccent(
  values: Record<string, unknown>,
  filePath: string,
  sourcePath: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = values.pitch_accent;

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  issues.push(
    createIssue({
      code: "structured-block.invalid-pitch-accent",
      category: "schema",
      message: "Field 'pitch_accent' must be an integer greater than or equal to 0.",
      filePath,
      path: `${sourcePath}.pitch_accent`,
      range
    })
  );

  return undefined;
}

function readRequiredInteger(
  raw: Record<string, unknown>,
  key: string,
  filePath: string,
  pathPrefix: string,
  issues: ValidationIssue[],
  range?: SourceRange
) {
  const value = raw[key];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    issues.push(
      createIssue({
        code: "schema.required-integer",
        category: "schema",
        message: `Field '${key}' must be an integer.`,
        filePath,
        path: `${pathPrefix}.${key}`,
        range
      })
    );
    return undefined;
  }

  return value;
}

async function listMarkdownFiles(directoryPath: string) {
  const directoryStat = await getStat(directoryPath);

  if (!directoryStat?.isDirectory()) {
    return [];
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort();
}

async function inspectRequiredMarkdownDirectory(
  directoryPath: string,
  directoryName: "textbook" | "cards"
): Promise<MarkdownDirectoryInspection> {
  const issues: ValidationIssue[] = [];
  const directoryStat = await getStat(directoryPath);

  if (!directoryStat) {
    issues.push(
      createIssue({
        code: "media.missing-directory",
        category: "integrity",
        message: `Media directory is missing ${directoryName}/.`,
        filePath: directoryPath,
        hint:
          directoryName === "textbook"
            ? "Create textbook/ and add one or more lesson Markdown files."
            : "Create cards/ and add one or more cards Markdown files."
      })
    );

    return {
      markdownFiles: [],
      issues
    };
  }

  if (!directoryStat.isDirectory()) {
    issues.push(
      createIssue({
        code: "media.invalid-directory",
        category: "integrity",
        message: `${directoryName}/ must be a directory.`,
        filePath: directoryPath,
        hint: `Replace ${directoryName} with a directory containing Markdown files.`
      })
    );

    return {
      markdownFiles: [],
      issues
    };
  }

  let markdownFiles: string[] = [];

  try {
    markdownFiles = await listMarkdownFiles(directoryPath);
  } catch (error) {
    issues.push(
      createIssue({
        code: "media.unreadable-directory",
        category: "integrity",
        message: `Could not read ${directoryName}/.`,
        filePath: directoryPath,
        hint: `Check filesystem permissions for ${directoryName}/.`,
        details: {
          directory: directoryName,
          error:
            error instanceof Error && error.message.length > 0
              ? error.message
              : String(error)
        }
      })
    );

    return {
      markdownFiles: [],
      issues
    };
  }

  if (markdownFiles.length === 0) {
    issues.push(
      createIssue({
        code: "media.empty-directory",
        category: "integrity",
        message: `${directoryName}/ must contain at least one Markdown file.`,
        filePath: directoryPath,
        hint:
          directoryName === "textbook"
            ? "Add one or more lesson .md files to textbook/."
            : "Add one or more cards .md files to cards/."
      })
    );
  }

  return {
    markdownFiles,
    issues
  };
}

async function fileExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function dedupeStrings(values: string[]) {
  return [...new Set(values)];
}

function sortIssues(issues: ValidationIssue[]) {
  return [...issues].sort((left, right) => {
    if (left.location.filePath !== right.location.filePath) {
      return left.location.filePath.localeCompare(right.location.filePath);
    }

    const leftLine = left.location.range?.start.line ?? Number.MAX_SAFE_INTEGER;
    const rightLine =
      right.location.range?.start.line ?? Number.MAX_SAFE_INTEGER;

    if (leftLine !== rightLine) {
      return leftLine - rightLine;
    }

    return left.code.localeCompare(right.code);
  });
}

async function getStat(targetPath: string) {
  try {
    return await stat(targetPath);
  } catch {
    return null;
  }
}
