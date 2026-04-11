import { describe, expect, it } from "vitest";

import { normalizeReviewSearchState } from "@/lib/review-search-state";

describe("review search state", () => {
  it("keeps fully numeric counters", () => {
    expect(
      normalizeReviewSearchState({
        answered: "12",
        extraNew: "3"
      })
    ).toMatchObject({
      answeredCount: 12,
      extraNewCount: 3
    });
  });

  it("rejects malformed numeric counters instead of partially parsing them", () => {
    expect(
      normalizeReviewSearchState({
        answered: "3abc",
        extraNew: "1e2"
      })
    ).toMatchObject({
      answeredCount: 0,
      extraNewCount: 0
    });
  });

  it("keeps the first non-empty duplicated search param when arrays start empty", () => {
    expect(
      normalizeReviewSearchState({
        answered: ["", "12"],
        card: [" ", "card-fixture-iku"],
        extraNew: ["", "3"],
        notice: ["", "session-top-up"],
        segment: [" ", "segment_fixture_starter_core"],
        show: ["", "answer"]
      })
    ).toMatchObject({
      answeredCount: 12,
      extraNewCount: 3,
      noticeCode: "session-top-up",
      segmentId: "segment_fixture_starter_core",
      selectedCardId: "card-fixture-iku",
      showAnswer: true
    });
  });

  it("skips invalid duplicated counters and reveal flags until it finds a valid review value", () => {
    expect(
      normalizeReviewSearchState({
        answered: ["oops", "12"],
        extraNew: ["1e2", "3"],
        show: ["question", "answer"]
      })
    ).toMatchObject({
      answeredCount: 12,
      extraNewCount: 3,
      showAnswer: true
    });
  });
});
