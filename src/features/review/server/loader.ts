import { db, type DatabaseClient } from "@/db";
import {
  countReviewSubjectsIntroducedOnDay,
  getReviewLaunchCandidateByMediaId,
  listGrammarEntryReviewSummariesByIds,
  listReviewLaunchCandidates,
  listReviewCardsByMediaId,
  listReviewCardsByMediaIds,
  listTermEntryReviewSummariesByIds,
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
} from "@/features/cache/server/data-cache";
import {
  getLocalIsoDateKey,
  getLocalIsoTimeBucketKey
} from "@/features/shared/model/local-date";
import {
  getReviewDailyLimit,
  getStudySettings
} from "@/features/settings/server";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";
import { hasCompletedReviewLesson } from "@/features/review/model/state";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";
import {
  buildEntryLookup,
  collectReviewLinkedEntryIds,
  type ReviewEntryLookupItem,
  type ReviewGrammarLookupEntry,
  type ReviewTermLookupEntry
} from "@/features/review/server/card-presenters";
import type { ReviewSearchState } from "@/features/review/model/search-state";
import {
  filterEligibleReviewCards,
  filterReviewCardsBySubjectGroups,
  resolveReviewWorkspaceSubjectGroups
} from "@/features/review/server/workspace-helpers";

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
    async (stableWorkspace) =>
      resolveReviewWorkspaceSubjectGroups({
        cards: stableWorkspace.cards,
        database,
        grammar: stableWorkspace.grammar,
        now,
        profiler: input.profiler,
        terms: stableWorkspace.terms
      })
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

export async function getEligibleReviewCardsByMediaId(
  mediaId: string,
  database: DatabaseClient = db
): Promise<ReviewCardListItem[]> {
  const cards = await listReviewCardsByMediaId(database, mediaId);

  return filterEligibleReviewCards(cards);
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
