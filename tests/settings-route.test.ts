import { describe, expect, it, vi } from "vitest";

const { getFsrsOptimizerStatusMock, getStudySettingsMock } = vi.hoisted(() => ({
  getFsrsOptimizerStatusMock: vi.fn(),
  getStudySettingsMock: vi.fn()
}));

vi.mock("@/components/settings/settings-page", () => ({
  SettingsPage: (props: unknown) => ({ props, type: "mock-settings-page" })
}));

vi.mock("@/lib/fsrs-optimizer", () => ({
  getFsrsOptimizerStatus: getFsrsOptimizerStatusMock
}));

vi.mock("@/lib/settings", () => ({
  getStudySettings: getStudySettingsMock
}));

import SettingsRoute from "@/app/settings/page";

describe("settings route", () => {
  it("keeps the saved notice active when duplicated search params include a valid flag", async () => {
    getFsrsOptimizerStatusMock.mockResolvedValue({
      config: {
        desiredRetention: 0.9,
        enabled: true,
        minDaysBetweenRuns: 30,
        minNewReviews: 500,
        presetStrategy: "card_type_v1"
      },
      newEligibleReviews: 42,
      presets: {
        concept: {
          desiredRetention: 0.9,
          presetKey: "concept",
          trainedAt: "2026-04-01T10:00:00.000Z",
          trainingReviewCount: 120,
          usesOptimizedParameters: true
        },
        recognition: {
          desiredRetention: 0.9,
          presetKey: "recognition",
          trainedAt: null,
          trainingReviewCount: 0,
          usesOptimizedParameters: false
        }
      },
      state: {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-04-01T10:00:00.000Z",
        lastCheckAt: "2026-04-01T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-04-01T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 42,
        totalEligibleReviewsAtLastTraining: 500
      },
      totalEligibleReviews: 542
    });
    getStudySettingsMock.mockResolvedValue({
      furiganaMode: "hover",
      glossaryDefaultSort: "lesson_order",
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global",
      kanjiClashManualDefaultSize: 20,
      reviewFrontFurigana: true,
      reviewDailyLimit: 20
    });

    const element = await SettingsRoute({
      searchParams: Promise.resolve({
        returnTo: ["", "/review?answered=2&card=card-iku"],
        saved: ["0", "1"]
      })
    });

    expect(element.props).toMatchObject({
      returnTo: "/review?answered=2&card=card-iku",
      saved: true
    });
  });
});
