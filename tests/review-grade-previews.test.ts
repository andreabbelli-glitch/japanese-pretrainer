import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewSeedState } from "@/features/review/model/grade-previews";

const { scheduleReviewMock } = vi.hoisted(() => ({
  scheduleReviewMock: vi.fn()
}));

vi.mock("@/features/review/model/scheduler", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/review/model/scheduler")
  >("@/features/review/model/scheduler");

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
  const originalTimezone = process.env.TZ;

  afterAll(() => {
    process.env.TZ = originalTimezone;
  });

  beforeEach(() => {
    process.env.TZ = "Europe/Rome";
    scheduleReviewMock.mockReset();
    vi.resetModules();
  });

  it("keeps minute countdowns for intervals just below one hour", async () => {
    const { buildReviewGradePreviews } =
      await import("@/features/review/model/grade-previews");
    const now = new Date("2026-04-10T10:00:00.000Z");
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "again"
          ? new Date(now.getTime() + 59.5 * 60_000).toISOString()
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(baseSeedState, now);

    expect(
      previews.some((preview) => preview.nextReviewLabel === "Tra 60 min")
    ).toBe(true);
  });

  it("does not label intervals above five minutes as immediate", async () => {
    const { buildReviewGradePreviews } =
      await import("@/features/review/model/grade-previews");
    const now = new Date("2026-04-10T10:00:00.000Z");
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "again"
          ? new Date(now.getTime() + 5.1 * 60_000).toISOString()
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(baseSeedState, now);

    expect(
      previews.some((preview) => preview.nextReviewLabel === "Tra 6 min")
    ).toBe(true);
    expect(
      previews.every((preview) => preview.nextReviewLabel !== "Subito")
    ).toBe(true);
  });

  it("formats fallback dates using the local calendar day", async () => {
    const { buildReviewGradePreviews } =
      await import("@/features/review/model/grade-previews");
    const now = new Date("2026-04-10T10:00:00.000Z");
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "again"
          ? "2026-05-01T22:30:00.000Z"
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(baseSeedState, now);

    expect(
      previews.some((preview) => preview.nextReviewLabel === "Il 2026-05-02")
    ).toBe(true);
  });

  it("labels tomorrow by local calendar date across the spring DST boundary", async () => {
    const { buildReviewGradePreviews } =
      await import("@/features/review/model/grade-previews");
    const now = new Date(2026, 2, 29, 12, 0, 0);
    const tomorrowMorning = new Date(2026, 2, 30, 10, 0, 0);
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "again"
          ? tomorrowMorning.toISOString()
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(baseSeedState, now);

    expect(
      previews.some(
        (preview) => preview.nextReviewLabel === "Domani alle 10:00"
      )
    ).toBe(true);
  });

  it("labels a pre-rollover due time as tomorrow's study day", async () => {
    const { buildReviewGradePreviews } =
      await import("@/features/review/model/grade-previews");
    const now = new Date("2026-07-03T18:03:00.000Z");
    scheduleReviewMock.mockImplementation(({ rating }: { rating: string }) => ({
      dueAt:
        rating === "good"
          ? "2026-07-05T00:00:00.000Z"
          : new Date(now.getTime() + 2 * 60 * 60_000).toISOString()
    }));

    const previews = buildReviewGradePreviews(baseSeedState, now);

    expect(
      previews.some(
        (preview) => preview.nextReviewLabel === "Domani alle 02:00"
      )
    ).toBe(true);
    expect(
      previews.every((preview) => preview.nextReviewLabel !== "Tra 2 giorni")
    ).toBe(true);
  });
});
