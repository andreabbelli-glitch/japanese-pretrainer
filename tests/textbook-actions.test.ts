import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  revalidatePathMock,
  setFuriganaModeMock,
  setLessonCompletionStateMock
} = vi.hoisted(() => ({
  revalidatePathMock: vi.fn(),
  setFuriganaModeMock: vi.fn(),
  setLessonCompletionStateMock: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("@/lib/textbook", () => ({
  setFuriganaMode: setFuriganaModeMock,
  setLessonCompletionState: setLessonCompletionStateMock
}));

import { setLessonCompletionAction } from "@/actions/textbook";

describe("textbook actions", () => {
  beforeEach(() => {
    revalidatePathMock.mockReset();
    setFuriganaModeMock.mockReset();
    setLessonCompletionStateMock.mockReset();
  });

  it("revalidates review surfaces after lesson completion changes", async () => {
    await setLessonCompletionAction({
      completed: true,
      lessonId: "lesson_001",
      lessonSlug: "core-vocab",
      mediaSlug: "fixture-media"
    });

    expect(setLessonCompletionStateMock).toHaveBeenCalledWith("lesson_001", true);
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/review");
    expect(revalidatePathMock).toHaveBeenCalledWith("/media/fixture-media");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/media/fixture-media/progress"
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/media/fixture-media/review");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/media/fixture-media/textbook"
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/media/fixture-media/textbook/core-vocab"
    );
  });
});
