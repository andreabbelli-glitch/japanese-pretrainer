import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  kanjiClashPairLog,
  kanjiClashPairState,
  runMigrations,
  type DatabaseClient
} from "@/db";

describe("kanji clash pair persistence", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanji-clash-db-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists pair state and pair logs with the dedicated scheduler namespace", async () => {
    const pairKey = "entry:term:alpha::entry:term:beta";
    const firstAnsweredAt = "2026-04-01T10:00:00.000Z";
    const secondAnsweredAt = "2026-04-01T10:05:00.000Z";

    await database.insert(kanjiClashPairState).values({
      pairKey,
      leftSubjectKey: "entry:term:alpha",
      rightSubjectKey: "entry:term:beta",
      state: "review",
      stability: 8,
      difficulty: 2.5,
      dueAt: firstAnsweredAt,
      lastReviewedAt: firstAnsweredAt,
      lastInteractionAt: firstAnsweredAt,
      scheduledDays: 3,
      learningSteps: 0,
      lapses: 1,
      reps: 4,
      createdAt: firstAnsweredAt,
      updatedAt: firstAnsweredAt
    });

    await database.insert(kanjiClashPairLog).values([
      {
        id: "kanji-clash-log-1",
        pairKey,
        mode: "automatic",
        answeredAt: firstAnsweredAt,
        targetSubjectKey: "entry:term:alpha",
        correctSubjectKey: "entry:term:alpha",
        chosenSubjectKey: "entry:term:alpha",
        leftSubjectKey: "entry:term:alpha",
        rightSubjectKey: "entry:term:beta",
        result: "good",
        previousState: "review",
        newState: "review",
        scheduledDueAt: firstAnsweredAt,
        elapsedDays: 3,
        responseMs: 180
      },
      {
        id: "kanji-clash-log-2",
        pairKey,
        mode: "manual",
        answeredAt: secondAnsweredAt,
        targetSubjectKey: "entry:term:beta",
        correctSubjectKey: "entry:term:alpha",
        chosenSubjectKey: "entry:term:beta",
        leftSubjectKey: "entry:term:alpha",
        rightSubjectKey: "entry:term:beta",
        result: "again",
        previousState: "review",
        newState: "learning",
        scheduledDueAt: null,
        elapsedDays: 0,
        responseMs: 420
      }
    ]);

    const state = await database.query.kanjiClashPairState.findFirst({
      where: eq(kanjiClashPairState.pairKey, pairKey),
      with: {
        logs: true
      }
    });
    const log = await database.query.kanjiClashPairLog.findFirst({
      where: eq(kanjiClashPairLog.id, "kanji-clash-log-1"),
      with: {
        pairState: true
      }
    });

    expect(state).not.toBeNull();
    expect(state?.schedulerVersion).toBe("kanji_clash_fsrs_v1");
    expect(state?.logs).toHaveLength(2);
    const logs = [...(state?.logs ?? [])].sort((left, right) =>
      left.answeredAt.localeCompare(right.answeredAt)
    );
    expect(logs[0]?.mode).toBe("automatic");
    expect(logs[1]?.result).toBe("again");
    expect(log?.pairState?.pairKey).toBe(pairKey);
    expect(log?.pairState?.leftSubjectKey).toBe("entry:term:alpha");
  });
});
