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
  listGlossarySearchCandidateRefs,
  listGlossarySegmentsByMediaId,
  listGrammarEntrySummaries,
  listTermEntrySummaries,
  type DatabaseClient,
  type GlobalGlossaryBrowseGroupRef,
  type GlossarySearchCandidateRef,
  type GrammarGlossaryEntry,
  type GrammarGlossaryEntrySummary,
  type TermGlossaryEntry,
  type TermGlossaryEntrySummary
} from "@/db";
import { buildEntryKey } from "@/lib/entry-id";
import {
  GLOSSARY_SUMMARY_TAG,
  buildGlossarySummaryTags,
  canUseDataCache,
  getMediaBySlugCached,
  listMediaCached,
  runWithTaggedCache
} from "@/lib/data-cache";
import {
  aggregateGlossaryLessonConnections,
  pickPrimaryGlossaryLesson
} from "@/lib/glossary-detail-helpers";
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
  normalizeGlossaryQuery
} from "@/lib/glossary-filter";
import {
  buildGlossaryDetailData,
  buildGlossaryMediaSummary,
  mapEntryToBaseModel,
  mapGrammarSummaryToBaseModel,
  mapTermSummaryToBaseModel
} from "@/lib/glossary-format";
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
} from "./glossary";
type GlossaryLoadMode = "list" | "search";

const GLOBAL_GLOSSARY_PAGE_SIZE = 24;

export async function loadGlossaryPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db
): Promise<GlossaryPageData | null> {
  const [media, defaultSort] = await Promise.all([
    getMediaBySlugCached(database, mediaSlug),
    getGlossaryDefaultSort(database)
  ]);

  if (!media) {
    return null;
  }
  const filters = normalizeGlossaryQuery(searchParams, defaultSort, {
    forcedMediaSlug: media.slug,
    supportsSegmentFilter: true
  });
  const loadMode: GlossaryLoadMode =
    filters.query.length > 0 ? "search" : "list";
  const [segments, entries] = await Promise.all([
    listGlossarySegmentsByMediaId(database, media.id),
    loadGlossaryBaseEntries(database, {
      entryType: filters.entryType,
      mediaId: media.id,
      mode: loadMode
    })
  ]);
  const { candidates } = await buildGlossaryResolvedEntries(
    database,
    entries,
    filters
  );
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
      primaryLesson,
      resultKey: `${entry.kind}:entry:${entry.internalId}`
    };
  });
  const selectedPreviewEntry = resolvePreviewEntry(searchParams, results);
  const previewEntry = selectedPreviewEntry
    ? await hydrateLocalGlossaryPreviewEntry(
        database,
        media.id,
        selectedPreviewEntry,
        loadMode
      )
    : null;
  const selectedPreviewCardConnections = previewEntry
    ? await listEntryCardConnections(database, [
        {
          entryId: previewEntry.internalId,
          entryType: previewEntry.kind
        }
      ])
    : [];
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
    stats: buildGlossaryStats(candidates)
  };
}

export async function loadGlobalGlossaryPageData(
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
      ? await loadCachedPaginatedGlobalGlossarySearchResults(
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

async function hydrateLocalGlossaryPreviewEntry(
  database: DatabaseClient,
  mediaId: string,
  entry: GlossaryPageData["results"][number],
  mode: GlossaryLoadMode
): Promise<RankedGlossaryEntry> {
  if (mode === "search") {
    return entry;
  }

  const previewSource =
    entry.kind === "term"
      ? await getGlossaryEntryBySourceId(database, "term", mediaId, entry.id)
      : await getGlossaryEntryBySourceId(database, "grammar", mediaId, entry.id);

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
  const entries = await loadCachedGlobalGlossarySearchEntries(database, filters);
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
      const entries = await loadCachedGlobalGlossarySearchEntries(
        database,
        filters
      );
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
