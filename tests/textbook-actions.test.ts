import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMediaBySlugMock,
  updateMediaListCacheMock,
  updateReviewSummaryCacheMock,
  updateSettingsCacheMock,
  setFuriganaModeMock,
  setLessonCompletionStateMock
} = vi.hoisted(() => ({
  getMediaBySlugMock: vi.fn(),
  updateMediaListCacheMock: vi.fn(),
  updateReviewSummaryCacheMock: vi.fn(),
  updateSettingsCacheMock: vi.fn(),
  setFuriganaModeMock: vi.fn(),
  setLessonCompletionStateMock: vi.fn()
}));

vi.mock("@/db", () => ({
  db: {},
  getMediaBySlug: getMediaBySlugMock
}));

vi.mock("@/lib/data-cache", () => ({
  updateMediaListCache: updateMediaListCacheMock,
  updateReviewSummaryCache: updateReviewSummaryCacheMock,
  updateSettingsCache: updateSettingsCacheMock
}));

vi.mock("@/lib/textbook", () => ({
  setFuriganaMode: setFuriganaModeMock,
  setLessonCompletionState: setLessonCompletionStateMock
}));

import {
  setFuriganaModeAction,
  setLessonCompletionAction
} from "@/actions/textbook";

describe("textbook actions", () => {
  beforeEach(() => {
    getMediaBySlugMock.mockReset();
    getMediaBySlugMock.mockResolvedValue({ id: "media_fixture" });
    updateMediaListCacheMock.mockReset();
    updateReviewSummaryCacheMock.mockReset();
    updateSettingsCacheMock.mockReset();
    setFuriganaModeMock.mockReset();
    setLessonCompletionStateMock.mockReset();
  });

  it("revalidates settings cache after furigana mode changes", async () => {
    await setFuriganaModeAction({
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media",
      mode: "off"
    });

    expect(setFuriganaModeMock).toHaveBeenCalledWith("off");
    expect(updateSettingsCacheMock).toHaveBeenCalledTimes(1);
    expect(updateMediaListCacheMock).not.toHaveBeenCalled();
    expect(updateReviewSummaryCacheMock).not.toHaveBeenCalled();
  });

  it("revalidates media and review caches after lesson completion changes", async () => {
    await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionStateMock).toHaveBeenCalledWith("lesson_001", true);
    expect(getMediaBySlugMock).toHaveBeenCalledWith({}, "fixture-media");
    expect(updateMediaListCacheMock).toHaveBeenCalledTimes(1);
    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith("media_fixture");
    expect(updateSettingsCacheMock).not.toHaveBeenCalled();
  });
});
