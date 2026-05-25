import { describe, expect, it } from "vitest";

import {
  buildPedagogicalPitchDisplay,
  selectDisplayVariantPairs
} from "@/features/pitch-accent/tooling";
import type {
  PitchAccentMinimalPairsCorpus,
  PitchAccentPatternKey
} from "@/features/pitch-accent/types";

describe("pitch accent display variant benchmark", () => {
  it("builds a didactic relative pitch curve while preserving long gaps", () => {
    const display = buildPedagogicalPitchDisplay({
      rawValues: [100, 105, 0, 115, 0, 0, 0, 0, 0, 150, 155],
      sampleIntervalMs: 20
    });

    expect(display.medianHz).toBeGreaterThan(0);
    expect(display.values[2]).not.toBeNull();
    expect(display.values.slice(4, 9)).toEqual([null, null, null, null, null]);
    expect(
      display.values.some((value) => typeof value === "number" && value < 0)
    ).toBe(true);
    expect(
      display.values.some((value) => typeof value === "number" && value > 0)
    ).toBe(true);
    expect(display.domain.min).toBeLessThan(0);
    expect(display.domain.max).toBeGreaterThan(0);
  });

  it("selects at least ten pairs while covering pitch0 through pitch4 repeatedly", () => {
    const corpus = buildFixtureCorpus();
    const selectedPairs = selectDisplayVariantPairs(corpus, 10);
    const pitchCounts = new Map<number, number>();

    for (const pair of selectedPairs) {
      for (const option of pair.options) {
        pitchCounts.set(
          option.pitchAccent,
          (pitchCounts.get(option.pitchAccent) ?? 0) + 1
        );
      }
    }

    expect(selectedPairs).toHaveLength(10);
    for (const pitchAccent of [0, 1, 2, 3, 4]) {
      expect(pitchCounts.get(pitchAccent)).toBeGreaterThanOrEqual(2);
    }
  });
});

function buildFixtureCorpus(): PitchAccentMinimalPairsCorpus {
  return {
    pairs: Array.from({ length: 10 }, (_, index) => {
      const firstPitch = index % 5;
      const secondPitch = (index + 2) % 5;

      return {
        hasDevoiced: false,
        id: `pair-${index}`,
        kana: `かな${index}`,
        optionCount: 2,
        options: [
          buildOption(index, 0, firstPitch),
          buildOption(index, 1, secondPitch)
        ],
        patternKeys: [
          `pitch${firstPitch}` as PitchAccentPatternKey,
          `pitch${secondPitch}` as PitchAccentPatternKey
        ]
      };
    }),
    source: {
      importedAt: "2026-05-26T00:00:00.000Z",
      license: "fixture",
      repository: "fixture",
      revision: "fixture"
    },
    version: 1
  };
}

function buildOption(
  pairIndex: number,
  optionIndex: number,
  pitchAccent: number
) {
  return {
    accentedMora: pitchAccent,
    audioSrc: `/vendor/minimal-pairs/audio/pair-${pairIndex}/${optionIndex}.aac`,
    id: `pair-${pairIndex}:${optionIndex}`,
    moraCount: 4,
    pitchAccent,
    rawPronunciation: `カナ${pairIndex}`,
    silencedMoras: []
  };
}
