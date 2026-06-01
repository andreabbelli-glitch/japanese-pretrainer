import { db, type DatabaseClient } from "@/db";
import {
  listGrammarReviewSubjectIdentityRowsByIds,
  listReviewCardsByMediaIds,
  listReviewMediaRefs,
  listTermReviewSubjectIdentityRowsByIds,
  type GrammarReviewSubjectIdentityRowById,
  type ReviewCardListItem,
  type TermReviewSubjectIdentityRowById
} from "@/db/queries";
import {
  buildReviewSummaryTags,
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache
} from "@/features/cache/server/data-cache";
import {
  buildReviewOverviewSnapshot,
  buildReviewSubjectModels,
  bucketAndSortReviewSubjectModels
} from "@/features/review/model/queue";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";
import {
  collectReviewLinkedEntryIds,
  type ReviewEntryLookupItem
} from "@/features/review/server/card-presenters";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";
import {
  filterEligibleReviewCards,
  filterReviewCardsBySubjectGroups,
  resolveReviewWorkspaceSubjectGroups
} from "@/features/review/server/workspace-helpers";
import { pickBestBy } from "@/features/shared/model/collections";

import type { ReviewOverviewSnapshot } from "../types";
import { getReviewDailyLimit } from "../../settings/server";
import { loadReviewIntroducedTodayCountCached } from "./loader";

const EMPTY_ENTRY_LOOKUP = new Map<string, ReviewEntryLookupItem>();

export type LoadedReviewOverviewWorkspace = {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  newIntroducedTodayCount: number;
  now: Date;
  rawCardCount: number;
  subjectGroups: ReviewSubjectGroup[];
};

type CachedReviewOverviewWorkspace = {
  cards: ReviewCardListItem[];
  grammar: GrammarReviewSubjectIdentityRowById[];
  rawCardCount: number;
  terms: TermReviewSubjectIdentityRowById[];
};

async function loadReviewSubjectIdentityRowsForCards(input: {
  cards: ReviewCardListItem[];
  database: DatabaseClient;
  profiler?: ReviewProfiler | null;
}) {
  const { grammarIds, termIds } = collectReviewLinkedEntryIds(input.cards);
  const [terms, grammar] = await Promise.all([
    measureWith(input.profiler, "listTermReviewSubjectIdentityRowsByIds", () =>
      listTermReviewSubjectIdentityRowsByIds(input.database, termIds)
    ),
    measureWith(
      input.profiler,
      "listGrammarReviewSubjectIdentityRowsByIds",
      () =>
        listGrammarReviewSubjectIdentityRowsByIds(input.database, grammarIds)
    )
  ]);

  return {
    grammar,
    terms
  };
}

export async function loadStableReviewOverviewWorkspace(input: {
  database: DatabaseClient;
  mediaIds: string[];
  profiler?: ReviewProfiler | null;
}): Promise<CachedReviewOverviewWorkspace> {
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
    "loadReviewSubjectIdentityRowsForCards",
    () =>
      loadReviewSubjectIdentityRowsForCards({
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

export async function loadStableReviewOverviewWorkspaceCached(input: {
  bypassCache?: boolean;
  database: DatabaseClient;
  mediaIds: string[];
  profiler?: ReviewProfiler | null;
}) {
  const orderedMediaIds = [...new Set(input.mediaIds)].sort();
  const cacheEligible = !input.bypassCache && canUseDataCache(input.database);

  return measureWith(
    input.profiler,
    "loadStableReviewOverviewWorkspaceCached",
    () =>
      runWithTaggedCache({
        enabled: cacheEligible,
        keyParts: [
          "review",
          "stable-overview-workspace",
          ...orderedMediaIds.map((mediaId) => `media:${mediaId}`)
        ],
        loader: () =>
          loadStableReviewOverviewWorkspace({
            ...input,
            mediaIds: orderedMediaIds
          }),
        tags: buildReviewSummaryTags(orderedMediaIds)
      }),
    { cacheEligible, mediaIds: orderedMediaIds.length }
  );
}

export async function loadReviewOverviewWorkspace(input: {
  bypassCache?: boolean;
  database?: DatabaseClient;
  mediaIds: string[];
  now?: Date;
  profiler?: ReviewProfiler | null;
  resolvedDailyLimit?: number | Promise<number>;
  resolvedNewIntroducedTodayCount?: number;
}): Promise<LoadedReviewOverviewWorkspace> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const stableWorkspacePromise = measureWith(
    input.profiler,
    "loadStableReviewOverviewWorkspace",
    () =>
      loadStableReviewOverviewWorkspaceCached({
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
      newIntroducedTodayCount,
      now,
      rawCardCount: stableWorkspace.rawCardCount,
      subjectGroups: []
    };
  }

  return {
    cards,
    dailyLimit,
    newIntroducedTodayCount,
    now,
    rawCardCount: stableWorkspace.rawCardCount,
    subjectGroups
  };
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
  const workspace = await loadReviewOverviewWorkspace({
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

function buildSharedReviewOverviewInput(
  workspace: LoadedReviewOverviewWorkspace
) {
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
  workspace: LoadedReviewOverviewWorkspace,
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
  workspace: LoadedReviewOverviewWorkspace,
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
