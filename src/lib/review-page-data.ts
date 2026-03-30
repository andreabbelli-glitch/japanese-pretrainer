import {
  countReviewSubjectsIntroducedOnDayByMediaId,
  db,
  type DatabaseClient,
  type ReviewCardListItem
} from "@/db";
import {
  canUseDataCache,
  getMediaBySlugCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import {
  getStudySettings
} from "@/lib/settings";
import {
  mediaGlossaryHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref
} from "@/lib/site";
import {
  capitalizeToken,
  formatReviewStateLabel
} from "@/lib/study-format";
import { measureWith, type ReviewProfiler } from "@/lib/review-profiler";
import { buildReviewGradePreviews as buildSharedReviewGradePreviews } from "./review-grade-previews";
import {
  buildReviewSearchStateCacheKeyParts,
  normalizeReviewSearchState,
  type ReviewSearchState
} from "./review-search-state";
import {
  buildBucketDetail,
  buildReviewQueueSubjectSnapshot,
  findReviewQueueSubjectModelByCardId,
  formatBucketLabel,
  formatShortIsoDate,
  type ResolvedReviewQueueState,
  type ReviewQueueSubjectSnapshot,
  type ReviewSubjectModel
} from "./review-queue";
import type { ReviewSubjectGroup } from "./review-subject";
import {
  buildReviewMediaLookup,
  buildSingleMediaLookup,
  loadReviewCardPronunciations,
  mapQueueCard,
  resolveReviewCardMedia,
  resolveReviewCardReading,
  type ReviewEntryLookupItem,
  type ReviewMediaLookup
} from "./review-card-hydration";
import {
  loadGlobalReviewPageWorkspace,
  loadGlobalReviewWorkspace,
  loadReviewWorkspaceV2,
  type LoadedGlobalReviewPageWorkspace,
  type ReviewPageLoadOptions
} from "./review-loader";
import type {
  GlobalReviewFirstCandidateLoadResult,
  GlobalReviewPageLoadResult,
  ReviewFirstCandidateCard,
  ReviewFirstCandidatePageData,
  ReviewFirstCandidateSelectedCardContext,
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
  mediaById: ReviewMediaLookup;
  nowIso: string;
  selectedCardId?: string | null;
  visibleMediaId?: string;
};

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
  const segmentFilteredCards = input.searchState.segmentId
    ? input.cards.filter(
        (card) => card.segmentId === input.searchState.segmentId
      )
    : input.cards;
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
        subjectGroups: input.subjectGroups,
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

  const media =
    options.resolvedMedia ??
    (await measureWith(options.profiler, "getMediaBySlug", () =>
      getMediaBySlugCached(database, mediaSlug)
    ));

  if (!media) {
    return null;
  }

  const searchState = normalizeReviewSearchState(searchParams);
  const [settings, newIntroducedTodayCount] = await Promise.all([
    measureWith(options.profiler, "getStudySettings", () =>
      getStudySettings(database)
    ),
    measureWith(
      options.profiler,
      "countReviewSubjectsIntroducedOnDayByMediaId",
      () => countReviewSubjectsIntroducedOnDayByMediaId(database, media.id, now)
    )
  ]);
  const workspace = await measureWith(
    options.profiler,
    "loadReviewWorkspaceV2",
    () =>
      loadReviewWorkspaceV2({
        bypassCache: options.bypassCache,
        database,
        mediaIds: [media.id],
        now,
        profiler: options.profiler,
        resolvedDailyLimit: settings.reviewDailyLimit,
        resolvedNewIntroducedTodayCount: newIntroducedTodayCount
      })
  );

  return measureWith(
    options.profiler,
    "buildReviewPageDataFromWorkspace",
    () =>
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
        mediaById: buildSingleMediaLookup(media),
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
  dailyLimit: number;
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
}): Promise<ReviewFirstCandidatePageData> {
  const nowIso = input.now.toISOString();
  const queueSnapshot = await measureWith(
    input.profiler,
    "buildReviewQueueSubjectSnapshot",
    () =>
      buildReviewQueueSubjectSnapshot({
        cards: input.cards,
        dailyLimit: input.dailyLimit,
        entryLookup: input.entryLookup,
        extraNewCount: input.searchState.extraNewCount,
        newIntroducedTodayCount: input.newIntroducedTodayCount,
        nowIso,
        subjectGroups: input.subjectGroups,
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
          mediaById: input.mediaById,
          nowIso,
          resolvedState: selection.selectedModel.resolvedState
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
  const cacheKeyParts = [
    "review",
    "global-first-candidate",
    ...buildReviewSearchStateCacheKeyParts(searchState)
  ];

  const loadSnapshot = async () => {
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
        reviewFrontFurigana: settings.reviewFrontFurigana,
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

  const [media, dailyLimit] = await Promise.all([
    getMediaBySlugCached(database, mediaSlug),
    import("@/lib/settings").then(({ getReviewDailyLimit }) =>
      getReviewDailyLimit(database)
    )
  ]);

  if (!media) {
    return null;
  }

  const newIntroducedTodayCount = await countReviewSubjectsIntroducedOnDayByMediaId(
    database,
    media.id,
    now
  );

  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds: [media.id],
    now,
    resolvedDailyLimit: dailyLimit,
    resolvedNewIntroducedTodayCount: newIntroducedTodayCount
  });
  const snapshot = buildReviewQueueSnapshot({
    cards: workspace.cards,
    dailyLimit: workspace.dailyLimit,
    entryLookup: workspace.entryLookup,
    extraNewCount: 0,
    mediaById: buildSingleMediaLookup(media),
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

export function resolveReviewPageSelection(input: {
  queueSnapshot: ReviewQueueSubjectSnapshot;
  searchState: ReviewSearchState;
}) {
  const visibleSelectionModels = [
    ...input.queueSnapshot.queueModels,
    ...input.queueSnapshot.manualModels,
    ...input.queueSnapshot.suspendedModels,
    ...input.queueSnapshot.upcomingModels
  ];
  const explicitSelectionModel = input.searchState.selectedCardId
    ? findReviewQueueSubjectModelByCardId(
        visibleSelectionModels,
        input.searchState.selectedCardId
      )
    : null;
  const fallbackSelectionModel =
    input.searchState.selectedCardId && explicitSelectionModel === null
      ? findReviewQueueSubjectModelByCardId(
          input.queueSnapshot.subjectModels,
          input.searchState.selectedCardId
        )
      : null;
  const selectedModel =
    explicitSelectionModel ??
    fallbackSelectionModel ??
    input.queueSnapshot.queueModels[0] ??
    null;
  const selectedCardId =
    explicitSelectionModel || fallbackSelectionModel
      ? input.searchState.selectedCardId
      : null;
  const selectedQueueModel = selectedModel
    ? findReviewQueueSubjectModelByCardId(
        input.queueSnapshot.queueModels,
        selectedModel.card.id
      )
    : null;
  const queueIndex = selectedQueueModel
    ? input.queueSnapshot.queueModels.indexOf(selectedQueueModel)
    : -1;

  return {
    queueIndex,
    selectedCardId,
    selectedModel,
    selectedQueueModel
  };
}

export function buildReviewFirstCandidateSelectedCardContext(input: {
  bucket: ReviewFirstCandidateCard["bucket"] | null;
  queueIndex: number;
  queueSnapshot: ReviewQueueSubjectSnapshot;
  searchState: ReviewSearchState;
}): ReviewFirstCandidateSelectedCardContext {
  return {
    bucket: input.bucket,
    isQueueCard: input.queueIndex >= 0,
    position: input.queueIndex >= 0 ? input.queueIndex + 1 : null,
    remainingCount:
      input.queueIndex >= 0
        ? input.queueSnapshot.queueCount - input.queueIndex - 1
        : 0,
    showAnswer: input.searchState.showAnswer || input.queueIndex < 0
  };
}

export function mapReviewQueueSubjectCardPreview(input: {
  card: ReviewCardListItem;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  resolvedState: ResolvedReviewQueueState;
}) {
  const cardMedia = resolveReviewCardMedia(input.card, input.mediaById);

  return {
    back: input.card.back,
    bucket: input.resolvedState.bucket,
    bucketDetail: buildBucketDetail(
      input.resolvedState.bucket,
      input.resolvedState.dueAt
    ),
    bucketLabel: formatBucketLabel(
      input.resolvedState.bucket
    ),
    createdAt: input.card.createdAt,
    dueAt: input.resolvedState.dueAt,
    dueLabel: input.resolvedState.dueAt
      ? `Scadenza ${formatShortIsoDate(input.resolvedState.dueAt)}`
      : undefined,
    effectiveState: input.resolvedState.effectiveState,
    effectiveStateLabel: formatReviewStateLabel(
      input.resolvedState.effectiveState,
      input.resolvedState.effectiveState === "known_manual"
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
    rawReviewLabel: input.resolvedState.rawReviewLabel,
    reading: resolveReviewCardReading(input.card, input.entryLookup),
    reviewSeedState: input.resolvedState.reviewSeedState,
    segmentTitle: input.card.segment?.title ?? undefined,
    typeLabel: capitalizeToken(input.card.cardType)
  } satisfies ReviewFirstCandidateCard;
}

export function buildReviewQueueSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  extraNewCount: number;
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
    model.resolvedState,
    resolveReviewQueueSubjectContexts(
      model.group,
      input.mediaById,
      input.contextCache
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
  contextCache?: Map<string, ReviewQueueCard["contexts"]>
) {
  const cached = contextCache?.get(group.identity.subjectKey);

  if (cached) {
    return cached;
  }

  const contexts = buildReviewCardContexts(group.cards, mediaById);

  contextCache?.set(group.identity.subjectKey, contexts);

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
