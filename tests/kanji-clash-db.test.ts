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
import {
  countKanjiClashAutomaticNewPairIntroductions,
  listKanjiClashPairStatesByPairKeys
} from "@/db/queries/kanji-clash-session";

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

  it("chunks pair-state lookups beyond a single sqlite-sized IN clause", async () => {
    const pairCount = 1200;
    const pairKeys = Array.from({ length: pairCount }, (_, index) =>
      `entry:term:${String(index).padStart(4, "0")}::entry:term:${String(index + 5000).padStart(4, "0")}`
    );
    const insertedAt = "2026-04-02T09:00:00.000Z";

    for (let start = 0; start < pairKeys.length; start += 200) {
      const batch = pairKeys.slice(start, start + 200).map((pairKey, index) => {
        const absoluteIndex = start + index;

        return {
          pairKey,
          leftSubjectKey: `entry:term:left:${String(absoluteIndex).padStart(4, "0")}`,
          rightSubjectKey: `entry:term:right:${String(absoluteIndex).padStart(4, "0")}`,
          state: "review" as const,
          stability: 6 + (absoluteIndex % 5),
          difficulty: 2.5,
          dueAt: insertedAt,
          lastReviewedAt: insertedAt,
          lastInteractionAt: insertedAt,
          scheduledDays: 3,
          learningSteps: 0,
          lapses: absoluteIndex % 3,
          reps: absoluteIndex + 1,
          createdAt: insertedAt,
          updatedAt: insertedAt
        };
      });

      await database.insert(kanjiClashPairState).values(batch);
    }

    const lookupPairKeys = [
      "",
      pairKeys[11],
      pairKeys[11],
      ...pairKeys,
      pairKeys[1199],
      pairKeys[400]
    ];

    const pairStates = await listKanjiClashPairStatesByPairKeys(
      database,
      lookupPairKeys
    );

    expect(pairStates.size).toBe(pairCount);
    expect(pairStates.get(pairKeys[0])?.pairKey).toBe(pairKeys[0]);
    expect(pairStates.get(pairKeys[400])?.reps).toBe(401);
    expect(pairStates.get(pairKeys[1199])?.leftSubjectKey).toBe(
      "entry:term:left:1199"
    );
    expect(pairStates.has("")).toBe(false);
  });

  it("counts only automatic new-introduction logs in the requested window", async () => {
    const firstPairKey = "entry:term:alpha::entry:term:beta";
    const secondPairKey = "entry:term:gamma::entry:term:delta";
    const automaticAnsweredAt = "2026-04-03T10:00:00.000Z";
    const manualAnsweredAt = "2026-04-03T11:00:00.000Z";

    await database.insert(kanjiClashPairState).values([
      {
        createdAt: automaticAnsweredAt,
        difficulty: 2.5,
        dueAt: automaticAnsweredAt,
        lapses: 0,
        lastInteractionAt: automaticAnsweredAt,
        lastReviewedAt: automaticAnsweredAt,
        learningSteps: 0,
        leftSubjectKey: "entry:term:alpha",
        pairKey: firstPairKey,
        reps: 3,
        rightSubjectKey: "entry:term:beta",
        scheduledDays: 2,
        stability: 8,
        state: "review",
        updatedAt: automaticAnsweredAt
      },
      {
        createdAt: manualAnsweredAt,
        difficulty: 2.5,
        dueAt: manualAnsweredAt,
        lapses: 0,
        lastInteractionAt: manualAnsweredAt,
        lastReviewedAt: manualAnsweredAt,
        learningSteps: 0,
        leftSubjectKey: "entry:term:gamma",
        pairKey: secondPairKey,
        reps: 3,
        rightSubjectKey: "entry:term:delta",
        scheduledDays: 2,
        stability: 8,
        state: "review",
        updatedAt: manualAnsweredAt
      }
    ]);
    await database.insert(kanjiClashPairLog).values([
      {
        id: "kanji-clash-log-automatic",
        pairKey: firstPairKey,
        mode: "automatic",
        answeredAt: automaticAnsweredAt,
        targetSubjectKey: "entry:term:alpha",
        correctSubjectKey: "entry:term:alpha",
        chosenSubjectKey: "entry:term:alpha",
        leftSubjectKey: "entry:term:alpha",
        rightSubjectKey: "entry:term:beta",
        result: "good",
        previousState: "new",
        newState: "learning",
        scheduledDueAt: automaticAnsweredAt,
        elapsedDays: 0,
        responseMs: 180
      },
      {
        id: "kanji-clash-log-manual",
        pairKey: secondPairKey,
        mode: "manual",
        answeredAt: manualAnsweredAt,
        targetSubjectKey: "entry:term:gamma",
        correctSubjectKey: "entry:term:gamma",
        chosenSubjectKey: "entry:term:gamma",
        leftSubjectKey: "entry:term:gamma",
        rightSubjectKey: "entry:term:delta",
        result: "good",
        previousState: "new",
        newState: "learning",
        scheduledDueAt: manualAnsweredAt,
        elapsedDays: 0,
        responseMs: 180
      }
    ]);

    const count = await countKanjiClashAutomaticNewPairIntroductions({
      database,
      endAt: "2026-04-04T00:00:00.000Z",
      startAt: "2026-04-03T00:00:00.000Z"
    });

    expect(count).toBe(1);
  });
});
