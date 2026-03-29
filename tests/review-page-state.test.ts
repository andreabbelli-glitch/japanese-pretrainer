import { describe, expect, it } from "vitest";

import {
  mergeReviewPageData,
  shouldAcceptServerReviewData,
  shouldKeepRevealedReviewAnswer,
  type ReviewPageClientData
} from "@/components/review/review-page-state";
import type { ReviewPageData } from "@/lib/review-types";

describe("review page state", () => {
  it("preserves a revealed answer only when the server keeps the same card", () => {
    expect(
      shouldKeepRevealedReviewAnswer({
        currentCardId: "card-a",
        currentShowAnswer: true,
        nextCardId: "card-a",
        nextShowAnswer: false
      })
    ).toBe(true);

    expect(
      shouldKeepRevealedReviewAnswer({
        currentCardId: "card-a",
        currentShowAnswer: true,
        nextCardId: "card-b",
        nextShowAnswer: false
      })
    ).toBe(false);
  });

  it("keeps an explicit server-side reveal even when the selected card changes", () => {
    expect(
      shouldKeepRevealedReviewAnswer({
        currentCardId: "card-a",
        currentShowAnswer: false,
        nextCardId: "card-b",
        nextShowAnswer: true
      })
    ).toBe(true);
  });

  it("does not carry the revealed answer onto a different card during data merges", () => {
    const currentData = {
      selectedCard: {
        id: "card-a"
      },
      selectedCardContext: {
        showAnswer: true
      }
    } as ReviewPageClientData;

    const nextData = {
      selectedCard: {
        id: "card-b"
      },
      selectedCardContext: {
        gradePreviews: [],
        showAnswer: false
      }
    } as unknown as ReviewPageData;

    expect(mergeReviewPageData(currentData, nextData).selectedCardContext.showAnswer).toBe(
      false
    );
  });

  it("accepts same-progress server data so settings and notices can refresh", () => {
    const currentData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-a"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as ReviewPageClientData;

    const nextData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-a"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as unknown as ReviewPageData;

    expect(shouldAcceptServerReviewData(currentData, nextData)).toBe(true);
  });

  it("rejects same-progress server data when the selected card changed", () => {
    const currentData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-b"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as ReviewPageClientData;

    const nextData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-a"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as unknown as ReviewPageData;

    expect(shouldAcceptServerReviewData(currentData, nextData)).toBe(false);
  });

  it("accepts same-progress server data when the segment filter changed", () => {
    const currentData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-b"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as ReviewPageClientData;

    const nextData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-a"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: "segment_fixture_starter_core"
      }
    } as unknown as ReviewPageData;

    expect(shouldAcceptServerReviewData(currentData, nextData)).toBe(true);
  });

  it("rejects stale server data from an older review step", () => {
    const currentData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-b"
      },
      session: {
        answeredCount: 3,
        extraNewCount: 0,
        segmentId: null
      }
    } as ReviewPageClientData;

    const nextData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media",
      selectedCard: {
        id: "card-a"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as unknown as ReviewPageData;

    expect(shouldAcceptServerReviewData(currentData, nextData)).toBe(false);
  });
});
