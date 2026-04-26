import { describe, expect, it } from "vitest";

import {
  classifyKatakanaSpeedError,
  generateKatakanaSpeedOptions
} from "@/features/katakana-speed/model";

describe("katakana speed option generation", () => {
  it("includes the target, prefers confusion clusters, and returns stable seeded options", () => {
    const first = generateKatakanaSpeedOptions({
      count: 4,
      seed: "mvp-seed",
      targetItemId: "kana-shi"
    });
    const second = generateKatakanaSpeedOptions({
      count: 4,
      seed: "mvp-seed",
      targetItemId: "kana-shi"
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(new Set(first).size).toBe(first.length);
    expect(first).toContain("kana-shi");
    expect(first).toEqual(
      expect.arrayContaining(["kana-tsu", "kana-so", "kana-n"])
    );
  });

  it("fills from the same family after confusion distractors and respects count", () => {
    const options = generateKatakanaSpeedOptions({
      count: 5,
      seed: "family-fill",
      targetItemId: "chunk-fi"
    });

    expect(options).toHaveLength(5);
    expect(new Set(options).size).toBe(5);
    expect(options).toContain("chunk-fi");
    expect(options).toEqual(expect.arrayContaining(["chunk-fa", "chunk-fe"]));
  });
});

describe("katakana speed error classification", () => {
  it("tags slow correct attempts without adding an error tag", () => {
    expect(
      classifyKatakanaSpeedError({
        actualSurface: "ティ",
        expectedSurface: "ティ",
        responseMs: 1800,
        targetRtMs: 900
      })
    ).toEqual(["slow_correct"]);
  });

  it.each([
    [
      {
        actualSurface: "テイ",
        expectedSurface: "ティ",
        responseMs: 700,
        targetRtMs: 900
      },
      "small_kana_ignored"
    ],
    [
      {
        actualSurface: "フィ",
        expectedSurface: "フィー",
        responseMs: 700,
        targetRtMs: 900
      },
      "long_vowel_missed"
    ],
    [
      {
        actualSurface: "バ",
        expectedSurface: "バッ",
        responseMs: 700,
        targetRtMs: 900
      },
      "sokuon_missed"
    ],
    [
      {
        actualSurface: "ツ",
        expectedSurface: "シ",
        responseMs: 700,
        targetRtMs: 900
      },
      "visual_confusion"
    ],
    [
      {
        actualSurface: "ディ",
        expectedSurface: "ティ",
        responseMs: 700,
        targetRtMs: 900
      },
      "phonological_confusion"
    ],
    [
      {
        actualSurface: "ラ",
        expectedSurface: "ティ",
        responseMs: 700,
        targetRtMs: 900
      },
      "unclassified_error"
    ]
  ] as const)("classifies %s as %s", (attempt, expectedTag) => {
    expect(classifyKatakanaSpeedError(attempt)).toContain(expectedTag);
  });
});
