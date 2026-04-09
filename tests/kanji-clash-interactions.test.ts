import { describe, expect, it } from "vitest";

import {
  resolveKanjiClashRoundSideFromKey,
  resolveKanjiClashRoundSideFromSwipe
} from "@/components/kanji-clash/kanji-clash-interactions";

describe("kanji clash interactions", () => {
  it("maps keyboard arrows to the expected sides", () => {
    expect(resolveKanjiClashRoundSideFromKey("ArrowLeft")).toBe("left");
    expect(resolveKanjiClashRoundSideFromKey("ArrowRight")).toBe("right");
    expect(resolveKanjiClashRoundSideFromKey("Enter")).toBeNull();
  });

  it("maps decisive horizontal swipes to the expected sides", () => {
    expect(resolveKanjiClashRoundSideFromSwipe(-64, 8)).toBe("left");
    expect(resolveKanjiClashRoundSideFromSwipe(72, -4)).toBe("right");
  });

  it("ignores short or mostly vertical swipe gestures", () => {
    expect(resolveKanjiClashRoundSideFromSwipe(-12, 2)).toBeNull();
    expect(resolveKanjiClashRoundSideFromSwipe(48, 52)).toBeNull();
  });
});
