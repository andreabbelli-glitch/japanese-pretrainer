import { describe, expect, it } from "vitest";

import {
  buildOptimisticGradeResult,
  buildOptimisticFirstCandidateGradeResult,
  collectQueuedPrefetchCardIds,
  pruneQueuedPrefetchedCardMap,
  pruneQueuedPrefetchingCardIds,
  resolveReviewQueueRefreshState,
  resolveOptimisticReviewAdvanceCardForClientData,
  resolveOptimisticReviewAdvanceCard,
  resolveReviewQueuePosition,
  resolveReviewAdvanceCandidateQueuePosition
} from "@/components/review/review-page-helpers";
import type { ReviewPageClientData } from "@/components/review/review-page-state";
import type {
  ReviewFirstCandidatePageData,
  ReviewPageData,
  ReviewQueueCard
} from "@/features/review/types";

describe("resolveReviewQueueRefreshState", () => {
  it("enables the completion refresh when the next due time has passed", () => {
    expect(
      resolveReviewQueueRefreshState({
        isPending: false,
        nextDueAt: "2026-04-02T12:00:00.000Z",
        now: new Date("2026-04-02T12:00:01.000Z")
      })
    ).toEqual({
      buttonLabel: "Controlla card pronte",
      canRefresh: true,
      statusLabel: "Ci sono card che potrebbero essere pronte."
    });
  });

  it("shows the wait in the disabled completion refresh button", () => {
    expect(
      resolveReviewQueueRefreshState({
        isPending: false,
        nextDueAt: "2026-04-02T12:05:01.000Z",
        now: new Date("2026-04-02T12:00:00.000Z")
      })
    ).toEqual({
      buttonLabel: "Controlla card pronte",
      canRefresh: false,
      statusLabel: "Prossime card tra 6 min."
    });
  });

  it.each([
    ["spring DST", "2026-03-28T03:30:00.000Z", "2026-03-29T02:00:00.000Z"],
    ["autumn DST", "2026-10-24T02:30:00.000Z", "2026-10-25T03:00:00.000Z"]
  ])("labels the next logical day as tomorrow across %s", (_, now, dueAt) => {
    expect(
      resolveReviewQueueRefreshState({
        isPending: false,
        nextDueAt: dueAt,
        now: new Date(now)
      }).statusLabel
    ).toBe("Prossime card domani.");
  });

  it("keeps the completion refresh disabled while a session update is pending", () => {
    expect(
      resolveReviewQueueRefreshState({
        isPending: true,
        nextDueAt: "2026-04-02T12:00:00.000Z",
        now: new Date("2026-04-02T12:00:01.000Z")
      })
    ).toEqual({
      buttonLabel: "Aggiorno queue...",
      canRefresh: false,
      statusLabel: "Controllo se ci sono card pronte."
    });
  });

  it("keeps the completion refresh button visible even with no known next due time", () => {
    expect(
      resolveReviewQueueRefreshState({
        isPending: false,
        nextDueAt: null,
        now: new Date("2026-04-02T12:00:00.000Z")
      })
    ).toEqual({
      buttonLabel: "Controlla card pronte",
      canRefresh: false,
      statusLabel: "Nessuna card pronta da controllare."
    });
  });
});

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

  it("resolves queue position for first-candidate payloads with canonical queue ids", () => {
    const resolved = resolveReviewQueuePosition({
      data: {
        queueCardIds: ["card-a", "card-b"],
        nextCardId: "card-b"
      } as unknown as ReviewPageClientData,
      queueCardIds: ["card-a", "card-b"],
      selectedCardId: "card-a"
    });

    expect(resolved.queueCardIds).toEqual(["card-a", "card-b"]);
    expect(resolved.queueIndex).toBe(0);
  });

  it("does not promote a later prefetched card ahead of the canonical next card", () => {
    expect(
      resolveOptimisticReviewAdvanceCard({
        candidateCardIds: ["card-b", "card-c"],
        prefetchedCards: new Map([
          ["card-c", { id: "card-c" } as ReviewQueueCard]
        ]),
        advanceCards: []
      })
    ).toBeNull();
  });

  it("falls back to the queued card snapshot when the advance candidate is not prefetched yet", () => {
    expect(
      resolveOptimisticReviewAdvanceCard({
        candidateCardIds: ["card-b", "card-c"],
        prefetchedCards: new Map(),
        advanceCards: [
          {
            id: "card-b"
          },
          {
            id: "card-c"
          }
        ] as ReviewPageData["queue"]["advanceCards"]
      })?.id
    ).toBe("card-b");
  });

  it("skips queued card prefetches already covered by the server advance window", () => {
    expect(
      collectQueuedPrefetchCardIds({
        bufferSize: 3,
        coveredCardIds: new Set(["card-d"]),
        prefetchedCardIds: new Set(["card-b"]),
        prefetchingCardIds: new Set(["card-c"]),
        queueCardIds: ["card-a", "card-b", "card-c", "card-d", "card-e"],
        queueIndex: 0
      })
    ).toEqual([]);
  });

  it("drops prefetched review cards that are no longer present in the queue", () => {
    expect(
      Array.from(
        pruneQueuedPrefetchedCardMap(
          new Map([
            ["card-a", { id: "card-a" } as ReviewQueueCard],
            ["card-b", { id: "card-b" } as ReviewQueueCard],
            ["card-c", { id: "card-c" } as ReviewQueueCard]
          ]),
          ["card-b", "card-c", "card-d"]
        ).keys()
      )
    ).toEqual(["card-b", "card-c"]);
  });

  it("drops in-flight prefetch ids that are no longer present in the queue", () => {
    expect(
      Array.from(
        pruneQueuedPrefetchingCardIds(new Set(["card-a", "card-b", "card-c"]), [
          "card-b",
          "card-d"
        ])
      )
    ).toEqual(["card-b"]);
  });

  it("resolves the canonical queue position when the server skips an unavailable candidate", () => {
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
          advanceCards: [
            {
              id: "card-b"
            },
            {
              id: "card-c"
            },
            {
              id: "card-d"
            }
          ] as ReviewQueueCard[],
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
          reviewStateUpdatedAt: "2026-04-02T11:00:00.000Z",
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
        id: "card-c",
        reviewStateUpdatedAt: "2026-04-02T11:30:00.000Z"
      } as unknown as NonNullable<
        Parameters<typeof buildOptimisticGradeResult>[0]["nextCard"]
      >,
      nextQueuePosition: 2,
      nextQueueCardIds: ["card-b", "card-c", "card-d"]
    });

    expect(result.selectedCard?.id).toBe("card-c");
    expect(result.selectedCardContext.position).toBe(2);
    expect(result.selectedCardContext.reviewStateUpdatedAt).toBe(
      "2026-04-02T11:30:00.000Z"
    );
    expect(result.selectedCardContext.remainingCount).toBe(1);
  });

  it("keeps the canonical position when a buffered advance skips an unavailable card", () => {
    const result = buildOptimisticGradeResult({
      currentData: {
        queue: {
          dailyLimit: 20,
          dueCount: 2,
          effectiveDailyLimit: 20,
          advanceCards: [
            {
              id: "card-b"
            },
            {
              id: "card-d"
            }
          ] as ReviewQueueCard[],
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

  it("keeps grading optimistic while the first-candidate payload is still hydrating", () => {
    const resolvedNextCard = resolveOptimisticReviewAdvanceCardForClientData({
      candidateCardIds: ["card-b", "card-c"],
      data: {
        media: {
          glossaryHref: "/glossary",
          href: "/",
          reviewHref: "/review",
          slug: "global-review",
          title: "Review globale"
        },
        nextCardId: "card-b",
        queueCardIds: ["card-a", "card-b", "card-c"],
        queue: {
          advanceCards: [
            {
              id: "card-b"
            },
            {
              id: "card-c"
            }
          ] as ReviewQueueCard[],
          dailyLimit: 20,
          dueCount: 2,
          effectiveDailyLimit: 20,
          introLabel: "2 cards",
          manualCount: 0,
          newAvailableCount: 0,
          newQueuedCount: 0,
          queueCount: 2,
          queueLabel: "2 cards",
          suspendedCount: 0,
          tomorrowCount: 0,
          upcomingCount: 0
        },
        scope: "global",
        selectedCard: {
          bucket: "due",
          bucketDetail: "Da ripassare oggi.",
          bucketLabel: "Da ripassare",
          createdAt: "2026-04-02T00:00:00.000Z",
          dueAt: "2026-04-02T12:00:00.000Z",
          effectiveState: "review",
          effectiveStateLabel: "Review",
          front: "コスト",
          href: "/media/duel-masters-dm25/review/card/card-a" as ReviewQueueCard["href"],
          id: "card-a",
          mediaSlug: "duel-masters-dm25",
          mediaTitle: "Duel Masters",
          rawReviewLabel: "In review",
          reviewSeedState: {
            difficulty: 2.5,
            dueAt: "2026-04-02T12:00:00.000Z",
            lapses: 0,
            lastReviewedAt: "2026-04-01T12:00:00.000Z",
            learningSteps: 0,
            reps: 1,
            scheduledDays: 1,
            stability: 2,
            state: "review"
          },
          typeLabel: "Recognition"
        } as ReviewQueueCard,
        selectedCardContext: {
          bucket: "due",
          isQueueCard: true,
          position: 1,
          reviewStateUpdatedAt: "2026-04-02T11:00:00.000Z",
          remainingCount: 1,
          showAnswer: false
        },
        settings: {
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true
        },
        session: {
          answeredCount: 0,
          extraNewCount: 0,
          segmentId: null
        }
      } as ReviewFirstCandidatePageData,
      prefetchedCards: new Map([
        [
          "card-b",
          {
            id: "card-b"
          } as ReviewQueueCard
        ]
      ])
    });

    expect(resolvedNextCard?.id).toBe("card-b");

    const result = buildOptimisticFirstCandidateGradeResult({
      currentData: {
        media: {
          glossaryHref: "/glossary",
          href: "/",
          reviewHref: "/review",
          slug: "global-review",
          title: "Review globale"
        },
        nextCardId: "card-b",
        queueCardIds: ["card-a", "card-b", "card-c"],
        queue: {
          advanceCards: [
            {
              id: "card-b"
            },
            {
              id: "card-c"
            }
          ] as ReviewQueueCard[],
          dailyLimit: 20,
          dueCount: 2,
          effectiveDailyLimit: 20,
          introLabel: "2 cards",
          manualCount: 0,
          newAvailableCount: 0,
          newQueuedCount: 0,
          queueCount: 2,
          queueLabel: "2 cards",
          suspendedCount: 0,
          tomorrowCount: 0,
          upcomingCount: 0
        },
        scope: "global",
        selectedCard: {
          bucket: "due",
          bucketDetail: "Da ripassare oggi.",
          bucketLabel: "Da ripassare",
          createdAt: "2026-04-02T00:00:00.000Z",
          dueAt: "2026-04-02T12:00:00.000Z",
          effectiveState: "review",
          effectiveStateLabel: "Review",
          front: "コスト",
          href: "/media/duel-masters-dm25/review/card/card-a" as ReviewQueueCard["href"],
          id: "card-a",
          mediaSlug: "duel-masters-dm25",
          mediaTitle: "Duel Masters",
          rawReviewLabel: "In review",
          reviewSeedState: {
            difficulty: 2.5,
            dueAt: "2026-04-02T12:00:00.000Z",
            lapses: 0,
            lastReviewedAt: "2026-04-01T12:00:00.000Z",
            learningSteps: 0,
            reps: 1,
            scheduledDays: 1,
            stability: 2,
            state: "review"
          },
          typeLabel: "Recognition"
        } as ReviewQueueCard,
        selectedCardContext: {
          bucket: "due",
          isQueueCard: true,
          position: 1,
          remainingCount: 1,
          showAnswer: false
        },
        settings: {
          reviewAutoplayAudioOnReveal: true,
          reviewFrontFurigana: true
        },
        session: {
          answeredCount: 0,
          extraNewCount: 0,
          segmentId: null
        }
      } as unknown as ReviewFirstCandidatePageData,
      gradedCardBucket: "due",
      nextCard: {
        bucket: "due",
        bucketDetail: "Da ripassare oggi.",
        bucketLabel: "Da ripassare",
        createdAt: "2026-04-02T00:00:00.000Z",
        dueAt: "2026-04-02T12:00:00.000Z",
        effectiveState: "review",
        effectiveStateLabel: "Review",
        front: "コスト",
        href: "/media/duel-masters-dm25/review/card/card-b" as ReviewQueueCard["href"],
        id: "card-b",
        mediaSlug: "duel-masters-dm25",
        mediaTitle: "Duel Masters",
        rawReviewLabel: "In review",
        reviewStateUpdatedAt: "2026-04-02T11:30:00.000Z",
        reviewSeedState: {
          difficulty: 2.5,
          dueAt: "2026-04-02T12:00:00.000Z",
          lapses: 0,
          lastReviewedAt: "2026-04-01T12:00:00.000Z",
          learningSteps: 0,
          reps: 1,
          scheduledDays: 1,
          stability: 2,
          state: "review"
        },
        typeLabel: "Recognition"
      } as ReviewQueueCard,
      nextQueuePosition: 1,
      nextQueueCardIds: ["card-b", "card-c"]
    });

    expect(result.selectedCard?.id).toBe("card-b");
    expect(result.selectedCardContext.position).toBe(1);
    expect(result.selectedCardContext.reviewStateUpdatedAt).toBe(
      "2026-04-02T11:30:00.000Z"
    );
    expect(result.selectedCardContext.remainingCount).toBe(1);
    expect(result.queue.advanceCards.map((card) => card.id)).toEqual([
      "card-c"
    ]);
    expect(result.nextCardId).toBe("card-c");
  });
});
