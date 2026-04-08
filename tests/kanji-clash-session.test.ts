import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  kanjiClashPairLog,
  kanjiClashPairState,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  applyKanjiClashSessionAction,
  buildKanjiClashPairKey,
  loadKanjiClashQueueSnapshot
} from "@/lib/kanji-clash";
import { seedKanjiClashFixture } from "./helpers/kanji-clash-fixture";

describe("kanji clash session service", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanji-clash-session-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedKanjiClashFixture(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { force: true, recursive: true });
  });

  it("tops up automatic sessions with only the remaining new-pair budget for today", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const duePairKey = buildKanjiClashPairKey(
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-alpha-shokuhin"
    );
    const introducedTodayPairKey = buildKanjiClashPairKey(
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-alpha-shokutaku"
    );

    await database.insert(kanjiClashPairState).values([
      {
        createdAt: "2026-04-08T08:00:00.000Z",
        difficulty: 2.4,
        dueAt: "2026-04-09T09:00:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-08T08:00:00.000Z",
        lastReviewedAt: "2026-04-08T08:00:00.000Z",
        learningSteps: 0,
        leftSubjectKey: "entry:term:term-alpha-shokuhi",
        pairKey: duePairKey,
        reps: 3,
        rightSubjectKey: "entry:term:term-alpha-shokuhin",
        scheduledDays: 2,
        stability: 8.4,
        state: "review",
        updatedAt: "2026-04-08T08:00:00.000Z"
      },
      {
        createdAt: "2026-04-09T07:30:00.000Z",
        difficulty: 3.2,
        dueAt: "2026-04-10T07:30:00.000Z",
        lapses: 1,
        lastInteractionAt: "2026-04-09T07:30:00.000Z",
        lastReviewedAt: "2026-04-09T07:30:00.000Z",
        learningSteps: 1,
        leftSubjectKey: "entry:term:term-alpha-shokuhi",
        pairKey: introducedTodayPairKey,
        reps: 1,
        rightSubjectKey: "entry:term:term-alpha-shokutaku",
        scheduledDays: 1,
        stability: 0.8,
        state: "learning",
        updatedAt: "2026-04-09T07:30:00.000Z"
      }
    ]);
    await database.insert(kanjiClashPairLog).values({
      answeredAt: "2026-04-09T07:30:00.000Z",
      chosenSubjectKey: "entry:term:term-alpha-shokuhi",
      correctSubjectKey: "entry:term:term-alpha-shokuhi",
      elapsedDays: 0,
      id: "kanji-clash-log-introduced-today",
      leftSubjectKey: "entry:term:term-alpha-shokuhi",
      mode: "automatic",
      newState: "learning",
      pairKey: introducedTodayPairKey,
      previousState: "new",
      responseMs: 240,
      result: "good",
      rightSubjectKey: "entry:term:term-alpha-shokutaku",
      scheduledDueAt: "2026-04-10T07:30:00.000Z",
      schedulerVersion: "kanji_clash_fsrs_v1",
      targetSubjectKey: "entry:term:term-alpha-shokuhi"
    });

    const queue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 2,
      database,
      mode: "automatic",
      now,
      scope: "global"
    });

    expect(queue.introducedTodayCount).toBe(1);
    expect(queue.dueCount).toBe(1);
    expect(queue.newQueuedCount).toBe(1);
    expect(queue.totalCount).toBe(2);
    expect(queue.rounds[0]?.pairKey).toBe(duePairKey);
    expect(
      queue.rounds.some((round) => round.pairKey === introducedTodayPairKey)
    ).toBe(false);
  });

  it("persists kanji clash pair state and log mutations without touching review state", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const reviewStateBefore = await database.query.reviewSubjectState.findMany({
      orderBy: (table, { asc }) => asc(table.subjectKey)
    });
    const queue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 1,
      database,
      mode: "manual",
      now,
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a Kanji Clash round in the session fixture.");
    }

    const result = await applyKanjiClashSessionAction({
      chosenSubjectKey: currentRound.correctSubjectKey,
      database,
      now,
      queue,
      responseMs: 180
    });

    const storedPairState = await database.query.kanjiClashPairState.findFirst({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });
    const storedLog = await database.query.kanjiClashPairLog.findFirst({
      where: (table, { eq }) => eq(table.id, result.logId)
    });
    const reviewStateAfter = await database.query.reviewSubjectState.findMany({
      orderBy: (table, { asc }) => asc(table.subjectKey)
    });

    expect(result.isCorrect).toBe(true);
    expect(result.nextQueue.currentRoundIndex).toBe(1);
    expect(result.nextQueue.seenPairKeys).toContain(currentRound.pairKey);
    expect(storedPairState?.pairKey).toBe(currentRound.pairKey);
    expect(storedPairState?.reps).toBe(result.pairState.reps);
    expect(storedLog).toMatchObject({
      pairKey: currentRound.pairKey,
      mode: "manual",
      result: "good",
      targetSubjectKey: currentRound.targetSubjectKey
    });
    expect(reviewStateAfter).toEqual(reviewStateBefore);
  });
});
