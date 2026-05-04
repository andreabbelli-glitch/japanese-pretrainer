import { describe, expect, it } from "vitest";

import {
  readFirstNonEmptySearchParam,
  readMatchingSearchParam,
  readPositiveIntegerSearchParam
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

  it("skips invalid duplicated values until it finds a safe positive integer", () => {
    expect(readPositiveIntegerSearchParam(["0", "-1", "  12  "])).toBe(12);
  });

  it("rejects unsafe positive integers", () => {
    expect(readPositiveIntegerSearchParam("9007199254740992")).toBeUndefined();
  });
});
