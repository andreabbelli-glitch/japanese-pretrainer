import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  applyFsrsRescheduleMock,
  redirectMock,
  updateReviewSummaryCacheMock,
  updateSettingsCacheMock,
  updateStudySettingsMock
} = vi.hoisted(() => ({
    applyFsrsRescheduleMock: vi.fn(),
    redirectMock: vi.fn((href: string) => {
      throw new Error(`redirect:${href}`);
    }),
    updateReviewSummaryCacheMock: vi.fn(),
    updateSettingsCacheMock: vi.fn(),
    updateStudySettingsMock: vi.fn()
  }));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/features/cache/server/data-cache", () => ({
  updateReviewSummaryCache: updateReviewSummaryCacheMock,
  updateSettingsCache: updateSettingsCacheMock
}));

vi.mock("@/features/fsrs-optimizer/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/fsrs-optimizer/server")>();

  return {
    ...actual,
    applyFsrsReschedule: applyFsrsRescheduleMock
  };
});

vi.mock("@/features/settings/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/settings/server")>();

  return {
    ...actual,
    updateStudySettings: updateStudySettingsMock
  };
});

import {
  applyFsrsRescheduleAction,
  saveStudySettingsAction
} from "@/actions/settings";
import { defaultStudySettings } from "@/features/settings/server";

describe("settings actions", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    applyFsrsRescheduleMock.mockReset();
    updateReviewSummaryCacheMock.mockClear();
    updateSettingsCacheMock.mockClear();
    updateStudySettingsMock.mockReset();
  });

  it("does not partially parse malformed numeric study settings", async () => {
    const formData = new FormData();
    formData.set("furiganaMode", "hover");
    formData.set("glossaryDefaultSort", "lesson_order");
    formData.set("kanjiClashDailyNewLimit", "8abc");
    formData.set("kanjiClashDefaultScope", "global");
    formData.set("kanjiClashManualDefaultSize", "40px");
    formData.set("reviewAutoplayAudioOnReveal", "true");
    formData.set("reviewFrontFurigana", "true");
    formData.set("reviewDailyLimit", "12abc");

    await expect(saveStudySettingsAction(formData)).rejects.toThrow(
      "redirect:/settings?saved=1"
    );

    expect(updateStudySettingsMock).toHaveBeenCalledWith({
      furiganaMode: "hover",
      glossaryDefaultSort: "lesson_order",
      kanjiClashDailyNewLimit: defaultStudySettings.kanjiClashDailyNewLimit,
      kanjiClashDefaultScope: "global",
      kanjiClashManualDefaultSize:
        defaultStudySettings.kanjiClashManualDefaultSize,
      reviewAutoplayAudioOnReveal: true,
      reviewFrontFurigana: true,
      reviewDailyLimit: defaultStudySettings.reviewDailyLimit
    });
    expect(updateSettingsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the first valid duplicated return target after saving settings", async () => {
    const formData = new FormData();
    formData.set("furiganaMode", "hover");
    formData.set("glossaryDefaultSort", "lesson_order");
    formData.set("kanjiClashDailyNewLimit", "5");
    formData.set("kanjiClashDefaultScope", "global");
    formData.set("kanjiClashManualDefaultSize", "20");
    formData.set("reviewAutoplayAudioOnReveal", "false");
    formData.set("reviewFrontFurigana", "true");
    formData.set("reviewDailyLimit", "20");
    formData.append("returnTo", "https://evil.test/review");
    formData.append("returnTo", "/review?answered=2&card=card-iku");

    await expect(saveStudySettingsAction(formData)).rejects.toThrow(
      "redirect:/settings?saved=1&returnTo=%2Freview%3Fanswered%3D2%26card%3Dcard-iku"
    );

    expect(updateSettingsCacheMock).toHaveBeenCalledTimes(1);
    expect(updateStudySettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewAutoplayAudioOnReveal: false
      })
    );
  });

  it("applies FSRS reschedule from a separate settings action", async () => {
    applyFsrsRescheduleMock.mockResolvedValue({
      affectedSubjects: 3,
      fsrsCacheKeyPart: "next-cache-key",
      status: "applied"
    });

    const formData = new FormData();
    formData.set("fsrsCacheKeyPart", "config|recognition|concept");
    formData.set("returnTo", "/review?answered=2");

    await expect(applyFsrsRescheduleAction(formData)).rejects.toThrow(
      "redirect:/settings?fsrsRescheduled=1&returnTo=%2Freview%3Fanswered%3D2"
    );

    expect(applyFsrsRescheduleMock).toHaveBeenCalledWith({
      expectedFsrsCacheKeyPart: "config|recognition|concept"
    });
    expect(updateReviewSummaryCacheMock).toHaveBeenCalledTimes(1);
  });

  it("redirects with a stale notice when FSRS params changed before applying", async () => {
    applyFsrsRescheduleMock.mockResolvedValue({
      affectedSubjects: 0,
      fsrsCacheKeyPart: "next-cache-key",
      status: "stale"
    });

    const formData = new FormData();
    formData.set("fsrsCacheKeyPart", "old-cache-key");

    await expect(applyFsrsRescheduleAction(formData)).rejects.toThrow(
      "redirect:/settings?fsrsRescheduleStale=1"
    );

    expect(updateReviewSummaryCacheMock).not.toHaveBeenCalled();
  });
});
