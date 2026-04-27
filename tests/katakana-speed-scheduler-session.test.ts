import { describe, expect, it } from "vitest";

import {
  computeKatakanaSpeedPriority,
  createInitialKatakanaSpeedState,
  generateKatakanaSpeedSessionPlan,
  updateKatakanaSpeedStateAfterAttempt
} from "@/features/katakana-speed/model";

describe("katakana speed scheduler state", () => {
  it("creates serializable initial state for the catalog", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-25T08:00:00.000Z"
    });

    expect(state.schedulerVersion).toBe("katakana_speed_mvp_v1");
    expect(state.items["chunk-ti"]).toMatchObject({
      itemId: "chunk-ti",
      lapses: 0,
      reps: 0,
      slowStreak: 0,
      status: "new"
    });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it("raises priority for wrong, slow, and confused items while lowering stable items", () => {
    const initial = createInitialKatakanaSpeedState({
      now: "2026-04-25T08:00:00.000Z"
    });
    const stable = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "ティ",
      expectedSurface: "ティ",
      itemId: "chunk-ti",
      now: "2026-04-25T08:01:00.000Z",
      responseMs: 500,
      state: initial
    });
    const wrong = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "ツ",
      expectedSurface: "シ",
      itemId: "kana-shi",
      now: "2026-04-25T08:02:00.000Z",
      responseMs: 1300,
      state: stable
    });

    const stablePriority = computeKatakanaSpeedPriority({
      itemId: "chunk-ti",
      now: "2026-04-25T08:03:00.000Z",
      state: wrong
    });
    const wrongPriority = computeKatakanaSpeedPriority({
      itemId: "kana-shi",
      now: "2026-04-25T08:03:00.000Z",
      state: wrong
    });

    expect(wrong.items["kana-shi"].lastErrorTags).toContain("visual_confusion");
    expect(wrongPriority).toBeGreaterThan(stablePriority);
  });

  it("does not promote repeated slow correct attempts as mastery", () => {
    const initial = createInitialKatakanaSpeedState({
      now: "2026-04-25T08:00:00.000Z"
    });
    const firstSlow = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "ティ",
      expectedSurface: "ティ",
      itemId: "chunk-ti",
      now: "2026-04-25T08:01:00.000Z",
      responseMs: 1800,
      state: initial
    });
    const secondSlow = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "ティ",
      expectedSurface: "ティ",
      itemId: "chunk-ti",
      now: "2026-04-25T08:02:00.000Z",
      responseMs: 1700,
      state: firstSlow
    });

    expect(secondSlow.items["chunk-ti"]).toMatchObject({
      correctStreak: 0,
      lastCorrectAt: null,
      lastErrorTags: ["slow_correct"],
      slowStreak: 2,
      status: "learning"
    });
    expect(
      computeKatakanaSpeedPriority({
        itemId: "chunk-ti",
        now: "2026-04-25T08:03:00.000Z",
        state: secondSlow
      })
    ).toBeGreaterThan(
      computeKatakanaSpeedPriority({
        itemId: "chunk-di",
        now: "2026-04-25T08:03:00.000Z",
        state: secondSlow
      })
    );
  });
});

describe("katakana speed session planning", () => {
  it("defaults to the focused daily training loop", () => {
    const initial = createInitialKatakanaSpeedState({
      now: "2026-04-25T08:00:00.000Z"
    });
    const state = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "ツ",
      expectedSurface: "シ",
      itemId: "kana-shi",
      now: "2026-04-25T08:01:00.000Z",
      responseMs: 1400,
      state: initial
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 8,
      now: "2026-04-25T08:02:00.000Z",
      seed: "session-seed",
      state
    });

    expect(plan).toHaveLength(8);
    expect(new Set(plan.map((trial) => trial.trialId)).size).toBe(8);
    expect(new Set(plan.map((trial) => trial.blockId))).toEqual(
      new Set(["daily-b1-contrast", "daily-b2-reading", "daily-b3-transfer"])
    );
    expect(plan[0]).toMatchObject({
      features: expect.objectContaining({
        exerciseFamily: expect.stringMatching(/choice$/),
        showReadingDuringTrial: false
      }),
      targetRtMs: expect.any(Number)
    });
    expect(plan.some((trial) => trial.exposureMs !== undefined)).toBe(true);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it("keeps rare and edge items from dominating a fresh daily plan", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-25T08:00:00.000Z"
    });
    const plan = generateKatakanaSpeedSessionPlan({
      count: 10,
      now: "2026-04-25T08:01:00.000Z",
      seed: "fresh-plan",
      state
    });

    const rareCount = plan.filter((trial) =>
      ["chunk-vu", "chunk-fyu"].includes(trial.itemId)
    ).length;

    expect(rareCount).toBeLessThanOrEqual(2);
  });

  it("generates a focused three-block daily trainer", () => {
    const initial = createInitialKatakanaSpeedState({
      now: "2026-04-25T08:00:00.000Z"
    });
    const confused = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "ツ",
      expectedSurface: "シ",
      itemId: "kana-shi",
      now: "2026-04-25T08:01:00.000Z",
      responseMs: 1400,
      state: initial
    });
    const weak = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "ティ",
      expectedSurface: "ティ",
      itemId: "chunk-ti",
      now: "2026-04-25T08:02:00.000Z",
      responseMs: 1800,
      state: confused
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 30,
      now: "2026-04-25T08:03:00.000Z",
      seed: "daily-expansion",
      sessionMode: "daily",
      state: weak
    });

    const modes = new Set(plan.map((trial) => trial.mode));
    const rareTrials = plan.filter((trial) => trial.rarity === "rare");
    const blockIds = new Set(plan.map((trial) => trial.blockId));
    const exerciseFamilies = new Set(
      plan.map((trial) => String(trial.features?.exerciseFamily ?? ""))
    );

    expect(plan).toHaveLength(30);
    expect(blockIds).toEqual(
      new Set(["daily-b1-contrast", "daily-b2-reading", "daily-b3-transfer"])
    );
    expect(modes.has("minimal_pair")).toBe(true);
    expect(modes.has("blink")).toBe(true);
    expect(modes.has("word_naming")).toBe(true);
    expect(modes.has("pseudoword_sprint")).toBe(true);
    expect(modes.has("ran_grid")).toBe(true);
    expect([...modes]).not.toContain("repeated_reading_pass");
    expect(modes.has("sentence_sprint")).toBe(false);
    expect(exerciseFamilies).toEqual(
      new Set([
        "blink_choice",
        "contrast_choice",
        "romaji_to_katakana_choice",
        "timed_word_reading",
        "timed_pseudoword_reading",
        "ran_grid"
      ])
    );
    expect(plan.some((trial) => trial.wasRepair)).toBe(false);
    expect(plan.some((trial) => trial.wasTransfer)).toBe(true);
    expect(plan.some((trial) => trial.wasPseudo)).toBe(true);
    expect(rareTrials.length).toBeLessThanOrEqual(3);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });
});
