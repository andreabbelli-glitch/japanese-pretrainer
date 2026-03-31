import { mediaGlossaryEntryHref } from "@/lib/site";
import { type GlossaryDefaultSort } from "@/lib/settings";
import { deriveEntryStudyState } from "@/lib/study-entry";
import { buildEntryKey } from "@/lib/entry-id";
import { pickBestBy } from "@/lib/collections";
import {
  buildFilteredQuery,
  buildRankedGlossaryEntry,
  compareBestLocalEntries,
  compareGlobalGlossaryResults,
  compareMediaHits
} from "@/lib/glossary-search";
import type {
  GlossaryBaseEntry,
  GlossaryCardsFilter,
  GlossaryQueryState,
  GlossaryResolvedEntry,
  GlossarySearchResult,
  RankedGlossaryEntry,
  StudySignalRow
} from "@/lib/glossary";

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

export function normalizeGlossaryQuery(
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

export function hasActiveGlossaryFilters(
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

export function entryMatchesGlossaryFilters(
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

export function buildResolvedEntriesFromMaps(input: {
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

export function groupResolvedEntriesByResult(entries: GlossaryResolvedEntry[]) {
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

export function buildGlobalGlossaryResult(
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

export function buildGlobalGlossaryResults(
  candidates: GlossaryResolvedEntry[],
  filters: GlossaryQueryState
) {
  const groups = groupResolvedEntriesByResult(candidates);

  return [...groups.values()]
    .map((group) => buildGlobalGlossaryResult(group, filters))
    .filter((result): result is GlossarySearchResult => result !== null)
    .sort((left, right) => compareGlobalGlossaryResults(left, right, filters));
}

export function buildGlossaryStats(
  entries: Array<
    Pick<GlossaryBaseEntry, "kind"> &
      Pick<RankedGlossaryEntry, "studyState">
  >
) {
  let grammarCount = 0;
  let knownCount = 0;
  let reviewCount = 0;
  let termCount = 0;

  for (const entry of entries) {
    if (entry.kind === "grammar") {
      grammarCount += 1;
    }

    if (entry.kind === "term") {
      termCount += 1;
    }

    if (entry.studyState.key === "known") {
      knownCount += 1;
    }

    if (entry.studyState.key === "review") {
      reviewCount += 1;
    }
  }

  return {
    grammarCount,
    knownCount,
    reviewCount,
    termCount
  };
}

export function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

export function groupRowsByEntry<
  Row extends { entryId: string; entryType: string }
>(rows: Row[]) {
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

export function buildStudySignalMap(rows: StudySignalRow[]) {
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

export function buildEntryCardCountMap(
  rows: Array<{ entryType: string; entryId: string; cardCount: number }>
) {
  return new Map(
    rows.map(
      (row) =>
        [buildEntryKey(row.entryType, row.entryId), row.cardCount] as const
    )
  );
}
