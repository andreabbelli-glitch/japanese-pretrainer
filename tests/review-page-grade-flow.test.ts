import type { Route } from "next";
import { describe, expect, it } from "vitest";

import { buildReviewGradeSubmissionPlan } from "@/components/review/review-page-grade-flow";
import type { ReviewForcedContrastSelection } from "@/components/review/review-page-state";
import type {
  ReviewFirstCandidatePageData,
  ReviewPageData,
  ReviewQueueCard
} from "@/lib/review-types";

describe("buildReviewGradeSubmissionPlan", () => {
  it("builds queued grade payloads with canonical ids and a preferred prefetched next card", () => {
    const currentData = buildFullReviewPageData("card-a");
    const prefetchedCard = buildQueueCard("card-c");

    const plan = buildReviewGradeSubmissionPlan({
      activeQueueCardIds: ["card-a", "card-b", "card-c"],
      advanceWindowCardIds: ["card-b", "card-c"],
      forcedContrastSelection: null,
      fullViewData: currentData,
      gradedCardIds: ["card-a"],
      isHydratingFullData: false,
      isQueueCard: true,
      pendingGradeSubmissionCount: 0,
      prefetchedCards: new Map([[prefetchedCard.id, prefetchedCard]]),
      rating: "good",
      selectedCard: currentData.selectedCard!,
      sessionViewData: currentData
    });

    expect(plan.kind).toBe("advance-queue");
    if (plan.kind !== "advance-queue") {
      throw new Error("Expected an advance-queue plan.");
    }

    expect(plan.candidateCardIds).toEqual(["card-b", "card-c"]);
    expect(plan.nextQueueCardIds).toEqual(["card-b", "card-c"]);
    expect(plan.preferredNextCardId).toBe("card-c");
    expect(plan.nextCardId).toBe("card-c");
    expect(plan.optimisticNextCard?.id).toBe("card-c");
    expect(plan.optimisticNextQueuePosition).toBe(2);
    expect(plan.canOptimisticallyAdvance).toBe(true);
    expect(plan.actionInput).toEqual(
      expect.objectContaining({
        candidateCardIds: ["card-b", "card-c"],
        canonicalCandidateCardIds: ["card-b", "card-c"],
        expectedUpdatedAt: "2026-04-02T11:00:00.000Z",
        gradedCardBucket: "due",
        gradedCardIds: ["card-a"],
        nextCardId: "card-c",
        rating: "good",
        sessionQueue: currentData.queue,
        sessionSettings: currentData.settings
      })
    );
  });

  it("allows optimistic first-candidate advance without full session queue snapshots", () => {
    const currentData = buildFirstCandidateReviewPageData("card-a");

    const plan = buildReviewGradeSubmissionPlan({
      activeQueueCardIds: ["card-a", "card-b"],
      advanceWindowCardIds: ["card-b"],
      forcedContrastSelection: null,
      fullViewData: null,
      gradedCardIds: ["card-a"],
      isHydratingFullData: true,
      isQueueCard: true,
      pendingGradeSubmissionCount: 0,
      prefetchedCards: new Map(),
      rating: "good",
      selectedCard: currentData.selectedCard as ReviewQueueCard,
      sessionViewData: currentData
    });

    expect(plan.kind).toBe("advance-queue");
    if (plan.kind !== "advance-queue") {
      throw new Error("Expected an advance-queue plan.");
    }

    expect(plan.canOptimisticallyAdvance).toBe(true);
    expect(plan.optimisticViewData?.selectedCard?.id).toBe("card-b");
    expect(plan.actionInput).not.toHaveProperty("sessionQueue");
    expect(plan.actionInput).not.toHaveProperty("sessionSettings");
  });

  it("includes full queue snapshots when full page data is available", () => {
    const currentData = buildFullReviewPageData("card-a");

    const plan = buildReviewGradeSubmissionPlan({
      activeQueueCardIds: ["card-a", "card-b"],
      advanceWindowCardIds: ["card-b"],
      forcedContrastSelection: null,
      fullViewData: currentData,
      gradedCardIds: ["card-a"],
      isHydratingFullData: false,
      isQueueCard: true,
      pendingGradeSubmissionCount: 0,
      prefetchedCards: new Map(),
      rating: "hard",
      selectedCard: currentData.selectedCard!,
      sessionViewData: currentData
    });

    expect(plan.kind).toBe("advance-queue");
    if (plan.kind !== "advance-queue") {
      throw new Error("Expected an advance-queue plan.");
    }

    expect(plan.actionInput.sessionQueue).toBe(currentData.queue);
    expect(plan.actionInput.sessionSettings).toBe(currentData.settings);
  });

  it("adds forced contrast payloads and disables optimistic advance", () => {
    const currentData = buildFullReviewPageData("card-a");
    const forcedContrastSelection: ReviewForcedContrastSelection = {
      kind: "term",
      label: "コスト",
      meaning: "costo",
      reading: "こすと",
      resultKey: "term:entry:cost",
      romaji: "kosuto",
      title: undefined
    };

    const plan = buildReviewGradeSubmissionPlan({
      activeQueueCardIds: ["card-a", "card-b"],
      advanceWindowCardIds: ["card-b"],
      forcedContrastSelection,
      fullViewData: currentData,
      gradedCardIds: ["card-a"],
      isHydratingFullData: false,
      isQueueCard: true,
      pendingGradeSubmissionCount: 0,
      prefetchedCards: new Map(),
      rating: "good",
      selectedCard: currentData.selectedCard!,
      sessionViewData: currentData
    });

    expect(plan.kind).toBe("advance-queue");
    if (plan.kind !== "advance-queue") {
      throw new Error("Expected an advance-queue plan.");
    }

    expect(plan.isBlockingGradeSubmission).toBe(true);
    expect(plan.canOptimisticallyAdvance).toBe(false);
    expect(plan.optimisticViewData).toBeNull();
    expect(plan.actionInput.forcedKanjiClashContrast).toEqual({
      source: "review-grading",
      targetLabel: "コスト",
      targetResultKey: "term:entry:cost"
    });
  });

  it("builds preserve-card payloads without queue candidate fields", () => {
    const currentData = buildFullReviewPageData("card-a", {
      bucket: "manual",
      isQueueCard: false,
      scope: "media"
    });

    const plan = buildReviewGradeSubmissionPlan({
      activeQueueCardIds: ["card-a", "card-b"],
      advanceWindowCardIds: ["card-b"],
      forcedContrastSelection: null,
      fullViewData: currentData,
      gradedCardIds: ["card-a"],
      isHydratingFullData: false,
      isQueueCard: false,
      pendingGradeSubmissionCount: 0,
      prefetchedCards: new Map(),
      rating: "again",
      selectedCard: currentData.selectedCard!,
      sessionViewData: currentData
    });

    expect(plan.kind).toBe("preserve-card");
    if (plan.kind !== "preserve-card") {
      throw new Error("Expected a preserve-card plan.");
    }

    expect(plan.actionInput).toEqual(
      expect.objectContaining({
        cardId: "card-a",
        mediaSlug: "duel-masters-dm25",
        rating: "again",
        sessionMedia: currentData.media,
        scope: "media"
      })
    );
    expect(plan.actionInput).not.toHaveProperty("candidateCardIds");
    expect(plan.actionInput).not.toHaveProperty("canonicalCandidateCardIds");
    expect(plan.actionInput).not.toHaveProperty("nextCardId");
    expect(plan.actionInput).not.toHaveProperty("sessionQueue");
    expect(plan.actionInput).not.toHaveProperty("sessionSettings");
  });
});

function buildFullReviewPageData(
  selectedCardId: string,
  options?: {
    bucket?: ReviewQueueCard["bucket"];
    isQueueCard?: boolean;
    scope?: "global" | "media";
  }
): ReviewPageData {
  const scope = options?.scope ?? "global";
  const selectedCard = buildQueueCard(selectedCardId, {
    bucket: options?.bucket ?? "due"
  });
  const advanceCards = ["card-b", "card-c"]
    .filter((cardId) => cardId !== selectedCardId)
    .map((cardId) => buildQueueCard(cardId));

  return {
    media: buildReviewMedia(scope),
    queue: {
      advanceCards,
      cards: [selectedCard, ...advanceCards],
      dailyLimit: 20,
      dueCount: 3,
      effectiveDailyLimit: 20,
      introLabel: "3 card da ripassare adesso.",
      manualCards: [],
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: 3,
      queueLabel: "3 card da ripassare adesso.",
      suspendedCards: [],
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCards: [],
      upcomingCount: 0
    },
    queueCardIds: [selectedCard.id, ...advanceCards.map((card) => card.id)],
    scope,
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard.bucket,
      gradePreviews: [],
      isQueueCard: options?.isQueueCard ?? true,
      position: 1,
      remainingCount: advanceCards.length,
      reviewStateUpdatedAt: selectedCard.reviewStateUpdatedAt ?? null,
      showAnswer: true
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: 0,
      extraNewCount: 0,
      segmentId: null
    }
  };
}

function buildFirstCandidateReviewPageData(
  selectedCardId: string
): ReviewFirstCandidatePageData {
  const selectedCard = buildQueueCard(selectedCardId);
  const advanceCards = [buildQueueCard("card-b")];

  return {
    media: buildReviewMedia("global"),
    nextCardId: "card-b",
    queue: {
      advanceCards,
      dailyLimit: 20,
      dueCount: 2,
      effectiveDailyLimit: 20,
      introLabel: "2 card da ripassare adesso.",
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: 2,
      queueLabel: "2 card da ripassare adesso.",
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCount: 0
    },
    queueCardIds: ["card-a", "card-b"],
    scope: "global",
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard.bucket,
      isQueueCard: true,
      position: 1,
      remainingCount: 1,
      reviewStateUpdatedAt: selectedCard.reviewStateUpdatedAt ?? null,
      showAnswer: true
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: 0,
      extraNewCount: 0,
      segmentId: null
    }
  };
}

function buildReviewMedia(scope: "global" | "media"): ReviewPageData["media"] {
  return {
    glossaryHref:
      scope === "media" ? "/media/duel-masters-dm25/glossary" : "/glossary",
    href: scope === "media" ? "/media/duel-masters-dm25" : "/",
    id: scope === "media" ? "media-duel-masters" : undefined,
    reviewHref:
      scope === "media" ? "/media/duel-masters-dm25/review" : "/review",
    slug: scope === "media" ? "duel-masters-dm25" : "global-review",
    title: scope === "media" ? "Duel Masters" : "Review globale"
  } as ReviewPageData["media"];
}

function buildQueueCard(
  id: string,
  options?: {
    bucket?: ReviewQueueCard["bucket"];
  }
): ReviewQueueCard {
  const reviewStateUpdatedAtByCardId = new Map([
    ["card-a", "2026-04-02T11:00:00.000Z"],
    ["card-b", "2026-04-02T11:30:00.000Z"],
    ["card-c", "2026-04-02T12:00:00.000Z"]
  ]);
  const bucket = options?.bucket ?? "due";

  return {
    back: id === "card-a" ? "costo / cost" : "casella / slot",
    bucket,
    bucketDetail: "Richiede attenzione oggi.",
    bucketLabel: bucket === "manual" ? "Manuale" : "Da ripassare",
    contexts: [],
    createdAt: "2026-04-02T00:00:00.000Z",
    dueAt: "2026-04-02T12:00:00.000Z",
    effectiveState: "review",
    effectiveStateLabel: "Review",
    entries: [],
    exampleIt: undefined,
    exampleJp: undefined,
    front: id === "card-a" ? "コスト" : "札",
    gradePreviews: [],
    href: `/media/duel-masters-dm25/review/card/${id}` as Route,
    id,
    mediaSlug: "duel-masters-dm25",
    mediaTitle: "Duel Masters",
    notes: undefined,
    orderIndex: 1,
    pronunciations: [],
    rawReviewLabel: "In review",
    reading: "やまふだ",
    reviewStateUpdatedAt: reviewStateUpdatedAtByCardId.get(id) ?? null,
    reviewSeedState: {
      difficulty: 2.5,
      dueAt: "2026-04-02T12:00:00.000Z",
      fsrsDesiredRetention: 0.9,
      fsrsWeights: null,
      lapses: 0,
      lastReviewedAt: "2026-04-01T12:00:00.000Z",
      learningSteps: 0,
      reps: 1,
      scheduledDays: 1,
      stability: 2,
      state: "review"
    },
    segmentTitle: "Tcg Core",
    typeLabel: "Recognition"
  };
}
