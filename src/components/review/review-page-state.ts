import { buildReviewGradePreviews } from "@/lib/review-grade-previews";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";
import type {
  ReviewFirstCandidatePageData,
  ReviewPageData
} from "@/lib/review-types";

export type ReviewPageClientData =
  | ReviewPageData
  | ReviewFirstCandidatePageData;

export type ReviewForcedContrastSelection = Pick<
  GlobalGlossaryAutocompleteSuggestion,
  "kind" | "label" | "meaning" | "reading" | "resultKey" | "romaji" | "title"
>;

export function toReviewForcedContrastSelection(
  suggestion: GlobalGlossaryAutocompleteSuggestion
): ReviewForcedContrastSelection {
  return {
    kind: suggestion.kind,
    label: suggestion.label,
    meaning: suggestion.meaning,
    reading: suggestion.reading,
    resultKey: suggestion.resultKey,
    romaji: suggestion.romaji,
    title: suggestion.title
  };
}

export function resolveReviewGradePreviews(input: {
  selectedCard: ReviewPageClientData["selectedCard"];
  selectedCardContext: ReviewPageClientData["selectedCardContext"];
  now?: Date;
}) {
  const gradePreviews =
    "gradePreviews" in input.selectedCardContext
      ? input.selectedCardContext.gradePreviews
      : [];

  if (gradePreviews.length > 0) {
    return gradePreviews;
  }

  if (!input.selectedCard || !input.selectedCardContext.isQueueCard) {
    return [];
  }

  return buildReviewGradePreviews(
    input.selectedCard.reviewSeedState,
    input.now ?? new Date()
  );
}

export function mergeReviewPageData(
  currentData: ReviewPageClientData,
  nextData: ReviewPageData
): ReviewPageData {
  const showAnswer = shouldKeepRevealedReviewAnswer({
    currentCardId: currentData.selectedCard?.id ?? null,
    currentShowAnswer: currentData.selectedCardContext.showAnswer,
    nextCardId: nextData.selectedCard?.id ?? null,
    nextShowAnswer: nextData.selectedCardContext.showAnswer
  });

  return {
    ...nextData,
    selectedCardContext: {
      ...nextData.selectedCardContext,
      gradePreviews: showAnswer
        ? resolveReviewGradePreviews({
            selectedCard: nextData.selectedCard,
            selectedCardContext: nextData.selectedCardContext
          })
        : nextData.selectedCardContext.gradePreviews,
      showAnswer
    }
  };
}

export function shouldAdoptServerFirstCandidateData(input: {
  currentData: ReviewPageClientData;
  nextData: ReviewFirstCandidatePageData;
  globalHydrationRequestKey: string | null;
  lastGlobalHydrationRequestKey: string | null;
}) {
  if (
    input.nextData.session.extraNewCount >
    input.currentData.session.extraNewCount
  ) {
    return true;
  }

  return (
    input.nextData.scope === "global" &&
    input.globalHydrationRequestKey !== null &&
    input.globalHydrationRequestKey !== input.lastGlobalHydrationRequestKey
  );
}

export function shouldAcceptServerReviewData(
  currentData: ReviewPageClientData,
  nextData: ReviewPageData,
  requestedSelectedCardId?: string | null,
  allowRequestedSelectedCardId = false
) {
  if (currentData.session.answeredCount < nextData.session.answeredCount) {
    return true;
  }

  if (currentData.session.answeredCount > nextData.session.answeredCount) {
    return false;
  }

  if (
    currentData.scope !== nextData.scope ||
    currentData.media.slug !== nextData.media.slug ||
    currentData.session.extraNewCount !== nextData.session.extraNewCount ||
    (currentData.session.segmentId ?? null) !== (nextData.session.segmentId ?? null)
  ) {
    return true;
  }

  if (
    allowRequestedSelectedCardId &&
    requestedSelectedCardId &&
    nextData.selectedCard?.id === requestedSelectedCardId
  ) {
    return true;
  }

  return currentData.selectedCard?.id === nextData.selectedCard?.id;
}

export function shouldKeepRevealedReviewAnswer(input: {
  currentCardId: string | null;
  currentShowAnswer: boolean;
  nextCardId: string | null;
  nextShowAnswer: boolean;
}) {
  if (input.nextShowAnswer) {
    return true;
  }

  return (
    input.currentShowAnswer &&
    input.currentCardId !== null &&
    input.currentCardId === input.nextCardId
  );
}

export function getInitiallyRevealedCardId(data: ReviewPageClientData) {
  return data.selectedCard && data.selectedCardContext.showAnswer
    ? data.selectedCard.id
    : null;
}
