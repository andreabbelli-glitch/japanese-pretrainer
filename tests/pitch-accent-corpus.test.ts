import { describe, expect, it } from "vitest";

import {
  filterPitchAccentMinimalPairs,
  getPitchAccentPatternKey,
  planPitchAccentSessionTrials,
  validatePitchAccentMinimalPairsCorpus,
  type PitchAccentMinimalPairsCorpus
} from "@/features/pitch-accent/model";

const fixtureCorpus: PitchAccentMinimalPairsCorpus = {
  pairs: [
    {
      hasDevoiced: false,
      id: "pair-a",
      kana: "はし",
      optionCount: 2,
      options: [
        {
          accentedMora: 0,
          audioSrc: "/vendor/minimal-pairs/audio/pair-a-0.ogg",
          id: "pair-a:0",
          moraCount: 2,
          pitchAccent: 0,
          rawPronunciation: "ハシ",
          silencedMoras: []
        },
        {
          accentedMora: 1,
          audioSrc: "/vendor/minimal-pairs/audio/pair-a-1.ogg",
          id: "pair-a:1",
          moraCount: 2,
          pitchAccent: 1,
          rawPronunciation: "ハシ",
          silencedMoras: []
        }
      ],
      patternKeys: ["pitch0", "pitch1"]
    },
    {
      hasDevoiced: false,
      id: "pair-b",
      kana: "あめ",
      optionCount: 2,
      options: [
        {
          accentedMora: 0,
          audioSrc: "/vendor/minimal-pairs/audio/pair-b-0.ogg",
          id: "pair-b:0",
          moraCount: 2,
          pitchAccent: 0,
          rawPronunciation: "アメ",
          silencedMoras: []
        },
        {
          accentedMora: 2,
          audioSrc: "/vendor/minimal-pairs/audio/pair-b-1.ogg",
          id: "pair-b:1",
          moraCount: 2,
          pitchAccent: 2,
          rawPronunciation: "アメ",
          silencedMoras: []
        }
      ],
      patternKeys: ["pitch0"]
    },
    {
      hasDevoiced: true,
      id: "pair-c",
      kana: "しかく",
      optionCount: 2,
      options: [
        {
          accentedMora: 3,
          audioSrc: "/vendor/minimal-pairs/audio/pair-c-0.ogg",
          id: "pair-c:0",
          moraCount: 3,
          pitchAccent: 3,
          rawPronunciation: "シカク",
          silencedMoras: [1]
        },
        {
          accentedMora: 1,
          audioSrc: "/vendor/minimal-pairs/audio/pair-c-1.ogg",
          id: "pair-c:1",
          moraCount: 3,
          pitchAccent: 1,
          rawPronunciation: "シカク",
          silencedMoras: [1]
        }
      ],
      patternKeys: ["pitch0", "pitch1"]
    }
  ],
  source: {
    importedAt: "2026-05-25T00:00:00.000Z",
    license: "GPL-3.0",
    repository: "https://github.com/Kuuuube/minimal-pairs",
    revision: "fixture"
  },
  version: 1
};

describe("pitch accent minimal pairs corpus", () => {
  it("classifies heiban, atamadaka, odaka, and nakadaka buckets", () => {
    expect(getPitchAccentPatternKey({ moraCount: 3, pitchAccent: 0 })).toBe(
      "pitch0"
    );
    expect(getPitchAccentPatternKey({ moraCount: 3, pitchAccent: 3 })).toBe(
      "pitch0"
    );
    expect(getPitchAccentPatternKey({ moraCount: 3, pitchAccent: 1 })).toBe(
      "pitch1"
    );
    expect(getPitchAccentPatternKey({ moraCount: 4, pitchAccent: 2 })).toBe(
      "pitch2"
    );
    expect(getPitchAccentPatternKey({ moraCount: 5, pitchAccent: 4 })).toBe(
      "pitch4"
    );
  });

  it("filters selected patterns lazily or strictly and supports devoiced-only", () => {
    expect(
      filterPitchAccentMinimalPairs(fixtureCorpus, {
        onlyDevoiced: false,
        patternKeys: ["pitch1"],
        strictPairFinding: false
      }).map((pair) => pair.id)
    ).toEqual(["pair-a", "pair-c"]);

    expect(
      filterPitchAccentMinimalPairs(fixtureCorpus, {
        onlyDevoiced: false,
        patternKeys: ["pitch1"],
        strictPairFinding: true
      }).map((pair) => pair.id)
    ).toEqual([]);

    expect(
      filterPitchAccentMinimalPairs(fixtureCorpus, {
        onlyDevoiced: true,
        patternKeys: ["pitch0", "pitch1"],
        strictPairFinding: false
      }).map((pair) => pair.id)
    ).toEqual(["pair-c"]);
  });

  it("plans deterministic session trials from eligible pairs", () => {
    const firstPlan = planPitchAccentSessionTrials({
      corpus: fixtureCorpus,
      count: 3,
      filters: {
        onlyDevoiced: false,
        patternKeys: ["pitch0", "pitch1"],
        strictPairFinding: false
      },
      seed: "seed-a",
      sessionId: "session-a"
    });
    const secondPlan = planPitchAccentSessionTrials({
      corpus: fixtureCorpus,
      count: 3,
      filters: {
        onlyDevoiced: false,
        patternKeys: ["pitch0", "pitch1"],
        strictPairFinding: false
      },
      seed: "seed-a",
      sessionId: "session-a"
    });

    expect(firstPlan).toEqual(secondPlan);
    expect(firstPlan).toHaveLength(3);
    expect(new Set(firstPlan.map((trial) => trial.pairId)).size).toBe(3);
    expect(
      firstPlan.every((trial) =>
        trial.options.some((option) => option.id === trial.correctOptionId)
      )
    ).toBe(true);
  });

  it("keeps planned sessions at the requested count for narrow filters", () => {
    const plan = planPitchAccentSessionTrials({
      corpus: fixtureCorpus,
      count: 5,
      filters: {
        onlyDevoiced: true,
        patternKeys: ["pitch0", "pitch1"],
        strictPairFinding: false
      },
      seed: "narrow-seed",
      sessionId: "session-narrow"
    });

    expect(plan).toHaveLength(5);
    expect(new Set(plan.map((trial) => trial.trialId)).size).toBe(5);
    expect(new Set(plan.map((trial) => trial.pairId))).toEqual(
      new Set(["pair-c"])
    );
  });

  it("validates manifest invariants before serving the drill", () => {
    expect(validatePitchAccentMinimalPairsCorpus(fixtureCorpus).ok).toBe(true);
    expect(
      validatePitchAccentMinimalPairsCorpus({
        ...fixtureCorpus,
        pairs: [
          {
            ...fixtureCorpus.pairs[0]!,
            options: [fixtureCorpus.pairs[0]!.options[0]!],
            optionCount: 1
          }
        ]
      }).errors
    ).toContain("pair-a must include at least two answer options.");
    expect(
      validatePitchAccentMinimalPairsCorpus({
        ...fixtureCorpus,
        pairs: [
          {
            ...fixtureCorpus.pairs[0]!,
            id: "../escape"
          }
        ]
      }).errors
    ).toContain("../escape has an unsafe pair id.");
  });
});
