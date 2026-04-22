import type {
  ReviewFirstCandidatePageData,
  ReviewPageData,
  ReviewQueueCard
} from "@/lib/review-types";

import type { ReviewPageClientData } from "./review-page-state";

export const reviewGradeRatingCopy = [
  {
    detail: "Allunga l’intervallo con prudenza.",
    label: "Easy",
    tone: "easy" as const,
    value: "easy"
  },
  {
    detail: "Passa al prossimo intervallo utile.",
    label: "Good",
    tone: "good" as const,
    value: "good"
  },
  {
    detail: "Resta fragile, ma va avanti.",
    label: "Hard",
    tone: "hard" as const,
    value: "hard"
  },
  {
    detail: "Torna subito o quasi subito.",
    label: "Again",
    tone: "again" as const,
    value: "again"
  }
] as const;

export type ReviewGradeValue = (typeof reviewGradeRatingCopy)[number]["value"];

export function formatRemainingCardsLabel(count: number) {
  return count === 1 ? "1 flashcard rimanente" : `${count} flashcard rimanenti`;
}

export function collectQueuedPrefetchCardIds(input: {
  bufferSize: number;
  coveredCardIds?: ReadonlySet<string>;
  prefetchedCardIds: Set<string>;
  prefetchingCardIds: Set<string>;
  queueCardIds: string[];
  queueIndex: number;
}) {
  const startIndex = input.queueIndex + 1;
  const endIndex = Math.min(
    startIndex + input.bufferSize,
    input.queueCardIds.length
  );
  const cardIdsToFetch: string[] = [];

  for (let index = startIndex; index < endIndex; index += 1) {
    const cardId = input.queueCardIds[index];

    if (
      !cardId ||
      input.coveredCardIds?.has(cardId) ||
      input.prefetchedCardIds.has(cardId) ||
      input.prefetchingCardIds.has(cardId)
    ) {
      continue;
    }

    cardIdsToFetch.push(cardId);
  }

  return cardIdsToFetch;
}

export function pruneQueuedPrefetchedCardMap<T>(
  prefetchedCards: ReadonlyMap<string, T>,
  queueCardIds: ReadonlyArray<string>
) {
  const queuedCardIdSet = new Set(queueCardIds);

  return new Map(
    Array.from(prefetchedCards).filter(([cardId]) => queuedCardIdSet.has(cardId))
  );
}

export function pruneQueuedPrefetchingCardIds(
  prefetchingCardIds: ReadonlySet<string>,
  queueCardIds: ReadonlyArray<string>
) {
  const queuedCardIdSet = new Set(queueCardIds);

  return new Set(
    Array.from(prefetchingCardIds).filter((cardId) =>
      queuedCardIdSet.has(cardId)
    )
  );
}

export function collectQueuedAdvanceCandidateCardIds(input: {
  bufferSize: number;
  queueCardIds: string[];
  queueIndex: number;
}) {
  const startIndex = input.queueIndex + 1;
  const endIndex = Math.min(
    startIndex + input.bufferSize,
    input.queueCardIds.length
  );

  return input.queueCardIds.slice(startIndex, endIndex);
}

export function resolveReviewAdvanceCandidateCardId(input: {
  candidateCardIds: string[];
  prefetchedCardIds: ReadonlySet<string>;
}) {
  for (const cardId of input.candidateCardIds) {
    if (input.prefetchedCardIds.has(cardId)) {
      return cardId;
    }
  }

  return null;
}

export function resolveReviewAdvanceCandidateQueuePosition(input: {
  candidateCardIds: string[];
  selectedCardId: string | null;
}) {
  if (!input.selectedCardId) {
    return null;
  }

  const queueIndex = input.candidateCardIds.indexOf(input.selectedCardId);

  return queueIndex >= 0 ? queueIndex + 1 : null;
}

export function prioritizeReviewAdvanceCandidateCardIds(input: {
  candidateCardIds: string[];
  preferredCardId: string | null;
}) {
  if (!input.preferredCardId) {
    return input.candidateCardIds;
  }

  return [
    input.preferredCardId,
    ...input.candidateCardIds.filter((cardId) => cardId !== input.preferredCardId)
  ];
}

export function resolveOptimisticReviewAdvanceCard(input: {
  candidateCardIds: string[];
  preferredCardId: string | null;
  advanceCards: ReadonlyArray<ReviewQueueCard>;
  prefetchedCards: ReadonlyMap<string, ReviewQueueCard>;
}) {
  const advanceCardLookup = new Map(
    input.advanceCards.map((card) => [card.id, card] as const)
  );
  const prioritizedCandidateCardIds = prioritizeReviewAdvanceCandidateCardIds({
    candidateCardIds: input.candidateCardIds,
    preferredCardId: input.preferredCardId
  });

  for (const cardId of prioritizedCandidateCardIds) {
    const prefetchedCard = input.prefetchedCards.get(cardId);

    if (prefetchedCard) {
      return prefetchedCard;
    }

    const advanceCard = advanceCardLookup.get(cardId);

    if (advanceCard) {
      return advanceCard;
    }
  }

  return null;
}

export function resolveOptimisticReviewAdvanceCardForClientData(input: {
  candidateCardIds: string[];
  data: ReviewPageClientData;
  preferredCardId: string | null;
  prefetchedCards: ReadonlyMap<string, ReviewQueueCard>;
}) {
  return resolveOptimisticReviewAdvanceCard({
    candidateCardIds: input.candidateCardIds,
    preferredCardId: input.preferredCardId,
    advanceCards: input.data.queue.advanceCards,
    prefetchedCards: input.prefetchedCards
  });
}

export function resolveReviewQueuePosition(input: {
  data: ReviewPageClientData;
  queueCardIndexLookup?: ReadonlyMap<string, number>;
  queueCardIds: string[];
  selectedCardId: string | null;
}) {
  if (input.selectedCardId === null) {
    return {
      queueCardIds: input.queueCardIds,
      queueIndex: -1
    };
  }

  const optimisticQueueIndex =
    input.queueCardIndexLookup?.get(input.selectedCardId) ??
    input.queueCardIds.indexOf(input.selectedCardId);

  if (optimisticQueueIndex >= 0) {
    return {
      queueCardIds: input.queueCardIds,
      queueIndex: optimisticQueueIndex
    };
  }

  const dataQueueCardIds =
    "queueCardIds" in input.data ? input.data.queueCardIds : input.queueCardIds;

  return {
    queueCardIds: dataQueueCardIds,
    queueIndex: dataQueueCardIds.indexOf(input.selectedCardId)
  };
}

export function buildOptimisticGradeResult(input: {
  currentData: ReviewPageData;
  gradedCardBucket: ReviewQueueCard["bucket"];
  nextCard: ReviewQueueCard | null;
  nextQueuePosition: number | null;
  nextQueueCardIds: string[];
}): ReviewPageData {
  const nextAdvanceCards = buildOptimisticAdvanceCards({
    currentAdvanceCards: input.currentData.queue.advanceCards,
    nextCardId: input.nextCard?.id ?? null
  });

  return {
    ...input.currentData,
    queue: buildOptimisticQueueUpdate(
      {
        ...input.currentData.queue,
        advanceCards: nextAdvanceCards
      },
      input.gradedCardBucket
    ),
    selectedCard: input.nextCard,
    selectedCardContext: input.nextCard
      ? {
          bucket: input.nextCard.bucket,
          gradePreviews: input.nextCard.gradePreviews,
          isQueueCard: true,
          position: input.nextQueuePosition,
          remainingCount:
            input.nextQueuePosition !== null
              ? Math.max(0, input.nextQueueCardIds.length - input.nextQueuePosition)
              : 0,
          showAnswer: false
        }
      : {
          bucket: null,
          gradePreviews: [],
          isQueueCard: false,
          position: null,
          remainingCount: 0,
          showAnswer: false
        },
    session: {
      answeredCount: input.currentData.session.answeredCount + 1,
      extraNewCount: input.currentData.session.extraNewCount,
      segmentId: input.currentData.session.segmentId
    }
  };
}

export function buildOptimisticFirstCandidateGradeResult(input: {
  currentData: ReviewFirstCandidatePageData;
  gradedCardBucket: ReviewQueueCard["bucket"];
  nextCard: ReviewQueueCard | null;
  nextQueuePosition: number | null;
  nextQueueCardIds: string[];
}): ReviewFirstCandidatePageData {
  const nextAdvanceCards = buildOptimisticAdvanceCards({
    currentAdvanceCards: input.currentData.queue.advanceCards,
    nextCardId: input.nextCard?.id ?? null
  });

  return {
    ...input.currentData,
    nextCardId:
      input.nextQueuePosition !== null
        ? input.nextQueueCardIds[input.nextQueuePosition] ?? null
        : null,
    queue: buildOptimisticQueueUpdate(
      {
        ...input.currentData.queue,
        advanceCards: nextAdvanceCards
      },
      input.gradedCardBucket
    ),
    selectedCard: input.nextCard,
    selectedCardContext: input.nextCard
      ? {
          bucket: input.nextCard.bucket,
          isQueueCard: true,
          position: input.nextQueuePosition,
          remainingCount:
            input.nextQueuePosition !== null
              ? Math.max(0, input.nextQueueCardIds.length - input.nextQueuePosition)
              : 0,
          showAnswer: false
        }
      : {
          bucket: null,
          isQueueCard: false,
          position: null,
          remainingCount: 0,
          showAnswer: false
        },
    session: {
      answeredCount: input.currentData.session.answeredCount + 1,
      extraNewCount: input.currentData.session.extraNewCount,
      segmentId: input.currentData.session.segmentId
    }
  };
}

function buildOptimisticAdvanceCards(input: {
  currentAdvanceCards: ReadonlyArray<ReviewQueueCard>;
  nextCardId: string | null;
}) {
  if (!input.nextCardId || input.currentAdvanceCards.length === 0) {
    return [];
  }

  const nextCardIndex = input.currentAdvanceCards.findIndex(
    (card) => card.id === input.nextCardId
  );

  if (nextCardIndex < 0) {
    return [];
  }

  return input.currentAdvanceCards.slice(nextCardIndex + 1);
}

function buildOptimisticQueueUpdate<
  T extends {
    advanceCards: ReadonlyArray<ReviewQueueCard>;
    dueCount: number;
    newAvailableCount: number;
    newQueuedCount: number;
    queueCount: number;
  }
>(
  currentQueue: T,
  gradedCardBucket: ReviewQueueCard["bucket"]
): T {
  const isQueuedBucket =
    gradedCardBucket === "due" || gradedCardBucket === "new";

  return {
    ...currentQueue,
    dueCount:
      gradedCardBucket === "due"
        ? Math.max(0, currentQueue.dueCount - 1)
        : currentQueue.dueCount,
    newAvailableCount:
      gradedCardBucket === "new"
        ? Math.max(0, currentQueue.newAvailableCount - 1)
        : currentQueue.newAvailableCount,
    newQueuedCount:
      gradedCardBucket === "new"
        ? Math.max(0, currentQueue.newQueuedCount - 1)
        : currentQueue.newQueuedCount,
    queueCount: Math.max(0, currentQueue.queueCount - (isQueuedBucket ? 1 : 0))
  };
}

export function showCompletionTopUp(data: ReviewPageClientData) {
  if (data.queue.queueCount > 0 || data.selectedCard !== null) {
    return 0;
  }

  return Math.min(10, data.queue.newAvailableCount);
}

export function formatTopUpLabel(count: number) {
  return count === 1
    ? "Aggiungi ancora 1 nuova"
    : `Aggiungi altre ${count} nuove`;
}

export function isReviewPageData(
  data: ReviewPageClientData
): data is ReviewPageData {
  return "cards" in data.queue;
}

export function buildReviewHydrationRequestKey(
  searchParams: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (key === "show" || rawValue === undefined) {
      continue;
    }

    if (typeof rawValue === "string") {
      params.append(key, rawValue);
      continue;
    }

    for (const value of [...rawValue].sort()) {
      params.append(key, value);
    }
  }

  return params.toString();
}
