import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type DatabaseClient } from "@/db";
import {
  card,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  userSetting
} from "@/db/schema";
import {
  applyFsrsReschedule,
  buildFsrsReschedulePreview,
  writeFsrsOptimizedParameters
} from "@/features/fsrs-optimizer/server";
import { reviewSchedulerConfig } from "@/features/review/model/scheduler";

import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";

describe("fsrs reschedule preview", () => {
  let database: DatabaseClient;
  let fixture: Awaited<ReturnType<typeof setupReviewDatabase>>;

  beforeEach(async () => {
    fixture = await setupReviewDatabase({
      prefix: "fsrs-reschedule",
      seedDevelopmentFixture: false
    });
    database = fixture.database;
    await seedRescheduleFixture(database);
  });

  afterEach(async () => {
    await cleanupReviewDatabase(fixture);
  });

  it("builds a 30-day preview with overdue cards bucketed into today", async () => {
    await writeFsrsOptimizedParameters(
      {
        desiredRetention: 0.8,
        presetKey: "recognition",
        trainedAt: "2026-02-01T09:00:00.000Z",
        trainingReviewCount: 3,
        weights: [...reviewSchedulerConfig.fsrs.w]
      },
      database,
      "2026-02-01T09:00:00.000Z"
    );

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    const today = preview.days[0]!;

    expect(preview.horizonDays).toBe(30);
    expect(preview.summary).toMatchObject({
      affectedSubjects: 1,
      eligibleSubjects: 2,
      movedLater: 1,
      unchangedSubjects: 1
    });
    expect(today.date).toBe("2026-01-21");
    expect(today.currentCount).toBe(1);
    expect(today.proposedCount).toBe(0);
    expect(today.delta).toBe(-1);
    expect(preview.days.find((day) => day.date === "2026-01-26")).toMatchObject(
      {
        currentCount: 1,
        delta: 1,
        proposedCount: 2
      }
    );
  });

  it("applies replayed state without writing synthetic review logs and blocks stale previews", async () => {
    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    const staleResult = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: "stale-cache-key",
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const logsBefore = await database.query.reviewSubjectLog.findMany();

    expect(staleResult.status).toBe("stale");

    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const state = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "card:recognition-card")
    });
    const logsAfter = await database.query.reviewSubjectLog.findMany();

    expect(result).toMatchObject({
      affectedSubjects: 1,
      status: "applied"
    });
    expect(state?.dueAt).toBe("2026-01-26T00:00:00.000Z");
    expect(state?.updatedAt).toBe("2026-01-21T10:05:00.000Z");
    expect(state?.lastInteractionAt).toBe("2026-01-08T09:00:00.000Z");
    expect(logsAfter).toHaveLength(logsBefore.length);
  });

  it("does not downgrade legacy one-step review subjects into expired learning steps", async () => {
    await database.insert(card).values({
      id: "legacy-one-step-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "recognition",
      front: "legacy",
      normalizedFront: "legacy",
      back: "legacy",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 20,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: "card:legacy-one-step-card",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "legacy-one-step-card",
      state: "review",
      stability: 6,
      difficulty: 4,
      dueAt: "2026-01-24T00:00:00.000Z",
      lastReviewedAt: "2026-01-01T09:00:00.000Z",
      lastInteractionAt: "2026-01-01T09:00:00.000Z",
      scheduledDays: 23,
      learningSteps: 0,
      lapses: 0,
      reps: 1,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
    await database.insert(reviewSubjectLog).values({
      id: "legacy-one-step-card-log-1",
      subjectKey: "card:legacy-one-step-card",
      cardId: "legacy-one-step-card",
      answeredAt: "2026-01-01T09:00:00.000Z",
      rating: "good",
      previousState: "new",
      newState: "review",
      scheduledDueAt: "2026-01-24T00:00:00.000Z",
      elapsedDays: null,
      responseMs: null,
      schedulerVersion: "fsrs_v1"
    });

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const legacyState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "card:legacy-one-step-card")
    });

    expect(preview.summary).toMatchObject({
      affectedSubjects: 1,
      eligibleSubjects: 3,
      unchangedSubjects: 2
    });
    expect(result).toMatchObject({
      affectedSubjects: 1,
      status: "applied"
    });
    expect(legacyState).toMatchObject({
      dueAt: "2026-01-24T00:00:00.000Z",
      learningSteps: 0,
      scheduledDays: 23,
      state: "review",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
  });

  it("repairs legacy review subjects already downgraded into expired learning steps", async () => {
    await database.insert(card).values({
      id: "legacy-downgraded-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "recognition",
      front: "downgraded",
      normalizedFront: "downgraded",
      back: "downgraded",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 21,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: "card:legacy-downgraded-card",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "legacy-downgraded-card",
      state: "learning",
      stability: 2.307,
      difficulty: 2.118,
      dueAt: "2026-01-01T09:10:00.000Z",
      lastReviewedAt: "2026-01-01T09:00:00.000Z",
      lastInteractionAt: "2026-01-01T09:00:00.000Z",
      scheduledDays: 0,
      learningSteps: 1,
      lapses: 0,
      reps: 1,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
    await database.insert(reviewSubjectLog).values({
      id: "legacy-downgraded-card-log-1",
      subjectKey: "card:legacy-downgraded-card",
      cardId: "legacy-downgraded-card",
      answeredAt: "2026-01-01T09:00:00.000Z",
      rating: "good",
      previousState: "new",
      newState: "review",
      scheduledDueAt: "2026-01-24T00:00:00.000Z",
      elapsedDays: null,
      responseMs: null,
      schedulerVersion: "fsrs_v1"
    });

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const legacyState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "card:legacy-downgraded-card")
    });

    expect(preview.summary).toMatchObject({
      affectedSubjects: 2,
      eligibleSubjects: 3
    });
    expect(result).toMatchObject({
      affectedSubjects: 2,
      status: "applied"
    });
    expect(legacyState).toMatchObject({
      dueAt: "2026-01-24T00:00:00.000Z",
      learningSteps: 0,
      scheduledDays: 23,
      state: "review",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
  });

  it("keeps genuine learning subjects in learning during reschedule", async () => {
    await database.insert(card).values({
      id: "genuine-learning-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "recognition",
      front: "learning",
      normalizedFront: "learning",
      back: "learning",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 22,
      createdAt: "2026-01-21T09:00:00.000Z",
      updatedAt: "2026-01-21T09:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: "card:genuine-learning-card",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "genuine-learning-card",
      state: "learning",
      stability: 2.307,
      difficulty: 2.118,
      dueAt: "2026-01-21T09:10:00.000Z",
      lastReviewedAt: "2026-01-21T09:00:00.000Z",
      lastInteractionAt: "2026-01-21T09:00:00.000Z",
      scheduledDays: 0,
      learningSteps: 1,
      lapses: 0,
      reps: 1,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-21T09:00:00.000Z",
      updatedAt: "2026-01-21T09:00:00.000Z"
    });
    await database.insert(reviewSubjectLog).values({
      id: "genuine-learning-card-log-1",
      subjectKey: "card:genuine-learning-card",
      cardId: "genuine-learning-card",
      answeredAt: "2026-01-21T09:00:00.000Z",
      rating: "good",
      previousState: "new",
      newState: "learning",
      scheduledDueAt: "2026-01-21T09:10:00.000Z",
      elapsedDays: null,
      responseMs: null,
      schedulerVersion: "fsrs_v1"
    });

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const learningState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "card:genuine-learning-card")
    });

    expect(preview.summary).toMatchObject({
      affectedSubjects: 1,
      eligibleSubjects: 3,
      unchangedSubjects: 2
    });
    expect(result).toMatchObject({
      affectedSubjects: 1,
      status: "applied"
    });
    expect(learningState).toMatchObject({
      dueAt: "2026-01-21T09:10:00.000Z",
      learningSteps: 1,
      scheduledDays: 0,
      state: "learning",
      updatedAt: "2026-01-21T09:00:00.000Z"
    });
  });

  it("skips manual, suspended, new, and no-history subjects", async () => {
    const expectStateUnchanged = async (cardId: string) => {
      const state = await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, `card:${cardId}`)
      });

      expect(state?.dueAt).toBe("2026-01-20T00:00:00.000Z");
      expect(state?.updatedAt).toBe("2026-01-08T09:00:00.000Z");
    };

    await database.insert(reviewSubjectState).values([
      buildSkippableState("manual-card", {
        manualOverride: true,
        state: "review"
      }),
      buildSkippableState("suspended-card", {
        state: "review",
        suspended: true
      }),
      buildSkippableState("new-card", {
        state: "new"
      }),
      buildSkippableState("no-history-card", {
        state: "review"
      })
    ]);

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });

    expect(preview.summary.eligibleSubjects).toBe(2);
    expect(preview.summary.skippedNoHistory).toBe(1);
    expect(result.affectedSubjects).toBe(1);
    await expectStateUnchanged("manual-card");
    await expectStateUnchanged("suspended-card");
    await expectStateUnchanged("new-card");
    await expectStateUnchanged("no-history-card");
  });

  it("falls back safely for unsupported card types when optimized recognition params would change", async () => {
    await writeFsrsOptimizedParameters(
      {
        desiredRetention: 0.8,
        presetKey: "recognition",
        trainedAt: "2026-02-01T09:00:00.000Z",
        trainingReviewCount: 3,
        weights: [...reviewSchedulerConfig.fsrs.w]
      },
      database,
      "2026-02-01T09:00:00.000Z"
    );

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    const productionState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "card:production-card")
    });

    expect(preview.summary.affectedSubjects).toBe(1);
    expect(productionState?.dueAt).toBe("2026-01-26T00:00:00.000Z");
  });
});

async function seedRescheduleFixture(database: DatabaseClient) {
  const createdAt = "2026-01-01T09:00:00.000Z";

  await database.insert(media).values({
    id: "reschedule-media",
    slug: "reschedule-media",
    title: "Reschedule Media",
    mediaType: "game",
    segmentKind: "chapter",
    language: "ja",
    baseExplanationLanguage: "it",
    description: "Reschedule fixture",
    status: "active",
    createdAt,
    updatedAt: createdAt
  });
  await database.insert(lesson).values({
    id: "reschedule-lesson",
    mediaId: "reschedule-media",
    segmentId: null,
    slug: "reschedule-lesson",
    title: "Reschedule Lesson",
    orderIndex: 1,
    difficulty: "beginner",
    summary: "Reschedule Lesson",
    status: "active",
    sourceFile: "tests/fsrs-reschedule.md",
    createdAt,
    updatedAt: createdAt
  });
  await database.insert(lessonProgress).values({
    lessonId: "reschedule-lesson",
    status: "completed",
    completedAt: createdAt
  });
  await database.insert(card).values([
    {
      id: "recognition-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "recognition",
      front: "認識",
      normalizedFront: "認識",
      back: "recognition",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 1,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "production-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "production",
      front: "産出",
      normalizedFront: "産出",
      back: "production",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 2,
      createdAt,
      updatedAt: createdAt
    },
    ...["manual-card", "suspended-card", "new-card", "no-history-card"].map(
      (cardId, index) => ({
        id: cardId,
        mediaId: "reschedule-media",
        lessonId: "reschedule-lesson",
        segmentId: null,
        sourceFile: "tests/fsrs-reschedule.md",
        cardType: "recognition" as const,
        front: cardId,
        normalizedFront: cardId,
        back: cardId,
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active" as const,
        orderIndex: index + 3,
        createdAt,
        updatedAt: createdAt
      })
    )
  ]);
  await database.insert(reviewSubjectState).values([
    {
      subjectKey: "card:recognition-card",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "recognition-card",
      state: "review",
      stability: 18.18,
      difficulty: 2.104,
      dueAt: "2026-01-20T00:00:00.000Z",
      lastReviewedAt: "2026-01-08T09:00:00.000Z",
      lastInteractionAt: "2026-01-08T09:00:00.000Z",
      scheduledDays: 12,
      learningSteps: 0,
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt,
      updatedAt: "2026-01-08T09:00:00.000Z"
    }
  ]);
  await database.insert(reviewSubjectState).values([
    {
      subjectKey: "card:production-card",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "production-card",
      state: "review",
      stability: 18.18,
      difficulty: 2.104,
      dueAt: "2026-01-26T00:00:00.000Z",
      lastReviewedAt: "2026-01-08T09:00:00.000Z",
      lastInteractionAt: "2026-01-08T09:00:00.000Z",
      scheduledDays: 18,
      learningSteps: 0,
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt,
      updatedAt: "2026-01-08T09:00:00.000Z"
    }
  ]);
  const reviewLogs = ["recognition-card", "production-card"].flatMap(
    (cardId) => [
      {
        id: `${cardId}-log-1`,
        subjectKey: `card:${cardId}`,
        cardId,
        answeredAt: "2026-01-01T09:00:00.000Z",
        rating: "good" as const,
        previousState: "new" as const,
        newState: "learning" as const,
        scheduledDueAt: "2026-01-01T09:10:00.000Z",
        elapsedDays: null,
        responseMs: null,
        schedulerVersion: "fsrs_v1" as const
      },
      {
        id: `${cardId}-log-2`,
        subjectKey: `card:${cardId}`,
        cardId,
        answeredAt: "2026-01-03T09:00:00.000Z",
        rating: "good" as const,
        previousState: "learning" as const,
        newState: "review" as const,
        scheduledDueAt: "2026-01-08T00:00:00.000Z",
        elapsedDays: 2,
        responseMs: null,
        schedulerVersion: "fsrs_v1" as const
      },
      {
        id: `${cardId}-log-3`,
        subjectKey: `card:${cardId}`,
        cardId,
        answeredAt: "2026-01-08T09:00:00.000Z",
        rating: "good" as const,
        previousState: "review" as const,
        newState: "review" as const,
        scheduledDueAt: "2026-01-26T00:00:00.000Z",
        elapsedDays: 5,
        responseMs: null,
        schedulerVersion: "fsrs_v1" as const
      }
    ]
  );

  await database.insert(reviewSubjectLog).values(reviewLogs);
  await database.insert(userSetting).values({
    key: "review_daily_limit",
    updatedAt: createdAt,
    valueJson: "20"
  });
}

function buildSkippableState(
  cardId: string,
  overrides: {
    manualOverride?: boolean;
    state: "new" | "learning" | "review" | "relearning" | "known_manual";
    suspended?: boolean;
  }
): typeof reviewSubjectState.$inferInsert {
  return {
    subjectKey: `card:${cardId}`,
    subjectType: "card",
    entryType: null,
    crossMediaGroupId: null,
    entryId: null,
    cardId,
    state: overrides.state,
    stability: 18.18,
    difficulty: 2.104,
    dueAt: "2026-01-20T00:00:00.000Z",
    lastReviewedAt: "2026-01-08T09:00:00.000Z",
    lastInteractionAt: "2026-01-08T09:00:00.000Z",
    scheduledDays: 12,
    learningSteps: 0,
    lapses: 0,
    reps: 3,
    schedulerVersion: "fsrs_v1",
    manualOverride: overrides.manualOverride ?? false,
    suspended: overrides.suspended ?? false,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-08T09:00:00.000Z"
  };
}
