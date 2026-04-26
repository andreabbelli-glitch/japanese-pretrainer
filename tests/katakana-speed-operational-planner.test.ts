import { describe, expect, it } from "vitest";

import {
  createInitialKatakanaSpeedState,
  formatKatakanaSpeedReading,
  generateKatakanaSpeedSessionPlan
} from "@/features/katakana-speed/model";
import { decodeKatakanaSpeedRawOption } from "@/features/katakana-speed/model/exercise-catalog";

describe("katakana speed operational session planning", () => {
  it("builds a true daily mixed blitz across non-audio exercise families", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 48,
      now: "2026-04-26T08:01:00.000Z",
      seed: "operational-daily",
      sessionMode: "daily",
      state
    });
    const exerciseCodes = new Set(
      plan.map((trial) => String(trial.features?.exerciseCode ?? ""))
    );

    expect(plan).toHaveLength(48);
    expect(exerciseCodes.size).toBeGreaterThan(8);
    for (const expectedExercise of [
      "E02",
      "E03",
      "E04",
      "E05",
      "E08",
      "E09",
      "E11",
      "E12",
      "E15",
      "E16",
      "E17",
      "E20"
    ]) {
      expect(exerciseCodes.has(expectedExercise)).toBe(true);
    }
    expect(plan.every((trial) => trial.features?.hardMode === true)).toBe(true);
    expect(
      plan.some((trial) => trial.features?.interaction === "tile_builder")
    ).toBe(true);
    expect(
      plan.some((trial) => trial.features?.interaction === "segment_select")
    ).toBe(true);
    expect(
      plan.some((trial) => trial.features?.interaction === "raw_choice")
    ).toBe(true);
    expect(plan.some((trial) => trial.wasRepair)).toBe(true);
  });

  it("builds diagnostic probes across item levels without audio trials", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 24,
      now: "2026-04-26T08:01:00.000Z",
      seed: "diagnostic-operational",
      sessionMode: "diagnostic_probe",
      state
    });
    const itemTypes = new Set(plan.map((trial) => trial.itemType));

    expect(plan).toHaveLength(24);
    expect(plan.every((trial) => trial.features?.exerciseCode === "E01")).toBe(
      true
    );
    expect(itemTypes.has("single_kana")).toBe(true);
    expect(itemTypes.has("extended_chunk")).toBe(true);
    expect(itemTypes.has("word")).toBe(true);
    expect(itemTypes.has("pseudoword")).toBe(true);
    expect(itemTypes.has("sentence")).toBe(true);
    expect(
      plan.every(
        (trial) =>
          trial.mode !== "ran_grid" && trial.mode !== "repeated_reading_pass"
      )
    ).toBe(true);
  });

  it("plans raw expected-answer drills without requiring catalog answer items", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 6,
      now: "2026-04-26T08:01:00.000Z",
      seed: "mora-trap-operational",
      sessionMode: "mora_trap",
      state
    });
    const firstTrial = plan[0];

    expect(firstTrial).toMatchObject({
      expectedSurface: expect.any(String),
      mode: "minimal_pair"
    });
    expect(firstTrial.features).toMatchObject({
      exerciseCode: expect.stringMatching(/^E1[56]$/),
      interaction: "raw_choice"
    });
    expect(firstTrial.optionItemIds.map(decodeKatakanaSpeedRawOption)).toEqual(
      expect.arrayContaining([firstTrial.expectedSurface, expect.any(String)])
    );
    expect(firstTrial.promptSurface).toBe(
      formatKatakanaSpeedReading(firstTrial.expectedSurface)
    );
  });
});
