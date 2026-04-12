import { db, type DatabaseClient, type ReviewCardListItem } from "@/db";
import {
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import { getStudySettings } from "@/lib/settings";
import {
  mediaGlossaryHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref
} from "@/lib/site";
import { capitalizeToken, formatReviewStateLabel } from "@/lib/study-format";
import { getLocalIsoDateKey } from "@/lib/local-date";
import { measureWith, type ReviewProfiler } from "@/lib/review-profiler";
import { buildReviewGradePreviews as buildSharedReviewGradePreviews } from "./review-grade-previews";
import {
  buildReviewSeedStateWithFsrsPreset,
  getFsrsOptimizerRuntimeContext,
  getFsrsOptimizerSnapshot,
  type FsrsOptimizerSnapshot
} from "./fsrs-optimizer";
import {
  buildReviewSearchStateCacheKeyParts,
  normalizeReviewSearchState,
  type ReviewSearchState
} from "./review-search-state";
import {
  buildBucketDetail,
  buildReviewQueueSubjectSnapshot,
  buildReviewFirstCandidateSelectedCardContext,
  formatBucketLabel,
  formatShortIsoDate,
  resolveReviewPageSelection,
  type ReviewQueueStateSnapshot,
  type ReviewSubjectModel
} from "./review-queue";
import type { ReviewSubjectGroup } from "./review-subject";
import {
  buildReviewMediaLookup,
  loadReviewCardPronunciations,
  mapQueueCard,
  resolveReviewCardMedia,
  resolveReviewCardReading,
  type ReviewEntryLookupItem,
  type ReviewMediaLookup
} from "./review-card-hydration";
import {
  loadGlobalReviewWorkspace,
  loadGlobalReviewPageWorkspace,
  loadReviewWorkspaceV2,
  type LoadedGlobalReviewPageWorkspace,
  type ReviewPageLoadOptions
} from "./review-loader";
import type {
  GlobalReviewFirstCandidateLoadResult,
  GlobalReviewPageLoadResult,
  ReviewFirstCandidateCard,
  ReviewFirstCandidatePageData,
  ReviewPageData,
  ReviewQueueCard,
  ReviewQueueSnapshot,
  ReviewScope
} from "./review-types";
import { stripInlineMarkdown } from "@/lib/render-furigana";

type ReviewPageWorkspace = ReviewPageData["media"];

type ReviewQueueCardMapInput = {
  contextCache?: Map<string, ReviewQueueCard["contexts"]>;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot: FsrsOptimizerSnapshot;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  selectedCardId?: string | null;
  visibleMediaId?: string;
};

function filterReviewSubjectGroupsByCards(
  subjectGroups: ReviewSubjectGroup[],
  cards: ReviewCardListItem[]
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

export async function buildReviewPageDataFromWorkspace(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  database: DatabaseClient;
  excludeCardIds?: string[];
  entryLookup: Map<string, ReviewEntryLookupItem>;
  media: ReviewPageWorkspace;
  mediaById: ReviewMediaLookup;
  newIntroducedTodayCount: number;
  now: Date;
  reviewFrontFurigana: boolean;
  scope: ReviewScope;
  searchState: ReviewSearchState;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
  profiler?: ReviewProfiler | null;
}) {
  const nowIso = input.now.toISOString();
  const fsrsOptimizerSnapshot = await getFsrsOptimizerSnapshot(input.database);
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
  const queueSnapshot = await measureWith(
    input.profiler,
    "buildReviewQueueSubjectSnapshot",
    () =>
      buildReviewQueueSubjectSnapshot({
        cards: segmentFilteredCards,
        dailyLimit: input.dailyLimit,
        entryLookup: input.entryLookup,
        excludeCardIds: input.excludeCardIds,
        extraNewCount: input.searchState.extraNewCount,
        newIntroducedTodayCount: input.newIntroducedTodayCount,
        nowIso,
        subjectGroups: segmentFilteredSubjectGroups,
        visibleMediaId: input.visibleMediaId
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
  const queueCardMapInput: ReviewQueueCardMapInput = {
    contextCache: new Map(),
    entryLookup: input.entryLookup,
    fsrsOptimizerSnapshot,
    mediaById: input.mediaById,
    nowIso,
    visibleMediaId: input.visibleMediaId
  };
  const queueCardIds = queueSnapshot.queueModels.map((model) => model.card.id);
  const selectedCardBase = selection.selectedModel
    ? mapReviewQueueSubjectModel(selection.selectedModel, {
        ...queueCardMapInput,
        selectedCardId: selection.selectedCardId
      })
    : null;
  const selectedRawCard = selection.selectedModel
    ? resolveReviewSubjectSelectionCard({
        selectedCardId: selection.selectedCardId,
        subjectModel: selection.selectedModel
      })
    : null;
  const selectedCard =
    selectedCardBase && selectedRawCard
      ? {
          ...selectedCardBase,
          pronunciations: await measureWith(
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
        }
      : selectedCardBase;
  const selectedGradePreviews = selectedCard
    ? buildSharedReviewGradePreviews(selectedCard.reviewSeedState, input.now)
    : [];
  input.profiler?.addMeta({
    selectedCardId: selectedCard?.id ?? null
  });

  return {
    scope: input.scope,
    media: input.media,
    settings: {
      reviewFrontFurigana: input.reviewFrontFurigana
    },
    queue: {
      cards: [],
      dailyLimit: queueSnapshot.dailyLimit,
      dueCount: queueSnapshot.dueCount,
      effectiveDailyLimit: queueSnapshot.effectiveDailyLimit,
      introLabel: queueSnapshot.introLabel,
      manualCards: [],
      manualCount: queueSnapshot.manualCount,
      newAvailableCount: queueSnapshot.newAvailableCount,
      newQueuedCount: queueSnapshot.newQueuedCount,
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
      showAnswer: input.searchState.showAnswer || selection.queueIndex < 0
    },
    session: {
      answeredCount: input.searchState.answeredCount,
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
  const mediaRowsPromise = options.resolvedMediaRows
    ? Promise.resolve(options.resolvedMediaRows)
    : measureWith(options.profiler, "listMediaCached", () =>
        listMediaCached(database)
      );
  const mediaRows = await mediaRowsPromise;
  const media =
    options.resolvedMedia ??
    mediaRows.find((candidate) => candidate.slug === mediaSlug) ??
    null;

  if (!media) {
    return null;
  }

  const settingsPromise = measureWith(options.profiler, "getStudySettings", () =>
    getStudySettings(database)
  );
  const settings = await settingsPromise;

  const searchState = normalizeReviewSearchState(searchParams);
  const workspace = await measureWith(
    options.profiler,
    "loadGlobalReviewWorkspace",
    () =>
      loadGlobalReviewWorkspace(
        searchState,
        database,
        {
          ...options,
          resolvedMediaRows: mediaRows
        },
        settings.reviewDailyLimit
      )
  );

  return measureWith(options.profiler, "buildReviewPageDataFromWorkspace", () =>
    buildReviewPageDataFromWorkspace({
      cards: workspace.cards,
      dailyLimit: workspace.dailyLimit,
      database,
      entryLookup: workspace.entryLookup,
      excludeCardIds: options.excludeCardIds,
      media: {
        glossaryHref: mediaGlossaryHref(media.slug),
        href: mediaHref(media.slug),
        reviewHref: mediaStudyHref(media.slug, "review"),
        slug: media.slug,
        title: media.title
      },
      mediaById: buildReviewMediaLookup(workspace.mediaRows),
      newIntroducedTodayCount: workspace.newIntroducedTodayCount,
      now,
      profiler: options.profiler,
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
    mediaSlug?: string;
    scope: ReviewScope;
    searchParams: Record<string, string | string[] | undefined>;
  },
  database: DatabaseClient = db
): Promise<ReviewPageData> {
  if (input.scope === "global") {
    return getGlobalReviewPageData(input.searchParams, database, {
      bypassCache: false
    });
  }

  if (!input.mediaSlug) {
    throw new Error("Media review scope requires a media slug.");
  }

  const data = await getReviewPageData(input.mediaSlug, input.searchParams, database, {
    bypassCache: false
  });

  if (!data) {
    throw new Error(
      `Unable to load review page data for media: ${input.mediaSlug}`
    );
  }

  return data;
}

export async function buildGlobalReviewPageData(
  input: LoadedGlobalReviewPageWorkspace,
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
  const workspace = await loadGlobalReviewPageWorkspace(
    searchState,
    database,
    options
  );

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
      database,
      options.profiler,
      options.excludeCardIds
    )
  };
}

export async function buildReviewFirstCandidateDataFromWorkspace(input: {
  cards: ReviewCardListItem[];
  database?: DatabaseClient;
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot?: FsrsOptimizerSnapshot;
  media: ReviewPageWorkspace;
  mediaById: ReviewMediaLookup;
  newIntroducedTodayCount: number;
  now: Date;
  reviewFrontFurigana: boolean;
  scope: ReviewScope;
  searchState: ReviewSearchState;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewFirstCandidatePageData> {
  const nowIso = input.now.toISOString();
  const fsrsOptimizerSnapshot =
    input.fsrsOptimizerSnapshot ??
    (await getFsrsOptimizerSnapshot(input.database ?? db));
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
  const queueSnapshot = await measureWith(
    input.profiler,
    "buildReviewQueueSubjectSnapshot",
    () =>
      buildReviewQueueSubjectSnapshot({
        cards: segmentFilteredCards,
        dailyLimit: input.dailyLimit,
        entryLookup: input.entryLookup,
        extraNewCount: input.searchState.extraNewCount,
        newIntroducedTodayCount: input.newIntroducedTodayCount,
        nowIso,
        subjectGroups: segmentFilteredSubjectGroups,
        visibleMediaId: input.visibleMediaId
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
  const selectedRawCard = selection.selectedModel
    ? resolveReviewSubjectSelectionCard({
        selectedCardId: selection.selectedCardId,
        subjectModel: selection.selectedModel
      })
    : null;
  const selectedCard =
    selection.selectedModel && selectedRawCard
      ? mapReviewQueueSubjectCardPreview({
          card: selectedRawCard,
          entryLookup: input.entryLookup,
          fsrsOptimizerSnapshot,
          mediaById: input.mediaById,
          nowIso,
          queueStateSnapshot: selection.selectedModel.queueStateSnapshot
        })
      : null;
  const selectedCardContext = buildReviewFirstCandidateSelectedCardContext({
    bucket: selectedCard?.bucket ?? null,
    queueIndex: selection.queueIndex,
    queueSnapshot,
    searchState: input.searchState
  });
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
    queue: {
      dailyLimit: queueSnapshot.dailyLimit,
      dueCount: queueSnapshot.dueCount,
      effectiveDailyLimit: queueSnapshot.effectiveDailyLimit,
      introLabel: queueSnapshot.introLabel,
      manualCount: queueSnapshot.manualCount,
      newAvailableCount: queueSnapshot.newAvailableCount,
      newQueuedCount: queueSnapshot.newQueuedCount,
      queueCount: queueSnapshot.queueCount,
      queueLabel: queueSnapshot.introLabel,
      suspendedCount: queueSnapshot.suspendedCount,
      tomorrowCount: queueSnapshot.tomorrowCount,
      upcomingCount: queueSnapshot.upcomingCount
    },
    scope: input.scope,
    selectedCard,
    selectedCardContext,
    settings: {
      reviewFrontFurigana: input.reviewFrontFurigana
    },
    session: {
      answeredCount: input.searchState.answeredCount,
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
  const cacheDayKey = getLocalIsoDateKey(new Date());
  const { cacheKeyPart: fsrsCacheKeyPart, snapshot: fsrsOptimizerSnapshot } =
    await getFsrsOptimizerRuntimeContext(database);
  const cacheKeyParts = [
    "review",
    "global-first-candidate",
    `day:${cacheDayKey}`,
    ...buildReviewSearchStateCacheKeyParts(searchState),
    `fsrs:${fsrsCacheKeyPart}`
  ];

  const loadSnapshot = async () => {
    const workspace = await loadGlobalReviewPageWorkspace(
      searchState,
      database,
      options
    );

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
        database,
        dailyLimit: workspace.dailyLimit,
        entryLookup: workspace.entryLookup,
        fsrsOptimizerSnapshot,
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
  const workspace = await loadGlobalReviewPageWorkspace(
    searchState,
    database,
    options
  );

  return buildGlobalReviewPageData(
    workspace,
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
    getFsrsOptimizerSnapshot(database),
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
    cards: snapshot.cards,
    dailyLimit: snapshot.dailyLimit,
    dueCount: snapshot.dueCount,
    effectiveDailyLimit: snapshot.effectiveDailyLimit,
    manualCount: snapshot.manualCount,
    newAvailableCount: snapshot.newAvailableCount,
    newQueuedCount: snapshot.newQueuedCount,
    queueLabel: snapshot.introLabel,
    queueCount: snapshot.queueCount,
    suspendedCount: snapshot.suspendedCount,
    tomorrowCount: snapshot.tomorrowCount,
    upcomingCount: snapshot.upcomingCount
  };
}

export function mapReviewQueueSubjectCardPreview(input: {
  card: ReviewCardListItem;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  fsrsOptimizerSnapshot: FsrsOptimizerSnapshot;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  queueStateSnapshot: ReviewQueueStateSnapshot;
}) {
  const cardMedia = resolveReviewCardMedia(input.card, input.mediaById);

  return {
    back: input.card.back,
    bucket: input.queueStateSnapshot.bucket,
    bucketDetail: buildBucketDetail(
      input.queueStateSnapshot.bucket,
      input.queueStateSnapshot.dueAt
    ),
    bucketLabel: formatBucketLabel(input.queueStateSnapshot.bucket),
    createdAt: input.card.createdAt,
    dueAt: input.queueStateSnapshot.dueAt,
    dueLabel: input.queueStateSnapshot.dueAt
      ? `Scadenza ${formatShortIsoDate(input.queueStateSnapshot.dueAt)}`
      : undefined,
    effectiveState: input.queueStateSnapshot.effectiveState,
    effectiveStateLabel: formatReviewStateLabel(
      input.queueStateSnapshot.effectiveState,
      input.queueStateSnapshot.effectiveState === "known_manual"
    ),
    exampleIt: input.card.exampleIt ?? undefined,
    exampleJp: input.card.exampleJp ?? undefined,
    front: input.card.front,
    href: mediaReviewCardHref(cardMedia.slug, input.card.id),
    id: input.card.id,
    mediaSlug: cardMedia.slug,
    mediaTitle: cardMedia.title,
    notes: input.card.notesIt ?? undefined,
    orderIndex: input.card.orderIndex,
    rawReviewLabel: input.queueStateSnapshot.rawReviewLabel,
    reading: resolveReviewCardReading(input.card, input.entryLookup),
    reviewSeedState: buildReviewSeedStateWithFsrsPreset(
      input.queueStateSnapshot.reviewSeedState,
      input.card.cardType,
      input.fsrsOptimizerSnapshot
    ),
    segmentTitle: input.card.segment?.title ?? undefined,
    typeLabel: capitalizeToken(input.card.cardType)
  } satisfies ReviewFirstCandidateCard;
}

export function buildReviewQueueSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  extraNewCount: number;
  fsrsOptimizerSnapshot: FsrsOptimizerSnapshot;
  mediaById: ReviewMediaLookup;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
}) {
  const snapshot = buildReviewQueueSubjectSnapshot({
    cards: input.cards,
    dailyLimit: input.dailyLimit,
    entryLookup: input.entryLookup,
    extraNewCount: input.extraNewCount,
    newIntroducedTodayCount: input.newIntroducedTodayCount,
    nowIso: input.nowIso,
    subjectGroups: input.subjectGroups,
    visibleMediaId: input.visibleMediaId
  });
  const mapInput: ReviewQueueCardMapInput = {
    contextCache: new Map(),
    entryLookup: input.entryLookup,
    fsrsOptimizerSnapshot: input.fsrsOptimizerSnapshot,
    mediaById: input.mediaById,
    nowIso: input.nowIso,
    visibleMediaId: input.visibleMediaId
  };

  return {
    cards: snapshot.queueModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    dailyLimit: snapshot.dailyLimit,
    dueCount: snapshot.dueCount,
    effectiveDailyLimit: snapshot.effectiveDailyLimit,
    introLabel: snapshot.introLabel,
    manualCards: snapshot.manualModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    manualCount: snapshot.manualCount,
    newAvailableCount: snapshot.newAvailableCount,
    newQueuedCount: snapshot.newQueuedCount,
    queueLabel: snapshot.introLabel,
    queueCount: snapshot.queueCount,
    suspendedCards: snapshot.suspendedModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    suspendedCount: snapshot.suspendedCount,
    tomorrowCount: snapshot.tomorrowCount,
    upcomingCards: snapshot.upcomingModels.map((model) =>
      mapReviewQueueSubjectModel(model, mapInput)
    ),
    upcomingCount: snapshot.upcomingCount
  };
}

export function mapReviewQueueSubjectModel(
  model: ReviewSubjectModel,
  input: ReviewQueueCardMapInput
) {
  const selectedCard = resolveReviewSubjectSelectionCard({
    selectedCardId: input.selectedCardId,
    subjectModel: model
  });

  return mapQueueCard(
    selectedCard,
    input.entryLookup,
    model.group.cards,
    input.mediaById,
    input.nowIso,
    input.fsrsOptimizerSnapshot,
    model.queueStateSnapshot,
    resolveReviewQueueSubjectContexts(
      model.group,
      input.mediaById,
      input.contextCache,
      input.visibleMediaId
    )
  );
}

function buildReviewCardContexts(
  cards: ReviewCardListItem[],
  mediaById: ReviewMediaLookup
) {
  return cards
    .map((item) => {
      const media = resolveReviewCardMedia(item, mediaById);

      return {
        cardId: item.id,
        front: stripInlineMarkdown(item.front),
        mediaSlug: media.slug,
        mediaTitle: media.title,
        segmentTitle: item.segment?.title ?? undefined
      };
    })
    .sort((left, right) => {
      if (left.mediaTitle !== right.mediaTitle) {
        return left.mediaTitle.localeCompare(right.mediaTitle, "it");
      }

      if ((left.segmentTitle ?? "") !== (right.segmentTitle ?? "")) {
        return (left.segmentTitle ?? "").localeCompare(
          right.segmentTitle ?? "",
          "it"
        );
      }

      return left.front.localeCompare(right.front, "it");
    });
}

function resolveReviewQueueSubjectContexts(
  group: ReviewSubjectGroup,
  mediaById: ReviewMediaLookup,
  contextCache?: Map<string, ReviewQueueCard["contexts"]>,
  visibleMediaId?: string
) {
  const cacheKey = `${group.identity.subjectKey}:${visibleMediaId ?? "all"}`;
  const cached = contextCache?.get(cacheKey);

  if (cached) {
    return cached;
  }

  const contexts = buildReviewCardContexts(
    visibleMediaId
      ? group.cards.filter((card) => card.mediaId === visibleMediaId)
      : group.cards,
    mediaById
  );

  contextCache?.set(cacheKey, contexts);

  return contexts;
}

function resolveReviewSubjectSelectionCard(input: {
  selectedCardId?: string | null;
  subjectModel: ReviewSubjectModel;
}) {
  return (
    (input.selectedCardId
      ? input.subjectModel.group.cards.find(
          (card) => card.id === input.selectedCardId
        )
      : null) ?? input.subjectModel.card
  );
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
