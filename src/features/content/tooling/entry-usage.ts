import path from "node:path";

import { stripInlineMarkdown } from "../../study/model/inline-markdown.ts";
import { normalizeSearchText } from "../../study/model/search.ts";
import type {
  CollectedReference,
  ContentBlock,
  NormalizedCard,
  NormalizedGrammarPattern,
  NormalizedMediaBundle,
  NormalizedTerm,
  RichTextFragment
} from "../types.ts";
import {
  createSourceLineResolver,
  type SourceLineResolver
} from "./entry-usage-lines.ts";

export type ContentEntryUsageKind = "grammar" | "term";
export type ContentEntryUsageStatus = "covered-card" | "entry-only";

export type ContentEntryUsageResult = {
  cards: EntryUsageCard[];
  counts: {
    cards: number;
    lessons: number;
    usages: number;
  };
  entry: EntryUsageEntry;
  media: {
    slug: string;
    title?: string;
  };
  schema_version: 1;
  source: {
    document: "cards" | "lesson";
    file: string;
    line?: number;
    segment_ref?: string;
  };
  truncated: {
    cards: boolean;
    usages: boolean;
  };
  usages: EntryUsageReference[];
};

export type ContentEntryUsageAmbiguousResult = {
  candidates: EntryUsageCandidate[];
  error: "ambiguous";
  query: string;
  schema_version: 1;
  total_matches: number;
  truncated: {
    candidates: boolean;
  };
};

export type EntryUsageEntry = {
  audio: "missing" | "ok";
  display: string;
  id: string;
  kind: ContentEntryUsageKind;
  meaning_it: string;
  pitch_accent?: number;
  reading?: string;
  status: ContentEntryUsageStatus;
};

export type EntryUsageCard = {
  front: string;
  id: string;
  lesson_slug?: string;
  line?: number;
  source: string;
  type: string;
};

export type EntryUsageReference = {
  card_id?: string;
  display: string;
  document: "cards" | "lesson" | "media";
  field: string;
  lesson_slug?: string;
  line?: number;
  source: string;
  source_path: string;
};

export type EntryUsageCandidate = {
  cards: number;
  display: string;
  id: string;
  kind: ContentEntryUsageKind;
  media_slug: string;
  reading?: string;
};

type EntryRecord = {
  entry: NormalizedGrammarPattern | NormalizedTerm;
  mediaBundle: NormalizedMediaBundle;
};

type EntryUsageDocumentIndex = {
  blockOwners: Map<string, SourceBlockOwner>;
  cardLines: Map<string, number>;
  entryLines: Map<string, number>;
};

type SourceBlockOwner = {
  blockType: ContentBlock["type"];
  cardId?: string;
};

const maxAmbiguousCandidates = 10;

export function buildContentEntryUsage(input: {
  bundles: NormalizedMediaBundle[];
  cardLimit?: number;
  entryId?: string;
  kind?: ContentEntryUsageKind;
  mediaSlug: string;
  repositoryRoot?: string;
  surface?: string;
  usageLimit?: number;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const cardLimit = clampLimit(input.cardLimit ?? 5);
  const usageLimit = clampLimit(input.usageLimit ?? 12, 50);
  const records = collectEntryRecords(
    input.bundles,
    input.mediaSlug,
    input.kind
  );
  const matches = input.entryId
    ? records.filter((record) => record.entry.id === input.entryId)
    : collectSurfaceMatches(records, input.surface ?? "");

  if (matches.length === 0) {
    throw new Error(
      input.entryId
        ? `Entry '${input.entryId}' was not found.`
        : "No exact entry match found."
    );
  }

  if (matches.length > 1) {
    return {
      candidates: matches
        .slice(0, maxAmbiguousCandidates)
        .map((record) => buildCandidate(record)),
      error: "ambiguous",
      query: input.entryId ?? input.surface ?? "",
      schema_version: 1,
      total_matches: matches.length,
      truncated: {
        candidates: matches.length > maxAmbiguousCandidates
      }
    } satisfies ContentEntryUsageAmbiguousResult;
  }

  const record = matches[0]!;
  const documentIndex = buildDocumentIndex(record.mediaBundle);
  const lessonById = buildLessonById(record.mediaBundle);
  const cardById = new Map(
    record.mediaBundle.cards.map((card) => [card.id, card])
  );
  const cards = record.mediaBundle.cards
    .filter(
      (card) =>
        card.entryType === record.entry.kind && card.entryId === record.entry.id
    )
    .sort(compareCards);
  const references = record.mediaBundle.references
    .filter(
      (reference) =>
        reference.referenceType === record.entry.kind &&
        reference.targetId === record.entry.id
    )
    .sort(compareReferences);
  const sourceLineResolver = createSourceLineResolver(references);
  const usages = references
    .map((reference) =>
      buildReference({
        cardById,
        documentIndex,
        lessonById,
        reference,
        repositoryRoot,
        sourceLineResolver
      })
    )
    .sort(compareUsages);
  const lessons = collectLessonSlugs({
    cards,
    cardById,
    lessonById,
    references,
    documentIndex
  });

  return {
    cards: cards
      .slice(0, cardLimit)
      .map((card) =>
        buildCard(card, lessonById, documentIndex, repositoryRoot)
      ),
    counts: {
      cards: cards.length,
      lessons: lessons.size,
      usages: references.length
    },
    entry: buildEntry(
      record.entry,
      cards.length > 0 ? "covered-card" : "entry-only"
    ),
    media: {
      slug: record.mediaBundle.mediaSlug,
      ...(record.mediaBundle.media?.frontmatter.title
        ? { title: record.mediaBundle.media.frontmatter.title }
        : {})
    },
    schema_version: 1,
    source: buildSource(record.entry, documentIndex, repositoryRoot),
    truncated: {
      cards: cards.length > cardLimit,
      usages: usages.length > usageLimit
    },
    usages: usages.slice(0, usageLimit)
  } satisfies ContentEntryUsageResult;
}

export function formatContentEntryUsage(
  result: ContentEntryUsageAmbiguousResult | ContentEntryUsageResult
) {
  if ("error" in result) {
    return formatAmbiguousResult(result);
  }

  const lines = [
    [
      "ENTRY",
      result.entry.kind,
      result.entry.id,
      `media=${result.media.slug}`,
      `status=${result.entry.status}`,
      `display=${quoteForLine(result.entry.display)}`,
      result.entry.reading ? `reading=${result.entry.reading}` : null,
      `meaning=${quoteForLine(result.entry.meaning_it)}`,
      `audio=${result.entry.audio}`,
      result.entry.pitch_accent !== undefined
        ? `pitch=${result.entry.pitch_accent}`
        : null
    ]
      .filter((value): value is string => value !== null)
      .join(" "),
    [
      "SOURCE",
      result.source.file,
      `document=${result.source.document}`,
      result.source.line !== undefined ? `line=${result.source.line}` : null,
      result.source.segment_ref ? `segment=${result.source.segment_ref}` : null
    ]
      .filter((value): value is string => value !== null)
      .join(" "),
    [
      "CANONICAL",
      `cards=${result.counts.cards}`,
      `lessons=${result.counts.lessons}`,
      `usages=${result.counts.usages}`
    ].join(" ")
  ];

  for (const card of result.cards) {
    lines.push(
      [
        "CARD",
        card.id,
        `type=${card.type}`,
        card.lesson_slug ? `lesson=${card.lesson_slug}` : null,
        card.line !== undefined ? `line=${card.line}` : null,
        `front=${quoteForLine(card.front)}`,
        `source=${card.source}`
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );
  }
  if (result.truncated.cards) {
    lines.push("NOTE cards truncated; rerun with --card-limit for more.");
  }

  lines.push(`USAGES ${result.counts.usages}`);
  for (const usage of result.usages) {
    lines.push(
      [
        "USAGE",
        usage.document,
        `field=${usage.field}`,
        usage.card_id ? `card=${usage.card_id}` : null,
        usage.lesson_slug ? `lesson=${usage.lesson_slug}` : null,
        usage.line !== undefined ? `line=${usage.line}` : null,
        `display=${quoteForLine(usage.display)}`,
        `source=${usage.source}`
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );
  }
  if (result.truncated.usages) {
    lines.push("NOTE usages truncated; rerun with --usage-limit for more.");
  }

  return `${lines.join("\n")}\n`;
}

function formatAmbiguousResult(result: ContentEntryUsageAmbiguousResult) {
  const lines = [
    `AMBIG query=${quoteForLine(result.query)} matches=${result.total_matches}`
  ];

  for (const candidate of result.candidates) {
    lines.push(
      [
        "HIT",
        candidate.kind,
        candidate.id,
        `media=${candidate.media_slug}`,
        `display=${quoteForLine(candidate.display)}`,
        candidate.reading ? `reading=${candidate.reading}` : null,
        `cards=${candidate.cards}`
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );
  }

  if (result.truncated.candidates) {
    lines.push("NOTE candidates truncated; rerun with --kind or --entry-id.");
  }

  return `${lines.join("\n")}\n`;
}

function collectEntryRecords(
  bundles: NormalizedMediaBundle[],
  mediaSlug: string,
  kind?: ContentEntryUsageKind
) {
  const records: EntryRecord[] = [];

  for (const bundle of bundles) {
    if (bundle.mediaSlug !== mediaSlug) {
      continue;
    }

    if (!kind || kind === "term") {
      records.push(
        ...bundle.terms.map((entry) => ({
          entry,
          mediaBundle: bundle
        }))
      );
    }

    if (!kind || kind === "grammar") {
      records.push(
        ...bundle.grammarPatterns.map((entry) => ({
          entry,
          mediaBundle: bundle
        }))
      );
    }
  }

  return records;
}

function collectSurfaceMatches(records: EntryRecord[], surface: string) {
  const normalizedSurface = normalizeEntryText(surface);

  if (normalizedSurface.length === 0) {
    throw new Error("Missing --entry-id or --surface.");
  }

  return records.filter((record) =>
    collectEntryMatchTexts(record.entry).some(
      (value) => normalizeEntryText(value) === normalizedSurface
    )
  );
}

function collectEntryMatchTexts(
  entry: NormalizedGrammarPattern | NormalizedTerm
) {
  return entry.kind === "term"
    ? [entry.lemma, entry.reading, entry.romaji, ...entry.aliases]
    : [entry.pattern, entry.reading ?? "", ...entry.aliases];
}

function buildEntry(
  entry: NormalizedGrammarPattern | NormalizedTerm,
  status: ContentEntryUsageStatus
) {
  return {
    audio: entry.audio ? "ok" : "missing",
    display: entry.kind === "term" ? entry.lemma : entry.pattern,
    id: entry.id,
    kind: entry.kind,
    meaning_it: entry.meaningIt,
    ...(entry.pitchAccent !== undefined
      ? { pitch_accent: entry.pitchAccent }
      : {}),
    ...(entry.reading ? { reading: entry.reading } : {}),
    status
  } satisfies EntryUsageEntry;
}

function buildCandidate(record: EntryRecord) {
  const entry = record.entry;

  return {
    cards: record.mediaBundle.cards.filter(
      (card) => card.entryType === entry.kind && card.entryId === entry.id
    ).length,
    display: entry.kind === "term" ? entry.lemma : entry.pattern,
    id: entry.id,
    kind: entry.kind,
    media_slug: record.mediaBundle.mediaSlug,
    ...(entry.reading ? { reading: entry.reading } : {})
  } satisfies EntryUsageCandidate;
}

function buildSource(
  entry: NormalizedGrammarPattern | NormalizedTerm,
  documentIndex: EntryUsageDocumentIndex,
  repositoryRoot: string
) {
  const entryKey = `${entry.kind}:${entry.id}`;

  return {
    document: entry.source.documentKind,
    file: relativeSource(entry.source.filePath, repositoryRoot),
    ...(documentIndex.entryLines.get(entryKey) !== undefined
      ? { line: documentIndex.entryLines.get(entryKey)! }
      : {}),
    ...(entry.source.segmentRef ? { segment_ref: entry.source.segmentRef } : {})
  } satisfies ContentEntryUsageResult["source"];
}

function buildCard(
  card: NormalizedCard,
  lessonById: Map<string, EntryUsageLesson>,
  documentIndex: EntryUsageDocumentIndex,
  repositoryRoot: string
) {
  return {
    front: compactText(card.front),
    id: card.id,
    ...(lessonById.get(card.lessonId)
      ? { lesson_slug: lessonById.get(card.lessonId)!.slug }
      : {}),
    ...(documentIndex.cardLines.get(card.id) !== undefined
      ? { line: documentIndex.cardLines.get(card.id)! }
      : {}),
    source: relativeSource(card.source.filePath, repositoryRoot),
    type: card.cardType
  } satisfies EntryUsageCard;
}

function buildReference(input: {
  cardById: Map<string, NormalizedCard>;
  documentIndex: EntryUsageDocumentIndex;
  lessonById: Map<string, EntryUsageLesson>;
  reference: CollectedReference;
  repositoryRoot: string;
  sourceLineResolver: SourceLineResolver;
}) {
  const owner = findBlockOwner(input.documentIndex, input.reference);
  const card = owner?.cardId ? input.cardById.get(owner.cardId) : undefined;
  const lesson =
    input.reference.sourceDocumentId &&
    input.reference.sourceDocumentKind === "lesson"
      ? input.lessonById.get(input.reference.sourceDocumentId)
      : card
        ? input.lessonById.get(card.lessonId)
        : undefined;
  const line = input.sourceLineResolver(input.reference);

  return {
    ...(owner?.cardId ? { card_id: owner.cardId } : {}),
    display: input.reference.display,
    document: input.reference.sourceDocumentKind,
    field: classifyReferenceField(input.reference, owner),
    ...(lesson ? { lesson_slug: lesson.slug } : {}),
    ...(line !== undefined ? { line } : {}),
    source: relativeSource(input.reference.sourceFile, input.repositoryRoot),
    source_path: input.reference.sourcePath
  } satisfies EntryUsageReference;
}

type EntryUsageLesson = {
  order: number;
  slug: string;
};

function buildLessonById(mediaBundle: NormalizedMediaBundle) {
  return new Map(
    mediaBundle.lessons.map((lesson) => [
      lesson.frontmatter.id,
      {
        order: lesson.frontmatter.order,
        slug: lesson.frontmatter.slug
      } satisfies EntryUsageLesson
    ])
  );
}

function collectLessonSlugs(input: {
  cardById: Map<string, NormalizedCard>;
  cards: NormalizedCard[];
  documentIndex: EntryUsageDocumentIndex;
  lessonById: Map<string, EntryUsageLesson>;
  references: CollectedReference[];
}) {
  const lessons = new Set<string>();

  for (const card of input.cards) {
    const lesson = input.lessonById.get(card.lessonId);

    if (lesson) {
      lessons.add(lesson.slug);
    }
  }

  for (const reference of input.references) {
    const lesson =
      reference.sourceDocumentKind === "lesson" && reference.sourceDocumentId
        ? input.lessonById.get(reference.sourceDocumentId)
        : undefined;

    if (lesson) {
      lessons.add(lesson.slug);
      continue;
    }

    const owner = findBlockOwner(input.documentIndex, reference);
    const card = owner?.cardId ? input.cardById.get(owner.cardId) : undefined;
    const cardLesson = card ? input.lessonById.get(card.lessonId) : undefined;

    if (cardLesson) {
      lessons.add(cardLesson.slug);
    }
  }

  return lessons;
}

function buildDocumentIndex(mediaBundle: NormalizedMediaBundle) {
  const blockOwners = new Map<string, SourceBlockOwner>();
  const cardLines = new Map<string, number>();
  const entryLines = new Map<string, number>();

  for (const document of [...mediaBundle.lessons, ...mediaBundle.cardFiles]) {
    for (const [index, block] of document.body.blocks.entries()) {
      const blockKey = `${document.sourceFile}:body.blocks[${index}]`;

      blockOwners.set(blockKey, buildBlockOwner(block));

      if (block.type === "cardDefinition") {
        const line = block.position?.start.line;

        if (line !== undefined) {
          cardLines.set(block.card.id, line);
        }
      }

      if (block.type === "termDefinition") {
        const line = block.position?.start.line;

        if (line !== undefined) {
          entryLines.set(`term:${block.entry.id}`, line);
        }
      }

      if (block.type === "grammarDefinition") {
        const line = block.position?.start.line;

        if (line !== undefined) {
          entryLines.set(`grammar:${block.entry.id}`, line);
        }
      }
    }
  }

  return {
    blockOwners,
    cardLines,
    entryLines
  } satisfies EntryUsageDocumentIndex;
}

function buildBlockOwner(block: ContentBlock) {
  if (block.type === "cardDefinition") {
    return {
      blockType: block.type,
      cardId: block.card.id
    } satisfies SourceBlockOwner;
  }

  return {
    blockType: block.type
  } satisfies SourceBlockOwner;
}

function findBlockOwner(
  documentIndex: EntryUsageDocumentIndex,
  reference: CollectedReference
) {
  const match = /^body\.blocks\[(\d+)\]/u.exec(reference.sourcePath);

  if (!match) {
    return undefined;
  }

  return documentIndex.blockOwners.get(
    `${reference.sourceFile}:body.blocks[${match[1]}]`
  );
}

function classifyReferenceField(
  reference: CollectedReference,
  owner?: SourceBlockOwner
) {
  const sourcePath = reference.sourcePath;

  if (owner?.blockType === "cardDefinition") {
    if (sourcePath.includes(".front")) {
      return "card.front";
    }

    if (sourcePath.includes(".back")) {
      return "card.back";
    }

    if (sourcePath.includes(".example_jp")) {
      return "card.example_jp";
    }

    if (sourcePath.includes(".example_it")) {
      return "card.example_it";
    }

    if (sourcePath.includes(".notes_it")) {
      return "card.notes_it";
    }

    return "card.body";
  }

  if (sourcePath.includes(".caption")) {
    return "image.caption";
  }

  if (sourcePath.includes(".jp")) {
    return "example_sentence.jp";
  }

  if (sourcePath.includes(".translation_it")) {
    return "example_sentence.translation_it";
  }

  if (sourcePath.includes(".notes_it")) {
    if (owner?.blockType === "termDefinition") {
      return "term.notes_it";
    }

    if (owner?.blockType === "grammarDefinition") {
      return "grammar.notes_it";
    }

    return "definition.notes_it";
  }

  if (reference.sourceDocumentKind === "lesson") {
    return "lesson.body";
  }

  if (reference.sourceDocumentKind === "cards") {
    return "cards.body";
  }

  return "media.body";
}

function compareCards(left: NormalizedCard, right: NormalizedCard) {
  return (
    left.source.filePath.localeCompare(right.source.filePath) ||
    left.source.sequence - right.source.sequence ||
    left.id.localeCompare(right.id)
  );
}

function compareReferences(
  left: CollectedReference,
  right: CollectedReference
) {
  return (
    compareDocumentKind(left.sourceDocumentKind, right.sourceDocumentKind) ||
    left.sourceFile.localeCompare(right.sourceFile) ||
    readReferenceLine(left) - readReferenceLine(right) ||
    left.sourcePath.localeCompare(right.sourcePath) ||
    left.display.localeCompare(right.display)
  );
}

function compareUsages(left: EntryUsageReference, right: EntryUsageReference) {
  return (
    compareDocumentKind(left.document, right.document) ||
    left.source.localeCompare(right.source) ||
    (left.line ?? Number.MAX_SAFE_INTEGER) -
      (right.line ?? Number.MAX_SAFE_INTEGER) ||
    left.source_path.localeCompare(right.source_path) ||
    left.display.localeCompare(right.display)
  );
}

function compareDocumentKind(
  left: CollectedReference["sourceDocumentKind"],
  right: CollectedReference["sourceDocumentKind"]
) {
  return readDocumentKindRank(left) - readDocumentKindRank(right);
}

function readDocumentKindRank(kind: CollectedReference["sourceDocumentKind"]) {
  switch (kind) {
    case "lesson":
      return 0;
    case "cards":
      return 1;
    case "media":
      return 2;
  }
}

function readReferenceLine(reference: CollectedReference) {
  return reference.location?.start.line ?? Number.MAX_SAFE_INTEGER;
}

function compactText(value: RichTextFragment) {
  const compact = stripInlineMarkdown(value.raw).replace(/\s+/gu, " ").trim();

  if (compact.length <= 120) {
    return compact;
  }

  return `${compact.slice(0, 117)}...`;
}

function normalizeEntryText(value: string) {
  return normalizeSearchText(stripInlineMarkdown(value))
    .replace(/[~〜～]/gu, "～")
    .trim();
}

function clampLimit(value: number, max = 20) {
  return Math.min(Math.max(1, value), max);
}

function quoteForLine(value: string) {
  return JSON.stringify(value);
}

function relativeSource(filePath: string, repositoryRoot: string) {
  const relative = path
    .relative(repositoryRoot, path.resolve(filePath))
    .replaceAll("\\", "/");

  return relative.startsWith("..") || path.isAbsolute(relative)
    ? filePath.replaceAll("\\", "/")
    : relative;
}
