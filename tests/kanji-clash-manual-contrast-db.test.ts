import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundLog,
  kanjiClashManualContrastRoundState
} from "@/db/schema";
import {
  createKanjiClashManualContrastRoundLog,
  getKanjiClashManualContrastByContrastKey,
  getKanjiClashManualContrastRoundStateByRoundKey,
  insertKanjiClashManualContrastRoundStateIfAbsent,
  listKanjiClashManualContrastsByContrastKeys,
  listKanjiClashManualContrastRoundStatesByRoundKeys,
  updateKanjiClashManualContrastRoundStateIfCurrent
} from "@/db/queries/kanji-clash-manual-contrast";

describe("kanji clash manual contrast persistence", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), "jcs-kanji-clash-manual-contrast-db-")
    );
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persists unordered contrast metadata and directional round history", async () => {
    const contrastKey = "entry:term:alpha::entry:term:beta";
    const roundKey = `${contrastKey}::subject_a`;
    const createdAt = "2026-04-12T10:00:00.000Z";

    await database.insert(kanjiClashManualContrast).values({
      contrastKey,
      createdAt,
      forcedDueAt: "2026-04-13T10:00:00.000Z",
      lastConfirmedAt: createdAt,
      lastForcedAt: "2026-04-11T10:00:00.000Z",
      source: "forced",
      status: "active",
      timesConfirmed: 2,
      subjectAKey: "entry:term:alpha",
      subjectBKey: "entry:term:beta",
      updatedAt: createdAt
    });

    await database.insert(kanjiClashManualContrastRoundState).values({
      contrastKey,
      createdAt,
      difficulty: 2.5,
      dueAt: createdAt,
      direction: "subject_a",
      lastInteractionAt: createdAt,
      lastReviewedAt: createdAt,
      learningSteps: 0,
      lapses: 1,
      leftSubjectKey: "entry:term:alpha",
      reps: 4,
      rightSubjectKey: "entry:term:beta",
      scheduledDays: 3,
      state: "review",
      stability: 8,
      roundKey,
      targetSubjectKey: "entry:term:alpha",
      updatedAt: createdAt
    });

    await database.insert(kanjiClashManualContrastRoundLog).values({
      answeredAt: createdAt,
      chosenSubjectKey: "entry:term:alpha",
      contrastKey,
      correctSubjectKey: "entry:term:alpha",
      direction: "subject_a",
      elapsedDays: 3,
      id: "manual-contrast-log-1",
      leftSubjectKey: "entry:term:alpha",
      newState: "review",
      previousState: "review",
      result: "good",
      rightSubjectKey: "entry:term:beta",
      responseMs: 180,
      roundKey,
      scheduledDueAt: createdAt,
      targetSubjectKey: "entry:term:alpha"
    });

    const contrast = await database.query.kanjiClashManualContrast.findFirst({
      where: eq(kanjiClashManualContrast.contrastKey, contrastKey),
      with: {
        roundStates: {
          with: {
            logs: true
          }
        }
      }
    });
    const fetchedContrast = await getKanjiClashManualContrastByContrastKey(
      database,
      contrastKey
    );
    const log = await database.query.kanjiClashManualContrastRoundLog.findFirst(
      {
        where: eq(kanjiClashManualContrastRoundLog.id, "manual-contrast-log-1"),
        with: {
          roundState: {
            with: {
              manualContrast: true
            }
          }
        }
      }
    );

    expect(contrast).not.toBeNull();
    expect(contrast?.subjectAKey).toBe("entry:term:alpha");
    expect(contrast?.source).toBe("forced");
    expect(contrast?.status).toBe("active");
    expect(contrast?.timesConfirmed).toBe(2);
    expect(contrast?.roundStates).toHaveLength(1);
    expect(contrast?.roundStates[0]?.logs).toHaveLength(1);
    expect(contrast?.roundStates[0]?.logs[0]?.direction).toBe("subject_a");
    expect(fetchedContrast?.forcedDueAt).toBe("2026-04-13T10:00:00.000Z");
    expect(log?.roundState?.manualContrast?.contrastKey).toBe(contrastKey);
    expect(log?.roundState?.manualContrast?.subjectBKey).toBe(
      "entry:term:beta"
    );
  });

  it("supports optimistic round-state persistence and chunked directional lookups", async () => {
    const contrastKey = "entry:term:gamma::entry:term:delta";
    const firstRoundKey = `${contrastKey}::subject_a`;
    const secondRoundKey = `${contrastKey}::subject_b`;
    const insertedAt = "2026-04-12T11:00:00.000Z";

    await database.insert(kanjiClashManualContrast).values({
      contrastKey,
      createdAt: insertedAt,
      subjectAKey: "entry:term:gamma",
      subjectBKey: "entry:term:delta",
      updatedAt: insertedAt
    });

    const firstInsert = await insertKanjiClashManualContrastRoundStateIfAbsent(
      database,
      {
        createdAt: insertedAt,
        nextState: {
          contrastKey,
          createdAt: insertedAt,
          difficulty: 2.5,
          dueAt: insertedAt,
          direction: "subject_a",
          lastInteractionAt: insertedAt,
          lastReviewedAt: null,
          learningSteps: 0,
          lapses: 0,
          leftSubjectKey: "entry:term:gamma",
          reps: 1,
          rightSubjectKey: "entry:term:delta",
          scheduledDays: 0,
          state: "new",
          stability: null,
          roundKey: firstRoundKey,
          targetSubjectKey: "entry:term:gamma",
          updatedAt: insertedAt
        }
      }
    );
    const duplicateInsert =
      await insertKanjiClashManualContrastRoundStateIfAbsent(database, {
        createdAt: insertedAt,
        nextState: {
          contrastKey,
          createdAt: insertedAt,
          difficulty: 2.5,
          dueAt: insertedAt,
          direction: "subject_a",
          lastInteractionAt: insertedAt,
          lastReviewedAt: null,
          learningSteps: 0,
          lapses: 0,
          leftSubjectKey: "entry:term:gamma",
          reps: 1,
          rightSubjectKey: "entry:term:delta",
          scheduledDays: 0,
          state: "new",
          stability: null,
          roundKey: firstRoundKey,
          targetSubjectKey: "entry:term:gamma",
          updatedAt: insertedAt
        }
      });

    await database.insert(kanjiClashManualContrastRoundState).values({
      contrastKey,
      createdAt: insertedAt,
      difficulty: 2.5,
      dueAt: insertedAt,
      direction: "subject_b",
      lastInteractionAt: insertedAt,
      lastReviewedAt: insertedAt,
      learningSteps: 0,
      lapses: 1,
      leftSubjectKey: "entry:term:gamma",
      reps: 2,
      rightSubjectKey: "entry:term:delta",
      scheduledDays: 1,
      state: "learning",
      stability: 5.1,
      roundKey: secondRoundKey,
      targetSubjectKey: "entry:term:delta",
      updatedAt: insertedAt
    });

    const lookup = await listKanjiClashManualContrastRoundStatesByRoundKeys(
      database,
      ["", firstRoundKey, firstRoundKey, secondRoundKey, secondRoundKey]
    );
    const contrastLookup = await listKanjiClashManualContrastsByContrastKeys(
      database,
      ["", contrastKey, contrastKey]
    );
    const current = await getKanjiClashManualContrastRoundStateByRoundKey(
      database,
      firstRoundKey
    );

    expect(firstInsert).toBe(true);
    expect(duplicateInsert).toBe(false);
    expect(lookup.size).toBe(2);
    expect(contrastLookup.size).toBe(1);
    expect(contrastLookup.get(contrastKey)?.source).toBe("manual");
    expect(lookup.get(firstRoundKey)?.direction).toBe("subject_a");
    expect(lookup.get(secondRoundKey)?.targetSubjectKey).toBe(
      "entry:term:delta"
    );
    expect(current?.roundKey).toBe(firstRoundKey);

    const updated = await updateKanjiClashManualContrastRoundStateIfCurrent(
      database,
      {
        expectedUpdatedAt: insertedAt,
        nextState: {
          contrastKey,
          createdAt: insertedAt,
          difficulty: 2.1,
          dueAt: "2026-04-13T11:00:00.000Z",
          direction: "subject_a",
          lastInteractionAt: "2026-04-12T12:00:00.000Z",
          lastReviewedAt: "2026-04-12T12:00:00.000Z",
          learningSteps: 1,
          lapses: 0,
          leftSubjectKey: "entry:term:gamma",
          reps: 2,
          rightSubjectKey: "entry:term:delta",
          scheduledDays: 1,
          state: "review",
          stability: 6.3,
          roundKey: firstRoundKey,
          targetSubjectKey: "entry:term:gamma",
          updatedAt: "2026-04-12T12:00:00.000Z"
        }
      }
    );
    const staleUpdate = await updateKanjiClashManualContrastRoundStateIfCurrent(
      database,
      {
        expectedUpdatedAt: insertedAt,
        nextState: {
          contrastKey,
          createdAt: insertedAt,
          difficulty: 2,
          dueAt: "2026-04-14T11:00:00.000Z",
          direction: "subject_a",
          lastInteractionAt: "2026-04-12T13:00:00.000Z",
          lastReviewedAt: "2026-04-12T13:00:00.000Z",
          learningSteps: 2,
          lapses: 0,
          leftSubjectKey: "entry:term:gamma",
          reps: 3,
          rightSubjectKey: "entry:term:delta",
          scheduledDays: 2,
          state: "review",
          stability: 6.5,
          roundKey: firstRoundKey,
          targetSubjectKey: "entry:term:gamma",
          updatedAt: "2026-04-12T13:00:00.000Z"
        }
      }
    );

    const stored =
      await database.query.kanjiClashManualContrastRoundState.findFirst({
        where: eq(kanjiClashManualContrastRoundState.roundKey, firstRoundKey)
      });

    expect(updated).toBe(true);
    expect(staleUpdate).toBe(false);
    expect(stored?.updatedAt).toBe("2026-04-12T12:00:00.000Z");
    expect(stored?.reps).toBe(2);

    await createKanjiClashManualContrastRoundLog(database, {
      answeredAt: "2026-04-12T12:00:00.000Z",
      chosenSubjectKey: "entry:term:gamma",
      contrastKey,
      correctSubjectKey: "entry:term:gamma",
      direction: "subject_a",
      elapsedDays: 1,
      id: "manual-contrast-log-2",
      leftSubjectKey: "entry:term:gamma",
      newState: "review",
      previousState: "learning",
      result: "good",
      rightSubjectKey: "entry:term:delta",
      responseMs: 205,
      roundKey: firstRoundKey,
      scheduledDueAt: "2026-04-13T11:00:00.000Z",
      targetSubjectKey: "entry:term:gamma"
    });

    const insertedLog =
      await database.query.kanjiClashManualContrastRoundLog.findFirst({
        where: eq(kanjiClashManualContrastRoundLog.id, "manual-contrast-log-2"),
        with: {
          roundState: true
        }
      });

    expect(insertedLog?.roundState?.roundKey).toBe(firstRoundKey);
    expect(insertedLog?.direction).toBe("subject_a");
  });
});
