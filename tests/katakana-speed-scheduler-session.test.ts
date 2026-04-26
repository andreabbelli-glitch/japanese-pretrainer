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
  it("generates serializable adaptive trial plans using only minimal_pair and blink", () => {
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
    expect(
      plan
        .map((trial) => trial.mode)
        .every((mode) => mode === "minimal_pair" || mode === "blink")
    ).toBe(true);
    expect(plan[0]).toMatchObject({
      correctItemId: "kana-shi",
      confusionClusterId: "visual-shi-tsu-so-n",
      itemId: "kana-shi",
      promptSurface: "シ",
      targetRtMs: expect.any(Number)
    });
    expect(plan[0]?.optionItemIds).toContain("kana-shi");
    expect(plan.some((trial) => trial.exposureMs !== undefined)).toBe(true);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it("keeps rare and edge items from dominating a fresh early plan", () => {
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

  it("generates a block-aware daily expansion mix with capped rare shock trials", () => {
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

    expect(plan).toHaveLength(30);
    expect(blockIds.size).toBeGreaterThan(1);
    expect(modes.has("minimal_pair")).toBe(true);
    expect(modes.has("blink")).toBe(true);
    expect(modes.has("word_naming")).toBe(true);
    expect(modes.has("pseudoword_sprint")).toBe(true);
    expect(modes.has("sentence_sprint")).toBe(true);
    expect(modes.has("repeated_reading_pass")).toBe(false);
    expect(modes.has("ran_grid")).toBe(false);
    expect(plan.some((trial) => trial.wasRepair)).toBe(true);
    expect(plan.some((trial) => trial.wasTransfer)).toBe(true);
    expect(plan.some((trial) => trial.wasPseudo)).toBe(true);
    expect(plan.some((trial) => trial.metadataRole === "weak_item")).toBe(true);
    expect(plan.some((trial) => trial.metadataRole === "easy_review")).toBe(
      true
    );
    expect(rareTrials.length).toBeLessThanOrEqual(3);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });

  it("keeps rare combo expansion sessions under a one-quarter rare cap", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-25T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 20,
      now: "2026-04-25T08:01:00.000Z",
      seed: "rare-combo",
      sessionMode: "rare_combo",
      state
    });

    expect(
      plan.every((trial) => trial.blockId?.startsWith("rare_combo-") === true)
    ).toBe(true);
    expect(plan.filter((trial) => trial.rarity === "rare")).toHaveLength(5);
    expect(plan.some((trial) => trial.metadataRole === "rare_shock")).toBe(
      true
    );
  });
});
