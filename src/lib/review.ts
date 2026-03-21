import {
  countReviewSubjectsIntroducedOnDay,
  db,
  getCardById,
  getCrossMediaFamilyByEntryId,
  getGlossaryEntriesByIds,
  getMediaById,
  listGrammarEntryReviewSummariesByIds,
  listReviewLaunchCandidates,
  getMediaBySlug,
  listGlossaryEntriesByKind,
  listReviewCardsByMediaId,
  listReviewCardsByMediaIds,
  listTermEntryReviewSummariesByIds,
  getReviewSubjectStateByKey,
  type CrossMediaSibling,
  type DatabaseClient,
  type GrammarEntryReviewSummary,
  type GrammarGlossaryEntry,
  type GrammarGlossaryEntrySummary,
  type MediaListItem,
  type ReviewCardListItem,
  type TermEntryReviewSummary,
  type TermGlossaryEntry,
  type TermGlossaryEntrySummary
} from "@/db";
import {
  buildReviewSummaryTags,
  canUseDataCache,
  listMediaCached,
  runWithTaggedCache,
  REVIEW_FIRST_CANDIDATE_TAG
} from "@/lib/data-cache";
import {
  getReviewDailyLimit,
  getReviewFrontFuriganaSetting
} from "@/lib/settings";
import {
  mediaGlossaryEntryHref,
  mediaGlossaryHref,
  mediaHref,
  mediaReviewCardHref,
  mediaStudyHref,
  reviewHref
} from "@/lib/site";
import {
  capitalizeToken,
  formatCardRelationshipLabel,
  formatReviewStateLabel
} from "@/lib/study-format";
import { buildEntryKey } from "@/lib/entry-id";
import { type ReviewProfiler } from "@/lib/review-profiler";
import { stripInlineMarkdown } from "@/lib/render-furigana";
import { loadReviewSubjectStateLookup } from "./review-subject-state-lookup.ts";
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
import {
  buildReviewGradePreviews as buildSharedReviewGradePreviews,
  type ReviewGradePreview,
  type ReviewSeedState
} from "./review-grade-previews";
import { type ReviewState } from "./review-scheduler";

type ReviewCardEntryKind = "term" | "grammar";

type ReviewSearchState = {
  answeredCount: number;
  extraNewCount: number;
  noticeCode: string | null;
  selectedCardId: string | null;
  showAnswer: boolean;
};

function buildReviewSearchStateCacheKeyParts(input: ReviewSearchState) {
  return [
    `answered:${input.answeredCount}`,
    `extra-new:${input.extraNewCount}`,
    `notice:${input.noticeCode ?? ""}`,
    `selected:${input.selectedCardId ?? ""}`,
    `show:${input.showAnswer ? "1" : "0"}`
  ];
}

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

type ReviewScope = "global" | "media";
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

type ReviewFirstCandidateCard = {
  back: string;
  bucket: ReviewQueueCard["bucket"];
  bucketDetail: string;
  bucketLabel: string;
  createdAt: string;
  dueAt: string | null;
  dueLabel?: string;
  effectiveState: EffectiveReviewState["state"];
  effectiveStateLabel: string;
  exampleIt?: string;
  exampleJp?: string;
  front: string;
  href: ReturnType<typeof mediaReviewCardHref>;
  id: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  orderIndex: number | null;
  rawReviewLabel: string;
  reading?: string;
  reviewSeedState: ReviewSeedState;
  segmentTitle?: string;
  typeLabel: string;
};

type ReviewFirstCandidateQueueSnapshot = Pick<
  ReviewPageData["queue"],
  | "dailyLimit"
  | "dueCount"
  | "effectiveDailyLimit"
  | "manualCount"
  | "newAvailableCount"
  | "newQueuedCount"
  | "queueCount"
  | "suspendedCount"
  | "upcomingCount"
> & {
  introLabel: string;
  queueLabel: string;
};

type ReviewFirstCandidateSelectedCardContext = Omit<
  ReviewPageData["selectedCardContext"],
  "gradePreviews"
>;

export type ReviewFirstCandidatePageData = {
  media: ReviewPageData["media"];
  queue: ReviewFirstCandidateQueueSnapshot;
  scope: ReviewScope;
  selectedCard: ReviewFirstCandidateCard | null;
  selectedCardContext: ReviewFirstCandidateSelectedCardContext;
  settings: ReviewPageData["settings"];
  session: ReviewPageData["session"];
};



export type ReviewCardEntrySummary = {
  href: ReturnType<typeof mediaGlossaryEntryHref>;
  id: string;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  relationshipLabel: string;
  statusLabel: string;
  subtitle?: string;
};

export type ReviewCardPronunciation = {
  audio: PronunciationData;
  kind: ReviewCardEntryKind;
  label: string;
  meaning: string;
  relationshipLabel: string;
};

export type ReviewQueueCard = {
  back: string;
  bucket: "due" | "manual" | "new" | "suspended" | "upcoming";
  bucketDetail: string;
  bucketLabel: string;
  contexts: Array<{
    cardId: string;
    front: string;
    mediaSlug: string;
    mediaTitle: string;
    segmentTitle?: string;
  }>;
  createdAt: string;
  dueAt: string | null;
  dueLabel?: string;
  effectiveState: EffectiveReviewState["state"];
  effectiveStateLabel: string;
  exampleIt?: string;
  exampleJp?: string;
  entries: ReviewCardEntrySummary[];
  front: string;
  href: ReturnType<typeof mediaReviewCardHref>;
  id: string;
  mediaSlug: string;
  mediaTitle: string;
  notes?: string;
  orderIndex: number | null;
  pronunciations: ReviewCardPronunciation[];
  rawReviewLabel: string;
  reading?: string;
  gradePreviews: ReviewGradePreview[];
  reviewSeedState: ReviewSeedState;
  segmentTitle?: string;
  typeLabel: string;
};

export type ReviewQueueSnapshot = {
  cards: ReviewQueueCard[];
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  manualCount: number;
  newAvailableCount: number;
  newQueuedCount: number;
  queueLabel: string;
  queueCount: number;
  suspendedCount: number;
  upcomingCount: number;
};

export type ReviewOverviewSnapshot = {
  activeCards: number;
  dailyLimit: number;
  dueCount: number;
  effectiveDailyLimit: number;
  manualCount: number;
  newAvailableCount: number;
  newQueuedCount: number;
  nextCardFront?: string;
  queueCount: number;
  queueLabel: string;
  suspendedCount: number;
  totalCards: number;
  upcomingCount: number;
};

export type ReviewPageData = {
  scope: ReviewScope;
  media: {
    glossaryHref: ReturnType<typeof mediaGlossaryHref>;
    href: ReturnType<typeof mediaHref> | "/";
    reviewHref:
      | ReturnType<typeof mediaStudyHref>
      | ReturnType<typeof reviewHref>;
    slug: string;
    title: string;
  };
  settings: {
    reviewFrontFurigana: boolean;
  };
  queue: ReviewQueueSnapshot & {
    introLabel: string;
    manualCards: ReviewQueueCard[];
    suspendedCards: ReviewQueueCard[];
    upcomingCards: ReviewQueueCard[];
  };
  selectedCard: ReviewQueueCard | null;
  queueCardIds: string[];
  selectedCardContext: {
    bucket: ReviewQueueCard["bucket"] | null;
    gradePreviews: ReviewGradePreview[];
    isQueueCard: boolean;
    position: number | null;
    remainingCount: number;
    showAnswer: boolean;
  };
  session: {
    answeredCount: number;
    extraNewCount: number;
    notice?: string;
  };
};

export type GlobalReviewPageLoadResult =
  | { kind: "empty-media" }
  | { kind: "empty-cards" }
  | { kind: "ready"; data: ReviewPageData };

export type GlobalReviewFirstCandidateLoadResult =
  | { kind: "empty-media" }
  | { kind: "empty-cards" }
  | { kind: "ready"; data: ReviewFirstCandidatePageData };
export type {
  ReviewGradePreview,
  ReviewSeedState
} from "./review-grade-previews";

export type ReviewCardDetailData = {
  card: {
    back: string;
    bucketLabel?: string;
    dueLabel?: string;
    exampleIt?: string;
    exampleJp?: string;
    front: string;
    id: string;
    notes?: string;
    reading?: string;
    reviewLabel: string;
    segmentTitle?: string;
    typeLabel: string;
  };
  crossMedia: Array<{
    entryId: string;
    kind: ReviewCardEntryKind;
    label: string;
    meaning: string;
    relationshipLabel: string;
    siblings: Array<{
      href: ReturnType<typeof mediaGlossaryEntryHref>;
      label: string;
      meaning: string;
      mediaSlug: string;
      mediaTitle: string;
      notes?: string;
      reading?: string;
      subtitle?: string;
    }>;
  }>;
  entries: ReviewCardEntrySummary[];
  pronunciations: ReviewCardPronunciation[];
  media: {
    glossaryHref: ReturnType<typeof mediaGlossaryHref>;
    href: ReturnType<typeof mediaHref>;
    reviewHref: ReturnType<typeof mediaStudyHref>;
    slug: string;
    title: string;
  };
};

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

type ReviewPageLoadOptions = {
  bypassCache?: boolean;
  profiler?: ReviewProfiler | null;
};

async function buildReviewPageDataFromWorkspace(input: {
  cards: ReviewCardListItem[];
  dailyLimit: number;
  database: DatabaseClient;
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
  const queueSnapshot = input.profiler
    ? await input.profiler.measure(
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
      )
    : buildReviewQueueSubjectSnapshot({
        cards: input.cards,
        dailyLimit: input.dailyLimit,
        entryLookup: input.entryLookup,
        extraNewCount: input.searchState.extraNewCount,
        newIntroducedTodayCount: input.newIntroducedTodayCount,
        nowIso,
        subjectGroups: input.subjectGroups,
        visibleMediaId: input.visibleMediaId
      });
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
  const queueCardIds = queueSnapshot.queueModels.map(
    (model) => model.card.id
  );
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
          pronunciations: await (input.profiler
            ? input.profiler.measure(
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
            : loadReviewCardPronunciations({
                card: selectedRawCard,
                database: input.database,
                entryLookup: input.entryLookup
              }))
        }
      : selectedCardBase;
  const selectedGradePreviews = selectedCard
    ? buildReviewGradePreviews(selectedCard.reviewSeedState, input.now)
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
      notice: resolveReviewNotice(input.searchState.noticeCode)
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
      input.resolvedState.effectiveState
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
  const queueSnapshot = input.profiler
    ? await input.profiler.measure(
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
      )
    : buildReviewQueueSubjectSnapshot({
        cards: input.cards,
        dailyLimit: input.dailyLimit,
        entryLookup: input.entryLookup,
        extraNewCount: input.searchState.extraNewCount,
        newIntroducedTodayCount: input.newIntroducedTodayCount,
        nowIso,
        subjectGroups: input.subjectGroups,
        visibleMediaId: input.visibleMediaId
      });
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

  input.profiler?.addMeta({
    selectedCardId: selectedCard?.id ?? null
  });

  return {
    media: input.media,
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
      notice: resolveReviewNotice(input.searchState.noticeCode)
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
    input.profiler
      ? input.profiler.measure("listTermEntryReviewSummariesByIds", () =>
          listTermEntryReviewSummariesByIds(input.database, termIds)
        )
      : listTermEntryReviewSummariesByIds(input.database, termIds),
    input.profiler
      ? input.profiler.measure("listGrammarEntryReviewSummariesByIds", () =>
          listGrammarEntryReviewSummariesByIds(input.database, grammarIds)
        )
      : listGrammarEntryReviewSummariesByIds(input.database, grammarIds)
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
    ? input.profiler
      ? input.profiler.measure("listReviewCardsByMediaIds", () =>
          listReviewCardsByMediaIds(input.database, input.mediaIds)
        )
      : listReviewCardsByMediaIds(input.database, input.mediaIds)
    : Promise.resolve([]));
  const eligibleCards = input.profiler
    ? await input.profiler.measure(
        "buildEligibleReviewCardsByMedia",
        () =>
          buildEligibleReviewCardsByMedia({
            cards: reviewCards,
            mediaIds: input.mediaIds
          }),
        (value) => ({
          mediaBuckets: value.size
        })
      )
    : buildEligibleReviewCardsByMedia({
        cards: reviewCards,
        mediaIds: input.mediaIds
      });
  const cards = [...eligibleCards.values()].flat();

  if (cards.length === 0) {
    return {
      cards,
      grammar: [],
      rawCardCount: reviewCards.length,
      terms: []
    };
  }

  const { terms, grammar } = await (input.profiler
    ? input.profiler.measure(
        "loadReviewEntrySummariesForCards",
        () =>
          loadReviewEntrySummariesForCards({
            cards,
            database: input.database,
            profiler: input.profiler
          }),
        {
          cards: cards.length
        }
      )
    : loadReviewEntrySummariesForCards({
        cards,
        database: input.database
      }));

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

  return input.profiler
    ? input.profiler.measure(
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
        {
          cacheEligible,
          mediaIds: orderedMediaIds.length
        }
      )
    : runWithTaggedCache({
        enabled: cacheEligible,
        keyParts: [
          "review",
          "stable-workspace",
          ...orderedMediaIds.map((mediaId) => `media:${mediaId}`)
        ],
        loader: () => loadStableReviewWorkspaceV2(input),
        tags: buildReviewSummaryTags(orderedMediaIds)
      });
}

async function loadReviewWorkspaceV2(input: {
  bypassCache?: boolean;
  database?: DatabaseClient;
  mediaIds: string[];
  now?: Date;
  profiler?: ReviewProfiler | null;
}): Promise<LoadedReviewWorkspaceV2> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const [stableWorkspace, dailyLimit, newIntroducedTodayCount] =
    await Promise.all([
      input.profiler
        ? input.profiler.measure("loadStableReviewWorkspaceV2", () =>
            loadStableReviewWorkspaceV2Cached({
              bypassCache: input.bypassCache,
              database,
              mediaIds: input.mediaIds,
              profiler: input.profiler
            })
          )
        : loadStableReviewWorkspaceV2Cached({
            bypassCache: input.bypassCache,
            database,
            mediaIds: input.mediaIds
          }),
      input.profiler
        ? input.profiler.measure("getReviewDailyLimit", () =>
            getReviewDailyLimit(database)
          )
        : getReviewDailyLimit(database),
      input.profiler
        ? input.profiler.measure("countReviewSubjectsIntroducedOnDay", () =>
            countReviewSubjectsIntroducedOnDay(database, now)
          )
        : countReviewSubjectsIntroducedOnDay(database, now)
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

  const { subjectGroups } = await (input.profiler
    ? input.profiler.measure(
        "loadReviewSubjectStateLookup",
        () =>
          loadReviewSubjectStateLookup({
            cards,
            database,
            grammar: stableWorkspace.grammar,
            nowIso: now.toISOString(),
            terms: stableWorkspace.terms
          }),
        (value) => ({
          subjectGroups: value.subjectGroups.length
        })
      )
    : loadReviewSubjectStateLookup({
        cards,
        database,
        grammar: stableWorkspace.grammar,
        nowIso: now.toISOString(),
        terms: stableWorkspace.terms
      }));

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

  const media = await (options.profiler
    ? options.profiler.measure("getMediaBySlug", () =>
        getMediaBySlug(database, mediaSlug)
      )
    : getMediaBySlug(database, mediaSlug));

  if (!media) {
    return null;
  }

  const searchState = normalizeReviewSearchState(searchParams);
  const [workspace, reviewFrontFurigana] = await Promise.all([
    options.profiler
      ? options.profiler.measure("loadReviewWorkspaceV2", () =>
          loadReviewWorkspaceV2({
            bypassCache: options.bypassCache,
            database,
            mediaIds: [media.id],
            now,
            profiler: options.profiler
          })
        )
      : loadReviewWorkspaceV2({
          bypassCache: options.bypassCache,
          database,
          mediaIds: [media.id],
          now
        }),
    options.profiler
      ? options.profiler.measure("getReviewFrontFuriganaSetting", () =>
          getReviewFrontFuriganaSetting(database)
        )
      : getReviewFrontFuriganaSetting(database)
  ]);

  return options.profiler
    ? options.profiler.measure("buildReviewPageDataFromWorkspace", () =>
        buildReviewPageDataFromWorkspace({
          cards: workspace.cards,
          dailyLimit: workspace.dailyLimit,
          database,
          entryLookup: workspace.entryLookup,
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
      )
    : buildReviewPageDataFromWorkspace({
        cards: workspace.cards,
        dailyLimit: workspace.dailyLimit,
        database,
        entryLookup: workspace.entryLookup,
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
        reviewFrontFurigana,
        scope: "media",
        searchState,
        subjectGroups: workspace.subjectGroups,
        visibleMediaId: media.id
      });
}

async function loadGlobalReviewWorkspace(
  searchParams: Record<string, string | string[] | undefined>,
  database: DatabaseClient = db,
  options: ReviewPageLoadOptions = {}
): Promise<Omit<LoadedGlobalReviewPageWorkspace, "reviewFrontFurigana">> {
  const now = new Date();
  const mediaRows = await (options.profiler
    ? options.profiler.measure("listMediaCached", () =>
        listMediaCached(database)
      )
    : listMediaCached(database));
  const searchState = normalizeReviewSearchState(searchParams);
  const workspace = await (options.profiler
    ? options.profiler.measure("loadReviewWorkspaceV2", () =>
        loadReviewWorkspaceV2({
          bypassCache: options.bypassCache,
          database,
          mediaIds: mediaRows.map((item) => item.id),
          now,
          profiler: options.profiler
        })
      )
    : loadReviewWorkspaceV2({
        bypassCache: options.bypassCache,
        database,
        mediaIds: mediaRows.map((item) => item.id),
        now
      }));

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
  const [workspace, reviewFrontFurigana] = await Promise.all([
    loadGlobalReviewWorkspace(searchParams, database, options),
    options.profiler
      ? options.profiler.measure("getReviewFrontFuriganaSetting", () =>
          getReviewFrontFuriganaSetting(database)
        )
      : getReviewFrontFuriganaSetting(database)
  ]);

  return {
    ...workspace,
    reviewFrontFurigana
  };
}

async function buildGlobalReviewPageData(
  input: LoadedGlobalReviewPageWorkspace,
  database: DatabaseClient = db,
  profiler?: ReviewProfiler | null
) {
  return profiler
    ? profiler.measure("buildReviewPageDataFromWorkspace", () =>
        buildReviewPageDataFromWorkspace({
          cards: input.cards,
          dailyLimit: input.dailyLimit,
          database,
          entryLookup: input.entryLookup,
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
      )
    : buildReviewPageDataFromWorkspace({
        cards: input.cards,
        dailyLimit: input.dailyLimit,
        database,
        entryLookup: input.entryLookup,
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
        reviewFrontFurigana: input.reviewFrontFurigana,
        scope: "global",
        searchState: input.searchState,
        subjectGroups: input.subjectGroups
      });
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
    data: await buildGlobalReviewPageData(workspace, database, options.profiler)
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
    const [workspace, reviewFrontFurigana] = await Promise.all([
      loadGlobalReviewWorkspace(searchParams, database, options),
      options.profiler
        ? options.profiler.measure("getReviewFrontFuriganaSetting", () =>
            getReviewFrontFuriganaSetting(database)
          )
        : getReviewFrontFuriganaSetting(database)
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
        reviewFrontFurigana,
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

  return options.profiler
    ? options.profiler.measure(
        "getGlobalReviewFirstCandidateLoadResult",
        loadWithCache,
        {
          cacheEligible,
          searchState: cacheKeyParts.join("|")
        }
      )
    : loadWithCache();
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

  return buildGlobalReviewPageData(workspace, database, options.profiler);
}

export async function getReviewQueueSnapshotForMedia(
  mediaSlug: string,
  database: DatabaseClient = db
): Promise<ReviewQueueSnapshot | null> {
  const now = new Date();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds: [media.id],
    now
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
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const card = await (input.profiler
    ? input.profiler.measure("getCardById", () =>
        getCardById(database, input.cardId)
      )
    : getCardById(database, input.cardId));

  if (!card || card.status === "archived") {
    return null;
  }

  if (!hasCompletedReviewLesson(card)) {
    return null;
  }

  const termIds = new Set<string>();
  const grammarIds = new Set<string>();

  for (const link of card.entryLinks) {
    if (link.entryType === "term") {
      termIds.add(link.entryId);
      continue;
    }

    grammarIds.add(link.entryId);
  }

  const [terms, grammar] = await Promise.all([
    input.profiler
      ? input.profiler.measure("getGlossaryEntriesByIds.term", () =>
          getGlossaryEntriesByIds(database, "term", [...termIds])
        )
      : getGlossaryEntriesByIds(database, "term", [...termIds]),
    input.profiler
      ? input.profiler.measure("getGlossaryEntriesByIds.grammar", () =>
          getGlossaryEntriesByIds(database, "grammar", [...grammarIds])
        )
      : getGlossaryEntriesByIds(database, "grammar", [...grammarIds])
  ]);
  const entryLookup = buildEntryLookup(terms, grammar);
  const subjectIdentity = deriveReviewSubjectIdentity({
    cardId: card.id,
    cardType: card.cardType,
    front: card.front,
    entryLinks: card.entryLinks,
    entryLookup: buildReviewSubjectEntryLookup({
      grammar,
      terms
    })
  });
  const subjectState = await (input.profiler
    ? input.profiler.measure("getReviewSubjectStateByKey", () =>
        getReviewSubjectStateByKey(database, subjectIdentity.subjectKey)
      )
    : getReviewSubjectStateByKey(database, subjectIdentity.subjectKey));
  const resolvedState = resolveReviewQueueState(
    card.status,
    subjectState,
    nowIso
  );
  const mediaById = buildSingleMediaLookup({
    id: card.mediaId,
    ...(await (input.profiler
      ? input.profiler.measure("resolveHydratedReviewCardMedia", () =>
          resolveHydratedReviewCardMedia({
            card,
            database,
            grammar,
            terms
          })
        )
      : resolveHydratedReviewCardMedia({
          card,
          database,
          grammar,
          terms
        })))
  });
  const queueCard = input.profiler
    ? await input.profiler.measure(
        "mapQueueCard",
        () =>
          mapQueueCard(
            card,
            entryLookup,
            [card],
            mediaById,
            nowIso,
            resolvedState
          ),
        {
          cardId: card.id
        }
      )
    : mapQueueCard(
        card,
        entryLookup,
        [card],
        mediaById,
        nowIso,
        resolvedState
      );

  return {
    ...queueCard,
    gradePreviews: buildReviewGradePreviews(resolvedState.reviewSeedState, now),
    pronunciations: buildReviewCardPronunciations(card, entryLookup)
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

export async function getReviewLaunchMedia(
  database: DatabaseClient = db
): Promise<{
  slug: string;
  title: string;
} | null> {
  const candidates = await listReviewLaunchCandidates(database);

  return (
    [...candidates].sort((left, right) => {
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
    })[0] ?? null
  );
}

export async function getReviewCardDetailData(
  mediaSlug: string,
  cardId: string,
  database: DatabaseClient = db
): Promise<ReviewCardDetailData | null> {
  const nowIso = new Date().toISOString();

  const media = await getMediaBySlug(database, mediaSlug);

  if (!media) {
    return null;
  }

  const [cards, terms, grammar] = await Promise.all([
    getEligibleReviewCardsByMediaId(media.id, database),
    listGlossaryEntriesByKind(database, "term", { mediaId: media.id }),
    listGlossaryEntriesByKind(database, "grammar", { mediaId: media.id })
  ]);
  const entryLookup = buildEntryLookup(terms, grammar);
  const selectedRawCard = cards.find((card) => card.id === cardId) ?? null;

  if (!selectedRawCard) {
    return null;
  }

  const subjectIdentity = deriveReviewSubjectIdentity({
    cardId: selectedRawCard.id,
    cardType: selectedRawCard.cardType,
    front: selectedRawCard.front,
    entryLinks: selectedRawCard.entryLinks,
    entryLookup: buildReviewSubjectEntryLookup({
      grammar,
      terms
    })
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
  const crossMedia = await Promise.all(
    getDrivingEntryLinks(selectedRawCard.entryLinks).map(async (link) => {
      const localEntry =
        link.entryType === "term"
          ? termById.get(link.entryId)
          : grammarById.get(link.entryId);

      if (!localEntry) {
        return null;
      }

      const family =
        link.entryType === "term"
          ? await getCrossMediaFamilyByEntryId(database, "term", link.entryId)
          : await getCrossMediaFamilyByEntryId(
              database,
              "grammar",
              link.entryId
            );

      if (family.siblings.length === 0) {
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
    })
  );
  const pronunciations = buildReviewCardPronunciations(
    selectedRawCard,
    entryLookup
  );

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
    pronunciations,
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
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds,
    now
  });
  const snapshots = new Map<string, ReviewOverviewSnapshot>();

  const nowIso = workspace.now.toISOString();
  const subjectModels = buildReviewSubjectModels({
    cards: workspace.cards,
    entryLookup: new Map(),
    nowIso,
    subjectGroups: workspace.subjectGroups
  });

  for (const item of media) {
    snapshots.set(
      item.id,
      buildReviewOverviewSnapshot({
        cards: workspace.cards,
        dailyLimit: workspace.dailyLimit,
        entryLookup: new Map(),
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

export async function loadGlobalReviewOverviewSnapshot(
  database: DatabaseClient = db
) {
  const media = await listMediaCached(database);

  if (media.length === 0) {
    return buildReviewOverviewSnapshot({
      cards: [],
      dailyLimit: 0,
      entryLookup: new Map(),
      extraNewCount: 0,
      newIntroducedTodayCount: 0,
      nowIso: new Date().toISOString(),
      subjectStates: new Map()
    });
  }

  const now = new Date();
  const workspace = await loadReviewWorkspaceV2({
    database,
    mediaIds: media.map((item) => item.id),
    now
  });

  return buildReviewOverviewSnapshot({
    cards: workspace.cards,
    dailyLimit: workspace.dailyLimit,
    entryLookup: new Map(),
    extraNewCount: 0,
    newIntroducedTodayCount: workspace.newIntroducedTodayCount,
    nowIso: workspace.now.toISOString(),
    subjectGroups: workspace.subjectGroups
  });
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

function filterReviewSubjectModelsByMedia<
  T extends { group: ReviewSubjectGroup }
>(models: T[], visibleMediaId?: string) {
  return models.filter((model) =>
    isReviewSubjectVisibleInMedia(model.group, visibleMediaId)
  );
}

function getReviewBucketPriority(bucket: ReviewQueueCard["bucket"]) {
  const priorities: Record<ReviewQueueCard["bucket"], number> = {
    due: 0,
    new: 1,
    upcoming: 2,
    manual: 3,
    suspended: 4
  };

  return priorities[bucket];
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

function selectReviewSubjectModel(input: {
  group: ReviewSubjectGroup;
  nowIso: string;
  preferredMediaId?: string;
}) {
  const preferredCards = input.preferredMediaId
    ? input.group.cards.filter((card) => card.mediaId === input.preferredMediaId)
    : [];
  const candidatePool = preferredCards.length > 0 ? preferredCards : input.group.cards;
  const selectedCard =
    candidatePool === input.group.cards
      ? input.group.representativeCard
      : selectReviewSubjectRepresentativeCard(
          candidatePool,
          input.group.subjectState,
          input.nowIso
        );

  return {
    card: selectedCard,
    state: resolveReviewQueueState(
      selectedCard.status,
      input.group.subjectState,
      input.nowIso
    )
  };
}

function buildReviewSubjectModels(input: {
  cards: ReviewCardListItem[];
  entryLookup: Map<string, ReviewEntryLookupItem> | Map<string, ReviewSubjectEntryMeta>;
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
    const { card, state: resolvedState } = selectReviewSubjectModel({
      group,
      nowIso: input.nowIso,
      preferredMediaId: input.preferredMediaId
    });

    return {
      card,
      group,
      resolvedState
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
  subjectStates?: Map<string, ReviewSubjectStateSnapshot>;
  visibleMediaId?: string;
}): ReviewOverviewSnapshot {
  const models = input.subjectModels ?? buildReviewSubjectModels({
    cards: input.cards,
    entryLookup: input.entryLookup,
    nowIso: input.nowIso,
    subjectGroups: input.subjectGroups,
    subjectStates: input.subjectStates
  });
  const relevantModels = filterReviewSubjectModelsByMedia(
    models,
    input.visibleMediaId
  );
  
  const toOverviewCard = (model: ReviewSubjectModel): ReviewOverviewCard => ({
    bucket: model.resolvedState.bucket,
    createdAt: model.card.createdAt,
    dueAt: model.resolvedState.dueAt,
    front: model.card.front,
    id: model.card.id,
    orderIndex: model.card.orderIndex
  });

  const dueCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "due")
    .sort(compareReviewSubjectModelsByDue)
    .map(toOverviewCard);
  const globalNewCards = models
    .filter((model) => model.resolvedState.bucket === "new")
    .sort(compareReviewSubjectModelsByOrder);
  const newCards = globalNewCards
    .filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
    )
    .map(toOverviewCard);
  const manualCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "manual")
    .sort(compareReviewSubjectModelsByOrder)
    .map(toOverviewCard);
  const suspendedCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "suspended")
    .sort(compareReviewSubjectModelsByOrder)
    .map(toOverviewCard);
  const upcomingCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "upcoming")
    .sort(compareReviewSubjectModelsByDue)
    .map(toOverviewCard);
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewCards = globalNewCards
    .slice(0, newSlots)
    .filter((model) =>
      isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
    )
    .map(toOverviewCard);
  const queueCards = [...dueCards, ...queuedNewCards];
  const queueLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: dueCards.length,
    manualCount: manualCards.length,
    newQueuedCount: queuedNewCards.length,
    upcomingCount: upcomingCards.length
  });
  const activeCards = dueCards.length + upcomingCards.length;

  return {
    activeCards,
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
    effectiveDailyLimit,
    manualCount: manualCards.length,
    newAvailableCount: newCards.length,
    newQueuedCount: queuedNewCards.length,
    nextCardFront: queueCards[0]?.front
      ? stripInlineMarkdown(queueCards[0].front)
      : undefined,
    queueCount: queueCards.length,
    queueLabel,
    suspendedCount: suspendedCards.length,
    totalCards: relevantModels.length,
    upcomingCount: upcomingCards.length
  };
}

type ReviewOverviewCard = Pick<
  ReviewQueueCard,
  "bucket" | "createdAt" | "dueAt" | "front" | "id" | "orderIndex"
>;



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

function groupCardsByMedia(cards: ReviewCardListItem[]) {
  const grouped = new Map<string, ReviewCardListItem[]>();

  for (const card of cards) {
    const existing = grouped.get(card.mediaId);

    if (existing) {
      existing.push(card);
      continue;
    }

    grouped.set(card.mediaId, [card]);
  }

  return grouped;
}

function buildEligibleReviewCardsByMedia(input: {
  cards: ReviewCardListItem[];
  mediaIds: string[];
}) {
  const cardsByMedia = groupCardsByMedia(input.cards);
  const eligibleCards = new Map<string, ReviewCardListItem[]>();

  for (const mediaId of input.mediaIds) {
    eligibleCards.set(
      mediaId,
      (cardsByMedia.get(mediaId) ?? []).filter((card) =>
        hasCompletedReviewLesson(card)
      )
    );
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
  entryLookup: Map<string, ReviewEntryLookupItem>
): ReviewCardPronunciation[] {
  if (!canExposeReviewEntryMedia(card, entryLookup)) {
    return [];
  }

  return getDrivingEntryLinks(card.entryLinks)
    .slice()
    .sort(compareEntryLinks)
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
  extraNewCount: number;
  newIntroducedTodayCount: number;
  nowIso: string;
  subjectGroups: ReviewSubjectGroup[];
  visibleMediaId?: string;
}): ReviewQueueSubjectSnapshot {
  const subjectModels = buildReviewSubjectModels({
    cards: input.cards,
    entryLookup: input.entryLookup,
    nowIso: input.nowIso,
    preferredMediaId: input.visibleMediaId,
    subjectGroups: input.subjectGroups
  });
  const relevantModels = filterReviewSubjectModelsByMedia(
    subjectModels,
    input.visibleMediaId
  );
  const dueCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "due")
    .sort(compareReviewSubjectModelsByDue);
  const globalNewCards = subjectModels
    .filter((model) => model.resolvedState.bucket === "new")
    .sort(compareReviewSubjectModelsByOrder);
  const newCards = globalNewCards.filter((model) =>
    isReviewSubjectVisibleInMedia(model.group, input.visibleMediaId)
  );
  const manualCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "manual")
    .sort(compareReviewSubjectModelsByOrder);
  const suspendedCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "suspended")
    .sort(compareReviewSubjectModelsByOrder);
  const upcomingCards = relevantModels
    .filter((model) => model.resolvedState.bucket === "upcoming")
    .sort(compareReviewSubjectModelsByDue);
  const effectiveDailyLimit = input.dailyLimit + input.extraNewCount;
  const newSlots = Math.max(
    effectiveDailyLimit - input.newIntroducedTodayCount,
    0
  );
  const queuedNewCards = newCards.slice(0, newSlots);
  const queueModels = [...dueCards, ...queuedNewCards];
  const introLabel = buildQueueIntroLabel({
    dailyLimit: effectiveDailyLimit,
    dueCount: dueCards.length,
    manualCount: manualCards.length,
    newQueuedCount: queuedNewCards.length,
    upcomingCount: upcomingCards.length
  });

  return {
    dailyLimit: input.dailyLimit,
    dueCount: dueCards.length,
    effectiveDailyLimit,
    introLabel,
    manualCount: manualCards.length,
    manualModels: manualCards,
    newAvailableCount: newCards.length,
    newQueuedCount: queuedNewCards.length,
    queueCount: queueModels.length,
    queueModels,
    subjectModels,
    suspendedCount: suspendedCards.length,
    suspendedModels: suspendedCards,
    upcomingCount: upcomingCards.length,
    upcomingModels: upcomingCards
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

async function resolveHydratedReviewCardMedia(input: {
  card: Pick<ReviewCardListItem, "mediaId">;
  database: DatabaseClient;
  grammar: GrammarGlossaryEntry[];
  terms: TermGlossaryEntry[];
}) {
  for (const entry of input.terms) {
    if (entry.mediaId === input.card.mediaId) {
      return {
        slug: entry.media.slug,
        title: entry.media.title
      };
    }
  }

  for (const entry of input.grammar) {
    if (entry.mediaId === input.card.mediaId) {
      return {
        slug: entry.media.slug,
        title: entry.media.title
      };
    }
  }

  const media = await getMediaById(input.database, input.card.mediaId);

  if (media) {
    return {
      slug: media.slug,
      title: media.title
    };
  }

  return {
    slug: "unknown-media",
    title: "Media"
  };
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
  const entries = card.entryLinks
    .slice()
    .sort(compareEntryLinks)
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
    resolvedState ??
    resolveReviewQueueState(
      card.status,
      null,
      nowIso
    );
  const pronunciations = buildReviewCardPronunciations(card, entryLookup);
  const reading = resolveReviewCardReading(card, entryLookup);

  return {
    back: card.back,
    bucket: resolved.bucket,
    bucketDetail: buildBucketDetail(resolved.bucket, resolved.dueAt),
    bucketLabel: formatBucketLabel(resolved.bucket, resolved.effectiveState),
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
  entryLookup: Map<string, ReviewEntryLookupItem>
) {
  if (!canExposeReviewEntryMedia(card, entryLookup)) {
    return undefined;
  }

  const drivingLinks = getDrivingEntryLinks(card.entryLinks)
    .slice()
    .sort(compareEntryLinks);

  for (const link of drivingLinks) {
    const reading = entryLookup.get(
      buildEntryKey(link.entryType, link.entryId)
    )?.reading;

    if (reading) {
      return reading;
    }
  }

  for (const link of card.entryLinks.slice().sort(compareEntryLinks)) {
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
  entryLookup: Map<string, ReviewEntryLookupItem>
) {
  const drivingLinks = getDrivingEntryLinks(card.entryLinks);
  const hasPrimaryLink = card.entryLinks.some(
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
        input.newQueuedCount === 1
          ? `1 nuova prevista entro il limite giornaliero di ${input.dailyLimit}`
          : `${input.newQueuedCount} nuove previste entro il limite giornaliero di ${input.dailyLimit}`
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
  bucket: ReviewQueueCard["bucket"],
  effectiveState: EffectiveReviewState["state"]
) {
  void effectiveState;

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

function normalizeReviewSearchState(
  searchParams: Record<string, string | string[] | undefined>
): ReviewSearchState {
  const answeredCount = Number.parseInt(
    readSearchParam(searchParams, "answered"),
    10
  );
  const extraNewCount = Number.parseInt(
    readSearchParam(searchParams, "extraNew"),
    10
  );

  return {
    answeredCount:
      Number.isFinite(answeredCount) && answeredCount > 0 ? answeredCount : 0,
    extraNewCount:
      Number.isFinite(extraNewCount) && extraNewCount > 0 ? extraNewCount : 0,
    noticeCode: readSearchParam(searchParams, "notice") || null,
    selectedCardId: readSearchParam(searchParams, "card") || null,
    showAnswer: readSearchParam(searchParams, "show") === "answer"
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

function buildReviewGradePreviews(
  reviewSeedState: ReviewQueueCard["reviewSeedState"],
  now: Date
): ReviewGradePreview[] {
  return buildSharedReviewGradePreviews(reviewSeedState, now);
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
function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}
