import type { TextbookLessonData } from "@/features/textbook/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getTextbookLessonDataMock,
  recordLessonOpenedMock,
  settleLessonOpenedStateForRenderMock
} = vi.hoisted(() => ({
  getTextbookLessonDataMock: vi.fn(),
  recordLessonOpenedMock: vi.fn(),
  settleLessonOpenedStateForRenderMock: vi.fn()
}));

vi.mock("@/features/textbook/server", () => ({
  getTextbookLessonData: getTextbookLessonDataMock,
  recordLessonOpened: recordLessonOpenedMock,
  settleLessonOpenedStateForRender: settleLessonOpenedStateForRenderMock
}));

import { loadLessonReaderRouteData } from "@/app/media/[mediaSlug]/textbook/[lessonSlug]/route-data";

describe("textbook lesson route data", () => {
  beforeEach(() => {
    getTextbookLessonDataMock.mockReset();
    recordLessonOpenedMock.mockReset();
    settleLessonOpenedStateForRenderMock.mockReset();
  });

  it("returns null for a missing lesson without recording an opened lesson", async () => {
    getTextbookLessonDataMock.mockResolvedValue(null);

    await expect(
      loadLessonReaderRouteData({
        lessonSlug: "missing-lesson",
        mediaSlug: "fixture-media"
      })
    ).resolves.toBeNull();

    expect(getTextbookLessonDataMock).toHaveBeenCalledWith(
      "fixture-media",
      "missing-lesson"
    );
    expect(recordLessonOpenedMock).not.toHaveBeenCalled();
    expect(settleLessonOpenedStateForRenderMock).not.toHaveBeenCalled();
  });

  it("records the opened state for the selected lesson id", async () => {
    const lessonData = {
      lesson: {
        id: "lesson-selected"
      }
    } as TextbookLessonData;
    const openedState = Promise.resolve({
      lastOpenedAt: "2026-04-25T10:00:00.000Z",
      startedAt: "2026-04-25T10:00:00.000Z",
      status: "in_progress" as const
    });
    const settledData = {
      ...lessonData,
      lesson: {
        id: "lesson-selected",
        status: "in_progress"
      }
    } as TextbookLessonData;

    getTextbookLessonDataMock.mockResolvedValue(lessonData);
    recordLessonOpenedMock.mockReturnValue(openedState);
    settleLessonOpenedStateForRenderMock.mockResolvedValue(settledData);

    await expect(
      loadLessonReaderRouteData({
        lessonSlug: "core-vocab",
        mediaSlug: "fixture-media"
      })
    ).resolves.toBe(settledData);

    expect(recordLessonOpenedMock).toHaveBeenCalledWith("lesson-selected");
    expect(settleLessonOpenedStateForRenderMock).toHaveBeenCalledWith(
      lessonData,
      openedState
    );
  });

  it("returns the settled render data", async () => {
    const lessonData = {
      lesson: {
        id: "lesson-selected"
      }
    } as TextbookLessonData;
    const openedState = Promise.resolve({
      lastOpenedAt: "2026-04-25T10:00:00.000Z",
      startedAt: "2026-04-25T10:00:00.000Z",
      status: "completed" as const
    });
    const settledData = {
      ...lessonData,
      lesson: {
        id: "lesson-selected",
        status: "completed"
      }
    } as TextbookLessonData;

    getTextbookLessonDataMock.mockResolvedValue(lessonData);
    recordLessonOpenedMock.mockReturnValue(openedState);
    settleLessonOpenedStateForRenderMock.mockResolvedValue(settledData);

    const result = await loadLessonReaderRouteData({
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(result).toBe(settledData);
  });
});
