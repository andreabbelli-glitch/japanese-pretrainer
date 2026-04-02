import { renderToStaticMarkup } from "react-dom/server";
import type { Route } from "next";
import { describe, expect, it } from "vitest";

import { ReviewPageStage } from "@/components/review/review-page-stage";
import {
  buildSuccessfulHydrationResult,
  buildReviewGradePreviewLookup,
  resolveHydratedFirstCandidateRevealedCardId
} from "@/components/review/review-page-client";
import type { ReviewPageClientData } from "@/components/review/review-page-state";
import type { ReviewPageData } from "@/lib/review-types";

describe("review page client hydration", () => {
  it("keeps an early reveal open when the first-candidate hydration catches up on the same card", () => {
    const currentData = buildCurrentReviewPageClientData({
      cardId: "card-a",
      showAnswer: true
    });
    const nextData = buildFirstCandidateReviewPageData({
      cardId: "card-a"
    });

    expect(
      resolveHydratedFirstCandidateRevealedCardId({
        currentData,
        nextData
      })
    ).toBe("card-a");
  });

  it("builds fallback grade previews from the visible queue card before full hydration", () => {
    const data = buildFirstCandidateReviewPageData({
      cardId: "card-a"
    });

    const lookup = buildReviewGradePreviewLookup({
      data,
      fullSelectedCardContext: null,
      now: new Date("2026-04-02T12:00:00.000Z")
    });

    expect(lookup.size).toBe(4);
    expect(lookup.get("again")).toBeDefined();
    expect(lookup.get("good")).toBeDefined();
  });

  it("clears stale hydration errors after a successful full-data refresh", () => {
    const currentData = buildCurrentReviewPageClientData({
      cardId: "card-a",
      showAnswer: false
    });
    const nextData = buildFullReviewPageData({
      cardId: "card-b"
    });

    expect(buildSuccessfulHydrationResult(currentData, nextData)).toEqual({
      clientError: null,
      queueCardIds: ["card-b", "card-c"],
      viewData: expect.objectContaining({
        selectedCard: expect.objectContaining({
          id: "card-b"
        })
      })
    });
  });

  it("renders grading controls even when the stage is still hydrating the full payload", () => {
    const data = buildFirstCandidateReviewPageData({
      cardId: "card-a",
      showAnswer: true
    });
    const gradePreviewLookup = buildReviewGradePreviewLookup({
      data,
      fullSelectedCardContext: null,
      now: new Date("2026-04-02T12:00:00.000Z")
    });

    const markup = renderToStaticMarkup(
      ReviewPageStage({
        additionalNewCount: 0,
        contextualGlossaryHref: "/glossary",
        fullSelectedCard: null,
        gradePreviewLookup,
        handleGradeCard: () => {},
        handleMarkKnown: () => {},
        handleResetCard: () => {},
        handleRevealAnswer: () => {},
        handleSetLearning: () => {},
        handleToggleSuspended: () => {},
        hasSupportCards: false,
        isAnswerRevealed: true,
        isFullReviewPageData: false,
        isGlobalReview: true,
        isHydratingFullData: true,
        isPending: false,
        remainingCount: 3,
        sessionHref: "/review",
        showCompletionState: false,
        showFrontFurigana: true,
        viewData: data
      })
    );

    expect(markup).toContain("review-grade-grid");
    expect(markup).toContain("Again");
    expect(markup).toContain("Good");
    expect(markup).toContain("Hard");
    expect(markup).toContain("Easy");
  });
});

function buildCurrentReviewPageClientData(input: {
  cardId: string;
  showAnswer: boolean;
}): ReviewPageClientData {
  return {
    media: {
      glossaryHref: "/glossary",
      href: "/",
      reviewHref: "/review",
      slug: "global-review",
      title: "Review globale"
    },
    queue: {
      dailyLimit: 20,
      dueCount: 1,
      effectiveDailyLimit: 20,
      introLabel: "1 card da ripassare adesso.",
      manualCards: [],
      manualCount: 0,
      newAvailableCount: 1,
      newQueuedCount: 1,
      queueCount: 1,
      queueLabel: "1 card da ripassare adesso.",
      suspendedCards: [],
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCards: [],
      upcomingCount: 0
    },
    scope: "global",
    selectedCard: {
      back: "mazzo / deck",
      bucket: "new",
      bucketDetail: "Pronta per entrare nella coda giornaliera senza perdere il legame con il Glossary.",
      bucketLabel: "Nuova",
      contexts: [],
      createdAt: "2026-04-02T00:00:00.000Z",
      dueAt: null,
      effectiveState: "new",
      effectiveStateLabel: "Nuova",
      entries: [],
      front: "山札",
      gradePreviews: [],
      href: "/media/duel-masters-dm25/review/card/card-a" as Route,
      id: input.cardId,
      mediaSlug: "duel-masters-dm25",
      mediaTitle: "Duel Masters",
      pronunciations: [],
      rawReviewLabel: "Nuova",
      reviewSeedState: {
        difficulty: null,
        dueAt: null,
        lapses: 0,
        lastReviewedAt: null,
        learningSteps: 0,
        reps: 0,
        scheduledDays: 0,
        stability: null,
        state: "new"
      },
      segmentTitle: "Tcg Core",
      typeLabel: "Recognition"
    },
    selectedCardContext: {
      bucket: "new",
      gradePreviews: [],
      isQueueCard: true,
      position: 1,
      remainingCount: 0,
      showAnswer: input.showAnswer
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: 0,
      extraNewCount: 0,
      segmentId: null
    }
  } as unknown as ReviewPageClientData;
}

function buildFirstCandidateReviewPageData(input: {
  cardId: string;
  showAnswer?: boolean;
}) {
  return {
    media: {
      glossaryHref: "/glossary",
      href: "/",
      reviewHref: "/review",
      slug: "global-review",
      title: "Review globale"
    },
    nextCardId: null,
    queue: {
      dailyLimit: 20,
      dueCount: 1,
      effectiveDailyLimit: 20,
      introLabel: "1 card da ripassare adesso.",
      manualCount: 0,
      newAvailableCount: 1,
      newQueuedCount: 1,
      queueCount: 1,
      queueLabel: "1 card da ripassare adesso.",
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCount: 0
    },
    scope: "global",
    selectedCard: {
      back: "mazzo / deck",
      bucket: "new",
      bucketDetail: "Pronta per entrare nella coda giornaliera senza perdere il legame con il Glossary.",
      bucketLabel: "Nuova",
      createdAt: "2026-04-02T00:00:00.000Z",
      dueAt: null,
      effectiveState: "new",
      effectiveStateLabel: "Nuova",
      exampleIt: undefined,
      exampleJp: undefined,
      front: "山札",
      href: "/media/duel-masters-dm25/review/card/card-a" as Route,
      id: input.cardId,
      mediaSlug: "duel-masters-dm25",
      mediaTitle: "Duel Masters",
      notes: undefined,
      orderIndex: 1,
      rawReviewLabel: "Nuova",
      reading: "やまふだ",
      reviewSeedState: {
        difficulty: null,
        dueAt: null,
        fsrsDesiredRetention: 0.9,
        fsrsWeights: null,
        lapses: 0,
        lastReviewedAt: null,
        learningSteps: 0,
        reps: 0,
        scheduledDays: 0,
        stability: null,
        state: "new"
      },
      segmentTitle: "Tcg Core",
      typeLabel: "Recognition"
    },
    selectedCardContext: {
      bucket: "new",
      isQueueCard: true,
      position: 1,
      remainingCount: 0,
      showAnswer: input.showAnswer ?? false
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: 0,
      extraNewCount: 0,
      segmentId: null
    }
  } as unknown as ReviewPageClientData;
}

function buildFullReviewPageData(input: {
  cardId: string;
  showAnswer?: boolean;
}): ReviewPageData {
  return {
    media: {
      glossaryHref: "/glossary",
      href: "/",
      reviewHref: "/review",
      slug: "global-review",
      title: "Review globale"
    },
    queue: {
      dailyLimit: 20,
      dueCount: 2,
      effectiveDailyLimit: 20,
      introLabel: "2 card da ripassare adesso.",
      manualCards: [],
      manualCount: 0,
      newAvailableCount: 0,
      newQueuedCount: 0,
      queueCount: 2,
      queueLabel: "2 card da ripassare adesso.",
      suspendedCards: [],
      suspendedCount: 0,
      tomorrowCount: 0,
      upcomingCards: [],
      upcomingCount: 0
    },
    queueCardIds: [input.cardId, "card-c"],
    scope: "global",
    selectedCard: {
      back: "costo / cost",
      bucket: "due",
      bucketDetail: "Richiede attenzione oggi.",
      bucketLabel: "Da ripassare",
      contexts: [],
      createdAt: "2026-04-02T00:00:00.000Z",
      dueAt: "2026-04-02T12:00:00.000Z",
      effectiveState: "review",
      effectiveStateLabel: "Review",
      entries: [],
      front: "コスト",
      gradePreviews: [],
      href: `/media/duel-masters-dm25/review/card/${input.cardId}` as Route,
      id: input.cardId,
      mediaSlug: "duel-masters-dm25",
      mediaTitle: "Duel Masters",
      pronunciations: [],
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
      segmentTitle: "Tcg Core",
      typeLabel: "Recognition"
    },
    selectedCardContext: {
      bucket: "due",
      gradePreviews: [],
      isQueueCard: true,
      position: 1,
      remainingCount: 1,
      showAnswer: input.showAnswer ?? false
    },
    settings: {
      reviewFrontFurigana: true
    },
    session: {
      answeredCount: 0,
      extraNewCount: 0,
      segmentId: null
    }
  } as unknown as ReviewPageData;
}
