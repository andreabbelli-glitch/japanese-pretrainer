import { describe, expect, it } from "vitest";

import { getKatakanaSpeedPromptFitSize } from "@/components/katakana-speed/katakana-speed-prompt-fit";

describe("katakana speed prompt fit sizing", () => {
  it("scales long katakana prompts down based on visible character count", () => {
    expect(getKatakanaSpeedPromptFitSize("ティ")).toBe("20cqi");
    expect(getKatakanaSpeedPromptFitSize("デリバードポーチ")).toBe("11cqi");
  });
});
