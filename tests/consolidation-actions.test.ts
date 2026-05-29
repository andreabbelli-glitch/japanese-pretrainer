import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  invalidateConsolidationMutationCachesMock,
  markConsolidationKnownMock,
  submitConsolidationAnswerMock
} = vi.hoisted(() => ({
  invalidateConsolidationMutationCachesMock: vi.fn(),
  markConsolidationKnownMock: vi.fn(),
  submitConsolidationAnswerMock: vi.fn()
}));

vi.mock("@/features/consolidation/server", () => ({
  markConsolidationKnown: markConsolidationKnownMock,
  submitConsolidationAnswer: submitConsolidationAnswerMock
}));

vi.mock("@/lib/cache-invalidation-policy", () => ({
  invalidateConsolidationMutationCaches:
    invalidateConsolidationMutationCachesMock
}));

import {
  markConsolidationKnownAction,
  submitConsolidationAnswerAction
} from "@/actions/consolidation";

describe("consolidation actions", () => {
  beforeEach(() => {
    invalidateConsolidationMutationCachesMock.mockReset();
    markConsolidationKnownMock.mockReset();
    submitConsolidationAnswerMock.mockReset();
  });

  it("submits an answer and invalidates consolidation/review caches for the media", async () => {
    submitConsolidationAnswerMock.mockResolvedValueOnce({
      completed: true,
      correct: true,
      lessonId: "lesson_001",
      mediaId: "media_001",
      status: "passed",
      subjectKey: "entry:term:term_001"
    });

    const result = await submitConsolidationAnswerAction({
      selectedSubjectKey: "entry:term:term_001",
      step: "meaning",
      subjectKey: "entry:term:term_001"
    });

    expect(submitConsolidationAnswerMock).toHaveBeenCalledWith({
      selectedSubjectKey: "entry:term:term_001",
      step: "meaning",
      subjectKey: "entry:term:term_001"
    });
    expect(invalidateConsolidationMutationCachesMock).toHaveBeenCalledWith({
      mediaId: "media_001"
    });
    expect(result.status).toBe("passed");
  });

  it("marks a subject known and invalidates consolidation/review caches for the media", async () => {
    markConsolidationKnownMock.mockResolvedValueOnce({
      completed: true,
      lessonId: "lesson_001",
      mediaId: "media_001",
      status: "known_manual",
      subjectKey: "entry:term:term_001"
    });

    const result = await markConsolidationKnownAction({
      subjectKey: "entry:term:term_001"
    });

    expect(markConsolidationKnownMock).toHaveBeenCalledWith({
      subjectKey: "entry:term:term_001"
    });
    expect(invalidateConsolidationMutationCachesMock).toHaveBeenCalledWith({
      mediaId: "media_001"
    });
    expect(result.status).toBe("known_manual");
  });
});
