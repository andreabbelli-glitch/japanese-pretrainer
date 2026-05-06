import { describe, expect, it } from "vitest";

import { percentile } from "@/features/katakana-speed/server/codecs";

describe("katakana speed codecs", () => {
  it("computes percentiles from unsorted samples", () => {
    expect(percentile([900, 300, 700], 0.5)).toBe(700);
    expect(percentile([900, 300, 700], 0.9)).toBe(900);
    expect(percentile([900, Number.NaN, 300, 700], 0.9)).toBe(900);
  });
});
