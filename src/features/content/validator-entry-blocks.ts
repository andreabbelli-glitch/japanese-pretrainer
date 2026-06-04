import { romanizeKanaForSearch } from "../study/model/search.ts";

import type { RawStructuredBlock } from "./parser/internal.ts";
import { parseInlineFragment } from "./parser/markdown.ts";
import { createIssue, isUrlSafeSlug } from "./parser/utils.ts";
import { normalizeEntryAudioMetadata } from "./pronunciations-manifest.ts";
import type {
  CollectedReference,
  NormalizedGrammarPattern,
  NormalizedTerm,
  SourceRange,
  ValidationIssue
} from "./types.ts";
import type { DocumentSourceContext } from "./validator-blocks.ts";
import {
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
  reportUnknownKeys,
  reportUnsafeYamlPlainScalars
} from "./validator-fields.ts";

export interface TermRecord {
  value: NormalizedTerm;
  sourcePath: string;
  position?: SourceRange;
  references: CollectedReference[];
}

export interface GrammarRecord {
  value: NormalizedGrammarPattern;
  sourcePath: string;
  position?: SourceRange;
  references: CollectedReference[];
}

export async function normalizeTermBlock(
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
      "audio_src",
      "audio_source",
      "audio_speaker",
      "audio_license",
      "audio_attribution",
      "audio_page_url"
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
  const audio = await normalizeEntryAudioMetadata({
    filePath: sourceContext.filePath,
    mediaDirectory: sourceContext.mediaDirectory,
    range: rawBlock.position,
    sourcePath,
    values: rawBlock.data
  });

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

  const romajiSokuonIssue = validateCompactKanaTermRomaji({
    filePath: sourceContext.filePath,
    lemma,
    reading,
    romaji,
    range: rawBlock.fieldRanges?.romaji ?? rawBlock.position,
    sourcePath: `${sourcePath}.romaji`
  });

  if (romajiSokuonIssue) {
    issues.push(romajiSokuonIssue);
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
      audio: audio.value ?? undefined,
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

function validateCompactKanaTermRomaji(input: {
  filePath: string;
  lemma: string;
  reading: string;
  romaji: string;
  range?: SourceRange;
  sourcePath: string;
}) {
  if (
    !/[っッ]/u.test(input.reading) ||
    /\s/.test(input.reading) ||
    /[A-Za-z0-9]/.test(input.lemma) ||
    !/^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(input.reading)
  ) {
    return null;
  }

  const expectedRomaji = romanizeKanaForSearch(input.reading);
  const actualRomaji = romanizeKanaForSearch(input.romaji);

  if (expectedRomaji === actualRomaji) {
    return null;
  }

  return createIssue({
    code: "structured-block.term-romaji-sokuon-mismatch",
    category: "schema",
    message:
      "Field 'romaji' must preserve the doubled consonant implied by a small tsu in compact kana readings.",
    filePath: input.filePath,
    path: input.sourcePath,
    range: input.range,
    hint: `Use the expected romaji for the reading, for example '${expectedRomaji}'.`
  });
}

export async function normalizeGrammarBlock(
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
      "audio_src",
      "audio_source",
      "audio_speaker",
      "audio_license",
      "audio_attribution",
      "audio_page_url"
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
  const audio = await normalizeEntryAudioMetadata({
    filePath: sourceContext.filePath,
    mediaDirectory: sourceContext.mediaDirectory,
    range: rawBlock.position,
    sourcePath,
    values: rawBlock.data
  });

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
      audio: audio.value ?? undefined,
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
