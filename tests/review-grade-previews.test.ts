import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewSeedState } from "@/lib/review-grade-previews";

const { scheduleReviewMock } = vi.hoisted(() => ({
  scheduleReviewMock: vi.fn()
}));

vi.mock("@/lib/review-scheduler", async () => {
  const actual = await vi.importActual<typeof import("@/lib/review-scheduler")>(
    "@/lib/review-scheduler"
  );

  return {
    ...actual,
    scheduleReview: scheduleReviewMock
  };
});

const baseSeedState: ReviewSeedState = {
  difficulty: 5,
  dueAt: "2026-04-10T08:00:00.000Z",
  lapses: 0,
  lastReviewedAt: "2026-04-10T08:00:00.000Z",
  learningSteps: 0,
  reps: 10,
  scheduledDays: 10,
  stability: 12,
  state: "review"
};

describe("review grade previews", () => {
  beforeEach(() => {
    scheduleReviewMock.mockReset();
  });

  it("keeps minute countdowns for intervals just below one hour", async () => {
    const { buildReviewGradePreviews } = await import(
      "@/lib/review-grade-previews"
    );
    const now = new Date("2026-04-10T10:00:00.000Z");
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "again"
          ? new Date(now.getTime() + 59.5 * 60_000).toISOString()
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(
      baseSeedState,
      now
    );

    expect(previews.some((preview) => preview.nextReviewLabel === "Tra 60 min")).toBe(
      true
    );
  });

  it("does not label intervals above five minutes as immediate", async () => {
    const { buildReviewGradePreviews } = await import(
      "@/lib/review-grade-previews"
    );
    const now = new Date("2026-04-10T10:00:00.000Z");
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "again"
          ? new Date(now.getTime() + 5.1 * 60_000).toISOString()
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(
      baseSeedState,
      now
    );

    expect(previews.some((preview) => preview.nextReviewLabel === "Tra 6 min")).toBe(
      true
    );
    expect(previews.every((preview) => preview.nextReviewLabel !== "Subito")).toBe(
      true
    );
  });

  it("formats fallback dates using the local calendar day", async () => {
    const { buildReviewGradePreviews } = await import(
      "@/lib/review-grade-previews"
    );
    const now = new Date("2026-04-10T10:00:00.000Z");
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "again"
          ? "2026-05-01T22:30:00.000Z"
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(baseSeedState, now);

    expect(previews.some((preview) => preview.nextReviewLabel === "Il 2026-05-02")).toBe(
      true
    );
  });
});
