import { describe, expect, it } from "vitest";

import { buildPronunciationData } from "@/features/pronunciation/model/data";

describe("pronunciation data", () => {
  it("serves local media audio from the generated static cache namespace", () => {
    expect(
      buildPronunciationData("sample-anime", {
        audioSrc: "assets/audio/term/term-taberu/term-taberu.ogg",
        audioUpdatedAt: "2026-01-02T03:04:05.000Z",
        reading: "たべる"
      })?.src
    ).toBe(
      "/media-audio/sample-anime/audio/term/term-taberu/term-taberu.ogg?v=2026-01-02T03%3A04%3A05.000Z"
    );
  });

  it("uses the entry updatedAt as a cache-busting fallback", () => {
    expect(
      buildPronunciationData("sample-anime", {
        audioSrc: "assets/audio/grammar/grammar-teiru/grammar-teiru.mp3",
        audioUpdatedAt: " ",
        reading: "ている",
        updatedAt: "2026-02-03T04:05:06.000Z"
      })?.src
    ).toBe(
      "/media-audio/sample-anime/audio/grammar/grammar-teiru/grammar-teiru.mp3?v=2026-02-03T04%3A05%3A06.000Z"
    );
  });

  it("omits cache-busting when no entry version is available", () => {
    expect(
      buildPronunciationData("sample-anime", {
        audioSrc: "assets/audio/term/term-kiku/kiku.mp3",
        reading: "きく"
      })?.src
    ).toBe("/media-audio/sample-anime/audio/term/term-kiku/kiku.mp3");
  });
});
