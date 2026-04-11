import {
  countReviewSubjectsIntroducedOnDay,
  db,
  getGlobalReviewOverviewCounts,
  listReviewLaunchCandidates,
  listReviewCardsByMediaId,
  listReviewCardsByMediaIds,
  type DatabaseClient,
  type MediaListItem,
  type ReviewCardListItem,
  type ReviewLaunchCandidate
} from "@/db";
import {
  buildReviewSummaryTags,
  canUseDataCache,
  getMediaBySlugCached,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import { pickBestBy } from "@/lib/collections";
import { getLocalIsoDateKey } from "@/lib/local-date";
import {
  getReviewDailyLimit,
  getStudySettings
} from "@/lib/settings";
import { measureWith, type ReviewProfiler } from "@/lib/review-profiler";
import { resolveReviewSubjectGroups } from "./review-subject-state-lookup";
import { hasCompletedReviewLesson } from "./review-model";
import {
  buildQueueIntroLabel,
  buildReviewOverviewSnapshot,
  buildReviewSubjectModels,
  bucketAndSortReviewSubjectModels
} from "./review-queue";
import type { ReviewSubjectGroup } from "./review-subject";
import {
  buildEntryLookup,
  collectReviewLinkedEntryIds,
  type ReviewEntryLookupItem,
  type ReviewGrammarLookupEntry,
  type ReviewTermLookupEntry
} from "./review-card-hydration";
import type { ReviewOverviewSnapshot } from "./review-types";
import type { ReviewSearchState } from "./review-search-state";

export type ReviewPageLoadOptions = {
  bypassCache?: boolean;
  excludeCardIds?: string[];
  profiler?: ReviewProfiler | null;
  resolvedMedia?: NonNullable<Awaited<ReturnType<typeof getMediaBySlugCached>>>;
};

export type LoadedReviewWorkspaceV2 = {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  grammar: ReviewGrammarLookupEntry[];
  newIntroducedTodayCount: number;
  now: Date;
  rawCardCount: number;
  subjectGroups: ReviewSubjectGroup[];
  terms: ReviewTermLookupEntry[];
};

type CachedReviewWorkspaceV2 = {
  cards: ReviewCardListItem[];
  grammar: ReviewGrammarLookupEntry[];
  rawCardCount: number;
  terms: ReviewTermLookupEntry[];
};

export type LoadedGlobalReviewPageWorkspace = {
  mediaRows: MediaListItem[];
  reviewFrontFurigana: boolean;
  searchState: ReviewSearchState;
} & LoadedReviewWorkspaceV2;

const EMPTY_ENTRY_LOOKUP = new Map<string, ReviewEntryLookupItem>();

export async function loadReviewEntrySummariesForCards(input: {
  cards: ReviewCardListItem[];
  database: DatabaseClient;
  profiler?: ReviewProfiler | null;
}) {
  const { grammarIds, termIds } = collectReviewLinkedEntryIds(input.cards);
  const [terms, grammar] = await Promise.all([
    measureWith(input.profiler, "listTermEntryReviewSummariesByIds", () =>
      import("@/db").then(({ listTermEntryReviewSummariesByIds }) =>
        listTermEntryReviewSummariesByIds(input.database, termIds)
      )
    ),
    measureWith(input.profiler, "listGrammarEntryReviewSummariesByIds", () =>
      import("@/db").then(({ listGrammarEntryReviewSummariesByIds }) =>
        listGrammarEntryReviewSummariesByIds(input.database, grammarIds)
      )
    )
  ]);

  return {
    grammar,
    terms
  };
}

export async function loadStableReviewWorkspaceV2(input: {
  database: DatabaseClient;
  mediaIds: string[];
  profiler?: ReviewProfiler | null;
}): Promise<CachedReviewWorkspaceV2> {
  const reviewCards = await (input.mediaIds.length > 0
    ? measureWith(input.profiler, "listReviewCardsByMediaIds", () =>
        listReviewCardsByMediaIds(input.database, input.mediaIds)
      )
    : Promise.resolve([]));
  const eligibleCards = await measureWith(
    input.profiler,
    "buildEligibleReviewCardsByMedia",
    () =>
      buildEligibleReviewCardsByMedia({
        cards: reviewCards,
        mediaIds: input.mediaIds
      }),
    (value) => ({
      mediaBuckets: value.size
    })
  );
  const cards = [...eligibleCards.values()].flat();

  if (cards.length === 0) {
    return {
      cards,
      grammar: [],
      rawCardCount: reviewCards.length,
      terms: []
    };
  }

  const { terms, grammar } = await measureWith(
    input.profiler,
    "loadReviewEntrySummariesForCards",
    () =>
      loadReviewEntrySummariesForCards({
        cards,
        database: input.database,
        profiler: input.profiler
      }),
    { cards: cards.length }
  );

  return {
    cards,
    grammar,
    rawCardCount: reviewCards.length,
    terms
  };
}

export async function loadStableReviewWorkspaceV2Cached(input: {
  bypassCache?: boolean;
  database: DatabaseClient;
  mediaIds: string[];
  profiler?: ReviewProfiler | null;
}) {
  const orderedMediaIds = [...new Set(input.mediaIds)].sort();
  const cacheEligible = !input.bypassCache && canUseDataCache(input.database);

  return measureWith(
    input.profiler,
    "loadStableReviewWorkspaceV2Cached",
    () =>
      runWithTaggedCache({
        enabled: cacheEligible,
        keyParts: [
          "review",
          "stable-workspace",
          ...orderedMediaIds.map((mediaId) => `media:${mediaId}`)
        ],
        loader: () => loadStableReviewWorkspaceV2(input),
        tags: buildReviewSummaryTags(orderedMediaIds)
      }),
    { cacheEligible, mediaIds: orderedMediaIds.length }
  );
}

export async function loadReviewWorkspaceV2(input: {
  bypassCache?: boolean;
  database?: DatabaseClient;
  mediaIds: string[];
  now?: Date;
  profiler?: ReviewProfiler | null;
  resolvedDailyLimit?: number;
  resolvedNewIntroducedTodayCount?: number;
}): Promise<LoadedReviewWorkspaceV2> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const [stableWorkspace, dailyLimit, newIntroducedTodayCount] =
    await Promise.all([
      measureWith(input.profiler, "loadStableReviewWorkspaceV2", () =>
        loadStableReviewWorkspaceV2Cached({
          bypassCache: input.bypassCache,
          database,
          mediaIds: input.mediaIds,
          profiler: input.profiler
        })
      ),
      input.resolvedDailyLimit != null
        ? input.resolvedDailyLimit
        : measureWith(input.profiler, "getReviewDailyLimit", () =>
            getReviewDailyLimit(database)
          ),
      input.resolvedNewIntroducedTodayCount != null
        ? input.resolvedNewIntroducedTodayCount
        : measureWith(input.profiler, "countReviewSubjectsIntroducedOnDay", () =>
            loadReviewIntroducedTodayCountCached(database, now)
          )
    ]);
  const cards = stableWorkspace.cards;
  input.profiler?.addMeta({
    cards: cards.length,
    mediaIds: input.mediaIds.length,
    rawCardCount: stableWorkspace.rawCardCount
  });

  if (cards.length === 0) {
    return {
      cards,
      dailyLimit,
      entryLookup: new Map(),
      grammar: [],
      newIntroducedTodayCount,
      now,
      rawCardCount: stableWorkspace.rawCardCount,
      subjectGroups: [],
      terms: []
    };
  }

  const { subjectGroups } = await measureWith(
    input.profiler,
    "resolveReviewSubjectGroups",
    () =>
      resolveReviewSubjectGroups({
        cards,
        database,
        grammar: stableWorkspace.grammar,
        nowIso: now.toISOString(),
        terms: stableWorkspace.terms
      }),
    (value) => ({ subjectGroups: value.subjectGroups.length })
  );

  return {
    cards,
    dailyLimit,
    entryLookup: buildEntryLookup(
      stableWorkspace.terms,
      stableWorkspace.grammar
    ),
    grammar: stableWorkspace.grammar,
    newIntroducedTodayCount,
    now,
    rawCardCount: stableWorkspace.rawCardCount,
    subjectGroups,
    terms: stableWorkspace.terms
  };
}

export async function loadGlobalReviewWorkspace(
  searchState: ReviewSearchState,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {},
  resolvedDailyLimit?: number
): Promise<Omit<LoadedGlobalReviewPageWorkspace, "reviewFrontFurigana">> {
  const now = new Date();
  const mediaRows = await measureWith(options.profiler, "listMediaCached", () =>
    listMediaCached(database)
  );
  const workspace = await measureWith(options.profiler, "loadReviewWorkspaceV2", () =>
    loadReviewWorkspaceV2({
      bypassCache: options.bypassCache,
      database,
      mediaIds: mediaRows.map((item) => item.id),
      now,
      profiler: options.profiler,
      resolvedDailyLimit
    })
  );

  return {
    mediaRows,
    searchState,
    ...workspace
  };
}

export async function loadGlobalReviewPageWorkspace(
  searchState: ReviewSearchState,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<LoadedGlobalReviewPageWorkspace> {
  const settings = await measureWith(
    options.profiler,
    "getStudySettings",
    () => getStudySettings(database)
  );
  const workspace = await loadGlobalReviewWorkspace(
    searchState,
    database,
    options,
    settings.reviewDailyLimit
  );

  return {
    ...workspace,
    reviewFrontFurigana: settings.reviewFrontFurigana
  };
}

export async function getEligibleReviewCardsByMediaIds(
  mediaIds: string[],
  database: DatabaseClient = db
) {
  if (mediaIds.length === 0) {
    return new Map<string, ReviewCardListItem[]>();
  }

  const cards = await listReviewCardsByMediaIds(database, mediaIds);

  return buildEligibleReviewCardsByMedia({
    cards,
    mediaIds
  });
}

export async function loadReviewLaunchCandidatesCached(
  database: DatabaseClient = db,
  nowIso = new Date().toISOString()
): Promise<ReviewLaunchCandidate[]> {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["review-launch-candidates"],
    loader: () => listReviewLaunchCandidates(database, nowIso),
    tags: [...buildReviewSummaryTags(), REVIEW_FIRST_CANDIDATE_TAG]
  });
}

export async function loadReviewIntroducedTodayCountCached(
  database: DatabaseClient = db,
  asOf: Date = new Date()
) {
  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["review-introduced-global", getLocalIsoDateKey(asOf)],
    loader: () => countReviewSubjectsIntroducedOnDay(database, asOf),
    tags: buildReviewSummaryTags()
  });
}

export async function getReviewLaunchMedia(
  database: DatabaseClient = db
): Promise<{
  slug: string;
  title: string;
} | null> {
  const candidates = await loadReviewLaunchCandidatesCached(database);

  return pickBestBy(candidates, (left, right) => {
    const scoreDifference =
      scoreReviewLaunchCandidate(left) - scoreReviewLaunchCandidate(right);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    if (left.dueCount !== right.dueCount) {
      return right.dueCount - left.dueCount;
    }

    if (left.activeReviewCards !== right.activeReviewCards) {
      return right.activeReviewCards - left.activeReviewCards;
    }

    if (left.cardsTotal !== right.cardsTotal) {
      return right.cardsTotal - left.cardsTotal;
    }

    return left.title.localeCompare(right.title, "it");
  });
}

export async function getEligibleReviewCardsByMediaId(
  mediaId: string,
  database: DatabaseClient = db
): Promise<ReviewCardListItem[]> {
  const cards = await listReviewCardsByMediaId(database, mediaId);

  return cards.filter((card) => hasCompletedReviewLesson(card));
}

export async function loadReviewOverviewSnapshots(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>
) {
  if (media.length === 0) {
    return new Map<string, ReviewOverviewSnapshot>();
  }

  const now = new Date();
  const mediaIds = media.map((item) => item.id);
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds,
    now
  });
  const snapshots = new Map<string, ReviewOverviewSnapshot>();

  const nowIso = workspace.now.toISOString();
  const subjectModels = buildReviewSubjectModels({
    cards: workspace.cards,
    entryLookup: EMPTY_ENTRY_LOOKUP,
    nowIso,
    subjectGroups: workspace.subjectGroups
  });

  const buckets = bucketAndSortReviewSubjectModels(subjectModels);

  for (const item of media) {
    snapshots.set(
      item.id,
      buildReviewOverviewSnapshot({
        cards: workspace.cards,
        dailyLimit: workspace.dailyLimit,
        entryLookup: EMPTY_ENTRY_LOOKUP,
        extraNewCount: 0,
        newIntroducedTodayCount: workspace.newIntroducedTodayCount,
        nowIso,
        subjectGroups: workspace.subjectGroups,
        subjectModels,
        buckets,
        visibleMediaId: item.id
      })
    );
  }

  return snapshots;
}

export async function loadGlobalReviewOverviewSnapshot(
  database: DatabaseClient = db
) {
  const now = new Date();
  const [counts, dailyLimit, newIntroducedTodayCount] = await Promise.all([
    getGlobalReviewOverviewCounts(database, now),
    getReviewDailyLimit(database),
    loadReviewIntroducedTodayCountCached(database, now)
  ]);
  const newQueuedCount = Math.min(
    counts.newAvailableCount,
    Math.max(dailyLimit - newIntroducedTodayCount, 0)
  );
  const upcomingCount = Math.max(
    counts.activeReviewCards - counts.dueCount,
    0
  );

  return {
    activeCards: counts.activeReviewCards,
    dailyLimit,
    dueCount: counts.dueCount,
    effectiveDailyLimit: dailyLimit,
    manualCount: counts.manualCount,
    newAvailableCount: counts.newAvailableCount,
    newQueuedCount,
    queueCount: counts.dueCount + newQueuedCount,
    queueLabel: buildQueueIntroLabel({
      dailyLimit,
      dueCount: counts.dueCount,
      manualCount: counts.manualCount,
      newQueuedCount,
      sessionTopUpNewCount: 0,
      upcomingCount
    }),
    suspendedCount: counts.suspendedCount,
    tomorrowCount: counts.tomorrowCount,
    totalCards: counts.totalCards,
    upcomingCount
  };
}

export async function loadGlobalAndMediaReviewOverviewSnapshots(
  database: DatabaseClient,
  visibleMediaIds: string[]
) {
  const media = await listMediaCached(database);

  if (media.length === 0) {
    const emptySnapshot = buildReviewOverviewSnapshot({
      cards: [],
      dailyLimit: 0,
      entryLookup: EMPTY_ENTRY_LOOKUP,
      extraNewCount: 0,
      newIntroducedTodayCount: 0,
      nowIso: new Date().toISOString(),
      subjectStates: new Map()
    });

    return {
      global: emptySnapshot,
      byMedia: new Map<string, ReviewOverviewSnapshot>()
    };
  }

  const now = new Date();
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds: media.map((item) => item.id),
    now
  });

  const nowIso = workspace.now.toISOString();
  const subjectModels = buildReviewSubjectModels({
    cards: workspace.cards,
    entryLookup: EMPTY_ENTRY_LOOKUP,
    nowIso,
    subjectGroups: workspace.subjectGroups
  });
  const buckets = bucketAndSortReviewSubjectModels(subjectModels);

  const globalSnapshot = buildReviewOverviewSnapshot({
    cards: workspace.cards,
    dailyLimit: workspace.dailyLimit,
    entryLookup: EMPTY_ENTRY_LOOKUP,
    extraNewCount: 0,
    newIntroducedTodayCount: workspace.newIntroducedTodayCount,
    nowIso,
    subjectGroups: workspace.subjectGroups,
    subjectModels,
    buckets
  });

  const byMedia = new Map<string, ReviewOverviewSnapshot>();

  for (const mediaId of visibleMediaIds) {
    byMedia.set(
      mediaId,
      buildReviewOverviewSnapshot({
        cards: workspace.cards,
        dailyLimit: workspace.dailyLimit,
        entryLookup: EMPTY_ENTRY_LOOKUP,
        extraNewCount: 0,
        newIntroducedTodayCount: workspace.newIntroducedTodayCount,
        nowIso,
        subjectGroups: workspace.subjectGroups,
        subjectModels,
        buckets,
        visibleMediaId: mediaId
      })
    );
  }

  return { global: globalSnapshot, byMedia };
}

function buildEligibleReviewCardsByMedia(input: {
  cards: ReviewCardListItem[];
  mediaIds: string[];
}) {
  const requestedMediaIds = new Set(input.mediaIds);
  const eligibleCards = new Map<string, ReviewCardListItem[]>(
    input.mediaIds.map((mediaId) => [mediaId, []])
  );

  for (const card of input.cards) {
    if (
      !requestedMediaIds.has(card.mediaId) ||
      !hasCompletedReviewLesson(card)
    ) {
      continue;
    }

    eligibleCards.get(card.mediaId)?.push(card);
  }

  return eligibleCards;
}

function scoreReviewLaunchCandidate(candidate: {
  activeReviewCards: number;
  cardsTotal: number;
  dueCount: number;
}) {
  if (candidate.dueCount > 0) {
    return 0;
  }

  if (candidate.activeReviewCards > 0) {
    return 1;
  }

  if (candidate.cardsTotal > 0) {
    return 2;
  }

  return 3;
}
