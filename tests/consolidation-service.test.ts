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
  lesson,
  lessonProgress,
  media,
  preReviewConsolidationState,
  reviewSubjectState,
  term,
  userSetting
} from "@/db/schema";
import { listDueCardsByMediaId } from "@/db/queries";
import {
  enqueueLessonConsolidation,
  setLessonCompletionWithConsolidation,
  getPendingConsolidationSubjectKeys
} from "@/lib/consolidation";
import { getGlobalReviewPageData, hydrateReviewCard } from "@/lib/review";
import { applyReviewGrade } from "@/lib/review-service";
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
