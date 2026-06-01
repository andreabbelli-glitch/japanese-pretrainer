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

  it("returns the selected lesson data without recording an opened lesson", async () => {
    const lessonData = {
      lesson: {
        id: "lesson-selected"
      }
    } as TextbookLessonData;

    getTextbookLessonDataMock.mockResolvedValue(lessonData);

    await expect(
      loadLessonReaderRouteData({
        lessonSlug: "core-vocab",
        mediaSlug: "fixture-media"
      })
    ).resolves.toBe(lessonData);

    expect(recordLessonOpenedMock).not.toHaveBeenCalled();
    expect(settleLessonOpenedStateForRenderMock).not.toHaveBeenCalled();
  });

  it("does not wait for opened-state settlement during route loading", async () => {
    const lessonData = {
      lesson: {
        id: "lesson-selected"
      }
    } as TextbookLessonData;
    const settledData = {
      ...lessonData,
      lesson: {
        id: "lesson-selected",
        status: "completed"
      }
    } as TextbookLessonData;

    getTextbookLessonDataMock.mockResolvedValue(lessonData);
    settleLessonOpenedStateForRenderMock.mockResolvedValue(settledData);

    const result = await loadLessonReaderRouteData({
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(result).toBe(lessonData);
    expect(recordLessonOpenedMock).not.toHaveBeenCalled();
    expect(settleLessonOpenedStateForRenderMock).not.toHaveBeenCalled();
  });
});
