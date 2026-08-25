import { db, type DatabaseClient } from "@/db";
import {
  listEligibleReviewQueueSkeletonRowsByMediaIds,
  listReviewSubjectStatesByKeys,
  type MediaListItem
} from "@/db/queries";
import {
  canUseDataCache,
  listMediaCached,
  REVIEW_CARD_CONTENT_TAG,
  runWithTaggedCache
} from "@/features/cache/server/data-cache";
import { getPendingConsolidationSubjectKeySet } from "@/features/consolidation/server";
import type { ReviewCardSource } from "@/features/review/model/card-contract";
import {
  groupReviewCardsBySubject,
  type ReviewSubjectIdentity,
  type ReviewSubjectGroup
} from "@/features/review/model/subject";
import type { ReviewSearchState } from "@/features/review/model/search-state";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";
import { loadReviewIntroducedTodayCountCached } from "@/features/review/server/workspace-core";
import {
  getReviewDailyLimit,
  getStudySettings,
  type StudySettings
} from "@/features/settings/server";

import type { ReviewPageLoadOptions } from "./loader";

type QueueSkeletonQueryResult = Awaited<
  ReturnType<typeof listEligibleReviewQueueSkeletonRowsByMediaIds>
>;
type QueueSkeletonRow = QueueSkeletonQueryResult["rows"][number];

export type LoadedReviewQueueWorkspace = {
  cards: ReviewCardSource[];
  dailyLimit: number;
  hasRawCards: boolean;
  newIntroducedTodayCount: number;
  now: Date;
  subjectGroups: ReviewSubjectGroup[];
};

export type LoadedGlobalReviewQueuePageWorkspace =
  LoadedReviewQueueWorkspace & {
    mediaRows: MediaListItem[];
    reviewAutoplayAudioOnReveal: boolean;
    reviewFrontFurigana: boolean;
    searchState: ReviewSearchState;
  };

const EMPTY_SUBJECT_ENTRY_LOOKUP = new Map();

export async function loadStableReviewQueueSkeletonCached(input: {
  bypassStableCache?: boolean;
  database: DatabaseClient;
  mediaIds: string[];
  profiler?: ReviewProfiler | null;
}) {
  const orderedMediaIds = [...new Set(input.mediaIds)].sort();
  const cacheEligible =
    !input.bypassStableCache && canUseDataCache(input.database);

  return measureWith(
    input.profiler,
    "loadStableReviewQueueSkeletonCached",
    () =>
      runWithTaggedCache({
        enabled: cacheEligible,
        keyParts: [
          "review",
          "queue-skeleton-v1",
          ...orderedMediaIds.map((mediaId) => `media:${mediaId}`)
        ],
        loader: () =>
          listEligibleReviewQueueSkeletonRowsByMediaIds(
            input.database,
            orderedMediaIds
          ),
        tags: [REVIEW_CARD_CONTENT_TAG]
      }),
    { cacheEligible, mediaIds: orderedMediaIds.length }
  );
}

export async function loadReviewQueueWorkspace(input: {
  bypassCache?: boolean;
  bypassStableCache?: boolean;
  database?: DatabaseClient;
  mediaIds: string[];
  now?: Date;
  profiler?: ReviewProfiler | null;
  resolvedDailyLimit?: number | Promise<number>;
  resolvedNewIntroducedTodayCount?: number;
}): Promise<LoadedReviewQueueWorkspace> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const stableSkeletonPromise = loadStableReviewQueueSkeletonCached({
    bypassStableCache: input.bypassStableCache,
    database,
    mediaIds: input.mediaIds,
    profiler: input.profiler
  });
  const dailyLimitPromise =
    input.resolvedDailyLimit != null
      ? Promise.resolve(input.resolvedDailyLimit)
      : measureWith(input.profiler, "getReviewDailyLimit", () =>
          getReviewDailyLimit(database)
        );
  const introducedTodayPromise =
    input.resolvedNewIntroducedTodayCount != null
      ? Promise.resolve(input.resolvedNewIntroducedTodayCount)
      : measureWith(input.profiler, "countReviewSubjectsIntroducedOnDay", () =>
          loadReviewIntroducedTodayCountCached(database, now, input.bypassCache)
        );
  const stableSkeleton = await stableSkeletonPromise;
  const skeletonCards = stableSkeleton.rows.map(mapQueueSkeletonCard);
  const identitiesByCardId = new Map(
    stableSkeleton.rows.map((row) => [row.id, mapQueueSkeletonIdentity(row)])
  );
  const subjectKeys = [
    ...new Set(stableSkeleton.rows.map((row) => row.memoryKey))
  ];
  const [dailyLimit, newIntroducedTodayCount, subjectStates, pendingKeys] =
    await Promise.all([
      dailyLimitPromise,
      introducedTodayPromise,
      measureWith(input.profiler, "listReviewSubjectStatesByKeys", () =>
        listReviewSubjectStatesByKeys(database, subjectKeys)
      ),
      measureWith(input.profiler, "getPendingConsolidationSubjectKeySet", () =>
        getPendingConsolidationSubjectKeySet(database, subjectKeys)
      )
    ]);
  const allSubjectGroups = groupReviewCardsBySubject({
    cards: skeletonCards,
    entryLookup: EMPTY_SUBJECT_ENTRY_LOOKUP,
    nowIso: now.toISOString(),
    precomputedIdentities: identitiesByCardId,
    subjectStates
  });
  const subjectGroups =
    pendingKeys.size === 0
      ? allSubjectGroups
      : allSubjectGroups.filter(
          (group) => !pendingKeys.has(group.identity.subjectKey)
        );
  const visibleCardIds = new Set(
    subjectGroups.flatMap((group) => group.cards.map((card) => card.id))
  );
  const cards =
    visibleCardIds.size === skeletonCards.length
      ? skeletonCards
      : skeletonCards.filter((card) => visibleCardIds.has(card.id));

  input.profiler?.addMeta({
    cards: cards.length,
    mediaIds: input.mediaIds.length,
    queueSkeletonRows: stableSkeleton.rows.length,
    subjectGroups: subjectGroups.length
  });

  return {
    cards,
    dailyLimit,
    hasRawCards: stableSkeleton.hasRawCards,
    newIntroducedTodayCount,
    now,
    subjectGroups
  };
}

export async function loadGlobalReviewQueuePageWorkspace(
  searchState: ReviewSearchState,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<LoadedGlobalReviewQueuePageWorkspace> {
  const mediaRowsPromise = options.resolvedMediaRows
    ? Promise.resolve(options.resolvedMediaRows)
    : measureWith(options.profiler, "listMediaCached", () =>
        listMediaCached(database)
      );
  const settingsPromise: Promise<StudySettings> = options.resolvedStudySettings
    ? Promise.resolve(options.resolvedStudySettings)
    : measureWith(options.profiler, "getStudySettings", () =>
        getStudySettings(database)
      );
  const mediaRows = await mediaRowsPromise;
  const workspacePromise = loadReviewQueueWorkspace({
    bypassCache: options.bypassCache,
    bypassStableCache: options.bypassStableCache,
    database,
    mediaIds: mediaRows.map((item) => item.id),
    profiler: options.profiler,
    resolvedDailyLimit: settingsPromise.then(
      (settings) => settings.reviewDailyLimit
    )
  });
  const [workspace, settings] = await Promise.all([
    workspacePromise,
    settingsPromise
  ]);

  return {
    ...workspace,
    mediaRows,
    reviewAutoplayAudioOnReveal: settings.reviewAutoplayAudioOnReveal,
    reviewFrontFurigana: settings.reviewFrontFurigana,
    searchState
  };
}

function mapQueueSkeletonCard(row: QueueSkeletonRow): ReviewCardSource {
  return {
    back: "",
    cardType: row.cardType,
    createdAt: row.createdAt,
    entryLinks: [],
    exampleIt: null,
    exampleJp: null,
    front: "",
    id: row.id,
    lesson: {
      progress: {
        status: "completed"
      },
      status: "active"
    },
    lessonId: row.lessonId,
    mediaId: row.mediaId,
    notesIt: null,
    orderIndex: row.orderIndex,
    segmentId: row.segmentId,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

function mapQueueSkeletonIdentity(
  row: QueueSkeletonRow
): ReviewSubjectIdentity {
  return {
    cardId: row.id,
    canonicalSubjectKey: row.canonicalSubjectKey,
    crossMediaGroupId: row.crossMediaGroupId,
    entryId: row.entryId,
    entryType: row.entryType,
    memoryKey: row.memoryKey,
    recallTask: row.recallTask,
    subjectKey: row.memoryKey,
    subjectKind: resolveSubjectKind(row.canonicalSubjectKey)
  };
}

function resolveSubjectKind(
  canonicalSubjectKey: string
): ReviewSubjectIdentity["subjectKind"] {
  if (canonicalSubjectKey.startsWith("group:")) {
    return "group";
  }

  if (canonicalSubjectKey.startsWith("entry:")) {
    return "entry";
  }

  return "card";
}
