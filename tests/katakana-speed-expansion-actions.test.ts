import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  aggregateKatakanaSpeedExerciseResultAction,
  startKatakanaSpeedSessionAction,
  submitKatakanaSpeedSelfCheckAction
} from "@/actions/katakana-speed";
import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  katakanaAttemptLog,
  katakanaConfusionEdge,
  katakanaExerciseBlock,
  katakanaExerciseResult,
  katakanaSession,
  katakanaTrial
} from "@/db/schema";
import { getKatakanaSpeedItemById } from "@/features/katakana-speed/model/catalog";
import {
  getKatakanaSpeedSessionPageData,
  startKatakanaSpeedSession,
  submitKatakanaSpeedAnswer
} from "@/features/katakana-speed/server";

describe("katakana speed expansion actions", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-katakana-actions-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("starts daily with only the three training-loop blocks", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 32,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "daily-action"
    });

    const persistedSession = await database.query.katakanaSession.findFirst({
      where: eq(katakanaSession.id, session.sessionId)
    });
    const blocks = await database.query.katakanaExerciseBlock.findMany({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.sessionId, session.sessionId)
    });

    expect(persistedSession?.status).toBe("active");
    expect(blocks.map((block) => block.blockId)).toEqual([
      `${session.sessionId}:daily-b1-contrast`,
      `${session.sessionId}:daily-b2-reading`,
      `${session.sessionId}:daily-b3-transfer`
    ]);
    expect(blocks.map((block) => block.sortOrder)).toEqual([0, 1, 2]);
    expect(
      blocks.every(
        (block) => JSON.parse(block.metricsJson).sessionMode === "daily"
      )
    ).toBe(true);
    expect(trials).toHaveLength(32);
    expect(trials.map((trial) => trial.sortOrder)).toEqual(
      trials.map((_, index) => index)
    );
    expect(
      trials.every((trial) => {
        const features = JSON.parse(trial.featuresJson);
        return features.showReadingDuringTrial === false;
      })
    ).toBe(true);
    expect(
      new Set(
        trials.map((trial) => JSON.parse(trial.featuresJson).exerciseFamily)
      )
    ).not.toContain("tile_builder");
    expect(
      new Set(
        trials.map((trial) => JSON.parse(trial.featuresJson).exerciseFamily)
      )
    ).not.toContain("chunk_spotting");
  });

  it("starts repair and diagnostic without legacy standalone modes", async () => {
    const repairSession = await startKatakanaSpeedSessionAction({
      count: 34,
      database,
      mode: "repair",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "repair-action"
    });
    const diagnosticSession = await startKatakanaSpeedSessionAction({
      count: 24,
      database,
      mode: "diagnostic_probe",
      now: new Date("2026-04-26T08:01:00.000Z"),
      seed: "diagnostic-action"
    });
    const repairTrials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.sessionId, repairSession.sessionId)
    });
    const diagnosticBlocks =
      await database.query.katakanaExerciseBlock.findMany({
        where: eq(katakanaExerciseBlock.sessionId, diagnosticSession.sessionId)
      });

    expect(repairTrials).toHaveLength(34);
    expect(repairTrials.every((trial) => trial.wasRepair === 1)).toBe(true);
    expect(diagnosticBlocks.map((block) => block.blockId)).toEqual([
      `${diagnosticSession.sessionId}:diagnostic-b1-contrast`,
      `${diagnosticSession.sessionId}:diagnostic-b2-reading`,
      `${diagnosticSession.sessionId}:diagnostic-b3-transfer`
    ]);
  });

  it("rejects stale legacy session modes at runtime", async () => {
    await expect(
      startKatakanaSpeedSession({
        database,
        mode: "rare_combo" as never,
        now: new Date("2026-04-26T08:00:00.000Z"),
        seed: "legacy-mode-runtime"
      })
    ).rejects.toThrow("Unsupported Katakana Speed session mode");
  });

  it("reloads sessions with block and snapshot metadata", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 6,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "reload-daily"
    });
    const reloaded = await getKatakanaSpeedSessionPageData({
      database,
      sessionId: session.sessionId
    });

    expect(reloaded?.trials[0]).toMatchObject({
      blockId: expect.stringContaining("daily-b1-contrast"),
      exerciseId: `${session.sessionId}:daily`,
      features: expect.objectContaining({
        showReadingDuringTrial: false
      })
    });
    expect(reloaded?.trials[0]?.focusChunks?.length).toBeGreaterThan(0);
    expect(reloaded?.trials[0]?.metrics).toMatchObject({
      focusId: expect.any(String)
    });
  });

  it("records self-check results once and rejects trials from another session", async () => {
    const firstSession = await startKatakanaSpeedSessionAction({
      count: 12,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "self-check-a"
    });
    const secondSession = await startKatakanaSpeedSessionAction({
      count: 12,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:01:00.000Z"),
      seed: "self-check-b"
    });
    const trial = firstSession.trials.find(
      (candidate) =>
        candidate.mode === "word_naming" ||
        candidate.mode === "pseudoword_sprint"
    );
    if (!trial) {
      throw new Error("Expected a self-check trial.");
    }

    const firstResult = await submitKatakanaSpeedSelfCheckAction({
      database,
      metricsJson: { durationMs: 1800, moraPerSecond: 4.2 },
      now: new Date("2026-04-26T08:00:02.000Z"),
      responseMs: 1800,
      selfRating: "hesitated",
      sessionId: firstSession.sessionId,
      trialId: trial.trialId
    });
    const duplicateResult = await submitKatakanaSpeedSelfCheckAction({
      database,
      metricsJson: { durationMs: 9999 },
      now: new Date("2026-04-26T08:00:04.000Z"),
      responseMs: 9999,
      selfRating: "wrong",
      sessionId: firstSession.sessionId,
      trialId: trial.trialId
    });

    const attempts = await database.query.katakanaAttemptLog.findMany({
      where: eq(katakanaAttemptLog.trialId, trial.trialId)
    });
    const persistedTrial = await database.query.katakanaTrial.findFirst({
      where: eq(katakanaTrial.trialId, trial.trialId)
    });

    expect(firstResult).toMatchObject({
      idempotent: false,
      isCorrect: true,
      selfRating: "hesitated"
    });
    expect(duplicateResult).toMatchObject({
      idempotent: true,
      isCorrect: true,
      selfRating: "hesitated"
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      isCorrect: 1,
      selfRating: "hesitated"
    });
    expect(JSON.parse(attempts[0]?.metricsJson ?? "{}")).toMatchObject({
      correctnessSource: "self_report",
      durationMs: 1800,
      moraPerSecond: 4.2,
      msPerMora: expect.any(Number),
      slowCorrect: true,
      targetMsPerMora: expect.any(Number)
    });
    expect(persistedTrial).toMatchObject({
      answeredAt: "2026-04-26T08:00:02.000Z",
      selfRating: "hesitated",
      status: "answered"
    });

    await expect(
      submitKatakanaSpeedSelfCheckAction({
        database,
        metricsJson: {},
        responseMs: 1200,
        selfRating: "clean",
        sessionId: secondSession.sessionId,
        trialId: trial.trialId
      })
    ).rejects.toThrow("trial was not found");
  });

  it("canonizes RAN aggregate cell positions idempotently", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 24,
      database,
      mode: "diagnostic_probe",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "ran-result"
    });
    const block = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.mode, "ran_grid")
    });
    if (!block) {
      throw new Error("Expected RAN exercise block.");
    }

    const result = await aggregateKatakanaSpeedExerciseResultAction({
      blockId: block.blockId,
      database,
      exerciseId: block.exerciseId,
      metricsJson: {
        durationMs: 12000,
        wrongCellIndexes: [18, 6, 6]
      },
      now: new Date("2026-04-26T08:00:12.000Z"),
      resultId: "ran-result-1",
      selfRating: "hesitated",
      sessionId: session.sessionId,
      sortOrder: 7
    });
    const duplicate = await aggregateKatakanaSpeedExerciseResultAction({
      blockId: block.blockId,
      database,
      exerciseId: block.exerciseId,
      metricsJson: { durationMs: 1, wrongCellIndexes: [0, 24] },
      now: new Date("2026-04-26T08:01:00.000Z"),
      resultId: "ran-result-1",
      selfRating: "wrong",
      sessionId: session.sessionId,
      sortOrder: 99
    });

    const rows = await database.query.katakanaExerciseResult.findMany({
      where: eq(katakanaExerciseResult.sessionId, session.sessionId)
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.blockId, block.blockId)
    });
    const attempts = await database.query.katakanaAttemptLog.findMany({
      where: eq(katakanaAttemptLog.sessionId, session.sessionId)
    });

    expect(result).toEqual({
      idempotent: false,
      resultId: "ran-result-1"
    });
    expect(duplicate).toEqual({
      idempotent: true,
      resultId: "ran-result-1"
    });
    expect(rows).toHaveLength(1);
    const metrics = JSON.parse(rows[0]?.metricsJson ?? "{}") as {
      adjustedItemsPerSecond?: number;
      correctItems?: number;
      durationMs?: number;
      errorRate?: number;
      errors?: number;
      itemsPerSecond?: number;
      totalItems?: number;
      wrongCellIndexes?: number[];
    };
    expect(rows[0]).toMatchObject({
      blockId: block.blockId,
      exerciseId: block.exerciseId,
      selfRating: "hesitated",
      sortOrder: 7
    });
    expect(metrics).toMatchObject({
      adjustedItemsPerSecond: 1.763,
      correctItems: 23,
      durationMs: 12000,
      errorRate: 0.08,
      errors: 2,
      itemsPerSecond: 2.083,
      totalItems: 25,
      wrongCellIndexes: [6, 18]
    });
    expect(trials.every((trial) => trial.status === "answered")).toBe(true);
    expect(attempts).toHaveLength(0);
  });

  it("rejects RAN aggregate wrong cell indexes outside the grid", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 24,
      database,
      mode: "diagnostic_probe",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "ran-bad-index"
    });
    const block = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.mode, "ran_grid")
    });
    if (!block) {
      throw new Error("Expected RAN exercise block.");
    }

    await expect(
      aggregateKatakanaSpeedExerciseResultAction({
        blockId: block.blockId,
        database,
        exerciseId: block.exerciseId,
        metricsJson: { durationMs: 12000, wrongCellIndexes: [25] },
        resultId: "ran-bad-index-result",
        sessionId: session.sessionId
      })
    ).rejects.toThrow("wrong cell index");
  });

  it("aggregates repeated reading when daily transfer selects it", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 32,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "operational-daily"
    });
    const block = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.mode, "repeated_reading_pass")
    });
    if (!block) {
      throw new Error("Expected repeated reading exercise block.");
    }

    const result = await aggregateKatakanaSpeedExerciseResultAction({
      blockId: block.blockId,
      database,
      exerciseId: block.exerciseId,
      metricsJson: {
        firstPassMs: 4000,
        repeatedPassMs: 3200,
        transferPassMs: 3500
      },
      now: new Date("2026-04-26T08:00:12.000Z"),
      resultId: "repeated-result-1",
      selfRating: "clean",
      sessionId: session.sessionId
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.blockId, block.blockId)
    });

    expect(result).toEqual({
      idempotent: false,
      resultId: "repeated-result-1"
    });
    expect(trials).toHaveLength(3);
    expect(trials.every((trial) => trial.status === "answered")).toBe(true);
  });

  it("rejects aggregate exercise results without an aggregate block", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 12,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "bad-aggregate"
    });
    const block = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
    });
    if (!block) {
      throw new Error("Expected exercise block.");
    }

    await expect(
      aggregateKatakanaSpeedExerciseResultAction({
        database,
        exerciseId: block.exerciseId,
        metricsJson: { durationMs: 1200 },
        resultId: "bad-aggregate-1",
        sessionId: session.sessionId
      })
    ).rejects.toThrow("exercise block is required");
  });

  it("persists confusion edges for wrong choice answers when the response matches an item", async () => {
    const session = await startKatakanaSpeedSession({
      count: 4,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "wrong-choice-edge"
    });
    const trial = session.trials[0];
    expect(trial).toBeDefined();
    const wrongItemId = trial.optionItemIds.find(
      (itemId) =>
        itemId !== trial.correctItemId &&
        getKatakanaSpeedItemById(itemId) !== undefined
    );
    expect(wrongItemId).toBeDefined();
    const wrongItem = getKatakanaSpeedItemById(wrongItemId ?? "");
    expect(wrongItem).toBeDefined();

    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-26T08:00:01.000Z"),
      responseMs: 1000,
      sessionId: session.sessionId,
      trialId: trial.trialId,
      userAnswer: wrongItem?.surface ?? ""
    });

    const edges = await database.query.katakanaConfusionEdge.findMany({
      where: eq(katakanaConfusionEdge.sessionId, session.sessionId)
    });

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      confusionCount: 1,
      expectedItemId: trial.correctItemId,
      observedItemId: wrongItem?.id,
      sessionId: session.sessionId,
      sortOrder: 0
    });
  });
});
