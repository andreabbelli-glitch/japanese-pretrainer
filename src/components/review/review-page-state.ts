import { buildReviewGradePreviews } from "@/lib/review-grade-previews";
import type {
  ReviewFirstCandidatePageData,
  ReviewPageData
} from "@/lib/review-types";

export type ReviewPageClientData =
  | ReviewPageData
  | ReviewFirstCandidatePageData;

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
      gradePreviews:
        showAnswer && nextData.selectedCard
          ? nextData.selectedCardContext.gradePreviews.length > 0
            ? nextData.selectedCardContext.gradePreviews
            : buildReviewGradePreviews(
                nextData.selectedCard.reviewSeedState,
                new Date()
              )
          : nextData.selectedCardContext.gradePreviews,
      showAnswer
    }
  };
}

export function shouldAcceptServerReviewData(
  currentData: ReviewPageClientData,
  nextData: ReviewPageData
) {
  if (currentData.session.answeredCount < nextData.session.answeredCount) {
    return true;
  }

  if (currentData.session.answeredCount > nextData.session.answeredCount) {
    return false;
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
