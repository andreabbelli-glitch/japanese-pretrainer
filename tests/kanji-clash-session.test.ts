import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  card,
  cardEntryLink,
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
});

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
