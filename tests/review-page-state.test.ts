import { describe, expect, it } from "vitest";

import {
  mergeReviewPageData,
  shouldAdoptServerFirstCandidateData,
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

  it("accepts same-progress server data when the requested card changed", () => {
    const currentData = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "global",
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
      scope: "global",
      selectedCard: {
        id: "card-a"
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as unknown as ReviewPageData;

    expect(
      shouldAcceptServerReviewData(currentData, nextData, "card-a", true)
    ).toBe(true);
  });

  it("does not accept requested-card rewinds on media review pages", () => {
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

    expect(
      shouldAcceptServerReviewData(currentData, nextData, "card-a", false)
    ).toBe(false);
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

  it("adopts first-candidate data when the global review query changes", () => {
    const currentData = {
      media: {
        slug: "global-review"
      },
      scope: "global",
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
        slug: "global-review"
      },
      scope: "global",
      selectedCard: {
        id: "card-b"
      },
      selectedCardContext: {
        showAnswer: false
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as unknown as Parameters<typeof shouldAdoptServerFirstCandidateData>[0]["nextData"];

    expect(
      shouldAdoptServerFirstCandidateData({
        currentData,
        nextData,
        globalHydrationRequestKey: "answered:2&card=card-b",
        lastGlobalHydrationRequestKey: "answered:2"
      })
    ).toBe(true);
  });

  it("does not adopt first-candidate data when the global review query stayed the same", () => {
    const currentData = {
      media: {
        slug: "global-review"
      },
      scope: "global",
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
        slug: "global-review"
      },
      scope: "global",
      selectedCard: {
        id: "card-a"
      },
      selectedCardContext: {
        showAnswer: false
      },
      session: {
        answeredCount: 2,
        extraNewCount: 0,
        segmentId: null
      }
    } as unknown as Parameters<typeof shouldAdoptServerFirstCandidateData>[0]["nextData"];

    expect(
      shouldAdoptServerFirstCandidateData({
        currentData,
        nextData,
        globalHydrationRequestKey: "answered:2",
        lastGlobalHydrationRequestKey: "answered:2"
      })
    ).toBe(false);
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
