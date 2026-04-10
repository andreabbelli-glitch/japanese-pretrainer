import { describe, expect, it } from "vitest";

import { resolveKanjiClashSubmitLiveMessage } from "@/components/kanji-clash/kanji-clash-round-live-message";

import { buildKanjiClashSessionActionResult } from "./helpers/kanji-clash-test-data";

describe("kanji clash round live message", () => {
  it("does not emit a success announcement for incorrect answers", () => {
    const result = buildKanjiClashSessionActionResult({
      isCorrect: false
    });

    expect(resolveKanjiClashSubmitLiveMessage(result)).toBeNull();
  });

  it("emits the correct success announcement for correct answers", () => {
    const result = buildKanjiClashSessionActionResult({
      isCorrect: true
    });

    expect(resolveKanjiClashSubmitLiveMessage(result)).toBe(
      "Risposta corretta. Round successivo caricato."
    );
  });
});
