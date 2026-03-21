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
  getMediaBySlug,
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
  type CrossMediaSibling,
  type DatabaseClient,
  type CrossMediaGroupRecord,
  type EntryCardCount,
  type EntryCardConnection,
  type EntryLessonConnection,
  type GlobalGlossaryBrowseGroupRef,
  type GlossaryEntryRef,
  type GlossarySearchCandidateRef,
  type GrammarGlossaryEntrySummary,
  type GrammarGlossaryEntry,
  type TermGlossaryEntrySummary,
  type TermGlossaryEntry
} from "@/db";
import {
  mediaGlossaryEntryHref,
  mediaGlossaryHref,
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
import { buildEntryKey } from "@/lib/entry-id";
import { getGlossaryAutocompleteSuggestions } from "@/lib/glossary-autocomplete";
import {
  GLOSSARY_SUMMARY_TAG,
  buildGlossarySummaryTags,
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache
} from "@/lib/data-cache";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import {
  buildPronunciationData,
  type PronunciationData
} from "@/lib/pronunciation";
import { pickBestBy } from "@/lib/collections";

type StudySignalRow = Awaited<ReturnType<typeof listEntryStudySignals>>[number];
type StudyState = ReturnType<typeof deriveEntryStudyState>;

type GlossaryKind = "term" | "grammar";
type GlossaryCardsFilter = "all" | "with_cards" | "without_cards";

type GlossaryBaseEntry = {
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

type FilteredQuery = {
  normalized: string;
  kana: string;
  grammarKana: string;
  romajiCompact: string;
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

type GlossaryResolvedEntry = RankedGlossaryEntry & {
  cardCount: number;
  hasCards: boolean;
  matchesCurrentFilters: boolean;
  matchesCurrentQuery: boolean;
};

type GlossaryLoadMode = "list" | "search";

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

const cardsFilterOptions: GlossaryCardsFilter[] = [
  "all",
  "with_cards",
  "without_cards"
];

const studyFilterOptions: GlossaryQueryState["study"][] = [
  "all",
  "known",
  "review",
  "learning",
  "new",
  "available"
];

const GLOBAL_GLOSSARY_PAGE_SIZE = 24;
const GLOBAL_GLOSSARY_FALLBACK_LIMIT = 24;

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
  const filteredEntries = candidates
    .filter((entry) => entry.matchesCurrentFilters)
    .sort((left, right) =>
      compareRankedEntries(left, right, {
        hasQuery: filters.query.length > 0,
        segments,
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
    const uniqueLessons = aggregateLessonConnections(lessonRows);
    const primaryLesson = pickPrimaryLesson(uniqueLessons, media.slug);
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

function buildGlobalGlossaryResults(
  candidates: GlossaryResolvedEntry[],
  filters: GlossaryQueryState
) {
  const groups = groupResolvedEntriesByResult(candidates);

  return [...groups.values()]
    .map((group) => buildGlobalGlossaryResult(group, filters))
    .filter((result): result is GlossarySearchResult => result !== null)
    .sort((left, right) => compareGlobalGlossaryResults(left, right, filters));
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

async function getGlobalGlossaryAggregateStatsCached(database: DatabaseClient) {
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
  const defaultSort = await getGlossaryDefaultSort(database);
  const filters = normalizeGlossaryQuery(searchParams, defaultSort);

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

  const media = await getMediaBySlug(database, mediaSlug);

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
    romajiCompact: query.romajiCompact
  });
  const candidateRefs = dedupeCandidateRefs([
    ...sqlCandidateRefs,
    ...(await loadGrammarRomajiFallbackCandidateRefs(
      database,
      filters,
      query,
      sqlCandidateRefs
    ))
  ]);

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

async function loadGrammarRomajiFallbackCandidateRefs(
  database: DatabaseClient,
  filters: GlossaryQueryState,
  query: FilteredQuery,
  existingRefs: GlossarySearchCandidateRef[]
): Promise<GlossarySearchCandidateRef[]> {
  if (
    filters.entryType === "term" ||
    !isLikelyLatinRomajiQuery(filters.query) ||
    query.romajiCompact.length < 3 ||
    existingRefs.some((ref) => ref.entryType === "grammar")
  ) {
    return [];
  }

  const scopedMedia =
    filters.media === "all"
      ? null
      : await getMediaBySlug(database, filters.media);
  const grammarEntries = await listGrammarEntrySummaries(
    database,
    scopedMedia
      ? {
          mediaId: scopedMedia.id
        }
      : {}
  );
  const rankedFallbackEntries = grammarEntries
    .map((entry) => {
      const baseEntry = mapGrammarSummaryToBaseModel(entry);
      const rankedEntry = buildRankedGlossaryEntry(
        baseEntry,
        query,
        deriveEntryStudyState([])
      );

      return rankedEntry
        ? {
            crossMediaGroupId: baseEntry.crossMediaGroupId ?? null,
            entryId: baseEntry.internalId,
            entryType: "grammar" as const,
            score: rankedEntry.score
          }
        : null;
    })
    .filter((entry) => entry !== null);

  return rankedFallbackEntries
    .sort((left, right) => right.score - left.score)
    .slice(0, GLOBAL_GLOSSARY_FALLBACK_LIMIT)
    .map((entry) => ({
      crossMediaGroupId: entry.crossMediaGroupId ?? null,
      entryId: entry.entryId,
      entryType: "grammar" as const
    }));
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

function isLikelyLatinRomajiQuery(rawQuery: string) {
  return /^[a-z0-9 -]+$/i.test(normalizeSearchText(rawQuery));
}

async function loadStudySignalsByEntry(
  database: DatabaseClient,
  entries: GlossaryEntryRef[]
) {
  const rows = await listEntryStudySignals(database, entries);

  return buildStudySignalMap(rows);
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

function hasActiveGlossaryFilters(
  filters: GlossaryQueryState,
  defaultSort: GlossaryDefaultSort,
  options: {
    forcedMediaSlug?: string;
    supportsSegmentFilter?: boolean;
  } = {}
) {
  return (
    filters.query.length > 0 ||
    filters.entryType !== "all" ||
    filters.cards !== "all" ||
    filters.study !== "all" ||
    (options.supportsSegmentFilter && filters.segmentId !== "all") ||
    (!options.forcedMediaSlug && filters.media !== "all") ||
    filters.sort !== defaultSort
  );
}

function groupResolvedEntriesByResult(entries: GlossaryResolvedEntry[]) {
  const groups = new Map<string, GlossaryResolvedEntry[]>();

  for (const entry of entries) {
    const key = entry.crossMediaGroupKey
      ? `${entry.kind}:group:${entry.crossMediaGroupKey}`
      : `${entry.kind}:entry:${entry.internalId}`;
    const existing = groups.get(key);

    if (existing) {
      existing.push(entry);
      continue;
    }

    groups.set(key, [entry]);
  }

  return groups;
}

function buildGlobalGlossaryResult(
  entries: GlossaryResolvedEntry[],
  filters: GlossaryQueryState
): GlossarySearchResult | null {
  const matchingEntries = entries.filter(
    (entry) => entry.matchesCurrentFilters
  );

  if (matchingEntries.length === 0) {
    return null;
  }

  const bestLocal = pickBestBy(matchingEntries, (left, right) =>
    compareBestLocalEntries(left, right, filters)
  );

  if (!bestLocal) {
    return null;
  }

  const resultEntries = filters.cards === "all" ? entries : matchingEntries;
  const resultKey = bestLocal.crossMediaGroupKey
    ? `${bestLocal.kind}:group:${bestLocal.crossMediaGroupKey}`
    : `${bestLocal.kind}:entry:${bestLocal.internalId}`;
  let cardCount = 0;
  let hasCards = false;
  const mediaIds = new Set<string>();

  for (const entry of resultEntries) {
    cardCount += entry.cardCount;
    hasCards ||= entry.hasCards;
    mediaIds.add(entry.mediaId);
  }

  const mediaHits = [...resultEntries]
    .sort((left, right) => compareMediaHits(left, right, bestLocal.internalId))
    .map((entry) => ({
      cardCount: entry.cardCount,
      hasCards: entry.hasCards,
      href: entry.href,
      id: entry.id,
      internalId: entry.internalId,
      isBestLocal: entry.internalId === bestLocal.internalId,
      kind: entry.kind,
      matchesCurrentFilters: entry.matchesCurrentFilters,
      matchesCurrentQuery: entry.matchesCurrentQuery,
      mediaId: entry.mediaId,
      mediaSlug: entry.mediaSlug,
      mediaTitle: entry.mediaTitle,
      segmentTitle: entry.segmentTitle,
      studyState: entry.studyState
    }));

  return {
    ...bestLocal,
    bestLocalHref: bestLocal.href,
    cardCount,
    hasCards,
    href: bestLocal.href,
    mediaCount: mediaIds.size,
    mediaHits,
    resultKey
  };
}

function compareBestLocalEntries(
  left: GlossaryResolvedEntry,
  right: GlossaryResolvedEntry,
  filters: GlossaryQueryState
) {
  if (filters.query.length > 0 && left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.matchesCurrentQuery !== right.matchesCurrentQuery) {
    return left.matchesCurrentQuery ? -1 : 1;
  }

  if (left.hasCards !== right.hasCards) {
    return left.hasCards ? -1 : 1;
  }

  if (left.mediaTitle !== right.mediaTitle) {
    return left.mediaTitle.localeCompare(right.mediaTitle);
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  return left.label.localeCompare(right.label, "ja");
}

function compareMediaHits(
  left: GlossaryResolvedEntry,
  right: GlossaryResolvedEntry,
  bestLocalInternalId: string
) {
  if (left.internalId !== right.internalId) {
    if (left.internalId === bestLocalInternalId) {
      return -1;
    }

    if (right.internalId === bestLocalInternalId) {
      return 1;
    }
  }

  if (left.mediaTitle !== right.mediaTitle) {
    return left.mediaTitle.localeCompare(right.mediaTitle);
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  return left.label.localeCompare(right.label, "ja");
}

function compareGlobalGlossaryResults(
  left: GlossarySearchResult,
  right: GlossarySearchResult,
  filters: GlossaryQueryState
) {
  if (filters.query.length > 0 && left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.label !== right.label) {
    return left.label.localeCompare(right.label, "ja");
  }

  if (left.kind !== right.kind) {
    return left.kind.localeCompare(right.kind);
  }

  if (left.mediaCount !== right.mediaCount) {
    return right.mediaCount - left.mediaCount;
  }

  return left.bestLocalHref.localeCompare(right.bestLocalHref);
}

function buildGlobalGlossaryAutocompleteSuggestions(
  groups: Map<string, GlossaryResolvedEntry[]>,
  query?: string,
  filters?: Pick<GlossaryQueryState, "cards" | "entryType" | "media" | "study">
) {
  const suggestions: Array<
    GlobalGlossaryAutocompleteSuggestion & { score?: number }
  > = [];

  for (const [resultKey, entries] of groups.entries()) {
    const matchingEntries = query
      ? entries.filter(
          (entry) => entry.matchesCurrentFilters && entry.matchesCurrentQuery
        )
      : entries.filter((entry) => entry.matchesCurrentFilters);
    const representative = pickBestBy(matchingEntries, (left, right) => {
      if (query && left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.hasCards !== right.hasCards) {
        return left.hasCards ? -1 : 1;
      }

      if (left.mediaTitle !== right.mediaTitle) {
        return left.mediaTitle.localeCompare(right.mediaTitle);
      }

      return left.label.localeCompare(right.label, "ja");
    });

    if (!representative) {
      continue;
    }

    suggestions.push({
      aliases: [
        ...new Set(
          entries.flatMap((entry) => entry.aliases.map((alias) => alias.text))
        )
      ],
      hasCards: entries.some((entry) => entry.hasCards),
      hasCardlessVariant: entries.some((entry) => !entry.hasCards),
      kind: representative.kind,
      label: representative.label,
      localHits: entries.map((entry) => ({
        hasCards: entry.hasCards,
        mediaSlug: entry.mediaSlug,
        studyKey: entry.studyState.key
      })),
      meaning: representative.meaning,
      mediaCount: new Set(entries.map((entry) => entry.mediaId)).size,
      reading: representative.reading,
      resultKey,
      romaji: representative.romaji,
      score: representative.score,
      title: representative.title
    });
  }

  if (!query) {
    suggestions.sort((left, right) =>
      left.label.localeCompare(right.label, "ja")
    );

    return suggestions;
  }

  return getGlossaryAutocompleteSuggestions({
    filters: filters ?? {
      cards: "all",
      entryType: "all",
      media: "all",
      study: "all"
    },
    query,
    suggestions
  });
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
    glossaryHref: mediaGlossaryHref(media.slug),
    mediaTypeLabel: formatMediaTypeLabel(media.mediaType),
    segmentKindLabel: formatSegmentKindLabel(media.segmentKind),
    textbookHref: mediaStudyHref(media.slug, "textbook")
  };
}

function buildGlossaryDetailData(input: {
  cardConnections: EntryCardConnection[];
  crossMediaFamily: {
    group: CrossMediaGroupRecord | null;
    siblings: CrossMediaSibling[];
  };
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
      dueLabel: row.dueAt
        ? `Scadenza ${formatShortIsoDate(row.dueAt)}`
        : undefined,
      front: row.cardFront,
      href: mediaReviewCardHref(input.media.slug, row.cardId),
      id: row.cardId,
      relationshipLabel: formatCardRelationshipLabel(row.relationshipType),
      reviewLabel:
        row.cardStatus === "suspended"
          ? "Sospesa"
          : forceKnownReviewLabel
            ? "Già nota"
            : formatReviewStateLabel(
                row.reviewState,
                row.manualOverride ?? false
              ),
      segmentTitle: row.segmentTitle ?? undefined,
      typeLabel: capitalizeToken(row.cardType),
      notes: row.cardNotesIt ?? undefined
    })),
    crossMedia:
      input.crossMediaFamily.group && input.crossMediaFamily.siblings.length > 0
        ? {
            groupKey: input.crossMediaFamily.group.groupKey,
            siblings: input.crossMediaFamily.siblings.map(mapCrossMediaSibling)
          }
        : null,
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

function mapCrossMediaSibling(
  sibling: CrossMediaSibling
): GlossaryCrossMediaSibling {
  return {
    href: mediaGlossaryEntryHref(
      sibling.mediaSlug,
      sibling.kind,
      sibling.sourceId
    ),
    kind: sibling.kind,
    label: sibling.label,
    reading: sibling.reading ?? undefined,
    romaji: sibling.kind === "term" ? sibling.romaji : undefined,
    meaning: sibling.meaningIt,
    mediaSlug: sibling.mediaSlug,
    mediaTitle: sibling.mediaTitle,
    notes: buildCrossMediaNotesPreview(sibling.notesIt),
    title:
      sibling.kind === "grammar" &&
      sibling.title &&
      sibling.title !== sibling.label
        ? sibling.title
        : undefined,
    segmentTitle: sibling.segmentTitle ?? undefined
  };
}

function buildCrossMediaNotesPreview(notes?: string | null) {
  if (!notes) {
    return undefined;
  }

  const plainText = stripInlineMarkdown(notes).replace(/\s+/g, " ").trim();

  if (plainText.length === 0) {
    return undefined;
  }

  if (plainText.length <= 180) {
    return plainText;
  }

  return `${plainText.slice(0, 177).trimEnd()}...`;
}

function mapEntryToBaseModel(
  entry: TermGlossaryEntry,
  kind: "term"
): GlossaryBaseEntry;
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
      internalId: termEntry.id,
      id: termEntry.sourceId,
      kind,
      crossMediaGroupId: termEntry.crossMediaGroupId ?? undefined,
      crossMediaGroupKey: termEntry.crossMediaGroup?.groupKey ?? undefined,
      label: termEntry.lemma,
      mediaId: termEntry.mediaId,
      mediaSlug: termEntry.media.slug,
      mediaTitle: termEntry.media.title,
      reading: termEntry.reading,
      romaji: termEntry.romaji,
      pronunciation:
        buildPronunciationData(termEntry.media.slug, {
          ...termEntry,
          reading: termEntry.reading
        }) ?? undefined,
      meaning: termEntry.meaningIt,
      literalMeaning: termEntry.meaningLiteralIt ?? undefined,
      notes: termEntry.notesIt ?? undefined,
      pos: termEntry.pos ?? undefined,
      levelHint: termEntry.levelHint ?? undefined,
      segmentId: termEntry.segmentId,
      segmentTitle: termEntry.segment?.title ?? undefined,
      aliases: termEntry.aliases.map((alias) => ({
        kana: foldJapaneseKana(alias.aliasNorm),
        text: alias.aliasText,
        normalized: alias.aliasNorm,
        type: alias.aliasType
      })),
      lemmaNorm: termEntry.searchLemmaNorm,
      readingNorm: termEntry.searchReadingNorm,
      romajiNorm: termEntry.searchRomajiNorm,
      romajiCompact: termEntry.searchRomajiNorm
        ? compactLatinSearchText(termEntry.searchRomajiNorm)
        : undefined,
      meaningNorm: normalizeSearchText(termEntry.meaningIt),
      literalMeaningNorm: termEntry.meaningLiteralIt
        ? normalizeSearchText(termEntry.meaningLiteralIt)
        : undefined,
      notesNorm: termEntry.notesIt
        ? normalizeSearchText(stripInlineMarkdown(termEntry.notesIt))
        : undefined
    };
  }

  const grammarEntry = entry as GrammarGlossaryEntry;
  const romajiNorm = romanizeKanaForSearch(grammarEntry.searchPatternNorm);

  return {
    internalId: grammarEntry.id,
    id: grammarEntry.sourceId,
    kind,
    crossMediaGroupId: grammarEntry.crossMediaGroupId ?? undefined,
    crossMediaGroupKey: grammarEntry.crossMediaGroup?.groupKey ?? undefined,
    label: grammarEntry.pattern,
    mediaId: grammarEntry.mediaId,
    mediaSlug: grammarEntry.media.slug,
    mediaTitle: grammarEntry.media.title,
    title: grammarEntry.title,
    reading: grammarEntry.reading ?? undefined,
    pronunciation:
      buildPronunciationData(grammarEntry.media.slug, {
        ...grammarEntry,
        reading: grammarEntry.reading ?? grammarEntry.pattern
      }) ?? undefined,
    meaning: grammarEntry.meaningIt,
    notes: grammarEntry.notesIt ?? undefined,
    levelHint: grammarEntry.levelHint ?? undefined,
    segmentId: grammarEntry.segmentId,
    segmentTitle: grammarEntry.segment?.title ?? undefined,
    aliases: grammarEntry.aliases.map((alias) => ({
      kana: foldJapaneseKana(normalizeGrammarSearchText(alias.aliasText)),
      romajiCompact: romanizeKanaForSearch(alias.aliasNorm),
      text: alias.aliasText,
      normalized: alias.aliasNorm
    })),
    lemmaNorm: grammarEntry.searchPatternNorm,
    romajiNorm,
    romajiCompact: compactLatinSearchText(romajiNorm),
    patternNorm: grammarEntry.searchPatternNorm,
    patternKana: foldJapaneseKana(grammarEntry.searchPatternNorm),
    meaningNorm: normalizeSearchText(grammarEntry.meaningIt),
    titleNorm: normalizeSearchText(grammarEntry.title),
    notesNorm: grammarEntry.notesIt
      ? normalizeSearchText(stripInlineMarkdown(grammarEntry.notesIt))
      : undefined
  };
}

function mapTermSummaryToBaseModel(
  entry: TermGlossaryEntrySummary
): GlossaryBaseEntry {
  return {
    internalId: entry.id,
    id: entry.sourceId,
    kind: "term",
    crossMediaGroupId: entry.crossMediaGroupId ?? undefined,
    crossMediaGroupKey: entry.crossMediaGroupKey ?? undefined,
    label: entry.lemma,
    mediaId: entry.mediaId,
    mediaSlug: entry.mediaSlug,
    mediaTitle: entry.mediaTitle,
    reading: entry.reading,
    romaji: entry.romaji,
    pronunciation:
      buildPronunciationData(entry.mediaSlug, {
        ...entry,
        reading: entry.reading
      }) ?? undefined,
    meaning: entry.meaningIt,
    levelHint: entry.levelHint ?? undefined,
    segmentId: entry.segmentId,
    segmentTitle: entry.segmentTitle ?? undefined,
    aliases: [],
    lemmaNorm: entry.searchLemmaNorm,
    readingNorm: entry.searchReadingNorm,
    romajiNorm: entry.searchRomajiNorm,
    romajiCompact: entry.searchRomajiNorm
      ? compactLatinSearchText(entry.searchRomajiNorm)
      : undefined,
    meaningNorm: normalizeSearchText(entry.meaningIt)
  };
}

function mapGrammarSummaryToBaseModel(
  entry: GrammarGlossaryEntrySummary
): GlossaryBaseEntry {
  const romajiNorm = romanizeKanaForSearch(entry.searchPatternNorm);

  return {
    internalId: entry.id,
    id: entry.sourceId,
    kind: "grammar",
    crossMediaGroupId: entry.crossMediaGroupId ?? undefined,
    crossMediaGroupKey: entry.crossMediaGroupKey ?? undefined,
    label: entry.pattern,
    mediaId: entry.mediaId,
    mediaSlug: entry.mediaSlug,
    mediaTitle: entry.mediaTitle,
    title: entry.title,
    reading: entry.reading ?? undefined,
    pronunciation:
      buildPronunciationData(entry.mediaSlug, {
        ...entry,
        reading: entry.reading ?? entry.pattern
      }) ?? undefined,
    meaning: entry.meaningIt,
    levelHint: entry.levelHint ?? undefined,
    segmentId: entry.segmentId,
    segmentTitle: entry.segmentTitle ?? undefined,
    aliases: [],
    lemmaNorm: entry.searchPatternNorm,
    romajiNorm,
    romajiCompact: compactLatinSearchText(romajiNorm),
    patternNorm: entry.searchPatternNorm,
    patternKana: foldJapaneseKana(entry.searchPatternNorm),
    meaningNorm: normalizeSearchText(entry.meaningIt),
    titleNorm: normalizeSearchText(entry.title)
  };
}

function normalizeGlossaryQuery(
  searchParams: Record<string, string | string[] | undefined>,
  defaultSort: GlossaryDefaultSort,
  options: {
    forcedMediaSlug?: string;
    supportsSegmentFilter?: boolean;
  } = {}
): GlossaryQueryState {
  const rawCards = readSearchParam(searchParams, "cards");
  const rawMedia = readSearchParam(searchParams, "media");
  const rawPage = readSearchParam(searchParams, "page");
  const rawQuery = readSearchParam(searchParams, "q");
  const rawType = readSearchParam(searchParams, "type");
  const rawSegment = readSearchParam(searchParams, "segment");
  const rawSort = readSearchParam(searchParams, "sort");
  const rawStudy = readSearchParam(searchParams, "study");
  const parsedPage = Number.parseInt(rawPage, 10);

  return {
    cards: cardsFilterOptions.includes(rawCards as GlossaryCardsFilter)
      ? (rawCards as GlossaryCardsFilter)
      : "all",
    entryType: rawType === "term" || rawType === "grammar" ? rawType : "all",
    media: (options.forcedMediaSlug ?? rawMedia) || "all",
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    query: rawQuery,
    segmentId: options.supportsSegmentFilter ? rawSegment || "all" : "all",
    sort:
      rawSort === "alphabetical" || rawSort === "lesson_order"
        ? rawSort
        : defaultSort,
    study: studyFilterOptions.includes(rawStudy as GlossaryQueryState["study"])
      ? (rawStudy as GlossaryQueryState["study"])
      : "all"
  };
}

function buildRankedGlossaryEntry(
  entry: GlossaryBaseEntry,
  query: FilteredQuery | null,
  studyState: StudyState
): RankedGlossaryEntry | null {
  const matches = query ? collectMatches(entry, query) : [];

  if (query && matches.length === 0) {
    return null;
  }

  const sortedMatches = [...matches].sort(
    (left, right) => right.score - left.score
  );
  const score =
    (sortedMatches[0]?.score ?? 0) +
    Math.max(Math.min(sortedMatches.length - 1, 4), 0) * 8;

  return {
    ...entry,
    href: mediaGlossaryEntryHref(entry.mediaSlug, entry.kind, entry.id),
    matchBadges: [...new Set(sortedMatches.map((match) => match.badge))].slice(
      0,
      3
    ),
    matchPreview: sortedMatches[0]?.preview,
    matchedFields: buildMatchedFields(sortedMatches),
    score,
    studyState
  };
}

function entryMatchesGlossaryFilters(
  entry: Pick<
    GlossaryResolvedEntry,
    "cardCount" | "kind" | "mediaSlug" | "segmentId" | "studyState"
  >,
  filters: GlossaryQueryState
) {
  if (filters.entryType !== "all" && entry.kind !== filters.entryType) {
    return false;
  }

  if (filters.media !== "all" && entry.mediaSlug !== filters.media) {
    return false;
  }

  if (filters.segmentId !== "all" && entry.segmentId !== filters.segmentId) {
    return false;
  }

  if (filters.study !== "all" && entry.studyState.key !== filters.study) {
    return false;
  }

  if (filters.cards === "with_cards" && entry.cardCount === 0) {
    return false;
  }

  if (filters.cards === "without_cards" && entry.cardCount > 0) {
    return false;
  }

  return true;
}

function collectMatches(entry: GlossaryBaseEntry, query: FilteredQuery) {
  const matches: GlossaryCollectedMatch[] = [];
  const compactRomaji = entry.romajiCompact ?? "";

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

  if (entry.patternKana) {
    pushMatch(
      matches,
      "label",
      "pattern",
      "grammarKana",
      entry.patternKana,
      query.grammarKana,
      282,
      234,
      194
    );
  }

  for (const alias of entry.aliases) {
    const aliasQuery =
      entry.kind === "grammar" ? query.grammarKana : query.kana;
    const label = alias.type === "romaji" ? "alias romaji" : "alias";

    pushMatch(
      matches,
      "alias",
      label,
      entry.kind === "grammar" ? "grammarKana" : "kana",
      alias.kana,
      aliasQuery,
      235,
      195,
      152,
      alias.text
    );

    if (entry.kind === "grammar") {
      const aliasRomaji = alias.romajiCompact;

      if (aliasRomaji && aliasRomaji !== compactLatinSearchText(alias.kana)) {
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
  const leftSegment = left.segmentId
    ? (segmentIndex.get(left.segmentId) ?? 999)
    : 999;
  const rightSegment = right.segmentId
    ? (segmentIndex.get(right.segmentId) ?? 999)
    : 999;

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
    const key = buildEntryKey(row.entryType, row.entryId);
    const existing = map.get(key);

    if (existing) {
      existing.push(row);
      continue;
    }

    map.set(key, [row]);
  }

  return map;
}

function buildEntryCardCountMap(rows: EntryCardCount[]) {
  return new Map(
    rows.map(
      (row) =>
        [buildEntryKey(row.entryType, row.entryId), row.cardCount] as const
    )
  );
}

function buildResolvedEntriesFromMaps(input: {
  cardCountByEntry: Map<string, number>;
  entries: GlossaryBaseEntry[];
  filters: GlossaryQueryState;
  studySignalsByEntry: Map<string, StudySignalRow[]>;
}) {
  const query = buildFilteredQuery(input.filters.query);

  return input.entries.map((entry) => {
    const studySignals = (
      input.studySignalsByEntry.get(
        buildEntryKey(entry.kind, entry.internalId)
      ) ?? []
    ).map((signal) => ({
      manualOverride: signal.manualOverride,
      reviewState: signal.reviewState
    }));
    const studyState = deriveEntryStudyState(studySignals);
    const rankedEntry =
      buildRankedGlossaryEntry(entry, query, studyState) ??
      ({
        ...entry,
        href: mediaGlossaryEntryHref(entry.mediaSlug, entry.kind, entry.id),
        matchBadges: [],
        matchedFields: {
          aliases: []
        },
        score: 0,
        studyState
      } satisfies RankedGlossaryEntry);
    const cardCount =
      input.cardCountByEntry.get(buildEntryKey(entry.kind, entry.internalId)) ??
      0;

    return {
      ...rankedEntry,
      cardCount,
      hasCards: cardCount > 0,
      matchesCurrentFilters:
        entryMatchesGlossaryFilters(
          {
            cardCount,
            kind: entry.kind,
            mediaSlug: entry.mediaSlug,
            segmentId: entry.segmentId,
            studyState
          },
          input.filters
        ) &&
        (!query || rankedEntry.score > 0),
      matchesCurrentQuery: !query || rankedEntry.score > 0
    };
  });
}

function groupRowsByEntry<Row extends { entryId: string; entryType: string }>(
  rows: Row[]
) {
  const map = new Map<string, Row[]>();

  for (const row of rows) {
    const key = buildEntryKey(row.entryType, row.entryId);
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
          (left, right) =>
            getEntryLinkRoleRank(left) - getEntryLinkRoleRank(right)
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

    if (
      (left.sortOrder ?? Number.MAX_SAFE_INTEGER) !==
      (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
    ) {
      return (
        (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return left.lessonTitle.localeCompare(right.lessonTitle);
  });
}

function pickPrimaryLesson(
  rows: AggregatedLessonConnection[],
  mediaSlug: string
): GlossaryPageData["results"][number]["primaryLesson"] {
  const primary = pickBestBy(rows, (left, right) => {
    const leftRank = getEntryLinkRoleRank(left.linkRoles[0]);
    const rightRank = getEntryLinkRoleRank(right.linkRoles[0]);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    if (left.lessonOrderIndex !== right.lessonOrderIndex) {
      return left.lessonOrderIndex - right.lessonOrderIndex;
    }

    return left.lessonTitle.localeCompare(right.lessonTitle);
  });

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
    const studySignals = (
      studySignalsByEntry.get(`${entry.kind}:${entry.internalId}`) ?? []
    ).map((signal) => ({
      manualOverride: signal.manualOverride,
      reviewState: signal.reviewState
    }));
    const studyState = deriveEntryStudyState(studySignals);

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
