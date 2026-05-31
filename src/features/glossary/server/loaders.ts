import { db, type DatabaseClient } from "@/db";
import {
  getCrossMediaFamilyByEntryId,
  getGlossaryEntriesByCrossMediaGroupIds,
  getGlossaryEntryBySourceId,
  listEntryCardConnections,
  listEntryLessonConnections,
  listGlossaryEntriesByKind,
  listGlossarySegmentsByMediaId,
  listGrammarEntrySummaries,
  listTermEntrySummaries,
  type GrammarGlossaryEntry,
  type GrammarGlossaryEntrySummary,
  type TermGlossaryEntry,
  type TermGlossaryEntrySummary
} from "@/db/queries";
import { readMatchingSearchParam } from "@/features/shared/model/search-params";
import {
  GLOSSARY_SUMMARY_TAG,
  buildGlossarySummaryTags,
  canUseDataCache,
  getMediaBySlugCached,
  listMediaCached,
  MEDIA_LIST_TAG,
  REVIEW_SUMMARY_TAG,
  runWithTaggedCache
} from "@/features/cache/server/data-cache";
import { compareRankedEntries } from "@/features/glossary/model/search";
import {
  buildGlossaryStats,
  groupRowsByEntry,
  hasActiveGlossaryFilters,
  normalizeGlossaryQuery
} from "@/features/glossary/model/filter";
import {
  buildGlossaryDetailData,
  buildLocalGlossaryPreviewData,
  buildLocalGlossaryResults,
  buildGlossaryMediaSummary,
  buildRankedGlossaryDetailEntry,
  mapEntryToBaseModel,
  mapGrammarSummaryToBaseModel,
  mapTermSummaryToBaseModel
} from "@/features/glossary/model/format";
import {
  defaultStudySettings,
  getGlossaryDefaultSort
} from "@/features/settings/server";
import { normalizeReviewSubjectSurface } from "@/features/review/model/subject";
import { buildGlossaryResolvedEntries } from "./entry-resolution";
import {
  getGlobalGlossaryAggregateStatsCached,
  loadCachedGlobalGlossaryAutocompleteData,
  loadCachedPaginatedGlobalGlossaryBrowseResults,
  loadCachedPaginatedGlobalGlossarySearchResults
} from "./global-results";
import { buildGlossaryQueryCacheKeyParts } from "./query-cache";
import type {
  GlossaryDetailData,
  GlossaryKind,
  GlossaryPageData,
  GlossaryQueryState,
  RankedGlossaryEntry,
  GlobalGlossaryAutocompleteSuggestion,
  GlobalGlossaryPageData
} from "../types";
type GlossaryLoadMode = "list" | "search";

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
  const results = buildLocalGlossaryResults({
    entries: filteredEntries,
    lessonsByEntry,
    mediaSlug: media.slug
  });
  const preview = buildLocalGlossaryPreviewData({
    cardConnections: selectedPreviewCardConnections,
    entry: previewEntry,
    lessonsByEntry,
    media: mediaSummary
  });
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
  const normalizedSurface = normalizeReviewSubjectSurface(surface);

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: [
      "glossary",
      "global-detail",
      `kind:${kind}`,
      `surface:${normalizedSurface}`,
      `media:${readFirstSearchParam(searchParams.media) ?? "all"}`,
      `source:${readFirstSearchParam(searchParams.source) ?? "all"}`
    ],
    loader: () =>
      loadGlobalGlossaryDetailDataUncached({
        database,
        kind,
        mediaSlug: readFirstSearchParam(searchParams.media),
        sourceId: readFirstSearchParam(searchParams.source),
        surface: normalizedSurface
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
      : await getGlossaryEntriesByCrossMediaGroupIds(
          input.database,
          "grammar",
          [resolvedGroup.id]
        );

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
      getCrossMediaFamilyByEntryId(
        input.database,
        input.kind,
        preferredEntry.id
      )
    ]);
  const rankedEntry = buildRankedGlossaryDetailEntry({
    cardConnections,
    entry: preferredEntry,
    kind: input.kind
  });

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
      value
        .find((entry) => typeof entry === "string" && entry.trim())
        ?.trim() ?? undefined
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
  const rankedEntry = buildRankedGlossaryDetailEntry({
    cardConnections,
    entry,
    kind: input.kind
  });

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

function resolvePreviewEntry<T extends { id: string; kind: GlossaryKind }>(
  searchParams: Record<string, string | string[] | undefined>,
  results: T[]
) {
  const previewKind = readMatchingSearchParam(
    searchParams.previewKind,
    (value) => value === "term" || value === "grammar"
  ) as "term" | "grammar" | undefined;

  if (!previewKind) {
    return results[0];
  }

  const selected = readMatchingSearchParam(searchParams.preview, (value) =>
    results.some((result) => result.id === value && result.kind === previewKind)
  );

  if (selected) {
    return results.find(
      (result) => result.id === selected && result.kind === previewKind
    );
  }

  return results[0];
}
