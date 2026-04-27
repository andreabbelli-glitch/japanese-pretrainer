import { describe, expect, it } from "vitest";

import {
  createInitialKatakanaSpeedState,
  pickKatakanaTrainingFocus
} from "@/features/katakana-speed/model";
import type { KatakanaSpeedFocusAttempt } from "@/features/katakana-speed/model/focus";

describe("katakana speed training focus", () => {
  it("starts from the high-value ti/chi focus when there is no history", () => {
    const focus = pickKatakanaTrainingFocus({
      now: new Date("2026-04-26T08:00:00.000Z"),
      recentAttempts: [],
      state: createInitialKatakanaSpeedState({
        now: "2026-04-26T07:59:00.000Z"
      })
    });

    expect(focus).toMatchObject({
      id: "ti-chi-tei",
      label: "ティ / チ / テイ",
      targetChunks: ["ティ"]
    });
    expect(focus.kind).not.toBe("general_speed");
  });

  it("prioritizes objective di/ji confusion over self-reported hesitation", () => {
    const attempts: KatakanaSpeedFocusAttempt[] = [
      attempt({
        correct: false,
        correctnessSource: "objective",
        errorTags: ["phonological_confusion"],
        focusChunks: ["ディ"]
      }),
      attempt({
        correct: true,
        correctnessSource: "objective",
        errorTags: ["slow_correct"],
        focusChunks: ["ディ"]
      }),
      attempt({
        correct: true,
        correctnessSource: "self_report",
        focusChunks: ["ヴョ"],
        selfRating: "hesitated"
      })
    ];

    const focus = pickKatakanaTrainingFocus({
      now: new Date("2026-04-26T08:00:00.000Z"),
      recentAttempts: attempts,
      state: createInitialKatakanaSpeedState({
        now: "2026-04-26T07:59:00.000Z"
      })
    });

    expect(focus).toMatchObject({
      id: "di-ji-dei",
      label: "ディ / ジ / デイ"
    });
  });
});

function attempt(
  overrides: Partial<KatakanaSpeedFocusAttempt>
): KatakanaSpeedFocusAttempt {
  return {
    correct: overrides.correct ?? true,
    correctnessSource: overrides.correctnessSource ?? "objective",
    errorTags: overrides.errorTags ?? [],
    focusChunks: overrides.focusChunks ?? [],
    selfRating: overrides.selfRating ?? null
  };
}
