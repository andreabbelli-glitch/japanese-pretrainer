import { afterEach, describe, expect, it, vi } from "vitest";

import * as fsrsOptimizerModule from "@/lib/fsrs-optimizer";
import { runFsrsOptimizer } from "@/lib/fsrs-optimizer-trainer";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolve!: () => void;

  return {
    promise: new Promise<void>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}

async function waitForTruthy(
  predicate: () => boolean,
  message: string,
  attempts = 50
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(message);
}

describe("fsrs optimizer query scheduling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts counting eligible reviews before the optimizer snapshot settles", async () => {
    const snapshotGate = createDeferred();
    let snapshotStarted = false;
    let eligibleReviewCountStarted = false;

    vi.spyOn(fsrsOptimizerModule, "getFsrsOptimizerSnapshot").mockImplementation(
      async () => {
        snapshotStarted = true;
        await snapshotGate.promise;

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
      }
    );
    vi.spyOn(
      fsrsOptimizerModule,
      "countEligibleFsrsOptimizerReviews"
    ).mockImplementation(async () => {
      eligibleReviewCountStarted = true;
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
      await waitForTruthy(
        () => snapshotStarted,
        "Expected the optimizer snapshot lookup to start."
      );
      expect(eligibleReviewCountStarted).toBe(true);
    } finally {
      snapshotGate.resolve();
    }

    await expect(runPromise).resolves.toMatchObject({
      newEligibleReviews: 12,
      reason: "disabled",
      status: "skipped",
      totalEligibleReviews: 12
    });
  });
});
