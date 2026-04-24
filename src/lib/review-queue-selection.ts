import type { ReviewSearchState } from "./review-search-state";
import type {
  ReviewFirstCandidateSelectedCardContext,
  ReviewQueueCard
} from "./review-types";
import type {
  ReviewQueueSubjectSnapshot,
  ReviewSubjectModel
} from "./review-queue-types";

function findReviewSubjectSelectionInModels(input: {
  models: ReviewSubjectModel[];
  selectedCardId: string;
  visibleMediaId?: string;
}) {
  for (const [index, model] of input.models.entries()) {
    for (const card of model.group.cards) {
      if (input.visibleMediaId && card.mediaId !== input.visibleMediaId) {
        continue;
      }

      if (card.id === input.selectedCardId) {
        return {
          index,
          model
        };
      }
    }
  }

  return null;
}

function findReviewSubjectSelectionInModelLists(input: {
  modelLists: ReviewSubjectModel[][];
  selectedCardId: string;
  visibleMediaId?: string;
}) {
  for (const models of input.modelLists) {
    const selection = findReviewSubjectSelectionInModels({
      models,
      selectedCardId: input.selectedCardId,
      visibleMediaId: input.visibleMediaId
    });

    if (selection) {
      return selection;
    }
  }

  return null;
}

export function resolveReviewPageSelection(input: {
  queueSnapshot: ReviewQueueSubjectSnapshot;
  searchState: ReviewSearchState;
}) {
  const { selectedCardId } = input.searchState;
  const { visibleMediaId } = input.queueSnapshot;
  const queueSelection =
    selectedCardId === null
      ? null
      : findReviewSubjectSelectionInModelLists({
          modelLists: [input.queueSnapshot.queueModels],
          selectedCardId,
          visibleMediaId
        });
  const supportSelection =
    selectedCardId === null || queueSelection !== null
      ? null
      : findReviewSubjectSelectionInModelLists({
          modelLists: [
            input.queueSnapshot.manualModels,
            input.queueSnapshot.suspendedModels,
            input.queueSnapshot.upcomingModels
          ],
          selectedCardId,
          visibleMediaId
        });
  const explicitSelectionModel =
    queueSelection?.model ?? supportSelection?.model ?? null;
  const fallbackSelectionModel =
    selectedCardId && explicitSelectionModel === null
      ? findReviewSubjectSelectionInModelLists({
          modelLists: [input.queueSnapshot.subjectModels],
          selectedCardId,
          visibleMediaId
        })?.model ?? null
      : null;
  const selectedModel =
    explicitSelectionModel ??
    fallbackSelectionModel ??
    input.queueSnapshot.queueModels[0] ??
    null;
  const resolvedSelectedCardId =
    explicitSelectionModel || fallbackSelectionModel ? selectedCardId : null;
  const queueIndex =
    selectedModel === null
      ? -1
      : resolvedSelectedCardId === null
        ? 0
        : queueSelection?.index ?? -1;

  return {
    queueIndex,
    selectedCardId: resolvedSelectedCardId,
    selectedModel,
    selectedQueueModel:
      queueIndex >= 0 ? input.queueSnapshot.queueModels[queueIndex] ?? null : null
  };
}

export function buildReviewFirstCandidateSelectedCardContext(input: {
  bucket: ReviewQueueCard["bucket"] | null;
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
