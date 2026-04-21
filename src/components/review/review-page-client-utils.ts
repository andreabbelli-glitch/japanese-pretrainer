import type { ReviewPageData } from "@/lib/review-types";

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

export function buildReviewSessionActionInput(
  viewData: ReviewPageData,
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>,
  gradedCardIds: string[],
  redirectMode: {
    answeredCount: number;
    cardId: string;
    cardMediaSlug?: string;
    extraNewCount: number;
    gradedCardIds?: string[];
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
    extraNewCount: viewData.session.extraNewCount,
    gradedCardIds,
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
