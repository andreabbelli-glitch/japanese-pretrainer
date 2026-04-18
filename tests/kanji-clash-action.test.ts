import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundState,
  closeDatabaseClient,
  createDatabaseClient,
  runMigrations,
  type DatabaseClient
} from "@/db";
import {
  archiveKanjiClashManualContrastAction,
  restoreKanjiClashManualContrastAction,
  submitKanjiClashAnswerAction
} from "@/actions/kanji-clash";
import {
  buildKanjiClashCandidate,
  buildKanjiClashQueueSnapshot,
  createKanjiClashQueueToken,
  loadKanjiClashQueueSnapshot,
  type KanjiClashRoundSide,
  type KanjiClashSessionRound,
  verifyKanjiClashQueueToken
} from "@/lib/kanji-clash";
import { seedKanjiClashFixture } from "./helpers/kanji-clash-fixture";

const SESSION_NOW = new Date("2026-04-09T12:00:00.000Z");

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
      database,
      expectedPairKey: currentRound.pairKey,
      expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
      queueToken: createKanjiClashQueueToken(queue),
      responseMs: 182.4,
      selectedSide: resolveCorrectSide(currentRound)
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
    expect(verifyKanjiClashQueueToken(result.nextQueueToken)).toEqual(
      result.nextQueue
    );
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
        database,
        expectedPairKey: `${currentRound.pairKey}:stale`,
        expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
        queueToken: createKanjiClashQueueToken(queue),
        selectedSide: resolveCorrectSide(currentRound)
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
      database,
      expectedPairKey: currentRound.pairKey,
      expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
      queueToken: createKanjiClashQueueToken(queue),
      responseMs: 182.4,
      selectedSide: resolveCorrectSide(currentRound)
    });
    const stateAfterFirst = await database.query.kanjiClashPairState.findFirst({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });
    const logsAfterFirst = await database.query.kanjiClashPairLog.findMany({
      where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
    });

    await expect(
      submitKanjiClashAnswerAction({
        database,
        expectedPairKey: currentRound.pairKey,
        expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
        queueToken: createKanjiClashQueueToken(queue),
        responseMs: 182.4,
        selectedSide: resolveCorrectSide(currentRound)
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

  it("rejects tampered queue tokens before writing state", async () => {
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

    const queueToken = createKanjiClashQueueToken(queue);
    const tamperedToken = `${queueToken}tampered`;

    await expect(
      submitKanjiClashAnswerAction({
        database,
        expectedPairKey: currentRound.pairKey,
        expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
        queueToken: tamperedToken,
        selectedSide: resolveCorrectSide(currentRound)
      })
    ).rejects.toThrow("Kanji Clash queue token is invalid.");

    expect(await database.query.kanjiClashPairState.findMany()).toHaveLength(0);
    expect(await database.query.kanjiClashPairLog.findMany()).toHaveLength(0);
  });

  it("validates directional round identity even when multiple rounds share the same pair key", async () => {
    const alpha = makeSubject({
      kanji: ["食", "費"],
      label: "食費",
      reading: "しょくひ",
      subjectKey: "entry:term:manual-alpha"
    });
    const beta = makeSubject({
      kanji: ["食", "品"],
      label: "食品",
      reading: "しょくひん",
      subjectKey: "entry:term:manual-beta"
    });
    const candidate = buildKanjiClashCandidate(alpha, beta);

    if (!candidate) {
      throw new Error("Missing forced manual contrast action candidate.");
    }

    const contrastKey = candidate.pairKey;
    await insertForcedManualContrastFixture(database, {
      contrastKey,
      leftSubjectKey: alpha.subjectKey,
      rightSubjectKey: beta.subjectKey
    });
    const queue = buildKanjiClashQueueSnapshot({
      candidates: [
        {
          ...candidate,
          roundOverride: {
            origin: {
              contrastKey,
              direction: "subject_a",
              type: "manual-contrast"
            },
            roundKey: `${contrastKey}::subject_a`,
            targetSubjectKey: alpha.subjectKey
          }
        },
        {
          ...candidate,
          roundOverride: {
            origin: {
              contrastKey,
              direction: "subject_b",
              type: "manual-contrast"
            },
            roundKey: `${contrastKey}::subject_b`,
            targetSubjectKey: beta.subjectKey
          }
        }
      ],
      mode: "manual",
      now: SESSION_NOW,
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a forced manual contrast round.");
    }

    await expect(
      submitKanjiClashAnswerAction({
        database,
        expectedPairKey: currentRound.pairKey,
        expectedRoundKey: `${contrastKey}::subject_b`,
        expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
        queueToken: createKanjiClashQueueToken(queue),
        selectedSide: resolveCorrectSide(currentRound)
      })
    ).rejects.toThrow("Kanji Clash round is out of date.");

    const result = await submitKanjiClashAnswerAction({
      database,
      expectedPairKey: currentRound.pairKey,
      expectedRoundKey: currentRound.roundKey,
      expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
      queueToken: createKanjiClashQueueToken(queue),
      selectedSide: resolveCorrectSide(currentRound)
    });

    expect(result.answeredRound.roundKey).toBe(currentRound.roundKey);
    expect(result.nextRound?.roundKey).toBe(`${contrastKey}::subject_b`);
  });

  it("rejects stale manual-round submits after the contrast is archived", async () => {
    const alpha = makeSubject({
      kanji: ["食", "費"],
      label: "食費",
      reading: "しょくひ",
      subjectKey: "entry:term:manual-archived-alpha"
    });
    const beta = makeSubject({
      kanji: ["食", "品"],
      label: "食品",
      reading: "しょくひん",
      subjectKey: "entry:term:manual-archived-beta"
    });
    const candidate = buildKanjiClashCandidate(alpha, beta);

    if (!candidate) {
      throw new Error("Missing forced manual contrast action candidate.");
    }

    const contrastKey = candidate.pairKey;
    await insertForcedManualContrastFixture(database, {
      contrastKey,
      leftSubjectKey: alpha.subjectKey,
      rightSubjectKey: beta.subjectKey
    });
    const queue = buildKanjiClashQueueSnapshot({
      candidates: [
        {
          ...candidate,
          roundOverride: {
            origin: {
              contrastKey,
              direction: "subject_a",
              type: "manual-contrast"
            },
            roundKey: `${contrastKey}::subject_a`,
            targetSubjectKey: alpha.subjectKey
          }
        },
        {
          ...candidate,
          roundOverride: {
            origin: {
              contrastKey,
              direction: "subject_b",
              type: "manual-contrast"
            },
            roundKey: `${contrastKey}::subject_b`,
            targetSubjectKey: beta.subjectKey
          }
        }
      ],
      mode: "manual",
      now: SESSION_NOW,
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a forced manual contrast round.");
    }

    await archiveKanjiClashManualContrastAction({
      contrastKey,
      database,
      now: new Date("2026-04-09T12:05:00.000Z")
    });

    await expect(
      submitKanjiClashAnswerAction({
        database,
        expectedPairKey: currentRound.pairKey,
        expectedRoundKey: currentRound.roundKey,
        expectedPairStateUpdatedAt: currentRound.pairState?.updatedAt ?? null,
        queueToken: createKanjiClashQueueToken(queue),
        selectedSide: resolveCorrectSide(currentRound)
      })
    ).rejects.toThrow(
      "Questo contrasto manuale è stato archiviato. Aggiorna Kanji Clash per continuare."
    );

    const archived = await database.query.kanjiClashManualContrast.findFirst({
      where: (table, { eq }) => eq(table.contrastKey, contrastKey)
    });
    const roundStates = await database.query.kanjiClashManualContrastRoundState.findMany({
      where: (table, { eq }) => eq(table.contrastKey, contrastKey),
      orderBy: (table, { asc }) => asc(table.roundKey)
    });
    const logs = await database.query.kanjiClashManualContrastRoundLog.findMany({
      where: (table, { eq }) => eq(table.contrastKey, contrastKey)
    });

    expect(archived?.status).toBe("archived");
    expect(roundStates.map((state) => state.updatedAt)).toEqual([
      "2026-04-08T08:00:00.000Z",
      "2026-04-08T08:00:00.000Z"
    ]);
    expect(logs).toHaveLength(0);
  });

  it("archives and restores forced manual contrasts by resetting both directions due now", async () => {
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

    const contrastKey = currentRound.pairKey;

    await database.insert(kanjiClashManualContrast).values({
      contrastKey,
      createdAt: "2026-04-08T08:00:00.000Z",
      source: "forced",
      status: "active",
      subjectAKey: currentRound.candidate.leftSubjectKey,
      subjectBKey: currentRound.candidate.rightSubjectKey,
      timesConfirmed: 1,
      updatedAt: "2026-04-08T08:00:00.000Z"
    });
    await database.insert(kanjiClashManualContrastRoundState).values([
      {
        contrastKey,
        createdAt: "2026-04-08T08:00:00.000Z",
        difficulty: null,
        direction: "subject_a",
        dueAt: "2026-05-01T00:00:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-08T08:00:00.000Z",
        lastReviewedAt: null,
        learningSteps: 0,
        leftSubjectKey: currentRound.candidate.leftSubjectKey,
        reps: 0,
        rightSubjectKey: currentRound.candidate.rightSubjectKey,
        roundKey: `${contrastKey}::subject_a`,
        scheduledDays: 0,
        stability: null,
        state: "new",
        targetSubjectKey: currentRound.candidate.leftSubjectKey,
        updatedAt: "2026-04-08T08:00:00.000Z"
      },
      {
        contrastKey,
        createdAt: "2026-04-08T08:00:00.000Z",
        difficulty: null,
        direction: "subject_b",
        dueAt: "2026-05-02T00:00:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-08T08:00:00.000Z",
        lastReviewedAt: null,
        learningSteps: 0,
        leftSubjectKey: currentRound.candidate.leftSubjectKey,
        reps: 0,
        rightSubjectKey: currentRound.candidate.rightSubjectKey,
        roundKey: `${contrastKey}::subject_b`,
        scheduledDays: 0,
        stability: null,
        state: "new",
        targetSubjectKey: currentRound.candidate.rightSubjectKey,
        updatedAt: "2026-04-08T08:00:00.000Z"
      }
    ]);

    await archiveKanjiClashManualContrastAction({
      contrastKey,
      database,
      now: new Date("2026-04-09T12:10:00.000Z")
    });

    const archived = await database.query.kanjiClashManualContrast.findFirst({
      where: (table, { eq }) => eq(table.contrastKey, contrastKey)
    });

    expect(archived?.status).toBe("archived");

    await restoreKanjiClashManualContrastAction({
      contrastKey,
      database,
      now: new Date("2026-04-09T12:15:00.000Z")
    });

    const restored = await database.query.kanjiClashManualContrast.findFirst({
      where: (table, { eq }) => eq(table.contrastKey, contrastKey),
      with: {
        roundStates: true
      }
    });

    expect(restored?.status).toBe("active");
    expect(restored?.forcedDueAt).toBe("2026-04-09T12:15:00.000Z");
    expect(restored?.roundStates.map((state) => state.dueAt)).toEqual([
      "2026-04-09T12:15:00.000Z",
      "2026-04-09T12:15:00.000Z"
    ]);
  });
});

function makeSubject(input: {
  kanji: string[];
  label: string;
  reading: string;
  subjectKey: string;
}) {
  return {
    entryType: "term" as const,
    kanji: input.kanji,
    label: input.label,
    members: [
      {
        entryId: input.subjectKey,
        lemma: input.label,
        meaningIt: `${input.label} meaning`,
        mediaId: "media-alpha",
        mediaSlug: "alpha",
        mediaTitle: "Alpha",
        reading: input.reading
      }
    ],
    reading: input.reading,
    readingForms: [input.reading],
    reps: 4,
    reviewState: "review" as const,
    source: {
      entryId: input.subjectKey,
      type: "entry" as const
    },
    stability: 10,
    subjectKey: input.subjectKey,
    surfaceForms: [input.label]
  };
}

function resolveCorrectSide(
  round: KanjiClashSessionRound
): KanjiClashRoundSide {
  return round.leftSubjectKey === round.correctSubjectKey ? "left" : "right";
}

async function insertForcedManualContrastFixture(
  database: DatabaseClient,
  input: {
    contrastKey: string;
    leftSubjectKey: string;
    rightSubjectKey: string;
  }
) {
  await database.insert(kanjiClashManualContrast).values({
    contrastKey: input.contrastKey,
    createdAt: "2026-04-08T08:00:00.000Z",
    source: "forced",
    status: "active",
    subjectAKey: input.leftSubjectKey,
    subjectBKey: input.rightSubjectKey,
    timesConfirmed: 1,
    updatedAt: "2026-04-08T08:00:00.000Z"
  });
  await database.insert(kanjiClashManualContrastRoundState).values([
    {
      contrastKey: input.contrastKey,
      createdAt: "2026-04-08T08:00:00.000Z",
      difficulty: null,
      direction: "subject_a",
      dueAt: "2026-04-08T08:00:00.000Z",
      lapses: 0,
      lastInteractionAt: "2026-04-08T08:00:00.000Z",
      lastReviewedAt: null,
      learningSteps: 0,
      leftSubjectKey: input.leftSubjectKey,
      reps: 0,
      rightSubjectKey: input.rightSubjectKey,
      roundKey: `${input.contrastKey}::subject_a`,
      scheduledDays: 0,
      stability: null,
      state: "new",
      targetSubjectKey: input.leftSubjectKey,
      updatedAt: "2026-04-08T08:00:00.000Z"
    },
    {
      contrastKey: input.contrastKey,
      createdAt: "2026-04-08T08:00:00.000Z",
      difficulty: null,
      direction: "subject_b",
      dueAt: "2026-04-08T08:00:00.000Z",
      lapses: 0,
      lastInteractionAt: "2026-04-08T08:00:00.000Z",
      lastReviewedAt: null,
      learningSteps: 0,
      leftSubjectKey: input.leftSubjectKey,
      reps: 0,
      rightSubjectKey: input.rightSubjectKey,
      roundKey: `${input.contrastKey}::subject_b`,
      scheduledDays: 0,
      stability: null,
      state: "new",
      targetSubjectKey: input.rightSubjectKey,
      updatedAt: "2026-04-08T08:00:00.000Z"
    }
  ]);
}
