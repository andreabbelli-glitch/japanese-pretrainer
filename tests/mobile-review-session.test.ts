import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";

const { getGlobalReviewPageLoadResultMock } = vi.hoisted(() => ({
  getGlobalReviewPageLoadResultMock: vi.fn()
}));

vi.mock("@/features/review/server", () => ({
  applyReviewGrade: vi.fn(),
  getGlobalReviewPageLoadResult: getGlobalReviewPageLoadResultMock
}));

import { loadMobileReviewSession } from "@/features/mobile-review/server/session";

describe("mobile review session", () => {
  beforeEach(() => {
    getGlobalReviewPageLoadResultMock.mockReset();
    getGlobalReviewPageLoadResultMock.mockResolvedValue({
      kind: "empty-cards"
    });
  });

  it("loads the day-sensitive queue state without the shared summary cache", async () => {
    const database = {} as DatabaseClient;

    await loadMobileReviewSession(database);

    expect(getGlobalReviewPageLoadResultMock).toHaveBeenCalledWith(
      {},
      database,
      {
        bypassCache: true
      }
    );
  });
});
