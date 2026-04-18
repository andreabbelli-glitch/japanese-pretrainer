import { describe, expect, it } from "vitest";

import {
  buildOptimisticGradeResult,
  prioritizeReviewAdvanceCandidateCardIds,
  resolveReviewQueuePosition,
  resolveReviewAdvanceCandidateCardId,
  resolveReviewAdvanceCandidateQueuePosition
} from "@/components/review/review-page-helpers";
import type { ReviewPageClientData } from "@/components/review/review-page-state";
import type { ReviewPageData } from "@/lib/review-types";

describe("resolveReviewQueuePosition", () => {
  it("prefers the optimistic queue when the selected card is still present", () => {
    const resolved = resolveReviewQueuePosition({
      data: {
        queueCardIds: ["card-a", "card-b", "card-c"]
      } as unknown as ReviewPageClientData,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-b"
    });

    expect(resolved.queueCardIds).toEqual(["card-b", "card-c"]);
    expect(resolved.queueIndex).toBe(0);
  });

  it("falls back to the server queue when the optimistic queue no longer has the card", () => {
    const resolved = resolveReviewQueuePosition({
      data: {
        queueCardIds: ["card-a", "card-b", "card-c"]
      } as unknown as ReviewPageClientData,
      queueCardIds: ["card-b", "card-c"],
      selectedCardId: "card-a"
    });

    expect(resolved.queueCardIds).toEqual(["card-a", "card-b", "card-c"]);
    expect(resolved.queueIndex).toBe(0);
  });

  it("returns no queue position for first-candidate payloads", () => {
    const resolved = resolveReviewQueuePosition({
      data: {
        nextCardId: "card-b"
      } as unknown as ReviewPageClientData,
      queueCardIds: ["card-a", "card-b"],
      selectedCardId: "card-a"
    });

    expect(resolved.queueCardIds).toEqual(["card-a", "card-b"]);
    expect(resolved.queueIndex).toBe(-1);
  });

  it("chooses the first buffered candidate that appears later in queue order", () => {
    expect(
      resolveReviewAdvanceCandidateCardId({
        candidateCardIds: ["card-b", "card-c", "card-d"],
        prefetchedCardIds: new Set(["card-c", "card-d"])
      })
    ).toBe("card-c");
  });

  it("moves the preferred buffered candidate to the front of the server hint list", () => {
    expect(
      prioritizeReviewAdvanceCandidateCardIds({
        candidateCardIds: ["card-b", "card-c", "card-d"],
        preferredCardId: "card-c"
      })
    ).toEqual(["card-c", "card-b", "card-d"]);
  });

  it("keeps the canonical queue position even when hydration prefers a later buffered candidate", () => {
    expect(
      resolveReviewAdvanceCandidateQueuePosition({
        candidateCardIds: ["card-b", "card-c", "card-d"],
        selectedCardId: "card-c"
      })
    ).toBe(2);
  });

  it("keeps the optimistic queue position aligned with a later buffered candidate", () => {
    const result = buildOptimisticGradeResult({
      currentData: {
        queue: {
          dailyLimit: 20,
          dueCount: 2,
          effectiveDailyLimit: 20,
          introLabel: "2 cards",
          manualCards: [],
          manualCount: 0,
          newAvailableCount: 0,
          newQueuedCount: 0,
          queueCount: 3,
          queueLabel: "2 cards",
          suspendedCards: [],
          suspendedCount: 0,
          tomorrowCount: 0,
          upcomingCards: [],
          upcomingCount: 0
        },
        scope: "global",
        selectedCard: {
          id: "card-a"
        },
        selectedCardContext: {
          bucket: "due",
          gradePreviews: [],
          isQueueCard: true,
          position: 1,
          remainingCount: 2,
          showAnswer: false
        },
        session: {
          answeredCount: 4,
          extraNewCount: 0,
          segmentId: null
        }
      } as unknown as ReviewPageData,
      gradedCardBucket: "due",
      nextCard: {
        id: "card-c"
      } as unknown as NonNullable<
        Parameters<typeof buildOptimisticGradeResult>[0]["nextCard"]
      >,
      nextQueuePosition: 2,
      nextQueueCardIds: ["card-b", "card-c", "card-d"]
    });

    expect(result.selectedCard?.id).toBe("card-c");
    expect(result.selectedCardContext.position).toBe(2);
    expect(result.selectedCardContext.remainingCount).toBe(1);
  });

  it("keeps the canonical position when a buffered advance skips an unavailable card", () => {
    const result = buildOptimisticGradeResult({
      currentData: {
        queue: {
          dailyLimit: 20,
          dueCount: 2,
          effectiveDailyLimit: 20,
          introLabel: "2 cards",
          manualCards: [],
          manualCount: 0,
          newAvailableCount: 0,
          newQueuedCount: 0,
          queueCount: 3,
          queueLabel: "2 cards",
          suspendedCards: [],
          suspendedCount: 0,
          tomorrowCount: 0,
          upcomingCards: [],
          upcomingCount: 0
        },
        scope: "global",
        selectedCard: {
          id: "card-c"
        },
        selectedCardContext: {
          bucket: "due",
          gradePreviews: [],
          isQueueCard: true,
          position: 2,
          remainingCount: 1,
          showAnswer: false
        },
        session: {
          answeredCount: 4,
          extraNewCount: 0,
          segmentId: null
        }
      } as unknown as ReviewPageData,
      gradedCardBucket: "due",
      nextCard: {
        id: "card-d"
      } as unknown as NonNullable<
        Parameters<typeof buildOptimisticGradeResult>[0]["nextCard"]
      >,
      nextQueuePosition: 2,
      nextQueueCardIds: ["card-b", "card-d"]
    });

    expect(result.selectedCard?.id).toBe("card-d");
    expect(result.selectedCardContext.position).toBe(2);
    expect(result.selectedCardContext.remainingCount).toBe(0);
  });
});
