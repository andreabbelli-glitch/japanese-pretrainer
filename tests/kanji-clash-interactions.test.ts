import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveKanjiClashRoundSideFromKey,
  resolveKanjiClashRoundSideFromSwipe,
  shouldIgnoreKanjiClashKeyboardTarget
} from "@/components/kanji-clash/kanji-clash-interactions";

class TestHTMLElement {
  isContentEditable: boolean;

  constructor(isContentEditable = false) {
    this.isContentEditable = isContentEditable;
  }
}

class TestHTMLInputElement extends TestHTMLElement {}

class TestHTMLSelectElement extends TestHTMLElement {}

class TestHTMLTextAreaElement extends TestHTMLElement {}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("kanji clash interactions", () => {
  it("maps keyboard arrows to the expected sides", () => {
    expect(resolveKanjiClashRoundSideFromKey("ArrowLeft")).toBe("left");
    expect(resolveKanjiClashRoundSideFromKey("ArrowRight")).toBe("right");
    expect(resolveKanjiClashRoundSideFromKey("Enter")).toBeNull();
  });

  it("ignores keyboard shortcuts while focus is inside editable controls", () => {
    vi.stubGlobal(
      "HTMLElement",
      TestHTMLElement as unknown as typeof HTMLElement
    );
    vi.stubGlobal(
      "HTMLInputElement",
      TestHTMLInputElement as unknown as typeof HTMLInputElement
    );
    vi.stubGlobal(
      "HTMLSelectElement",
      TestHTMLSelectElement as unknown as typeof HTMLSelectElement
    );
    vi.stubGlobal(
      "HTMLTextAreaElement",
      TestHTMLTextAreaElement as unknown as typeof HTMLTextAreaElement
    );

    expect(shouldIgnoreKanjiClashKeyboardTarget(null)).toBe(false);
    expect(
      shouldIgnoreKanjiClashKeyboardTarget(
        new TestHTMLElement(true) as unknown as EventTarget
      )
    ).toBe(true);
    expect(
      shouldIgnoreKanjiClashKeyboardTarget(
        new TestHTMLInputElement() as unknown as EventTarget
      )
    ).toBe(true);
    expect(
      shouldIgnoreKanjiClashKeyboardTarget(
        new TestHTMLSelectElement() as unknown as EventTarget
      )
    ).toBe(true);
    expect(
      shouldIgnoreKanjiClashKeyboardTarget(
        new TestHTMLTextAreaElement() as unknown as EventTarget
      )
    ).toBe(true);
    expect(
      shouldIgnoreKanjiClashKeyboardTarget(
        new TestHTMLElement(false) as unknown as EventTarget
      )
    ).toBe(false);
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
