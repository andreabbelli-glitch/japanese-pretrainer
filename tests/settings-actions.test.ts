import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock, updateSettingsCacheMock, updateStudySettingsMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((href: string) => {
      throw new Error(`redirect:${href}`);
    }),
    updateSettingsCacheMock: vi.fn(),
    updateStudySettingsMock: vi.fn()
  }));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/data-cache", () => ({
  updateSettingsCache: updateSettingsCacheMock
}));

vi.mock("@/features/settings/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/settings/server")>();

  return {
    ...actual,
    updateStudySettings: updateStudySettingsMock
  };
});

import { saveStudySettingsAction } from "@/actions/settings";
import { defaultStudySettings } from "@/features/settings/server";

describe("settings actions", () => {
  beforeEach(() => {
    redirectMock.mockClear();
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
});
