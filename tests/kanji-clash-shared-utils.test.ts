import { describe, expect, it } from "vitest";

import {
  dedupeStable,
  normalizePositiveInteger
} from "@/lib/kanji-clash/shared-utils";

describe("kanji clash shared utils", () => {
  it("normalizes positive integers with fallback and floor semantics", () => {
    expect(normalizePositiveInteger(undefined, 7)).toBe(7);
    expect(normalizePositiveInteger(Number.NaN, 7)).toBe(7);
    expect(normalizePositiveInteger(4.9, 7)).toBe(4);
    expect(normalizePositiveInteger(-4.9, 7)).toBe(0);
  });

  it("dedupes values stably without reordering first occurrences", () => {
    expect(dedupeStable(["b", "a", "b", "", "a", "c", ""])).toEqual([
      "b",
      "a",
      "",
      "c"
    ]);
  });
});
