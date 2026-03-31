import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { parseFrontmatter } from "./parser/frontmatter.ts";
import {
  applyPronunciationManifest,
  loadPronunciationManifest
} from "./pronunciations-manifest.ts";
import type {
  ParsedDocumentDraft,
  RawStructuredBlock
} from "./parser/internal.ts";
import { parseMarkdownDocument } from "./parser/markdown.ts";
import { extractStructuredBlocks } from "./parser/structured-blocks.ts";
import { createIssue } from "./parser/utils.ts";
import {
  mediaBundleValidationRules,
  runValidationRules,
  validateWorkspaceDuplicateIds
} from "./validator-rules.ts";
import {
  normalizeMediaFrontmatter,
  normalizeLessonFrontmatter,
  normalizeCardsFrontmatter
} from "./validator-frontmatter.ts";
import type {
  CollectedReference,
  ContentParseResult,
  ContentBlock,
  MarkdownDocument,
  NormalizedCardsDocument,
  NormalizedContentWorkspace,
  NormalizedLessonDocument,
  NormalizedMediaBundle,
  NormalizedMediaDocument,
  SourceRange,
  ValidationIssue
} from "./types.ts";
import {
  getStructuredBlockResolver,
  type DocumentSourceContext,
  type TermRecord,
  type GrammarRecord,
  type CardRecord
} from "./validator-blocks.ts";
import type { MediaBundleValidationInput } from "./validator-rules.ts";

interface ParsedDocumentState {
  draft: ParsedDocumentDraft;
  rawId?: string;
  frontmatterFieldRanges: Record<string, SourceRange>;
  frontmatterFieldStyles: Record<string, string>;
  structuredBlocks: RawStructuredBlock[];
  references: CollectedReference[];
  issues: ValidationIssue[];
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

  const terms = lessonResults
    .flatMap((result) => result.terms)
    .concat(cardsResults.flatMap((result) => result.terms));
  const grammarPatterns = lessonResults
    .flatMap((result) => result.grammarPatterns)
    .concat(cardsResults.flatMap((result) => result.grammarPatterns));
  const cards = cardsResults.flatMap((result) => result.cards);
  const lessonIdLookup = new Set(
    lessonResults
      .map((result) => result.document?.frontmatter.id ?? null)
      .filter((lessonId): lessonId is string => Boolean(lessonId))
  );
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

  const validationInput: MediaBundleValidationInput = {
    duplicateIds: {
      media: mediaState ? [mediaState] : [],
      lessons: lessonStates,
      cardFiles: cardsStates
    },
    lessonIds: {
      cards,
      lessonIdLookup
    },
    references: {
      cards,
      grammarPatterns,
      references,
      terms
    }
  };

  await runValidationRules(
    validationInput,
    mediaBundleValidationRules,
    issues
  );

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

    const resolver = getStructuredBlockResolver(rawBlock.blockType);

    if (!resolver) {
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
      continue;
    }

    const result = await resolver(rawBlock, sourceContext, sourcePath, issues);

    if (!result) {
      continue;
    }

    blocks.push(result.block);
    references.push(...result.references);

    if (result.kind === "term") {
      terms.push(result.term);
      continue;
    }

    if (result.kind === "grammar") {
      grammarPatterns.push(result.grammar);
      continue;
    }

    if (result.kind === "card") {
      cards.push(result.card);
    }
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
