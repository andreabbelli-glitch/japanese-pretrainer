import { describe, expect, it } from "vitest";

import { ReviewPage } from "@/components/review/review-page";
import type { ReviewPageData } from "@/lib/review-types";

describe("review page", () => {
  it("forwards search params to the review client", () => {
    const searchParams = {
      answered: "2",
      card: "card-a"
    };
    const data = {
      media: {
        slug: "fixture-tcg"
      },
      scope: "media"
    } as ReviewPageData;

    const element = ReviewPage({
      data,
      searchParams
    });

    expect(element.props.searchParams).toEqual(searchParams);
  });
});
