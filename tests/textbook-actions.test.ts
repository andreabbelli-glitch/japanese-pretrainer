import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMediaBySlugMock,
  updateConsolidationSummaryCacheMock,
  updateMediaListCacheMock,
  updateReviewSummaryCacheMock,
  updateSettingsCacheMock,
  setFuriganaModeMock,
  setLessonCompletionWithConsolidationMock
} = vi.hoisted(() => ({
  getMediaBySlugMock: vi.fn(),
  updateConsolidationSummaryCacheMock: vi.fn(),
  updateMediaListCacheMock: vi.fn(),
  updateReviewSummaryCacheMock: vi.fn(),
  updateSettingsCacheMock: vi.fn(),
  setFuriganaModeMock: vi.fn(),
  setLessonCompletionWithConsolidationMock: vi.fn()
}));

vi.mock("@/db", () => ({
  db: {}
}));

vi.mock("@/db/queries", () => ({
  getMediaBySlug: getMediaBySlugMock
}));

vi.mock("@/features/cache/server/data-cache", () => ({
  updateConsolidationSummaryCache: updateConsolidationSummaryCacheMock,
  updateMediaListCache: updateMediaListCacheMock,
  updateReviewSummaryCache: updateReviewSummaryCacheMock,
  updateSettingsCache: updateSettingsCacheMock
}));

vi.mock("@/features/consolidation/server", () => ({
  setLessonCompletionWithConsolidation: setLessonCompletionWithConsolidationMock
}));

vi.mock("@/features/textbook/server", () => ({
  setFuriganaMode: setFuriganaModeMock
}));

import {
  setFuriganaModeAction,
  setLessonCompletionAction
} from "@/actions/textbook";

describe("textbook actions", () => {
  beforeEach(() => {
    getMediaBySlugMock.mockReset();
    getMediaBySlugMock.mockResolvedValue({ id: "media_fixture" });
    updateConsolidationSummaryCacheMock.mockReset();
    updateMediaListCacheMock.mockReset();
    updateReviewSummaryCacheMock.mockReset();
    updateSettingsCacheMock.mockReset();
    setFuriganaModeMock.mockReset();
    setLessonCompletionWithConsolidationMock.mockReset();
    setLessonCompletionWithConsolidationMock.mockResolvedValue({
      completedNow: true,
      consolidation: {
        createdCount: 2,
        subjectKeys: ["card:fixture-one", "card:fixture-two"]
      },
      previousStatus: "in_progress",
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

  it("revalidates media and review caches after lesson completion changes", async () => {
    await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionWithConsolidationMock).toHaveBeenCalledWith({
      completed: true,
      lessonId: "lesson_001"
    });
    expect(getMediaBySlugMock).toHaveBeenCalledWith({}, "fixture-media");
    expect(updateMediaListCacheMock).toHaveBeenCalledTimes(1);
    expect(updateConsolidationSummaryCacheMock).toHaveBeenCalledWith(
      "media_fixture"
    );
    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith("media_fixture");
    expect(updateSettingsCacheMock).not.toHaveBeenCalled();
  });

  it("enqueues pre-FSRS consolidation after newly completing a lesson", async () => {
    const result = await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionWithConsolidationMock).toHaveBeenCalledWith({
      completed: true,
      lessonId: "lesson_001"
    });
    expect(result).toMatchObject({
      consolidationHref: "/consolidation/media/fixture-media/lesson/core-vocab",
      ok: true,
      status: "completed"
    });
  });

  it("does not enqueue pre-FSRS consolidation when reopening a lesson", async () => {
    const result = await setLessonCompletionAction({
      completed: false,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionWithConsolidationMock).toHaveBeenCalledWith({
      completed: false,
      lessonId: "lesson_001"
    });
    expect(result.consolidationHref).toBeNull();
  });

  it("does not enqueue pre-FSRS consolidation when completion was already persisted", async () => {
    setLessonCompletionWithConsolidationMock.mockResolvedValueOnce({
      completedNow: false,
      consolidation: {
        createdCount: 0,
        subjectKeys: []
      },
      previousStatus: "completed",
      status: "completed"
    });

    const result = await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionWithConsolidationMock).toHaveBeenCalledWith({
      completed: true,
      lessonId: "lesson_001"
    });
    expect(result.consolidationHref).toBeNull();
  });
});
