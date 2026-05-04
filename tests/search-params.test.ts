import { describe, expect, it } from "vitest";

import {
  readFirstNonEmptySearchParam,
  readMatchingSearchParam
} from "@/lib/search-params";

describe("search param helpers", () => {
  it("keeps the first non-empty duplicated value", () => {
    expect(readFirstNonEmptySearchParam(["", "  /review  "])).toBe("/review");
  });

  it("skips invalid duplicated values until a matcher accepts one", () => {
    expect(
      readMatchingSearchParam(["bad", "  term  "], (value) => value === "term")
    ).toBe("term");
  });
});
