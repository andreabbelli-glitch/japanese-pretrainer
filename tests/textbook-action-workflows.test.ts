import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMediaBySlugCachedDefaultMock,
  updateConsolidationSummaryCacheMock,
  updateMediaListCacheMock,
  updateReviewSummaryCacheMock,
  setLessonCompletionWithConsolidationMock
} = vi.hoisted(() => ({
  getMediaBySlugCachedDefaultMock: vi.fn(),
  updateConsolidationSummaryCacheMock: vi.fn(),
  updateMediaListCacheMock: vi.fn(),
  updateReviewSummaryCacheMock: vi.fn(),
  setLessonCompletionWithConsolidationMock: vi.fn()
}));

vi.mock("@/features/cache/server/data-cache", () => ({
  getMediaBySlugCachedDefault: getMediaBySlugCachedDefaultMock,
  updateConsolidationSummaryCache: updateConsolidationSummaryCacheMock,
  updateMediaListCache: updateMediaListCacheMock,
  updateReviewSummaryCache: updateReviewSummaryCacheMock
}));

vi.mock("@/features/consolidation/server", () => ({
  setLessonCompletionWithConsolidation: setLessonCompletionWithConsolidationMock
}));

import { setLessonCompletionForAction } from "@/features/textbook/server/action-workflows";

describe("textbook action workflows", () => {
  beforeEach(() => {
    getMediaBySlugCachedDefaultMock.mockReset();
    getMediaBySlugCachedDefaultMock.mockResolvedValue({ id: "media_fixture" });
    updateConsolidationSummaryCacheMock.mockReset();
    updateMediaListCacheMock.mockReset();
    updateReviewSummaryCacheMock.mockReset();
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

  it("revalidates media and review caches after lesson completion changes", async () => {
    await setLessonCompletionForAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionWithConsolidationMock).toHaveBeenCalledWith({
      completed: true,
      lessonId: "lesson_001"
    });
    expect(getMediaBySlugCachedDefaultMock).toHaveBeenCalledWith("fixture-media");
    expect(updateMediaListCacheMock).toHaveBeenCalledTimes(1);
    expect(updateConsolidationSummaryCacheMock).toHaveBeenCalledWith(
      "media_fixture"
    );
    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith("media_fixture");
  });

  it("returns a consolidation href only for newly completed lessons with queued cards", async () => {
    await expect(
      setLessonCompletionForAction({
        completed: true,
        lessonId: "lesson_001",
        lessonSlug: "core-vocab",
        mediaSlug: "fixture-media"
      })
    ).resolves.toMatchObject({
      consolidationHref: "/consolidation/media/fixture-media/lesson/core-vocab",
      ok: true,
      status: "completed"
    });

    setLessonCompletionWithConsolidationMock.mockResolvedValueOnce({
      completedNow: false,
      consolidation: {
        createdCount: 0,
        subjectKeys: []
      },
      previousStatus: "completed",
      status: "completed"
    });

    await expect(
      setLessonCompletionForAction({
        completed: true,
        lessonId: "lesson_001",
        lessonSlug: "core-vocab",
        mediaSlug: "fixture-media"
      })
    ).resolves.toMatchObject({
      consolidationHref: null,
      ok: true,
      status: "completed"
    });
  });
});
