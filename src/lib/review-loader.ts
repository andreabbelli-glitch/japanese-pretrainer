import { db, type DatabaseClient } from "@/db";
import {
  countReviewSubjectsIntroducedOnDay,
  getReviewLaunchCandidateByMediaId,
  listGrammarEntryReviewSummariesByIds,
  listReviewMediaRefs,
  listReviewLaunchCandidates,
  listReviewCardsByMediaId,
  listReviewCardsByMediaIds,
  listReviewSubjectStatesByKeys,
  listTermEntryReviewSummariesByIds,
  type GlobalReviewOverviewData,
  type MediaListItem,
  type ReviewCardListItem,
  type ReviewLaunchCandidate
} from "@/db/queries";
import {
  buildReviewSummaryTags,
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import { pickBestBy } from "@/lib/collections";
import { getLocalIsoDateKey, getLocalIsoTimeBucketKey } from "@/lib/local-date";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import { getReviewDailyLimit, getStudySettings } from "@/lib/settings";
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
import { getPendingConsolidationSubjectKeySet } from "./consolidation";

export type ReviewPageLoadOptions = {
  bypassCache?: boolean;
  excludeCardIds?: string[];
  profiler?: ReviewProfiler | null;
  resolvedMedia?: Pick<MediaListItem, "id" | "slug" | "title">;
  resolvedMediaRows?: MediaListItem[];
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
  reviewAutoplayAudioOnReveal: boolean;
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
      listTermEntryReviewSummariesByIds(input.database, termIds)
    ),
    measureWith(input.profiler, "listGrammarEntryReviewSummariesByIds", () =>
      listGrammarEntryReviewSummariesByIds(input.database, grammarIds)
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
  const cards = await measureWith(
    input.profiler,
    "filterEligibleReviewCards",
    () => filterEligibleReviewCards(reviewCards),
    (value) => ({
      cards: value.length
    })
  );

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
        loader: () =>
          loadStableReviewWorkspaceV2({
            ...input,
            mediaIds: orderedMediaIds
          }),
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
  resolvedDailyLimit?: number | Promise<number>;
  resolvedNewIntroducedTodayCount?: number;
}): Promise<LoadedReviewWorkspaceV2> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const stableWorkspacePromise = measureWith(
    input.profiler,
    "loadStableReviewWorkspaceV2",
    () =>
      loadStableReviewWorkspaceV2Cached({
        bypassCache: input.bypassCache,
        database,
        mediaIds: input.mediaIds,
        profiler: input.profiler
      })
  );
  const subjectGroupsPromise = stableWorkspacePromise.then(
    async (stableWorkspace) => {
      if (stableWorkspace.cards.length === 0) {
        return [] as ReviewSubjectGroup[];
      }

      const { subjectGroups } = await measureWith(
        input.profiler,
        "resolveReviewSubjectGroups",
        () =>
          resolveReviewSubjectGroups({
            cards: stableWorkspace.cards,
            grammar: stableWorkspace.grammar,
            loadSubjectStatesByKeys: (subjectKeys) =>
              listReviewSubjectStatesByKeys(database, subjectKeys),
            nowIso: now.toISOString(),
            terms: stableWorkspace.terms
          }),
        (value) => ({ subjectGroups: value.subjectGroups.length })
      );

      const pendingConsolidationSubjectKeys =
        await getPendingConsolidationSubjectKeySet(
          database,
          subjectGroups.map((group) => group.identity.subjectKey)
        );

      if (pendingConsolidationSubjectKeys.size === 0) {
        return subjectGroups;
      }

      return subjectGroups.filter(
        (group) => !pendingConsolidationSubjectKeys.has(group.identity.subjectKey)
      );
    }
  );
  const [stableWorkspace, dailyLimit, newIntroducedTodayCount, subjectGroups] =
    await Promise.all([
      stableWorkspacePromise,
      input.resolvedDailyLimit != null
        ? input.resolvedDailyLimit
        : measureWith(input.profiler, "getReviewDailyLimit", () =>
            getReviewDailyLimit(database)
          ),
      input.resolvedNewIntroducedTodayCount != null
        ? input.resolvedNewIntroducedTodayCount
        : measureWith(
            input.profiler,
            "countReviewSubjectsIntroducedOnDay",
            () =>
              loadReviewIntroducedTodayCountCached(
                database,
                now,
                input.bypassCache
              )
          ),
      subjectGroupsPromise
    ]);
  const cards = filterReviewCardsBySubjectGroups(
    stableWorkspace.cards,
    subjectGroups
  );
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
  resolvedDailyLimit?: number | Promise<number>
): Promise<
  Omit<
    LoadedGlobalReviewPageWorkspace,
    "reviewAutoplayAudioOnReveal" | "reviewFrontFurigana"
  >
> {
  const now = new Date();
  const mediaRows =
    options.resolvedMediaRows ??
    (await measureWith(options.profiler, "listMediaCached", () =>
      listMediaCached(database)
    ));
  const workspace = await measureWith(
    options.profiler,
    "loadReviewWorkspaceV2",
    () =>
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
  const mediaRowsPromise = options.resolvedMediaRows
    ? Promise.resolve(options.resolvedMediaRows)
    : measureWith(options.profiler, "listMediaCached", () =>
        listMediaCached(database)
      );
  const settingsPromise = measureWith(
    options.profiler,
    "getStudySettings",
    () => getStudySettings(database)
  );
  const mediaRows = await mediaRowsPromise;
  const workspacePromise = loadGlobalReviewWorkspace(
    searchState,
    database,
    {
      ...options,
      resolvedMediaRows: mediaRows
    },
    settingsPromise.then((settings) => settings.reviewDailyLimit)
  );
  const [mediaWorkspace, settings] = await Promise.all([
    workspacePromise,
    settingsPromise
  ]);

  return {
    ...mediaWorkspace,
    reviewAutoplayAudioOnReveal: settings.reviewAutoplayAudioOnReveal,
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
  const cacheBucketKey = getLocalIsoTimeBucketKey(nowIso);

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["review-launch-candidates", `bucket:${cacheBucketKey}`],
    loader: () => listReviewLaunchCandidates(database, nowIso),
    tags: [...buildReviewSummaryTags(), REVIEW_FIRST_CANDIDATE_TAG]
  });
}

export async function loadReviewLaunchCandidateByMediaIdCached(
  database: DatabaseClient = db,
  mediaId: string,
  nowIso = new Date().toISOString()
): Promise<ReviewLaunchCandidate | null> {
  const cacheBucketKey = getLocalIsoTimeBucketKey(nowIso);

  return runWithTaggedCache({
    enabled: canUseDataCache(database),
    keyParts: ["review-launch-candidate", mediaId, `bucket:${cacheBucketKey}`],
    loader: () => getReviewLaunchCandidateByMediaId(database, mediaId, nowIso),
    tags: [...buildReviewSummaryTags([mediaId]), REVIEW_FIRST_CANDIDATE_TAG]
  });
}

export async function loadReviewIntroducedTodayCountCached(
  database: DatabaseClient = db,
  asOf: Date = new Date(),
  bypassCache?: boolean
) {
  return runWithTaggedCache({
    enabled: !bypassCache && canUseDataCache(database),
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
  const mediaRows = await listMediaCached(database);
  const snapshots = await loadReviewOverviewSnapshots(
    database,
    mediaRows.map((item) => ({
      id: item.id,
      slug: item.slug
    })),
    {
      globalMediaRows: mediaRows
    }
  );

  return pickBestBy(mediaRows, (left, right) => {
    const leftSnapshot = snapshots.get(left.id);
    const rightSnapshot = snapshots.get(right.id);
    const scoreDifference =
      scoreReviewLaunchCandidate({
        activeReviewCards: leftSnapshot?.activeCards ?? 0,
        cardsTotal: leftSnapshot?.totalCards ?? 0,
        dueCount: leftSnapshot?.dueCount ?? 0
      }) -
      scoreReviewLaunchCandidate({
        activeReviewCards: rightSnapshot?.activeCards ?? 0,
        cardsTotal: rightSnapshot?.totalCards ?? 0,
        dueCount: rightSnapshot?.dueCount ?? 0
      });

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    if ((leftSnapshot?.dueCount ?? 0) !== (rightSnapshot?.dueCount ?? 0)) {
      return (rightSnapshot?.dueCount ?? 0) - (leftSnapshot?.dueCount ?? 0);
    }

    if (
      (leftSnapshot?.activeCards ?? 0) !== (rightSnapshot?.activeCards ?? 0)
    ) {
      return (
        (rightSnapshot?.activeCards ?? 0) - (leftSnapshot?.activeCards ?? 0)
      );
    }

    if ((leftSnapshot?.totalCards ?? 0) !== (rightSnapshot?.totalCards ?? 0)) {
      return (rightSnapshot?.totalCards ?? 0) - (leftSnapshot?.totalCards ?? 0);
    }

    return left.title.localeCompare(right.title, "it");
  });
}

export async function getEligibleReviewCardsByMediaId(
  mediaId: string,
  database: DatabaseClient = db
): Promise<ReviewCardListItem[]> {
  const cards = await listReviewCardsByMediaId(database, mediaId);

  return filterEligibleReviewCards(cards);
}

type ReviewOverviewLoadOptions = {
  asOf?: Date;
  globalMediaRows?: Array<{
    id: string;
    slug: string;
  }>;
  resolvedDailyLimit?: number;
  resolvedNewIntroducedTodayCount?: number;
};

export async function loadReviewOverviewBundle(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>,
  options: ReviewOverviewLoadOptions = {}
) {
  const now = options.asOf ?? new Date();
  const globalMediaRows =
    options.globalMediaRows ?? (await listReviewMediaRefs(database));
  const mediaIds = globalMediaRows.map((item) => item.id);
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds,
    now,
    resolvedDailyLimit: options.resolvedDailyLimit,
    resolvedNewIntroducedTodayCount: options.resolvedNewIntroducedTodayCount
  });
  const shared = buildSharedReviewOverviewInput(workspace);

  return {
    byMedia: buildReviewOverviewSnapshotsFromWorkspace(
      workspace,
      media,
      shared
    ),
    global: buildReviewOverviewSnapshotFromWorkspace(workspace, shared)
  };
}

export async function loadReviewOverviewSnapshots(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>,
  options: ReviewOverviewLoadOptions = {}
) {
  if (media.length === 0) {
    return new Map<string, ReviewOverviewSnapshot>();
  }

  const bundle = await loadReviewOverviewBundle(database, media, options);

  return bundle.byMedia;
}

export async function loadGlobalReviewOverviewSnapshot(
  database: DatabaseClient = db,
  options: {
    asOf?: Date;
    resolvedDailyLimit?: number;
    resolvedNewIntroducedTodayCount?: number;
  } = {}
) {
  const now = options.asOf ?? new Date();
  const bundle = await loadReviewOverviewBundle(database, [], {
    asOf: now,
    resolvedDailyLimit: options.resolvedDailyLimit,
    resolvedNewIntroducedTodayCount: options.resolvedNewIntroducedTodayCount
  });

  return bundle.global;
}

function buildSharedReviewOverviewInput(workspace: LoadedReviewWorkspaceV2) {
  const nowIso = workspace.now.toISOString();
  const subjectModels = buildReviewSubjectModels({
    cards: workspace.cards,
    entryLookup: EMPTY_ENTRY_LOOKUP,
    nowIso,
    subjectGroups: workspace.subjectGroups
  });

  return {
    buckets: bucketAndSortReviewSubjectModels(subjectModels),
    nowIso,
    subjectModels
  };
}

function buildReviewOverviewSnapshotFromWorkspace(
  workspace: LoadedReviewWorkspaceV2,
  shared = buildSharedReviewOverviewInput(workspace)
) {
  const { buckets, nowIso, subjectModels } = shared;

  return buildReviewOverviewSnapshot({
    buckets,
    cards: workspace.cards,
    dailyLimit: workspace.dailyLimit,
    entryLookup: EMPTY_ENTRY_LOOKUP,
    extraNewCount: 0,
    newIntroducedTodayCount: workspace.newIntroducedTodayCount,
    nowIso,
    subjectGroups: workspace.subjectGroups,
    subjectModels
  });
}

function buildReviewOverviewSnapshotsFromWorkspace(
  workspace: LoadedReviewWorkspaceV2,
  media: Array<{
    id: string;
    slug: string;
  }>,
  shared = buildSharedReviewOverviewInput(workspace)
) {
  const { buckets, nowIso, subjectModels } = shared;
  const snapshots = new Map<string, ReviewOverviewSnapshot>();

  for (const item of media) {
    snapshots.set(
      item.id,
      buildReviewOverviewSnapshot({
        buckets,
        cards: workspace.cards,
        dailyLimit: workspace.dailyLimit,
        entryLookup: EMPTY_ENTRY_LOOKUP,
        extraNewCount: 0,
        newIntroducedTodayCount: workspace.newIntroducedTodayCount,
        nowIso,
        subjectGroups: workspace.subjectGroups,
        subjectModels,
        visibleMediaId: item.id
      })
    );
  }

  return snapshots;
}

export function mapReviewOverviewSnapshot(input: {
  dailyLimit: number;
  newIntroducedTodayCount: number;
  overview:
    | GlobalReviewOverviewData
    | (ReviewLaunchCandidate & {
        newAvailableCount: number;
        newQueuedCount?: number;
      })
    | undefined;
}) {
  const { dailyLimit, newIntroducedTodayCount, overview } = input;

  if (!overview) {
    return {
      activeCards: 0,
      dailyLimit,
      dueCount: 0,
      effectiveDailyLimit: dailyLimit,
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: 0,
      queueLabel: buildQueueIntroLabel({
        dailyLimit,
        dueCount: 0,
        manualCount: 0,
        newQueuedCount: 0,
        sessionTopUpNewCount: 0,
        upcomingCount: 0
      }),
      suspendedCount: 0,
      tomorrowCount: 0,
      totalCards: 0,
      upcomingCount: 0
    };
  }

  const remainingNewSlots = Math.max(dailyLimit - newIntroducedTodayCount, 0);
  const newQueuedCount =
    "newQueuedCount" in overview && overview.newQueuedCount != null
      ? overview.newQueuedCount
      : Math.min(overview.newAvailableCount, remainingNewSlots);
  const upcomingCount = Math.max(
    overview.activeReviewCards - overview.dueCount,
    0
  );
  const nextCardFront =
    overview.firstDueFront ??
    (newQueuedCount > 0 ? (overview.firstNewFront ?? null) : null);

  return {
    activeCards: overview.activeReviewCards,
    dailyLimit,
    dueCount: overview.dueCount,
    effectiveDailyLimit: dailyLimit,
    manualCount: overview.manualCount,
    newAvailableCount: overview.newAvailableCount,
    newQueuedCount,
    nextCardFront: nextCardFront
      ? stripInlineMarkdown(nextCardFront)
      : undefined,
    queueCount: overview.dueCount + newQueuedCount,
    queueLabel: buildQueueIntroLabel({
      dailyLimit,
      dueCount: overview.dueCount,
      manualCount: overview.manualCount,
      newQueuedCount,
      sessionTopUpNewCount: 0,
      upcomingCount
    }),
    suspendedCount: overview.suspendedCount,
    tomorrowCount: overview.tomorrowCount,
    totalCards: overview.totalCards,
    upcomingCount
  };
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

function filterEligibleReviewCards(cards: ReviewCardListItem[]) {
  return cards.filter((card) => hasCompletedReviewLesson(card));
}

function filterReviewCardsBySubjectGroups(
  cards: ReviewCardListItem[],
  subjectGroups: ReviewSubjectGroup[]
) {
  const visibleCardIds = new Set(
    subjectGroups.flatMap((group) => group.cards.map((card) => card.id))
  );

  return cards.filter((card) => visibleCardIds.has(card.id));
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
