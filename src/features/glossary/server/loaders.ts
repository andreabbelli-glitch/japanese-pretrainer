import { db, type DatabaseClient } from "@/db";
import {
  countGlobalGlossaryBrowseGroups,
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
  listGlossarySearchCandidateRefs,
  listGlossarySegmentsByMediaId,
  listGrammarEntrySummaries,
  listTermEntrySummaries,
  type GlobalGlossaryBrowseGroupRef,
  type GlossarySearchCandidateRef,
  type GrammarGlossaryEntry,
  type GrammarGlossaryEntrySummary,
  type TermGlossaryEntry,
  type TermGlossaryEntrySummary
} from "@/db/queries";
import { buildEntryKey } from "@/lib/entry-id";
import {
  GLOSSARY_SUMMARY_TAG,
  buildGlossarySummaryTags,
  canUseDataCache,
  getMediaBySlugCached,
  listMediaCached,
  MEDIA_LIST_TAG,
  REVIEW_SUMMARY_TAG,
  runWithTaggedCache
} from "@/lib/data-cache";
import {
  aggregateGlossaryLessonConnections,
  pickPrimaryGlossaryLesson
} from "@/features/glossary/model/detail-helpers";
import {
  buildFilteredQuery,
  buildGlobalGlossaryAutocompleteSuggestions,
  compareRankedEntries
} from "@/features/glossary/model/search";
import {
  buildEntryCardCountMap,
  buildGlobalGlossaryResults,
  buildGlossaryStats,
  buildResolvedEntriesFromMaps,
  buildStudySignalMap,
  groupResolvedEntriesByResult,
  groupRowsByEntry,
  hasActiveGlossaryFilters,
  normalizeGlossaryQuery
} from "@/features/glossary/model/filter";
import {
  buildGlossaryDetailData,
  buildGlossaryMediaSummary,
  mapEntryToBaseModel,
  mapGrammarSummaryToBaseModel,
  mapTermSummaryToBaseModel
} from "@/features/glossary/model/format";
import { defaultStudySettings, getGlossaryDefaultSort } from "@/lib/settings";
import { mediaGlossaryEntryHref } from "@/lib/site";
import { deriveEntryStudyState } from "@/lib/study-entry";
import type {
  GlossaryBaseEntry,
  GlossaryDetailData,
  GlossaryKind,
  GlossaryPageData,
  GlossaryQueryState,
  RankedGlossaryEntry,
  GlossarySearchResult,
  GlobalGlossaryAutocompleteSuggestion,
  GlobalGlossaryPageData,
  GlobalGlossaryPagination
} from "../types";
type GlossaryLoadMode = "list" | "search";

const GLOBAL_GLOSSARY_PAGE_SIZE = 24;

function createDefaultSortLoader(database: DatabaseClient) {
  let defaultSortPromise: ReturnType<typeof getGlossaryDefaultSort> | undefined;

  return () => {
    defaultSortPromise ??= getGlossaryDefaultSort(database);
    return defaultSortPromise;
  };
}

export async function loadGlossaryPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryPageData | null> {
  const requestedSort = readGlossarySortSearchParam(searchParams);
  const loadDefaultSort = createDefaultSortLoader(database);
  const mediaPromise = getMediaBySlugCached(database, mediaSlug);
  const resolvedSortPromise = requestedSort
    ? Promise.resolve(requestedSort)
    : loadDefaultSort();

  if (!requestedSort) {
    void resolvedSortPromise.catch(() => {
      // The default sort lookup can be abandoned when the media slug misses.
    });
  }

  const media = await mediaPromise;

  if (!media) {
    return null;
  }

  const resolvedSort = await resolvedSortPromise;
  const filters = normalizeGlossaryQuery(searchParams, resolvedSort, {
    forcedMediaSlug: media.slug,
    supportsSegmentFilter: true
  });
  const hasActiveNonSortFilters = hasActiveGlossaryFilters(
    filters,
    filters.sort,
    {
      forcedMediaSlug: media.slug,
      supportsSegmentFilter: true
    }
  );
  const defaultSortPromise =
    requestedSort && !hasActiveNonSortFilters ? loadDefaultSort() : null;
  const loadMode: GlossaryLoadMode =
    filters.query.length > 0 ? "search" : "list";
  const [segments, { candidates }] = await Promise.all([
    listGlossarySegmentsByMediaId(database, media.id),
    loadCachedLocalGlossaryResolvedEntries(database, media, filters, loadMode)
  ]);
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
  const selectedPreviewEntry = resolvePreviewEntry(
    searchParams,
    filteredEntries
  );
  const selectedPreviewHasCards = selectedPreviewEntry?.hasCards === true;
  const [lessonConnections, previewEntry, selectedPreviewCardConnections] =
    await Promise.all([
      listEntryLessonConnections(database, resultRefs),
      selectedPreviewEntry
        ? hydrateLocalGlossaryPreviewEntry(
            database,
            media.id,
            selectedPreviewEntry,
            loadMode
          )
        : Promise.resolve<RankedGlossaryEntry | null>(null),
      selectedPreviewEntry && selectedPreviewHasCards
        ? listEntryCardConnections(database, [
            {
              entryId: selectedPreviewEntry.internalId,
              entryType: selectedPreviewEntry.kind
            }
          ])
        : Promise.resolve([])
    ]);
  const lessonsByEntry = groupRowsByEntry(lessonConnections);
  const mediaSummary = buildGlossaryMediaSummary(media);
  const results = filteredEntries.map((entry) => {
    const lessonRows =
      lessonsByEntry.get(`${entry.kind}:${entry.internalId}`) ?? [];
    const uniqueLessons = aggregateGlossaryLessonConnections(lessonRows);
    const primaryLesson = pickPrimaryGlossaryLesson(uniqueLessons, media.slug);

    return {
      ...entry,
      bestLocalHref: entry.href,
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
      resultKey: `${entry.kind}:entry:${entry.internalId}`,
      primaryLesson
    };
  });
  const preview = previewEntry
    ? buildGlossaryDetailData({
        cardConnections: selectedPreviewCardConnections,
        entry: previewEntry,
        lessonConnections:
          lessonsByEntry.get(
            `${previewEntry.kind}:${previewEntry.internalId}`
          ) ?? [],
        crossMediaFamily: {
          group: null,
          siblings: []
        },
        media: mediaSummary
      })
    : undefined;
  const hasActiveFilters =
    hasActiveNonSortFilters ||
    filters.sort !==
      (defaultSortPromise ? await defaultSortPromise : resolvedSort);

  return {
    filters,
    hasActiveFilters,
    media: mediaSummary,
    resultSummary: {
      filtered: filteredEntries.length,
      total: candidates.length,
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
    stats: buildGlossaryStats(candidates)
  };
}

export async function loadGlobalGlossaryPageData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlobalGlossaryPageData> {
  const requestedSort = readGlossarySortSearchParam(searchParams);
  const loadDefaultSort = createDefaultSortLoader(database);
  const mediaRowsPromise = listMediaCached(database);
  const aggregateStatsPromise = getGlobalGlossaryAggregateStatsCached(database);
  const resolvedSort = requestedSort ?? (await loadDefaultSort());
  const normalizedFilters = normalizeGlossaryQuery(searchParams, resolvedSort);
  const hasActiveNonSortFilters = hasActiveGlossaryFilters(
    normalizedFilters,
    normalizedFilters.sort
  );
  const defaultSortPromise =
    requestedSort && !hasActiveNonSortFilters ? loadDefaultSort() : null;
  const resultsPromise = normalizedFilters.query
    ? loadCachedPaginatedGlobalGlossarySearchResults(
        database,
        normalizedFilters
      )
    : loadCachedPaginatedGlobalGlossaryBrowseResults(
        database,
        normalizedFilters
      );
  const [
    { filteredTotal, filters, pagination, results },
    mediaRows,
    aggregateStats
  ] = await Promise.all([
    resultsPromise,
    mediaRowsPromise,
    aggregateStatsPromise
  ]);
  const hasActiveFilters =
    hasActiveNonSortFilters ||
    filters.sort !==
      (defaultSortPromise ? await defaultSortPromise : resolvedSort);

  return {
    filters,
    hasActiveFilters,
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

function readGlossarySortSearchParam(
  searchParams: Record<string, string | string[] | undefined>
): GlossaryQueryState["sort"] | undefined {
  const candidates = Array.isArray(searchParams.sort)
    ? searchParams.sort
    : [searchParams.sort];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();

    if (trimmed === "alphabetical" || trimmed === "lesson_order") {
      return trimmed;
    }
  }

  return undefined;
}

export async function loadGlobalGlossaryAutocompleteData(
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

export async function loadGlossaryDetailData(
  mediaSlug: string,
  kind: GlossaryKind,
  entryId: string,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "detail",
      mediaSlug,
      `kind:${kind}`,
      `entry:${entryId}`
    ],
    loader: () =>
      loadGlossaryDetailDataUncached({
        database,
        entryId,
        kind,
        mediaSlug
      }),
    tags: [MEDIA_LIST_TAG, GLOSSARY_SUMMARY_TAG, REVIEW_SUMMARY_TAG]
  });
}

export async function loadGlobalGlossaryDetailData(
  kind: GlossaryKind,
  surface: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryDetailData | null> {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "global-detail",
      `kind:${kind}`,
      `surface:${surface}`,
      `media:${readFirstSearchParam(searchParams.media) ?? "all"}`,
      `source:${readFirstSearchParam(searchParams.source) ?? "all"}`
    ],
    loader: () =>
      loadGlobalGlossaryDetailDataUncached({
        database,
        kind,
        mediaSlug: readFirstSearchParam(searchParams.media),
        sourceId: readFirstSearchParam(searchParams.source),
        surface
      }),
    tags: [MEDIA_LIST_TAG, GLOSSARY_SUMMARY_TAG, REVIEW_SUMMARY_TAG]
  });
}

async function loadGlobalGlossaryDetailDataUncached(input: {
  database: DatabaseClient;
  kind: GlossaryKind;
  mediaSlug?: string;
  sourceId?: string;
  surface: string;
}): Promise<GlossaryDetailData | null> {
  const resolvedGroup = await input.database.query.crossMediaGroup.findFirst({
    where: (row, { and, eq }) =>
      and(eq(row.entryType, input.kind), eq(row.groupKey, input.surface))
  });

  if (!resolvedGroup) {
    return null;
  }

  const entries =
    input.kind === "term"
      ? await getGlossaryEntriesByCrossMediaGroupIds(input.database, "term", [
          resolvedGroup.id
        ])
      : await getGlossaryEntriesByCrossMediaGroupIds(input.database, "grammar", [
          resolvedGroup.id
        ]);

  if (entries.length === 0) {
    return null;
  }

  const preferredEntry =
    entries.find(
      (entry) =>
        entry.sourceId === input.sourceId &&
        (!input.mediaSlug || entry.media.slug === input.mediaSlug)
    ) ??
    entries.find((entry) => entry.media.slug === input.mediaSlug) ??
    entries[0]!;
  const media = preferredEntry.media;
  const entryRefs = entries.map((entry) => ({
    entryId: entry.id,
    entryType: input.kind
  }));
  const [lessonConnections, cardConnections, crossMediaFamily] =
    await Promise.all([
      listEntryLessonConnections(input.database, entryRefs),
      listEntryCardConnections(input.database, entryRefs),
      getCrossMediaFamilyByEntryId(input.database, input.kind, preferredEntry.id)
    ]);
  const entryStudySignals = cardConnections.filter(
    (connection) => connection.cardStatus === "active"
  );
  const baseEntry =
    input.kind === "term"
      ? mapEntryToBaseModel(preferredEntry as TermGlossaryEntry, "term")
      : mapEntryToBaseModel(preferredEntry as GrammarGlossaryEntry, "grammar");
  const rankedEntry = {
    ...baseEntry,
    href: mediaGlossaryEntryHref(media.slug, input.kind, baseEntry.label, {
      sourceId: preferredEntry.sourceId
    }),
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

function readFirstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return (
      value.find((entry) => typeof entry === "string" && entry.trim())?.trim() ??
      undefined
    );
  }

  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

async function loadGlossaryDetailDataUncached(input: {
  database: DatabaseClient;
  entryId: string;
  kind: GlossaryKind;
  mediaSlug: string;
}): Promise<GlossaryDetailData | null> {
  const media = await getMediaBySlugCached(input.database, input.mediaSlug);

  if (!media) {
    return null;
  }

  const entry =
    input.kind === "term"
      ? await getGlossaryEntryBySourceId(
          input.database,
          "term",
          media.id,
          input.entryId
        )
      : await getGlossaryEntryBySourceId(
          input.database,
          "grammar",
          media.id,
          input.entryId
        );

  if (!entry) {
    return null;
  }

  const crossMediaFamilyPromise = entry.crossMediaGroupId
    ? input.kind === "term"
      ? getCrossMediaFamilyByEntryId(input.database, "term", entry.id)
      : getCrossMediaFamilyByEntryId(input.database, "grammar", entry.id)
    : Promise.resolve({
        group: null,
        siblings: []
      });
  const [lessonConnections, cardConnections, crossMediaFamily] =
    await Promise.all([
      listEntryLessonConnections(input.database, [
        {
          entryId: entry.id,
          entryType: input.kind
        }
      ]),
      listEntryCardConnections(input.database, [
        {
          entryId: entry.id,
          entryType: input.kind
        }
      ]),
      crossMediaFamilyPromise
    ]);
  const entryStudySignals = cardConnections.filter(
    (connection) => connection.cardStatus === "active"
  );
  const baseEntry =
    input.kind === "term"
      ? mapEntryToBaseModel(entry as TermGlossaryEntry, "term")
      : mapEntryToBaseModel(entry as GrammarGlossaryEntry, "grammar");
  const rankedEntry = {
    ...baseEntry,
    href: mediaGlossaryEntryHref(media.slug, input.kind, baseEntry.label, {
      sourceId: entry.sourceId
    }),
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

async function hydrateLocalGlossaryPreviewEntry(
  database: DatabaseClient,
  mediaId: string,
  entry: RankedGlossaryEntry,
  mode: GlossaryLoadMode
): Promise<RankedGlossaryEntry> {
  if (mode === "search") {
    return entry;
  }

  const previewSource =
    entry.kind === "term"
      ? await getGlossaryEntryBySourceId(database, "term", mediaId, entry.id)
      : await getGlossaryEntryBySourceId(
          database,
          "grammar",
          mediaId,
          entry.id
        );

  if (!previewSource) {
    return entry;
  }

  const baseEntry =
    entry.kind === "term"
      ? mapEntryToBaseModel(previewSource as TermGlossaryEntry, "term")
      : mapEntryToBaseModel(previewSource as GrammarGlossaryEntry, "grammar");

  return {
    ...baseEntry,
    href: entry.href,
    matchBadges: entry.matchBadges,
    matchPreview: entry.matchPreview,
    matchedFields: entry.matchedFields,
    score: entry.score,
    studyState: entry.studyState
  };
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

async function loadCachedLocalGlossaryBaseEntries(
  database: DatabaseClient,
  media: {
    id: string;
    slug: string;
  },
  options: {
    entryType?: GlossaryQueryState["entryType"];
    mode?: GlossaryLoadMode;
  } = {}
) {
  const mode = options.mode ?? "search";

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "local-base-entries",
      `media:${media.id}:${media.slug}`,
      `mode:${mode}`,
      `type:${options.entryType ?? "all"}`
    ],
    loader: () =>
      loadGlossaryBaseEntries(database, {
        entryType: options.entryType,
        mediaId: media.id,
        mode
      }),
    tags: buildGlossarySummaryTags([media.id])
  });
}

async function loadCachedLocalGlossaryResolvedEntries(
  database: DatabaseClient,
  media: {
    id: string;
    slug: string;
  },
  filters: GlossaryQueryState,
  mode: GlossaryLoadMode
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "local-resolved-entries",
      `media:${media.id}:${media.slug}`,
      `mode:${mode}`,
      `cards:${filters.cards}`,
      ...buildGlossaryQueryCacheKeyParts(filters.query),
      `segment:${filters.segmentId}`,
      `study:${filters.study}`,
      `type:${filters.entryType}`
    ],
    loader: async () => {
      const entries = await loadCachedLocalGlossaryBaseEntries(
        database,
        media,
        {
          entryType: filters.entryType,
          mode
        }
      );

      return buildGlossaryResolvedEntries(database, entries, filters);
    },
    tags: buildGlossarySummaryTags([media.id])
  });
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

async function loadCachedGlobalGlossarySearchEntries(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "search-entries",
      ...buildGlossaryQueryCacheKeyParts(filters.query),
      `type:${filters.entryType}`
    ],
    loader: () => loadGlobalGlossarySearchEntries(database, filters),
    tags: [GLOSSARY_SUMMARY_TAG]
  });
}

async function loadCachedGlobalGlossaryResolvedEntries(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "search-resolved",
      `cards:${filters.cards}`,
      `media:${filters.media}`,
      ...buildGlossaryQueryCacheKeyParts(filters.query),
      `study:${filters.study}`,
      `type:${filters.entryType}`
    ],
    loader: async () => {
      const entries = await loadCachedGlobalGlossarySearchEntries(
        database,
        filters
      );

      return buildGlobalGlossaryResolvedEntries(database, entries, filters);
    },
    tags: [GLOSSARY_SUMMARY_TAG]
  });
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
      if (ref.crossMediaGroupId) {
        termGroupIds.add(ref.crossMediaGroupId);
      } else {
        termIds.add(ref.entryId);
      }

      continue;
    }

    if (ref.crossMediaGroupId) {
      grammarGroupIds.add(ref.crossMediaGroupId);
    } else {
      grammarIds.add(ref.entryId);
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
  const browseQuery = {
    cards: filters.cards,
    entryType: filters.entryType === "all" ? undefined : filters.entryType,
    mediaSlug: filters.media === "all" ? undefined : filters.media,
    pageSize: GLOBAL_GLOSSARY_PAGE_SIZE,
    sort: filters.sort,
    study: filters.study === "all" ? undefined : filters.study
  } as const;
  let pageRefs = await listGlobalGlossaryBrowseGroupRefs(database, {
    ...browseQuery,
    page: filters.page
  });
  const filteredTotal =
    pageRefs[0]?.totalCount ??
    (filters.page > 1
      ? await countGlobalGlossaryBrowseGroups(database, {
          cards: browseQuery.cards,
          entryType: browseQuery.entryType,
          mediaSlug: browseQuery.mediaSlug,
          study: browseQuery.study
        })
      : 0);
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

  if (pagination.page !== filters.page) {
    pageRefs = await listGlobalGlossaryBrowseGroupRefs(database, {
      ...browseQuery,
      page: pagination.page
    });
  }

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
  const { filteredTotal, results: allResults } =
    await loadCachedGlobalGlossarySearchResults(database, filters);
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

async function loadCachedGlobalGlossarySearchResults(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "search-results",
      `cards:${filters.cards}`,
      `media:${filters.media}`,
      ...buildGlossaryQueryCacheKeyParts(filters.query),
      `sort:${filters.sort}`,
      `study:${filters.study}`,
      `type:${filters.entryType}`
    ],
    loader: async () => {
      const { candidates } = await loadCachedGlobalGlossaryResolvedEntries(
        database,
        filters
      );
      const results = buildGlobalGlossaryResults(candidates, filters);

      return {
        filteredTotal: results.length,
        results
      };
    },
    tags: [GLOSSARY_SUMMARY_TAG]
  });
}

function buildGlossaryQueryCacheKeyParts(query: string) {
  const filteredQuery = buildFilteredQuery(query);

  return [
    `query:${filteredQuery?.normalized ?? ""}`,
    `kana:${filteredQuery?.kana ?? ""}`,
    `grammar-kana:${filteredQuery?.grammarKana ?? ""}`,
    `compact:${filteredQuery?.compact ?? ""}`
  ];
}

async function loadCachedPaginatedGlobalGlossarySearchResults(
  database: DatabaseClient,
  filters: GlossaryQueryState
) {
  const cachedResults = await runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "search-page",
      `cards:${filters.cards}`,
      `media:${filters.media}`,
      `page:${filters.page}`,
      ...buildGlossaryQueryCacheKeyParts(filters.query),
      `sort:${filters.sort}`,
      `study:${filters.study}`,
      `type:${filters.entryType}`
    ],
    loader: () => loadPaginatedGlobalGlossarySearchResults(database, filters),
    tags: [GLOSSARY_SUMMARY_TAG]
  });

  return {
    ...cachedResults,
    filters: {
      ...cachedResults.filters,
      query: filters.query
    }
  };
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
      ...buildGlossaryQueryCacheKeyParts(filters.query),
      `study:${filters.study}`,
      `type:${filters.entryType}`
    ],
    loader: async () => {
      const { candidates } = await loadCachedGlobalGlossaryResolvedEntries(
        database,
        filters
      );
      const groups = groupResolvedEntriesByResult(candidates);

      return buildGlobalGlossaryAutocompleteSuggestions(
        groups,
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

function resolvePreviewEntry<T extends { id: string; kind: GlossaryKind }>(
  searchParams: Record<string, string | string[] | undefined>,
  results: T[]
) {
  const previewKind = readMatchingSearchParam(
    searchParams,
    "previewKind",
    (value) => value === "term" || value === "grammar"
  ) as "term" | "grammar" | undefined;

  if (!previewKind) {
    return results[0];
  }

  const selected = readMatchingSearchParam(searchParams, "preview", (value) =>
    results.some((result) => result.id === value && result.kind === previewKind)
  );

  if (selected) {
    return results.find(
      (result) => result.id === selected && result.kind === previewKind
    );
  }

  return results[0];
}

function readMatchingSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
  matcher: (value: string) => boolean
) {
  const value = searchParams[key];
  const candidates = Array.isArray(value) ? value : [value];

  for (const entry of candidates) {
    const trimmed = entry?.trim();

    if (!trimmed) {
      continue;
    }

    if (matcher(trimmed)) {
      return trimmed;
    }
  }

  return undefined;
}
