import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  closeDatabaseClientMock,
  dbMock,
  resolveDatabaseLocationMock,
  runFsrsOptimizerMock
} = vi.hoisted(() => ({
  closeDatabaseClientMock: vi.fn(),
  dbMock: {},
  resolveDatabaseLocationMock: vi.fn(() => ({
    configuredPath: "test.sqlite",
    databasePath: "test.sqlite"
  })),
  runFsrsOptimizerMock: vi.fn()
}));

vi.mock("../src/db/client.ts", () => ({
  closeDatabaseClient: closeDatabaseClientMock,
  db: dbMock
}));

vi.mock("../src/db/config.ts", () => ({
  resolveDatabaseLocation: resolveDatabaseLocationMock
}));

vi.mock("../src/features/fsrs-optimizer/tooling/trainer.ts", () => ({
  runFsrsOptimizer: runFsrsOptimizerMock
}));

const originalExitCode = process.exitCode;

describe.each([
  {
    force: true,
    importScript: () => import("../scripts/fsrs-optimize.ts"),
    name: "forced optimizer"
  },
  {
    force: undefined,
    importScript: () => import("../scripts/fsrs-optimize-if-needed.ts"),
    name: "conditional optimizer"
  }
])("$name CLI", ({ force, importScript }) => {
  beforeEach(() => {
    vi.resetModules();
    runFsrsOptimizerMock.mockReset();
    closeDatabaseClientMock.mockReset();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it("sets a non-zero exit code after a global optimizer failure", async () => {
    runFsrsOptimizerMock.mockResolvedValue(buildFailedResult());
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await importScript();

    expect(runFsrsOptimizerMock).toHaveBeenCalledWith({
      database: dbMock,
      ...(force === undefined ? {} : { force })
    });
    expect(process.exitCode).toBe(1);
    expect(closeDatabaseClientMock).toHaveBeenCalledWith(dbMock);
  });

  it("keeps exit success when one preset succeeds", async () => {
    runFsrsOptimizerMock.mockResolvedValue(buildPartialSuccessResult());
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    await importScript();

    expect(process.exitCode).toBeUndefined();
    expect(closeDatabaseClientMock).toHaveBeenCalledWith(dbMock);
  });
});

function buildFailedResult() {
  return {
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
}

function buildPartialSuccessResult() {
  return {
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
}
