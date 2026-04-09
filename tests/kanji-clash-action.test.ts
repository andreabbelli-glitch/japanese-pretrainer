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

const SESSION_NOW = new Date("2026-04-09T12:00:00.000Z");
const SESSION_SNAPSHOT_AT_ISO = SESSION_NOW.toISOString();

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
      now: SESSION_NOW,
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
      dailyNewLimit: queue.dailyNewLimit,
      expectedPairKey: currentRound.pairKey,
      expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
      mediaIds: [],
      mode: queue.mode,
      queue,
      requestedSize: queue.requestedSize,
      responseMs: 182.4,
      scope: queue.scope,
      seenPairKeys: queue.seenPairKeys,
      snapshotAtIso: SESSION_SNAPSHOT_AT_ISO
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
      now: SESSION_NOW,
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
        dailyNewLimit: queue.dailyNewLimit,
        expectedPairKey: `${currentRound.pairKey}:stale`,
        expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
        mediaIds: [],
        mode: queue.mode,
        queue,
        requestedSize: queue.requestedSize,
        scope: queue.scope,
        seenPairKeys: queue.seenPairKeys,
        snapshotAtIso: SESSION_SNAPSHOT_AT_ISO
      })
    ).rejects.toThrow("Kanji Clash round is out of date.");

    const pairStates = await database.query.kanjiClashPairState.findMany();
    const logs = await database.query.kanjiClashPairLog.findMany();

    expect(pairStates).toHaveLength(0);
    expect(logs).toHaveLength(0);
  });

  it("rejects replaying the same round payload after the first submit wins", async () => {
    const queue = await loadKanjiClashQueueSnapshot({
      database,
      mode: "manual",
      now: SESSION_NOW,
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a Kanji Clash round in the action fixture.");
    }

    expect(currentRound.pairState).toBeNull();

    const firstResult = await submitKanjiClashAnswerAction({
      chosenSubjectKey: currentRound.correctSubjectKey,
      database,
      dailyNewLimit: queue.dailyNewLimit,
      expectedPairKey: currentRound.pairKey,
      expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
      mediaIds: [],
      mode: queue.mode,
      queue,
      requestedSize: queue.requestedSize,
      responseMs: 182.4,
      scope: queue.scope,
      seenPairKeys: queue.seenPairKeys,
      snapshotAtIso: SESSION_SNAPSHOT_AT_ISO
    });
    const stateAfterFirst = await database.query.kanjiClashPairState.findFirst({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });
    const logsAfterFirst = await database.query.kanjiClashPairLog.findMany({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });

    await expect(
      submitKanjiClashAnswerAction({
        chosenSubjectKey: currentRound.correctSubjectKey,
        database,
        dailyNewLimit: queue.dailyNewLimit,
        expectedPairKey: currentRound.pairKey,
        expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
        mediaIds: [],
        mode: queue.mode,
        queue,
        requestedSize: queue.requestedSize,
        responseMs: 182.4,
        scope: queue.scope,
        seenPairKeys: queue.seenPairKeys,
        snapshotAtIso: SESSION_SNAPSHOT_AT_ISO
      })
    ).rejects.toThrow("Kanji Clash round is out of date.");

    const stateAfterSecond = await database.query.kanjiClashPairState.findFirst({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });
    const logsAfterSecond = await database.query.kanjiClashPairLog.findMany({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });

    expect(firstResult.isCorrect).toBe(true);
    expect(firstResult.pairState.updatedAt).toBe(stateAfterFirst?.updatedAt);
    expect(stateAfterSecond).toEqual(stateAfterFirst);
    expect(logsAfterFirst).toHaveLength(1);
    expect(logsAfterSecond).toHaveLength(1);
  });
});
