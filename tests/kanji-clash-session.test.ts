import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  card,
  cardEntryLink,
  kanjiClashManualContrast,
  kanjiClashManualContrastRoundState,
  kanjiClashPairLog,
  kanjiClashPairState,
  lesson,
  lessonProgress,
  media,
  reviewSubjectState,
  runMigrations,
  segment,
  term,
  type DatabaseClient
} from "@/db";
import {
  applyKanjiClashSessionAction,
  buildKanjiClashCandidate,
  buildKanjiClashPairKey,
  buildKanjiClashQueueSnapshot,
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
    await seedKanjiClashFixture(database, {
      includeSecondaryMedia: true
    });
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
      mediaIds: ["media-alpha"],
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

  it("counts only distinct automatic new introductions for the current day", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const countedPairKey = "entry:term:counted-left::entry:term:counted-right";
    const manualOnlyPairKey =
      "entry:term:manual-only-left::entry:term:manual-only-right";
    const reviewOnlyPairKey =
      "entry:term:review-only-left::entry:term:review-only-right";

    await database.insert(kanjiClashPairState).values([
      {
        createdAt: "2026-04-09T07:00:00.000Z",
        difficulty: 2.4,
        dueAt: "2026-04-10T07:00:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-09T07:00:00.000Z",
        lastReviewedAt: "2026-04-09T07:00:00.000Z",
        learningSteps: 1,
        leftSubjectKey: "entry:term:counted-left",
        pairKey: countedPairKey,
        reps: 1,
        rightSubjectKey: "entry:term:counted-right",
        scheduledDays: 1,
        stability: 0.8,
        state: "learning",
        updatedAt: "2026-04-09T07:00:00.000Z"
      },
      {
        createdAt: "2026-04-09T07:10:00.000Z",
        difficulty: 2.4,
        dueAt: "2026-04-10T07:10:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-09T07:10:00.000Z",
        lastReviewedAt: "2026-04-09T07:10:00.000Z",
        learningSteps: 1,
        leftSubjectKey: "entry:term:manual-only-left",
        pairKey: manualOnlyPairKey,
        reps: 1,
        rightSubjectKey: "entry:term:manual-only-right",
        scheduledDays: 1,
        stability: 0.8,
        state: "learning",
        updatedAt: "2026-04-09T07:10:00.000Z"
      },
      {
        createdAt: "2026-04-09T07:20:00.000Z",
        difficulty: 2.4,
        dueAt: "2026-04-10T07:20:00.000Z",
        lapses: 0,
        lastInteractionAt: "2026-04-09T07:20:00.000Z",
        lastReviewedAt: "2026-04-09T07:20:00.000Z",
        learningSteps: 1,
        leftSubjectKey: "entry:term:review-only-left",
        pairKey: reviewOnlyPairKey,
        reps: 1,
        rightSubjectKey: "entry:term:review-only-right",
        scheduledDays: 1,
        stability: 0.8,
        state: "learning",
        updatedAt: "2026-04-09T07:20:00.000Z"
      }
    ]);
    await database.insert(kanjiClashPairLog).values([
      {
        answeredAt: "2026-04-09T07:00:00.000Z",
        chosenSubjectKey: "entry:term:counted-left",
        correctSubjectKey: "entry:term:counted-left",
        elapsedDays: 0,
        id: "kanji-clash-log-counted-1",
        leftSubjectKey: "entry:term:counted-left",
        mode: "automatic",
        newState: "learning",
        pairKey: countedPairKey,
        previousState: "new",
        responseMs: 200,
        result: "good",
        rightSubjectKey: "entry:term:counted-right",
        scheduledDueAt: "2026-04-10T07:00:00.000Z",
        schedulerVersion: "kanji_clash_fsrs_v1",
        targetSubjectKey: "entry:term:counted-left"
      },
      {
        answeredAt: "2026-04-09T07:05:00.000Z",
        chosenSubjectKey: "entry:term:counted-right",
        correctSubjectKey: "entry:term:counted-left",
        elapsedDays: 0,
        id: "kanji-clash-log-counted-2",
        leftSubjectKey: "entry:term:counted-left",
        mode: "automatic",
        newState: "learning",
        pairKey: countedPairKey,
        previousState: "new",
        responseMs: 220,
        result: "again",
        rightSubjectKey: "entry:term:counted-right",
        scheduledDueAt: null,
        schedulerVersion: "kanji_clash_fsrs_v1",
        targetSubjectKey: "entry:term:counted-left"
      },
      {
        answeredAt: "2026-04-09T07:10:00.000Z",
        chosenSubjectKey: "entry:term:manual-only-left",
        correctSubjectKey: "entry:term:manual-only-left",
        elapsedDays: 0,
        id: "kanji-clash-log-manual-only",
        leftSubjectKey: "entry:term:manual-only-left",
        mode: "manual",
        newState: "learning",
        pairKey: manualOnlyPairKey,
        previousState: "new",
        responseMs: 210,
        result: "good",
        rightSubjectKey: "entry:term:manual-only-right",
        scheduledDueAt: "2026-04-10T07:10:00.000Z",
        schedulerVersion: "kanji_clash_fsrs_v1",
        targetSubjectKey: "entry:term:manual-only-left"
      },
      {
        answeredAt: "2026-04-09T07:20:00.000Z",
        chosenSubjectKey: "entry:term:review-only-left",
        correctSubjectKey: "entry:term:review-only-left",
        elapsedDays: 0,
        id: "kanji-clash-log-review-only",
        leftSubjectKey: "entry:term:review-only-left",
        mode: "automatic",
        newState: "review",
        pairKey: reviewOnlyPairKey,
        previousState: "review",
        responseMs: 230,
        result: "good",
        rightSubjectKey: "entry:term:review-only-right",
        scheduledDueAt: "2026-04-10T07:20:00.000Z",
        schedulerVersion: "kanji_clash_fsrs_v1",
        targetSubjectKey: "entry:term:review-only-left"
      }
    ]);

    const queue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 3,
      database,
      mode: "automatic",
      now,
      scope: "global"
    });

    expect(queue.introducedTodayCount).toBe(1);
  });

  it("ignores persisted pair states that are not part of the automatic candidate set", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const unrelatedPairKey = buildKanjiClashPairKey(
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-beta-kaigan"
    );

    await database.insert(kanjiClashPairState).values({
      createdAt: "2026-04-08T08:00:00.000Z",
      difficulty: 2.4,
      dueAt: "2026-04-08T09:00:00.000Z",
      lapses: 0,
      lastInteractionAt: "2026-04-08T08:00:00.000Z",
      lastReviewedAt: "2026-04-08T08:00:00.000Z",
      learningSteps: 0,
      leftSubjectKey: "entry:term:term-alpha-shokuhi",
      pairKey: unrelatedPairKey,
      reps: 3,
      rightSubjectKey: "entry:term:term-beta-kaigan",
      scheduledDays: 2,
      stability: 8.4,
      state: "review",
      updatedAt: "2026-04-08T08:00:00.000Z"
    });

    const queue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 5,
      database,
      mode: "automatic",
      now,
      scope: "global"
    });

    expect(queue.dueCount).toBe(0);
    expect(queue.newQueuedCount).toBeGreaterThan(0);
    expect(
      queue.rounds.some((round) => round.pairKey === unrelatedPairKey)
    ).toBe(false);
  });

  it("builds a compact manual session on the default fixture", async () => {
    const queue = await loadKanjiClashQueueSnapshot({
      database,
      mode: "manual",
      now: new Date("2026-04-09T12:00:00.000Z"),
      requestedSize: 2,
      scope: "global"
    });

    expect(queue.requestedSize).toBe(2);
    expect(queue.totalCount).toBe(2);
    expect(new Set(queue.rounds.map((round) => round.pairKey)).size).toBe(2);
  });

  it("fills the incremental manual frontier without duplicating pair keys", async () => {
    await seedManualIncrementalExpansionFixture(database);

    const queue = await loadKanjiClashQueueSnapshot({
      database,
      mediaIds: ["media-manual-delta"],
      mode: "manual",
      now: new Date("2026-04-09T12:00:00.000Z"),
      requestedSize: 2,
      scope: "global"
    });

    expect(queue.totalCount).toBe(2);
    expect(new Set(queue.rounds.map((round) => round.pairKey)).size).toBe(
      queue.rounds.length
    );
    expect(queue.rounds.every((round) => round.source === "new")).toBe(true);
  });

  it("keeps a distant due pair ahead of the bounded manual frontier", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const distantPairKey = buildKanjiClashPairKey(
      "entry:term:term-zeta-14",
      "entry:term:term-zeta-15"
    );

    await seedManualFrontierFixture(database);
    await database.insert(kanjiClashPairState).values({
      createdAt: "2026-04-08T08:00:00.000Z",
      difficulty: 2.3,
      dueAt: "2026-04-08T09:00:00.000Z",
      lapses: 0,
      lastInteractionAt: "2026-04-08T08:00:00.000Z",
      lastReviewedAt: "2026-04-08T08:00:00.000Z",
      learningSteps: 0,
      leftSubjectKey: "entry:term:term-zeta-14",
      pairKey: distantPairKey,
      reps: 4,
      rightSubjectKey: "entry:term:term-zeta-15",
      scheduledDays: 1,
      stability: 7.9,
      state: "review",
      updatedAt: "2026-04-08T08:00:00.000Z"
    });

    const queue = await loadKanjiClashQueueSnapshot({
      database,
      mode: "manual",
      now,
      requestedSize: 2,
      scope: "global"
    });

    expect(queue.totalCount).toBe(2);
    expect(queue.rounds[0]?.pairKey).toBe(distantPairKey);
    expect(queue.rounds[0]?.source).toBe("due");
    expect(queue.rounds.some((round) => round.pairKey === distantPairKey)).toBe(
      true
    );
  });

  it("keeps the automatic daily new cap global across media scopes and still shows due pairs", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const exhaustedBudgetPairKey = buildKanjiClashPairKey(
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-alpha-shokuhin"
    );
    const dueBetaPairKey = buildKanjiClashPairKey(
      "entry:term:term-beta-kaigan",
      "entry:term:term-beta-kaiyou"
    );

    await database.insert(kanjiClashPairState).values({
      createdAt: "2026-04-08T08:00:00.000Z",
      difficulty: 3.1,
      dueAt: "2026-04-10T07:30:00.000Z",
      lapses: 0,
      lastInteractionAt: "2026-04-09T07:30:00.000Z",
      lastReviewedAt: "2026-04-09T07:30:00.000Z",
      learningSteps: 1,
      leftSubjectKey: "entry:term:term-alpha-shokuhi",
      pairKey: exhaustedBudgetPairKey,
      reps: 1,
      rightSubjectKey: "entry:term:term-alpha-shokuhin",
      scheduledDays: 1,
      stability: 0.8,
      state: "learning",
      updatedAt: "2026-04-09T07:30:00.000Z"
    });
    await database.insert(kanjiClashPairLog).values({
      answeredAt: "2026-04-09T07:30:00.000Z",
      chosenSubjectKey: "entry:term:term-alpha-shokuhi",
      correctSubjectKey: "entry:term:term-alpha-shokuhi",
      elapsedDays: 0,
      id: "kanji-clash-log-global-budget-exhausted",
      leftSubjectKey: "entry:term:term-alpha-shokuhi",
      mode: "automatic",
      newState: "learning",
      pairKey: exhaustedBudgetPairKey,
      previousState: "new",
      responseMs: 240,
      result: "good",
      rightSubjectKey: "entry:term:term-alpha-shokuhin",
      scheduledDueAt: "2026-04-10T07:30:00.000Z",
      schedulerVersion: "kanji_clash_fsrs_v1",
      targetSubjectKey: "entry:term:term-alpha-shokuhi"
    });

    const betaNewQueue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 1,
      database,
      mediaIds: ["media-beta"],
      mode: "automatic",
      now,
      scope: "media"
    });

    expect(betaNewQueue.introducedTodayCount).toBe(1);
    expect(betaNewQueue.dueCount).toBe(0);
    expect(betaNewQueue.newAvailableCount).toBe(1);
    expect(betaNewQueue.newQueuedCount).toBe(0);
    expect(betaNewQueue.totalCount).toBe(0);

    await database.insert(kanjiClashPairState).values({
      createdAt: "2026-04-08T08:00:00.000Z",
      difficulty: 2.4,
      dueAt: "2026-04-08T09:00:00.000Z",
      lapses: 0,
      lastInteractionAt: "2026-04-08T08:00:00.000Z",
      lastReviewedAt: "2026-04-08T08:00:00.000Z",
      learningSteps: 0,
      leftSubjectKey: "entry:term:term-beta-kaigan",
      pairKey: dueBetaPairKey,
      reps: 3,
      rightSubjectKey: "entry:term:term-beta-kaiyou",
      scheduledDays: 1,
      stability: 4.8,
      state: "review",
      updatedAt: "2026-04-08T08:00:00.000Z"
    });

    const queue = await loadKanjiClashQueueSnapshot({
      dailyNewLimit: 1,
      database,
      mediaIds: ["media-beta"],
      mode: "automatic",
      now,
      scope: "media"
    });

    expect(queue.introducedTodayCount).toBe(1);
    expect(queue.dueCount).toBe(1);
    expect(queue.newAvailableCount).toBe(0);
    expect(queue.newQueuedCount).toBe(0);
    expect(queue.totalCount).toBe(1);
    expect(queue.rounds).toHaveLength(1);
    expect(queue.rounds[0]?.pairKey).toBe(dueBetaPairKey);
    expect(queue.rounds[0]?.source).toBe("due");
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

  it("uses the canonical persisted pair state inside the transaction", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const pairKey = buildKanjiClashPairKey(
      "entry:term:term-alpha-shokuhi",
      "entry:term:term-alpha-shokuhin"
    );
    const updatedAt = "2026-04-08T08:00:00.000Z";

    await database.insert(kanjiClashPairState).values({
      createdAt: updatedAt,
      difficulty: 2.4,
      dueAt: "2026-04-09T09:00:00.000Z",
      lapses: 0,
      lastInteractionAt: updatedAt,
      lastReviewedAt: updatedAt,
      learningSteps: 0,
      leftSubjectKey: "entry:term:term-alpha-shokuhi",
      pairKey,
      reps: 3,
      rightSubjectKey: "entry:term:term-alpha-shokuhin",
      scheduledDays: 2,
      stability: 8.4,
      state: "review",
      updatedAt
    });

    const queue = await loadKanjiClashQueueSnapshot({
      database,
      mode: "manual",
      now,
      requestedSize: 2,
      scope: "global"
    });
    const tamperedQueue = structuredClone(queue);
    const currentRound = tamperedQueue.rounds[tamperedQueue.currentRoundIndex];

    if (!currentRound?.pairState) {
      throw new Error("Expected a persisted Kanji Clash pair state.");
    }

    currentRound.pairState = {
      ...currentRound.pairState,
      reps: 999,
      scheduledDays: 99,
      state: "learning"
    };

    const result = await applyKanjiClashSessionAction({
      chosenSubjectKey: currentRound.correctSubjectKey,
      database,
      expectedPairStateUpdatedAt: updatedAt,
      now,
      queue: tamperedQueue,
      responseMs: 180
    });
    const storedLog = await database.query.kanjiClashPairLog.findFirst({
      where: (table, { eq }) => eq(table.id, result.logId)
    });

    expect(result.answeredRound.pairState?.state).toBe("review");
    expect(result.previousPairState.reps).toBe(3);
    expect(storedLog?.previousState).toBe("review");
  });

  it("allows only one winner when the same round is submitted concurrently", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
    const competingDatabase = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    try {
      const queue = await loadKanjiClashQueueSnapshot({
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

      expect(currentRound.pairState).toBeNull();

      const settled = await Promise.allSettled([
        applyKanjiClashSessionAction({
          chosenSubjectKey: currentRound.correctSubjectKey,
          database,
          now,
          queue,
          responseMs: 95
        }),
        applyKanjiClashSessionAction({
          chosenSubjectKey: currentRound.correctSubjectKey,
          database: competingDatabase,
          now,
          queue,
          responseMs: 95
        })
      ]);
      const pairStates = await database.query.kanjiClashPairState.findMany({
        where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
      });
      const logs = await database.query.kanjiClashPairLog.findMany({
        where: (table, { eq }) => eq(table.pairKey, currentRound.pairKey)
      });

      expect(
        settled.filter((result) => result.status === "fulfilled")
      ).toHaveLength(1);
      expect(
        settled.filter((result) => result.status === "rejected")
      ).toHaveLength(1);
      const rejected = settled.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected"
      );
      const rejectedMessage =
        (rejected?.reason as Error | undefined)?.message ?? "";

      expect([
        "Kanji Clash round is out of date.",
        "SQLITE_BUSY: database is locked"
      ]).toContain(rejectedMessage);
      expect(pairStates).toHaveLength(1);
      expect(logs).toHaveLength(1);
    } finally {
      closeDatabaseClient(competingDatabase);
    }
  });

  it("advances by round key so directional manual contrast rounds can be answered independently", async () => {
    const now = new Date("2026-04-09T12:00:00.000Z");
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
      throw new Error("Missing forced manual contrast session candidate.");
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
      now,
      requestedSize: 2,
      scope: "global"
    });
    const currentRound = queue.rounds[0];

    if (!currentRound) {
      throw new Error("Expected a forced manual contrast round.");
    }

    const result = await applyKanjiClashSessionAction({
      chosenSubjectKey: currentRound.correctSubjectKey,
      database,
      now,
      queue,
      responseMs: 160
    });

    expect(result.answeredRound.roundKey).toBe(`${contrastKey}::subject_a`);
    expect(result.nextQueue.seenRoundKeys).toEqual([`${contrastKey}::subject_a`]);
    expect(result.nextQueue.seenPairKeys).toEqual([contrastKey]);
    expect(result.nextRound?.pairKey).toBe(contrastKey);
    expect(result.nextRound?.roundKey).toBe(`${contrastKey}::subject_b`);
    expect(result.nextRound?.origin).toEqual({
      contrastKey,
      direction: "subject_b",
      type: "manual-contrast"
    });
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

async function seedManualFrontierFixture(database: DatabaseClient) {
  const now = "2026-04-08T12:00:00.000Z";

  await database.insert(media).values({
    baseExplanationLanguage: "it",
    createdAt: now,
    description: "Zeta media",
    id: "media-zeta",
    language: "ja",
    mediaType: "anime",
    segmentKind: "episode",
    slug: "zeta",
    status: "active",
    title: "Zeta",
    updatedAt: now
  });
  await database.insert(segment).values({
    id: "segment-zeta",
    mediaId: "media-zeta",
    notes: null,
    orderIndex: 1,
    segmentType: "episode",
    slug: "segment-zeta",
    title: "Segment zeta"
  });
  await database.insert(lesson).values({
    createdAt: now,
    difficulty: "beginner",
    id: "lesson-zeta",
    mediaId: "media-zeta",
    orderIndex: 1,
    segmentId: "segment-zeta",
    slug: "lesson-zeta",
    sourceFile: "tests/lesson-zeta.md",
    status: "active",
    summary: "Lesson zeta",
    title: "Lesson zeta",
    updatedAt: now
  });
  await database.insert(lessonProgress).values({
    completedAt: now,
    lastOpenedAt: now,
    lessonId: "lesson-zeta",
    startedAt: now,
    status: "completed"
  });

  const termRows = Array.from({ length: 18 }, (_, index) => {
    const suffix = String(index).padStart(2, "0");
    const id = `term-zeta-${suffix}`;
    const label = `風${suffix}`;

    return {
      createdAt: now,
      crossMediaGroupId: null,
      id,
      lemma: label,
      meaningIt: `significato ${suffix}`,
      mediaId: "media-zeta",
      reading: `かぜ${suffix}`,
      romaji: `kaze${suffix}`,
      searchLemmaNorm: label,
      searchReadingNorm: `かぜ${suffix}`,
      searchRomajiNorm: `kaze${suffix}`,
      segmentId: "segment-zeta",
      sourceId: id,
      updatedAt: now
    };
  });

  await database.insert(term).values(termRows);
  const cardRows: (typeof card.$inferInsert)[] = termRows.map((row, index) => {
    const cardId = `card-${row.id}`;

    return {
      back: `${row.lemma} meaning`,
      cardType: "recognition" as const,
      createdAt: now,
      front: row.lemma,
      id: cardId,
      lessonId: "lesson-zeta",
      mediaId: "media-zeta",
      normalizedFront: row.lemma,
      orderIndex: index + 1,
      segmentId: "segment-zeta",
      sourceFile: `tests/${cardId}.md`,
      status: "active" as const,
      updatedAt: now
    };
  });

  await database.insert(card).values(cardRows);
  await database.insert(cardEntryLink).values(
    termRows.map((row) => ({
      cardId: `card-${row.id}`,
      entryId: row.id,
      entryType: "term" as const,
      id: `card-${row.id}-${row.id}`,
      relationshipType: "primary" as const
    }))
  );
  await database.insert(reviewSubjectState).values(
    termRows.map((row, index) => ({
      cardId: `card-${row.id}`,
      createdAt: now,
      crossMediaGroupId: null,
      difficulty: 2.5,
      dueAt: now,
      entryId: row.id,
      entryType: "term" as const,
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 3 + (index % 2),
      scheduledDays: 3,
      stability: 8 + index * 0.1,
      state: "review" as const,
      subjectKey: `entry:term:${row.id}`,
      subjectType: "entry" as const,
      suspended: false,
      updatedAt: now
    }))
  );
}

async function seedManualIncrementalExpansionFixture(database: DatabaseClient) {
  const now = "2026-04-08T12:00:00.000Z";
  const mediaId = "media-manual-delta";
  const segmentId = "segment-manual-delta";
  const lessonId = "lesson-manual-delta";
  const baseTerms = [
    "食",
    "海",
    "山",
    "川",
    "空",
    "雨",
    "雪",
    "花",
    "犬",
    "猫",
    "鳥",
    "魚",
    "石",
    "火",
    "木",
    "金",
    "電気",
    "気電"
  ];

  await database.insert(media).values({
    baseExplanationLanguage: "it",
    createdAt: now,
    description: "Manual delta media",
    id: mediaId,
    language: "ja",
    mediaType: "anime",
    segmentKind: "episode",
    slug: "manual-delta",
    status: "active",
    title: "Manual delta",
    updatedAt: now
  });
  await database.insert(segment).values({
    id: segmentId,
    mediaId,
    notes: null,
    orderIndex: 1,
    segmentType: "episode",
    slug: "segment-manual-delta",
    title: "Segment manual delta"
  });
  await database.insert(lesson).values({
    createdAt: now,
    difficulty: "beginner",
    id: lessonId,
    mediaId,
    orderIndex: 1,
    segmentId,
    slug: "lesson-manual-delta",
    sourceFile: "tests/lesson-manual-delta.md",
    status: "active",
    summary: "Lesson manual delta",
    title: "Lesson manual delta",
    updatedAt: now
  });
  await database.insert(lessonProgress).values({
    completedAt: now,
    lastOpenedAt: now,
    lessonId,
    startedAt: now,
    status: "completed"
  });

  const termRows = baseTerms.map((lemma, index) => {
    const suffix = String(index).padStart(2, "0");
    const id = `term-manual-delta-${suffix}`;

    return {
      createdAt: now,
      crossMediaGroupId: null,
      id,
      lemma,
      meaningIt: `significato manual delta ${suffix}`,
      mediaId,
      reading: `reading-manual-delta-${suffix}`,
      romaji: `romaji-manual-delta-${suffix}`,
      searchLemmaNorm: lemma,
      searchReadingNorm: `reading-manual-delta-${suffix}`,
      searchRomajiNorm: `romaji-manual-delta-${suffix}`,
      segmentId,
      sourceId: id,
      updatedAt: now
    };
  });

  await database.insert(term).values(termRows);
  await database.insert(card).values(
    termRows.map((row, index) => ({
      back: `${row.lemma} meaning`,
      cardType: "recognition" as const,
      createdAt: now,
      front: row.lemma,
      id: `card-${row.id}`,
      lessonId,
      mediaId,
      normalizedFront: row.lemma,
      orderIndex: index + 1,
      segmentId,
      sourceFile: `tests/card-${row.id}.md`,
      status: "active" as const,
      updatedAt: now
    }))
  );
  await database.insert(cardEntryLink).values(
    termRows.map((row) => ({
      cardId: `card-${row.id}`,
      entryId: row.id,
      entryType: "term" as const,
      id: `card-${row.id}-${row.id}`,
      relationshipType: "primary" as const
    }))
  );
  await database.insert(reviewSubjectState).values(
    termRows.map((row) => ({
      cardId: `card-${row.id}`,
      createdAt: now,
      crossMediaGroupId: null,
      difficulty: 2.5,
      dueAt: now,
      entryId: row.id,
      entryType: "term" as const,
      lapses: 0,
      lastInteractionAt: now,
      lastReviewedAt: now,
      learningSteps: 0,
      manualOverride: false,
      reps: 3,
      scheduledDays: 3,
      stability: 8,
      state: "review" as const,
      subjectKey: `entry:term:${row.id}`,
      subjectType: "entry" as const,
      suspended: false,
      updatedAt: now
    }))
  );
}
