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
  card,
  cardEntryLink,
  grammarPattern,
  lesson,
  lessonProgress,
  media,
  preReviewConsolidationState,
  reviewSubjectLog,
  reviewSubjectState,
  term,
  userSetting
} from "@/db/schema";
import { listDueCardsByMediaId } from "@/db/queries";
import {
  enqueueLessonConsolidation,
  getConsolidationHubData,
  getConsolidationSessionData,
  getRetrainingConsolidationSessionData,
  setLessonCompletionWithConsolidation,
  getPendingConsolidationSubjectKeys,
  markConsolidationKnown,
  submitConsolidationAnswer
} from "@/lib/consolidation";
import { getGlobalReviewPageData, hydrateReviewCard } from "@/features/review/server";
import { applyReviewGrade } from "@/features/review/server/service";
import {
  buildReviewDailyLimitSetting,
  buildReviewSubjectStateRow,
  seedTwoMediaGlobalQueueFixture
} from "./helpers/review-fixture";

describe("pre-FSRS consolidation service", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-consolidation-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates pending subject-level consolidation rows for newly completed lesson cards", async () => {
    await seedConsolidationLesson(database);

    const result = await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const rows = await database.query.preReviewConsolidationState.findMany({
      orderBy: (state, { asc }) => [asc(state.subjectKey)]
    });

    expect(result.createdCount).toBe(2);
    expect(rows).toMatchObject([
      {
        lessonId: "lesson_consolidation",
        mediaId: "media_consolidation",
        representativeCardId: "card_consolidation_meaning",
        status: "pending",
        subjectKey: "entry:term:term_consolidation_meaning"
      },
      {
        lessonId: "lesson_consolidation",
        mediaId: "media_consolidation",
        representativeCardId: "card_consolidation_reading",
        status: "pending",
        subjectKey: "entry:term:term_consolidation_reading"
      }
    ]);
  });

  it("does not enqueue subjects that already have FSRS state", async () => {
    await seedConsolidationLesson(database);
    await database.insert(reviewSubjectState).values(
      buildReviewSubjectStateRow({
        cardId: "card_consolidation_reading",
        difficulty: 5,
        dueAt: "2026-04-02T10:00:00.000Z",
        entryId: "term_consolidation_reading",
        entryType: "term",
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        scheduledDays: 1,
        stability: 1,
        state: "review",
        subjectKey: "entry:term:term_consolidation_reading"
      })
    );

    const result = await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });
    const pendingKeys = await getPendingConsolidationSubjectKeys(database);

    expect(result.createdCount).toBe(1);
    expect(pendingKeys).toEqual(["entry:term:term_consolidation_meaning"]);
  });

  it("enqueues subjects that only have importer-seeded new FSRS state", async () => {
    await seedConsolidationLesson(database);
    await database.insert(reviewSubjectState).values([
      {
        cardId: "card_consolidation_reading",
        createdAt: "2026-04-01T09:00:00.000Z",
        crossMediaGroupId: null,
        difficulty: null,
        dueAt: null,
        entryId: "term_consolidation_reading",
        entryType: "term",
        lapses: 0,
        lastInteractionAt: "2026-04-01T09:00:00.000Z",
        lastReviewedAt: null,
        learningSteps: 0,
        manualOverride: false,
        reps: 0,
        scheduledDays: 0,
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "new",
        subjectKey: "entry:term:term_consolidation_reading",
        subjectType: "entry",
        suspended: false,
        updatedAt: "2026-04-01T09:00:00.000Z"
      },
      {
        cardId: "card_consolidation_meaning",
        createdAt: "2026-04-01T09:01:00.000Z",
        crossMediaGroupId: null,
        difficulty: null,
        dueAt: null,
        entryId: "term_consolidation_meaning",
        entryType: "term",
        lapses: 0,
        lastInteractionAt: "2026-04-01T09:01:00.000Z",
        lastReviewedAt: null,
        learningSteps: 0,
        manualOverride: false,
        reps: 0,
        scheduledDays: 0,
        schedulerVersion: "fsrs_v1",
        stability: null,
        state: "new",
        subjectKey: "entry:term:term_consolidation_meaning",
        subjectType: "entry",
        suspended: false,
        updatedAt: "2026-04-01T09:01:00.000Z"
      }
    ]);

    const result = await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });
    const pendingKeys = await getPendingConsolidationSubjectKeys(database);

    expect(result.createdCount).toBe(2);
    expect(pendingKeys).toEqual([
      "entry:term:term_consolidation_meaning",
      "entry:term:term_consolidation_reading"
    ]);
  });

  it("keeps pending subjects out of FSRS review until they pass consolidation", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await database.insert(preReviewConsolidationState).values({
      subjectKey: "card:card_a",
      subjectType: "card",
      representativeCardId: "card_a",
      lessonId: "lesson_a",
      mediaId: "media_a",
      status: "pending",
      attemptCount: 0,
      lastAttemptAt: null,
      completedAt: null,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:00:00.000Z"
    });

    const pendingPage = await getGlobalReviewPageData({}, database);
    const pendingHydrated = await hydrateReviewCard({
      cardId: "card_a",
      database
    });

    expect(pendingPage.selectedCard?.id).toBe("card_b");
    expect(pendingPage.queue.newAvailableCount).toBe(1);
    expect(pendingHydrated).toBeNull();

    await database
      .update(preReviewConsolidationState)
      .set({
        completedAt: "2026-04-01T10:05:00.000Z",
        status: "passed",
        updatedAt: "2026-04-01T10:05:00.000Z"
      })
      .where(eq(preReviewConsolidationState.subjectKey, "card:card_a"));

    const passedPage = await getGlobalReviewPageData({}, database);
    const passedHydrated = await hydrateReviewCard({
      cardId: "card_a",
      database
    });

    expect(passedPage.selectedCard?.id).toBe("card_a");
    expect(passedPage.queue.newAvailableCount).toBe(2);
    expect(passedHydrated?.id).toBe("card_a");
  });

  it("rejects FSRS grading for a pending consolidation subject without writing logs", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await database.insert(preReviewConsolidationState).values({
      subjectKey: "card:card_a",
      subjectType: "card",
      representativeCardId: "card_a",
      lessonId: "lesson_a",
      mediaId: "media_a",
      status: "pending",
      attemptCount: 0,
      lastAttemptAt: null,
      completedAt: null,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:00:00.000Z"
    });

    await expect(
      applyReviewGrade({
        cardId: "card_a",
        database,
        now: new Date("2026-04-01T11:00:00.000Z"),
        rating: "good"
      })
    ).rejects.toThrow("Review card is pending consolidation.");

    const [subjectState, logs] = await Promise.all([
      database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, "card:card_a")
      }),
      database.query.reviewSubjectLog.findMany()
    ]);

    expect(subjectState ?? null).toBeNull();
    expect(logs).toEqual([]);
  });

  it("queues non-blocking consolidation after a hard FSRS review grade", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const result = await applyReviewGrade({
      cardId: "card_a",
      database,
      now: new Date("2026-04-01T11:00:00.000Z"),
      rating: "hard"
    });
    const [consolidationRow, subjectState, logs, pendingKeys, hydratedCard] =
      await Promise.all([
        database.query.preReviewConsolidationState.findFirst({
          where: eq(preReviewConsolidationState.subjectKey, "card:card_a")
        }),
        database.query.reviewSubjectState.findFirst({
          where: eq(reviewSubjectState.subjectKey, "card:card_a")
        }),
        database.query.reviewSubjectLog.findMany({
          where: eq(reviewSubjectLog.subjectKey, "card:card_a")
        }),
        getPendingConsolidationSubjectKeys(database, ["card:card_a"]),
        hydrateReviewCard({
          cardId: "card_a",
          database
        })
      ]);

    expect(result.consolidationQueued).toBe(true);
    expect(consolidationRow).toMatchObject({
      attemptCount: 0,
      completedAt: null,
      lastAttemptAt: null,
      lessonId: "lesson_a",
      mediaId: "media_a",
      readingPassedAt: null,
      representativeCardId: "card_a",
      status: "retraining",
      subjectKey: "card:card_a"
    });
    expect(subjectState).toMatchObject({
      cardId: "card_a",
      reps: 1,
      subjectKey: "card:card_a"
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      cardId: "card_a",
      rating: "hard",
      subjectKey: "card:card_a"
    });
    expect(pendingKeys).toEqual([]);
    expect(hydratedCard?.id).toBe("card_a");
  });

  it("queues non-blocking consolidation after an again FSRS review grade", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const result = await applyReviewGrade({
      cardId: "card_a",
      database,
      now: new Date("2026-04-01T11:00:00.000Z"),
      rating: "again"
    });
    const consolidationRow =
      await database.query.preReviewConsolidationState.findFirst({
        where: eq(preReviewConsolidationState.subjectKey, "card:card_a")
      });

    expect(result.consolidationQueued).toBe(true);
    expect(consolidationRow).toMatchObject({
      status: "retraining",
      subjectKey: "card:card_a"
    });
  });

  it("reopens completed consolidation after a future hard FSRS review grade", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await database.insert(preReviewConsolidationState).values({
      subjectKey: "card:card_a",
      subjectType: "card",
      representativeCardId: "card_a",
      lessonId: "lesson_a",
      mediaId: "media_a",
      status: "passed",
      attemptCount: 3,
      lastAttemptAt: "2026-04-01T10:02:00.000Z",
      completedAt: "2026-04-01T10:03:00.000Z",
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:03:00.000Z"
    });

    const result = await applyReviewGrade({
      cardId: "card_a",
      database,
      now: new Date("2026-04-02T11:00:00.000Z"),
      rating: "hard"
    });
    const consolidationRow =
      await database.query.preReviewConsolidationState.findFirst({
        where: eq(preReviewConsolidationState.subjectKey, "card:card_a")
      });

    expect(result.consolidationQueued).toBe(true);
    expect(consolidationRow).toMatchObject({
      attemptCount: 0,
      completedAt: null,
      lastAttemptAt: null,
      readingPassedAt: null,
      status: "retraining",
      subjectKey: "card:card_a"
    });
  });

  it("does not queue consolidation after good or easy FSRS review grades", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const goodResult = await applyReviewGrade({
      cardId: "card_a",
      database,
      now: new Date("2026-04-01T11:00:00.000Z"),
      rating: "good"
    });
    const easyResult = await applyReviewGrade({
      cardId: "card_b",
      database,
      now: new Date("2026-04-01T11:01:00.000Z"),
      rating: "easy"
    });
    const rows = await database.query.preReviewConsolidationState.findMany();

    expect(goodResult.consolidationQueued).toBe(false);
    expect(easyResult.consolidationQueued).toBe(false);
    expect(rows).toEqual([]);
  });

  it("shows retraining consolidation in one global mixed queue without mark-known", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await applyReviewGrade({
      cardId: "card_a",
      database,
      now: new Date("2026-04-01T11:00:00.000Z"),
      rating: "hard"
    });
    await applyReviewGrade({
      cardId: "card_b",
      database,
      now: new Date("2026-04-01T11:01:00.000Z"),
      rating: "again"
    });

    const [hub, lessonSession, retrainingSession] = await Promise.all([
      getConsolidationHubData(database),
      getConsolidationSessionData({
        database,
        lessonSlug: "intro-a",
        mediaSlug: "media-a"
      }),
      getRetrainingConsolidationSessionData(database)
    ]);

    expect(hub.totalPending).toBe(2);
    expect(hub.retrainingQueue).toEqual({
      href: "/consolidation/retraining",
      pendingCount: 2,
      title: "Ripasso da review"
    });
    expect(hub.mediaGroups).toEqual([]);
    expect(lessonSession?.subjects).toEqual([]);
    expect(
      retrainingSession?.subjects.map((subject) => subject.subjectKey)
    ).toEqual(["card:card_a", "card:card_b"]);
    expect(retrainingSession?.subjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canMarkKnown: false,
          subjectKey: "card:card_a"
        }),
        expect.objectContaining({
          canMarkKnown: false,
          subjectKey: "card:card_b"
        })
      ])
    );
    expect(retrainingSession?.lesson.title).toBe("Ripasso da review");
    expect(retrainingSession?.media.title).toBe("Consolidamento FSRS");
    expect(retrainingSession?.subjects[0]?.steps[0]?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "A back" }),
        expect.objectContaining({ label: "B back" })
      ])
    );
  });

  it("rejects marking retraining consolidation known without changing FSRS history", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await applyReviewGrade({
      cardId: "card_a",
      database,
      now: new Date("2026-04-01T11:00:00.000Z"),
      rating: "hard"
    });
    const beforeState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "card:card_a")
    });
    const beforeLogs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, "card:card_a")
    });

    await expect(
      markConsolidationKnown({
        database,
        now: new Date("2026-04-01T11:05:00.000Z"),
        subjectKey: "card:card_a"
      })
    ).rejects.toThrow("Retraining consolidation cannot mark FSRS cards known.");

    const afterState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "card:card_a")
    });
    const afterLogs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, "card:card_a")
    });

    expect(afterState).toEqual(beforeState);
    expect(afterLogs).toEqual(beforeLogs);
  });

  it("excludes pending consolidation subjects from legacy due-card queries", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await database.insert(reviewSubjectState).values(
      buildReviewSubjectStateRow({
        cardId: "card_a",
        difficulty: 5,
        dueAt: "2026-03-31T10:00:00.000Z",
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        scheduledDays: 1,
        stability: 1,
        state: "review",
        subjectKey: "card:card_a"
      })
    );
    await database.insert(preReviewConsolidationState).values({
      subjectKey: "card:card_a",
      subjectType: "card",
      representativeCardId: "card_a",
      lessonId: "lesson_a",
      mediaId: "media_a",
      status: "pending",
      attemptCount: 0,
      lastAttemptAt: null,
      completedAt: null,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:00:00.000Z"
    });

    const dueCards = await listDueCardsByMediaId(
      database,
      "media_a",
      "2026-04-01T12:00:00.000Z"
    );

    expect(dueCards).toEqual([]);
  });

  it("keeps retraining consolidation subjects in legacy due-card queries", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await database.insert(reviewSubjectState).values(
      buildReviewSubjectStateRow({
        cardId: "card_a",
        difficulty: 5,
        dueAt: "2026-03-31T10:00:00.000Z",
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        scheduledDays: 1,
        stability: 1,
        state: "review",
        subjectKey: "card:card_a"
      })
    );
    await database.insert(preReviewConsolidationState).values({
      subjectKey: "card:card_a",
      subjectType: "card",
      representativeCardId: "card_a",
      lessonId: "lesson_a",
      mediaId: "media_a",
      status: "retraining",
      attemptCount: 0,
      lastAttemptAt: null,
      completedAt: null,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:00:00.000Z"
    });

    const dueCards = await listDueCardsByMediaId(
      database,
      "media_a",
      "2026-04-01T12:00:00.000Z"
    );

    expect(dueCards.map((dueCard) => dueCard.id)).toEqual(["card_a"]);
  });

  it("completes a lesson and enqueues consolidation in a single transaction", async () => {
    await seedConsolidationLesson(database, {
      progressStatus: "not_started"
    });

    const result = await setLessonCompletionWithConsolidation({
      completed: true,
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });
    const [progress, pendingRows] = await Promise.all([
      database.query.lessonProgress.findFirst({
        where: eq(lessonProgress.lessonId, "lesson_consolidation")
      }),
      database.query.preReviewConsolidationState.findMany()
    ]);

    expect(result.completedNow).toBe(true);
    expect(result.consolidation.createdCount).toBe(2);
    expect(progress?.status).toBe("completed");
    expect(pendingRows).toHaveLength(2);
  });

  it("does not enqueue consolidation when a completed lesson is marked completed again", async () => {
    await seedConsolidationLesson(database);

    const result = await setLessonCompletionWithConsolidation({
      completed: true,
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    expect(result.completedNow).toBe(false);
    expect(result.consolidation.createdCount).toBe(0);
    await expect(getPendingConsolidationSubjectKeys(database)).resolves.toEqual(
      []
    );
  });

  it("groups the pending consolidation backlog by media and lesson", async () => {
    await seedConsolidationLesson(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const hub = await getConsolidationHubData(database);

    expect(hub.totalPending).toBe(2);
    expect(hub.mediaGroups).toEqual([
      {
        mediaId: "media_consolidation",
        mediaSlug: "media-consolidation",
        mediaTitle: "Media Consolidation",
        pendingCount: 2,
        lessons: [
          {
            href: "/consolidation/media/media-consolidation/lesson/consolidation-intro",
            lessonId: "lesson_consolidation",
            lessonSlug: "consolidation-intro",
            lessonTitle: "Consolidation Intro",
            pendingCount: 2
          }
        ]
      }
    ]);
  });

  it("builds lesson-scoped prompts with current-lesson choices first and same-media fallback choices", async () => {
    await seedConsolidationLesson(database);
    await seedSameMediaDistractors(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const session = await getConsolidationSessionData({
      database,
      lessonSlug: "consolidation-intro",
      mediaSlug: "media-consolidation"
    });
    const readingSubject = session?.subjects.find(
      (subject) =>
        subject.subjectKey === "entry:term:term_consolidation_reading"
    );
    const readingStep = readingSubject?.steps.find(
      (step) => step.step === "reading"
    );
    const meaningStep = readingSubject?.steps.find(
      (step) => step.step === "meaning"
    );

    expect(session?.media.slug).toBe("media-consolidation");
    expect(session?.lesson.slug).toBe("consolidation-intro");
    expect(session?.subjects.map((subject) => subject.subjectKey)).toEqual([
      "entry:term:term_consolidation_reading",
      "entry:term:term_consolidation_meaning"
    ]);
    expect(readingStep?.answerLabel).toBe("よむ");
    expect(readingStep?.options).toHaveLength(4);
    expect(readingStep?.options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["よむ", "かく", "みる", "きく"])
    );
    expect(meaningStep?.answerLabel).toBe("leggere");
    expect(meaningStep?.options.map((option) => option.label)).toEqual(
      expect.arrayContaining(["leggere", "scrivere", "vedere", "ascoltare"])
    );
  });

  it("includes pronunciation audio on consolidation subjects when the linked entry has audio", async () => {
    await seedConsolidationLesson(database);
    await database
      .update(term)
      .set({
        audioSource: "forvo",
        audioSpeaker: "Native Speaker",
        audioSrc: "assets/audio/term/term-yomu/yomu.mp3"
      })
      .where(eq(term.id, "term_consolidation_reading"));
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const session = await getConsolidationSessionData({
      database,
      lessonSlug: "consolidation-intro",
      mediaSlug: "media-consolidation"
    });
    const subject = session?.subjects.find(
      (item) => item.subjectKey === "entry:term:term_consolidation_reading"
    );

    expect(subject?.pronunciation).toMatchObject({
      label: "Native Speaker · forvo",
      source: "forvo",
      speaker: "Native Speaker",
      src: "/media/media-consolidation/assets/audio/term/term-yomu/yomu.mp3"
    });
  });

  it("keeps current-lesson pending distractors before same-media fallback choices", async () => {
    await seedConsolidationLesson(database);
    await seedManySameMediaDistractors(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const session = await getConsolidationSessionData({
      database,
      lessonSlug: "consolidation-intro",
      mediaSlug: "media-consolidation"
    });
    const readingSubject = session?.subjects.find(
      (subject) =>
        subject.subjectKey === "entry:term:term_consolidation_reading"
    );
    const meaningOptions =
      readingSubject?.steps.find((step) => step.step === "meaning")?.options ??
      [];

    expect(meaningOptions.map((option) => option.label)).toContain("scrivere");
  });

  it("skips the reading step when the reading does not add retrieval value", async () => {
    await seedConsolidationLesson(database);
    await seedKanaOnlyPendingCard(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const session = await getConsolidationSessionData({
      database,
      lessonSlug: "consolidation-intro",
      mediaSlug: "media-consolidation"
    });
    const kanaOnlySubject = session?.subjects.find(
      (subject) => subject.subjectKey === "entry:term:term_consolidation_kana"
    );

    expect(kanaOnlySubject?.steps.map((step) => step.step)).toEqual([
      "meaning"
    ]);
  });

  it("keeps wrong answers pending, increments the attempt, and returns a deterministic reinsertion index", async () => {
    await seedConsolidationLesson(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const firstResult = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:02:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_meaning",
      step: "reading",
      subjectKey: "entry:term:term_consolidation_reading"
    });
    const firstRow = await database.query.preReviewConsolidationState.findFirst(
      {
        where: eq(
          preReviewConsolidationState.subjectKey,
          "entry:term:term_consolidation_reading"
        )
      }
    );

    await database
      .update(preReviewConsolidationState)
      .set({
        attemptCount: 0,
        lastAttemptAt: null,
        updatedAt: "2026-04-01T10:00:00.000Z"
      })
      .where(
        eq(
          preReviewConsolidationState.subjectKey,
          "entry:term:term_consolidation_reading"
        )
      );

    const secondResult = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:02:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_meaning",
      step: "reading",
      subjectKey: "entry:term:term_consolidation_reading"
    });

    expect(firstResult).toMatchObject({
      attemptCount: 1,
      completed: false,
      correct: false,
      nextStep: "reading",
      status: "pending"
    });
    expect(firstRow).toMatchObject({
      attemptCount: 1,
      completedAt: null,
      lastAttemptAt: "2026-04-01T10:02:00.000Z",
      status: "pending"
    });
    expect(secondResult.reinsertionIndex).toBe(firstResult.reinsertionIndex);
  });

  it("returns the meaning step after a wrong answer for subjects without a reading step", async () => {
    await seedConsolidationLesson(database);
    await seedKanaOnlyPendingCard(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const result = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:02:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_reading",
      step: "meaning",
      subjectKey: "entry:term:term_consolidation_kana"
    });

    expect(result).toMatchObject({
      completed: false,
      correct: false,
      nextStep: "meaning",
      status: "pending"
    });
  });

  it("keeps retraining status in answer results until the subject passes", async () => {
    await seedConsolidationLesson(database);
    await database.insert(preReviewConsolidationState).values({
      subjectKey: "entry:term:term_consolidation_reading",
      subjectType: "entry",
      representativeCardId: "card_consolidation_reading",
      lessonId: "lesson_consolidation",
      mediaId: "media_consolidation",
      entryType: "term",
      entryId: "term_consolidation_reading",
      status: "retraining",
      attemptCount: 0,
      lastAttemptAt: null,
      completedAt: null,
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:00:00.000Z"
    });

    const wrongResult = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:02:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_meaning",
      step: "reading",
      subjectKey: "entry:term:term_consolidation_reading"
    });
    const readingResult = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:03:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_reading",
      step: "reading",
      subjectKey: "entry:term:term_consolidation_reading"
    });
    const row = await database.query.preReviewConsolidationState.findFirst({
      where: eq(
        preReviewConsolidationState.subjectKey,
        "entry:term:term_consolidation_reading"
      )
    });

    expect(wrongResult).toMatchObject({
      completed: false,
      correct: false,
      nextStep: "reading",
      status: "retraining"
    });
    expect(readingResult).toMatchObject({
      completed: false,
      correct: true,
      nextStep: "meaning",
      status: "retraining"
    });
    expect(row).toMatchObject({
      readingPassedAt: "2026-04-01T10:03:00.000Z",
      status: "retraining"
    });
  });

  it("requires the reading step before passing a subject that has reading retrieval", async () => {
    await seedConsolidationLesson(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    await expect(
      submitConsolidationAnswer({
        database,
        now: new Date("2026-04-01T10:03:00.000Z"),
        selectedSubjectKey: "entry:term:term_consolidation_reading",
        step: "meaning",
        subjectKey: "entry:term:term_consolidation_reading"
      })
    ).rejects.toThrow("Reading step must be completed before meaning.");

    const readingResult = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:03:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_reading",
      step: "reading",
      subjectKey: "entry:term:term_consolidation_reading"
    });
    const meaningResult = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:04:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_reading",
      step: "meaning",
      subjectKey: "entry:term:term_consolidation_reading"
    });
    const completedRow =
      await database.query.preReviewConsolidationState.findFirst({
        where: eq(
          preReviewConsolidationState.subjectKey,
          "entry:term:term_consolidation_reading"
        )
      });

    expect(readingResult).toMatchObject({
      completed: false,
      correct: true,
      nextStep: "meaning"
    });
    expect(meaningResult).toMatchObject({
      completed: true,
      correct: true,
      attemptCount: 1,
      status: "passed"
    });
    expect(completedRow).toMatchObject({
      attemptCount: 1,
      completedAt: "2026-04-01T10:04:00.000Z",
      lastAttemptAt: "2026-04-01T10:04:00.000Z",
      status: "passed"
    });
  });

  it("marks a meaning-only subject passed after the correct meaning answer", async () => {
    await seedConsolidationLesson(database);
    await seedKanaOnlyPendingCard(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const result = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:03:00.000Z"),
      selectedSubjectKey: "entry:term:term_consolidation_kana",
      step: "meaning",
      subjectKey: "entry:term:term_consolidation_kana"
    });
    const row = await database.query.preReviewConsolidationState.findFirst({
      where: eq(
        preReviewConsolidationState.subjectKey,
        "entry:term:term_consolidation_kana"
      )
    });

    expect(result).toMatchObject({
      completed: true,
      correct: true,
      attemptCount: 1,
      status: "passed"
    });
    expect(row).toMatchObject({
      attemptCount: 1,
      completedAt: "2026-04-01T10:03:00.000Z",
      lastAttemptAt: "2026-04-01T10:03:00.000Z",
      status: "passed"
    });
  });

  it("lets a grammar card without structured reading pass as meaning-only even when the front has furigana", async () => {
    await seedConsolidationLesson(database);
    await seedGrammarWithoutReadingPendingCard(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const session = await getConsolidationSessionData({
      database,
      lessonSlug: "consolidation-intro",
      mediaSlug: "media-consolidation"
    });
    const grammarSubject = session?.subjects.find(
      (subject) =>
        subject.subjectKey === "entry:grammar:grammar_consolidation_before"
    );
    const result = await submitConsolidationAnswer({
      database,
      now: new Date("2026-04-01T10:03:00.000Z"),
      selectedSubjectKey: "entry:grammar:grammar_consolidation_before",
      step: "meaning",
      subjectKey: "entry:grammar:grammar_consolidation_before"
    });

    expect(grammarSubject?.steps.map((step) => step.step)).toEqual(["meaning"]);
    expect(result).toMatchObject({
      attemptCount: 1,
      completed: true,
      correct: true,
      status: "passed"
    });
  });

  it("marks a pending subject known manually without writing FSRS logs", async () => {
    await seedConsolidationLesson(database);
    await enqueueLessonConsolidation({
      database,
      lessonId: "lesson_consolidation",
      now: new Date("2026-04-01T10:00:00.000Z")
    });

    const result = await markConsolidationKnown({
      database,
      now: new Date("2026-04-01T10:04:00.000Z"),
      subjectKey: "entry:term:term_consolidation_reading"
    });
    const [consolidationRow, subjectState, logs] = await Promise.all([
      database.query.preReviewConsolidationState.findFirst({
        where: eq(
          preReviewConsolidationState.subjectKey,
          "entry:term:term_consolidation_reading"
        )
      }),
      database.query.reviewSubjectState.findFirst({
        where: eq(
          reviewSubjectState.subjectKey,
          "entry:term:term_consolidation_reading"
        )
      }),
      database.query.reviewSubjectLog.findMany({
        where: eq(
          reviewSubjectLog.subjectKey,
          "entry:term:term_consolidation_reading"
        )
      })
    ]);

    expect(result).toMatchObject({
      completed: true,
      status: "known_manual"
    });
    expect(consolidationRow).toMatchObject({
      completedAt: "2026-04-01T10:04:00.000Z",
      status: "known_manual"
    });
    expect(subjectState).toMatchObject({
      cardId: "card_consolidation_reading",
      manualOverride: true,
      state: "known_manual",
      subjectKey: "entry:term:term_consolidation_reading"
    });
    expect(logs).toEqual([]);
  });
});

async function seedConsolidationLesson(
  database: DatabaseClient,
  options: {
    progressStatus?: "completed" | "not_started";
  } = {}
) {
  const progressStatus = options.progressStatus ?? "completed";

  await database.insert(media).values({
    id: "media_consolidation",
    slug: "media-consolidation",
    title: "Media Consolidation",
    mediaType: "game",
    segmentKind: "chapter",
    language: "ja",
    baseExplanationLanguage: "it",
    description: "Consolidation fixture",
    status: "active",
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z"
  });
  await database.insert(lesson).values({
    id: "lesson_consolidation",
    mediaId: "media_consolidation",
    segmentId: null,
    slug: "consolidation-intro",
    title: "Consolidation Intro",
    orderIndex: 1,
    difficulty: "beginner",
    summary: "Consolidation lesson",
    status: "active",
    sourceFile: "tests/consolidation/lesson.md",
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z"
  });
  await database.insert(lessonProgress).values({
    lessonId: "lesson_consolidation",
    status: progressStatus,
    startedAt:
      progressStatus === "completed" ? "2026-04-01T09:00:00.000Z" : null,
    completedAt:
      progressStatus === "completed" ? "2026-04-01T09:30:00.000Z" : null,
    lastOpenedAt:
      progressStatus === "completed" ? "2026-04-01T09:30:00.000Z" : null
  });
  await database.insert(userSetting).values(buildReviewDailyLimitSetting());
  await database.insert(term).values([
    {
      id: "term_consolidation_reading",
      sourceId: "consolidation-reading",
      mediaId: "media_consolidation",
      segmentId: null,
      lemma: "読む",
      reading: "よむ",
      romaji: "yomu",
      meaningIt: "leggere",
      searchLemmaNorm: "読む",
      searchReadingNorm: "よむ",
      searchRomajiNorm: "yomu",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z"
    },
    {
      id: "term_consolidation_meaning",
      sourceId: "consolidation-meaning",
      mediaId: "media_consolidation",
      segmentId: null,
      lemma: "書く",
      reading: "かく",
      romaji: "kaku",
      meaningIt: "scrivere",
      searchLemmaNorm: "書く",
      searchReadingNorm: "かく",
      searchRomajiNorm: "kaku",
      createdAt: "2026-04-01T09:01:00.000Z",
      updatedAt: "2026-04-01T09:01:00.000Z"
    }
  ]);
  await database.insert(card).values([
    {
      id: "card_consolidation_reading",
      mediaId: "media_consolidation",
      lessonId: "lesson_consolidation",
      segmentId: null,
      sourceFile: "tests/consolidation/cards.md",
      cardType: "recognition",
      front: "{{読|よ}}む",
      back: "leggere",
      status: "active",
      orderIndex: 1,
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z"
    },
    {
      id: "card_consolidation_meaning",
      mediaId: "media_consolidation",
      lessonId: "lesson_consolidation",
      segmentId: null,
      sourceFile: "tests/consolidation/cards.md",
      cardType: "recognition",
      front: "{{書|か}}く",
      back: "scrivere",
      status: "active",
      orderIndex: 2,
      createdAt: "2026-04-01T09:01:00.000Z",
      updatedAt: "2026-04-01T09:01:00.000Z"
    }
  ]);
  await database.insert(cardEntryLink).values([
    {
      id: "card_consolidation_reading_link",
      cardId: "card_consolidation_reading",
      entryType: "term",
      entryId: "term_consolidation_reading",
      relationshipType: "primary"
    },
    {
      id: "card_consolidation_meaning_link",
      cardId: "card_consolidation_meaning",
      entryType: "term",
      entryId: "term_consolidation_meaning",
      relationshipType: "primary"
    }
  ]);
}

async function seedSameMediaDistractors(database: DatabaseClient) {
  await database.insert(term).values([
    {
      id: "term_consolidation_see",
      sourceId: "consolidation-see",
      mediaId: "media_consolidation",
      segmentId: null,
      lemma: "見る",
      reading: "みる",
      romaji: "miru",
      meaningIt: "vedere",
      searchLemmaNorm: "見る",
      searchReadingNorm: "みる",
      searchRomajiNorm: "miru",
      createdAt: "2026-04-01T09:02:00.000Z",
      updatedAt: "2026-04-01T09:02:00.000Z"
    },
    {
      id: "term_consolidation_listen",
      sourceId: "consolidation-listen",
      mediaId: "media_consolidation",
      segmentId: null,
      lemma: "聞く",
      reading: "きく",
      romaji: "kiku",
      meaningIt: "ascoltare",
      searchLemmaNorm: "聞く",
      searchReadingNorm: "きく",
      searchRomajiNorm: "kiku",
      createdAt: "2026-04-01T09:03:00.000Z",
      updatedAt: "2026-04-01T09:03:00.000Z"
    }
  ]);
  await database.insert(card).values([
    {
      id: "card_consolidation_see",
      mediaId: "media_consolidation",
      lessonId: null,
      segmentId: null,
      sourceFile: "tests/consolidation/cards.md",
      cardType: "recognition",
      front: "{{見|み}}る",
      back: "vedere",
      status: "active",
      orderIndex: 3,
      createdAt: "2026-04-01T09:02:00.000Z",
      updatedAt: "2026-04-01T09:02:00.000Z"
    },
    {
      id: "card_consolidation_listen",
      mediaId: "media_consolidation",
      lessonId: null,
      segmentId: null,
      sourceFile: "tests/consolidation/cards.md",
      cardType: "recognition",
      front: "{{聞|き}}く",
      back: "ascoltare",
      status: "active",
      orderIndex: 4,
      createdAt: "2026-04-01T09:03:00.000Z",
      updatedAt: "2026-04-01T09:03:00.000Z"
    }
  ]);
  await database.insert(cardEntryLink).values([
    {
      id: "card_consolidation_see_link",
      cardId: "card_consolidation_see",
      entryType: "term",
      entryId: "term_consolidation_see",
      relationshipType: "primary"
    },
    {
      id: "card_consolidation_listen_link",
      cardId: "card_consolidation_listen",
      entryType: "term",
      entryId: "term_consolidation_listen",
      relationshipType: "primary"
    }
  ]);
}

async function seedManySameMediaDistractors(database: DatabaseClient) {
  const rows = Array.from({ length: 12 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");

    return {
      id: `term_consolidation_distractor_${suffix}`,
      sourceId: `consolidation-distractor-${suffix}`,
      mediaId: "media_consolidation",
      segmentId: null,
      lemma: `語彙${suffix}`,
      reading: `ごい${suffix}`,
      romaji: `goi${suffix}`,
      meaningIt: `distrattore ${suffix}`,
      searchLemmaNorm: `語彙${suffix}`,
      searchReadingNorm: `ごい${suffix}`,
      searchRomajiNorm: `goi${suffix}`,
      createdAt: `2026-04-01T09:${10 + index}:00.000Z`,
      updatedAt: `2026-04-01T09:${10 + index}:00.000Z`
    };
  });

  await database.insert(term).values(rows);
  await database.insert(card).values(
    rows.map((row, index) => ({
      id: `card_consolidation_distractor_${String(index + 1).padStart(2, "0")}`,
      mediaId: "media_consolidation",
      lessonId: null,
      segmentId: null,
      sourceFile: "tests/consolidation/cards.md",
      cardType: "recognition",
      front: `{{語彙${String(index + 1).padStart(2, "0")}|${row.reading}}}`,
      back: row.meaningIt,
      status: "active" as const,
      orderIndex: 20 + index,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
  );
  await database.insert(cardEntryLink).values(
    rows.map((row, index) => ({
      id: `card_consolidation_distractor_${String(index + 1).padStart(
        2,
        "0"
      )}_link`,
      cardId: `card_consolidation_distractor_${String(index + 1).padStart(
        2,
        "0"
      )}`,
      entryType: "term" as const,
      entryId: row.id,
      relationshipType: "primary" as const
    }))
  );
}

async function seedKanaOnlyPendingCard(database: DatabaseClient) {
  await database.insert(term).values({
    id: "term_consolidation_kana",
    sourceId: "consolidation-kana",
    mediaId: "media_consolidation",
    segmentId: null,
    lemma: "かな",
    reading: "かな",
    romaji: "kana",
    meaningIt: "scrittura sillabica",
    searchLemmaNorm: "かな",
    searchReadingNorm: "かな",
    searchRomajiNorm: "kana",
    createdAt: "2026-04-01T09:04:00.000Z",
    updatedAt: "2026-04-01T09:04:00.000Z"
  });
  await database.insert(card).values({
    id: "card_consolidation_kana",
    mediaId: "media_consolidation",
    lessonId: "lesson_consolidation",
    segmentId: null,
    sourceFile: "tests/consolidation/cards.md",
    cardType: "recognition",
    front: "かな",
    back: "scrittura sillabica",
    status: "active",
    orderIndex: 3,
    createdAt: "2026-04-01T09:04:00.000Z",
    updatedAt: "2026-04-01T09:04:00.000Z"
  });
  await database.insert(cardEntryLink).values({
    id: "card_consolidation_kana_link",
    cardId: "card_consolidation_kana",
    entryType: "term",
    entryId: "term_consolidation_kana",
    relationshipType: "primary"
  });
}

async function seedGrammarWithoutReadingPendingCard(database: DatabaseClient) {
  await database.insert(grammarPattern).values({
    id: "grammar_consolidation_before",
    sourceId: "consolidation-before",
    mediaId: "media_consolidation",
    segmentId: null,
    pattern: "～前に",
    title: "Prima di",
    reading: null,
    meaningIt: "prima di",
    notesIt: null,
    levelHint: null,
    searchPatternNorm: "前に",
    searchRomajiNorm: "",
    createdAt: "2026-04-01T09:03:00.000Z",
    updatedAt: "2026-04-01T09:03:00.000Z"
  });
  await database.insert(card).values({
    id: "card_consolidation_grammar_before",
    mediaId: "media_consolidation",
    lessonId: "lesson_consolidation",
    segmentId: null,
    sourceFile: "tests/consolidation/cards.md",
    cardType: "recognition",
    front: "～{{前|まえ}}に",
    back: "prima di",
    status: "active",
    orderIndex: 4,
    createdAt: "2026-04-01T09:03:00.000Z",
    updatedAt: "2026-04-01T09:03:00.000Z"
  });
  await database.insert(cardEntryLink).values({
    id: "card_consolidation_grammar_before_link",
    cardId: "card_consolidation_grammar_before",
    entryType: "grammar",
    entryId: "grammar_consolidation_before",
    relationshipType: "primary"
  });
}
