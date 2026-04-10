import { describe, expect, it } from "vitest";

import {
  buildSimilarKanjiDataset,
  findKanjiClashSimilarKanjiEntry,
  getKanjiClashSimilarKanjiDataset
} from "@/lib/kanji-clash";

describe("kanji clash similar-kanji dataset", () => {
  it("loads the generated dataset with symmetric lookups", () => {
    const dataset = getKanjiClashSimilarKanjiDataset();
    const waitVsHold = findKanjiClashSimilarKanjiEntry("待", "持");
    const holdVsWait = findKanjiClashSimilarKanjiEntry("持", "待");

    expect(dataset.rules.minimumMetricScore).toBe(0.75);
    expect(waitVsHold).not.toBeNull();
    expect(waitVsHold).toEqual(holdVsWait);
    expect(waitVsHold).toMatchObject({
      leftKanji: "待",
      rightKanji: "持",
      sources: {
        whiteRabbit: true
      }
    });
  });

  it("freezes the shared dataset and lookup entries", () => {
    const dataset = getKanjiClashSimilarKanjiDataset();
    const entry = findKanjiClashSimilarKanjiEntry("待", "持");

    expect(entry).not.toBeNull();
    if (!entry) {
      return;
    }

    expect(Object.isFrozen(dataset)).toBe(true);
    expect(Object.isFrozen(dataset.rules)).toBe(true);
    expect(Object.isFrozen(dataset.swaps)).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.sources)).toBe(true);
    expect(entry).toBe(
      dataset.swaps.find((swap) => swap.leftKanji === "待" && swap.rightKanji === "持")
    );
  });

  it("keeps lookup results stable after mutation attempts", () => {
    const dataset = getKanjiClashSimilarKanjiDataset();
    const entry = findKanjiClashSimilarKanjiEntry("待", "持");

    expect(entry).not.toBeNull();
    if (!entry) {
      return;
    }

    const originalConfidence = entry.confidence;

    expect(() => {
      (entry.sources as { whiteRabbit: boolean }).whiteRabbit = false;
    }).toThrow();

    expect(() => {
      dataset.swaps.push(entry);
    }).toThrow();

    expect(findKanjiClashSimilarKanjiEntry("待", "持")).toBe(entry);
    expect(findKanjiClashSimilarKanjiEntry("待", "持")).toMatchObject({
      confidence: originalConfidence,
      sources: {
        whiteRabbit: true
      }
    });
  });

  it("accepts trimmed single-kanji manual overrides", () => {
    const dataset = buildSimilarKanjiDataset({
      generatedAt: "2026-04-11T00:00:00.000Z",
      manualIncludes: [[" 待 ", " 持 "]],
      minimumMetricScore: 0.75,
      rulesVersion: 1
    });

    expect(dataset.swaps).toEqual([
      {
        confidence: 1,
        leftKanji: "待",
        rightKanji: "持",
        sources: {
          manualExclude: false,
          manualInclude: true,
          strokeEditDistance: null,
          whiteRabbit: false,
          yehAndLiRadical: null
        }
      }
    ]);
  });

  it("merges the three sources plus manual overrides into a single swap list", () => {
    const dataset = buildSimilarKanjiDataset({
      generatedAt: "2026-04-11T00:00:00.000Z",
      manualExcludes: [["木", "本"]],
      manualIncludes: [["待", "持"]],
      minimumMetricScore: 0.75,
      rulesVersion: 1,
      strokeEditDistance: [
        ["待", "持", 0.8],
        ["木", "本", 0.76]
      ],
      whiteRabbit: [["待", "持"]],
      yehAndLiRadical: [
        ["待", "持", 0.78],
        ["木", "本", 0.9]
      ]
    });

    expect(dataset.swaps).toEqual([
      {
        confidence: 1,
        leftKanji: "待",
        rightKanji: "持",
        sources: {
          manualExclude: false,
          manualInclude: true,
          strokeEditDistance: 0.8,
          whiteRabbit: true,
          yehAndLiRadical: 0.78
        }
      }
    ]);
  });

  it("keeps the highest stroke score when duplicate metric rows arrive in reverse order", () => {
    const dataset = buildSimilarKanjiDataset({
      generatedAt: "2026-04-11T00:00:00.000Z",
      minimumMetricScore: 0.75,
      rulesVersion: 1,
      strokeEditDistance: [
        ["未", "末", 0.78],
        ["末", "未", 0.9],
        ["未", "末", 0.85]
      ]
    });

    expect(dataset.swaps).toEqual([
      {
        confidence: 0.25,
        leftKanji: "未",
        rightKanji: "末",
        sources: {
          manualExclude: false,
          manualInclude: false,
          strokeEditDistance: 0.9,
          whiteRabbit: false,
          yehAndLiRadical: null
        }
      }
    ]);
  });

  it("keeps the highest radical score when duplicate metric rows arrive in reverse order", () => {
    const dataset = buildSimilarKanjiDataset({
      generatedAt: "2026-04-11T00:00:00.000Z",
      minimumMetricScore: 0.75,
      rulesVersion: 1,
      yehAndLiRadical: [
        ["未", "末", 0.76],
        ["末", "未", 0.95],
        ["未", "末", 0.8]
      ]
    });

    expect(dataset.swaps).toEqual([
      {
        confidence: 0.25,
        leftKanji: "未",
        rightKanji: "末",
        sources: {
          manualExclude: false,
          manualInclude: false,
          strokeEditDistance: null,
          whiteRabbit: false,
          yehAndLiRadical: 0.95
        }
      }
    ]);
  });

  it("keeps stroke and radical scores independent when both sources repeat", () => {
    const dataset = buildSimilarKanjiDataset({
      generatedAt: "2026-04-11T00:00:00.000Z",
      minimumMetricScore: 0.75,
      rulesVersion: 1,
      strokeEditDistance: [
        ["未", "末", 0.78],
        ["末", "未", 0.9]
      ],
      yehAndLiRadical: [
        ["未", "末", 0.76],
        ["末", "未", 0.94]
      ]
    });

    expect(dataset.swaps).toEqual([
      {
        confidence: 0.5,
        leftKanji: "未",
        rightKanji: "末",
        sources: {
          manualExclude: false,
          manualInclude: false,
          strokeEditDistance: 0.9,
          whiteRabbit: false,
          yehAndLiRadical: 0.94
        }
      }
    ]);
  });

  it.each([
    {
      listName: "manualIncludes" as const,
      overrides: [["待つ", "持つ"]] as const
    },
    {
      listName: "manualIncludes" as const,
      overrides: [["待", "持つ"]] as const
    },
    {
      listName: "manualExcludes" as const,
      overrides: [["待", "待"]] as const
    }
  ])(
    "rejects invalid $listName overrides",
    ({ listName, overrides }) => {
      expect(() =>
        buildSimilarKanjiDataset({
          generatedAt: "2026-04-11T00:00:00.000Z",
          [listName]: overrides,
          minimumMetricScore: 0.75,
          rulesVersion: 1
        })
      ).toThrow(
        `Invalid ${listName}[0]: expected single-kanji swap, got`
      );
    }
  );

  it("ignores metric rows below the configured threshold", () => {
    const dataset = buildSimilarKanjiDataset({
      generatedAt: "2026-04-11T00:00:00.000Z",
      minimumMetricScore: 0.75,
      rulesVersion: 1,
      strokeEditDistance: [["未", "末", 0.74]],
      yehAndLiRadical: [["未", "末", 0.75]]
    });

    expect(dataset.swaps).toEqual([
      {
        confidence: 0.25,
        leftKanji: "未",
        rightKanji: "末",
        sources: {
          manualExclude: false,
          manualInclude: false,
          strokeEditDistance: null,
          whiteRabbit: false,
          yehAndLiRadical: 0.75
        }
      }
    ]);
  });
});
