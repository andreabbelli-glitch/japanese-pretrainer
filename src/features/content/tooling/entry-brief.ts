import path from "node:path";

import { normalizeSearchText } from "../../study/model/search.ts";
import { stripInlineMarkdown } from "../../study/model/inline-markdown.ts";
import type {
  CollectedReference,
  NormalizedCard,
  NormalizedGrammarPattern,
  NormalizedMediaBundle,
  NormalizedTerm,
  RichTextFragment
} from "../types.ts";

export type ContentEntryBriefKind = "grammar" | "term";

const maxAmbiguousCandidates = 10;
const maxLessonLimit = 10;

export type ContentEntryBriefResult = {
  cards: EntryBriefCard[];
  entry: EntryBriefEntry;
  lessons: EntryBriefLesson[];
  media: {
    slug: string;
    title?: string;
  };
  references: EntryBriefReference[];
  schema_version: 1;
  source: {
    file: string;
    document: "cards" | "lesson";
    segment_ref?: string;
  };
  truncated: {
    cards: boolean;
    lessons: boolean;
    references: boolean;
  };
};

export type ContentEntryBriefAmbiguousResult = {
  candidates: EntryBriefCandidate[];
  error: "ambiguous";
  query: string;
  schema_version: 1;
  total_matches: number;
  truncated: {
    candidates: boolean;
  };
};

export type EntryBriefEntry = {
  audio: "missing" | "ok";
  display: string;
  id: string;
  kind: ContentEntryBriefKind;
  meaning_it: string;
  pitch_accent?: number;
  reading?: string;
};

export type EntryBriefCard = {
  back: string;
  front: string;
  id: string;
  lesson_slug?: string;
  type: string;
};

export type EntryBriefLesson = {
  order: number;
  slug: string;
  title: string;
};

export type EntryBriefReference = {
  display: string;
  file: string;
  lesson_slug?: string;
};

export type EntryBriefCandidate = {
  audio: "missing" | "ok";
  cards: number;
  display: string;
  id: string;
  kind: ContentEntryBriefKind;
  media_slug: string;
  reading?: string;
};

type EntryRecord = {
  entry: NormalizedGrammarPattern | NormalizedTerm;
  mediaBundle: NormalizedMediaBundle;
};

export function buildContentEntryBrief(input: {
  bundles: NormalizedMediaBundle[];
  cardLimit?: number;
  entryId?: string;
  kind?: ContentEntryBriefKind;
  mediaSlug?: string;
  query?: string;
  referenceLimit?: number;
  repositoryRoot?: string;
}) {
  const repositoryRoot = input.repositoryRoot ?? process.cwd();
  const cardLimit = clampLimit(input.cardLimit ?? 5);
  const referenceLimit = clampLimit(input.referenceLimit ?? 5);
  const records = collectEntryRecords(
    input.bundles,
    input.mediaSlug,
    input.kind
  );
  const matches = input.entryId
    ? records.filter((record) => record.entry.id === input.entryId)
    : collectQueryMatches(records, input.query ?? "");

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
      query: input.entryId ?? input.query ?? "",
      schema_version: 1,
      total_matches: matches.length,
      truncated: {
        candidates: matches.length > maxAmbiguousCandidates
      }
    } satisfies ContentEntryBriefAmbiguousResult;
  }

  const record = matches[0]!;
  const cards = record.mediaBundle.cards
    .filter(
      (card) =>
        card.entryType === record.entry.kind && card.entryId === record.entry.id
    )
    .sort(compareCards);
  const references = dedupeReferences(
    record.mediaBundle.references
      .filter(
        (reference) =>
          reference.referenceType === record.entry.kind &&
          reference.targetId === record.entry.id
      )
      .sort(compareReferences)
  );
  const lessonById = new Map(
    record.mediaBundle.lessons.map((lesson) => [
      lesson.frontmatter.id,
      {
        order: lesson.frontmatter.order,
        slug: lesson.frontmatter.slug,
        title: lesson.frontmatter.title
      } satisfies EntryBriefLesson
    ])
  );
  const lessons = new Map<string, EntryBriefLesson>();

  for (const card of cards) {
    const lesson = lessonById.get(card.lessonId);

    if (lesson) {
      lessons.set(lesson.slug, lesson);
    }
  }

  for (const reference of references) {
    const lesson = reference.sourceDocumentId
      ? lessonById.get(reference.sourceDocumentId)
      : undefined;

    if (lesson) {
      lessons.set(lesson.slug, lesson);
    }
  }
  const sortedLessons = [...lessons.values()].sort(
    (left, right) => left.order - right.order
  );

  return {
    cards: cards.slice(0, cardLimit).map((card) => buildCard(card, lessonById)),
    entry: buildEntry(record.entry),
    lessons: sortedLessons.slice(0, maxLessonLimit),
    media: {
      slug: record.mediaBundle.mediaSlug,
      ...(record.mediaBundle.media?.frontmatter.title
        ? { title: record.mediaBundle.media.frontmatter.title }
        : {})
    },
    references: references
      .slice(0, referenceLimit)
      .map((reference) =>
        buildReference(reference, lessonById, repositoryRoot)
      ),
    schema_version: 1,
    source: {
      document: record.entry.source.documentKind,
      file: relativeSource(record.entry.source.filePath, repositoryRoot),
      ...(record.entry.source.segmentRef
        ? { segment_ref: record.entry.source.segmentRef }
        : {})
    },
    truncated: {
      cards: cards.length > cardLimit,
      lessons: sortedLessons.length > maxLessonLimit,
      references: references.length > referenceLimit
    }
  } satisfies ContentEntryBriefResult;
}

export function formatContentEntryBrief(
  result: ContentEntryBriefAmbiguousResult | ContentEntryBriefResult
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
      result.source.segment_ref ? `segment=${result.source.segment_ref}` : null
    ]
      .filter((value): value is string => value !== null)
      .join(" ")
  ];

  for (const lesson of result.lessons) {
    lines.push(
      `LESSON ${lesson.slug} order=${lesson.order} title=${quoteForLine(lesson.title)}`
    );
  }
  if (result.truncated.lessons) {
    lines.push("NOTE lessons truncated; narrow by lesson context if needed.");
  }

  lines.push(
    `CARDS ${result.cards.length}${result.truncated.cards ? "+" : ""}`
  );
  for (const card of result.cards) {
    lines.push(
      [
        "CARD",
        card.id,
        `type=${card.type}`,
        card.lesson_slug ? `lesson=${card.lesson_slug}` : null,
        `front=${quoteForLine(card.front)}`,
        `back=${quoteForLine(card.back)}`
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );
  }

  lines.push(
    `REFERENCES ${result.references.length}${result.truncated.references ? "+" : ""}`
  );
  for (const reference of result.references) {
    lines.push(
      [
        "REF",
        reference.file,
        reference.lesson_slug ? `lesson=${reference.lesson_slug}` : null,
        `display=${quoteForLine(reference.display)}`
      ]
        .filter((value): value is string => value !== null)
        .join(" ")
    );
  }

  return `${lines.join("\n")}\n`;
}

function formatAmbiguousResult(result: ContentEntryBriefAmbiguousResult) {
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
        `cards=${candidate.cards}`,
        `audio=${candidate.audio}`
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
  mediaSlug?: string,
  kind?: ContentEntryBriefKind
) {
  const records: EntryRecord[] = [];

  for (const bundle of bundles) {
    if (mediaSlug && bundle.mediaSlug !== mediaSlug) {
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

function collectQueryMatches(records: EntryRecord[], query: string) {
  const normalizedQuery = normalizeEntryText(query);

  if (normalizedQuery.length === 0) {
    throw new Error("Missing entry query or --entry-id.");
  }

  return records.filter((record) =>
    collectEntryMatchTexts(record.entry).some(
      (value) => normalizeEntryText(value) === normalizedQuery
    )
  );
}

function collectEntryMatchTexts(
  entry: NormalizedGrammarPattern | NormalizedTerm
) {
  return entry.kind === "term"
    ? [entry.lemma, entry.reading, entry.romaji, ...entry.aliases]
    : [entry.pattern, entry.reading ?? "", entry.title, ...entry.aliases];
}

function buildEntry(entry: NormalizedGrammarPattern | NormalizedTerm) {
  return {
    audio: entry.audio ? "ok" : "missing",
    display: entry.kind === "term" ? entry.lemma : entry.pattern,
    id: entry.id,
    kind: entry.kind,
    meaning_it: entry.meaningIt,
    ...(entry.pitchAccent !== undefined
      ? { pitch_accent: entry.pitchAccent }
      : {}),
    ...(entry.reading ? { reading: entry.reading } : {})
  } satisfies EntryBriefEntry;
}

function buildCandidate(record: EntryRecord) {
  const entry = record.entry;
  const cards = record.mediaBundle.cards.filter(
    (card) => card.entryType === entry.kind && card.entryId === entry.id
  );

  return {
    audio: entry.audio ? "ok" : "missing",
    cards: cards.length,
    display: entry.kind === "term" ? entry.lemma : entry.pattern,
    id: entry.id,
    kind: entry.kind,
    media_slug: record.mediaBundle.mediaSlug,
    ...(entry.reading ? { reading: entry.reading } : {})
  } satisfies EntryBriefCandidate;
}

function buildCard(
  card: NormalizedCard,
  lessonById: Map<string, EntryBriefLesson>
) {
  return {
    back: compactText(card.back),
    front: compactText(card.front),
    id: card.id,
    type: card.cardType,
    ...(lessonById.get(card.lessonId)
      ? { lesson_slug: lessonById.get(card.lessonId)!.slug }
      : {})
  } satisfies EntryBriefCard;
}

function buildReference(
  reference: CollectedReference,
  lessonById: Map<string, EntryBriefLesson>,
  repositoryRoot: string
) {
  const lesson = reference.sourceDocumentId
    ? lessonById.get(reference.sourceDocumentId)
    : undefined;

  return {
    display: reference.display,
    file: relativeSource(reference.sourceFile, repositoryRoot),
    ...(lesson ? { lesson_slug: lesson.slug } : {})
  } satisfies EntryBriefReference;
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
    left.sourceFile.localeCompare(right.sourceFile) ||
    left.sourcePath.localeCompare(right.sourcePath) ||
    left.display.localeCompare(right.display)
  );
}

function dedupeReferences(references: CollectedReference[]) {
  const seen = new Set<string>();
  const deduped: CollectedReference[] = [];

  for (const reference of references) {
    const key = [
      reference.sourceFile,
      reference.sourceDocumentId ?? "",
      reference.display
    ].join(":");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(reference);
  }

  return deduped;
}

function compactText(value: RichTextFragment) {
  const compact = stripInlineMarkdown(value.raw).replace(/\s+/gu, " ").trim();

  if (compact.length <= 140) {
    return compact;
  }

  return `${compact.slice(0, 137)}...`;
}

function clampLimit(value: number) {
  return Math.min(Math.max(1, value), 20);
}

function normalizeEntryText(value: string) {
  return normalizeSearchText(stripInlineMarkdown(value))
    .replace(/[~〜～]/gu, "～")
    .trim();
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
