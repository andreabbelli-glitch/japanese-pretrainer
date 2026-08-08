import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type DatabaseClient } from "@/db";
import { listReviewSubjectFsrsReplaySubjects } from "@/db/queries";
import {
  card,
  lesson,
  lessonProgress,
  media,
  reviewMemoryAlias,
  reviewSubjectLog,
  reviewSubjectState,
  userSetting
} from "@/db/schema";
import {
  applyFsrsReschedule,
  buildFsrsReschedulePreview,
  loadFsrsOptimizerLogRows,
  writeFsrsOptimizedParameters
} from "@/features/fsrs-optimizer/server";
import { reviewSchedulerConfig } from "@/features/review/model/scheduler";
import {
  buildReviewMemoryKey,
  type ReviewRecallTask
} from "@/features/review/model/recall-task";

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
    vi.restoreAllMocks();
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

    const selectSpy = vi.spyOn(database, "select");
    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    // One state query + one ledger query, independent of subject count. The
    // batch load maps add no per-subject database round trip.
    expect(selectSpy).toHaveBeenCalledTimes(2);
    const today = preview.days[0]!;

    expect(preview.horizonDays).toBe(30);
    expect(preview.summary).toMatchObject({
      affectedSubjects: 2,
      eligibleSubjects: 2,
      movedLater: 2,
      unchangedSubjects: 0
    });
    expect(today.date).toBe("2026-01-21");
    expect(today.currentCount).toBe(1);
    expect(today.proposedCount).toBe(0);
    expect(today.delta).toBe(-1);
    expect(preview.days.find((day) => day.date === "2026-02-08")).toMatchObject(
      {
        currentCount: 0,
        delta: 2,
        proposedCount: 2
      }
    );
    expect(
      preview.days.reduce((total, day) => total + day.proposedCount, 0)
    ).toBe(2);
  });

  it("applies replayed state, records an immutable reschedule event, and blocks stale previews", async () => {
    const previewNow = new Date("2026-01-21T10:00:00.000Z");
    const preview = await buildFsrsReschedulePreview({
      database,
      now: previewNow
    });
    const repeatedPreview = await buildFsrsReschedulePreview({
      database,
      now: previewNow
    });
    const staleResult = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: "stale-cache-key",
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const logsBefore = await database.query.reviewSubjectLog.findMany();

    expect(repeatedPreview).toEqual(preview);
    expect(staleResult.status).toBe("stale");

    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const state = await database.query.reviewSubjectState.findFirst({
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("recognition-card")
      )
    });
    const logsAfter = await database.query.reviewSubjectLog.findMany();
    const rescheduleEvents = logsAfter.filter(
      (log) => log.eventKind === "reschedule"
    );
    const rescheduleEvent = rescheduleEvents.find(
      (event) => event.cardId === "recognition-card"
    )!;
    const trainingRows = await loadFsrsOptimizerLogRows(database);
    const replaySubjects = await listReviewSubjectFsrsReplaySubjects(database);
    const replaySubject = replaySubjects.find(
      (subject) =>
        subject.state.subjectKey === reviewMemoryKey("recognition-card")
    );

    expect(result).toMatchObject({
      affectedSubjects: 2,
      status: "applied"
    });
    expect(state?.dueAt).toBe("2026-02-08T03:00:00.000Z");
    expect(state?.updatedAt).toBe("2026-01-21T10:05:00.000Z");
    expect(state?.lastInteractionAt).toBe("2026-01-08T09:00:00.000Z");
    expect(logsAfter).toHaveLength(logsBefore.length + 2);
    expect(rescheduleEvents).toHaveLength(2);
    expect(rescheduleEvent).toMatchObject({
      algorithmVersion: "fsrs6",
      answeredAt: "2026-01-21T10:05:00.000Z",
      bindingVersion: "ts-fsrs@5.2.3",
      canonicalSubjectKey: "card:recognition-card",
      cardId: "recognition-card",
      cardTypeSnapshot: "recognition",
      eventKind: "reschedule",
      eventSchemaVersion: 2,
      mediaIdSnapshot: "reschedule-media",
      memoryKey: reviewMemoryKey("recognition-card"),
      newState: "review",
      previousDueAt: "2026-01-20T00:00:00.000Z",
      previousState: "review",
      rating: null,
      recallTask: "recognition",
      reason: "fsrs_optimizer_reschedule_apply",
      recordedAt: "2026-01-21T10:05:00.000Z",
      scheduledDueAt: "2026-02-08T03:00:00.000Z",
      studyDay: "2026-01-21",
      subjectKey: reviewMemoryKey("recognition-card")
    });
    expect(rescheduleEvent.batchId).toMatch(/^fsrs_reschedule_/u);
    expect(rescheduleEvent.parameterHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(JSON.parse(rescheduleEvent.beforeStateJson ?? "{}")).toMatchObject({
      dueAt: "2026-01-20T00:00:00.000Z",
      reps: 3,
      updatedAt: "2026-01-08T09:00:00.000Z"
    });
    expect(JSON.parse(rescheduleEvent.afterStateJson ?? "{}")).toMatchObject({
      dueAt: "2026-02-08T03:00:00.000Z",
      reps: 3,
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
    expect(trainingRows.map((row) => row.id)).not.toContain(rescheduleEvent.id);
    expect(replaySubject?.logs.map((log) => log.id)).not.toContain(
      rescheduleEvent.id
    );
  });

  it("merges an aliased history into one memory before rescheduling", async () => {
    const canonicalSubjectKey = "card:recognition-card";
    const oldMemoryKey = "mnemonic:v1:recognition:card:recognition-card-old";
    const currentMemoryKey = "mnemonic:v1:recognition:card:recognition-card";

    await database.delete(reviewSubjectLog);
    await database.delete(reviewSubjectState);
    await database.insert(reviewMemoryAlias).values({
      aliasMemoryKey: oldMemoryKey,
      currentMemoryKey,
      migratedAt: "2026-01-08T09:00:00.000Z",
      reason: "canonical_rekey"
    });
    await database.insert(reviewSubjectState).values({
      canonicalSubjectKey,
      cardId: "recognition-card",
      createdAt: "2026-01-01T09:00:00.000Z",
      crossMediaGroupId: null,
      difficulty: 2.104,
      dueAt: "2026-01-20T00:00:00.000Z",
      entryId: null,
      entryType: null,
      lapses: 0,
      lastInteractionAt: "2026-01-08T09:00:00.000Z",
      lastReviewedAt: "2026-01-08T09:00:00.000Z",
      learningSteps: 0,
      manualOverride: false,
      recallTask: "recognition",
      reps: 3,
      scheduledDays: 12,
      schedulerVersion: "fsrs_v1",
      stability: 18.18,
      state: "review",
      subjectKey: currentMemoryKey,
      subjectType: "card",
      suspended: false,
      updatedAt: "2026-01-08T09:00:00.000Z"
    });
    await database.insert(reviewSubjectLog).values([
      buildAliasedReplayEvent({
        answeredAt: "2026-01-01T09:00:00.000Z",
        canonicalSubjectKey,
        id: "aliased-replay-old",
        memoryKey: oldMemoryKey,
        newState: "learning",
        previousState: "new",
        scheduledDueAt: "2026-01-01T09:10:00.000Z"
      }),
      buildAliasedReplayEvent({
        answeredAt: "2026-01-03T09:00:00.000Z",
        canonicalSubjectKey,
        id: "aliased-replay-current-1",
        memoryKey: currentMemoryKey,
        newState: "review",
        previousState: "learning",
        scheduledDueAt: "2026-01-08T00:00:00.000Z"
      }),
      buildAliasedReplayEvent({
        answeredAt: "2026-01-08T09:00:00.000Z",
        canonicalSubjectKey,
        id: "aliased-replay-current-2",
        memoryKey: currentMemoryKey,
        newState: "review",
        previousState: "review",
        scheduledDueAt: "2026-01-26T00:00:00.000Z"
      })
    ]);

    const replaySubjects = await listReviewSubjectFsrsReplaySubjects(database);
    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });

    expect(replaySubjects).toHaveLength(1);
    expect(replaySubjects[0]?.state.subjectKey).toBe(currentMemoryKey);
    expect(replaySubjects[0]?.logs.map((log) => log.id)).toEqual([
      "aliased-replay-old",
      "aliased-replay-current-1",
      "aliased-replay-current-2"
    ]);
    expect(preview.summary).toMatchObject({
      affectedSubjects: 1,
      eligibleSubjects: 1
    });
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
      subjectKey: reviewMemoryKey("legacy-one-step-card"),
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
      ...reviewEventIdentity("legacy-one-step-card"),
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
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("legacy-one-step-card")
      )
    });

    expect(preview.summary).toMatchObject({
      affectedSubjects: 3,
      eligibleSubjects: 3,
      unchangedSubjects: 0
    });
    expect(result).toMatchObject({
      affectedSubjects: 3,
      status: "applied"
    });
    expect(legacyState).toMatchObject({
      dueAt: "2026-01-24T00:00:00.000Z",
      learningSteps: 0,
      scheduledDays: 23,
      schedulerVersion: "fsrs_v3_overdue_transient",
      state: "review",
      updatedAt: "2026-01-21T10:05:00.000Z"
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
      subjectKey: reviewMemoryKey("legacy-downgraded-card"),
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
      ...reviewEventIdentity("legacy-downgraded-card"),
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
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("legacy-downgraded-card")
      )
    });
    const rescheduleEvents = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.eventKind, "reschedule")
    });

    expect(preview.summary).toMatchObject({
      affectedSubjects: 3,
      eligibleSubjects: 3
    });
    expect(result).toMatchObject({
      affectedSubjects: 3,
      status: "applied"
    });
    expect(legacyState).toMatchObject({
      dueAt: "2026-01-24T00:00:00.000Z",
      learningSteps: 0,
      scheduledDays: 22,
      schedulerVersion: "fsrs_v3_overdue_transient",
      state: "review",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
    expect(rescheduleEvents).toHaveLength(3);
    expect(new Set(rescheduleEvents.map((event) => event.batchId)).size).toBe(
      1
    );
    expect(rescheduleEvents.every((event) => event.rating === null)).toBe(true);
  });

  it("does not shrink partial review histories below the latest logged review due date", async () => {
    await database.insert(card).values({
      id: "partial-review-history-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "concept",
      front: "partial review",
      normalizedFront: "partial review",
      back: "partial review",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 23,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: reviewMemoryKey("partial-review-history-card", "concept"),
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "partial-review-history-card",
      state: "review",
      stability: 0.122,
      difficulty: 5.102,
      dueAt: "2026-01-11T00:00:00.000Z",
      lastReviewedAt: "2026-01-10T09:00:00.000Z",
      lastInteractionAt: "2026-01-10T09:00:00.000Z",
      scheduledDays: 1,
      learningSteps: 0,
      lapses: 0,
      reps: 2,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
    await database.insert(reviewSubjectLog).values([
      {
        id: "partial-review-history-card-log-1",
        ...reviewEventIdentity("partial-review-history-card", "concept"),
        cardId: "partial-review-history-card",
        answeredAt: "2026-01-01T09:00:00.000Z",
        rating: "hard",
        previousState: "review",
        newState: "review",
        scheduledDueAt: "2026-01-10T00:00:00.000Z",
        elapsedDays: 23,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      },
      {
        id: "partial-review-history-card-log-2",
        ...reviewEventIdentity("partial-review-history-card", "concept"),
        cardId: "partial-review-history-card",
        answeredAt: "2026-01-10T09:00:00.000Z",
        rating: "good",
        previousState: "review",
        newState: "review",
        scheduledDueAt: "2026-05-01T00:00:00.000Z",
        elapsedDays: 9,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      }
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
    const partialState = await database.query.reviewSubjectState.findFirst({
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("partial-review-history-card", "concept")
      )
    });

    expect(result).toMatchObject({
      status: "applied"
    });
    expect(partialState).toMatchObject({
      dueAt: "2026-05-01T00:00:00.000Z",
      learningSteps: 0,
      scheduledDays: 110,
      schedulerVersion: "fsrs_v3_overdue_transient",
      state: "review",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
    expect(partialState?.stability).toBeGreaterThanOrEqual(110);
  });

  it("preserves mature counters when partial review histories need logged due preservation", async () => {
    await database.insert(card).values({
      id: "partial-mature-history-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "concept",
      front: "partial mature review",
      normalizedFront: "partial mature review",
      back: "partial mature review",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 24,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: reviewMemoryKey("partial-mature-history-card", "concept"),
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "partial-mature-history-card",
      state: "review",
      stability: 120,
      difficulty: 8.5,
      dueAt: "2026-05-01T00:00:00.000Z",
      lastReviewedAt: "2026-01-10T09:00:00.000Z",
      lastInteractionAt: "2026-01-10T09:00:00.000Z",
      scheduledDays: 110,
      learningSteps: 0,
      lapses: 3,
      reps: 40,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
    await database.insert(reviewSubjectLog).values([
      {
        id: "partial-mature-history-card-log-1",
        ...reviewEventIdentity("partial-mature-history-card", "concept"),
        cardId: "partial-mature-history-card",
        answeredAt: "2026-01-01T09:00:00.000Z",
        rating: "hard",
        previousState: "review",
        newState: "review",
        scheduledDueAt: "2026-01-10T00:00:00.000Z",
        elapsedDays: 23,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      },
      {
        id: "partial-mature-history-card-log-2",
        ...reviewEventIdentity("partial-mature-history-card", "concept"),
        cardId: "partial-mature-history-card",
        answeredAt: "2026-01-10T09:00:00.000Z",
        rating: "good",
        previousState: "review",
        newState: "review",
        scheduledDueAt: "2026-05-01T00:00:00.000Z",
        elapsedDays: 9,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      }
    ]);

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const partialState = await database.query.reviewSubjectState.findFirst({
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("partial-mature-history-card", "concept")
      )
    });

    expect(partialState).toMatchObject({
      difficulty: 8.5,
      dueAt: "2026-05-01T00:00:00.000Z",
      lapses: 3,
      reps: 40,
      scheduledDays: 110,
      stability: 120,
      state: "review"
    });
  });

  it("preserves current review due when partial history lacks latest scheduled due", async () => {
    await database.insert(card).values({
      id: "partial-null-due-history-card",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "concept",
      front: "partial null due review",
      normalizedFront: "partial null due review",
      back: "partial null due review",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 25,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: reviewMemoryKey("partial-null-due-history-card", "concept"),
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "partial-null-due-history-card",
      state: "review",
      stability: 90,
      difficulty: 7,
      dueAt: "2026-04-15T00:00:00.000Z",
      lastReviewedAt: "2026-01-10T09:00:00.000Z",
      lastInteractionAt: "2026-01-10T09:00:00.000Z",
      scheduledDays: 95,
      learningSteps: 0,
      lapses: 1,
      reps: 20,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
    await database.insert(reviewSubjectLog).values([
      {
        id: "partial-null-due-history-card-log-1",
        ...reviewEventIdentity("partial-null-due-history-card", "concept"),
        cardId: "partial-null-due-history-card",
        answeredAt: "2026-01-01T09:00:00.000Z",
        rating: "hard",
        previousState: "review",
        newState: "review",
        scheduledDueAt: "2026-01-10T00:00:00.000Z",
        elapsedDays: 23,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      },
      {
        id: "partial-null-due-history-card-log-2",
        ...reviewEventIdentity("partial-null-due-history-card", "concept"),
        cardId: "partial-null-due-history-card",
        answeredAt: "2026-01-10T09:00:00.000Z",
        rating: "good",
        previousState: "review",
        newState: "review",
        scheduledDueAt: null,
        elapsedDays: 9,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      }
    ]);

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const partialState = await database.query.reviewSubjectState.findFirst({
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("partial-null-due-history-card", "concept")
      )
    });

    expect(partialState).toMatchObject({
      dueAt: "2026-04-15T00:00:00.000Z",
      lapses: 1,
      reps: 20,
      scheduledDays: 94,
      stability: 94,
      state: "review"
    });
  });

  it("does not replay ambiguous merged fresh-start histories from multiple cards", async () => {
    await database.insert(card).values([
      {
        id: "merged-history-card-a",
        mediaId: "reschedule-media",
        lessonId: "reschedule-lesson",
        segmentId: null,
        sourceFile: "tests/fsrs-reschedule.md",
        cardType: "recognition",
        front: "merged a",
        normalizedFront: "merged a",
        back: "merged a",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 26,
        createdAt: "2026-01-01T09:00:00.000Z",
        updatedAt: "2026-01-01T09:00:00.000Z"
      },
      {
        id: "merged-history-card-b",
        mediaId: "reschedule-media",
        lessonId: "reschedule-lesson",
        segmentId: null,
        sourceFile: "tests/fsrs-reschedule.md",
        cardType: "recognition",
        front: "merged b",
        normalizedFront: "merged b",
        back: "merged b",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 27,
        createdAt: "2026-01-01T09:00:00.000Z",
        updatedAt: "2026-01-01T09:00:00.000Z"
      }
    ]);
    await database.insert(reviewSubjectState).values({
      subjectKey: "entry:term:merged-history",
      subjectType: "entry",
      entryType: "term",
      crossMediaGroupId: null,
      entryId: "merged-history",
      cardId: "merged-history-card-a",
      state: "review",
      stability: 80,
      difficulty: 3,
      dueAt: "2026-04-01T00:00:00.000Z",
      lastReviewedAt: "2026-01-10T09:00:00.000Z",
      lastInteractionAt: "2026-01-10T09:00:00.000Z",
      scheduledDays: 81,
      learningSteps: 0,
      lapses: 0,
      reps: 30,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-10T09:00:00.000Z"
    });
    await database.insert(reviewSubjectLog).values([
      {
        id: "merged-history-card-a-log-1",
        subjectKey: "entry:term:merged-history",
        cardId: "merged-history-card-a",
        answeredAt: "2026-01-01T09:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-02-01T00:00:00.000Z",
        elapsedDays: null,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      },
      {
        id: "merged-history-card-b-log-1",
        subjectKey: "entry:term:merged-history",
        cardId: "merged-history-card-b",
        answeredAt: "2026-01-10T09:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-01-20T00:00:00.000Z",
        elapsedDays: null,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      }
    ]);

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const mergedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, "entry:term:merged-history")
    });

    expect(mergedState).toMatchObject({
      dueAt: "2026-04-01T00:00:00.000Z",
      reps: 30,
      scheduledDays: 81,
      stability: 80,
      updatedAt: "2026-01-10T09:00:00.000Z"
    });
  });

  it("does not replay ambiguous same-card histories with a later null fresh start", async () => {
    await database.insert(card).values({
      id: "same-card-merged-history",
      mediaId: "reschedule-media",
      lessonId: "reschedule-lesson",
      segmentId: null,
      sourceFile: "tests/fsrs-reschedule.md",
      cardType: "recognition",
      front: "same merged",
      normalizedFront: "same merged",
      back: "same merged",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 28,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-01T09:00:00.000Z"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: "entry:term:same-card-merged-history",
      subjectType: "entry",
      entryType: "term",
      crossMediaGroupId: null,
      entryId: "same-card-merged-history",
      cardId: "same-card-merged-history",
      state: "review",
      stability: 70,
      difficulty: 4,
      dueAt: "2026-04-10T00:00:00.000Z",
      lastReviewedAt: "2026-01-10T09:00:00.000Z",
      lastInteractionAt: "2026-01-10T09:00:00.000Z",
      scheduledDays: 90,
      learningSteps: 0,
      lapses: 2,
      reps: 25,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-01-01T09:00:00.000Z",
      updatedAt: "2026-01-10T09:00:00.000Z"
    });
    await database.insert(reviewSubjectLog).values([
      {
        id: "same-card-merged-history-log-1",
        subjectKey: "entry:term:same-card-merged-history",
        cardId: "same-card-merged-history",
        answeredAt: "2026-01-01T09:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-02-01T00:00:00.000Z",
        elapsedDays: null,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      },
      {
        id: "same-card-merged-history-log-2",
        subjectKey: "entry:term:same-card-merged-history",
        cardId: "same-card-merged-history",
        answeredAt: "2026-01-10T09:00:00.000Z",
        rating: "good",
        previousState: null,
        newState: "review",
        scheduledDueAt: "2026-01-20T00:00:00.000Z",
        elapsedDays: null,
        responseMs: null,
        schedulerVersion: "fsrs_v1"
      }
    ]);

    const preview = await buildFsrsReschedulePreview({
      database,
      now: new Date("2026-01-21T10:00:00.000Z")
    });
    await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now: new Date("2026-01-21T10:05:00.000Z")
    });
    const mergedState = await database.query.reviewSubjectState.findFirst({
      where: eq(
        reviewSubjectState.subjectKey,
        "entry:term:same-card-merged-history"
      )
    });

    expect(mergedState).toMatchObject({
      dueAt: "2026-04-10T00:00:00.000Z",
      lapses: 2,
      reps: 25,
      scheduledDays: 90,
      stability: 70,
      updatedAt: "2026-01-10T09:00:00.000Z"
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
      subjectKey: reviewMemoryKey("genuine-learning-card"),
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
      ...reviewEventIdentity("genuine-learning-card"),
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
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("genuine-learning-card")
      )
    });

    expect(preview.summary).toMatchObject({
      affectedSubjects: 3,
      eligibleSubjects: 3,
      unchangedSubjects: 0
    });
    expect(result).toMatchObject({
      affectedSubjects: 3,
      status: "applied"
    });
    expect(learningState).toMatchObject({
      dueAt: "2026-01-21T09:10:00.000Z",
      learningSteps: 1,
      scheduledDays: 0,
      schedulerVersion: "fsrs_v3_overdue_transient",
      state: "learning",
      updatedAt: "2026-01-21T10:05:00.000Z"
    });
  });

  it("skips manual, suspended, new, and no-history subjects", async () => {
    const expectStateUnchanged = async (cardId: string) => {
      const state = await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, reviewMemoryKey(cardId))
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
    expect(result.affectedSubjects).toBe(2);
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
      where: eq(
        reviewSubjectState.subjectKey,
        reviewMemoryKey("production-card", "other")
      )
    });

    expect(preview.summary.affectedSubjects).toBe(2);
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
      subjectKey: reviewMemoryKey("recognition-card"),
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
      subjectKey: reviewMemoryKey("production-card", "other"),
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
        ...reviewEventIdentity(
          cardId,
          cardId === "production-card" ? "other" : "recognition"
        ),
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
        ...reviewEventIdentity(
          cardId,
          cardId === "production-card" ? "other" : "recognition"
        ),
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
        ...reviewEventIdentity(
          cardId,
          cardId === "production-card" ? "other" : "recognition"
        ),
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
    subjectKey: reviewMemoryKey(cardId),
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

function buildAliasedReplayEvent(input: {
  answeredAt: string;
  canonicalSubjectKey: string;
  id: string;
  memoryKey: string;
  newState: "learning" | "review";
  previousState: "learning" | "new" | "review";
  scheduledDueAt: string;
}): typeof reviewSubjectLog.$inferInsert {
  return {
    answeredAt: input.answeredAt,
    canonicalSubjectKey: input.canonicalSubjectKey,
    cardId: "recognition-card",
    cardTypeSnapshot: "recognition",
    elapsedDays: input.previousState === "new" ? null : 2,
    eventKind: "grade",
    eventSchemaVersion: 2,
    id: input.id,
    memoryKey: input.memoryKey,
    newState: input.newState,
    previousState: input.previousState,
    rating: "good",
    recallTask: "recognition",
    scheduledDueAt: input.scheduledDueAt,
    subjectKey: input.memoryKey
  };
}

function reviewMemoryKey(
  cardId: string,
  recallTask: ReviewRecallTask = "recognition"
) {
  return buildReviewMemoryKey({
    canonicalSubjectKey: `card:${cardId}`,
    cardId,
    recallTask
  });
}

function reviewEventIdentity(
  cardId: string,
  recallTask: ReviewRecallTask = "recognition"
) {
  const memoryKey = reviewMemoryKey(cardId, recallTask);

  return {
    canonicalSubjectKey: `card:${cardId}`,
    eventSchemaVersion: 2,
    memoryKey,
    recallTask,
    subjectKey: memoryKey
  } as const;
}
