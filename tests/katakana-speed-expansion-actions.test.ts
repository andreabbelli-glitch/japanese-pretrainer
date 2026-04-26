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
import {
  getKatakanaSpeedSessionPageData,
  startKatakanaSpeedSession,
  submitKatakanaSpeedAnswer
} from "@/features/katakana-speed/server";
import { getKatakanaSpeedItemById } from "@/features/katakana-speed/model/catalog";

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

  it("starts non-daily modes with exercise blocks and trial snapshots", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 4,
      database,
      mode: "pseudoword_transfer",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "pseudo-transfer"
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
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      exerciseId: `${session.sessionId}:pseudoword_transfer`,
      itemType: "pseudoword",
      mode: "pseudoword_sprint",
      sortOrder: 0
    });
    expect(
      JSON.parse(blocks[0]?.focusChunksJson ?? "[]").length
    ).toBeGreaterThan(0);
    expect(trials).toHaveLength(4);
    expect(trials.map((trial) => trial.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(trials.every((trial) => trial.blockId === blocks[0]?.blockId)).toBe(
      true
    );
    expect(
      trials.every((trial) => trial.exerciseId === blocks[0]?.exerciseId)
    ).toBe(true);
    expect(trials.every((trial) => trial.itemType === "pseudoword")).toBe(true);
    expect(
      trials.every(
        (trial) =>
          !getKatakanaSpeedItemById(trial.itemId)?.tags.includes(
            "targetable-false"
          )
      )
    ).toBe(true);
    expect(trials.every((trial) => trial.wasPseudo === 1)).toBe(true);
    expect(trials.every((trial) => trial.wasTransfer === 1)).toBe(true);
    expect(trials.every((trial) => trial.expectedSurface)).toBe(true);
    expect(trials.every((trial) => trial.focusChunksJson !== "[]")).toBe(true);
    expect(trials.every((trial) => trial.metricsJson !== "{}")).toBe(true);
  });

  it("starts rare combo through the capped block-aware scheduler", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 20,
      database,
      mode: "rare_combo",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "rare-capped-action"
    });
    const blocks = await database.query.katakanaExerciseBlock.findMany({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.sessionId, session.sessionId)
    });

    expect(blocks.length).toBeGreaterThan(1);
    expect(
      blocks.map((block) => block.sortOrder).sort((left, right) => left - right)
    ).toEqual(blocks.map((_, index) => index));
    expect(
      trials.filter((trial) => trial.featuresJson.includes('"wasRare":true'))
    ).toHaveLength(5);
  });

  it("starts model-backed operational modes with raw expected-answer snapshots", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 4,
      database,
      mode: "mora_trap",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "mora-trap-action"
    });
    const blocks = await database.query.katakanaExerciseBlock.findMany({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.sessionId, session.sessionId)
    });

    expect(blocks.length).toBeGreaterThan(1);
    expect(trials).toHaveLength(4);
    expect(trials[0]).toMatchObject({
      mode: "minimal_pair",
      itemType: "raw_choice"
    });
    expect(trials[0]?.expectedSurface).toBeTruthy();
    expect(JSON.parse(trials[0]?.featuresJson ?? "{}")).toMatchObject({
      hardMode: true,
      interaction: "raw_choice"
    });
    expect(JSON.parse(trials[0]?.optionItemIdsJson ?? "[]")).toEqual(
      expect.arrayContaining([expect.stringMatching(/^raw:/)])
    );
  });

  it("reloads expanded sessions with block and snapshot metadata", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 2,
      database,
      mode: "pseudoword_transfer",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "reload-pseudo"
    });
    const reloaded = await getKatakanaSpeedSessionPageData({
      database,
      sessionId: session.sessionId
    });

    expect(reloaded?.trials[0]).toMatchObject({
      blockId: expect.stringContaining("pseudoword_transfer"),
      exerciseId: expect.stringContaining("pseudoword_transfer"),
      itemType: "pseudoword",
      wasPseudo: true,
      wasTransfer: true
    });
    expect(reloaded?.trials[0]?.focusChunks?.length).toBeGreaterThan(0);
    expect(reloaded?.trials[0]?.metrics).toMatchObject({
      sessionMode: "pseudoword_transfer"
    });
  });

  it("records self-check results once and rejects trials from another session", async () => {
    const firstSession = await startKatakanaSpeedSessionAction({
      count: 2,
      database,
      mode: "sentence_sprint",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "self-check-a"
    });
    const secondSession = await startKatakanaSpeedSessionAction({
      count: 1,
      database,
      mode: "sentence_sprint",
      now: new Date("2026-04-26T08:01:00.000Z"),
      seed: "self-check-b"
    });
    const trial = firstSession.trials[0];
    expect(trial).toBeDefined();

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
      metricsJson: JSON.stringify({ durationMs: 1800, moraPerSecond: 4.2 }),
      selfRating: "hesitated"
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
      count: 6,
      database,
      mode: "ran_grid",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "ran-result"
    });
    const block = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
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
      where: eq(katakanaTrial.sessionId, session.sessionId)
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
      columns?: number;
      correctItems?: number;
      durationMs?: number;
      errorRate?: number;
      errors?: number;
      itemsPerSecond?: number;
      rows?: number;
      schemaVersion?: number;
      totalItems?: number;
      wrongCellIndexes?: number[];
      wrongCells?: Array<{
        column: number;
        index: number;
        itemId: string;
        row: number;
        surface: string;
      }>;
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
      rows: 5,
      columns: 5,
      schemaVersion: 1,
      totalItems: 25,
      wrongCellIndexes: [6, 18]
    });
    expect(metrics.wrongCells).toEqual([
      expect.objectContaining({
        column: 2,
        index: 6,
        row: 2
      }),
      expect.objectContaining({
        column: 4,
        index: 18,
        row: 4
      })
    ]);
    expect(trials.every((trial) => trial.status === "answered")).toBe(true);
    expect(attempts).toHaveLength(0);
  });

  it("rejects RAN aggregate wrong cell indexes outside the grid", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 6,
      database,
      mode: "ran_grid",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "ran-bad-index"
    });
    const block = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
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

  it("creates RAN as one 5x5 aggregate screen trial", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 6,
      database,
      mode: "ran_grid",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "ran-grid-screen"
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.sessionId, session.sessionId)
    });

    expect(trials).toHaveLength(1);
    expect(trials[0]).toMatchObject({
      mode: "ran_grid",
      sortOrder: 0
    });
    const features = JSON.parse(trials[0]?.featuresJson ?? "{}") as {
      gridItemIds?: string[];
      gridSurfaces?: string[];
    };
    expect(features.gridItemIds).toHaveLength(25);
    expect(features.gridSurfaces).toHaveLength(25);
  });

  it("creates repeated reading as two same-sentence passes plus one transfer pass", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 12,
      database,
      mode: "repeated_reading",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "repeated-reading"
    });
    const blocks = await database.query.katakanaExerciseBlock.findMany({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.sessionId, session.sessionId)
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      mode: "repeated_reading_pass",
      sortOrder: 0
    });
    expect(trials).toHaveLength(3);
    expect(new Set(trials.map((trial) => trial.trialId)).size).toBe(3);
    expect(trials.map((trial) => trial.sortOrder)).toEqual([0, 1, 2]);
    expect(trials.map((trial) => trial.mode)).toEqual([
      "repeated_reading_pass",
      "repeated_reading_pass",
      "repeated_reading_pass"
    ]);
    expect(trials[0]?.promptSurface).toBe(trials[1]?.promptSurface);
    expect(trials[2]?.promptSurface).not.toBe(trials[0]?.promptSurface);
    const firstFocusChunks = JSON.parse(
      trials[0]?.focusChunksJson ?? "[]"
    ) as string[];
    const transferFocusChunks = JSON.parse(
      trials[2]?.focusChunksJson ?? "[]"
    ) as string[];
    expect(
      firstFocusChunks.some((chunk) => transferFocusChunks.includes(chunk))
    ).toBe(true);
  });

  it("validates aggregate blocks before returning duplicate results", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 6,
      database,
      mode: "ran_grid",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "ran-duplicate-validation"
    });
    const ranBlock = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
    });
    if (!ranBlock) {
      throw new Error("Expected RAN exercise block.");
    }

    await aggregateKatakanaSpeedExerciseResultAction({
      blockId: ranBlock.blockId,
      database,
      exerciseId: ranBlock.exerciseId,
      metricsJson: { cells: 25, durationMs: 12000, errors: 2 },
      resultId: "ran-duplicate-result",
      sessionId: session.sessionId
    });

    const sentenceSession = await startKatakanaSpeedSessionAction({
      count: 2,
      database,
      mode: "sentence_sprint",
      now: new Date("2026-04-26T08:01:00.000Z"),
      seed: "sentence-duplicate-validation"
    });
    const sentenceBlock = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.sessionId, sentenceSession.sessionId)
    });
    if (!sentenceBlock) {
      throw new Error("Expected sentence exercise block.");
    }

    await expect(
      aggregateKatakanaSpeedExerciseResultAction({
        blockId: sentenceBlock.blockId,
        database,
        exerciseId: ranBlock.exerciseId,
        metricsJson: { cells: 25, durationMs: 1 },
        resultId: "ran-duplicate-result",
        sessionId: session.sessionId
      })
    ).rejects.toThrow("exercise block was not found");
  });

  it("rejects aggregate exercise results without an aggregate block", async () => {
    const session = await startKatakanaSpeedSessionAction({
      count: 2,
      database,
      mode: "sentence_sprint",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "bad-aggregate"
    });
    const block = await database.query.katakanaExerciseBlock.findFirst({
      where: eq(katakanaExerciseBlock.sessionId, session.sessionId)
    });
    if (!block) {
      throw new Error("Expected sentence exercise block.");
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
      count: 1,
      database,
      mode: "daily",
      now: new Date("2026-04-26T08:00:00.000Z"),
      seed: "wrong-choice-edge"
    });
    const trial = session.trials[0];
    expect(trial).toBeDefined();
    const wrongItemId = trial.optionItemIds.find(
      (itemId) => itemId !== trial.correctItemId
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
