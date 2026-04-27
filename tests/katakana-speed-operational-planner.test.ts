import { describe, expect, it } from "vitest";

import {
  createInitialKatakanaSpeedState,
  generateKatakanaSpeedSessionPlan,
  getKatakanaSpeedItemById,
  getKatakanaSpeedItemBySurface,
  romanizeKatakanaForLearner,
  updateKatakanaSpeedStateAfterAttempt
} from "@/features/katakana-speed/model";
import { decodeKatakanaSpeedRawOption } from "@/features/katakana-speed/model/exercise-catalog";

describe("katakana speed operational session planning", () => {
  it("builds the daily trainer as three focused blocks", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 32,
      now: "2026-04-26T08:01:00.000Z",
      seed: "operational-daily",
      sessionMode: "daily",
      state
    });
    const blockIds = new Set(plan.map((trial) => trial.blockId));
    const exerciseFamilies = new Set(
      plan.map((trial) => String(trial.features?.exerciseFamily ?? ""))
    );
    const roles = new Set(plan.map((trial) => trial.metadataRole));
    const contrastFocusIds = new Set(
      plan
        .filter((trial) => trial.blockId === "daily-b1-contrast")
        .map((trial) => String(trial.features?.focusId ?? ""))
    );

    expect(plan).toHaveLength(32);
    expect(blockIds).toEqual(
      new Set(["daily-b1-contrast", "daily-b2-reading", "daily-b3-transfer"])
    );
    expect(contrastFocusIds).toEqual(new Set(["ti-chi-tei"]));
    expect(exerciseFamilies).toEqual(
      new Set([
        "blink_choice",
        "contrast_choice",
        "romaji_to_katakana_choice",
        "ran_grid",
        "timed_word_reading",
        "timed_pseudoword_reading"
      ])
    );
    expect(roles).not.toContain("tile_builder");
    expect(roles).not.toContain("chunk_spotting");
    expect(roles).not.toContain("variant_normalization");
    expect(roles).not.toContain("same_different");
    expect(
      plan.every((trial) => trial.features?.showReadingDuringTrial === false)
    ).toBe(true);
  });

  it("does not pin the correct contrast answer to the first option", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 18,
      now: "2026-04-26T08:01:00.000Z",
      seed: "option-position-daily",
      sessionMode: "daily",
      state
    });
    const correctIndexes = plan
      .filter(
        (trial) =>
          trial.blockId === "daily-b1-contrast" &&
          (trial.features?.exerciseFamily === "contrast_choice" ||
            trial.features?.exerciseFamily === "blink_choice")
      )
      .map((trial) =>
        optionSurfaces(trial.optionItemIds).findIndex(
          (surface) => surface === trial.expectedSurface
        )
      );

    expect(correctIndexes.length).toBeGreaterThan(4);
    expect(new Set(correctIndexes).size).toBeGreaterThan(1);
    expect(correctIndexes.some((index) => index > 0)).toBe(true);
  });

  it("adds inverse romaji prompts with four close katakana options", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 32,
      now: "2026-04-26T08:01:00.000Z",
      seed: "inverse-romaji-daily",
      sessionMode: "daily",
      state
    });
    const inverseTrials = plan.filter(
      (trial) => trial.features?.exerciseFamily === "romaji_to_katakana_choice"
    );
    const trial = inverseTrials[0];
    expect(trial).toBeDefined();
    const surfaces = optionSurfaces(trial!.optionItemIds);

    expect(inverseTrials.length).toBeGreaterThanOrEqual(2);
    expect(trial).toMatchObject({
      expectedSurface: "ティ",
      mode: "minimal_pair",
      promptSurface: "ti"
    });
    expect(trial!.features).toMatchObject({
      answerKind: "katakana",
      direction: "romaji_to_katakana",
      exerciseCode: "E04",
      interaction: "raw_choice",
      promptKind: "romaji",
      showReadingDuringTrial: false
    });
    expect(surfaces).toHaveLength(4);
    expect(new Set(surfaces).size).toBe(4);
    expect(surfaces).toEqual(expect.arrayContaining(["ティ", "チ", "ディ"]));
    expect(
      surfaces.every((surface) => /^[\u30a0-\u30ffー]+$/u.test(surface))
    ).toBe(true);
    expect(
      surfaces.filter(
        (surface) =>
          romanizeKatakanaForLearner(surface) === trial!.promptSurface
      )
    ).toEqual([trial!.expectedSurface]);
  });

  it("builds repair as focused contrast, reading, final contrast", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 34,
      now: "2026-04-26T08:01:00.000Z",
      seed: "repair-di",
      sessionMode: "repair",
      state
    });
    const blockIds = new Set(plan.map((trial) => trial.blockId));
    const focusIds = new Set(
      plan.map((trial) => String(trial.features?.focusId ?? ""))
    );

    expect(blockIds).toEqual(
      new Set(["repair-b1-contrast", "repair-b2-reading", "repair-b3-final"])
    );
    expect(focusIds).toEqual(new Set(["ti-chi-tei"]));
    expect(
      plan
        .filter((trial) => trial.blockId === "repair-b2-reading")
        .some((trial) => trial.wasPseudo)
    ).toBe(true);
    expect(plan.every((trial) => trial.wasRepair)).toBe(true);
  });

  it("builds diagnostic as baseline contrast, reading, and transfer blocks", () => {
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
    const blockIds = new Set(plan.map((trial) => trial.blockId));
    const exerciseFamilies = new Set(
      plan.map((trial) => String(trial.features?.exerciseFamily ?? ""))
    );

    expect(plan).toHaveLength(24);
    expect(blockIds).toEqual(
      new Set([
        "diagnostic-b1-contrast",
        "diagnostic-b2-reading",
        "diagnostic-b3-transfer"
      ])
    );
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
  });

  it("plans contrast choices with raw expected answers when focus surfaces are not catalog items", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    const plan = generateKatakanaSpeedSessionPlan({
      count: 6,
      now: "2026-04-26T08:01:00.000Z",
      seed: "daily-raw-choice-operational",
      sessionMode: "daily",
      state
    });
    const firstTrial = plan[0];

    expect(firstTrial).toMatchObject({
      expectedSurface: expect.any(String),
      mode: "minimal_pair"
    });
    expect(firstTrial.features).toMatchObject({
      interaction: "raw_choice"
    });
    const optionSurfaces = firstTrial.optionItemIds.map((optionId) => {
      const optionItem = getKatakanaSpeedItemById(optionId);
      return optionItem?.surface ?? decodeKatakanaSpeedRawOption(optionId);
    });

    expect(optionSurfaces).toEqual(
      expect.arrayContaining([firstTrial.expectedSurface, expect.any(String)])
    );
    expect(firstTrial.promptSurface).toBe(firstTrial.expectedSurface);
  });

  it("uses concrete mora contrast pairs for sokuon and long-vowel focus", () => {
    const initial = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });
    const sokuonState = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "チェク",
      expectedSurface: "チェック",
      itemId: "word-check",
      now: "2026-04-26T08:01:00.000Z",
      responseMs: 900,
      state: initial
    });
    const serverItem = getKatakanaSpeedItemBySurface("サーバー");
    expect(serverItem).toBeDefined();
    const longVowelState = updateKatakanaSpeedStateAfterAttempt({
      actualSurface: "サバ",
      expectedSurface: "サーバー",
      itemId: serverItem!.id,
      now: "2026-04-26T08:02:00.000Z",
      responseMs: 900,
      state: initial
    });

    const sokuonTrial = generateKatakanaSpeedSessionPlan({
      count: 6,
      now: "2026-04-26T08:03:00.000Z",
      seed: "sokuon-mora-contrast",
      sessionMode: "repair",
      state: sokuonState
    })[0];
    const longVowelTrial = generateKatakanaSpeedSessionPlan({
      count: 6,
      now: "2026-04-26T08:03:00.000Z",
      seed: "long-vowel-mora-contrast",
      sessionMode: "repair",
      state: longVowelState
    })[0];

    expect(sokuonTrial).toBeDefined();
    expect(longVowelTrial).toBeDefined();
    expect(sokuonTrial!.features).toMatchObject({
      errorTagOnWrong: "sokuon_missed",
      exerciseFamily: "mora_contrast",
      focusId: "sokuon"
    });
    expect(optionSurfaces(sokuonTrial!.optionItemIds)).toEqual(
      expect.arrayContaining([
        sokuonTrial!.expectedSurface,
        expect.not.stringContaining("ッ")
      ])
    );
    expect(sokuonTrial!.optionItemIds.length).toBeGreaterThanOrEqual(2);
    expect(longVowelTrial!.features).toMatchObject({
      errorTagOnWrong: "long_vowel_missed",
      exerciseFamily: "mora_contrast",
      focusId: "long-vowel"
    });
    expect(optionSurfaces(longVowelTrial!.optionItemIds)).toEqual(
      expect.arrayContaining([
        longVowelTrial!.expectedSurface,
        expect.not.stringContaining("ー")
      ])
    );
    expect(longVowelTrial!.optionItemIds.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects stale session modes at runtime", () => {
    const state = createInitialKatakanaSpeedState({
      now: "2026-04-26T08:00:00.000Z"
    });

    expect(() =>
      generateKatakanaSpeedSessionPlan({
        count: 6,
        now: "2026-04-26T08:01:00.000Z",
        seed: "stale-mode",
        sessionMode: "rare_combo" as never,
        state
      })
    ).toThrow("Unsupported Katakana Speed session mode.");
  });
});

function optionSurfaces(optionItemIds: readonly string[]) {
  return optionItemIds.map((optionId) => {
    const optionItem = getKatakanaSpeedItemById(optionId);
    return optionItem?.surface ?? decodeKatakanaSpeedRawOption(optionId);
  });
}
