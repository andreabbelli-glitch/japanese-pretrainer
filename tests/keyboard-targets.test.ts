import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isActivationKeyboardTarget,
  isEditableKeyboardTarget
} from "@/features/shared/ui/keyboard-targets";

class StubHTMLElement {}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("keyboard target guards", () => {
  it("recognizes DOM-like controls when HTMLElement comes from another realm", () => {
    vi.stubGlobal("HTMLElement", StubHTMLElement);

    const buttonTarget = buildDomLikeTarget("button");
    const inputTarget = buildDomLikeTarget("input");

    expect(isActivationKeyboardTarget(buttonTarget)).toBe(true);
    expect(isEditableKeyboardTarget(inputTarget)).toBe(true);
  });
});

function buildDomLikeTarget(tagName: string) {
  return {
    getAttribute() {
      return null;
    },
    isContentEditable: false,
    tagName
  } as unknown as EventTarget;
}
