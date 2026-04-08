import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations,
  type DatabaseClient
} from "@/db";
import { submitKanjiClashAnswerAction } from "@/actions/kanji-clash";
import { loadKanjiClashQueueSnapshot } from "@/lib/kanji-clash";
import { seedKanjiClashFixture } from "./helpers/kanji-clash-fixture";

describe("submitKanjiClashAnswerAction", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-kanji-clash-action-"));
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

  it("validates the current round and delegates the answer mutation", async () => {
    const queue = await loadKanjiClashQueueSnapshot({
      database,
      mode: "manual",
      now: new Date("2026-04-09T12:00:00.000Z"),
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a Kanji Clash round in the action fixture.");
    }

    const result = await submitKanjiClashAnswerAction({
      chosenSubjectKey: currentRound.correctSubjectKey,
      database,
      expectedPairKey: currentRound.pairKey,
      queue,
      responseMs: 182.4
    });
    const storedPairState = await database.query.kanjiClashPairState.findFirst({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });
    const storedLog = await database.query.kanjiClashPairLog.findFirst({
      where: (table, { eq }) => eq(table.id, result.logId)
    });

    expect(result.isCorrect).toBe(true);
    expect(result.selectedSubjectKey).toBe(currentRound.correctSubjectKey);
    expect(result.nextQueue.seenPairKeys).toContain(currentRound.pairKey);
    expect(storedPairState?.pairKey).toBe(currentRound.pairKey);
    expect(storedLog?.responseMs).toBe(182);
  });

  it("rejects stale pair keys before writing state", async () => {
    const queue = await loadKanjiClashQueueSnapshot({
      database,
      mode: "manual",
      now: new Date("2026-04-09T12:00:00.000Z"),
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a Kanji Clash round in the action fixture.");
    }

    await expect(
      submitKanjiClashAnswerAction({
        chosenSubjectKey: currentRound.correctSubjectKey,
        database,
        expectedPairKey: `${currentRound.pairKey}:stale`,
        queue
      })
    ).rejects.toThrow("Kanji Clash round is out of date.");

    const pairStates = await database.query.kanjiClashPairState.findMany();
    const logs = await database.query.kanjiClashPairLog.findMany();

    expect(pairStates).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });
});
