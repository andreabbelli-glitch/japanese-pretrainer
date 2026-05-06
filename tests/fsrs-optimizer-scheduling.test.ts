import { afterEach, describe, expect, it, vi } from "vitest";

import * as fsrsOptimizerModule from "@/lib/fsrs-optimizer";
import { runFsrsOptimizer } from "@/lib/fsrs-optimizer-trainer";
import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

describe("fsrs optimizer query scheduling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts counting eligible reviews before the optimizer snapshot settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const snapshotGate = schedule.gate("optimizer snapshot");
    const eligibleReviewCountGate = schedule.gate("eligible review count");

    vi.spyOn(
      fsrsOptimizerModule,
      "getFsrsOptimizerSnapshot"
    ).mockImplementation(async () => {
      await snapshotGate.loader()();

      return {
        config: {
          desiredRetention: 0.9,
          enabled: false,
          minDaysBetweenRuns: 7,
          minNewReviews: 50,
          presetStrategy: "card_type_v1"
        },
        presets: {
          concept: null,
          recognition: null
        },
        state: {
          bindingVersion: "0.3.0",
          lastAttemptAt: null,
          lastCheckAt: null,
          lastSuccessfulTrainingAt: null,
          lastTrainingError: null,
          newEligibleReviewsSinceLastTraining: 0,
          totalEligibleReviewsAtLastTraining: 0
        }
      };
    });
    vi.spyOn(
      fsrsOptimizerModule,
      "countEligibleFsrsOptimizerReviews"
    ).mockImplementation(async () => {
      await eligibleReviewCountGate.loader()();
      return 12;
    });
    vi.spyOn(fsrsOptimizerModule, "writeFsrsOptimizerConfig").mockResolvedValue(
      undefined
    );
    vi.spyOn(fsrsOptimizerModule, "writeFsrsOptimizerState").mockResolvedValue(
      undefined
    );
    vi.spyOn(fsrsOptimizerModule, "getBindingPackageVersion").mockReturnValue(
      "0.3.0"
    );

    const runPromise = runFsrsOptimizer({
      database: {} as never,
      now: new Date("2026-04-01T09:00:00.000Z")
    });

    try {
      await schedule.expectStarted(
        "optimizer snapshot",
        "eligible review count"
      );
      schedule.expectNotSettled("optimizer snapshot");
    } finally {
      snapshotGate.resolve();
      eligibleReviewCountGate.resolve();
    }

    await expect(runPromise).resolves.toMatchObject({
      newEligibleReviews: 12,
      reason: "disabled",
      status: "skipped",
      totalEligibleReviews: 12
    });
  });
});
