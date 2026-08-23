import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  applyReviewActionCachePolicyMock,
  applyReviewGradeMock,
  resolvePostGradeReviewSessionPageDataMock,
  resolveReviewSessionMediaMock
} = vi.hoisted(() => ({
  applyReviewActionCachePolicyMock: vi.fn(),
  applyReviewGradeMock: vi.fn(),
  resolvePostGradeReviewSessionPageDataMock: vi.fn(),
  resolveReviewSessionMediaMock: vi.fn()
}));

vi.mock("@/features/cache/server/data-cache", () => ({
  listMediaCached: vi.fn()
}));

vi.mock("@/features/navigation", () => ({
  buildRedirectSearchParams: vi.fn(),
  buildReviewRedirectUrl: vi.fn()
}));

vi.mock("@/features/review/server/action-cache-policy", () => ({
  applyReviewActionCachePolicy: applyReviewActionCachePolicyMock
}));

vi.mock("@/features/review/server/action-mutations", () => ({
  runReviewActionMutation: vi.fn()
}));

vi.mock("@/features/review/server/card-hydration", () => ({
  hydrateReviewCard: vi.fn()
}));

vi.mock("@/features/review/server/page-data", () => ({
  loadReviewPageDataSession: vi.fn()
}));

vi.mock("@/features/review/server/service", () => ({
  applyReviewGrade: applyReviewGradeMock
}));

vi.mock("@/features/review/server/session-transition", () => ({
  requireMediaIdForSlug: vi.fn(),
  requireReviewPageDataForScope: vi.fn(),
  resolvePostGradeReviewSessionPageData:
    resolvePostGradeReviewSessionPageDataMock,
  resolveReviewSessionMedia: resolveReviewSessionMediaMock
}));

import { gradeReviewCardSessionWorkflow } from "@/features/review/server/action-workflows";

describe("review action workflows", () => {
  beforeEach(() => {
    applyReviewActionCachePolicyMock.mockReset();
    applyReviewGradeMock.mockReset();
    resolvePostGradeReviewSessionPageDataMock.mockReset();
    resolveReviewSessionMediaMock.mockReset();
    resolveReviewSessionMediaMock.mockResolvedValue(undefined);
    applyReviewGradeMock.mockResolvedValue({
      affectedCardIds: ["card-a"],
      consolidationChanged: false,
      mediaId: "media-a"
    });
  });

  it("registers deferred cache invalidation immediately after commit even when response projection fails", async () => {
    const projectionError = new Error("projection failed");
    const scheduledTasks: Array<() => void> = [];
    resolvePostGradeReviewSessionPageDataMock.mockRejectedValue(
      projectionError
    );

    await expect(
      gradeReviewCardSessionWorkflow(
        {
          answeredCount: 0,
          cardId: "card-a",
          extraNewCount: 0,
          rating: "good",
          scope: "global"
        },
        {
          scheduleCacheInvalidation: (task) => {
            scheduledTasks.push(task);
          }
        }
      )
    ).rejects.toBe(projectionError);

    expect(scheduledTasks).toHaveLength(1);
    expect(applyReviewActionCachePolicyMock).not.toHaveBeenCalled();

    scheduledTasks[0]!();

    expect(applyReviewActionCachePolicyMock).toHaveBeenCalledWith({
      affectedCardIds: ["card-a"],
      includeConsolidation: false,
      mediaId: "media-a",
      policy: "review"
    });
  });
});
