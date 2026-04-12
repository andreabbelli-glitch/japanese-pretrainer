import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";

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
      input.prefetchedCardIds.has(cardId) ||
      input.prefetchingCardIds.has(cardId)
    ) {
      continue;
    }

    cardIdsToFetch.push(cardId);
  }

  return cardIdsToFetch;
}

export function resolveReviewQueuePosition(input: {
  data: ReviewPageClientData;
  queueCardIds: string[];
  selectedCardId: string | null;
}) {
  if (!isReviewPageData(input.data) || input.selectedCardId === null) {
    return {
      queueCardIds: input.queueCardIds,
      queueIndex: -1
    };
  }

  const optimisticQueueIndex = input.queueCardIds.indexOf(input.selectedCardId);

  if (optimisticQueueIndex >= 0) {
    return {
      queueCardIds: input.queueCardIds,
      queueIndex: optimisticQueueIndex
    };
  }

  return {
    queueCardIds: input.data.queueCardIds,
    queueIndex: input.data.queueCardIds.indexOf(input.selectedCardId)
  };
}

export function buildOptimisticGradeResult(input: {
  currentData: ReviewPageData;
  gradedCardBucket: ReviewQueueCard["bucket"];
  nextCard: ReviewQueueCard | null;
  nextQueueCardIds: string[];
}): ReviewPageData {
  return {
    ...input.currentData,
    queue: buildOptimisticQueueUpdate(
      input.currentData.queue,
      input.gradedCardBucket
    ),
    selectedCard: input.nextCard,
    selectedCardContext: input.nextCard
      ? {
          bucket: input.nextCard.bucket,
          gradePreviews: input.nextCard.gradePreviews,
          isQueueCard: true,
          position: 1,
          remainingCount: Math.max(0, input.nextQueueCardIds.length - 1),
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

function buildOptimisticQueueUpdate(
  currentQueue: ReviewPageData["queue"],
  gradedCardBucket: ReviewQueueCard["bucket"]
): ReviewPageData["queue"] {
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
  return "queueCardIds" in data;
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
