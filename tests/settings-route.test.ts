import { describe, expect, it, vi } from "vitest";

const {
  buildFsrsReschedulePreviewMock,
  getFsrsOptimizerStatusMock,
  getStudySettingsMock
} = vi.hoisted(() => ({
  buildFsrsReschedulePreviewMock: vi.fn(),
  getFsrsOptimizerStatusMock: vi.fn(),
  getStudySettingsMock: vi.fn()
}));

vi.mock("@/components/settings/settings-page", () => ({
  SettingsPage: (props: unknown) => ({ props, type: "mock-settings-page" })
}));

vi.mock("@/features/fsrs-optimizer/server", () => ({
  buildFsrsReschedulePreview: buildFsrsReschedulePreviewMock,
  getFsrsOptimizerStatus: getFsrsOptimizerStatusMock
}));

vi.mock("@/features/settings/server", () => ({
  getStudySettings: getStudySettingsMock
}));

import SettingsRoute from "@/app/settings/page";

describe("settings route", () => {
  it("keeps settings lightweight until the FSRS preview is explicitly requested", async () => {
    getFsrsOptimizerStatusMock.mockResolvedValue({
      config: {
        desiredRetention: 0.9,
        enabled: true,
        minDaysBetweenRuns: 30,
        minNewReviews: 500,
        presetStrategy: "card_type_v1"
      },
      newEligibleReviews: 42,
      nextTrainingNewReviewThreshold: 500,
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
      reviewAutoplayAudioOnReveal: true,
      reviewFrontFurigana: true,
      reviewDailyLimit: 20
    });
    buildFsrsReschedulePreviewMock.mockResolvedValue({
      days: [],
      fsrsCacheKeyPart: "config|recognition|concept",
      generatedAt: "2026-01-21T10:00:00.000Z",
      horizonDays: 30,
      summary: {
        affectedSubjects: 0,
        currentDue30Days: 0,
        currentDue7Days: 0,
        currentDueToday: 0,
        delta30Days: 0,
        delta7Days: 0,
        deltaDueToday: 0,
        eligibleSubjects: 0,
        movedEarlier: 0,
        movedLater: 0,
        proposedDue30Days: 0,
        proposedDue7Days: 0,
        proposedDueToday: 0,
        skippedNoHistory: 0,
        unchangedSubjects: 0
      }
    });

    const element = await SettingsRoute({
      searchParams: Promise.resolve({
        returnTo: ["", "/review?answered=2&card=card-iku"],
        saved: ["0", "1"]
      })
    });

    expect(element.props).toMatchObject({
      fsrsReschedulePreview: null,
      returnTo: "/review?answered=2&card=card-iku",
      saved: true
    });
    expect(buildFsrsReschedulePreviewMock).not.toHaveBeenCalled();

    const previewElement = await SettingsRoute({
      searchParams: Promise.resolve({ fsrsPreview: "1" })
    });

    expect(previewElement.props.fsrsReschedulePreview).toMatchObject({
      fsrsCacheKeyPart: "config|recognition|concept"
    });
    expect(buildFsrsReschedulePreviewMock).toHaveBeenCalledTimes(1);
  });
});
