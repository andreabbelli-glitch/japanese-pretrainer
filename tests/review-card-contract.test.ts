import { describe, expect, it } from "vitest";

import type { ReviewCardListItem } from "@/db/queries";
import type { ReviewCardSource } from "@/lib/review-card-contract";

type ExpectAssignable<TValue, TTarget> = TValue extends TTarget ? true : never;
type ReviewCardListItemMatchesReviewContract = ExpectAssignable<
  ReviewCardListItem,
  ReviewCardSource
>;

describe("review card contract", () => {
  it("accepts database review card rows structurally", () => {
    const assertion: ReviewCardListItemMatchesReviewContract = true;

    expect(assertion).toBe(true);
  });
});
