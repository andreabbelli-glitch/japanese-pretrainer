import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  revalidateMediaListCacheMock,
  revalidateReviewSummaryCacheMock,
  revalidateSettingsCacheMock,
  setFuriganaModeMock,
  setLessonCompletionStateMock
} = vi.hoisted(() => ({
  revalidateMediaListCacheMock: vi.fn(),
  revalidateReviewSummaryCacheMock: vi.fn(),
  revalidateSettingsCacheMock: vi.fn(),
  setFuriganaModeMock: vi.fn(),
  setLessonCompletionStateMock: vi.fn()
}));

vi.mock("@/lib/data-cache", () => ({
  revalidateMediaListCache: revalidateMediaListCacheMock,
  revalidateReviewSummaryCache: revalidateReviewSummaryCacheMock,
  revalidateSettingsCache: revalidateSettingsCacheMock
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
    revalidateMediaListCacheMock.mockReset();
    revalidateReviewSummaryCacheMock.mockReset();
    revalidateSettingsCacheMock.mockReset();
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
    expect(revalidateSettingsCacheMock).toHaveBeenCalledTimes(1);
    expect(revalidateMediaListCacheMock).not.toHaveBeenCalled();
    expect(revalidateReviewSummaryCacheMock).not.toHaveBeenCalled();
  });

  it("revalidates media and review caches after lesson completion changes", async () => {
    await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionStateMock).toHaveBeenCalledWith("lesson_001", true);
    expect(revalidateMediaListCacheMock).toHaveBeenCalledTimes(1);
    expect(revalidateReviewSummaryCacheMock).toHaveBeenCalledTimes(1);
    expect(revalidateSettingsCacheMock).not.toHaveBeenCalled();
  });
});
