import type { DatabaseClient } from "@/db";
import {
  countGlobalGlossaryBrowseGroups,
  getGlobalGlossaryAggregateStats,
  getGlossaryEntriesByCrossMediaGroupIds,
  getGlossaryEntriesByIds,
  listGlobalGlossaryBrowseGroupRefs,
  listGlossarySearchCandidateRefs,
  type GlobalGlossaryBrowseGroupRef,
  type GlossarySearchCandidateRef,
  type GrammarGlossaryEntry,
  type TermGlossaryEntry
} from "@/db/queries";
import {
  GLOSSARY_SUMMARY_TAG,
  buildGlossarySummaryTags,
  canUseDataCache,
  runWithTaggedCache
} from "@/features/cache/server/data-cache";
import {
  buildGlobalGlossaryResults,
  groupResolvedEntriesByResult
} from "@/features/glossary/model/filter";
import { mapEntryToBaseModel } from "@/features/glossary/model/format";
import {
  buildFilteredQuery,
  buildGlobalGlossaryAutocompleteSuggestions
} from "@/features/glossary/model/search";
import { buildEntryKey } from "@/features/study/model/entry-id";
import type {
  GlossaryQueryState,
  GlossarySearchResult,
  GlobalGlossaryPagination
} from "../types";
import { buildGlossaryResolvedEntries } from "./entry-resolution";
import { buildGlossaryQueryCacheKeyParts } from "./query-cache";

const GLOBAL_GLOSSARY_PAGE_SIZE = 24;

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

      return buildGlossaryResolvedEntries(database, entries, filters);
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
  const { candidates } = await buildGlossaryResolvedEntries(
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

export async function getGlobalGlossaryAggregateStatsCached(
  database: DatabaseClient
) {
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

export async function loadCachedPaginatedGlobalGlossarySearchResults(
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

export async function loadCachedPaginatedGlobalGlossaryBrowseResults(
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

export async function loadCachedGlobalGlossaryAutocompleteData(
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
