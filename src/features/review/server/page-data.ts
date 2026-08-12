import { db, type DatabaseClient } from "@/db";
import {
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/features/cache/server/data-cache";
import { getStudySettings } from "@/features/settings/server";
import {
  mediaGlossaryHref,
  mediaHref,
  mediaStudyHref
} from "@/features/navigation";
import type { ReviewCardSource } from "@/features/review/model/card-contract";
import { getLocalIsoTimeBucketKey } from "@/features/shared/model/local-date";
import {
  measureWith,
  type ReviewProfiler
} from "@/features/review/server/profiler";
import { buildServerReviewGradePreviews } from "@/features/review/server/grade-previews";
import {
  getFsrsOptimizerRuntimeContext,
  getFsrsOptimizerRuntimeSnapshot,
  type FsrsOptimizerSnapshot
} from "@/features/fsrs-optimizer/server";
import {
  buildReviewSearchStateCacheKeyParts,
  normalizeReviewSearchState,
  type ReviewSearchState
} from "@/features/review/model/search-state";
import { buildReviewQueueSubjectSnapshot } from "@/features/review/model/queue";
import { REVIEW_QUEUE_ORDERING_VERSION } from "@/features/review/model/queue-ordering";
import {
  buildReviewFirstCandidateSelectedCardContext,
  resolveReviewPageSelection
} from "@/features/review/model/queue-selection";
import type { ReviewSubjectGroup } from "@/features/review/model/subject";
import { loadReviewCardPronunciations } from "@/features/review/server/card-hydration";
import {
  buildReviewMediaLookup,
  type ReviewEntryLookupItem,
  type ReviewMediaLookup
} from "@/features/review/server/card-presenters";
import {
  loadGlobalReviewWorkspace,
  loadGlobalReviewPageWorkspace,
  loadReviewWorkspaceV2,
  type LoadedGlobalReviewPageWorkspace,
  type ReviewPageLoadOptions
} from "@/features/review/server/loader";
import { loadPrestudyReviewPageData } from "@/features/review/server/prestudy-page-data";
import type {
  GlobalReviewFirstCandidateLoadResult,
  GlobalReviewPageLoadResult,
  ReviewFirstCandidatePageData,
  ReviewPageData,
  ReviewQueueSnapshot,
  ReviewScope
} from "@/features/review/types";
import {
  buildReviewAdvanceCardsFromQueueModels,
  buildReviewQueueSnapshot,
  mapReviewQueueSubjectCardPreview,
  mapReviewQueueSubjectModel,
  resolveReviewSubjectSelectionCard
} from "./queue-projection";

export {
  buildReviewQueueSnapshot,
  mapReviewQueueSubjectCardPreview,
  mapReviewQueueSubjectModel
} from "./queue-projection";

type ReviewPageWorkspace = ReviewPageData["media"];
const REVIEW_ADVANCE_WINDOW_SIZE = 3;

function filterReviewSubjectGroupsByCards(
  subjectGroups: ReviewSubjectGroup[],
  cards: ReviewCardSource[]
) {
  const visibleCardIds = new Set(cards.map((card) => card.id));

  return subjectGroups.flatMap((group) => {
    const filteredCards = group.cards.filter((card) =>
      visibleCardIds.has(card.id)
    );

    if (filteredCards.length === 0) {
      return [];
    }

    return [
      {
        ...group,
        cards: filteredCards,
        representativeCard:
          filteredCards.find(
            (card) => card.id === group.representativeCard.id
          ) ?? filteredCards[0]!
      }
    ];
  });
}

function resolveReviewExtraNewAnchorCount(input: {
  extraNewAnchorCount: number | null;
  extraNewCount: number;
  newIntroducedTodayCount: number;
}) {
  if (input.extraNewCount <= 0) {
    return null;
  }

  return input.extraNewAnchorCount ?? input.newIntroducedTodayCount;
}

async function buildReviewSelectionContext(input: {
  cards: ReviewCardSource[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  excludeCardIds?: string[];
  fsrsOptimizerSnapshot: FsrsOptimizerSnapshot;
  newIntroducedTodayCount: number;
  now: Date;
  profiler?: ReviewProfiler | null;
  searchState: ReviewSearchState;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
}) {
  const nowIso = input.now.toISOString();
  const segmentFilteredCards = input.searchState.segmentId
    ? input.cards.filter(
        (card) => card.segmentId === input.searchState.segmentId
      )
    : input.cards;
  const segmentFilteredSubjectGroups =
    segmentFilteredCards === input.cards
      ? input.subjectGroups
      : filterReviewSubjectGroupsByCards(
          input.subjectGroups,
          segmentFilteredCards
        );
  const extraNewAnchorCount = resolveReviewExtraNewAnchorCount({
    extraNewAnchorCount: input.searchState.extraNewAnchorCount,
    extraNewCount: input.searchState.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount
  });
  const queueSnapshot = await measureWith(
    input.profiler,
    "buildReviewQueueSubjectSnapshot",
    () =>
      buildReviewQueueSubjectSnapshot({
        cards: segmentFilteredCards,
        dailyLimit: input.dailyLimit,
        entryLookup: input.entryLookup,
        excludeCardIds: input.excludeCardIds,
        extraNewAnchorCount,
        extraNewCount: input.searchState.extraNewCount,
        newIntroducedTodayCount: input.newIntroducedTodayCount,
        nowIso,
        subjectGroups: segmentFilteredSubjectGroups,
        visibleMediaId: input.visibleMediaId,
        fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot
      }),
    (value) => ({
      dueCount: value.dueCount,
      newQueuedCount: value.newQueuedCount,
      queueCount: value.queueCount,
      subjectModels: value.subjectModels.length
    })
  );
  const selection = resolveReviewPageSelection({
    queueSnapshot,
    searchState: input.searchState
  });
  const queueCardIds = queueSnapshot.queueModels.map((model) => model.card.id);
  const selectedRawCard = selection.selectedModel
    ? resolveReviewSubjectSelectionCard({
        selectedCardId: selection.selectedCardId,
        subjectModel: selection.selectedModel
      })
    : null;
  const hasSelectedCard =
    selection.selectedModel !== null && selectedRawCard !== null;
  const advanceCardModels =
    selection.queueIndex >= 0
      ? queueSnapshot.queueModels.slice(
          selection.queueIndex + 1,
          selection.queueIndex + 1 + REVIEW_ADVANCE_WINDOW_SIZE
        )
      : [];
  return {
    advanceCardModels,
    extraNewAnchorCount,
    hasSelectedCard,
    nowIso,
    queueCardIds,
    queueSnapshot,
    selectedRawCard,
    selection
  };
}

export async function buildReviewPageDataFromWorkspace(input: {
  cards: ReviewCardSource[];
  dailyLimit: number;
  database: DatabaseClient;
  excludeCardIds?: string[];
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot: FsrsOptimizerSnapshot;
  media: ReviewPageWorkspace;
  mediaById: ReviewMediaLookup;
  newIntroducedTodayCount: number;
  now: Date;
  reviewAutoplayAudioOnReveal: boolean;
  reviewFrontFurigana: boolean;
  scope: ReviewScope;
  searchState: ReviewSearchState;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
  profiler?: ReviewProfiler | null;
}) {
  const {
    advanceCardModels,
    extraNewAnchorCount,
    hasSelectedCard,
    nowIso,
    queueCardIds,
    queueSnapshot,
    selectedRawCard,
    selection
  } = await buildReviewSelectionContext({
    cards: input.cards,
    dailyLimit: input.dailyLimit,
    entryLookup: input.entryLookup,
    excludeCardIds: input.excludeCardIds,
    fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
    newIntroducedTodayCount: input.newIntroducedTodayCount,
    now: input.now,
    profiler: input.profiler,
    searchState: input.searchState,
    subjectGroups: input.subjectGroups,
    visibleMediaId: input.visibleMediaId
  });
  const selectedCardPronunciationsPromise = selectedRawCard
    ? measureWith(
        input.profiler,
        "loadReviewCardPronunciations.selected",
        () =>
          loadReviewCardPronunciations({
            card: selectedRawCard,
            database: input.database,
            entryLookup: input.entryLookup
          }),
        (value) => ({
          pronunciations: value.length
        })
      )
    : Promise.resolve([]);
  const selectedCardPronunciations = await selectedCardPronunciationsPromise;
  const selectedCardBase = hasSelectedCard
    ? mapReviewQueueSubjectModel(selection.selectedModel!, {
        contextCache: new Map(),
        entryLookup: input.entryLookup,
        fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
        includePronunciations: false,
        mediaById: input.mediaById,
        nowIso,
        selectedCardId: selection.selectedCardId,
        visibleMediaId: input.visibleMediaId
      })
    : null;
  const advanceCards =
    advanceCardModels.length > 0
      ? buildReviewAdvanceCardsFromQueueModels({
          advanceCardModels,
          entryLookup: input.entryLookup,
          fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
          mediaById: input.mediaById,
          nowIso,
          selectedCardId: selection.selectedCardId,
          visibleMediaId: input.visibleMediaId
        })
      : [];
  const selectedCard =
    selectedCardBase && selectedRawCard
      ? {
          ...selectedCardBase,
          pronunciations: selectedCardPronunciations
        }
      : selectedCardBase;
  const selectedGradePreviews = selectedCard
    ? await buildServerReviewGradePreviews({
        database: input.database,
        excludeSubjectKey:
          selection.selectedModel?.group.identity.subjectKey ?? null,
        now: input.now,
        recallTask: selection.selectedModel?.group.identity.recallTask ?? null,
        reviewSeedState: selectedCard.reviewSeedState
      })
    : [];
  input.profiler?.addMeta({
    selectedCardId: selectedCard?.id ?? null
  });

  return {
    scope: input.scope,
    media: input.media,
    settings: {
      reviewAutoplayAudioOnReveal: input.reviewAutoplayAudioOnReveal,
      reviewFrontFurigana: input.reviewFrontFurigana
    },
    queue: {
      advanceCards,
      cards: [],
      dailyLimit: queueSnapshot.dailyLimit,
      dueCount: queueSnapshot.dueCount,
      effectiveDailyLimit: queueSnapshot.effectiveDailyLimit,
      introLabel: queueSnapshot.introLabel,
      manualCards: [],
      manualCount: queueSnapshot.manualCount,
      newAvailableCount: queueSnapshot.newAvailableCount,
      newQueuedCount: queueSnapshot.newQueuedCount,
      nextDueAt: queueSnapshot.nextDueAt ?? null,
      nextLearningDueAt: queueSnapshot.nextLearningDueAt ?? null,
      queueCount: queueSnapshot.queueCount,
      queueLabel: queueSnapshot.introLabel,
      suspendedCards: [],
      suspendedCount: queueSnapshot.suspendedCount,
      tomorrowCount: queueSnapshot.tomorrowCount,
      upcomingCards: [],
      upcomingCount: queueSnapshot.upcomingCount
    },
    selectedCard,
    queueCardIds,
    selectedCardContext: {
      bucket: selectedCard?.bucket ?? null,
      gradePreviews: selectedGradePreviews,
      isQueueCard: selection.queueIndex >= 0,
      position: selection.queueIndex >= 0 ? selection.queueIndex + 1 : null,
      remainingCount:
        selection.queueIndex >= 0
          ? queueSnapshot.queueCount - selection.queueIndex - 1
          : 0,
      reviewStateUpdatedAt:
        selection.selectedModel?.group.subjectState?.updatedAt ?? null,
      showAnswer: input.searchState.showAnswer || selection.queueIndex < 0
    },
    session: {
      answeredCount: input.searchState.answeredCount,
      extraNewAnchorCount,
      extraNewCount: input.searchState.extraNewCount,
      notice: resolveReviewNotice(input.searchState.noticeCode),
      segmentId: input.searchState.segmentId
    }
  } satisfies ReviewPageData;
}

export async function getReviewPageData(
  mediaSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<ReviewPageData | null> {
  const now = new Date();
  const searchState = normalizeReviewSearchState(searchParams);
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
  const media =
    options.resolvedMedia ??
    mediaRows.find((candidate) => candidate.slug === mediaSlug) ??
    null;

  if (!media) {
    return null;
  }

  if (searchState.mode === "prestudy") {
    const settings = await settingsPromise;

    return loadPrestudyReviewPageData({
      database,
      media,
      mediaRows,
      now,
      profiler: options.profiler,
      settings,
      searchState
    });
  }

  const [settings, workspace, fsrsOptimizerSnapshot] = await Promise.all([
    settingsPromise,
    measureWith(options.profiler, "loadGlobalReviewWorkspace", () =>
      loadGlobalReviewWorkspace(
        searchState,
        database,
        {
          ...options,
          resolvedMediaRows: mediaRows
        },
        settingsPromise.then((settings) => settings.reviewDailyLimit)
      )
    ),
    getFsrsOptimizerRuntimeSnapshot(database)
  ]);

  return measureWith(options.profiler, "buildReviewPageDataFromWorkspace", () =>
    buildReviewPageDataFromWorkspace({
      cards: workspace.cards,
      dailyLimit: workspace.dailyLimit,
      database,
      entryLookup: workspace.entryLookup,
      excludeCardIds: options.excludeCardIds,
      fsrsOptimizerSnapshot,
      media: {
        glossaryHref: mediaGlossaryHref(media.slug),
        href: mediaHref(media.slug),
        id: media.id,
        reviewHref: mediaStudyHref(media.slug, "review"),
        slug: media.slug,
        title: media.title
      },
      mediaById: buildReviewMediaLookup(workspace.mediaRows),
      newIntroducedTodayCount: workspace.newIntroducedTodayCount,
      now,
      profiler: options.profiler,
      reviewAutoplayAudioOnReveal: settings.reviewAutoplayAudioOnReveal,
      reviewFrontFurigana: settings.reviewFrontFurigana,
      scope: "media",
      searchState,
      subjectGroups: workspace.subjectGroups,
      visibleMediaId: media.id
    })
  );
}

export async function loadReviewPageDataSession(
  input: {
    bypassCache?: boolean;
    mediaSlug?: string;
    scope: ReviewScope;
    searchParams: Record<string, string | string[] | undefined>;
  },
  database: DatabaseClient = db
): Promise<ReviewPageData> {
  if (input.scope === "global") {
    return getGlobalReviewPageData(input.searchParams, database, {
      bypassCache: input.bypassCache ?? false
    });
  }

  if (!input.mediaSlug) {
    throw new Error("Media review scope requires a media slug.");
  }

  const data = await getReviewPageData(
    input.mediaSlug,
    input.searchParams,
    database,
    {
      bypassCache: input.bypassCache ?? false
    }
  );

  if (!data) {
    throw new Error(
      `Unable to load review page data for media: ${input.mediaSlug}`
    );
  }

  return data;
}

export async function buildGlobalReviewPageData(
  input: LoadedGlobalReviewPageWorkspace,
  fsrsOptimizerSnapshot: FsrsOptimizerSnapshot,
  database: DatabaseClient = db,
  profiler?: ReviewProfiler | null,
  excludeCardIds?: string[]
) {
  return measureWith(profiler, "buildReviewPageDataFromWorkspace", () =>
    buildReviewPageDataFromWorkspace({
      cards: input.cards,
      dailyLimit: input.dailyLimit,
      database,
      entryLookup: input.entryLookup,
      excludeCardIds,
      fsrsOptimizerSnapshot,
      media: {
        glossaryHref: "/glossary",
        href: "/",
        reviewHref: "/review",
        slug: "global-review",
        title: "Review globale"
      },
      mediaById: buildReviewMediaLookup(input.mediaRows),
      newIntroducedTodayCount: input.newIntroducedTodayCount,
      now: input.now,
      profiler,
      reviewAutoplayAudioOnReveal: input.reviewAutoplayAudioOnReveal,
      reviewFrontFurigana: input.reviewFrontFurigana,
      scope: "global",
      searchState: input.searchState,
      subjectGroups: input.subjectGroups
    })
  );
}

export async function getGlobalReviewPageLoadResult(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<GlobalReviewPageLoadResult> {
  const searchState = normalizeReviewSearchState(searchParams);
  const [workspace, fsrsOptimizerSnapshot] = await Promise.all([
    loadGlobalReviewPageWorkspace(searchState, database, options),
    getFsrsOptimizerRuntimeSnapshot(database)
  ]);

  if (workspace.mediaRows.length === 0) {
    return {
      kind: "empty-media"
    };
  }

  if (workspace.rawCardCount === 0) {
    return {
      kind: "empty-cards"
    };
  }

  return {
    kind: "ready",
    data: await buildGlobalReviewPageData(
      workspace,
      fsrsOptimizerSnapshot,
      database,
      options.profiler,
      options.excludeCardIds
    )
  };
}

export async function buildReviewFirstCandidateDataFromWorkspace(input: {
  cards: ReviewCardSource[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot: FsrsOptimizerSnapshot;
  media: ReviewPageWorkspace;
  mediaById: ReviewMediaLookup;
  newIntroducedTodayCount: number;
  now: Date;
  reviewAutoplayAudioOnReveal: boolean;
  reviewFrontFurigana: boolean;
  scope: ReviewScope;
  searchState: ReviewSearchState;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewFirstCandidatePageData> {
  const {
    advanceCardModels,
    extraNewAnchorCount,
    nowIso,
    queueCardIds,
    queueSnapshot,
    selectedRawCard,
    selection
  } = await buildReviewSelectionContext({
    cards: input.cards,
    dailyLimit: input.dailyLimit,
    entryLookup: input.entryLookup,
    fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
    newIntroducedTodayCount: input.newIntroducedTodayCount,
    now: input.now,
    profiler: input.profiler,
    searchState: input.searchState,
    subjectGroups: input.subjectGroups,
    visibleMediaId: input.visibleMediaId
  });
  const selectedCard =
    selection.selectedModel && selectedRawCard
      ? mapReviewQueueSubjectCardPreview({
          card: selectedRawCard,
          entryLookup: input.entryLookup,
          fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
          mediaById: input.mediaById,
          nowIso,
          queueStateSnapshot: selection.selectedModel.queueStateSnapshot,
          schedulingKey: selection.selectedModel.group.identity.subjectKey
        })
      : null;
  const selectedCardContext = buildReviewFirstCandidateSelectedCardContext({
    bucket: selectedCard?.bucket ?? null,
    queueIndex: selection.queueIndex,
    queueSnapshot,
    searchState: input.searchState
  });
  const advanceCards =
    advanceCardModels.length > 0
      ? buildReviewAdvanceCardsFromQueueModels({
          advanceCardModels,
          entryLookup: input.entryLookup,
          fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
          mediaById: input.mediaById,
          nowIso,
          selectedCardId: selection.selectedCardId,
          visibleMediaId: input.visibleMediaId
        })
      : [];
  const nextCardId =
    selectedCardContext.isQueueCard && selection.queueIndex >= 0
      ? (queueSnapshot.queueModels[selection.queueIndex + 1]?.card.id ?? null)
      : undefined;

  input.profiler?.addMeta({
    selectedCardId: selectedCard?.id ?? null
  });

  return {
    media: input.media,
    nextCardId,
    queueCardIds,
    queue: {
      advanceCards,
      dailyLimit: queueSnapshot.dailyLimit,
      dueCount: queueSnapshot.dueCount,
      effectiveDailyLimit: queueSnapshot.effectiveDailyLimit,
      introLabel: queueSnapshot.introLabel,
      manualCount: queueSnapshot.manualCount,
      newAvailableCount: queueSnapshot.newAvailableCount,
      newQueuedCount: queueSnapshot.newQueuedCount,
      nextDueAt: queueSnapshot.nextDueAt ?? null,
      nextLearningDueAt: queueSnapshot.nextLearningDueAt ?? null,
      queueCount: queueSnapshot.queueCount,
      queueLabel: queueSnapshot.introLabel,
      suspendedCount: queueSnapshot.suspendedCount,
      tomorrowCount: queueSnapshot.tomorrowCount,
      upcomingCount: queueSnapshot.upcomingCount
    },
    requestedCardResolution: {
      requestedCardId: input.searchState.selectedCardId,
      resolved:
        input.searchState.selectedCardId === null ||
        selection.selectedCardId === input.searchState.selectedCardId
    },
    scope: input.scope,
    selectedCard,
    selectedCardContext: {
      ...selectedCardContext,
      reviewStateUpdatedAt:
        selection.selectedModel?.group.subjectState?.updatedAt ?? null
    },
    settings: {
      reviewAutoplayAudioOnReveal: input.reviewAutoplayAudioOnReveal,
      reviewFrontFurigana: input.reviewFrontFurigana
    },
    session: {
      answeredCount: input.searchState.answeredCount,
      extraNewAnchorCount,
      extraNewCount: input.searchState.extraNewCount,
      notice: resolveReviewNotice(input.searchState.noticeCode),
      segmentId: input.searchState.segmentId
    }
  };
}

export async function getGlobalReviewFirstCandidateLoadResult(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<GlobalReviewFirstCandidateLoadResult> {
  const cacheEligible = !options.bypassCache && canUseDataCache(database);
  const searchState = normalizeReviewSearchState(searchParams);
  const studySettingsPromise = getStudySettings(database);
  const fsrsRuntimeContextPromise = getFsrsOptimizerRuntimeContext(database);
  const fsrsRuntimeContext = cacheEligible
    ? await fsrsRuntimeContextPromise
    : null;
  const fsrsCacheKeyPart = fsrsRuntimeContext?.cacheKeyPart ?? "fsrs:none";
  const cacheBucketKey = getLocalIsoTimeBucketKey(new Date());
  const cacheKeyParts = [
    "review",
    "global-first-candidate",
    `ordering:${REVIEW_QUEUE_ORDERING_VERSION}`,
    `bucket:${cacheBucketKey}`,
    `fsrs:${fsrsCacheKeyPart}`,
    ...buildReviewSearchStateCacheKeyParts(searchState)
  ];

  const loadSnapshot = async () => {
    const [workspace, runtimeContext] = await Promise.all([
      loadGlobalReviewPageWorkspace(searchState, database, {
        ...options,
        resolvedStudySettings: studySettingsPromise
      }),
      fsrsRuntimeContext
        ? Promise.resolve(fsrsRuntimeContext)
        : fsrsRuntimeContextPromise
    ]);

    if (workspace.mediaRows.length === 0) {
      return {
        kind: "empty-media" as const
      };
    }

    if (workspace.rawCardCount === 0) {
      return {
        kind: "empty-cards" as const
      };
    }

    return {
      kind: "ready" as const,
      data: await buildReviewFirstCandidateDataFromWorkspace({
        cards: workspace.cards,
        dailyLimit: workspace.dailyLimit,
        entryLookup: workspace.entryLookup,
        fsrsOptimizerSnapshot: runtimeContext.snapshot,
        media: {
          glossaryHref: "/glossary",
          href: "/",
          reviewHref: "/review",
          slug: "global-review",
          title: "Review globale"
        },
        mediaById: buildReviewMediaLookup(workspace.mediaRows),
        newIntroducedTodayCount: workspace.newIntroducedTodayCount,
        now: workspace.now,
        profiler: options.profiler,
        reviewAutoplayAudioOnReveal: workspace.reviewAutoplayAudioOnReveal,
        reviewFrontFurigana: workspace.reviewFrontFurigana,
        scope: "global",
        searchState: workspace.searchState,
        subjectGroups: workspace.subjectGroups
      })
    };
  };

  const loadWithCache = () =>
    runWithTaggedCache({
      enabled: cacheEligible,
      keyParts: cacheKeyParts,
      loader: loadSnapshot,
      tags: [REVIEW_FIRST_CANDIDATE_TAG]
    });

  return measureWith(
    options.profiler,
    "getGlobalReviewFirstCandidateLoadResult",
    loadWithCache,
    { cacheEligible, searchState: cacheKeyParts.join("|") }
  );
}

export async function getGlobalReviewPageData(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<ReviewPageData> {
  const searchState = normalizeReviewSearchState(searchParams);
  const [workspace, fsrsOptimizerSnapshot] = await Promise.all([
    loadGlobalReviewPageWorkspace(searchState, database, options),
    getFsrsOptimizerRuntimeSnapshot(database)
  ]);

  return buildGlobalReviewPageData(
    workspace,
    fsrsOptimizerSnapshot,
    database,
    options.profiler,
    options.excludeCardIds
  );
}

export async function getReviewQueueSnapshotForMedia(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<ReviewQueueSnapshot | null> {
  const now = new Date();
  const [fsrsOptimizerSnapshot, mediaRows] = await Promise.all([
    getFsrsOptimizerRuntimeSnapshot(database),
    listMediaCached(database)
  ]);
  const media =
    mediaRows.find((candidate) => candidate.slug === mediaSlug) ?? null;

  if (!media) {
    return null;
  }

  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds: mediaRows.map((item) => item.id),
    now
  });
  const snapshot = buildReviewQueueSnapshot({
    cards: workspace.cards,
    dailyLimit: workspace.dailyLimit,
    entryLookup: workspace.entryLookup,
    extraNewCount: 0,
    fsrsOptimizerSnapshot,
    mediaById: buildReviewMediaLookup(mediaRows),
    newIntroducedTodayCount: workspace.newIntroducedTodayCount,
    nowIso: workspace.now.toISOString(),
    subjectGroups: workspace.subjectGroups,
    visibleMediaId: media.id
  });

  return {
    advanceCards: snapshot.advanceCards,
    cards: snapshot.cards,
    dailyLimit: snapshot.dailyLimit,
    dueCount: snapshot.dueCount,
    effectiveDailyLimit: snapshot.effectiveDailyLimit,
    manualCount: snapshot.manualCount,
    newAvailableCount: snapshot.newAvailableCount,
    newQueuedCount: snapshot.newQueuedCount,
    nextDueAt: snapshot.nextDueAt ?? null,
    nextLearningDueAt: snapshot.nextLearningDueAt ?? null,
    queueLabel: snapshot.introLabel,
    queueCount: snapshot.queueCount,
    suspendedCount: snapshot.suspendedCount,
    tomorrowCount: snapshot.tomorrowCount,
    upcomingCount: snapshot.upcomingCount
  };
}

function resolveReviewNotice(value: string | null) {
  const notices: Record<string, string> = {
    known: "Le voci principali della card sono state segnate come già note.",
    learning: "Le voci principali della card sono tornate in studio.",
    reset:
      "La card è stata riportata allo stato iniziale senza perdere lo storico.",
    resumed: "La card è tornata attiva nella Review.",
    suspended: "La card è stata messa in pausa e rimossa dalla coda di oggi."
  };

  if (!value) {
    return undefined;
  }

  return notices[value];
}
