import {
  countReviewSubjectsIntroducedOnDay,
  countReviewSubjectsIntroducedOnDayByMediaId,
  db,
  getCardById,
  listCrossMediaFamiliesByEntryIds,
  getGlossaryEntriesByIds,
  getMediaById,
  listGrammarEntryReviewSummariesByIds,
  listReviewLaunchCandidates,
  listReviewCardsByMediaId,
  listReviewCardsByMediaIds,
  listTermEntryReviewSummariesByIds,
  getReviewSubjectStateByKey,
  type CrossMediaFamily,
  type CrossMediaSibling,
  type DatabaseClient,
  type GrammarEntryReviewSummary,
  type GrammarGlossaryEntry,
  type GrammarGlossaryEntrySummary,
  type MediaListItem,
  type ReviewCardListItem,
  type ReviewLaunchCandidate,
  type TermEntryReviewSummary,
  type TermGlossaryEntry,
  type TermGlossaryEntrySummary
} from "@/db";
import {
  buildGlossarySummaryTags,
  buildReviewSummaryTags,
  canUseDataCache,
  getMediaBySlugCached,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import {
  getReviewDailyLimit,
  getStudySettings
} from "@/lib/settings";
import {
  mediaGlossaryEntryHref,
  mediaGlossaryHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref
} from "@/lib/site";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatReviewStateLabel
} from "@/lib/study-format";
import { buildEntryKey } from "@/lib/entry-id";
import { measureWith, type ReviewProfiler } from "@/lib/review-profiler";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import { resolveReviewSubjectGroups } from "./review-subject-state-lookup.ts";
import {
  buildReviewSubjectEntryLookup,
  deriveReviewSubjectIdentity,
  groupReviewCardsBySubject,
  matchesReviewSubjectEntrySurface,
  selectReviewSubjectRepresentativeCard,
  type ReviewSubjectEntryMeta,
  type ReviewSubjectGroup,
  type ReviewSubjectStateSnapshot
} from "./review-subject";

import {
  getDrivingEntryLinks,
  hasCompletedReviewLesson,
  isReviewCardDue,
  isReviewCardNew,
  resolveEffectiveReviewState,
  type EffectiveReviewState,
  type ReviewEntryLinkLike
} from "./review-model";
import {
  buildPronunciationData,
  type PronunciationData
} from "./pronunciation";
import { pickBestBy } from "@/lib/collections";
import { buildReviewGradePreviews as buildSharedReviewGradePreviews } from "./review-grade-previews";
import {
  buildReviewSearchStateCacheKeyParts,
  normalizeReviewSearchState,
  type ReviewSearchState
} from "./review-search-state";
import type {
  GlobalReviewFirstCandidateLoadResult,
  GlobalReviewPageLoadResult,
  ReviewCardDetailData,
  ReviewCardEntryKind,
  ReviewCardEntrySummary,
  ReviewCardPronunciation,
  ReviewFirstCandidateCard,
  ReviewFirstCandidatePageData,
  ReviewFirstCandidateSelectedCardContext,
  ReviewOverviewSnapshot,
  ReviewPageData,
  ReviewQueueCard,
  ReviewQueueSnapshot,
  ReviewScope
} from "./review-types";
import { type ReviewState } from "./review-scheduler";

// Shared empty lookup used as a no-op placeholder when entryLookup is unused.
const EMPTY_ENTRY_LOOKUP = new Map<string, ReviewSubjectEntryMeta>();


type ReviewEntryLookupItem = {
  href: ReturnType<typeof mediaGlossaryEntryHref>;
  id: string;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  pronunciation?: PronunciationData;
  reading?: string;
  subtitle?: string;
};
type ReviewTermLookupEntry =
  | TermGlossaryEntry
  | TermGlossaryEntrySummary
  | TermEntryReviewSummary;
type ReviewGrammarLookupEntry =
  | GrammarGlossaryEntry
  | GrammarGlossaryEntrySummary
  | GrammarEntryReviewSummary;
type ReviewMediaLookup = Map<
  string,
  {
    slug: string;
    title: string;
  }
>;
export type {
  GlobalReviewFirstCandidateLoadResult,
  GlobalReviewPageLoadResult,
  ReviewCardDetailData,
  ReviewCardEntryKind,
  ReviewCardEntrySummary,
  ReviewCardPronunciation,
  ReviewFirstCandidatePageData,
  ReviewOverviewSnapshot,
  ReviewPageData,
  ReviewQueueCard,
  ReviewQueueSnapshot,
  ReviewScope
} from "./review-types";
export type {
  ReviewGradePreview,
  ReviewSeedState
} from "./review-grade-previews";

type ReviewPageWorkspace = ReviewPageData["media"];
type ResolvedReviewQueueState = {
  bucket: ReviewQueueCard["bucket"];
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  rawReviewLabel: string;
  reviewSeedState: ReviewQueueCard["reviewSeedState"];
};

type ReviewSubjectModel = {
  card: ReviewCardListItem;
  group: ReviewSubjectGroup;
  resolvedState: ResolvedReviewQueueState;
};

type ReviewQueueSubjectSnapshot = {
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  introLabel: string;
  manualCount: number;
  manualModels: ReviewSubjectModel[];
  newAvailableCount: number;
  newQueuedCount: number;
  queueCount: number;
  queueModels: ReviewSubjectModel[];
  subjectModels: ReviewSubjectModel[];
  suspendedCount: number;
  suspendedModels: ReviewSubjectModel[];
  tomorrowCount: number;
  upcomingCount: number;
  upcomingModels: ReviewSubjectModel[];
};

type ReviewQueueCardMapInput = {
  contextCache?: Map<string, ReviewQueueCard["contexts"]>;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  mediaById: ReviewMediaLookup;
  nowIso: string;
  selectedCardId?: string | null;
  visibleMediaId?: string;
};

type LoadedReviewWorkspaceV2 = {
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
  grammar: GrammarEntryReviewSummary[];
  rawCardCount: number;
  terms: TermEntryReviewSummary[];
};

type LoadedGlobalReviewPageWorkspace = {
  mediaRows: MediaListItem[];
  reviewFrontFurigana: boolean;
  searchState: ReviewSearchState;
} & LoadedReviewWorkspaceV2;

type ResolvedMedia = Awaited<ReturnType<typeof getMediaBySlugCached>>;

type ReviewPageLoadOptions = {
  bypassCache?: boolean;
  excludeCardIds?: string[];
  profiler?: ReviewProfiler | null;
  resolvedMedia?: NonNullable<ResolvedMedia>;
};

async function buildReviewPageDataFromWorkspace(input: {
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
  const mediaById = input.mediaById;
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
    mediaById,
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

function resolveReviewPageSelection(input: {
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

function buildReviewFirstCandidateSelectedCardContext(input: {
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

function mapReviewQueueSubjectCardPreview(input: {
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
      input.resolvedState.bucket,
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

async function buildReviewFirstCandidateDataFromWorkspace(input: {
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

function collectReviewLinkedEntryIds(
  cards: Array<Pick<ReviewCardListItem, "entryLinks">>
) {
  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const card of cards) {
    for (const link of card.entryLinks) {
      if (link.entryType === "term") {
        termIds.add(link.entryId);
        continue;
      }

      if (link.entryType === "grammar") {
        grammarIds.add(link.entryId);
      }
    }
  }

  return {
    grammarIds: [...grammarIds],
    termIds: [...termIds]
  };
}

async function loadReviewEntrySummariesForCards(input: {
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

async function loadStableReviewWorkspaceV2(input: {
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

async function loadStableReviewWorkspaceV2Cached(input: {
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

async function loadReviewWorkspaceV2(input: {
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
            countReviewSubjectsIntroducedOnDay(database, now)
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
  const reviewFrontFurigana = settings.reviewFrontFurigana;

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
        reviewFrontFurigana,
        scope: "media",
        searchState,
        subjectGroups: workspace.subjectGroups,
        visibleMediaId: media.id
      })
  );
}

async function loadGlobalReviewWorkspace(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {},
  resolvedDailyLimit?: number
): Promise<Omit<LoadedGlobalReviewPageWorkspace, "reviewFrontFurigana">> {
  const now = new Date();
  const mediaRows = await measureWith(options.profiler, "listMediaCached", () =>
    listMediaCached(database)
  );
  const searchState = normalizeReviewSearchState(searchParams);
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

async function loadGlobalReviewPageWorkspace(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<LoadedGlobalReviewPageWorkspace> {
  const settings = await measureWith(
    options.profiler,
    "getStudySettings",
    () => getStudySettings(database)
  );
  const workspace = await loadGlobalReviewWorkspace(
    searchParams,
    database,
    options,
    settings.reviewDailyLimit
  );

  return {
    ...workspace,
    reviewFrontFurigana: settings.reviewFrontFurigana
  };
}

async function buildGlobalReviewPageData(
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
  const workspace = await loadGlobalReviewPageWorkspace(
    searchParams,
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
      searchParams,
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
  const workspace = await loadGlobalReviewPageWorkspace(
    searchParams,
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
    getReviewDailyLimit(database)
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

export async function hydrateReviewCard(input: {
  cardId: string;
  database?: DatabaseClient;
  now?: Date;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewQueueCard | null> {
  const database = input.database ?? db;
  const cacheEligible = canUseDataCache(database);

  return measureWith(
    input.profiler,
    "hydrateReviewCard.cached",
    () =>
      runWithTaggedCache({
        enabled: cacheEligible,
        keyParts: ["review", "hydrated-card", input.cardId],
        loader: () => hydrateReviewCardUncached(input),
        tags: [
          ...buildReviewSummaryTags(),
          ...buildGlossarySummaryTags(),
          REVIEW_FIRST_CANDIDATE_TAG
        ]
      }),
    { cacheEligible, cardId: input.cardId }
  );
}

async function hydrateReviewCardUncached(input: {
  cardId: string;
  database?: DatabaseClient;
  now?: Date;
  profiler?: ReviewProfiler | null;
}): Promise<ReviewQueueCard | null> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const card = await measureWith(input.profiler, "getCardById", () =>
    getCardById(database, input.cardId)
  );

  if (!card || card.status === "archived") {
    return null;
  }

  if (!hasCompletedReviewLesson(card)) {
    return null;
  }

  const { termIds, grammarIds } = collectReviewLinkedEntryIds([card]);
  const [terms, grammar, cardMedia] = await Promise.all([
    measureWith(input.profiler, "getGlossaryEntriesByIds.term", () =>
      getGlossaryEntriesByIds(database, "term", termIds)
    ),
    measureWith(input.profiler, "getGlossaryEntriesByIds.grammar", () =>
      getGlossaryEntriesByIds(database, "grammar", grammarIds)
    ),
    measureWith(input.profiler, "getMediaById", () =>
      getMediaById(database, card.mediaId)
    )
  ]);
  const entryLookup = buildEntryLookup(terms, grammar);
  const subjectIdentity = deriveReviewSubjectIdentity({
    cardId: card.id,
    cardType: card.cardType,
    front: card.front,
    entryLinks: card.entryLinks,
    entryLookup: buildReviewSubjectEntryLookup({ grammar, terms })
  });
  const subjectState = await measureWith(
    input.profiler,
    "getReviewSubjectStateByKey",
    () => getReviewSubjectStateByKey(database, subjectIdentity.subjectKey)
  );
  const resolvedState = resolveReviewQueueState(
    card.status,
    subjectState,
    nowIso
  );
  const resolvedMedia = cardMedia
    ? { slug: cardMedia.slug, title: cardMedia.title }
    : { slug: "unknown-media" as const, title: "Media" };
  const mediaById = buildSingleMediaLookup({
    id: card.mediaId,
    ...resolvedMedia
  });
  const queueCard = await measureWith(
    input.profiler,
    "mapQueueCard",
    () => mapQueueCard(card, entryLookup, [card], mediaById, nowIso, resolvedState),
    { cardId: card.id }
  );

  return {
    ...queueCard,
    gradePreviews: buildSharedReviewGradePreviews(resolvedState.reviewSeedState, now)
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

export async function getReviewCardDetailData(
  mediaSlug: string,
  cardId: string,
  database: DatabaseClient = db
): Promise<ReviewCardDetailData | null> {
  const nowIso = new Date().toISOString();

  const [media, selectedRawCard] = await Promise.all([
    getMediaBySlugCached(database, mediaSlug),
    getCardById(database, cardId)
  ]);

  if (
    !media ||
    !selectedRawCard ||
    selectedRawCard.mediaId !== media.id ||
    selectedRawCard.status === "archived" ||
    !hasCompletedReviewLesson(selectedRawCard)
  ) {
    return null;
  }

  const { termIds, grammarIds } = collectReviewLinkedEntryIds([selectedRawCard]);
  const [terms, grammar] = await Promise.all([
    getGlossaryEntriesByIds(database, "term", termIds),
    getGlossaryEntriesByIds(database, "grammar", grammarIds)
  ]);
  const entryLookup = buildEntryLookup(terms, grammar);

  const subjectIdentity = deriveReviewSubjectIdentity({
    cardId: selectedRawCard.id,
    cardType: selectedRawCard.cardType,
    front: selectedRawCard.front,
    entryLinks: selectedRawCard.entryLinks,
    entryLookup: buildReviewSubjectEntryLookup({ grammar, terms })
  });
  const subjectState = await getReviewSubjectStateByKey(
    database,
    subjectIdentity.subjectKey
  );
  const resolvedState = resolveReviewQueueState(
    selectedRawCard.status,
    subjectState,
    nowIso
  );
  const selectedCard = mapQueueCard(
    selectedRawCard,
    entryLookup,
    [selectedRawCard],
    new Map([[media.id, { slug: media.slug, title: media.title }]]),
    nowIso,
    resolvedState
  );

  const termById = new Map(terms.map((entry) => [entry.id, entry]));
  const grammarById = new Map(grammar.map((entry) => [entry.id, entry]));
  const drivingLinks = getDrivingEntryLinks(selectedRawCard.entryLinks);
  const termEntryIds = drivingLinks
    .filter((link) => link.entryType === "term" && termById.has(link.entryId))
    .map((link) => link.entryId);
  const grammarEntryIds = drivingLinks
    .filter(
      (link) => link.entryType === "grammar" && grammarById.has(link.entryId)
    )
    .map((link) => link.entryId);
  const [termFamilies, grammarFamilies] = await Promise.all([
    termEntryIds.length > 0
      ? listCrossMediaFamiliesByEntryIds(database, "term", termEntryIds)
      : Promise.resolve(new Map<string, CrossMediaFamily>()),
    grammarEntryIds.length > 0
      ? listCrossMediaFamiliesByEntryIds(database, "grammar", grammarEntryIds)
      : Promise.resolve(new Map<string, CrossMediaFamily>())
  ]);
  const crossMedia = drivingLinks.map((link) => {
    const localEntry =
      link.entryType === "term"
        ? termById.get(link.entryId)
        : grammarById.get(link.entryId);

    if (!localEntry) {
      return null;
    }

    const family =
      link.entryType === "term"
        ? termFamilies.get(link.entryId)
        : grammarFamilies.get(link.entryId);

    if (!family || family.siblings.length === 0) {
      return null;
    }

    return {
      entryId: localEntry.sourceId,
      kind: link.entryType,
      label:
        link.entryType === "term"
          ? (localEntry as TermGlossaryEntry).lemma
          : (localEntry as GrammarGlossaryEntry).pattern,
      meaning: localEntry.meaningIt,
      relationshipLabel: formatCardRelationshipLabel(link.relationshipType),
      siblings: family.siblings.map(mapReviewCrossMediaSibling)
    };
  });
  return {
    card: {
      back: selectedCard.back,
      bucketLabel:
        selectedCard.bucket === "upcoming"
          ? undefined
          : selectedCard.bucketLabel,
      dueLabel: selectedCard.dueLabel,
      exampleIt: selectedCard.exampleIt,
      exampleJp: selectedCard.exampleJp,
      front: selectedCard.front,
      id: selectedCard.id,
      notes: selectedCard.notes,
      reading: selectedCard.reading,
      reviewLabel: selectedCard.effectiveStateLabel,
      segmentTitle: selectedCard.segmentTitle,
      typeLabel: selectedCard.typeLabel
    },
    crossMedia: crossMedia.filter(
      (value): value is NonNullable<(typeof crossMedia)[number]> =>
        value !== null
    ),
    entries: selectedCard.entries,
    pronunciations: selectedCard.pronunciations,
    media: {
      glossaryHref: mediaGlossaryHref(media.slug),
      href: mediaHref(media.slug),
      reviewHref: mediaStudyHref(media.slug, "review"),
      slug: media.slug,
      title: media.title
    }
  };
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
  const dailyLimit = await getReviewDailyLimit(database);
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds,
    now,
    resolvedDailyLimit: dailyLimit
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
  const media = await listMediaCached(database);

  if (media.length === 0) {
    return buildReviewOverviewSnapshot({
      cards: [],
      dailyLimit: 0,
      entryLookup: EMPTY_ENTRY_LOOKUP,
      extraNewCount: 0,
      newIntroducedTodayCount: 0,
      nowIso: new Date().toISOString(),
      subjectStates: new Map()
    });
  }

  const now = new Date();
  const dailyLimit = await getReviewDailyLimit(database);
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds: media.map((item) => item.id),
    now,
    resolvedDailyLimit: dailyLimit
  });

  return buildReviewOverviewSnapshot({
    cards: workspace.cards,
    dailyLimit: workspace.dailyLimit,
    entryLookup: EMPTY_ENTRY_LOOKUP,
    extraNewCount: 0,
    newIntroducedTodayCount: workspace.newIntroducedTodayCount,
    nowIso: workspace.now.toISOString(),
    subjectGroups: workspace.subjectGroups
  });
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
  const dailyLimit = await getReviewDailyLimit(database);
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds: media.map((item) => item.id),
    now,
    resolvedDailyLimit: dailyLimit
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

function isReviewSubjectVisibleInMedia(
  group: ReviewSubjectGroup,
  visibleMediaId?: string
) {
  return (
    !visibleMediaId ||
    group.cards.some((card) => card.mediaId === visibleMediaId)
  );
}

function resolveReviewQueueState(
  cardStatus: string,
  reviewState: ReviewSubjectStateSnapshot | null,
  nowIso: string
): ResolvedReviewQueueState {
  const effectiveState = resolveEffectiveReviewState({
    cardStatus,
    reviewState: reviewState
      ? {
          manualOverride: reviewState.manualOverride,
          suspended: reviewState.suspended,
          state: reviewState.state as ReviewState
        }
      : null
  });
  const rawReviewLabel = formatReviewStateLabel(
    reviewState?.state ?? null,
    reviewState?.manualOverride ?? false
  );
  const dueAt = reviewState?.dueAt ?? null;

  return {
    bucket: resolveCardBucket({
      asOfIso: nowIso,
      dueAt,
      effectiveState: effectiveState.state,
      reviewState: (reviewState?.state as ReviewState | null) ?? null
    }),
    dueAt,
    effectiveState: effectiveState.state,
    rawReviewLabel,
    reviewSeedState: {
      difficulty: reviewState?.difficulty ?? null,
      dueAt: reviewState?.dueAt ?? null,
      lapses: reviewState?.lapses ?? 0,
      lastReviewedAt: reviewState?.lastReviewedAt ?? null,
      learningSteps: reviewState?.learningSteps ?? 0,
      reps: reviewState?.reps ?? 0,
      scheduledDays: reviewState?.scheduledDays ?? 0,
      stability: reviewState?.stability ?? null,
      state: (reviewState?.state as ReviewState | null) ?? null
    }
  };
}

function buildReviewSubjectModels(input: {
  cards: ReviewCardListItem[];
  entryLookup:
    | Map<string, ReviewEntryLookupItem>
    | Map<string, ReviewSubjectEntryMeta>;
  nowIso: string;
  preferredMediaId?: string;
  subjectGroups?: ReviewSubjectGroup[];
  subjectStates?: Map<string, ReviewSubjectStateSnapshot>;
}) {
  const subjectGroups =
    input.subjectGroups ??
    groupReviewCardsBySubject({
      cards: input.cards,
      entryLookup: input.entryLookup as Map<string, ReviewSubjectEntryMeta>,
      nowIso: input.nowIso,
      subjectStates: input.subjectStates ?? new Map()
    });

  return subjectGroups.map((group) => {
    let selectedCard = group.representativeCard;

    if (input.preferredMediaId) {
      const preferredCards = group.cards.filter(
        (card) => card.mediaId === input.preferredMediaId
      );

      if (preferredCards.length > 0 && preferredCards.length < group.cards.length) {
        selectedCard = selectReviewSubjectRepresentativeCard(
          preferredCards,
          group.subjectState,
          input.nowIso
        );
      }
    }

    return {
      card: selectedCard,
      group,
      resolvedState: resolveReviewQueueState(
        selectedCard.status,
        group.subjectState,
        input.nowIso
      )
    } satisfies ReviewSubjectModel;
  });
}

function findReviewQueueSubjectModelByCardId(
  models: ReviewSubjectModel[],
  cardId: string
) {
  return (
    models.find((model) =>
      model.group.cards.some((card) => card.id === cardId)
    ) ?? null
  );
}

function mapReviewQueueSubjectModel(
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

function compareReviewSubjectModelsByDue(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel
) {
  if ((left.resolvedState.dueAt ?? "") !== (right.resolvedState.dueAt ?? "")) {
    return (left.resolvedState.dueAt ?? "9999").localeCompare(
      right.resolvedState.dueAt ?? "9999"
    );
  }

  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  return compareReviewCardsByOrder(left.card, right.card);
}

function compareReviewSubjectModelsByOrder(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel
) {
  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  return compareReviewCardsByOrder(left.card, right.card);
}

export function buildReviewOverviewSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewSubjectEntryMeta>;
  extraNewCount: number;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups?: ReviewSubjectGroup[];
  subjectModels?: ReviewSubjectModel[];
  buckets?: ReturnType<typeof bucketAndSortReviewSubjectModels>;
  subjectStates?: Map<string, ReviewSubjectStateSnapshot>;
  visibleMediaId?: string;
}): ReviewOverviewSnapshot {
  const models =
    input.subjectModels ??
    buildReviewSubjectModels({
      cards: input.cards,
      entryLookup: input.entryLookup,
      nowIso: input.nowIso,
      subjectGroups: input.subjectGroups,
      subjectStates: input.subjectStates
    });
  const modelBuckets = input.buckets ?? bucketAndSortReviewSubjectModels(models);
  const classifiedModels = classifyReviewSubjectModels(
    modelBuckets,
    input.visibleMediaId
  );
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewModels = classifiedModels.globalNewModels
    .slice(0, newSlots)
    .filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
    );

  const dueCount = classifiedModels.dueModels.length;
  const newQueuedCount = queuedNewModels.length;
  const manualCount = classifiedModels.manualModels.length;
  const upcomingCount = classifiedModels.upcomingModels.length;
  const queueLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount,
    manualCount,
    newQueuedCount,
    sessionTopUpNewCount: input.extraNewCount,
    upcomingCount
  });

  const firstQueueModel = classifiedModels.dueModels[0] ?? queuedNewModels[0];

  return {
    activeCards: dueCount + upcomingCount,
    dailyLimit: input.dailyLimit,
    dueCount,
    effectiveDailyLimit,
    manualCount,
    newAvailableCount: classifiedModels.visibleNewModels.length,
    newQueuedCount,
    nextCardFront: firstQueueModel?.card.front
      ? stripInlineMarkdown(firstQueueModel.card.front)
      : undefined,
    queueCount: dueCount + newQueuedCount,
    queueLabel,
    suspendedCount: classifiedModels.suspendedModels.length,
    tomorrowCount: countUpcomingDueTomorrow(
      classifiedModels.upcomingModels,
      input.nowIso
    ),
    totalCards: classifiedModels.visibleModelCount,
    upcomingCount
  };
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

function buildReviewMediaLookup(media: MediaListItem[]) {
  return new Map(
    media.map((item) => [
      item.id,
      {
        slug: item.slug,
        title: item.title
      }
    ])
  );
}

function buildSingleMediaLookup(
  media: Pick<MediaListItem, "id" | "slug" | "title">
): ReviewMediaLookup {
  return new Map([
    [
      media.id,
      {
        slug: media.slug,
        title: media.title
      }
    ]
  ]);
}

function mapReviewCrossMediaSibling(sibling: CrossMediaSibling) {
  return {
    href: mediaGlossaryEntryHref(
      sibling.mediaSlug,
      sibling.kind,
      sibling.sourceId
    ),
    label: sibling.label,
    meaning: sibling.meaningIt,
    mediaSlug: sibling.mediaSlug,
    mediaTitle: sibling.mediaTitle,
    notes: buildReviewCrossMediaNotesPreview(sibling.notesIt),
    reading: sibling.reading ?? undefined,
    subtitle:
      sibling.kind === "term"
        ? [sibling.reading, sibling.romaji].filter(Boolean).join(" / ") ||
          undefined
        : sibling.title && sibling.title !== sibling.label
          ? sibling.title
          : undefined
  };
}

function buildReviewCardPronunciations(
  card: Pick<ReviewCardListItem, "cardType" | "entryLinks" | "front">,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  sortedEntryLinks?: ReviewEntryLinkLike[]
): ReviewCardPronunciation[] {
  const links = sortedEntryLinks ?? card.entryLinks.slice().sort(compareEntryLinks);

  if (!canExposeReviewEntryMedia(card, entryLookup, links)) {
    return [];
  }

  return getDrivingEntryLinks(links)
    .flatMap((link) => {
      const entry = entryLookup.get(
        buildEntryKey(link.entryType, link.entryId)
      );

      if (!entry?.pronunciation) {
        return [];
      }

      return [
        {
          audio: entry.pronunciation,
          kind: entry.kind,
          label: entry.label,
          meaning: entry.meaning,
          relationshipLabel: formatCardRelationshipLabel(link.relationshipType)
        }
      ];
    });
}

async function loadReviewCardPronunciations(input: {
  card: Pick<ReviewCardListItem, "cardType" | "entryLinks" | "front">;
  database: DatabaseClient;
  entryLookup: Map<string, ReviewEntryLookupItem>;
}) {
  if (!canExposeReviewEntryMedia(input.card, input.entryLookup)) {
    return [];
  }

  const drivingLinks = getDrivingEntryLinks(input.card.entryLinks);
  const missingTermIds = new Set<string>();
  const missingGrammarIds = new Set<string>();

  for (const link of drivingLinks) {
    const entry = input.entryLookup.get(
      buildEntryKey(link.entryType, link.entryId)
    );

    if (entry?.pronunciation) {
      continue;
    }

    if (link.entryType === "term") {
      missingTermIds.add(link.entryId);
      continue;
    }

    missingGrammarIds.add(link.entryId);
  }

  if (missingTermIds.size === 0 && missingGrammarIds.size === 0) {
    return buildReviewCardPronunciations(input.card, input.entryLookup);
  }

  const [terms, grammar] = await Promise.all([
    getGlossaryEntriesByIds(input.database, "term", [...missingTermIds]),
    getGlossaryEntriesByIds(input.database, "grammar", [...missingGrammarIds])
  ]);
  const resolvedEntryLookup = new Map(input.entryLookup);

  for (const [key, value] of buildEntryLookup(terms, grammar)) {
    resolvedEntryLookup.set(key, value);
  }

  return buildReviewCardPronunciations(input.card, resolvedEntryLookup);
}

function buildReviewQueueSubjectSnapshot(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  entryLookup: Map<string, ReviewEntryLookupItem>;
  excludeCardIds?: string[];
  extraNewCount: number;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
}): ReviewQueueSubjectSnapshot {
  const allSubjectModels = buildReviewSubjectModels({
    cards: input.cards,
    entryLookup: input.entryLookup,
    nowIso: input.nowIso,
    preferredMediaId: input.visibleMediaId,
    subjectGroups: input.subjectGroups
  });
  const excludeSet =
    input.excludeCardIds && input.excludeCardIds.length > 0
      ? new Set(input.excludeCardIds)
      : null;
  const subjectModels = excludeSet
    ? allSubjectModels.filter((model) => !excludeSet.has(model.card.id))
    : allSubjectModels;
  const buckets = bucketAndSortReviewSubjectModels(subjectModels);
  const classifiedModels = classifyReviewSubjectModels(
    buckets,
    input.visibleMediaId
  );
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewCards = classifiedModels.visibleNewModels.slice(0, newSlots);
  const queueModels = [...classifiedModels.dueModels, ...queuedNewCards];
  const introLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: classifiedModels.dueModels.length,
    manualCount: classifiedModels.manualModels.length,
    newQueuedCount: queuedNewCards.length,
    sessionTopUpNewCount: input.extraNewCount,
    upcomingCount: classifiedModels.upcomingModels.length
  });

  return {
    dailyLimit: input.dailyLimit,
    dueCount: classifiedModels.dueModels.length,
    effectiveDailyLimit,
    introLabel,
    manualCount: classifiedModels.manualModels.length,
    manualModels: classifiedModels.manualModels,
    newAvailableCount: classifiedModels.visibleNewModels.length,
    newQueuedCount: queuedNewCards.length,
    queueCount: queueModels.length,
    queueModels,
    subjectModels,
    suspendedCount: classifiedModels.suspendedModels.length,
    suspendedModels: classifiedModels.suspendedModels,
    tomorrowCount: countUpcomingDueTomorrow(
      classifiedModels.upcomingModels,
      input.nowIso
    ),
    upcomingCount: classifiedModels.upcomingModels.length,
    upcomingModels: classifiedModels.upcomingModels
  };
}

export function bucketAndSortReviewSubjectModels(models: ReviewSubjectModel[]) {
  const dueModels: ReviewSubjectModel[] = [];
  const newModels: ReviewSubjectModel[] = [];
  const manualModels: ReviewSubjectModel[] = [];
  const suspendedModels: ReviewSubjectModel[] = [];
  const upcomingModels: ReviewSubjectModel[] = [];

  for (const model of models) {
    switch (model.resolvedState.bucket) {
      case "due":
        dueModels.push(model);
        break;
      case "new":
        newModels.push(model);
        break;
      case "manual":
        manualModels.push(model);
        break;
      case "suspended":
        suspendedModels.push(model);
        break;
      case "upcoming":
        upcomingModels.push(model);
        break;
    }
  }

  // Sort each bucket ONCE
  dueModels.sort(compareReviewSubjectModelsByDue);
  upcomingModels.sort(compareReviewSubjectModelsByDue);
  newModels.sort(compareReviewSubjectModelsByOrder);
  manualModels.sort(compareReviewSubjectModelsByOrder);
  suspendedModels.sort(compareReviewSubjectModelsByOrder);

  return {
    dueModels,
    newModels,
    manualModels,
    suspendedModels,
    upcomingModels
  };
}

function classifyReviewSubjectModels(
  buckets: ReturnType<typeof bucketAndSortReviewSubjectModels>,
  visibleMediaId?: string
) {
  if (!visibleMediaId) {
    return {
      dueModels: buckets.dueModels,
      globalNewModels: buckets.newModels,
      manualModels: buckets.manualModels,
      suspendedModels: buckets.suspendedModels,
      upcomingModels: buckets.upcomingModels,
      visibleModelCount:
        buckets.dueModels.length +
        buckets.newModels.length +
        buckets.manualModels.length +
        buckets.suspendedModels.length +
        buckets.upcomingModels.length,
      visibleNewModels: buckets.newModels
    };
  }

  const filterVisible = (models: ReviewSubjectModel[]) =>
    models.filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, visibleMediaId)
    );

  const dueModels = filterVisible(buckets.dueModels);
  const visibleNewModels = filterVisible(buckets.newModels);
  const manualModels = filterVisible(buckets.manualModels);
  const suspendedModels = filterVisible(buckets.suspendedModels);
  const upcomingModels = filterVisible(buckets.upcomingModels);

  return {
    dueModels,
    globalNewModels: buckets.newModels,
    manualModels,
    suspendedModels,
    upcomingModels,
    visibleModelCount:
      dueModels.length +
      visibleNewModels.length +
      manualModels.length +
      suspendedModels.length +
      upcomingModels.length,
    visibleNewModels
  };
}

function buildReviewQueueSnapshot(input: {
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

function buildEntryLookup(
  terms: ReviewTermLookupEntry[],
  grammar: ReviewGrammarLookupEntry[]
) {
  const lookup = new Map<string, ReviewEntryLookupItem>();

  for (const entry of terms) {
    const mediaSlug = getEntryMediaSlug(entry);

    lookup.set(buildEntryKey("term", entry.id), {
      href: mediaGlossaryEntryHref(mediaSlug, "term", entry.sourceId),
      id: entry.sourceId,
      kind: "term",
      label: entry.lemma,
      meaning: entry.meaningIt,
      pronunciation: buildReviewEntryPronunciation(
        mediaSlug,
        entry,
        entry.reading
      ),
      reading: entry.reading,
      subtitle:
        [entry.reading, entry.romaji].filter(Boolean).join(" / ") || undefined
    });
  }

  for (const entry of grammar) {
    const mediaSlug = getEntryMediaSlug(entry);

    lookup.set(buildEntryKey("grammar", entry.id), {
      href: mediaGlossaryEntryHref(mediaSlug, "grammar", entry.sourceId),
      id: entry.sourceId,
      kind: "grammar",
      label: entry.pattern,
      meaning: entry.meaningIt,
      pronunciation: buildReviewEntryPronunciation(
        mediaSlug,
        entry,
        entry.reading ?? entry.pattern
      ),
      reading: entry.reading ?? deriveKanaReading(entry.pattern),
      subtitle: entry.title !== entry.pattern ? entry.title : undefined
    });
  }

  return lookup;
}

function buildReviewEntryPronunciation(
  mediaSlug: string,
  entry: ReviewTermLookupEntry | ReviewGrammarLookupEntry,
  reading: string | null | undefined
) {
  if (!("audioSrc" in entry || "pitchAccent" in entry)) {
    return undefined;
  }

  const pronunciationSource = entry as Record<string, unknown>;

  return (
    buildPronunciationData(mediaSlug, {
      audioAttribution: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioAttribution"
      ),
      audioLicense: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioLicense"
      ),
      audioPageUrl: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioPageUrl"
      ),
      audioSource: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioSource"
      ),
      audioSpeaker: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioSpeaker"
      ),
      audioSrc: getOptionalPronunciationStringField(
        pronunciationSource,
        "audioSrc"
      ),
      pitchAccent: getOptionalPronunciationNumberField(
        pronunciationSource,
        "pitchAccent"
      ),
      pitchAccentPageUrl: getOptionalPronunciationStringField(
        pronunciationSource,
        "pitchAccentPageUrl"
      ),
      pitchAccentSource: getOptionalPronunciationStringField(
        pronunciationSource,
        "pitchAccentSource"
      ),
      reading
    }) ?? undefined
  );
}

function getOptionalPronunciationStringField(
  entry: Record<string, unknown>,
  key:
    | "audioAttribution"
    | "audioLicense"
    | "audioPageUrl"
    | "audioSource"
    | "audioSpeaker"
    | "audioSrc"
    | "pitchAccentPageUrl"
    | "pitchAccentSource"
) {
  const value = entry[key];

  return typeof value === "string" || value === null ? value : undefined;
}

function getOptionalPronunciationNumberField(
  entry: Record<string, unknown>,
  key: "pitchAccent"
) {
  const value = entry[key];

  return typeof value === "number" || value === null ? value : undefined;
}

function getEntryMediaSlug(
  entry: ReviewTermLookupEntry | ReviewGrammarLookupEntry
) {
  if ("mediaSlug" in entry) {
    return entry.mediaSlug;
  }

  return entry.media.slug;
}

function resolveReviewCardMedia(
  card: ReviewCardListItem,
  mediaById: ReviewMediaLookup
) {
  return (
    mediaById.get(card.mediaId) ?? {
      slug: "unknown-media",
      title: "Media"
    }
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

function buildReviewCrossMediaNotesPreview(notes?: string | null) {
  if (!notes) {
    return undefined;
  }

  const plainText = notes
    .replace(/[`*_~[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length === 0) {
    return undefined;
  }

  if (plainText.length <= 160) {
    return plainText;
  }

  return `${plainText.slice(0, 157).trimEnd()}...`;
}

function mapQueueCard(
  card: ReviewCardListItem,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  subjectCards: ReviewCardListItem[],
  mediaById: ReviewMediaLookup,
  nowIso: string,
  resolvedState?: ResolvedReviewQueueState,
  contexts?: ReviewQueueCard["contexts"]
): ReviewQueueCard {
  const cardMedia = resolveReviewCardMedia(card, mediaById);
  const sortedEntryLinks = card.entryLinks.slice().sort(compareEntryLinks);
  const entries = sortedEntryLinks
    .flatMap((link) => {
      const entry = entryLookup.get(
        buildEntryKey(link.entryType, link.entryId)
      );

      if (!entry) {
        return [];
      }

      return [
        {
          href: entry.href,
          id: entry.id,
          kind: entry.kind,
          label: entry.label,
          meaning: entry.meaning,
          relationshipLabel: formatCardRelationshipLabel(link.relationshipType),
          statusLabel: "Disponibile",
          subtitle: entry.subtitle
        } satisfies ReviewCardEntrySummary
      ];
    });
  const resolved =
    resolvedState ?? resolveReviewQueueState(card.status, null, nowIso);
  const pronunciations = buildReviewCardPronunciations(card, entryLookup, sortedEntryLinks);
  const reading = resolveReviewCardReading(card, entryLookup, sortedEntryLinks);

  return {
    back: card.back,
    bucket: resolved.bucket,
    bucketDetail: buildBucketDetail(resolved.bucket, resolved.dueAt),
    bucketLabel: formatBucketLabel(resolved.bucket),
    contexts: contexts ?? buildReviewCardContexts(subjectCards, mediaById),
    createdAt: card.createdAt,
    dueAt: resolved.dueAt,
    dueLabel: resolved.dueAt
      ? `Scadenza ${formatShortIsoDate(resolved.dueAt)}`
      : undefined,
    effectiveState: resolved.effectiveState,
    effectiveStateLabel: formatReviewStateLabel(
      resolved.effectiveState,
      resolved.effectiveState === "known_manual"
    ),
    exampleIt: card.exampleIt ?? undefined,
    exampleJp: card.exampleJp ?? undefined,
    entries,
    front: card.front,
    gradePreviews: [],
    href: mediaReviewCardHref(cardMedia.slug, card.id),
    id: card.id,
    mediaSlug: cardMedia.slug,
    mediaTitle: cardMedia.title,
    notes: card.notesIt ?? undefined,
    orderIndex: card.orderIndex,
    pronunciations,
    rawReviewLabel: resolved.rawReviewLabel,
    reading,
    reviewSeedState: resolved.reviewSeedState,
    segmentTitle: card.segment?.title ?? undefined,
    typeLabel: capitalizeToken(card.cardType)
  };
}

function resolveReviewCardReading(
  card: ReviewCardListItem,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  sortedEntryLinks?: ReviewEntryLinkLike[]
) {
  const links = sortedEntryLinks ?? card.entryLinks.slice().sort(compareEntryLinks);

  if (!canExposeReviewEntryMedia(card, entryLookup, links)) {
    return undefined;
  }

  const drivingLinks = getDrivingEntryLinks(links);

  for (const link of drivingLinks) {
    const reading = entryLookup.get(
      buildEntryKey(link.entryType, link.entryId)
    )?.reading;

    if (reading) {
      return reading;
    }
  }

  for (const link of links) {
    const reading = entryLookup.get(
      buildEntryKey(link.entryType, link.entryId)
    )?.reading;

    if (reading) {
      return reading;
    }
  }

  return deriveKanaReading(card.front);
}

function canExposeReviewEntryMedia(
  card: Pick<ReviewCardListItem, "cardType" | "entryLinks" | "front">,
  entryLookup: Map<string, ReviewEntryLookupItem>,
  sortedEntryLinks?: ReviewEntryLinkLike[]
) {
  const links = sortedEntryLinks ?? card.entryLinks;
  const drivingLinks = getDrivingEntryLinks(links);
  const hasPrimaryLink = links.some(
    (link) => link.relationshipType === "primary"
  );

  if (drivingLinks.length !== 1) {
    return false;
  }

  const drivingLink = drivingLinks[0]!;
  const drivingEntry = entryLookup.get(
    buildEntryKey(drivingLink.entryType, drivingLink.entryId)
  );

  if (!drivingEntry) {
    return false;
  }

  if (!hasPrimaryLink) {
    return true;
  }

  if (card.cardType !== "concept") {
    return true;
  }

  return matchesReviewSubjectEntrySurface(card.front, {
    label: drivingEntry.label,
    reading: drivingEntry.reading
  });
}

function deriveKanaReading(value: string) {
  const hasKana = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
  const hasHan = /\p{Script=Han}/u.test(value);

  if (hasKana && !hasHan) {
    return value;
  }

  return undefined;
}

function countUpcomingDueTomorrow(
  upcomingModels: ReviewSubjectModel[],
  nowIso: string
): number {
  const now = new Date(nowIso);
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );
  const tomorrowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2
  );
  const tomorrowStartIso = tomorrowStart.toISOString();
  const tomorrowEndIso = tomorrowEnd.toISOString();

  return upcomingModels.filter((model) => {
    const dueAt = model.resolvedState.dueAt;
    return dueAt != null && dueAt >= tomorrowStartIso && dueAt < tomorrowEndIso;
  }).length;
}

function resolveCardBucket(input: {
  asOfIso: string;
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  reviewState: ReviewState | null;
}): ReviewQueueCard["bucket"] {
  if (input.effectiveState === "suspended") {
    return "suspended";
  }

  if (input.effectiveState === "known_manual") {
    return "manual";
  }

  if (
    isReviewCardDue({
      asOfIso: input.asOfIso,
      dueAt: input.dueAt,
      effectiveState: input.effectiveState,
      reviewState: input.reviewState
    })
  ) {
    return "due";
  }

  if (isReviewCardNew(input.reviewState)) {
    return "new";
  }

  return "upcoming";
}

function buildQueueIntroLabel(input: {
  dailyLimit: number;
  dueCount: number;
  manualCount: number;
  newQueuedCount: number;
  sessionTopUpNewCount: number;
  upcomingCount: number;
}) {
  if (input.dueCount > 0 || input.newQueuedCount > 0) {
    const segments = [];

    if (input.dueCount > 0) {
      segments.push(
        input.dueCount === 1
          ? "1 card da ripassare adesso"
          : `${input.dueCount} card da ripassare adesso`
      );
    }

    if (input.newQueuedCount > 0) {
      segments.push(
        input.sessionTopUpNewCount > 0
          ? input.newQueuedCount === 1
            ? "1 nuova è nella rotazione attuale di questa sessione"
            : `${input.newQueuedCount} nuove sono nella rotazione attuale di questa sessione`
          : input.newQueuedCount === 1
            ? "1 nuova prevista nella rotazione di oggi"
            : `${input.newQueuedCount} nuove previste nella rotazione di oggi`
      );
    }

    if (input.manualCount > 0) {
      segments.push(
        input.manualCount === 1
          ? "1 card è esclusa manualmente"
          : `${input.manualCount} card sono escluse manualmente`
      );
    }

    return `${segments.join(". ")}.`;
  }

  if (input.upcomingCount > 0) {
    return input.upcomingCount === 1
      ? "Oggi la coda è in pari. Rimane 1 card già in rotazione."
      : `Oggi la coda è in pari. Rimangono ${input.upcomingCount} card già in rotazione.`;
  }

  if (input.manualCount > 0) {
    return input.manualCount === 1
      ? "La Review di oggi è vuota, ma 1 card è esclusa manualmente."
      : `La Review di oggi è vuota, ma ${input.manualCount} card sono escluse manualmente.`;
  }

  return "La Review di oggi è vuota: il media non ha ancora card attive da mettere in coda.";
}

function buildBucketDetail(
  bucket: ReviewQueueCard["bucket"],
  dueAt: string | null
) {
  if (bucket === "due") {
    return dueAt
      ? `Richiede attenzione oggi. Scadenza ${formatShortIsoDate(dueAt)}.`
      : "Richiede attenzione oggi.";
  }

  if (bucket === "new") {
    return "Pronta per entrare nella coda giornaliera senza perdere il legame con il Glossary.";
  }

  if (bucket === "manual") {
    return "Una voce collegata è stata impostata manualmente come già nota.";
  }

  if (bucket === "suspended") {
    return "La card è stata messa in pausa e non entra nella sessione finché non la riattivi.";
  }

  return dueAt
    ? `Resta in rotazione. Prossima scadenza ${formatShortIsoDate(dueAt)}.`
    : "Resta in rotazione ma oggi non richiede un passaggio.";
}

function formatBucketLabel(
  bucket: ReviewQueueCard["bucket"]
) {

  if (bucket === "due") {
    return "Dovuta";
  }

  if (bucket === "new") {
    return "Nuova";
  }

  if (bucket === "suspended") {
    return "Sospesa";
  }

  if (bucket === "upcoming") {
    return "Da ripassare nei prossimi giorni";
  }

  return "Già nota";
}

function compareEntryLinks(
  left: ReviewEntryLinkLike,
  right: ReviewEntryLinkLike
) {
  const leftRank = getRelationshipRank(left.relationshipType);
  const rightRank = getRelationshipRank(right.relationshipType);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (left.entryType !== right.entryType) {
    return left.entryType.localeCompare(right.entryType);
  }

  return left.entryId.localeCompare(right.entryId);
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

function getRelationshipRank(value: string) {
  const ranks: Record<string, number> = {
    primary: 0,
    secondary: 1,
    context: 2
  };

  return ranks[value] ?? 99;
}

function formatShortIsoDate(value: string) {
  return value.slice(0, 10);
}


function compareReviewCardsByOrder<
  TCard extends Pick<ReviewQueueCard, "createdAt" | "orderIndex">
>(left: TCard, right: TCard) {
  if (
    (left.orderIndex ?? Number.MAX_SAFE_INTEGER) !==
    (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
  ) {
    return (
      (left.orderIndex ?? Number.MAX_SAFE_INTEGER) -
      (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
    );
  }

  return left.createdAt.localeCompare(right.createdAt);
}
