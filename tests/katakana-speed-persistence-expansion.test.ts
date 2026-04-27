import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq, getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  insertKatakanaConfusionEdges,
  insertKatakanaExerciseBlocks,
  insertKatakanaExerciseResults,
  listKatakanaConfusionEdgeRowsBySession,
  listKatakanaExerciseBlockRowsBySession,
  listKatakanaExerciseResultRowsBySession
} from "@/db/queries";
import {
  katakanaAttemptLog,
  katakanaConfusionEdge,
  katakanaExerciseBlock,
  katakanaExerciseResult,
  katakanaSession,
  katakanaTrial,
  katakanaTrialModeValues
} from "@/db/schema";

describe("katakana speed persistence expansion", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-katakana-expansion-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("exposes the expanded exercise modes", () => {
    expect(getTableName(katakanaExerciseBlock)).toBe("katakana_exercise_block");
    expect(getTableName(katakanaExerciseResult)).toBe(
      "katakana_exercise_result"
    );
    expect(getTableName(katakanaConfusionEdge)).toBe("katakana_confusion_edge");
    expect(katakanaTrialModeValues).toEqual([
      "minimal_pair",
      "blink",
      "word_naming",
      "pseudoword_sprint",
      "sentence_sprint",
      "ran_grid"
    ]);
  });

  it("persists exercise blocks, results, confusion edges, and trial snapshots", async () => {
    await database.insert(katakanaSession).values({
      createdAt: "2026-04-26T08:00:00.000Z",
      id: "session-expansion",
      startedAt: "2026-04-26T08:00:00.000Z",
      status: "active",
      updatedAt: "2026-04-26T08:00:00.000Z"
    });

    await insertKatakanaExerciseBlocks(database, [
      {
        blockId: "block-second",
        createdAt: "2026-04-26T08:00:00.000Z",
        exerciseId: "exercise-expanded",
        focusChunksJson: JSON.stringify(["チャ", "チュ"]),
        itemType: "word",
        mode: "word_naming",
        sessionId: "session-expansion",
        sortOrder: 20,
        title: "Second block",
        updatedAt: "2026-04-26T08:00:00.000Z"
      },
      {
        blockId: "block-first",
        createdAt: "2026-04-26T08:00:00.000Z",
        exerciseId: "exercise-expanded",
        focusChunksJson: JSON.stringify(["キャ", "キュ"]),
        itemType: "pseudoword",
        mode: "pseudoword_sprint",
        sessionId: "session-expansion",
        sortOrder: 10,
        title: "First block",
        updatedAt: "2026-04-26T08:00:00.000Z"
      }
    ]);

    await database.insert(katakanaTrial).values({
      blockId: "block-first",
      correctItemId: "kana-kya",
      exerciseId: "exercise-expanded",
      expectedSurface: "キャ",
      featuresJson: JSON.stringify({ moraCount: 1 }),
      focusChunksJson: JSON.stringify(["キャ"]),
      itemId: "kana-kya",
      itemType: "pseudoword",
      metricsJson: JSON.stringify({ targetWpm: 120 }),
      mode: "pseudoword_sprint",
      optionItemIdsJson: JSON.stringify(["kana-kya"]),
      promptSurface: "キャ",
      selfRating: "clean",
      sessionId: "session-expansion",
      sortOrder: 1,
      status: "answered",
      targetRtMs: 900,
      trialId: "trial-expanded",
      wasPseudo: 1,
      wasRepair: 0,
      wasTransfer: 1
    });

    await database.insert(katakanaAttemptLog).values({
      blockId: "block-first",
      createdAt: "2026-04-26T08:00:01.000Z",
      exerciseId: "exercise-expanded",
      expectedAnswer: "キャ",
      expectedSurface: "キャ",
      featuresJson: JSON.stringify({ moraCount: 1 }),
      focusChunksJson: JSON.stringify(["キャ"]),
      id: "attempt-expanded",
      isCorrect: 1,
      itemId: "kana-kya",
      itemType: "pseudoword",
      metricsJson: JSON.stringify({ wpm: 132 }),
      mode: "pseudoword_sprint",
      promptSurface: "キャ",
      responseMs: 410,
      selfRating: "clean",
      sessionId: "session-expansion",
      sortOrder: 1,
      trialId: "trial-expanded",
      userAnswer: "キャ",
      wasPseudo: 1,
      wasRepair: 0,
      wasTransfer: 1
    });

    await insertKatakanaExerciseResults(database, [
      {
        blockId: "block-second",
        createdAt: "2026-04-26T08:00:03.000Z",
        exerciseId: "exercise-expanded",
        isCorrect: 0,
        metricsJson: JSON.stringify({ wpm: 92 }),
        resultId: "result-second",
        selfRating: "wrong",
        sessionId: "session-expansion",
        sortOrder: 2,
        trialId: "trial-expanded"
      },
      {
        blockId: "block-first",
        createdAt: "2026-04-26T08:00:02.000Z",
        exerciseId: "exercise-expanded",
        isCorrect: 1,
        metricsJson: JSON.stringify({ wpm: 132 }),
        resultId: "result-first",
        selfRating: "clean",
        sessionId: "session-expansion",
        sortOrder: 1,
        trialId: "trial-expanded"
      }
    ]);

    await insertKatakanaConfusionEdges(database, [
      {
        blockId: "block-first",
        confusionCount: 1,
        createdAt: "2026-04-26T08:00:04.000Z",
        edgeId: "edge-second",
        expectedItemId: "kana-kya",
        exerciseId: "exercise-expanded",
        observedItemId: "kana-kiya",
        sessionId: "session-expansion",
        sortOrder: 2,
        updatedAt: "2026-04-26T08:00:04.000Z"
      },
      {
        blockId: "block-first",
        confusionCount: 3,
        createdAt: "2026-04-26T08:00:04.000Z",
        edgeId: "edge-first",
        expectedItemId: "kana-tya",
        exerciseId: "exercise-expanded",
        observedItemId: "kana-cha",
        sessionId: "session-expansion",
        sortOrder: 1,
        updatedAt: "2026-04-26T08:00:04.000Z"
      }
    ]);

    const blocks = await listKatakanaExerciseBlockRowsBySession(
      database,
      "session-expansion"
    );
    const results = await listKatakanaExerciseResultRowsBySession(
      database,
      "session-expansion"
    );
    const confusionEdges = await listKatakanaConfusionEdgeRowsBySession(
      database,
      "session-expansion"
    );
    const trial = await database.query.katakanaTrial.findFirst({
      where: eq(katakanaTrial.trialId, "trial-expanded")
    });
    const attempt = await database.query.katakanaAttemptLog.findFirst({
      where: eq(katakanaAttemptLog.id, "attempt-expanded")
    });

    expect(blocks.map((block) => block.blockId)).toEqual([
      "block-first",
      "block-second"
    ]);
    expect(results.map((result) => result.resultId)).toEqual([
      "result-first",
      "result-second"
    ]);
    expect(confusionEdges.map((edge) => edge.edgeId)).toEqual([
      "edge-first",
      "edge-second"
    ]);
    expect(trial).toMatchObject({
      blockId: "block-first",
      exerciseId: "exercise-expanded",
      expectedSurface: "キャ",
      itemType: "pseudoword",
      selfRating: "clean",
      sortOrder: 1,
      wasPseudo: 1,
      wasRepair: 0,
      wasTransfer: 1
    });
    expect(attempt).toMatchObject({
      blockId: "block-first",
      exerciseId: "exercise-expanded",
      expectedSurface: "キャ",
      itemType: "pseudoword",
      metricsJson: JSON.stringify({ wpm: 132 }),
      selfRating: "clean",
      sortOrder: 1,
      wasPseudo: 1,
      wasRepair: 0,
      wasTransfer: 1
    });
  });
});
