import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { desc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  reviewFsrsParameterSet,
  reviewSubjectLog,
  reviewSubjectState,
  userSetting
} from "@/db/schema";
import {
  buildReviewSeedStateWithFsrsPreset,
  getFsrsOptimizerCacheKeyPart,
  getFsrsOptimizerConfigDefaults,
  getFsrsOptimizerSnapshot,
  getFsrsOptimizerStatus,
  writeFsrsOptimizerConfig,
  writeFsrsOptimizerState
} from "@/features/fsrs-optimizer/server";
import * as settingsStore from "@/features/fsrs-optimizer/server/settings-store";
import {
  runFsrsOptimizer,
  type FsrsTrainingAdapter
} from "@/features/fsrs-optimizer/tooling/trainer";
import { buildServerReviewGradePreviews } from "@/features/review/server/grade-previews";
import { scheduleReviewWithDailyIntervalPolicy } from "@/features/review/server/interval-policy";
import { applyReviewGrade } from "@/features/review/server/service";
import { reviewSchedulerConfig } from "@/features/review/model/scheduler";
import {
  buildReviewLogs,
  buildSingleReviewLogs,
  buildSingleReviewSubjectStates,
  installConceptWriteAbortTrigger,
  installOptimizerStateWriteAbortTrigger,
  optimizerMemoryKey,
  seedFsrsFixture
} from "./helpers/fsrs-optimizer-fixture";

const execFileAsync = promisify(execFile);
const TEST_FSRS_TRAINING_TIMEOUT_MS = 4_000;
const TEST_FSRS_SCRIPT_TRAINING_TIMEOUT_MS = 4_000;

function runTestFsrsOptimizer(
  input: Parameters<typeof runFsrsOptimizer>[0] = {}
) {
  return runFsrsOptimizer({
    ...input,
    trainingAdapter: input.trainingAdapter ?? buildTestTrainingAdapter(),
    trainingTimeoutMs: input.trainingTimeoutMs ?? TEST_FSRS_TRAINING_TIMEOUT_MS
  });
}

function buildTestTrainingAdapter(): FsrsTrainingAdapter {
  let evaluationIndex = 0;

  return {
    compute: async () =>
      reviewSchedulerConfig.fsrs.w.map((weight, index) =>
        index === 0 ? weight + 0.001 : weight
      ),
    evaluate: () => {
      const isCandidate = evaluationIndex % 2 === 0;

      evaluationIndex += 1;
      return isCandidate
        ? { logLoss: 0.4, rmseBins: 0.08 }
        : { logLoss: 0.5, rmseBins: 0.1 };
    },
    minimumHoldoutItemCount: 1,
    minimumReviewCount: 10,
    minimumTrainingItemCount: 1
  };
}

describe("fsrs optimizer", () => {
  let database: DatabaseClient;
  let databasePath = "";
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-fsrs-optimizer-"));
    databasePath = path.join(tempDir, "test.sqlite");
    database = createDatabaseClient({
      databaseUrl: databasePath
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("skips automatic training when the last successful run is still too recent", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-03-15T10:00:00.000Z",
        lastCheckAt: "2026-03-15T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-03-15T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 0
      },
      database
    );
    const originalExecute = database.$client.execute.bind(database.$client);
    const executeSpy = vi
      .spyOn(database.$client, "execute")
      .mockImplementation(async (...args) => {
        const statement = args[0] as unknown;
        const sql =
          typeof statement === "string"
            ? statement
            : typeof statement === "object" &&
                statement !== null &&
                "sql" in statement
              ? String((statement as { sql: string }).sql)
              : "";

        if (sql.includes("rsl.id as id")) {
          throw new Error(
            "too-soon path should not load the full FSRS log history"
          );
        }

        return originalExecute(args[0]!);
      });

    try {
      const result = await runTestFsrsOptimizer({
        database,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(result).toMatchObject({
        newEligibleReviews: 600,
        reason: "too-soon",
        status: "skipped",
        totalEligibleReviews: 600
      });
      expect(snapshot.state.lastCheckAt).toBe("2026-04-01T09:00:00.000Z");
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("skips automatic training until enough new eligible reviews accumulate", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-02-01T10:00:00.000Z",
        lastCheckAt: "2026-02-01T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-02-01T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 200
      },
      database
    );

    const result = await runTestFsrsOptimizer({
      database,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result).toMatchObject({
      newEligibleReviews: 400,
      reason: "insufficient-new-reviews",
      status: "skipped",
      totalEligibleReviews: 600
    });
    expect(snapshot.state.newEligibleReviewsSinceLastTraining).toBe(400);
  });

  it("uses the configured minimum as the dynamic review gate floor", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-02-01T10:00:00.000Z",
        lastCheckAt: "2026-02-01T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-02-01T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 200
      },
      database
    );

    const status = await getFsrsOptimizerStatus(database);

    expect(status.newEligibleReviews).toBe(400);
    expect(status.nextTrainingNewReviewThreshold).toBe(500);
  });

  it("calculates the dynamic review gate independently for each preset", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 450,
      recognitionLogCount: 450
    });
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-02-01T10:00:00.000Z",
        lastCheckAt: "2026-02-01T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-02-01T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 2400
      },
      database
    );

    const result = await runTestFsrsOptimizer({
      database,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const status = await getFsrsOptimizerStatus(database);

    expect(result).toMatchObject({
      newEligibleReviews: 0,
      reason: "insufficient-new-reviews",
      status: "skipped",
      totalEligibleReviews: 900
    });
    expect(status.nextTrainingNewReviewThreshold).toBe(500);
  });

  it("does not carry an impossible legacy baseline into empty presets", async () => {
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-02-01T10:00:00.000Z",
        lastCheckAt: "2026-02-01T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-02-01T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 40_000
      },
      database
    );

    const status = await getFsrsOptimizerStatus(database);

    expect(status.newEligibleReviews).toBe(0);
    expect(status.nextTrainingNewReviewThreshold).toBe(500);
  });

  it("preserves the training baseline after a no-trainable-data run", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 1,
      recognitionLogCount: 1
    });
    await database.insert(reviewSubjectState).values([
      ...buildSingleReviewSubjectStates({
        cardId: "recognition-card",
        count: 250,
        subjectKeyPrefix: "single:recognition"
      }),
      ...buildSingleReviewSubjectStates({
        cardId: "concept-card",
        count: 250,
        subjectKeyPrefix: "single:concept"
      })
    ]);
    await database.insert(reviewSubjectLog).values([
      ...buildSingleReviewLogs({
        cardId: "recognition-card",
        count: 250,
        idPrefix: "recognition-single",
        subjectKeyPrefix: "single:recognition"
      }),
      ...buildSingleReviewLogs({
        cardId: "concept-card",
        count: 250,
        idPrefix: "concept-single",
        subjectKeyPrefix: "single:concept"
      })
    ]);

    const firstResult = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshotAfterFirstRun = await getFsrsOptimizerSnapshot(database);

    expect(firstResult).toMatchObject({
      newEligibleReviews: 502,
      reason: "no-trainable-data",
      status: "skipped",
      totalEligibleReviews: 502
    });
    expect(snapshotAfterFirstRun.state.totalEligibleReviewsAtLastTraining).toBe(
      0
    );
    expect(
      snapshotAfterFirstRun.state.newEligibleReviewsSinceLastTraining
    ).toBe(502);

    await database.insert(reviewSubjectLog).values(
      buildReviewLogs({
        cardId: "recognition-card",
        count: 9,
        startIndex: 1,
        subjectKey: "card:recognition-card"
      })
    );

    const secondResult = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-02T09:00:00.000Z")
    });
    const snapshotAfterSecondRun = await getFsrsOptimizerSnapshot(database);

    expect(secondResult.status).toBe("trained");
    expect(snapshotAfterSecondRun.state.lastSuccessfulTrainingAt).toBe(
      "2026-04-02T09:00:00.000Z"
    );
    expect(
      snapshotAfterSecondRun.state.totalEligibleReviewsAtLastTraining
    ).toBe(260);
    expect(
      snapshotAfterSecondRun.state.newEligibleReviewsSinceLastTraining
    ).toBe(251);
  }, 20_000);

  it("uses the legacy last-attempt cooldown without rebuilding an insufficient dataset", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 1,
      recognitionLogCount: 1
    });
    await database.insert(reviewSubjectState).values(
      buildSingleReviewSubjectStates({
        cardId: "recognition-card",
        count: 500,
        subjectKeyPrefix: "cooldown:recognition"
      })
    );
    await database.insert(reviewSubjectLog).values(
      buildSingleReviewLogs({
        cardId: "recognition-card",
        count: 500,
        idPrefix: "cooldown-recognition",
        subjectKeyPrefix: "cooldown:recognition"
      })
    );
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.5.0",
        lastAttemptAt: "2026-03-31T09:00:00.000Z",
        lastCheckAt: "2026-03-31T09:00:00.000Z",
        lastSuccessfulTrainingAt: null,
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 501,
        totalEligibleReviewsAtLastTraining: 0
      },
      database,
      "2026-03-31T09:00:00.000Z"
    );
    const originalExecute = database.$client.execute.bind(database.$client);
    const executeSpy = vi
      .spyOn(database.$client, "execute")
      .mockImplementation(async (...args) => {
        const statement = args[0] as unknown;
        const query =
          typeof statement === "object" &&
          statement !== null &&
          "sql" in statement
            ? String((statement as { sql: string }).sql)
            : String(statement);

        if (query.includes("rsl.id as id")) {
          throw new Error("cooldown path must not load FSRS history");
        }

        return originalExecute(args[0]!);
      });

    try {
      const result = await runTestFsrsOptimizer({
        database,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(result).toMatchObject({
        reason: "retry-cooldown",
        status: "skipped"
      });
      expect(snapshot.state.presetProgress?.recognition?.lastAttemptAt).toBe(
        "2026-03-31T09:00:00.000Z"
      );
      expect(
        snapshot.state.presetProgress?.recognition
          ?.eligibleReviewCountAtLastEvaluation
      ).toBe(0);
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("does not rewrite the optimizer config on skipped runs when it is unchanged", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });
    await writeFsrsOptimizerConfig(
      getFsrsOptimizerConfigDefaults(),
      database,
      "2026-03-01T10:00:00.000Z"
    );
    await writeFsrsOptimizerState(
      {
        bindingVersion: "0.3.0",
        lastAttemptAt: "2026-03-15T10:00:00.000Z",
        lastCheckAt: "2026-03-15T10:00:00.000Z",
        lastSuccessfulTrainingAt: "2026-03-15T10:00:00.000Z",
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: 0,
        totalEligibleReviewsAtLastTraining: 0
      },
      database
    );

    const initialConfigUpdatedAt = (
      await database.query.userSetting.findFirst({
        where: eq(userSetting.key, "fsrs_optimizer_config")
      })
    )?.updatedAt;
    const initialCacheKey = await getFsrsOptimizerCacheKeyPart(database);

    const result = await runTestFsrsOptimizer({
      database,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);
    const finalConfigUpdatedAt = (
      await database.query.userSetting.findFirst({
        where: eq(userSetting.key, "fsrs_optimizer_config")
      })
    )?.updatedAt;
    const finalCacheKey = await getFsrsOptimizerCacheKeyPart(database);

    expect(result).toMatchObject({
      reason: "too-soon",
      status: "skipped"
    });
    expect(initialConfigUpdatedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(finalConfigUpdatedAt).toBe(initialConfigUpdatedAt);
    expect(finalCacheKey).toBe(initialCacheKey);
    expect(snapshot.config).toEqual(getFsrsOptimizerConfigDefaults());
  });

  it("repairs a missing parameter registry even when the optimizer config is unchanged", async () => {
    const config = getFsrsOptimizerConfigDefaults();

    await writeFsrsOptimizerConfig(
      config,
      database,
      "2026-03-01T10:00:00.000Z"
    );
    await database.delete(reviewFsrsParameterSet);

    await writeFsrsOptimizerConfig(
      config,
      database,
      "2026-03-02T10:00:00.000Z"
    );

    const parameterSets =
      await database.query.reviewFsrsParameterSet.findMany();
    const configRow = await database.query.userSetting.findFirst({
      where: eq(userSetting.key, "fsrs_optimizer_config")
    });

    expect(parameterSets.map((row) => row.recallTask).sort()).toEqual([
      "concept",
      "other",
      "recognition"
    ]);
    expect(configRow?.updatedAt).toBe("2026-03-01T10:00:00.000Z");
  });

  it("reports the full eligible review count before the first successful training", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 300,
      recognitionLogCount: 300
    });

    const status = await getFsrsOptimizerStatus(database);

    expect(status.newEligibleReviews).toBe(600);
    expect(status.state.newEligibleReviewsSinceLastTraining).toBe(600);
    expect(status.totalEligibleReviews).toBe(600);
  });

  it("persists optimized parameters for both card-type presets on a forced run", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });

    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result.status).toBe("trained");
    expect(snapshot.config).toMatchObject({
      desiredRetention: 0.9,
      enabled: true,
      minDaysBetweenRuns: 30,
      minNewReviews: 500,
      presetStrategy: "card_type_v1"
    });
    expect(snapshot.presets.recognition?.weights).toHaveLength(
      reviewSchedulerConfig.fsrs.w.length
    );
    expect(snapshot.presets.concept?.weights).toHaveLength(
      reviewSchedulerConfig.fsrs.w.length
    );
    expect(snapshot.presets.recognition).toMatchObject({
      algorithmVersion: "fsrs6",
      bindingVersion: "0.5.0",
      datasetVersion: "fsrs6-prefix-target-v2",
      holdoutItemCount: 3,
      metric: "log_loss",
      studyDayPolicy: "study-day:v1:Europe/Rome:rollover-240",
      trainingItemCount: 8
    });
    expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
      "2026-04-01T09:00:00.000Z"
    );
    expect(snapshot.state.totalEligibleReviewsAtLastTraining).toBe(24);
    expect(snapshot.state.presetProgress?.recognition).toMatchObject({
      eligibleReviewCountAtLastEvaluation: 12,
      lastEvaluationAt: "2026-04-01T09:00:00.000Z",
      newEligibleReviewsSinceLastEvaluation: 0
    });
  }, 20_000);

  it("keeps the incumbent parameters when the holdout candidate regresses", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const incumbent = await getFsrsOptimizerSnapshot(database);
    let evaluationIndex = 0;
    const rejectingAdapter: FsrsTrainingAdapter = {
      ...buildTestTrainingAdapter(),
      evaluate: () => {
        const isCandidate = evaluationIndex % 2 === 0;

        evaluationIndex += 1;
        return isCandidate
          ? { logLoss: 0.6, rmseBins: 0.12 }
          : { logLoss: 0.5, rmseBins: 0.1 };
      }
    };
    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-10T09:00:00.000Z"),
      trainingAdapter: rejectingAdapter
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result.status).toBe("trained");
    if (result.status !== "trained") {
      throw new Error("Expected completed optimizer evaluation.");
    }
    expect(result.presetResults.recognition).toMatchObject({
      reason: "candidate-not-better",
      status: "unchanged"
    });
    expect(result.presetResults.concept).toMatchObject({
      reason: "candidate-not-better",
      status: "unchanged"
    });
    expect(snapshot.presets.recognition).toEqual(incumbent.presets.recognition);
    expect(snapshot.presets.concept).toEqual(incumbent.presets.concept);
  });

  it("promotes recognition when concept training fails", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    const baseAdapter = buildTestTrainingAdapter();
    let computeIndex = 0;
    const partialFailureAdapter: FsrsTrainingAdapter = {
      ...baseAdapter,
      compute: async (...args) => {
        computeIndex += 1;

        if (computeIndex === 2) {
          throw new Error("concept optimizer failed");
        }

        return baseAdapter.compute(...args);
      }
    };
    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z"),
      trainingAdapter: partialFailureAdapter
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result.status).toBe("trained");
    if (result.status !== "trained") {
      throw new Error("Expected an isolated preset result.");
    }
    expect(result.presetResults.recognition.status).toBe("trained");
    expect(result.presetResults.concept).toMatchObject({
      error: "concept optimizer failed",
      reason: "training-error",
      status: "failed"
    });
    expect(snapshot.presets.recognition).not.toBeNull();
    expect(snapshot.presets.concept).toBeNull();
    expect(snapshot.state.lastTrainingError).toBeNull();
    expect(snapshot.state.presetProgress?.recognition).toMatchObject({
      eligibleReviewCountAtLastEvaluation: 12,
      lastError: null,
      lastEvaluationAt: "2026-04-01T09:00:00.000Z"
    });
    expect(snapshot.state.presetProgress?.concept).toMatchObject({
      eligibleReviewCountAtLastEvaluation: 0,
      lastError: "concept optimizer failed",
      lastEvaluationAt: null
    });
  });

  it("promotes concept when recognition exceeds its end-to-end deadline", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    const baseAdapter = buildTestTrainingAdapter();
    let computeIndex = 0;
    const partialTimeoutAdapter: FsrsTrainingAdapter = {
      ...baseAdapter,
      compute: async (...args) => {
        computeIndex += 1;

        if (computeIndex === 1) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        return baseAdapter.compute(...args);
      }
    };
    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z"),
      trainingAdapter: partialTimeoutAdapter,
      trainingTimeoutMs: 5
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result.status).toBe("trained");
    if (result.status !== "trained") {
      throw new Error("Expected an isolated preset result.");
    }
    expect(result.presetResults.recognition).toMatchObject({
      reason: "training-error",
      status: "failed"
    });
    expect(result.presetResults.recognition.error).toContain(
      "deadline exceeded"
    );
    expect(result.presetResults.concept.status).toBe("trained");
    expect(snapshot.presets.recognition).toBeNull();
    expect(snapshot.presets.concept).not.toBeNull();
    expect(snapshot.state.lastTrainingError).toBeNull();
    expect(snapshot.state.presetProgress?.recognition?.lastError).toContain(
      "deadline exceeded"
    );
    expect(snapshot.state.presetProgress?.concept).toMatchObject({
      eligibleReviewCountAtLastEvaluation: 12,
      lastError: null,
      lastEvaluationAt: "2026-04-01T09:00:00.000Z"
    });
  });

  it("reserves part of the end-to-end deadline for evaluation after native training", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    const baseAdapter = buildTestTrainingAdapter();
    const computeTimeouts: number[] = [];
    const budgetCapturingAdapter: FsrsTrainingAdapter = {
      ...baseAdapter,
      compute: async (items, timeoutMs) => {
        computeTimeouts.push(timeoutMs);

        return baseAdapter.compute(items, timeoutMs);
      }
    };
    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z"),
      trainingAdapter: budgetCapturingAdapter,
      trainingTimeoutMs: 1_000
    });

    expect(result.status).toBe("trained");
    expect(computeTimeouts).toHaveLength(2);
    expect(computeTimeouts.every((timeoutMs) => timeoutMs > 0)).toBe(true);
    expect(computeTimeouts.every((timeoutMs) => timeoutMs <= 900)).toBe(true);
  });

  it("reports a global failure when every evaluated preset fails", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    let computeIndex = 0;
    const baseAdapter = buildTestTrainingAdapter();
    const failingAdapter: FsrsTrainingAdapter = {
      ...baseAdapter,
      compute: async () => {
        computeIndex += 1;
        throw new Error(
          computeIndex === 1
            ? "recognition optimizer failed"
            : "concept optimizer failed"
        );
      }
    };
    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z"),
      trainingAdapter: failingAdapter
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);
    const status = await getFsrsOptimizerStatus(database);

    expect(result).toMatchObject({
      reason: "all-presets-failed",
      status: "failed"
    });
    if (result.status !== "failed") {
      throw new Error("Expected a visible optimizer run failure.");
    }
    expect(result.error).toContain("recognition optimizer failed");
    expect(result.error).toContain("concept optimizer failed");
    expect(snapshot.state.lastSuccessfulTrainingAt).toBeNull();
    expect(snapshot.state.lastTrainingError).toBe(result.error);
    expect(status.presets.recognition.lastError).toBe(
      "recognition optimizer failed"
    );
    expect(status.presets.concept.lastError).toBe("concept optimizer failed");
  });

  it("includes the shared review ledger in the optimizer deadline", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    const originalExecute = database.$client.execute.bind(database.$client);
    const executeSpy = vi
      .spyOn(database.$client, "execute")
      .mockImplementation(async (...args) => {
        const statement = args[0] as unknown;
        const query =
          typeof statement === "object" &&
          statement !== null &&
          "sql" in statement
            ? String((statement as { sql: string }).sql)
            : String(statement);

        if (query.includes("rsl.id as id")) {
          return new Promise<never>(() => {});
        }

        return originalExecute(args[0]!);
      });
    const invalidateSpy = vi.spyOn(
      settingsStore,
      "invalidateFsrsOptimizerCaches"
    );

    try {
      await expect(
        runTestFsrsOptimizer({
          database,
          force: true,
          now: new Date("2026-04-01T09:00:00.000Z"),
          trainingTimeoutMs: 10
        })
      ).rejects.toThrow("shared ledger deadline exceeded");

      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(snapshot.state.lastTrainingError).toContain(
        "shared ledger deadline exceeded"
      );
      expect(invalidateSpy).not.toHaveBeenCalled();
    } finally {
      invalidateSpy.mockRestore();
      executeSpy.mockRestore();
    }
  });

  it("does not let a stale optimizer run overwrite a newer run token", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    const baseAdapter = buildTestTrainingAdapter();
    let superseded = false;
    const supersedingAdapter: FsrsTrainingAdapter = {
      ...baseAdapter,
      compute: async (...args) => {
        if (!superseded) {
          superseded = true;
          const liveSnapshot = await getFsrsOptimizerSnapshot(database);

          await writeFsrsOptimizerState(
            {
              ...liveSnapshot.state,
              activeRunId: "newer-run-token",
              lastAttemptAt: "2026-04-01T09:00:01.000Z"
            },
            database,
            "2026-04-01T09:00:01.000Z"
          );
        }

        return baseAdapter.compute(...args);
      }
    };
    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z"),
      trainingAdapter: supersedingAdapter
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result).toMatchObject({
      reason: "stale-run",
      status: "skipped"
    });
    expect(snapshot.state.activeRunId).toBe("newer-run-token");
    expect(snapshot.presets.recognition).toBeNull();
    expect(snapshot.presets.concept).toBeNull();
  });

  it("keeps reviews that arrive during training in the post-training baseline", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });

    const concurrentDatabase = createDatabaseClient({
      databaseUrl: databasePath
    });
    let injected = false;
    const originalExecute = database.$client.execute.bind(database.$client);
    const executeSpy = vi
      .spyOn(database.$client, "execute")
      .mockImplementation(async (...args) => {
        const statement = args[0] as unknown;
        const sql =
          typeof statement === "string"
            ? statement
            : typeof statement === "object" &&
                statement !== null &&
                "sql" in statement
              ? String((statement as { sql: string }).sql)
              : "";

        const result = await originalExecute(args[0]!);

        if (!injected && sql.includes("from review_subject_log rsl")) {
          injected = true;
          await concurrentDatabase.insert(reviewSubjectLog).values({
            answeredAt: "2026-04-01T09:05:00.000Z",
            cardId: "recognition-card",
            elapsedDays: 4,
            id: "review_subject_log_recognition_during_training",
            newState: "review",
            previousState: "review",
            rating: "good",
            responseMs: 940,
            scheduledDueAt: "2026-04-08T09:05:00.000Z",
            schedulerVersion: "fsrs_v1",
            subjectKey: "card:recognition-card"
          });
        }

        return result;
      });

    try {
      const result = await runTestFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });

      expect(result.status).toBe("trained");

      const snapshot = await getFsrsOptimizerSnapshot(database);
      const status = await getFsrsOptimizerStatus(database);

      expect(snapshot.state.totalEligibleReviewsAtLastTraining).toBe(24);
      expect(snapshot.state.newEligibleReviewsSinceLastTraining).toBe(1);
      expect(status.newEligibleReviews).toBe(1);
      expect(status.totalEligibleReviews).toBe(25);
    } finally {
      executeSpy.mockRestore();
      closeDatabaseClient(concurrentDatabase);
    }
  }, 20_000);

  it("invalidates the fsrs runtime cache only after the training transaction commits", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 4,
      recognitionLogCount: 12
    });

    const observer = createDatabaseClient({ databaseUrl: databasePath });
    const originalInvalidate = settingsStore.invalidateFsrsOptimizerCaches;
    let sawCommittedParameters = false;
    const invalidateSpy = vi
      .spyOn(settingsStore, "invalidateFsrsOptimizerCaches")
      .mockImplementation(async () => {
        const committedSnapshot = await getFsrsOptimizerSnapshot(observer);

        sawCommittedParameters =
          committedSnapshot.presets.recognition !== null &&
          committedSnapshot.state.lastSuccessfulTrainingAt ===
            "2026-04-01T09:00:00.000Z";

        return originalInvalidate();
      });

    try {
      const result = await runTestFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(result.status).toBe("trained");
      expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
        "2026-04-01T09:00:00.000Z"
      );
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(sawCommittedParameters).toBe(true);
    } finally {
      invalidateSpy.mockRestore();
      closeDatabaseClient(observer);
    }
  }, 20_000);

  it("rolls back partial preset writes if the training transaction fails", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });

    const baseline = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    expect(baseline.status).toBe("trained");

    const baselineSnapshot = await getFsrsOptimizerSnapshot(database);
    const baselineRecognition = baselineSnapshot.presets.recognition;
    const baselineConcept = baselineSnapshot.presets.concept;
    const baselineSuccessfulTrainingAt =
      baselineSnapshot.state.lastSuccessfulTrainingAt;

    await database.insert(reviewSubjectLog).values(
      buildReviewLogs({
        cardId: "recognition-card",
        count: 1,
        subjectKey: "card:recognition-card",
        startIndex: 12
      })[0]!
    );

    await installConceptWriteAbortTrigger(database);

    await expect(
      runTestFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-10T09:00:00.000Z")
      })
    ).rejects.toThrow(/fsrs_params_concept/i);

    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(snapshot.presets.recognition).toEqual(baselineRecognition);
    expect(snapshot.presets.concept).toEqual(baselineConcept);
    expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
      baselineSuccessfulTrainingAt
    );
  }, 40_000);

  it("rolls back preset writes when the optimizer state write fails", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });

    const baseline = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    expect(baseline.status).toBe("trained");

    const baselineSnapshot = await getFsrsOptimizerSnapshot(database);
    const baselineRecognition = baselineSnapshot.presets.recognition;
    const baselineConcept = baselineSnapshot.presets.concept;
    const baselineSuccessfulTrainingAt =
      baselineSnapshot.state.lastSuccessfulTrainingAt;

    await database.insert(reviewSubjectLog).values(
      buildReviewLogs({
        cardId: "recognition-card",
        count: 1,
        subjectKey: "card:recognition-card",
        startIndex: 12
      })[0]!
    );

    await installOptimizerStateWriteAbortTrigger(database);
    const invalidateSpy = vi.spyOn(
      settingsStore,
      "invalidateFsrsOptimizerCaches"
    );

    try {
      await expect(
        runTestFsrsOptimizer({
          database,
          force: true,
          now: new Date("2026-04-10T09:00:00.000Z")
        })
      ).rejects.toThrow(/fsrs_optimizer_state|optimizer state write blocked/i);

      const snapshot = await getFsrsOptimizerSnapshot(database);

      expect(snapshot.presets.recognition).toEqual(baselineRecognition);
      expect(snapshot.presets.concept).toEqual(baselineConcept);
      expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
        baselineSuccessfulTrainingAt
      );
      expect(invalidateSpy).not.toHaveBeenCalled();
    } finally {
      invalidateSpy.mockRestore();
    }
  }, 40_000);

  it("skips training for presets below the minimum size while still training the larger one", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 4,
      recognitionLogCount: 12
    });

    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result.status).toBe("trained");
    if (result.status !== "trained") {
      throw new Error("Expected trained result.");
    }
    expect(result.presetResults.recognition.status).toBe("trained");
    expect(result.presetResults.concept.status).toBe("unchanged");
    expect(snapshot.presets.recognition).not.toBeNull();
    expect(snapshot.presets.concept).toBeNull();
  }, 20_000);

  it("allows a forced run even when the automatic optimizer is disabled", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    await writeFsrsOptimizerConfig(
      {
        ...getFsrsOptimizerConfigDefaults(),
        enabled: false
      },
      database,
      "2026-03-01T10:00:00.000Z"
    );

    const result = await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(result.status).toBe("trained");
    expect(snapshot.state.lastSuccessfulTrainingAt).toBe(
      "2026-04-01T09:00:00.000Z"
    );
    expect(snapshot.presets.recognition).not.toBeNull();
    expect(snapshot.presets.concept).not.toBeNull();
  }, 20_000);

  it("does not attach optimized weights to unsupported card types", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });

    const snapshot = await getFsrsOptimizerSnapshot(database);
    const productionSeedState = buildReviewSeedStateWithFsrsPreset(
      {
        difficulty: 3.1,
        dueAt: "2026-04-20T09:00:00.000Z",
        lapses: 1,
        lastReviewedAt: "2026-04-10T09:00:00.000Z",
        learningSteps: 0,
        reps: 4,
        scheduledDays: 10,
        stability: 4.2,
        state: "review"
      },
      "production",
      snapshot
    );

    expect(productionSeedState.fsrsDesiredRetention).toBe(0.9);
    expect(productionSeedState.fsrsWeights).toBeNull();
  }, 20_000);

  it("uses the same optimized preset for preview scheduling and grading", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    await runTestFsrsOptimizer({
      database,
      force: true,
      now: new Date("2026-04-01T09:00:00.000Z")
    });

    const snapshot = await getFsrsOptimizerSnapshot(database);
    const subjectState = await database.query.reviewSubjectState.findFirst({
      where: eq(
        reviewSubjectState.subjectKey,
        optimizerMemoryKey("recognition-card")
      )
    });

    expect(subjectState).not.toBeNull();

    const baseSeedState = {
      difficulty: subjectState!.difficulty,
      dueAt: subjectState!.dueAt,
      lapses: subjectState!.lapses,
      lastReviewedAt: subjectState!.lastReviewedAt,
      learningSteps: subjectState!.learningSteps,
      reps: subjectState!.reps,
      scheduledDays: subjectState!.scheduledDays,
      schedulingKey: optimizerMemoryKey("recognition-card"),
      stability: subjectState!.stability,
      state: subjectState!.state
    };
    const optimizedSeedState = buildReviewSeedStateWithFsrsPreset(
      baseSeedState,
      "recognition",
      snapshot
    );
    const now = new Date("2026-04-20T09:00:00.000Z");
    const expected = await scheduleReviewWithDailyIntervalPolicy({
      current: {
        difficulty: optimizedSeedState.difficulty,
        dueAt: optimizedSeedState.dueAt,
        lapses: optimizedSeedState.lapses,
        lastReviewedAt: optimizedSeedState.lastReviewedAt,
        learningSteps: optimizedSeedState.learningSteps,
        reps: optimizedSeedState.reps,
        scheduledDays: optimizedSeedState.scheduledDays,
        stability: optimizedSeedState.stability,
        state: optimizedSeedState.state
      },
      database,
      excludeSubjectKey: optimizerMemoryKey("recognition-card"),
      intervalPolicy: {
        schedulingKey: optimizedSeedState.schedulingKey
      },
      now,
      rating: "good",
      recallTask: "recognition",
      scheduler: {
        desiredRetention: optimizedSeedState.fsrsDesiredRetention,
        weights: optimizedSeedState.fsrsWeights
      }
    });
    const previews = await buildServerReviewGradePreviews({
      database,
      excludeSubjectKey: optimizerMemoryKey("recognition-card"),
      now,
      recallTask: "recognition",
      reviewSeedState: optimizedSeedState
    });

    expect(optimizedSeedState.fsrsWeights).toEqual(
      snapshot.presets.recognition?.weights ?? null
    );
    expect(previews).toHaveLength(4);
    expect(previews.find((preview) => preview.rating === "good")).toBeDefined();

    const result = await applyReviewGrade({
      cardId: "recognition-card",
      database,
      expectedUpdatedAt: subjectState!.updatedAt,
      now,
      rating: "good"
    });
    const latestLog = await database.query.reviewSubjectLog.findFirst({
      orderBy: desc(reviewSubjectLog.answeredAt),
      where: eq(
        reviewSubjectLog.subjectKey,
        optimizerMemoryKey("recognition-card")
      )
    });

    expect(result.dueAt).toBe(expected.dueAt);
    expect(latestLog?.scheduledDueAt).toBe(expected.dueAt);
  }, 40_000);

  it("stores the training baseline from the same log snapshot used to fit the presets", async () => {
    await seedFsrsFixture(database, {
      conceptLogCount: 12,
      recognitionLogCount: 12
    });

    const originalExecute = database.$client.execute.bind(database.$client);
    let injectedLog = false;
    const executeSpy = vi
      .spyOn(database.$client, "execute")
      .mockImplementation(async (...args) => {
        const statement = args[0] as unknown;
        const sql =
          typeof statement === "string"
            ? statement
            : typeof statement === "object" &&
                statement !== null &&
                "sql" in statement
              ? String((statement as { sql: string }).sql)
              : "";

        if (!injectedLog && sql.includes("rsl.id as id")) {
          injectedLog = true;
          await database.insert(reviewSubjectLog).values({
            answeredAt: "2026-04-01T08:59:59.000Z",
            cardId: "recognition-card",
            elapsedDays: 4,
            id: "review_subject_log_recognition_snapshot_race",
            newState: "review",
            previousState: "review",
            rating: "good",
            responseMs: 900,
            scheduledDueAt: "2026-04-08T00:00:00.000Z",
            schedulerVersion: "fsrs_v1",
            subjectKey: "card:recognition-card"
          });
        }

        return originalExecute(args[0]!);
      });

    try {
      await runTestFsrsOptimizer({
        database,
        force: true,
        now: new Date("2026-04-01T09:00:00.000Z")
      });
    } finally {
      executeSpy.mockRestore();
    }

    const status = await getFsrsOptimizerStatus(database);
    const snapshot = await getFsrsOptimizerSnapshot(database);

    expect(snapshot.state.totalEligibleReviewsAtLastTraining).toBe(25);
    expect(snapshot.state.newEligibleReviewsSinceLastTraining).toBe(0);
    expect(status.newEligibleReviews).toBe(0);
    expect(status.totalEligibleReviews).toBe(25);
  }, 20_000);

  it("skips the scheduled script when the monthly gate is not yet satisfied", async () => {
    await recreateDatabaseWithFixture({
      conceptLogCount: 4,
      recognitionLogCount: 4
    });

    const { stdout } = await execNodeScript(
      "scripts/fsrs-optimize-if-needed.ts"
    );
    const reopened = createDatabaseClient({
      databaseUrl: databasePath
    });

    try {
      const snapshot = await getFsrsOptimizerSnapshot(reopened);

      expect(stdout).toContain("insufficient-new-reviews");
      expect(snapshot.presets.recognition).toBeNull();
      expect(snapshot.presets.concept).toBeNull();
    } finally {
      closeDatabaseClient(reopened);
    }
  }, 20_000);

  it("runs the forced optimizer script without activating unevaluated presets", async () => {
    await recreateDatabaseWithFixture({
      conceptLogCount: 12,
      recognitionLogCount: 12
    });

    const { stdout } = await execNodeScript("scripts/fsrs-optimize.ts");
    const reopened = createDatabaseClient({
      databaseUrl: databasePath
    });

    try {
      const snapshot = await getFsrsOptimizerSnapshot(reopened);

      expect(stdout).toContain("FSRS optimizer saltato: no-trainable-data");
      expect(snapshot.presets.recognition).toBeNull();
      expect(snapshot.presets.concept).toBeNull();
      expect(snapshot.state.lastAttemptAt).not.toBeNull();
    } finally {
      closeDatabaseClient(reopened);
    }
  }, 20_000);

  it("runs the forced optimizer script even when the automatic optimizer is disabled", async () => {
    await recreateDatabaseWithFixture({
      conceptLogCount: 12,
      recognitionLogCount: 12
    });
    await writeFsrsOptimizerConfig(
      {
        ...getFsrsOptimizerConfigDefaults(),
        enabled: false
      },
      database,
      "2026-03-01T10:00:00.000Z"
    );

    const { stdout } = await execNodeScript("scripts/fsrs-optimize.ts");
    const reopened = createDatabaseClient({
      databaseUrl: databasePath
    });

    try {
      const snapshot = await getFsrsOptimizerSnapshot(reopened);

      expect(stdout).toContain("FSRS optimizer saltato: no-trainable-data");
      expect(snapshot.state.lastAttemptAt).not.toBeNull();
      expect(snapshot.state.lastTrainingError).toBeNull();
      expect(snapshot.presets.recognition).toBeNull();
      expect(snapshot.presets.concept).toBeNull();
    } finally {
      closeDatabaseClient(reopened);
    }
  }, 20_000);

  async function recreateDatabaseWithFixture(input: {
    conceptLogCount: number;
    recognitionLogCount: number;
  }) {
    closeDatabaseClient(database);
    database = createDatabaseClient({
      databaseUrl: databasePath
    });
    await runMigrations(database);
    await seedFsrsFixture(database, input);
    closeDatabaseClient(database);
    database = createDatabaseClient({
      databaseUrl: databasePath
    });
  }

  async function execNodeScript(scriptRelativePath: string) {
    return execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        path.join(process.cwd(), scriptRelativePath)
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: databasePath,
          FSRS_OPTIMIZER_TRAINING_TIMEOUT_MS: String(
            TEST_FSRS_SCRIPT_TRAINING_TIMEOUT_MS
          )
        }
      }
    );
  }
});
