import { createHash } from "node:crypto";

import type { DatabaseClient } from "../../../db/index.ts";
import { reviewFsrsParameterSet } from "../../../db/schema/index.ts";
import type { ReviewRecallTask } from "../../../domain/review.ts";
import { getReviewDailyIntervalPolicyKey } from "../../review/model/interval-policy.ts";
import {
  CURRENT_REVIEW_SCHEDULER_VERSION,
  reviewSchedulerConfig
} from "../../review/model/scheduler.ts";
import { getReviewStudyDayPolicyKey } from "../../review/model/study-day.ts";

import type { FsrsOptimizerSnapshot } from "../model/snapshot";

export const FSRS_ALGORITHM_VERSION = "fsrs6" as const;
export const FSRS_SCHEDULER_BINDING_VERSION = "ts-fsrs@5.2.3";

type FsrsParameterSetWriter = Pick<DatabaseClient, "insert">;

export function buildFsrsParameterSet(
  snapshot: Pick<FsrsOptimizerSnapshot, "config" | "presets">,
  recallTask: ReviewRecallTask,
  createdAt = new Date().toISOString()
) {
  const preset =
    recallTask === "recognition" || recallTask === "concept"
      ? snapshot.presets[recallTask]
      : null;
  const parameters = {
    algorithmVersion: FSRS_ALGORITHM_VERSION,
    bindingVersion: FSRS_SCHEDULER_BINDING_VERSION,
    dailyIntervalPolicy: getReviewDailyIntervalPolicyKey(),
    desiredRetention: snapshot.config.desiredRetention,
    enableFuzz: reviewSchedulerConfig.fsrs.enable_fuzz,
    enableShortTerm: reviewSchedulerConfig.fsrs.enable_short_term,
    maximumInterval: reviewSchedulerConfig.fsrs.maximum_interval,
    optimizerBindingVersion: preset?.bindingVersion ?? null,
    optimizerDatasetVersion: preset?.datasetVersion ?? null,
    recallTask,
    schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
    studyDayPolicy: getReviewStudyDayPolicyKey(),
    weights: preset?.weights ?? [...reviewSchedulerConfig.fsrs.w]
  };
  const parametersJson = JSON.stringify(parameters);
  const parameterHash = `sha256:${createHash("sha256")
    .update(parametersJson)
    .digest("hex")}`;

  return {
    algorithmVersion: FSRS_ALGORITHM_VERSION,
    bindingVersion: FSRS_SCHEDULER_BINDING_VERSION,
    createdAt,
    desiredRetention: snapshot.config.desiredRetention,
    parameterHash,
    parametersJson,
    recallTask,
    schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION
  };
}

export async function persistFsrsParameterSet(
  database: FsrsParameterSetWriter,
  parameterSet: ReturnType<typeof buildFsrsParameterSet>
) {
  await database
    .insert(reviewFsrsParameterSet)
    .values(parameterSet)
    .onConflictDoNothing({
      target: reviewFsrsParameterSet.parameterHash
    });
}

export async function persistFsrsParameterSetsForSnapshot(
  database: FsrsParameterSetWriter,
  snapshot: Pick<FsrsOptimizerSnapshot, "config" | "presets">,
  createdAt = new Date().toISOString()
) {
  for (const recallTask of [
    "recognition",
    "concept",
    "other"
  ] as const satisfies readonly ReviewRecallTask[]) {
    await persistFsrsParameterSet(
      database,
      buildFsrsParameterSet(snapshot, recallTask, createdAt)
    );
  }
}
