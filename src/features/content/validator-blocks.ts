import { access } from "node:fs/promises";

import { entryTypeValues } from "../../domain/content.ts";
import {
  isSupportedImageAssetPath,
  isValidMediaAssetPath,
  isWithinMediaAssetRoot,
  resolveMediaAssetAbsolutePath
} from "../media/server/assets.ts";
import type { RawStructuredBlock } from "./parser/internal.ts";
import { parseInlineFragment } from "./parser/markdown.ts";
import { createIssue } from "./parser/utils.ts";
import type {
  CollectedReference,
  CardDefinitionBlock,
  ExampleSentenceBlock,
  GrammarDefinitionBlock,
  ImageBlock,
  NormalizedCard,
  TermDefinitionBlock,
  SourceRange,
  ValidationIssue
} from "./types.ts";
import {
  normalizeGrammarBlock,
  normalizeTermBlock,
  type GrammarRecord,
  type TermRecord
} from "./validator-entry-blocks.ts";
import { normalizeEntryAudioMetadata } from "./pronunciations-manifest.ts";
import {
  readOptionalString,
  readOptionalStringArray,
  readRequiredString,
  reportImageAltKanjiIssue,
  reportImageCaptionKanjiIssue,
  reportUnknownKeys,
  reportUnsafeYamlPlainScalars,
  reportVisibleRichTextIssue
} from "./validator-fields.ts";

export type { GrammarRecord, TermRecord } from "./validator-entry-blocks.ts";

export interface DocumentSourceContext {
  filePath: string;
  documentKind: "lesson" | "cards";
  documentId?: string;
  documentOrder?: number;
  documentSegmentRef?: string;
  mediaDirectory: string;
}

export interface CardRecord {
  value: NormalizedCard;
  sourcePath: string;
  position?: SourceRange;
}

type StructuredBlockResolution =
  | {
      kind: "term";
      block: TermDefinitionBlock;
      references: CollectedReference[];
      term: TermRecord;
    }
  | {
      kind: "grammar";
      block: GrammarDefinitionBlock;
      references: CollectedReference[];
      grammar: GrammarRecord;
    }
  | {
      kind: "card";
      block: CardDefinitionBlock;
      references: CollectedReference[];
      card: CardRecord;
    }
  | {
      kind: "example_sentence";
      block: ExampleSentenceBlock;
      references: CollectedReference[];
    }
  | {
      kind: "image";
      block: ImageBlock;
      references: CollectedReference[];
    };

type StructuredBlockResolver = (
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
) => Promise<StructuredBlockResolution | null>;

const structuredBlockResolvers: Record<string, StructuredBlockResolver> = {
  term: async (rawBlock, sourceContext, sourcePath, issues) => {
    const term = await normalizeTermBlock(
      rawBlock,
      sourceContext,
      sourcePath,
      issues
    );

    if (!term) {
      return null;
    }

    return {
      kind: "term",
      block: {
        type: "termDefinition",
        position: rawBlock.position,
        entry: term.value
      },
      references: term.references,
      term
    };
  },
  grammar: async (rawBlock, sourceContext, sourcePath, issues) => {
    const grammar = await normalizeGrammarBlock(
      rawBlock,
      sourceContext,
      sourcePath,
      issues
    );

    if (!grammar) {
      return null;
    }

    return {
      kind: "grammar",
      block: {
        type: "grammarDefinition",
        position: rawBlock.position,
        entry: grammar.value
      },
      references: grammar.references,
      grammar
    };
  },
  card: async (rawBlock, sourceContext, sourcePath, issues) => {
    const card = await normalizeCardBlock(
      rawBlock,
      sourceContext,
      sourcePath,
      issues
    );

    if (!card) {
      return null;
    }

    return {
      kind: "card",
      block: {
        type: "cardDefinition",
        position: rawBlock.position,
        card: card.value
      },
      references: card.references,
      card
    };
  },
  example_sentence: async (rawBlock, sourceContext, sourcePath, issues) => {
    const exampleSentence = normalizeExampleSentenceBlock(
      rawBlock,
      sourceContext,
      sourcePath,
      issues
    );

    if (!exampleSentence) {
      return null;
    }

    return {
      kind: "example_sentence",
      block: exampleSentence.block,
      references: exampleSentence.references
    };
  },
  image: async (rawBlock, sourceContext, sourcePath, issues) => {
    const image = await normalizeImageBlock(
      rawBlock,
      sourceContext,
      sourcePath,
      issues
    );

    if (!image) {
      return null;
    }

    return {
      kind: "image",
      block: image.block,
      references: image.references
    };
  }
};

export function getStructuredBlockResolver(blockType: string) {
  return (
    structuredBlockResolvers[blockType as keyof typeof structuredBlockResolvers] ??
    null
  );
}

export async function normalizeCardBlock(
  rawBlock: RawStructuredBlock,
  sourceContext: DocumentSourceContext,
  sourcePath: string,
  issues: ValidationIssue[]
): Promise<(CardRecord & { references: CollectedReference[] }) | null> {
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
      "example_audio_src",
      "example_audio_source",
      "example_audio_speaker",
      "example_audio_license",
      "example_audio_attribution",
      "example_audio_page_url",
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
  const exampleAudioValues = {
    audio_src: rawBlock.data.example_audio_src,
    audio_source: rawBlock.data.example_audio_source,
    audio_speaker: rawBlock.data.example_audio_speaker,
    audio_license: rawBlock.data.example_audio_license,
    audio_attribution: rawBlock.data.example_audio_attribution,
    audio_page_url: rawBlock.data.example_audio_page_url
  };
  const exampleAudio = await normalizeEntryAudioMetadata({
    filePath: sourceContext.filePath,
    mediaDirectory: sourceContext.mediaDirectory,
    range: rawBlock.position,
    sourcePath,
    values: exampleAudioValues
  });

  issues.push(...exampleAudio.issues);

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
      exampleAudio: exampleAudio.value ?? undefined,
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
  // Legacy compatibility: accept card_id in older textbook image blocks, but
  // ignore it. Textbook images are rendered as plain zoomable media.
  readOptionalString(
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
