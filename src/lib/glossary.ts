import type { Route } from "next";
import { unstable_noStore as noStore } from "next/cache";

import {
  countGlobalGlossaryBrowseGroups,
  db,
  getCrossMediaFamilyByEntryId,
  getGlobalGlossaryAggregateStats,
  getGlossaryEntriesByCrossMediaGroupIds,
  getGlossaryEntriesByIds,
  getGlossaryEntryBySourceId,
  listEntryCardCounts,
  listEntryCardConnections,
  listEntryLessonConnections,
  listEntryStudySignals,
  listGlobalGlossaryBrowseGroupRefs,
  listGlossaryEntriesByKind,
  listGlossarySegmentsByMediaId,
  listGlossarySearchCandidateRefs,
  listGrammarEntrySummaries,
  listTermEntrySummaries,
  type DatabaseClient,
  type GlobalGlossaryBrowseGroupRef,
  type GlossarySearchCandidateRef,
  type GrammarGlossaryEntrySummary,
  type GrammarGlossaryEntry,
  type TermGlossaryEntrySummary,
  type TermGlossaryEntry
} from "@/db";
import {
  aggregateGlossaryLessonConnections,
  pickPrimaryGlossaryLesson
} from "@/lib/glossary-detail-helpers";
import { mediaGlossaryEntryHref } from "@/lib/site";
import {
  defaultStudySettings,
  getGlossaryDefaultSort,
  type GlossaryDefaultSort
} from "@/lib/settings";
import { deriveEntryStudyState } from "@/lib/study-entry";
import { buildEntryKey } from "@/lib/entry-id";
import {
  GLOSSARY_SUMMARY_TAG,
  buildGlossarySummaryTags,
  canUseDataCache,
  getMediaBySlugCached,
  listMediaCached,
  runWithTaggedCache
} from "@/lib/data-cache";
import type { PronunciationData } from "@/lib/pronunciation";
import {
  buildFilteredQuery,
  buildGlobalGlossaryAutocompleteSuggestions,
  compareRankedEntries
} from "@/lib/glossary-search";
import {
  buildEntryCardCountMap,
  buildGlobalGlossaryResults,
  buildGlossaryStats,
  buildResolvedEntriesFromMaps,
  buildStudySignalMap,
  groupResolvedEntriesByResult,
  groupRowsByEntry,
  hasActiveGlossaryFilters,
  normalizeGlossaryQuery,
  readSearchParam
} from "@/lib/glossary-filter";
import {
  buildGlossaryDetailData,
  buildGlossaryMediaSummary,
  mapEntryToBaseModel,
  mapGrammarSummaryToBaseModel,
  mapTermSummaryToBaseModel
} from "@/lib/glossary-format";

export type StudySignalRow = Awaited<
  ReturnType<typeof listEntryStudySignals>
>[number];
type StudyState = ReturnType<typeof deriveEntryStudyState>;

export type GlossaryKind = "term" | "grammar";
export type GlossaryCardsFilter = "all" | "with_cards" | "without_cards";

export type GlossaryBaseEntry = {
  id: string;
  internalId: string;
  kind: GlossaryKind;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  label: string;
  title?: string;
  reading?: string;
  romaji?: string;
  pronunciation?: PronunciationData;
  meaning: string;
  literalMeaning?: string;
  notes?: string;
  pos?: string;
  levelHint?: string;
  crossMediaGroupId?: string;
  crossMediaGroupKey?: string;
  segmentId: string | null;
  segmentTitle?: string;
  aliases: Array<{
    kana: string;
    romajiCompact?: string;
    text: string;
    normalized: string;
    type?: string;
  }>;
  lemmaNorm: string;
  readingNorm?: string;
  romajiNorm?: string;
  meaningNorm: string;
  literalMeaningNorm?: string;
  notesNorm?: string;
  patternKana?: string;
  titleNorm?: string;
  patternNorm?: string;
  romajiCompact?: string;
};

export type GlossaryMatchMode =
  | "normalized"
  | "kana"
  | "grammarKana"
  | "romajiCompact";

export type GlossaryMatchField =
  | "alias"
  | "label"
  | "literalMeaning"
  | "meaning"
  | "notes"
  | "reading"
  | "romaji"
  | "title";

export type GlossaryCollectedMatch = {
  badge: string;
  field: GlossaryMatchField;
  mode: GlossaryMatchMode;
  preview?: string;
  score: number;
};

export type RankedGlossaryEntry = GlossaryBaseEntry & {
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
  studyState: StudyState;
};

export type GlossaryMediaHit = {
  cardCount: number;
  hasCards: boolean;
  href: Route;
  id: string;
  internalId: string;
  isBestLocal: boolean;
  kind: GlossaryKind;
  matchesCurrentFilters: boolean;
  matchesCurrentQuery: boolean;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  segmentTitle?: string;
  studyState: StudyState;
};

export type GlossarySearchResult = RankedGlossaryEntry & {
  bestLocalHref: Route;
  cardCount: number;
  hasCards: boolean;
  mediaCount: number;
  mediaHits: GlossaryMediaHit[];
  resultKey: string;
};

type GlossaryLocalResult = GlossarySearchResult & {
  cardPreview?: string;
  lessonCount: number;
  primaryLesson?: {
    href: Route;
    roleLabel: string;
    title: string;
  };
};

export type GlossaryResolvedEntry = RankedGlossaryEntry & {
  cardCount: number;
  hasCards: boolean;
  matchesCurrentFilters: boolean;
  matchesCurrentQuery: boolean;
};

export type GlossaryQueryState = {
  cards: GlossaryCardsFilter;
  entryType: "all" | GlossaryKind;
  media: string;
  page: number;
  query: string;
  segmentId: string;
  sort: GlossaryDefaultSort;
  study: "all" | "known" | "review" | "learning" | "new" | "available";
};

export type GlobalGlossaryPagination = {
  page: number;
  pageSize: number;
  totalPages: number;
};

export type GlossaryMediaSummary = {
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
  results: GlossaryLocalResult[];
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

export type GlobalGlossaryPageData = {
  filters: GlossaryQueryState;
  hasActiveFilters: boolean;
  mediaOptions: Array<{
    id: string;
    slug: string;
    title: string;
  }>;
  resultSummary: {
    filtered: number;
    total: number;
    queryLabel?: string;
  };
  pagination: GlobalGlossaryPagination;
  results: GlossarySearchResult[];
  stats: {
    crossMediaCount: number;
    entryCount: number;
    mediaCount: number;
    withCardsCount: number;
  };
};

export type GlobalGlossaryAutocompleteSuggestion = {
  aliases: string[];
  hasCards: boolean;
  hasCardlessVariant: boolean;
  kind: GlossaryKind;
  label: string;
  localHits: Array<{
    hasCards: boolean;
    mediaSlug: string;
    studyKey: StudyState["key"];
  }>;
  meaning: string;
  mediaCount: number;
  reading?: string;
  resultKey: string;
  romaji?: string;
  title?: string;
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

type GlossaryCrossMediaSibling = {
  href: Route;
  kind: GlossaryKind;
  label: string;
  title?: string;
  reading?: string;
  romaji?: string;
  meaning: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  segmentTitle?: string;
};

export type GlossaryDetailData = {
  cards: GlossaryDetailCard[];
  crossMedia: {
    groupKey: string;
    siblings: GlossaryCrossMediaSibling[];
  } | null;
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

const GLOBAL_GLOSSARY_PAGE_SIZE = 24;

export async function getGlossaryPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryPageData | null> {
  markDataAsLive();

  const media = await getMediaBySlugCached(database, mediaSlug);

  if (!media) {
    return null;
  }

  const defaultSort = await getGlossaryDefaultSort(database);
  const filters = normalizeGlossaryQuery(searchParams, defaultSort, {
    forcedMediaSlug: media.slug,
    supportsSegmentFilter: true
  });
  const [segments, entries] = await Promise.all([
    listGlossarySegmentsByMediaId(database, media.id),
    loadGlossaryBaseEntries(database, {
      entryType: filters.entryType,
      mediaId: media.id
    })
  ]);
  const { candidates, cardsByEntry, studySignalsByEntry } =
    await buildGlossaryResolvedEntries(database, entries, filters);
  const segmentOrder = new Map(
    segments.map((segment, index) => [segment.id, index] as const)
  );
  const filteredEntries = candidates
    .filter((entry) => entry.matchesCurrentFilters)
    .sort((left, right) =>
      compareRankedEntries(left, right, {
        hasQuery: filters.query.length > 0,
        segmentOrder,
        sort: filters.sort
      })
    );

  const resultRefs = filteredEntries.map((entry) => ({
    entryId: entry.internalId,
    entryType: entry.kind
  }));
  const lessonConnections = await listEntryLessonConnections(
    database,
    resultRefs
  );
  const lessonsByEntry = groupRowsByEntry(lessonConnections);
  const mediaSummary = buildGlossaryMediaSummary(media);

  const results = filteredEntries.map((entry) => {
    const lessonRows =
      lessonsByEntry.get(`${entry.kind}:${entry.internalId}`) ?? [];
    const cardRows =
      cardsByEntry.get(`${entry.kind}:${entry.internalId}`) ?? [];
    const uniqueLessons = aggregateGlossaryLessonConnections(lessonRows);
    const primaryLesson = pickPrimaryGlossaryLesson(uniqueLessons, media.slug);
    const firstCard = cardRows[0];

    return {
      ...entry,
      bestLocalHref: entry.href,
      cardPreview: firstCard
        ? `${firstCard.cardFront} -> ${firstCard.cardBack}`
        : undefined,
      lessonCount: uniqueLessons.length,
      mediaCount: 1,
      mediaHits: [
        {
          cardCount: entry.cardCount,
          hasCards: entry.hasCards,
          href: entry.href,
          id: entry.id,
          internalId: entry.internalId,
          isBestLocal: true,
          kind: entry.kind,
          matchesCurrentFilters: true,
          matchesCurrentQuery: entry.matchesCurrentQuery,
          mediaId: entry.mediaId,
          mediaSlug: entry.mediaSlug,
          mediaTitle: entry.mediaTitle,
          segmentTitle: entry.segmentTitle,
          studyState: entry.studyState
        }
      ],
      primaryLesson,
      resultKey: `${entry.kind}:entry:${entry.internalId}`
    };
  });
  const selectedPreviewEntry = resolvePreviewEntry(searchParams, results);
  const preview = selectedPreviewEntry
    ? buildGlossaryDetailData({
        cardConnections:
          cardsByEntry.get(
            `${selectedPreviewEntry.kind}:${selectedPreviewEntry.internalId}`
          ) ?? [],
        entry: selectedPreviewEntry,
        lessonConnections:
          lessonsByEntry.get(
            `${selectedPreviewEntry.kind}:${selectedPreviewEntry.internalId}`
          ) ?? [],
        crossMediaFamily: {
          group: null,
          siblings: []
        },
        media: mediaSummary
      })
    : undefined;

  return {
    filters,
    hasActiveFilters: hasActiveGlossaryFilters(filters, defaultSort, {
      forcedMediaSlug: media.slug,
      supportsSegmentFilter: true
    }),
    media: mediaSummary,
    resultSummary: {
      filtered: filteredEntries.length,
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

export async function getGlobalGlossaryPageData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalGlossaryPageData> {
  const [defaultSort, mediaRows, aggregateStats] = await Promise.all([
    getGlossaryDefaultSort(database),
    listMediaCached(database),
    getGlobalGlossaryAggregateStatsCached(database)
  ]);
  const normalizedFilters = normalizeGlossaryQuery(searchParams, defaultSort);
  const { filteredTotal, filters, pagination, results } =
    normalizedFilters.query
      ? await loadPaginatedGlobalGlossarySearchResults(
          database,
          normalizedFilters
        )
      : await loadCachedPaginatedGlobalGlossaryBrowseResults(
          database,
          normalizedFilters
        );

  return {
    filters,
    hasActiveFilters: hasActiveGlossaryFilters(filters, defaultSort),
    mediaOptions: mediaRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title
    })),
    resultSummary: {
      filtered: filteredTotal,
      total: aggregateStats.entryCount,
      queryLabel: filters.query || undefined
    },
    pagination,
    results,
    stats: {
      crossMediaCount: aggregateStats.crossMediaCount,
      entryCount: aggregateStats.entryCount,
      mediaCount: mediaRows.length,
      withCardsCount: aggregateStats.withCardsCount
    }
  };
}

export async function getGlobalGlossaryAutocompleteData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalGlossaryAutocompleteSuggestion[]> {
  const filters = normalizeGlossaryQuery(
    searchParams,
    defaultStudySettings.glossaryDefaultSort
  );

  if (filters.query.length === 0) {
    return [];
  }

  return loadCachedGlobalGlossaryAutocompleteData(database, filters);
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

  const media = await getMediaBySlugCached(database, mediaSlug);

  if (!media) {
    return null;
  }

  const entry =
    kind === "term"
      ? await getGlossaryEntryBySourceId(database, "term", media.id, entryId)
      : await getGlossaryEntryBySourceId(
          database,
          "grammar",
          media.id,
          entryId
        );

  if (!entry) {
    return null;
  }

  const [studySignals, lessonConnections, cardConnections, crossMediaFamily] =
    await Promise.all([
      listEntryStudySignals(database, [
        {
          entryId: entry.id,
          entryType: kind
        }
      ]),
      listEntryLessonConnections(database, [
        {
          entryId: entry.id,
          entryType: kind
        }
      ]),
      listEntryCardConnections(database, [
        {
          entryId: entry.id,
          entryType: kind
        }
      ]),
      kind === "term"
        ? getCrossMediaFamilyByEntryId(database, "term", entry.id)
        : getCrossMediaFamilyByEntryId(database, "grammar", entry.id)
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
    href: mediaGlossaryEntryHref(media.slug, kind, entry.sourceId),
    matchBadges: [],
    matchedFields: {
      aliases: []
    },
    score: 0,
    studyState: deriveEntryStudyState(entryStudySignals)
  };

  return buildGlossaryDetailData({
    cardConnections,
    crossMediaFamily,
    entry: rankedEntry,
    lessonConnections,
    media: buildGlossaryMediaSummary(media)
  });
}

type GlossaryLoadMode = "list" | "search";

async function loadGlossaryBaseEntries(
  database: DatabaseClient,
  options: {
    entryType?: GlossaryQueryState["entryType"];
    mediaId?: string;
    mode?: GlossaryLoadMode;
  } = {}
) {
  const mode = options.mode ?? "search";
  const termPromise =
    options.entryType === "grammar"
      ? Promise.resolve([])
      : mode === "list"
        ? listTermEntrySummaries(database, {
            mediaId: options.mediaId
          })
        : listGlossaryEntriesByKind(database, "term", {
            mediaId: options.mediaId
          });
  const grammarPromise =
    options.entryType === "term"
      ? Promise.resolve([])
      : mode === "list"
        ? listGrammarEntrySummaries(database, {
            mediaId: options.mediaId
          })
        : listGlossaryEntriesByKind(database, "grammar", {
            mediaId: options.mediaId
          });
  const [terms, grammar] = await Promise.all([termPromise, grammarPromise]);

  return [
    ...terms.map((entry) =>
      mode === "list"
        ? mapTermSummaryToBaseModel(entry as TermGlossaryEntrySummary)
        : mapEntryToBaseModel(entry as TermGlossaryEntry, "term")
    ),
    ...grammar.map((entry) =>
      mode === "list"
        ? mapGrammarSummaryToBaseModel(entry as GrammarGlossaryEntrySummary)
        : mapEntryToBaseModel(entry as GrammarGlossaryEntry, "grammar")
    )
  ];
}

async function loadGlobalGlossarySearchEntries(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  const query = buildFilteredQuery(filters.query);

  if (!query) {
    return [];
  }

  const sqlCandidateRefs = await listGlossarySearchCandidateRefs(database, {
    entryType: filters.entryType === "all" ? undefined : filters.entryType,
    grammarKana: query.grammarKana,
    kana: query.kana,
    normalized: query.normalized,
    romajiCompact: query.compact
  });
  const candidateRefs = dedupeCandidateRefs(sqlCandidateRefs);

  if (candidateRefs.length === 0) {
    return [];
  }

  const entries = await loadFullEntriesForCandidateRefs(
    database,
    candidateRefs
  );

  return entries.map((entry) =>
    "lemma" in entry
      ? mapEntryToBaseModel(entry as TermGlossaryEntry, "term")
      : mapEntryToBaseModel(entry as GrammarGlossaryEntry, "grammar")
  );
}

async function loadFullEntriesForCandidateRefs(
  database: DatabaseClient,
  refs: GlossarySearchCandidateRef[]
): Promise<Array<TermGlossaryEntry | GrammarGlossaryEntry>> {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();
  const termGroupIds = new Set<string>();
  const grammarGroupIds = new Set<string>();

  for (const ref of refs) {
    if (ref.entryType === "term") {
      termIds.add(ref.entryId);

      if (ref.crossMediaGroupId) {
        termGroupIds.add(ref.crossMediaGroupId);
      }

      continue;
    }

    grammarIds.add(ref.entryId);

    if (ref.crossMediaGroupId) {
      grammarGroupIds.add(ref.crossMediaGroupId);
    }
  }

  const [directTerms, groupedTerms, directGrammar, groupedGrammar] =
    await Promise.all([
      getGlossaryEntriesByIds(database, "term", [...termIds]),
      getGlossaryEntriesByCrossMediaGroupIds(database, "term", [
        ...termGroupIds
      ]),
      getGlossaryEntriesByIds(database, "grammar", [...grammarIds]),
      getGlossaryEntriesByCrossMediaGroupIds(database, "grammar", [
        ...grammarGroupIds
      ])
    ]);

  return dedupeFullGlossaryEntries([
    ...directTerms,
    ...groupedTerms,
    ...directGrammar,
    ...groupedGrammar
  ]);
}

async function loadGlobalGlossaryBrowseEntriesForPageRefs(
  database: DatabaseClient,
  refs: GlobalGlossaryBrowseGroupRef[]
) {
  const termIds = new Set<string>();
  const termGroupIds = new Set<string>();
  const grammarIds = new Set<string>();
  const grammarGroupIds = new Set<string>();

  for (const ref of refs) {
    if (ref.entryType === "term") {
      if (ref.crossMediaGroupId) {
        termGroupIds.add(ref.crossMediaGroupId);
      } else {
        termIds.add(ref.internalId);
      }
      continue;
    }

    if (ref.crossMediaGroupId) {
      grammarGroupIds.add(ref.crossMediaGroupId);
    } else {
      grammarIds.add(ref.internalId);
    }
  }

  const [directTerms, groupedTerms, directGrammar, groupedGrammar] =
    await Promise.all([
      getGlossaryEntriesByIds(database, "term", [...termIds]),
      getGlossaryEntriesByCrossMediaGroupIds(database, "term", [
        ...termGroupIds
      ]),
      getGlossaryEntriesByIds(database, "grammar", [...grammarIds]),
      getGlossaryEntriesByCrossMediaGroupIds(database, "grammar", [
        ...grammarGroupIds
      ])
    ]);

  return dedupeFullGlossaryEntries([
    ...directTerms,
    ...groupedTerms,
    ...directGrammar,
    ...groupedGrammar
  ]).map((entry) =>
    "lemma" in entry
      ? mapEntryToBaseModel(entry as TermGlossaryEntry, "term")
      : mapEntryToBaseModel(entry as GrammarGlossaryEntry, "grammar")
  );
}

async function buildGlossaryResolvedEntries(
  database: DatabaseClient,
  entries: GlossaryBaseEntry[],
  filters: GlossaryQueryState
) {
  const entryRefs = entries.map((entry) => ({
    entryId: entry.internalId,
    entryType: entry.kind
  }));
  const [studySignalsByEntry, cardConnections] = await Promise.all([
    loadStudySignalsByEntry(database, entryRefs),
    listEntryCardConnections(database, entryRefs)
  ]);
  const cardsByEntry = groupRowsByEntry(cardConnections);
  const candidates = buildResolvedEntriesFromMaps({
    cardCountByEntry: new Map(
      [...cardsByEntry.entries()].map(
        ([key, rows]) => [key, rows.length] as const
      )
    ),
    entries,
    filters,
    studySignalsByEntry
  });

  return {
    candidates,
    cardsByEntry,
    studySignalsByEntry
  };
}

async function buildGlobalGlossaryResolvedEntries(
  database: DatabaseClient,
  entries: GlossaryBaseEntry[],
  filters: GlossaryQueryState
) {
  const entryRefs = entries.map((entry) => ({
    entryId: entry.internalId,
    entryType: entry.kind
  }));
  const [studySignalsByEntry, cardCounts] = await Promise.all([
    loadStudySignalsByEntry(database, entryRefs),
    listEntryCardCounts(database, entryRefs)
  ]);

  return {
    candidates: buildResolvedEntriesFromMaps({
      cardCountByEntry: buildEntryCardCountMap(cardCounts),
      entries,
      filters,
      studySignalsByEntry
    })
  };
}

async function loadStudySignalsByEntry(
  database: DatabaseClient,
  entries: Array<{ entryId: string; entryType: GlossaryKind }>
) {
  const rows = await listEntryStudySignals(database, entries);

  return buildStudySignalMap(rows);
}

function buildGlobalGlossaryPagination(
  requestedPage: number,
  filteredTotal: number
): GlobalGlossaryPagination {
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTotal / GLOBAL_GLOSSARY_PAGE_SIZE)
  );

  return {
    page: Math.min(Math.max(requestedPage, 1), totalPages),
    pageSize: GLOBAL_GLOSSARY_PAGE_SIZE,
    totalPages
  };
}

async function loadPaginatedGlobalGlossaryBrowseResults(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  const filteredTotal = await countGlobalGlossaryBrowseGroups(database, {
    cards: filters.cards,
    entryType: filters.entryType === "all" ? undefined : filters.entryType,
    mediaSlug: filters.media === "all" ? undefined : filters.media,
    study: filters.study === "all" ? undefined : filters.study
  });
  const pagination = buildGlobalGlossaryPagination(filters.page, filteredTotal);
  const resolvedFilters = {
    ...filters,
    page: pagination.page
  };

  if (filteredTotal === 0) {
    return {
      filteredTotal,
      filters: resolvedFilters,
      pagination,
      results: [] as GlossarySearchResult[]
    };
  }

  const pageRefs = await listGlobalGlossaryBrowseGroupRefs(database, {
    cards: filters.cards,
    entryType: filters.entryType === "all" ? undefined : filters.entryType,
    mediaSlug: filters.media === "all" ? undefined : filters.media,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sort: filters.sort,
    study: filters.study === "all" ? undefined : filters.study
  });
  const entries = await loadGlobalGlossaryBrowseEntriesForPageRefs(
    database,
    pageRefs
  );
  const { candidates } = await buildGlobalGlossaryResolvedEntries(
    database,
    entries,
    resolvedFilters
  );
  const resultsByKey = new Map(
    buildGlobalGlossaryResults(candidates, resolvedFilters).map(
      (result) => [result.resultKey, result] as const
    )
  );

  return {
    filteredTotal,
    filters: resolvedFilters,
    pagination,
    results: pageRefs
      .map((ref) => resultsByKey.get(ref.resultKey))
      .filter((result): result is GlossarySearchResult => result !== undefined)
  };
}

async function loadPaginatedGlobalGlossarySearchResults(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  const entries = await loadGlobalGlossarySearchEntries(database, filters);
  const { candidates } = await buildGlobalGlossaryResolvedEntries(
    database,
    entries,
    filters
  );
  const allResults = buildGlobalGlossaryResults(candidates, filters);
  const filteredTotal = allResults.length;
  const pagination = buildGlobalGlossaryPagination(filters.page, filteredTotal);
  const resolvedFilters = {
    ...filters,
    page: pagination.page
  };
  const startIndex = (pagination.page - 1) * pagination.pageSize;

  return {
    filteredTotal,
    filters: resolvedFilters,
    pagination,
    results: allResults.slice(startIndex, startIndex + pagination.pageSize)
  };
}

async function getGlobalGlossaryAggregateStatsCached(
  database: DatabaseClient
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["glossary", "aggregate-stats"],
    loader: () => getGlobalGlossaryAggregateStats(database),
    tags: [GLOSSARY_SUMMARY_TAG]
  });
}

async function loadCachedPaginatedGlobalGlossaryBrowseResults(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "browse-page",
      `cards:${filters.cards}`,
      `media:${filters.media}`,
      `page:${filters.page}`,
      `sort:${filters.sort}`,
      `study:${filters.study}`,
      `type:${filters.entryType}`
    ],
    loader: () => loadPaginatedGlobalGlossaryBrowseResults(database, filters),
    tags: [GLOSSARY_SUMMARY_TAG]
  });
}

async function loadCachedGlobalGlossaryAutocompleteData(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "autocomplete",
      `cards:${filters.cards}`,
      `media:${filters.media}`,
      `query:${filters.query}`,
      `study:${filters.study}`,
      `type:${filters.entryType}`
    ],
    loader: async () => {
      const entries = await loadGlobalGlossarySearchEntries(database, filters);
      const { candidates } = await buildGlobalGlossaryResolvedEntries(
        database,
        entries,
        filters
      );
      const groups = groupResolvedEntriesByResult(candidates);
      const relevantGroups = new Map(
        [...groups.entries()].filter(([, entries]) =>
          entries.some((entry) => entry.matchesCurrentQuery)
        )
      );

      return buildGlobalGlossaryAutocompleteSuggestions(
        relevantGroups,
        filters.query,
        filters
      );
    },
    tags: buildGlossarySummaryTags()
  });
}

function dedupeCandidateRefs(refs: GlossarySearchCandidateRef[]) {
  const unique = new Map<string, GlossarySearchCandidateRef>();

  for (const ref of refs) {
    unique.set(buildEntryKey(ref.entryType, ref.entryId), ref);
  }

  return [...unique.values()];
}

function dedupeFullGlossaryEntries(
  entries: Array<TermGlossaryEntry | GrammarGlossaryEntry>
) {
  const unique = new Map<string, TermGlossaryEntry | GrammarGlossaryEntry>();

  for (const entry of entries) {
    const key = buildEntryKey("lemma" in entry ? "term" : "grammar", entry.id);

    unique.set(key, entry);
  }

  return [...unique.values()];
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

function markDataAsLive() {
  try {
    noStore();
  } catch {
    // Rendering hint only.
  }
}
