import type { Route } from "next";
import { describe, expect, it } from "vitest";

import {
  buildReviewControllerSnapshot,
  type ReviewControllerSnapshotInput
} from "@/components/review/review-page-controller-snapshot";
import type { ReviewForcedContrastSelection } from "@/components/review/review-page-state";
import type {
  ReviewFirstCandidatePageData,
  ReviewPageData,
  ReviewQueueCard
} from "@/lib/review-types";

describe("buildReviewControllerSnapshot", () => {
  it("derives global first-candidate hydration flags and request keys", () => {
    const snapshot = buildReviewControllerSnapshot(
      buildSnapshotInput({
        currentSearchParams: {
          answered: "0",
          card: "card-a",
          show: "answer"
        },
        viewData: buildFirstCandidateReviewPageData("card-a")
      })
    );

    expect(snapshot.isFullReviewPageData).toBe(false);
    expect(snapshot.isGlobalReview).toBe(true);
    expect(snapshot.isHydratingFullData).toBe(true);
    expect(snapshot.globalHydrationRequestKey).toBe("answered=0&card=card-a");
    expect(snapshot.requestedSelectedCardId).toBe("card-a");
  });

  it("resolves requested selected card search params from array form", () => {
    const snapshot = buildReviewControllerSnapshot(
      buildSnapshotInput({
        currentSearchParams: {
          answered: "1",
          card: ["card-c", "card-b"],
          show: "answer"
        },
        viewData: buildFullReviewPageData("card-a")
      })
    );

    expect(snapshot.requestedSelectedCardId).toBe("card-c");
    expect(snapshot.globalHydrationRequestKey).toBe(
      "answered=1&card=card-b&card=card-c"
    );
  });

  it("derives queue position and the queued advance window", () => {
    const queueCardIds = ["card-a", "card-b", "card-c", "card-d", "card-e"];
    const snapshot = buildReviewControllerSnapshot(
      buildSnapshotInput({
        queueCardIds,
        viewData: buildFullReviewPageData("card-b", {
          queueCardIds
        })
      })
    );

    expect(snapshot.queueCardIndexLookup).toEqual(
      new Map([
        ["card-a", 0],
        ["card-b", 1],
        ["card-c", 2],
        ["card-d", 3],
        ["card-e", 4]
      ])
    );
    expect(snapshot.resolvedQueuePosition).toEqual({
      queueCardIds,
      queueIndex: 1
    });
    expect(snapshot.activeQueueCardIds).toEqual(queueCardIds);
    expect(snapshot.queueIndex).toBe(1);
    expect(snapshot.isQueueCard).toBe(true);
    expect(snapshot.advanceWindowCardIds).toEqual([
      "card-c",
      "card-d",
      "card-e"
    ]);
  });

  it("builds session and contextual glossary hrefs when the answer is revealed", () => {
    const snapshot = buildReviewControllerSnapshot(
      buildSnapshotInput({
        revealedCardId: "card-a",
        viewData: buildFullReviewPageData("card-a", {
          answeredCount: 2,
          extraNewCount: 1,
          position: 2,
          segmentId: "segment-a"
        })
      })
    );

    expect(snapshot.isAnswerRevealed).toBe(true);
    expect(snapshot.sessionHref).toBe(
      "/review?answered=2&card=card-a&extraNew=1&segment=segment-a&show=answer"
    );
    expect(snapshot.contextualGlossaryHref).toBe(
      "/glossary?returnTo=%2Freview%3Fanswered%3D2%26card%3Dcard-a%26extraNew%3D1%26segment%3Dsegment-a%26show%3Danswer"
    );
  });

  it("disables grade controls for client errors, submissions, blocking mutations, and forced contrast pending grades", () => {
    const baseInput = buildSnapshotInput({
      viewData: buildFullReviewPageData("card-a")
    });
    const forcedContrastSelection: ReviewForcedContrastSelection = {
      kind: "term",
      label: "コスト",
      meaning: "costo",
      reading: "こすと",
      resultKey: "term:entry:cost",
      romaji: "kosuto",
      title: undefined
    };

    expect(
      buildReviewControllerSnapshot({
        ...baseInput,
        clientError: "Errore temporaneo"
      }).isGradeControlsDisabled
    ).toBe(true);
    expect(
      buildReviewControllerSnapshot({
        ...baseInput,
        submittedGradeCardIds: new Set(["card-a"])
      }).isGradeControlsDisabled
    ).toBe(true);
    expect(
      buildReviewControllerSnapshot({
        ...baseInput,
        hasBlockingGradeSubmissionInFlight: true
      }).isGradeControlsDisabled
    ).toBe(true);
    expect(
      buildReviewControllerSnapshot({
        ...baseInput,
        forcedContrastSelection,
        pendingGradeCardIds: new Set(["card-b"])
      }).isGradeControlsDisabled
    ).toBe(true);
    expect(
      buildReviewControllerSnapshot(baseInput).isGradeControlsDisabled
    ).toBe(false);
  });
});

function buildSnapshotInput(
  overrides: Partial<ReviewControllerSnapshotInput> & {
    viewData: ReviewControllerSnapshotInput["viewData"];
  }
): ReviewControllerSnapshotInput {
  return {
    clientError: null,
    currentSearchParams: undefined,
    forcedContrastSelection: null,
    hasBlockingGradeSubmissionInFlight: false,
    pendingGradeCardIds: new Set(),
    queueCardIds:
      "queueCardIds" in overrides.viewData
        ? overrides.viewData.queueCardIds
        : [],
    revealedCardId: null,
    submittedGradeCardIds: new Set(),
    ...overrides
  };
}

function buildFullReviewPageData(
  selectedCardId: string,
  options?: {
    answeredCount?: number;
    extraNewCount?: number;
    isQueueCard?: boolean;
    position?: number | null;
    queueCardIds?: string[];
    scope?: "global" | "media";
    segmentId?: string | null;
    showAnswer?: boolean;
  }
): ReviewPageData {
  const scope = options?.scope ?? "global";
  const selectedCard = buildQueueCard(selectedCardId);
  const queueCardIds = options?.queueCardIds ?? [
    selectedCard.id,
    "card-b",
    "card-c"
  ];
  const advanceCards = queueCardIds
    .filter((cardId) => cardId !== selectedCardId)
    .map((cardId) => buildQueueCard(cardId));

  return {
    media: buildReviewMedia(scope),
    queue: {
      advanceCards,
      cards: [selectedCard, ...advanceCards],
      dailyLimit: 20,
      dueCount: queueCardIds.length,
      effectiveDailyLimit: 20,
      introLabel: `${queueCardIds.length} card da ripassare adesso.`,
      manualCards: [],
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: queueCardIds.length,
      queueLabel: `${queueCardIds.length} card da ripassare adesso.`,
      suspendedCards: [],
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCards: [],
      upcomingCount: 0
    },
    queueCardIds,
    scope,
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard.bucket,
      gradePreviews: [],
      isQueueCard: options?.isQueueCard ?? true,
      position: options?.position ?? 1,
      remainingCount: Math.max(0, queueCardIds.length - 1),
      reviewStateUpdatedAt: selectedCard.reviewStateUpdatedAt ?? null,
      showAnswer: options?.showAnswer ?? false
    },
    settings: {
      reviewFrontFurigana: false
    },
    session: {
      answeredCount: options?.answeredCount ?? 0,
      extraNewCount: options?.extraNewCount ?? 0,
      segmentId: options?.segmentId ?? null
    }
  };
}

function buildFirstCandidateReviewPageData(
  selectedCardId: string
): ReviewFirstCandidatePageData {
  const selectedCard = buildQueueCard(selectedCardId);
  const queueCardIds = [selectedCard.id, "card-b", "card-c"];

  return {
    media: buildReviewMedia("global"),
    nextCardId: "card-b",
    queue: {
      advanceCards: queueCardIds
        .filter((cardId) => cardId !== selectedCardId)
        .map((cardId) => buildQueueCard(cardId)),
      dailyLimit: 20,
      dueCount: queueCardIds.length,
      effectiveDailyLimit: 20,
      introLabel: "3 card da ripassare adesso.",
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: queueCardIds.length,
      queueLabel: "3 card da ripassare adesso.",
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCount: 0
    },
    queueCardIds,
    scope: "global",
    selectedCard,
    selectedCardContext: {
      bucket: selectedCard.bucket,
      isQueueCard: true,
      position: 1,
      remainingCount: 2,
      reviewStateUpdatedAt: selectedCard.reviewStateUpdatedAt ?? null,
      showAnswer: false
    },
    settings: {
      reviewFrontFurigana: false
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

function buildQueueCard(id: string): ReviewQueueCard {
  return {
    back: `${id} back`,
    bucket: "due",
    bucketDetail: "Richiede attenzione oggi.",
    bucketLabel: "Da ripassare",
    contexts: [],
    createdAt: "2026-04-02T00:00:00.000Z",
    dueAt: "2026-04-02T12:00:00.000Z",
    effectiveState: "review",
    effectiveStateLabel: "Review",
    entries: [],
    front: id,
    gradePreviews: [],
    href: `/media/duel-masters-dm25/review/card/${id}` as Route,
    id,
    mediaSlug: "duel-masters-dm25",
    mediaTitle: "Duel Masters",
    orderIndex: 1,
    pronunciations: [],
    rawReviewLabel: "In review",
    reviewStateUpdatedAt: `2026-04-02T11:00:00.000Z`,
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
    typeLabel: "Recognition"
  };
}
