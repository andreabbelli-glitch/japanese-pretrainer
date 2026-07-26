import { afterEach, describe, expect, it, vi } from "vitest";

import * as settingsStoreModule from "@/features/fsrs-optimizer/server/settings-store";
import * as trainingDataModule from "@/features/fsrs-optimizer/server/training-data";
import { runFsrsOptimizer } from "@/features/fsrs-optimizer/tooling/trainer";
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
      settingsStoreModule,
      "getFreshFsrsOptimizerTrainingContext"
    ).mockImplementation(async () => {
      await snapshotGate.loader()();

      return {
        cacheKeyPart: "test-cache-key",
        snapshot: {
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
        }
      };
    });
    vi.spyOn(
      trainingDataModule,
      "countEligibleFsrsOptimizerReviewsByPreset"
    ).mockImplementation(async () => {
      await eligibleReviewCountGate.loader()();
      return { concept: 0, recognition: 12 };
    });
    vi.spyOn(settingsStoreModule, "writeFsrsOptimizerConfig").mockResolvedValue(
      undefined
    );
    vi.spyOn(settingsStoreModule, "writeFsrsOptimizerState").mockResolvedValue(
      undefined
    );
    vi.spyOn(settingsStoreModule, "getBindingPackageVersion").mockReturnValue(
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
