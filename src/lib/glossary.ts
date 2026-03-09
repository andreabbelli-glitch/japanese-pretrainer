import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";

import {
  db,
  getGrammarEntryById,
  getMediaBySlug,
  getTermEntryById,
  listEntryCardConnections,
  listEntryLessonConnections,
  listEntryStudySignals,
  listGlossarySegmentsByMediaId,
  listGrammarEntriesByMediaId,
  listTermEntriesByMediaId,
  type DatabaseClient,
  type EntryCardConnection,
  type EntryLessonConnection,
  type GlossaryEntryRef,
  type GrammarGlossaryEntry,
  type TermGlossaryEntry
} from "@/db";
import {
  mediaGlossaryEntryHref,
  mediaReviewCardHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/lib/site";
import {
  getGlossaryDefaultSort,
  type GlossaryDefaultSort
} from "@/lib/settings";
import { deriveEntryStudyState } from "@/lib/study-entry";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatMediaTypeLabel,
  formatReviewStateLabel,
  formatSegmentKindLabel
} from "@/lib/study-format";
import {
  compactLatinSearchText,
  foldJapaneseKana,
  normalizeGrammarSearchText,
  normalizeSearchText,
  romanizeKanaForSearch
} from "@/lib/study-search";
import { getRenderSafeText } from "@/lib/render-safe-text";

type StudySignalRow = Awaited<ReturnType<typeof listEntryStudySignals>>[number];

type GlossaryKind = "term" | "grammar";

type GlossaryBaseEntry = {
  id: string;
  kind: GlossaryKind;
  label: string;
  title?: string;
  reading?: string;
  romaji?: string;
  meaning: string;
  literalMeaning?: string;
  notes?: string;
  pos?: string;
  levelHint?: string;
  segmentId: string | null;
  segmentTitle?: string;
  aliases: Array<{
    text: string;
    normalized: string;
    type?: string;
  }>;
  entryStatus: string | null;
  lemmaNorm: string;
  readingNorm?: string;
  romajiNorm?: string;
  meaningNorm: string;
  literalMeaningNorm?: string;
  notesNorm?: string;
  titleNorm?: string;
  patternNorm?: string;
};

export type GlossaryMatchMode =
  | "normalized"
  | "kana"
  | "grammarKana"
  | "romajiCompact";

type GlossaryMatchField =
  | "alias"
  | "label"
  | "literalMeaning"
  | "meaning"
  | "notes"
  | "reading"
  | "romaji"
  | "title";

type GlossaryCollectedMatch = {
  badge: string;
  field: GlossaryMatchField;
  mode: GlossaryMatchMode;
  preview?: string;
  score: number;
};

type RankedGlossaryEntry = GlossaryBaseEntry & {
  href: Route;
  matchBadges: string[];
  matchPreview?: string;
  matchedFields: {
    aliases: Array<{
      mode: GlossaryMatchMode;
      text: string;
    }>;
    label?: GlossaryMatchMode;
    meaning?: GlossaryMatchMode;
    reading?: GlossaryMatchMode;
    romaji?: GlossaryMatchMode;
    title?: GlossaryMatchMode;
  };
  score: number;
  studyState: ReturnType<typeof deriveEntryStudyState>;
};

type FilteredQuery = {
  normalized: string;
  kana: string;
  grammarKana: string;
  romajiCompact: string;
};

export type GlossaryQueryState = {
  entryType: "all" | GlossaryKind;
  query: string;
  segmentId: string;
  sort: GlossaryDefaultSort;
  study: "all" | "known" | "review" | "learning" | "new" | "available";
};

type GlossaryMediaSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  glossaryHref: Route;
  mediaTypeLabel: string;
  segmentKindLabel: string;
  textbookHref: Route;
};

export type GlossaryPageData = {
  filters: GlossaryQueryState;
  hasActiveFilters: boolean;
  media: GlossaryMediaSummary;
  resultSummary: {
    filtered: number;
    total: number;
    queryLabel?: string;
  };
  results: Array<
    RankedGlossaryEntry & {
      cardCount: number;
      cardPreview?: string;
      lessonCount: number;
      primaryLesson?: {
        href: Route;
        roleLabel: string;
        title: string;
      };
    }
  >;
  preview?: GlossaryDetailData;
  segments: Array<{
    id: string;
    label: string;
  }>;
  stats: {
    grammarCount: number;
    knownCount: number;
    reviewCount: number;
    termCount: number;
  };
};

type GlossaryDetailLesson = {
  href: Route;
  id: string;
  roleLabels: string[];
  segmentTitle?: string;
  summary?: string;
  title: string;
};

type GlossaryDetailCard = {
  back: string;
  dueLabel?: string;
  front: string;
  id: string;
  relationshipLabel: string;
  href: Route;
  reviewLabel: string;
  segmentTitle?: string;
  typeLabel: string;
  notes?: string;
};

export type GlossaryDetailData = {
  cards: GlossaryDetailCard[];
  entry: RankedGlossaryEntry & {
    aliasGroups: Array<{
      label: string;
      values: string[];
    }>;
  };
  lessons: GlossaryDetailLesson[];
  media: GlossaryMediaSummary;
  related: {
    cardsLabel: string;
    primaryLessonLabel: string;
  };
};

type AggregatedLessonConnection = {
  lessonId: string;
  lessonOrderIndex: number;
  lessonSlug: string;
  lessonSummary: string | null;
  lessonTitle: string;
  linkRoles: EntryLessonConnection["linkRole"][];
  segmentTitle: string | null;
  sortOrder: number | null;
};

const studyFilterOptions: GlossaryQueryState["study"][] = [
  "all",
  "known",
  "review",
  "learning",
  "new",
  "available"
];

export async function getGlossaryPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryPageData | null> {
  markDataAsLive();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const defaultSort = await getGlossaryDefaultSort(database);
  const filters = normalizeGlossaryQuery(searchParams, defaultSort);
  const [segments, entries] = await Promise.all([
    listGlossarySegmentsByMediaId(database, media.id),
    loadGlossaryBaseEntries(database, media.id)
  ]);
  const studySignalsByEntry = await loadStudySignalsByEntry(
    database,
    entries.map((entry) => ({
      entryId: entry.id,
      entryType: entry.kind
    }))
  );

  const rankedEntries = entries
    .map((entry) =>
      rankGlossaryEntry(entry, filters, studySignalsByEntry, media.slug)
    )
    .filter((entry): entry is RankedGlossaryEntry => entry !== null)
    .sort((left, right) =>
      compareRankedEntries(left, right, {
        hasQuery: filters.query.length > 0,
        segments,
        sort: filters.sort
      })
    );

  const resultRefs = rankedEntries.map((entry) => ({
    entryId: entry.id,
    entryType: entry.kind
  }));
  const [lessonConnections, cardConnections] = await Promise.all([
    listEntryLessonConnections(database, resultRefs),
    listEntryCardConnections(database, resultRefs)
  ]);
  const lessonsByEntry = groupRowsByEntry(lessonConnections);
  const cardsByEntry = groupRowsByEntry(cardConnections);
  const mediaSummary = buildGlossaryMediaSummary(media);

  const results = rankedEntries.map((entry) => {
    const lessonRows = lessonsByEntry.get(`${entry.kind}:${entry.id}`) ?? [];
    const cardRows = cardsByEntry.get(`${entry.kind}:${entry.id}`) ?? [];
    const uniqueLessons = aggregateLessonConnections(lessonRows);
    const primaryLesson = pickPrimaryLesson(uniqueLessons, media.slug);
    const firstCard = cardRows[0];

    return {
      ...entry,
      cardCount: cardRows.length,
      cardPreview: firstCard
        ? `${firstCard.cardFront} -> ${firstCard.cardBack}`
        : undefined,
      lessonCount: uniqueLessons.length,
      primaryLesson
    };
  });
  const selectedPreviewEntry = resolvePreviewEntry(searchParams, results);
  const preview = selectedPreviewEntry
    ? buildGlossaryDetailData({
        cardConnections:
          cardsByEntry.get(
            `${selectedPreviewEntry.kind}:${selectedPreviewEntry.id}`
          ) ?? [],
        entry: selectedPreviewEntry,
        lessonConnections:
          lessonsByEntry.get(
            `${selectedPreviewEntry.kind}:${selectedPreviewEntry.id}`
          ) ?? [],
        media: mediaSummary
      })
    : undefined;

  return {
    filters,
    hasActiveFilters:
      filters.query.length > 0 ||
      filters.entryType !== "all" ||
      filters.segmentId !== "all" ||
      filters.study !== "all" ||
      filters.sort !== defaultSort,
    media: mediaSummary,
    resultSummary: {
      filtered: rankedEntries.length,
      total: entries.length,
      queryLabel: filters.query || undefined
    },
    preview,
    results,
    segments: [
      {
        id: "all",
        label: "Tutti i segmenti"
      },
      ...segments.map((segment) => ({
        id: segment.id,
        label: segment.title
      }))
    ],
    stats: buildGlossaryStats(entries, studySignalsByEntry)
  };
}

export async function getTermGlossaryDetailData(
  mediaSlug: string,
  entryId: string,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  return getGlossaryDetailData(mediaSlug, "term", entryId, database);
}

export async function getGrammarGlossaryDetailData(
  mediaSlug: string,
  entryId: string,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  return getGlossaryDetailData(mediaSlug, "grammar", entryId, database);
}

async function getGlossaryDetailData(
  mediaSlug: string,
  kind: GlossaryKind,
  entryId: string,
  database: DatabaseClient
): Promise<GlossaryDetailData | null> {
  markDataAsLive();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const entry =
    kind === "term"
      ? await getTermEntryById(database, entryId)
      : await getGrammarEntryById(database, entryId);

  if (!entry || entry.mediaId !== media.id) {
    return null;
  }

  const [studySignals, lessonConnections, cardConnections] = await Promise.all([
    listEntryStudySignals(database, [
      {
        entryId,
        entryType: kind
      }
    ]),
    listEntryLessonConnections(database, [
      {
        entryId,
        entryType: kind
      }
    ]),
    listEntryCardConnections(database, [
      {
        entryId,
        entryType: kind
      }
    ])
  ]);
  const entryStudySignals = studySignals.map((signal) => ({
    manualOverride: signal.manualOverride,
    reviewState: signal.reviewState
  }));
  const baseEntry =
    kind === "term"
      ? mapEntryToBaseModel(entry as TermGlossaryEntry, "term")
      : mapEntryToBaseModel(entry as GrammarGlossaryEntry, "grammar");
  const rankedEntry = {
    ...baseEntry,
    href: mediaGlossaryEntryHref(media.slug, kind, entryId),
    matchBadges: [],
    matchedFields: {
      aliases: []
    },
    score: 0,
    studyState: deriveEntryStudyState(entry.status?.status ?? null, entryStudySignals)
  };

  return buildGlossaryDetailData({
    cardConnections,
    entry: rankedEntry,
    lessonConnections,
    media: buildGlossaryMediaSummary(media)
  });
}

async function loadGlossaryBaseEntries(
  database: DatabaseClient,
  mediaId: string
) {
  const [terms, grammar] = await Promise.all([
    listTermEntriesByMediaId(database, mediaId),
    listGrammarEntriesByMediaId(database, mediaId)
  ]);

  return [
    ...terms.map((entry) => mapEntryToBaseModel(entry, "term")),
    ...grammar.map((entry) => mapEntryToBaseModel(entry, "grammar"))
  ];
}

async function loadStudySignalsByEntry(
  database: DatabaseClient,
  entries: GlossaryEntryRef[]
) {
  const rows = await listEntryStudySignals(database, entries);

  return buildStudySignalMap(rows);
}

function buildGlossaryMediaSummary(
  media: NonNullable<Awaited<ReturnType<typeof getMediaBySlug>>>
): GlossaryMediaSummary {
  return {
    id: media.id,
    slug: media.slug,
    title: media.title,
    description:
      media.description ??
      `${media.title} usa il glossary come strumento di lookup rapido dentro il percorso di studio.`,
    glossaryHref: mediaStudyHref(media.slug, "glossary"),
    mediaTypeLabel: formatMediaTypeLabel(media.mediaType),
    segmentKindLabel: formatSegmentKindLabel(media.segmentKind),
    textbookHref: mediaStudyHref(media.slug, "textbook")
  };
}

function buildGlossaryDetailData(input: {
  cardConnections: EntryCardConnection[];
  entry: RankedGlossaryEntry;
  lessonConnections: EntryLessonConnection[];
  media: GlossaryMediaSummary;
}): GlossaryDetailData {
  const lessons = aggregateLessonConnections(input.lessonConnections);
  const primaryLesson = pickPrimaryLesson(lessons, input.media.slug);
  const forceKnownReviewLabel = input.entry.studyState.hasKnownSignal;

  return {
    entry: {
      ...input.entry,
      aliasGroups: groupAliasesForDetail(input.entry.aliases)
    },
    lessons: lessons.map((lesson) => ({
      href: mediaTextbookLessonHref(input.media.slug, lesson.lessonSlug),
      id: lesson.lessonId,
      roleLabels: lesson.linkRoles.map((role) => formatEntryLinkRole(role)),
      segmentTitle: lesson.segmentTitle ?? undefined,
      summary: lesson.lessonSummary ?? undefined,
      title: lesson.lessonTitle
    })),
    cards: input.cardConnections.map((row) => ({
      back: row.cardBack,
      dueLabel: row.dueAt ? `Scadenza ${formatShortIsoDate(row.dueAt)}` : undefined,
      front: row.cardFront,
      href: mediaReviewCardHref(input.media.slug, row.cardId),
      id: row.cardId,
      relationshipLabel: formatCardRelationshipLabel(row.relationshipType),
      reviewLabel: forceKnownReviewLabel
        ? "Gia nota"
        : formatReviewStateLabel(row.reviewState, row.manualOverride ?? false),
      segmentTitle: row.segmentTitle ?? undefined,
      typeLabel: capitalizeToken(row.cardType),
      notes: getRenderSafeText(row.cardNotesIt)
    })),
    media: input.media,
    related: {
      cardsLabel:
        input.cardConnections.length === 1
          ? "1 card collegata"
          : `${input.cardConnections.length} card collegate`,
      primaryLessonLabel: primaryLesson
        ? `${primaryLesson.roleLabel} in ${primaryLesson.title}`
        : "Nessuna lesson collegata"
    }
  };
}

function mapEntryToBaseModel(entry: TermGlossaryEntry, kind: "term"): GlossaryBaseEntry;
function mapEntryToBaseModel(
  entry: GrammarGlossaryEntry,
  kind: "grammar"
): GlossaryBaseEntry;
function mapEntryToBaseModel(
  entry: TermGlossaryEntry | GrammarGlossaryEntry,
  kind: GlossaryKind
): GlossaryBaseEntry {
  if (kind === "term") {
    const termEntry = entry as TermGlossaryEntry;

    return {
      id: termEntry.id,
      kind,
      label: termEntry.lemma,
      reading: termEntry.reading,
      romaji: termEntry.romaji,
      meaning: termEntry.meaningIt,
      literalMeaning: termEntry.meaningLiteralIt ?? undefined,
      notes: getRenderSafeText(termEntry.notesIt),
      pos: termEntry.pos ?? undefined,
      levelHint: termEntry.levelHint ?? undefined,
      segmentId: termEntry.segmentId,
      segmentTitle: termEntry.segment?.title ?? undefined,
      aliases: termEntry.aliases.map((alias) => ({
        text: alias.aliasText,
        normalized: alias.aliasNorm,
        type: alias.aliasType
      })),
      entryStatus: termEntry.status?.status ?? null,
      lemmaNorm: termEntry.searchLemmaNorm,
      readingNorm: termEntry.searchReadingNorm,
      romajiNorm: termEntry.searchRomajiNorm,
      meaningNorm: normalizeSearchText(termEntry.meaningIt),
      literalMeaningNorm: termEntry.meaningLiteralIt
        ? normalizeSearchText(termEntry.meaningLiteralIt)
        : undefined,
      notesNorm: getRenderSafeText(termEntry.notesIt)
        ? normalizeSearchText(getRenderSafeText(termEntry.notesIt) ?? "")
        : undefined
    };
  }

  const grammarEntry = entry as GrammarGlossaryEntry;

  return {
    id: grammarEntry.id,
    kind,
    label: grammarEntry.pattern,
    title: grammarEntry.title,
    meaning: grammarEntry.meaningIt,
    notes: getRenderSafeText(grammarEntry.notesIt),
    levelHint: grammarEntry.levelHint ?? undefined,
    segmentId: grammarEntry.segmentId,
    segmentTitle: grammarEntry.segment?.title ?? undefined,
    aliases: grammarEntry.aliases.map((alias) => ({
      text: alias.aliasText,
      normalized: alias.aliasNorm
    })),
    entryStatus: grammarEntry.status?.status ?? null,
    lemmaNorm: grammarEntry.searchPatternNorm,
    romajiNorm: romanizeKanaForSearch(grammarEntry.searchPatternNorm),
    patternNorm: grammarEntry.searchPatternNorm,
    meaningNorm: normalizeSearchText(grammarEntry.meaningIt),
    titleNorm: normalizeSearchText(grammarEntry.title),
    notesNorm: getRenderSafeText(grammarEntry.notesIt)
      ? normalizeSearchText(getRenderSafeText(grammarEntry.notesIt) ?? "")
      : undefined
  };
}

function normalizeGlossaryQuery(
  searchParams: Record<string, string | string[] | undefined>,
  defaultSort: GlossaryDefaultSort
): GlossaryQueryState {
  const rawQuery = readSearchParam(searchParams, "q");
  const rawType = readSearchParam(searchParams, "type");
  const rawSegment = readSearchParam(searchParams, "segment");
  const rawSort = readSearchParam(searchParams, "sort");
  const rawStudy = readSearchParam(searchParams, "study");

  return {
    entryType:
      rawType === "term" || rawType === "grammar" ? rawType : "all",
    query: rawQuery,
    segmentId: rawSegment || "all",
    sort: rawSort === "alphabetical" || rawSort === "lesson_order" ? rawSort : defaultSort,
    study: studyFilterOptions.includes(rawStudy as GlossaryQueryState["study"])
      ? (rawStudy as GlossaryQueryState["study"])
      : "all"
  };
}

function rankGlossaryEntry(
  entry: GlossaryBaseEntry,
  filters: GlossaryQueryState,
  studySignalsByEntry: Map<string, StudySignalRow[]>,
  mediaSlug: string
): RankedGlossaryEntry | null {
  const studySignals = (studySignalsByEntry.get(`${entry.kind}:${entry.id}`) ?? []).map(
    (signal) => ({
      manualOverride: signal.manualOverride,
      reviewState: signal.reviewState
    })
  );
  const studyState = deriveEntryStudyState(entry.entryStatus, studySignals);

  if (filters.entryType !== "all" && entry.kind !== filters.entryType) {
    return null;
  }

  if (filters.segmentId !== "all" && entry.segmentId !== filters.segmentId) {
    return null;
  }

  if (filters.study !== "all" && studyState.key !== filters.study) {
    return null;
  }

  const query = buildFilteredQuery(filters.query);
  const matches = query ? collectMatches(entry, query) : [];

  if (query && matches.length === 0) {
    return null;
  }

  const sortedMatches = [...matches].sort((left, right) => right.score - left.score);
  const score =
    (sortedMatches[0]?.score ?? 0) + Math.max(Math.min(sortedMatches.length - 1, 4), 0) * 8;

  return {
    ...entry,
    href: mediaGlossaryEntryHref(mediaSlug, entry.kind, entry.id),
    matchBadges: [...new Set(sortedMatches.map((match) => match.badge))].slice(0, 3),
    matchPreview: sortedMatches[0]?.preview,
    matchedFields: buildMatchedFields(sortedMatches),
    score,
    studyState
  };
}

function collectMatches(entry: GlossaryBaseEntry, query: FilteredQuery) {
  const matches: GlossaryCollectedMatch[] = [];
  const compactRomaji = entry.romajiNorm
    ? compactLatinSearchText(entry.romajiNorm)
    : "";

  pushMatch(
    matches,
    "label",
    "kanji",
    "normalized",
    entry.label,
    query.normalized,
    280,
    230,
    190
  );

  if (entry.readingNorm) {
    pushMatch(
      matches,
      "reading",
      "lettura",
      "kana",
      entry.readingNorm,
      query.kana,
      270,
      225,
      185
    );
  }

  if (compactRomaji) {
    pushMatch(
      matches,
      "romaji",
      "romaji",
      "romajiCompact",
      compactRomaji,
      query.romajiCompact,
      255,
      215,
      175
    );
  }

  if (entry.kind === "grammar" && entry.titleNorm) {
    pushMatch(
      matches,
      "title",
      "titolo",
      "normalized",
      entry.titleNorm,
      query.normalized,
      220,
      180,
      140
    );
  }

  pushMeaningMatch(
    matches,
    "meaning",
    "significato",
    "normalized",
    entry.meaningNorm,
    query.normalized,
    210,
    170,
    132
  );

  if (entry.literalMeaningNorm) {
    pushMeaningMatch(
      matches,
      "literalMeaning",
      "letterale",
      "normalized",
      entry.literalMeaningNorm,
      query.normalized,
      165,
      135,
      110
    );
  }

  if (entry.notesNorm) {
    pushMeaningMatch(
      matches,
      "notes",
      "note",
      "normalized",
      entry.notesNorm,
      query.normalized,
      105,
      92,
      70
    );
  }

  if (entry.patternNorm) {
    pushMatch(
      matches,
      "label",
      "pattern",
      "grammarKana",
      foldJapaneseKana(entry.patternNorm),
      query.grammarKana,
      282,
      234,
      194
    );
  }

  for (const alias of entry.aliases) {
    const foldedAlias = foldJapaneseKana(
      entry.kind === "grammar"
        ? normalizeGrammarSearchText(alias.text)
        : alias.normalized
    );
    const aliasQuery = entry.kind === "grammar" ? query.grammarKana : query.kana;
    const label = alias.type === "romaji" ? "alias romaji" : "alias";

    pushMatch(
      matches,
      "alias",
      label,
      entry.kind === "grammar" ? "grammarKana" : "kana",
      foldedAlias,
      aliasQuery,
      235,
      195,
      152,
      alias.text
    );

    if (entry.kind === "grammar") {
      const aliasRomaji = romanizeKanaForSearch(alias.normalized);

      if (aliasRomaji && aliasRomaji !== compactLatinSearchText(foldedAlias)) {
        pushMatch(
          matches,
          "alias",
          "alias",
          "romajiCompact",
          aliasRomaji,
          query.romajiCompact,
          228,
          188,
          148,
          alias.text
        );
      }
    }
  }

  return matches;
}

function pushMatch(
  matches: GlossaryCollectedMatch[],
  field: GlossaryMatchField,
  badge: string,
  mode: GlossaryMatchMode,
  value: string,
  query: string,
  exactScore: number,
  prefixScore: number,
  containsScore: number,
  preview?: string
) {
  if (!query || !value) {
    return;
  }

  if (value === query) {
    matches.push({
      badge,
      field,
      mode,
      preview,
      score: exactScore
    });
    return;
  }

  if (value.startsWith(query)) {
    matches.push({
      badge,
      field,
      mode,
      preview,
      score: prefixScore
    });
    return;
  }

  if (value.includes(query)) {
    matches.push({
      badge,
      field,
      mode,
      preview,
      score: containsScore
    });
  }
}

function pushMeaningMatch(
  matches: GlossaryCollectedMatch[],
  field: GlossaryMatchField,
  badge: string,
  mode: GlossaryMatchMode,
  value: string,
  query: string,
  exactScore: number,
  wordScore: number,
  containsScore: number
) {
  if (!query || !value) {
    return;
  }

  if (value === query) {
    matches.push({
      badge,
      field,
      mode,
      score: exactScore
    });
    return;
  }

  if (value.split(/[^0-9\p{L}]+/u).some((token) => token.startsWith(query))) {
    matches.push({
      badge,
      field,
      mode,
      score: wordScore
    });
    return;
  }

  if (value.includes(query)) {
    matches.push({
      badge,
      field,
      mode,
      score: containsScore
    });
  }
}

function buildFilteredQuery(rawQuery: string): FilteredQuery | null {
  if (!rawQuery) {
    return null;
  }

  const normalized = normalizeSearchText(rawQuery);

  if (!normalized) {
    return null;
  }

  return {
    normalized,
    kana: foldJapaneseKana(normalized),
    grammarKana: foldJapaneseKana(normalizeGrammarSearchText(rawQuery)),
    romajiCompact: compactLatinSearchText(rawQuery)
  };
}

function compareRankedEntries(
  left: RankedGlossaryEntry,
  right: RankedGlossaryEntry,
  input: {
    hasQuery: boolean;
    segments: Awaited<ReturnType<typeof listGlossarySegmentsByMediaId>>;
    sort: GlossaryDefaultSort;
  }
) {
  if (input.hasQuery && left.score !== right.score) {
    return right.score - left.score;
  }

  if (input.sort === "alphabetical") {
    if (left.label !== right.label) {
      return left.label.localeCompare(right.label, "ja");
    }

    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }

    return (left.reading ?? "").localeCompare(right.reading ?? "", "ja");
  }

  const segmentIndex = new Map(
    input.segments.map((segment, index) => [segment.id, index] as const)
  );
  const leftSegment = left.segmentId ? (segmentIndex.get(left.segmentId) ?? 999) : 999;
  const rightSegment = right.segmentId ? (segmentIndex.get(right.segmentId) ?? 999) : 999;

  if (leftSegment !== rightSegment) {
    return leftSegment - rightSegment;
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  return left.label.localeCompare(right.label, "ja");
}

function buildStudySignalMap(rows: StudySignalRow[]) {
  const map = new Map<string, StudySignalRow[]>();

  for (const row of rows) {
    const key = `${row.entryType}:${row.entryId}`;
    const existing = map.get(key);

    if (existing) {
      existing.push(row);
      continue;
    }

    map.set(key, [row]);
  }

  return map;
}

function groupRowsByEntry<Row extends { entryId: string; entryType: string }>(
  rows: Row[]
) {
  const map = new Map<string, Row[]>();

  for (const row of rows) {
    const key = `${row.entryType}:${row.entryId}`;
    const existing = map.get(key);

    if (existing) {
      existing.push(row);
      continue;
    }

    map.set(key, [row]);
  }

  return map;
}

function resolvePreviewEntry(
  searchParams: Record<string, string | string[] | undefined>,
  results: GlossaryPageData["results"]
) {
  const previewId = readSearchParam(searchParams, "preview");
  const previewKind = readSearchParam(searchParams, "previewKind");

  if (previewId && (previewKind === "term" || previewKind === "grammar")) {
    const selected = results.find(
      (result) => result.id === previewId && result.kind === previewKind
    );

    if (selected) {
      return selected;
    }
  }

  return results[0];
}

function aggregateLessonConnections(rows: EntryLessonConnection[]) {
  const lessons = new Map<string, AggregatedLessonConnection>();

  for (const row of rows) {
    const existing = lessons.get(row.lessonId);

    if (existing) {
      if (!existing.linkRoles.includes(row.linkRole)) {
        existing.linkRoles.push(row.linkRole);
        existing.linkRoles.sort(
          (left, right) => getEntryLinkRoleRank(left) - getEntryLinkRoleRank(right)
        );
      }

      existing.sortOrder = Math.min(
        existing.sortOrder ?? Number.MAX_SAFE_INTEGER,
        row.sortOrder ?? Number.MAX_SAFE_INTEGER
      );
      continue;
    }

    lessons.set(row.lessonId, {
      lessonId: row.lessonId,
      lessonOrderIndex: row.lessonOrderIndex,
      lessonSlug: row.lessonSlug,
      lessonSummary: row.lessonSummary,
      lessonTitle: row.lessonTitle,
      linkRoles: [row.linkRole],
      segmentTitle: row.segmentTitle,
      sortOrder: row.sortOrder
    });
  }

  return [...lessons.values()].sort((left, right) => {
    const leftRank = getEntryLinkRoleRank(left.linkRoles[0]);
    const rightRank = getEntryLinkRoleRank(right.linkRoles[0]);

    if (left.lessonOrderIndex !== right.lessonOrderIndex) {
      return left.lessonOrderIndex - right.lessonOrderIndex;
    }

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if ((left.sortOrder ?? Number.MAX_SAFE_INTEGER) !== (right.sortOrder ?? Number.MAX_SAFE_INTEGER)) {
      return (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER);
    }

    return left.lessonTitle.localeCompare(right.lessonTitle);
  });
}

function pickPrimaryLesson(
  rows: AggregatedLessonConnection[],
  mediaSlug: string
): GlossaryPageData["results"][number]["primaryLesson"] {
  const primary = [...rows].sort((left, right) => {
    const leftRank = getEntryLinkRoleRank(left.linkRoles[0]);
    const rightRank = getEntryLinkRoleRank(right.linkRoles[0]);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (left.lessonOrderIndex !== right.lessonOrderIndex) {
      return left.lessonOrderIndex - right.lessonOrderIndex;
    }

    return left.lessonTitle.localeCompare(right.lessonTitle);
  })[0];

  if (!primary) {
    return undefined;
  }

  return {
    href: mediaTextbookLessonHref(mediaSlug, primary.lessonSlug),
    roleLabel: formatEntryLinkRole(primary.linkRoles[0]),
    title: primary.lessonTitle
  };
}

function getEntryLinkRoleRank(role: EntryLessonConnection["linkRole"]) {
  const ranks: Record<EntryLessonConnection["linkRole"], number> = {
    introduced: 0,
    explained: 1,
    mentioned: 2,
    reviewed: 3
  };

  return ranks[role];
}

function formatEntryLinkRole(role: string) {
  const labels: Record<string, string> = {
    introduced: "Introdotta",
    explained: "Spiegata",
    mentioned: "Citata",
    reviewed: "Ripassata"
  };

  return labels[role] ?? capitalizeToken(role);
}

function formatShortIsoDate(value: string) {
  return value.slice(0, 10);
}

function buildGlossaryStats(
  entries: GlossaryBaseEntry[],
  studySignalsByEntry: Map<string, StudySignalRow[]>
) {
  let knownCount = 0;
  let reviewCount = 0;

  for (const entry of entries) {
    const studySignals = (studySignalsByEntry.get(`${entry.kind}:${entry.id}`) ?? []).map(
      (signal) => ({
        manualOverride: signal.manualOverride,
        reviewState: signal.reviewState
      })
    );
    const studyState = deriveEntryStudyState(entry.entryStatus, studySignals);

    if (studyState.key === "known") {
      knownCount += 1;
    }

    if (studyState.key === "review") {
      reviewCount += 1;
    }
  }

  return {
    grammarCount: entries.filter((entry) => entry.kind === "grammar").length,
    knownCount,
    reviewCount,
    termCount: entries.filter((entry) => entry.kind === "term").length
  };
}

function groupAliasesForDetail(aliases: GlossaryBaseEntry["aliases"]) {
  const groups = new Map<string, string[]>();

  for (const alias of aliases) {
    const key =
      alias.type === "reading"
        ? "Letture"
        : alias.type === "romaji"
          ? "Romaji"
          : "Alias";
    const existing = groups.get(key);

    if (existing) {
      if (!existing.includes(alias.text)) {
        existing.push(alias.text);
      }
      continue;
    }

    groups.set(key, [alias.text]);
  }

  return [...groups.entries()].map(([label, values]) => ({
    label,
    values
  }));
}

function buildMatchedFields(matches: GlossaryCollectedMatch[]) {
  const matchedFields: RankedGlossaryEntry["matchedFields"] = {
    aliases: []
  };

  for (const match of matches) {
    if (match.field === "alias" && match.preview) {
      const exists = matchedFields.aliases.some(
        (alias) => alias.text === match.preview && alias.mode === match.mode
      );

      if (!exists) {
        matchedFields.aliases.push({
          mode: match.mode,
          text: match.preview
        });
      }

      continue;
    }

    if (match.field === "label") {
      matchedFields.label ??= match.mode;
      continue;
    }

    if (match.field === "title") {
      matchedFields.title ??= match.mode;
      continue;
    }

    if (match.field === "reading") {
      matchedFields.reading ??= match.mode;
      continue;
    }

    if (match.field === "romaji") {
      matchedFields.romaji ??= match.mode;
      continue;
    }

    if (match.field === "meaning") {
      matchedFields.meaning ??= match.mode;
    }
  }

  return matchedFields;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Rendering hint only.
  }
}
