import { describe, expect, it } from "vitest";

import { createKanjiClashRoundResponseTimer } from "@/components/kanji-clash/kanji-clash-response-timing";

describe("kanji clash response timing", () => {
  it("tracks think time from the first presentation of a round", () => {
    const timer = createKanjiClashRoundResponseTimer();

    expect(timer.getResponseMs(100)).toBeNull();

    timer.markRoundPresented("round-a", 1_000);
    expect(timer.getResponseMs(1_250)).toBe(250);

    timer.markRoundPresented("round-a", 2_000);
    expect(timer.getResponseMs(2_400)).toBe(1_400);

    timer.markRoundPresented("round-b", 3_000);
    expect(timer.getResponseMs(3_180)).toBe(180);
  });
});
