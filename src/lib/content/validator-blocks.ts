import { access } from "node:fs/promises";

import { entryTypeValues } from "../../domain/content.ts";
import {
  isSupportedImageAssetPath,
  isValidMediaAssetPath,
  isWithinMediaAssetRoot,
  resolveMediaAssetAbsolutePath
} from "../media-assets.ts";
import { romanizeKanaForSearch } from "../study-search.ts";
import type { RawStructuredBlock } from "./parser/internal.ts";
import { parseInlineFragment } from "./parser/markdown.ts";
import { createIssue, isUrlSafeSlug } from "./parser/utils.ts";
import type {
  CollectedReference,
  ExampleSentenceBlock,
  ImageBlock,
  NormalizedCard,
  NormalizedGrammarPattern,
  NormalizedTerm,
  SourceRange,
  ValidationIssue
} from "./types.ts";
import { normalizeEntryAudioMetadata } from "./pronunciations-manifest.ts";
import {
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
  reportImageAltKanjiIssue,
  reportImageCaptionKanjiIssue,
  reportUnknownKeys,
  reportUnsafeYamlPlainScalars,
  reportVisibleRichTextIssue,
  readOptionalPitchAccent
} from "./validator-fields.ts";

export interface DocumentSourceContext {
  filePath: string;
  documentKind: "lesson" | "cards";
  documentId?: string;
  documentOrder?: number;
  documentSegmentRef?: string;
  mediaDirectory: string;
}

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

export interface CardRecord {
  value: NormalizedCard;
  sourcePath: string;
  position?: SourceRange;
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

export function normalizeCardBlock(
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
      "lesson_id",
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
  const lessonId = readRequiredString(
    rawBlock.data,
    "lesson_id",
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

  if (
    !id ||
    !entryType ||
    !entryId ||
    !cardType ||
    !lessonId ||
    !front ||
    !back
  ) {
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
  reportVisibleRichTextIssue({
    fragment: frontFragment.fragment,
    filePath: sourceContext.filePath,
    sourcePath: `${sourcePath}.front`,
    range: frontRange,
    issues,
    checkBareKanji: true,
    checkBareNumerals: true
  });
  if (exampleJpFragment) {
    reportVisibleRichTextIssue({
      fragment: exampleJpFragment.fragment,
      filePath: sourceContext.filePath,
      sourcePath: `${sourcePath}.example_jp`,
      range: exampleJpRange,
      issues,
      checkBareKanji: true,
      checkBareNumerals: true
    });
  }

  return {
    value: {
      kind: "card",
      id,
      lessonId,
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

export function normalizeExampleSentenceBlock(
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
        message: "Field 'reveal_mode' must be either 'default' or 'sentence'.",
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
  reportVisibleRichTextIssue({
    fragment: sentenceFragment.fragment,
    filePath: sourceContext.filePath,
    sourcePath: `${sourcePath}.jp`,
    range: sentenceRange,
    issues,
    checkBareKanji: true,
    checkBareNumerals: true
  });

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

export async function normalizeImageBlock(
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

async function fileExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}
