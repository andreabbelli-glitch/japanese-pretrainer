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

describe("kanji clash persistence", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanji-clash-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists pair state and logs with a dedicated relation", async () => {
    await database.insert(kanjiClashPairState).values({
      pairKey: "entry:term:1::entry:term:2",
      leftSubjectKey: "entry:term:1",
      rightSubjectKey: "entry:term:2",
      state: "review",
      stability: 8.5,
      difficulty: 2.1,
      dueAt: "2026-04-08T10:00:00.000Z",
      lastReviewedAt: "2026-04-07T10:00:00.000Z",
      lastInteractionAt: "2026-04-08T10:00:00.000Z",
      scheduledDays: 3,
      learningSteps: 0,
      lapses: 1,
      reps: 4,
      schedulerVersion: "kanji_clash_fsrs_v1",
      createdAt: "2026-04-08T10:00:00.000Z",
      updatedAt: "2026-04-08T10:00:00.000Z"
    });

    await database.insert(kanjiClashPairLog).values({
      id: "kanji-clash-log-1",
      pairKey: "entry:term:1::entry:term:2",
      mode: "automatic",
      answeredAt: "2026-04-08T10:05:00.000Z",
      targetSubjectKey: "entry:term:1",
      correctSubjectKey: "entry:term:1",
      chosenSubjectKey: "entry:term:1",
      leftSubjectKey: "entry:term:1",
      rightSubjectKey: "entry:term:2",
      result: "good",
      previousState: "review",
      newState: "review",
      scheduledDueAt: "2026-04-10T10:00:00.000Z",
      elapsedDays: 2,
      responseMs: 850,
      schedulerVersion: "kanji_clash_fsrs_v1"
    });

    const persistedState = await database.query.kanjiClashPairState.findFirst({
      where: eq(kanjiClashPairState.pairKey, "entry:term:1::entry:term:2"),
      with: {
        logs: true
      }
    });

    expect(persistedState).toMatchObject({
      pairKey: "entry:term:1::entry:term:2",
      schedulerVersion: "kanji_clash_fsrs_v1",
      logs: [
        {
          id: "kanji-clash-log-1",
          mode: "automatic",
          result: "good"
        }
      ]
    });
  });
});
