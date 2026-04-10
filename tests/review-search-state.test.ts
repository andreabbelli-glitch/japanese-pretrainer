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
});
