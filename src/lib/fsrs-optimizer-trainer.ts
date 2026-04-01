import {
  FSRSBindingItem,
  FSRSBindingReview,
  computeParameters
} from "@open-spaced-repetition/binding";

import { db, type DatabaseClient } from "../db/index.ts";
import {
  buildFsrsTrainingDataset,
  countEligibleFsrsOptimizerReviews,
  getBindingPackageVersion,
  getFsrsOptimizerSnapshot,
  loadFsrsOptimizerLogRows,
  normalizeFsrsWeights,
  writeFsrsOptimizedParameters,
  writeFsrsOptimizerConfig,
  writeFsrsOptimizerState,
  type FsrsOptimizedParameters,
  type FsrsOptimizationRunResult,
  type FsrsPresetKey
} from "./fsrs-optimizer.ts";

const DAY = 24 * 60 * 60_000;
const MIN_TRAINING_REVIEW_COUNT = 10;
const MIN_TRAINING_ITEM_COUNT = 5;

type FsrsOptimizationPresetResult = NonNullable<
  Extract<FsrsOptimizationRunResult, { status: "trained" }>["presetResults"][FsrsPresetKey]
>;

export async function runFsrsOptimizer(
  input: {
    database?: DatabaseClient;
    force?: boolean;
    now?: Date;
  } = {}
): Promise<FsrsOptimizationRunResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const snapshot = await getFsrsOptimizerSnapshot(database);
  const totalEligibleReviews = await countEligibleFsrsOptimizerReviews(database);
  const newEligibleReviews = Math.max(
    totalEligibleReviews - snapshot.state.totalEligibleReviewsAtLastTraining,
    0
  );

  await writeFsrsOptimizerConfig(snapshot.config, database, nowIso);

  if (!input.force && !snapshot.config.enabled) {
    await writeFsrsOptimizerState(
      {
        ...snapshot.state,
        bindingVersion: getBindingPackageVersion(),
        lastCheckAt: nowIso,
        newEligibleReviewsSinceLastTraining: newEligibleReviews
      },
      database,
      nowIso
    );

    return {
      lastCheckAt: nowIso,
      newEligibleReviews,
      reason: "disabled",
      status: "skipped",
      totalEligibleReviews
    };
  }

  if (
    !input.force &&
    snapshot.state.lastSuccessfulTrainingAt &&
    now.getTime() - new Date(snapshot.state.lastSuccessfulTrainingAt).getTime() <
      snapshot.config.minDaysBetweenRuns * DAY
  ) {
    await writeFsrsOptimizerState(
      {
        ...snapshot.state,
        bindingVersion: getBindingPackageVersion(),
        lastCheckAt: nowIso,
        newEligibleReviewsSinceLastTraining: newEligibleReviews
      },
      database,
      nowIso
    );

    return {
      lastCheckAt: nowIso,
      newEligibleReviews,
      reason: "too-soon",
      status: "skipped",
      totalEligibleReviews
    };
  }

  if (!input.force && newEligibleReviews < snapshot.config.minNewReviews) {
    await writeFsrsOptimizerState(
      {
        ...snapshot.state,
        bindingVersion: getBindingPackageVersion(),
        lastCheckAt: nowIso,
        newEligibleReviewsSinceLastTraining: newEligibleReviews
      },
      database,
      nowIso
    );

    return {
      lastCheckAt: nowIso,
      newEligibleReviews,
      reason: "insufficient-new-reviews",
      status: "skipped",
      totalEligibleReviews
    };
  }

  const rows = await loadFsrsOptimizerLogRows(database);
  const recognitionDataset = buildFsrsTrainingDataset(rows, "recognition");
  const conceptDataset = buildFsrsTrainingDataset(rows, "concept");
  const recognitionTrainable =
    recognitionDataset.itemCount >= MIN_TRAINING_ITEM_COUNT &&
    recognitionDataset.reviewCount >= MIN_TRAINING_REVIEW_COUNT;
  const conceptTrainable =
    conceptDataset.itemCount >= MIN_TRAINING_ITEM_COUNT &&
    conceptDataset.reviewCount >= MIN_TRAINING_REVIEW_COUNT;

  if (!recognitionTrainable && !conceptTrainable) {
    await writeFsrsOptimizerState(
      {
        ...snapshot.state,
        bindingVersion: getBindingPackageVersion(),
        lastAttemptAt: nowIso,
        lastCheckAt: nowIso,
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: newEligibleReviews
      },
      database,
      nowIso
    );

    return {
      lastCheckAt: nowIso,
      newEligibleReviews,
      reason: "no-trainable-data",
      status: "skipped",
      totalEligibleReviews
    };
  }

  try {
    const presetResults: Record<FsrsPresetKey, FsrsOptimizationPresetResult> = {
      concept: {
        status: "unchanged",
        trainingReviewCount: conceptDataset.reviewCount
      },
      recognition: {
        status: "unchanged",
        trainingReviewCount: recognitionDataset.reviewCount
      }
    };
    const trainedParameters: FsrsOptimizedParameters[] = [];

    if (recognitionTrainable) {
      const weights = await computeParameters(
        buildBindingItems(recognitionDataset.items),
        {
          enableShortTerm: true,
          numRelearningSteps: 1,
          timeout: 5_000
        }
      );
      const normalizedWeights = normalizeFsrsWeights(weights);

      if (!normalizedWeights) {
        throw new Error("Recognition training produced invalid FSRS weights.");
      }

      trainedParameters.push({
        desiredRetention: snapshot.config.desiredRetention,
        presetKey: "recognition" as const,
        trainedAt: nowIso,
        trainingReviewCount: recognitionDataset.reviewCount,
        weights: normalizedWeights
      });
      presetResults.recognition.status = "trained";
    }

    if (conceptTrainable) {
      const weights = await computeParameters(buildBindingItems(conceptDataset.items), {
        enableShortTerm: true,
        numRelearningSteps: 1,
        timeout: 5_000
      });
      const normalizedWeights = normalizeFsrsWeights(weights);

      if (!normalizedWeights) {
        throw new Error("Concept training produced invalid FSRS weights.");
      }

      trainedParameters.push({
        desiredRetention: snapshot.config.desiredRetention,
        presetKey: "concept" as const,
        trainedAt: nowIso,
        trainingReviewCount: conceptDataset.reviewCount,
        weights: normalizedWeights
      });
      presetResults.concept.status = "trained";
    }

    await database.transaction(async (tx) => {
      for (const parameters of trainedParameters) {
        await writeFsrsOptimizedParameters(parameters, tx, nowIso);
      }

      await writeFsrsOptimizerState(
        {
          bindingVersion: getBindingPackageVersion(),
          lastAttemptAt: nowIso,
          lastCheckAt: nowIso,
          lastSuccessfulTrainingAt: nowIso,
          lastTrainingError: null,
          newEligibleReviewsSinceLastTraining: 0,
          totalEligibleReviewsAtLastTraining: totalEligibleReviews
        },
        tx,
        nowIso
      );
    });

    return {
      lastCheckAt: nowIso,
      newEligibleReviews: 0,
      presetResults,
      status: "trained",
      totalEligibleReviews,
      trainedAt: nowIso
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await writeFsrsOptimizerState(
      {
        ...snapshot.state,
        bindingVersion: getBindingPackageVersion(),
        lastAttemptAt: nowIso,
        lastCheckAt: nowIso,
        lastTrainingError: message,
        newEligibleReviewsSinceLastTraining: newEligibleReviews
      },
      database,
      nowIso
    );

    throw error;
  }
}

function buildBindingItems(
  items: Array<Array<{ deltaT: number; rating: 1 | 2 | 3 | 4 }>>
) {
  return items.map(
    (reviews) =>
      new FSRSBindingItem(
        reviews.map((review) => new FSRSBindingReview(review.rating, review.deltaT))
      )
  );
}
