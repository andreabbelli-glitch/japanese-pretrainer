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
  completeKatakanaSpeedSession,
  getKatakanaSpeedPageData,
  getKatakanaSpeedRecapPageData,
  getKatakanaSpeedSessionPageData,
  startKatakanaSpeedSession,
  submitKatakanaSpeedAnswer
} from "@/features/katakana-speed/server";
import {
  katakanaAttemptLog,
  katakanaItemState,
  katakanaSession,
  katakanaTrial
} from "@/db/schema";

describe("katakana speed session persistence", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-katakana-speed-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("starts a session by persisting the session and planned trials", async () => {
    const result = await startKatakanaSpeedSession({
      count: 5,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "persist-plan"
    });

    const session = await database.query.katakanaSession.findFirst({
      where: eq(katakanaSession.id, result.sessionId)
    });
    const trials = await database.query.katakanaTrial.findMany({
      where: eq(katakanaTrial.sessionId, result.sessionId)
    });

    expect(session).toMatchObject({
      id: result.sessionId,
      status: "active",
      startedAt: "2026-04-25T08:00:00.000Z",
      totalAttempts: 0
    });
    expect(trials).toHaveLength(5);
    expect(trials[0]).toMatchObject({
      status: "planned",
      trialId: result.trials[0]?.trialId
    });
    expect(JSON.parse(trials[0]?.optionItemIdsJson ?? "[]")).toContain(
      trials[0]?.correctItemId
    );
    expect(
      trials
        .sort((left, right) => left.trialId.localeCompare(right.trialId))
        .map((trial) => trial.sortOrder)
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it("loads resumed sessions in persisted sort order instead of parsing trial ids", async () => {
    await database.insert(katakanaSession).values({
      createdAt: "2026-04-25T08:00:00.000Z",
      id: "manual-sort-session",
      startedAt: "2026-04-25T08:00:00.000Z",
      status: "active",
      updatedAt: "2026-04-25T08:00:00.000Z"
    });
    await database.insert(katakanaTrial).values([
      {
        correctItemId: "word-security",
        itemId: "word-security",
        mode: "word_naming",
        optionItemIdsJson: JSON.stringify(["word-security"]),
        promptSurface: "セキュリティ",
        sessionId: "manual-sort-session",
        sortOrder: 20,
        status: "planned",
        targetRtMs: 1600,
        trialId: "manual-word-later"
      },
      {
        correctItemId: "pseudo-ti-rado",
        itemId: "pseudo-ti-rado",
        mode: "pseudoword_sprint",
        optionItemIdsJson: JSON.stringify(["pseudo-ti-rado"]),
        promptSurface: "ティラード",
        sessionId: "manual-sort-session",
        sortOrder: 10,
        status: "planned",
        targetRtMs: 1400,
        trialId: "manual-pseudo-first"
      }
    ]);

    const data = await getKatakanaSpeedSessionPageData({
      database,
      sessionId: "manual-sort-session"
    });

    expect(data?.trials.map((trial) => trial.trialId)).toEqual([
      "manual-pseudo-first",
      "manual-word-later"
    ]);
  });

  it("submits an answer once, updates item state, and rolls up session counters", async () => {
    const session = await startKatakanaSpeedSession({
      count: 3,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "correct-submit"
    });
    const trial = session.trials[0];
    expect(trial).toBeDefined();

    await submitKatakanaSpeedAnswer({
      database,
      inputMethod: "keyboard",
      now: new Date("2026-04-25T08:00:00.420Z"),
      responseMs: 420,
      sessionId: session.sessionId,
      trialId: trial.trialId,
      userAnswer: trial.promptSurface
    });

    const attempts = await database.query.katakanaAttemptLog.findMany({
      where: eq(katakanaAttemptLog.trialId, trial.trialId)
    });
    const itemState = await database.query.katakanaItemState.findFirst({
      where: eq(katakanaItemState.itemId, trial.itemId)
    });
    const persistedSession = await database.query.katakanaSession.findFirst({
      where: eq(katakanaSession.id, session.sessionId)
    });
    const persistedTrial = await database.query.katakanaTrial.findFirst({
      where: eq(katakanaTrial.trialId, trial.trialId)
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      expectedAnswer: trial.promptSurface,
      isCorrect: 1,
      responseMs: 420
    });
    expect(itemState).toMatchObject({
      correctCount: 1,
      correctStreak: 1,
      itemId: trial.itemId,
      reps: 1,
      seenCount: 1,
      status: "learning",
      wrongCount: 0
    });
    expect(persistedSession).toMatchObject({
      correctAttempts: 1,
      medianRtMs: 420,
      p90RtMs: 420,
      totalAttempts: 1
    });
    expect(persistedTrial).toMatchObject({
      answeredAt: "2026-04-25T08:00:00.420Z",
      status: "answered"
    });
  });

  it("keeps duplicate submit for one trial idempotent", async () => {
    const session = await startKatakanaSpeedSession({
      count: 2,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "duplicate-submit"
    });
    const trial = session.trials[0];
    expect(trial).toBeDefined();

    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:00.300Z"),
      responseMs: 300,
      sessionId: session.sessionId,
      trialId: trial.trialId,
      userAnswer: trial.promptSurface
    });
    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:00.900Z"),
      responseMs: 900,
      sessionId: session.sessionId,
      trialId: trial.trialId,
      userAnswer: "wrong"
    });

    const attempts = await database.query.katakanaAttemptLog.findMany({
      where: eq(katakanaAttemptLog.trialId, trial.trialId)
    });
    const itemState = await database.query.katakanaItemState.findFirst({
      where: eq(katakanaItemState.itemId, trial.itemId)
    });
    const persistedSession = await database.query.katakanaSession.findFirst({
      where: eq(katakanaSession.id, session.sessionId)
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.responseMs).toBe(300);
    expect(itemState?.reps).toBe(1);
    expect(persistedSession?.totalAttempts).toBe(1);
  });

  it("rejects duplicate trial submits for the wrong session id", async () => {
    const firstSession = await startKatakanaSpeedSession({
      count: 1,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "scoped-submit-a"
    });
    const secondSession = await startKatakanaSpeedSession({
      count: 1,
      database,
      now: new Date("2026-04-25T08:01:00.000Z"),
      seed: "scoped-submit-b"
    });
    const trial = firstSession.trials[0];
    expect(trial).toBeDefined();

    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:00.300Z"),
      responseMs: 300,
      sessionId: firstSession.sessionId,
      trialId: trial.trialId,
      userAnswer: trial.promptSurface
    });

    await expect(
      submitKatakanaSpeedAnswer({
        database,
        now: new Date("2026-04-25T08:02:00.000Z"),
        responseMs: 300,
        sessionId: secondSession.sessionId,
        trialId: trial.trialId,
        userAnswer: trial.promptSurface
      })
    ).rejects.toThrow("trial was not found");
  });

  it("rejects answers for completed sessions and skipped trials", async () => {
    const completedSession = await startKatakanaSpeedSession({
      count: 1,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "completed-submit"
    });
    await completeKatakanaSpeedSession({
      database,
      now: new Date("2026-04-25T08:01:00.000Z"),
      sessionId: completedSession.sessionId
    });

    await expect(
      submitKatakanaSpeedAnswer({
        database,
        now: new Date("2026-04-25T08:02:00.000Z"),
        responseMs: 300,
        sessionId: completedSession.sessionId,
        trialId: completedSession.trials[0]?.trialId ?? "",
        userAnswer: completedSession.trials[0]?.promptSurface ?? ""
      })
    ).rejects.toThrow("session is not active");

    const skippedSession = await startKatakanaSpeedSession({
      count: 1,
      database,
      now: new Date("2026-04-25T09:00:00.000Z"),
      seed: "skipped-submit"
    });
    const skippedTrial = skippedSession.trials[0];
    expect(skippedTrial).toBeDefined();
    await database
      .update(katakanaTrial)
      .set({
        status: "skipped"
      })
      .where(eq(katakanaTrial.trialId, skippedTrial.trialId));

    await expect(
      submitKatakanaSpeedAnswer({
        database,
        now: new Date("2026-04-25T09:01:00.000Z"),
        responseMs: 300,
        sessionId: skippedSession.sessionId,
        trialId: skippedTrial.trialId,
        userAnswer: skippedTrial.promptSurface
      })
    ).rejects.toThrow("trial is not answerable");
  });

  it("does not promote slow correct attempts to mastery", async () => {
    const session = await startKatakanaSpeedSession({
      count: 1,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "slow-correct"
    });
    const trial = session.trials[0];
    expect(trial).toBeDefined();

    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:02.000Z"),
      responseMs: trial.targetRtMs + 500,
      sessionId: session.sessionId,
      trialId: trial.trialId,
      userAnswer: trial.promptSurface
    });

    const itemState = await database.query.katakanaItemState.findFirst({
      where: eq(katakanaItemState.itemId, trial.itemId)
    });
    const persistedSession = await database.query.katakanaSession.findFirst({
      where: eq(katakanaSession.id, session.sessionId)
    });

    expect(itemState).toMatchObject({
      correctCount: 1,
      correctStreak: 0,
      lastCorrectAt: null,
      slowCorrectCount: 1,
      slowStreak: 1,
      status: "learning"
    });
    expect(JSON.parse(itemState?.lastErrorTagsJson ?? "[]")).toEqual([
      "slow_correct"
    ]);
    expect(persistedSession?.slowCorrectCount).toBe(1);
  });

  it("completion writes recap metrics", async () => {
    const session = await startKatakanaSpeedSession({
      count: 2,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "complete-recap"
    });

    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:00.300Z"),
      responseMs: 300,
      sessionId: session.sessionId,
      trialId: session.trials[0]?.trialId ?? "",
      userAnswer: session.trials[0]?.promptSurface ?? ""
    });
    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:01.100Z"),
      responseMs: 1100,
      sessionId: session.sessionId,
      trialId: session.trials[1]?.trialId ?? "",
      userAnswer: "ツ"
    });

    const recap = await completeKatakanaSpeedSession({
      database,
      now: new Date("2026-04-25T08:01:00.000Z"),
      sessionId: session.sessionId
    });

    const persistedSession = await database.query.katakanaSession.findFirst({
      where: eq(katakanaSession.id, session.sessionId)
    });

    expect(recap).toMatchObject({
      correctAttempts: 1,
      durationMs: 60_000,
      status: "completed",
      totalAttempts: 2
    });
    expect(persistedSession).toMatchObject({
      endedAt: "2026-04-25T08:01:00.000Z",
      medianRtMs: 700,
      p90RtMs: 1100,
      status: "completed"
    });
    expect(
      JSON.parse(persistedSession?.mainErrorTagsJson ?? "[]").length
    ).toBeGreaterThan(0);
    expect(
      JSON.parse(persistedSession?.recommendedFocusJson ?? "[]").length
    ).toBeGreaterThan(0);
  });

  it("loads advanced dashboard and recap analytics from persisted logs", async () => {
    const session = await startKatakanaSpeedSession({
      count: 2,
      database,
      now: new Date("2026-04-25T08:00:00.000Z"),
      seed: "advanced-analytics"
    });
    const firstTrial = session.trials[0];
    const secondTrial = session.trials[1];
    expect(firstTrial).toBeDefined();
    expect(secondTrial).toBeDefined();

    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:00.300Z"),
      responseMs: firstTrial.targetRtMs + 450,
      sessionId: session.sessionId,
      trialId: firstTrial.trialId,
      userAnswer: firstTrial.promptSurface
    });
    await submitKatakanaSpeedAnswer({
      database,
      now: new Date("2026-04-25T08:00:01.200Z"),
      responseMs: 1200,
      sessionId: session.sessionId,
      trialId: secondTrial.trialId,
      userAnswer: firstTrial.promptSurface
    });

    await completeKatakanaSpeedSession({
      database,
      now: new Date("2026-04-25T08:02:00.000Z"),
      sessionId: session.sessionId
    });

    const [dashboard, recap] = await Promise.all([
      getKatakanaSpeedPageData({ database }),
      getKatakanaSpeedRecapPageData({ database, sessionId: session.sessionId })
    ]);

    expect(dashboard.analytics.overview.totalAttempts).toBe(2);
    expect(dashboard.analytics.topSlowItems.length).toBeGreaterThan(0);
    expect(dashboard.analytics.familyCards.length).toBeGreaterThan(0);
    expect(dashboard.analytics.recommendedMode.mode).toMatch(
      /daily|rare_combo|pseudoword_transfer|sentence_sprint|repeated_reading|ran_grid/
    );
    expect(recap?.analytics.overview.totalAttempts).toBe(2);
    expect(recap?.analytics.topConfusions.length).toBeGreaterThan(0);
    expect(recap?.attempts[0]).toMatchObject({
      features: expect.any(Object),
      focusChunks: expect.any(Array),
      metrics: expect.any(Object)
    });
  });
});
