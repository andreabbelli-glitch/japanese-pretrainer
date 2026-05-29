import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  updateConsolidationSummaryCacheMock,
  updateMediaListCacheMock,
  updateReviewSummaryCacheMock,
  updateSettingsCacheMock,
  setFuriganaModeMock,
  setLessonCompletionForActionMock
} = vi.hoisted(() => ({
  updateConsolidationSummaryCacheMock: vi.fn(),
  updateMediaListCacheMock: vi.fn(),
  updateReviewSummaryCacheMock: vi.fn(),
  updateSettingsCacheMock: vi.fn(),
  setFuriganaModeMock: vi.fn(),
  setLessonCompletionForActionMock: vi.fn()
}));

vi.mock("@/features/cache/server/data-cache", () => ({
  updateConsolidationSummaryCache: updateConsolidationSummaryCacheMock,
  updateMediaListCache: updateMediaListCacheMock,
  updateReviewSummaryCache: updateReviewSummaryCacheMock,
  updateSettingsCache: updateSettingsCacheMock
}));

vi.mock("@/features/textbook/server", () => ({
  setFuriganaMode: setFuriganaModeMock,
  setLessonCompletionForAction: setLessonCompletionForActionMock
}));

import {
  setFuriganaModeAction,
  setLessonCompletionAction
} from "@/actions/textbook";

describe("textbook actions", () => {
  beforeEach(() => {
    updateConsolidationSummaryCacheMock.mockReset();
    updateMediaListCacheMock.mockReset();
    updateReviewSummaryCacheMock.mockReset();
    updateSettingsCacheMock.mockReset();
    setFuriganaModeMock.mockReset();
    setLessonCompletionForActionMock.mockReset();
    setLessonCompletionForActionMock.mockResolvedValue({
      consolidationHref: "/consolidation/media/fixture-media/lesson/core-vocab",
      ok: true,
      status: "completed"
    });
  });

  it("revalidates settings cache after furigana mode changes", async () => {
    await setFuriganaModeAction({
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media",
      mode: "off"
    });

    expect(setFuriganaModeMock).toHaveBeenCalledWith("off");
    expect(updateSettingsCacheMock).toHaveBeenCalledTimes(1);
    expect(updateConsolidationSummaryCacheMock).not.toHaveBeenCalled();
    expect(updateMediaListCacheMock).not.toHaveBeenCalled();
    expect(updateReviewSummaryCacheMock).not.toHaveBeenCalled();
  });

  it("delegates lesson completion changes to the textbook workflow", async () => {
    const input = {
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    };

    await setLessonCompletionAction(input);

    expect(setLessonCompletionForActionMock).toHaveBeenCalledWith(input);
    expect(updateMediaListCacheMock).not.toHaveBeenCalled();
    expect(updateConsolidationSummaryCacheMock).not.toHaveBeenCalled();
    expect(updateReviewSummaryCacheMock).not.toHaveBeenCalled();
    expect(updateSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("enqueues pre-FSRS consolidation after newly completing a lesson", async () => {
    const result = await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(result).toMatchObject({
      consolidationHref: "/consolidation/media/fixture-media/lesson/core-vocab",
      ok: true,
      status: "completed"
    });
  });

  it("does not enqueue pre-FSRS consolidation when reopening a lesson", async () => {
    setLessonCompletionForActionMock.mockResolvedValueOnce({
      consolidationHref: null,
      ok: true,
      status: "in_progress"
    });

    const result = await setLessonCompletionAction({
      completed: false,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(result.consolidationHref).toBeNull();
  });

  it("does not enqueue pre-FSRS consolidation when completion was already persisted", async () => {
    setLessonCompletionForActionMock.mockResolvedValueOnce({
      consolidationHref: null,
      ok: true,
      status: "completed"
    });

    const result = await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(result.consolidationHref).toBeNull();
  });
});
