import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, runFsrsOptimizerMock } = vi.hoisted(() => ({
  dbMock: {},
  runFsrsOptimizerMock: vi.fn()
}));

vi.mock("@/db", () => ({
  db: dbMock
}));

vi.mock("@/features/fsrs-optimizer/tooling/trainer", () => ({
  runFsrsOptimizer: runFsrsOptimizerMock
}));

import { GET } from "@/app/api/internal/fsrs-optimizer/run/route";

describe("FSRS optimizer cron route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret";
    runFsrsOptimizerMock.mockReset();
  });

  it("rejects requests without the configured cron bearer token", async () => {
    const response = await GET(
      new Request("https://example.test/api/internal/fsrs-optimizer/run")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized."
    });
    expect(runFsrsOptimizerMock).not.toHaveBeenCalled();
  });

  it("reports a server configuration error when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(
      new Request("https://example.test/api/internal/fsrs-optimizer/run", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "CRON_SECRET is not configured on the app runtime."
    });
    expect(runFsrsOptimizerMock).not.toHaveBeenCalled();
  });

  it("runs the optimizer and returns its result for authorized cron requests", async () => {
    runFsrsOptimizerMock.mockResolvedValue({
      lastCheckAt: "2026-05-01T03:00:00.000Z",
      newEligibleReviews: 1793,
      reason: "too-soon",
      status: "skipped",
      totalEligibleReviews: 2669
    });

    const response = await GET(
      new Request("https://example.test/api/internal/fsrs-optimizer/run", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result: {
        lastCheckAt: "2026-05-01T03:00:00.000Z",
        newEligibleReviews: 1793,
        reason: "too-soon",
        status: "skipped",
        totalEligibleReviews: 2669
      }
    });
    expect(runFsrsOptimizerMock).toHaveBeenCalledWith({
      database: dbMock
    });
  });

  it("returns a non-success response when every evaluated preset fails", async () => {
    const result = {
      error: "FSRS optimizer failed for every evaluated preset.",
      failedAt: "2026-05-01T03:00:00.000Z",
      lastCheckAt: "2026-05-01T03:00:00.000Z",
      newEligibleReviews: 24,
      presetResults: {
        concept: {
          error: "concept optimizer failed",
          reason: "training-error",
          status: "failed",
          trainingReviewCount: 12
        },
        recognition: {
          error: "recognition optimizer failed",
          reason: "training-error",
          status: "failed",
          trainingReviewCount: 12
        }
      },
      reason: "all-presets-failed",
      status: "failed",
      totalEligibleReviews: 24
    };

    runFsrsOptimizerMock.mockResolvedValue(result);

    const response = await GET(
      new Request("https://example.test/api/internal/fsrs-optimizer/run", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      result
    });
  });

  it("keeps a partial preset success on the successful cron path", async () => {
    const result = {
      lastCheckAt: "2026-05-01T03:00:00.000Z",
      newEligibleReviews: 12,
      presetResults: {
        concept: {
          error: "concept optimizer failed",
          reason: "training-error",
          status: "failed",
          trainingReviewCount: 12
        },
        recognition: {
          reason: "candidate-improved",
          status: "trained",
          trainingReviewCount: 12
        }
      },
      status: "trained",
      totalEligibleReviews: 24,
      trainedAt: "2026-05-01T03:00:00.000Z"
    };

    runFsrsOptimizerMock.mockResolvedValue(result);

    const response = await GET(
      new Request("https://example.test/api/internal/fsrs-optimizer/run", {
        headers: {
          authorization: "Bearer cron-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      result
    });
  });
});
