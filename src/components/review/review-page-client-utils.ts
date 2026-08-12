import type { ReviewPageData } from "@/features/review/client";
import { normalizeReviewSearchState } from "@/features/review/model/search-state";
import { readFirstNonEmptySearchParam } from "@/features/shared/model/search-params";

import {
  getInitiallyRevealedCardId,
  mergeReviewPageData,
  resolveReviewGradePreviews,
  shouldAdoptServerFirstCandidateData,
  shouldKeepRevealedReviewAnswer,
  type ReviewPageClientData
} from "./review-page-state";

export function buildReviewGradePreviewLookup(input: {
  data: ReviewPageClientData;
  fullSelectedCardContext: ReviewPageData["selectedCardContext"] | null;
  now?: Date;
}) {
  const gradePreviews = resolveReviewGradePreviews({
    selectedCard: input.data.selectedCard,
    selectedCardContext:
      input.fullSelectedCardContext ?? input.data.selectedCardContext,
    now: input.now
  });

  if (gradePreviews.length > 0) {
    return new Map<string, string>(
      gradePreviews.map((preview) => [preview.rating, preview.nextReviewLabel])
    );
  }

  return new Map<string, string>();
}

export function buildSuccessfulHydrationResult(
  currentData: ReviewPageClientData,
  nextData: ReviewPageData
) {
  return {
    clientError: null as string | null,
    queueCardIds: nextData.queueCardIds,
    viewData: mergeReviewPageData(currentData, nextData)
  };
}

export function resolveHydratedFirstCandidateRevealedCardId(input: {
  currentData: ReviewPageClientData;
  nextData: Parameters<
    typeof shouldAdoptServerFirstCandidateData
  >[0]["nextData"];
}) {
  const preserveRevealedAnswer = shouldKeepRevealedReviewAnswer({
    currentCardId: input.currentData.selectedCard?.id ?? null,
    currentShowAnswer: input.currentData.selectedCardContext.showAnswer,
    nextCardId: input.nextData.selectedCard?.id ?? null,
    nextShowAnswer: input.nextData.selectedCardContext.showAnswer
  });

  if (
    preserveRevealedAnswer &&
    input.currentData.selectedCard?.id === input.nextData.selectedCard?.id
  ) {
    return input.currentData.selectedCard?.id ?? null;
  }

  return getInitiallyRevealedCardId(input.nextData);
}

export function isReviewFirstCandidateDataConsistentWithSearchParams(input: {
  data: Parameters<typeof shouldAdoptServerFirstCandidateData>[0]["nextData"];
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (input.data.scope !== "global") {
    return true;
  }

  const searchState = normalizeReviewSearchState(input.searchParams);
  const dataExtraNewAnchorCount =
    input.data.session.extraNewCount > 0
      ? (input.data.session.extraNewAnchorCount ?? null)
      : null;
  const expectedShowAnswer =
    searchState.showAnswer || !input.data.selectedCardContext.isQueueCard;

  return (
    input.data.session.answeredCount === searchState.answeredCount &&
    input.data.session.extraNewCount === searchState.extraNewCount &&
    dataExtraNewAnchorCount === searchState.extraNewAnchorCount &&
    (input.data.session.segmentId ?? null) === searchState.segmentId &&
    (input.data.mode ?? "review") === searchState.mode &&
    isReviewFirstCandidateSelectionConsistent({
      data: input.data,
      requestedCardId: searchState.selectedCardId
    }) &&
    input.data.selectedCardContext.showAnswer === expectedShowAnswer
  );
}

function isReviewFirstCandidateSelectionConsistent(input: {
  data: Parameters<typeof shouldAdoptServerFirstCandidateData>[0]["nextData"];
  requestedCardId: string | null;
}) {
  if (input.data.selectedCard?.id === input.requestedCardId) {
    return true;
  }

  const canonicalFirstCardId = input.data.queueCardIds[0] ?? null;

  if (input.requestedCardId === null) {
    return isCanonicalFirstCandidateSelection(input.data, canonicalFirstCardId);
  }

  const resolution = input.data.requestedCardResolution;

  if (
    !resolution ||
    resolution.requestedCardId !== input.requestedCardId ||
    resolution.resolved
  ) {
    return false;
  }

  return isCanonicalFirstCandidateSelection(input.data, canonicalFirstCardId);
}

function isCanonicalFirstCandidateSelection(
  data: Parameters<typeof shouldAdoptServerFirstCandidateData>[0]["nextData"],
  canonicalFirstCardId: string | null
) {
  if (canonicalFirstCardId === null) {
    return (
      data.selectedCard === null &&
      !data.selectedCardContext.isQueueCard &&
      data.selectedCardContext.position === null
    );
  }

  return (
    data.selectedCard?.id === canonicalFirstCardId &&
    data.selectedCardContext.isQueueCard &&
    data.selectedCardContext.position === 1
  );
}

export function buildReviewSessionActionInput(
  viewData: ReviewPageData,
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>,
  redirectMode: {
    answeredCount: number;
    cardId: string;
    cardMediaSlug?: string;
    extraNewCount: number;
    mediaSlug?: string;
    redirectMode: "advance_queue" | "preserve_card";
    segmentId?: string | null;
    scope?: "global" | "media";
  }["redirectMode"]
) {
  return {
    answeredCount: viewData.session.answeredCount,
    cardId: selectedCard.id,
    cardMediaSlug: selectedCard.mediaSlug,
    extraNewAnchorCount: viewData.session.extraNewAnchorCount ?? null,
    extraNewCount: viewData.session.extraNewCount,
    mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
    redirectMode,
    segmentId: viewData.session.segmentId,
    sessionMedia: viewData.scope === "media" ? viewData.media : undefined,
    scope: viewData.scope
  };
}

export function buildSearchParamsRecord(
  searchParams: {
    getAll: (key: string) => string[];
    keys: () => IterableIterator<string>;
    size: number;
  },
  fallback?: Record<string, string | string[] | undefined>
) {
  if (searchParams.size === 0) {
    return fallback;
  }

  const record: Record<string, string | string[] | undefined> = {};

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams
      .getAll(key)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (values.length === 0) {
      continue;
    }

    record[key] = values.length <= 1 ? values[0] : values;
  }

  return Object.keys(record).length > 0 ? record : fallback;
}

export function resolveRequestedSelectedReviewCardId(input: {
  isGlobalReview: boolean;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (!input.isGlobalReview) {
    return null;
  }

  return readFirstNonEmptySearchParam(input.searchParams?.card) ?? null;
}
