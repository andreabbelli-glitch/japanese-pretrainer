import { readdir } from "node:fs/promises";
import path from "node:path";

import { createIssue } from "./parser/utils.ts";
import type { ParsedDocumentDraft } from "./parser/internal.ts";
import type {
  ContentParseResult,
  NormalizedContentWorkspace,
  NormalizedCardsDocument,
  NormalizedLessonDocument,
  NormalizedMediaBundle,
  ValidationIssue
} from "./types.ts";
import type { ParsedDocumentState } from "./validator-documents.ts";
import {
  fileExists,
  inspectRequiredMarkdownDirectory,
  getStat,
  parseDocumentFile,
  normalizeMediaDocument,
  normalizeLessonDocument,
  normalizeCardsDocument,
  sortIssues
} from "./validator-documents.ts";
import {
  applyPronunciationManifest,
  loadPronunciationManifest
} from "./pronunciations-manifest.ts";
import {
  validateWorkspaceDuplicateIds,
  mediaBundleValidationRules,
  runValidationRules,
  type MediaBundleValidationInput
} from "./validator-rules.ts";

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
    ? await normalizeMediaDocument(mediaState, mediaSlug, issues)
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
