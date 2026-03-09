import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  entryTypeValues,
  lessonStatusValues,
  mediaStatusValues
} from "../../domain/content.ts";

import { parseFrontmatter } from "./parser/frontmatter.ts";
import type { ParsedDocumentDraft, RawStructuredBlock } from "./parser/internal.ts";
import { parseInlineFragment, parseMarkdownDocument } from "./parser/markdown.ts";
import { extractStructuredBlocks } from "./parser/structured-blocks.ts";
import { createIssue, isStringArray, isUrlSafeSlug } from "./parser/utils.ts";
import type {
  CardDefinitionBlock,
  CardsFrontmatter,
  CollectedReference,
  ContentBlock,
  ContentParseResult,
  GrammarDefinitionBlock,
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
  structuredBlocks: RawStructuredBlock[];
  references: CollectedReference[];
  issues: ValidationIssue[];
}

interface TermRecord {
  value: NormalizedTerm;
  sourcePath: string;
  position?: SourceRange;
}

interface GrammarRecord {
  value: NormalizedGrammarPattern;
  sourcePath: string;
  position?: SourceRange;
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

  const [mediaFileExists, textbookInspection, cardsInspection] = await Promise.all([
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
    (state): state is ParsedDocumentState & { draft: ParsedDocumentDraft & { kind: "media" } } =>
      state.draft.kind === "media"
  );
  const lessonStates = parsedStates.filter(
    (state): state is ParsedDocumentState & { draft: ParsedDocumentDraft & { kind: "lesson" } } =>
      state.draft.kind === "lesson"
  );
  const cardsStates = parsedStates.filter(
    (state): state is ParsedDocumentState & { draft: ParsedDocumentDraft & { kind: "cards" } } =>
      state.draft.kind === "cards"
  );

  const normalizedMedia = mediaState
    ? normalizeMediaDocument(mediaState, mediaSlug, issues)
    : null;

  const expectedMediaId =
    normalizedMedia?.frontmatter.id ?? mediaState?.rawId ?? undefined;

  const lessonResults = lessonStates.map((state) =>
    normalizeLessonDocument(state, issues, expectedMediaId)
  );
  const cardsResults = cardsStates.map((state) =>
    normalizeCardsDocument(state, issues, expectedMediaId)
  );

  validateDuplicateIds(
    {
      media: mediaState ? [mediaState] : [],
      lessons: lessonStates,
      cardFiles: cardsStates,
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

  validateReferences(terms, grammarPatterns, cards, references, issues);

  const bundle: NormalizedMediaBundle = {
    mediaDirectory,
    mediaSlug,
    media: normalizedMedia,
    lessons: lessonResults
      .map((result) => result.document)
      .filter((document): document is NormalizedLessonDocument => document !== null),
    cardFiles: cardsResults
      .map((result) => result.document)
      .filter((document): document is NormalizedCardsDocument => document !== null),
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
    draft: kind === "media"
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
    structuredBlocks: extraction.blocks,
    references: markdown.references,
    issues: [
      ...frontmatter.issues,
      ...extraction.issues,
      ...markdown.issues
    ]
  };
}

function normalizeMediaDocument(
  state: ParsedDocumentState & { draft: ParsedDocumentDraft & { kind: "media" } },
  mediaSlug: string,
  issues: ValidationIssue[]
): NormalizedMediaDocument | null {
  const frontmatter = normalizeMediaFrontmatter(
    state.draft.frontmatter,
    state.draft.sourceFile,
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

function normalizeLessonDocument(
  state: ParsedDocumentState & { draft: ParsedDocumentDraft & { kind: "lesson" } },
  issues: ValidationIssue[],
  expectedMediaId?: string
): {
  document: NormalizedLessonDocument | null;
  terms: TermRecord[];
  grammarPatterns: GrammarRecord[];
  references: CollectedReference[];
} {
  const frontmatter = normalizeLessonFrontmatter(
    state.draft.frontmatter,
    state.draft.sourceFile,
    issues
  );

  if (frontmatter && expectedMediaId && frontmatter.mediaId !== expectedMediaId) {
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
    documentSegmentRef: frontmatter?.segmentRef
  };
  const resolved = resolveStructuredBody(
    state,
    sourceContext,
    issues,
    new Set(["term", "grammar"])
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

function normalizeCardsDocument(
  state: ParsedDocumentState & { draft: ParsedDocumentDraft & { kind: "cards" } },
  issues: ValidationIssue[],
  expectedMediaId?: string
): {
  document: NormalizedCardsDocument | null;
  terms: TermRecord[];
  grammarPatterns: GrammarRecord[];
  cards: CardRecord[];
  references: CollectedReference[];
} {
  const frontmatter = normalizeCardsFrontmatter(
    state.draft.frontmatter,
    state.draft.sourceFile,
    issues
  );

  if (frontmatter && expectedMediaId && frontmatter.mediaId !== expectedMediaId) {
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
    documentSegmentRef: frontmatter?.segmentRef
  };
  const resolved = resolveStructuredBody(
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
          message: "Cards files may only contain structured term, grammar, or card blocks.",
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
  state: ParsedDocumentState & { draft: ParsedDocumentDraft & { kind: "media" } },
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

function resolveStructuredBody(
  state: ParsedDocumentState,
  sourceContext: DocumentSourceContext,
  issues: ValidationIssue[],
  allowedBlockTypes: Set<string>
): {
  body: MarkdownDocument;
  terms: TermRecord[];
  grammarPatterns: GrammarRecord[];
  cards: CardRecord[];
  references: CollectedReference[];
} {
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
          message: "Structured block could not be resolved from the markdown body.",
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
      const term = normalizeTermBlock(rawBlock, sourceContext, sourcePath, issues);

      if (term) {
        const node: TermDefinitionBlock = {
          type: "termDefinition",
          position: rawBlock.position,
          entry: term.value
        };

        blocks.push(node);
        terms.push(term);
      }

      continue;
    }

    if (rawBlock.blockType === "grammar") {
      const grammar = normalizeGrammarBlock(
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
      }

      continue;
    }

    if (rawBlock.blockType === "card") {
      const card = normalizeCardBlock(rawBlock, sourceContext, sourcePath, issues);

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

    issues.push(
      createIssue({
        code: "structured-block.unknown-type",
        category: "schema",
        message: `Unsupported structured block '${rawBlock.blockType}'.`,
        filePath: state.draft.sourceFile,
        path: sourcePath,
        range: rawBlock.position,
        hint: "Use :::term, :::grammar, or :::card."
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
  const tags = readOptionalStringArray(raw, "tags", filePath, scope, issues) ?? [];
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
  const tags = readOptionalStringArray(raw, "tags", filePath, scope, issues) ?? [];
  const status = readOptionalString(raw, "status", filePath, scope, issues);
  const summary = readOptionalString(raw, "summary", filePath, scope, issues);
  const prerequisites =
    readOptionalStringArray(raw, "prerequisites", filePath, scope, issues) ?? [];

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

function normalizeTermBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): TermRecord | null {
  if (!rawBlock.data) {
    return null;
  }

  reportUnknownKeys(
    rawBlock.data,
    [
      "id",
      "lemma",
      "reading",
      "romaji",
      "meaning_it",
      "pos",
      "meaning_literal_it",
      "notes_it",
      "level_hint",
      "aliases",
      "segment_ref"
    ],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );

  const id = readRequiredString(
    rawBlock.data,
    "id",
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

  if (!id || !lemma || !reading || !romaji || !meaningIt) {
    return null;
  }

  return {
    value: {
      kind: "term",
      id,
      lemma,
      reading,
      romaji,
      meaningIt,
      pos: pos ?? undefined,
      meaningLiteralIt: meaningLiteralIt ?? undefined,
      notesIt: notesIt ?? undefined,
      levelHint: levelHint ?? undefined,
      aliases,
      segmentRef: segmentRef ?? undefined,
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
    position: rawBlock.position
  };
}

function normalizeGrammarBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): GrammarRecord | null {
  if (!rawBlock.data) {
    return null;
  }

  reportUnknownKeys(
    rawBlock.data,
    [
      "id",
      "pattern",
      "title",
      "meaning_it",
      "notes_it",
      "level_hint",
      "aliases",
      "segment_ref"
    ],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
  );

  const id = readRequiredString(
    rawBlock.data,
    "id",
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

  if (!id || !pattern || !title || !meaningIt) {
    return null;
  }

  return {
    value: {
      kind: "grammar",
      id,
      pattern,
      title,
      meaningIt,
      notesIt: notesIt ?? undefined,
      levelHint: levelHint ?? undefined,
      aliases,
      segmentRef: segmentRef ?? undefined,
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
    position: rawBlock.position
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
    ["id", "entry_type", "entry_id", "card_type", "front", "back", "tags", "notes_it"],
    sourceContext.filePath,
    sourcePath,
    issues,
    rawBlock.position
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

  if (entryType && !entryTypeValues.includes(entryType as (typeof entryTypeValues)[number])) {
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

  issues.push(...frontFragment.issues, ...backFragment.issues, ...(notesFragment?.issues ?? []));

  return {
    value: {
      kind: "card",
      id,
      entryType: entryType as (typeof entryTypeValues)[number],
      entryId,
      cardType,
      front: frontFragment.fragment,
      back: backFragment.fragment,
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
      ...(notesFragment?.references ?? [])
    ]
  };
}

function validateDuplicateIds(
  input: {
    media: ParsedDocumentState[];
    lessons: ParsedDocumentState[];
    cardFiles: ParsedDocumentState[];
  },
  issues: ValidationIssue[]
) {
  const registry = new Map<string, Array<{ filePath: string; path: string; range?: SourceRange }>>();

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
    register("cards-file", state.rawId, state.draft.sourceFile, "frontmatter.id");

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
      registerDefinitionIds(bundle.mediaDirectory, lesson.sourceFile, lesson.body.blocks, registry);
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
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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
    const rightLine = right.location.range?.start.line ?? Number.MAX_SAFE_INTEGER;

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
