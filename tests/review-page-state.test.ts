import { describe, expect, it } from "vitest";

import {
  mergeReviewPageData,
  shouldKeepRevealedReviewAnswer,
  type ReviewPageClientData
} from "@/components/review/review-page-state";
import type { ReviewPageData } from "@/lib/review";

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
});
