import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";
import { listReviewSubjectFsrsReplaySubjects } from "@/db/queries";
import {
  card,
  lesson,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  userSetting
} from "@/db/schema";
import type { ReviewRecallTask } from "@/domain/review";
import {
  applyFsrsReschedule,
  buildFsrsReschedulePreview
} from "@/features/fsrs-optimizer/server";
import { getReviewFuzzBounds } from "@/features/review/model/interval-policy";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
import { replayReviewHistory } from "@/features/review/model/scheduler";

import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";

describe("FSRS reschedule atomic batch", () => {
  let database: DatabaseClient;
  let fixture: Awaited<ReturnType<typeof setupReviewDatabase>>;

  beforeEach(async () => {
    fixture = await setupReviewDatabase({
      prefix: "fsrs-reschedule-batch",
      seedDevelopmentFixture: false
    });
    database = fixture.database;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupReviewDatabase(fixture);
  });

  it("uses one constant-size write batch and no interactive transaction", async () => {
    await seedBatchSubjects(database, 2);
    const preview = await buildFsrsReschedulePreview({ database, now });
    const transactionSpy = vi.spyOn(database, "transaction");
    const batchSpy = vi.spyOn(database.$client, "batch");

    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now
    });

    expect(result).toMatchObject({ affectedSubjects: 2, status: "applied" });
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy.mock.calls[0]?.[0]).toHaveLength(10);
    expect(batchSpy.mock.calls[0]?.[1]).toBe("write");
    expect(
      await database.query.reviewSubjectLog.findMany({
        where: eq(reviewSubjectLog.eventKind, "reschedule")
      })
    ).toHaveLength(2);
  });

  it("rolls back every state and ledger write when a subject CAS is stale", async () => {
    await seedBatchSubjects(database, 2);
    const preview = await buildFsrsReschedulePreview({ database, now });
    const originalBatch = database.$client.batch.bind(database.$client);
    vi.spyOn(database.$client, "batch").mockImplementationOnce(
      async (statements, mode) => {
        await database
          .update(reviewSubjectState)
          .set({
            dueAt: "2026-02-20T03:00:00.000Z",
            updatedAt: "2026-01-21T09:59:59.000Z"
          })
          .where(eq(reviewSubjectState.subjectKey, memoryKey(0)));

        return originalBatch(statements, mode);
      }
    );

    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now
    });
    const first = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, memoryKey(0))
    });
    const second = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, memoryKey(1))
    });

    expect(result.status).toBe("stale");
    expect(first).toMatchObject({
      dueAt: "2026-02-20T03:00:00.000Z",
      updatedAt: "2026-01-21T09:59:59.000Z"
    });
    expect(second).toMatchObject({
      dueAt: currentDueAt,
      updatedAt: lastReviewedAt
    });
    expect(
      await database.query.reviewSubjectLog.findMany({
        where: eq(reviewSubjectLog.eventKind, "reschedule")
      })
    ).toHaveLength(0);
  });

  it("rolls back when optimizer parameters change after planning", async () => {
    await seedBatchSubjects(database, 2);
    const preview = await buildFsrsReschedulePreview({ database, now });
    const originalBatch = database.$client.batch.bind(database.$client);
    vi.spyOn(database.$client, "batch").mockImplementationOnce(
      async (statements, mode) => {
        await database.insert(userSetting).values({
          key: "fsrs_optimizer_config",
          updatedAt: "2026-01-21T10:04:59.000Z",
          valueJson: "{}"
        });

        return originalBatch(statements, mode);
      }
    );

    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now
    });

    expect(result).toMatchObject({ affectedSubjects: 0, status: "stale" });
    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, memoryKey(0))
      })
    ).toMatchObject({ dueAt: currentDueAt, updatedAt: lastReviewedAt });
    expect(
      await database.query.reviewSubjectLog.findMany({
        where: eq(reviewSubjectLog.eventKind, "reschedule")
      })
    ).toHaveLength(0);
  });

  it("applies 1,200 subjects in one constant-size batch below the write timeout", async () => {
    const subjectCount = 1_200;
    await seedBatchSubjects(database, subjectCount);
    const preview = await buildFsrsReschedulePreview({ database, now });
    const originalBatch = database.$client.batch.bind(database.$client);
    let batchElapsedMs = Number.POSITIVE_INFINITY;
    const batchSpy = vi
      .spyOn(database.$client, "batch")
      .mockImplementationOnce(async (statements, mode) => {
        const startedAt = performance.now();
        const result = await originalBatch(statements, mode);
        batchElapsedMs = performance.now() - startedAt;
        return result;
      });

    const result = await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now
    });

    expect(result).toMatchObject({
      affectedSubjects: subjectCount,
      status: "applied"
    });
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(batchSpy.mock.calls[0]?.[0]).toHaveLength(10);
    expect(getBatchPayloadSize(batchSpy.mock.calls[0]?.[0])).toBeLessThan(
      4_000_000
    );
    expect(batchElapsedMs).toBeLessThan(5_000);
    expect(
      await database.query.reviewSubjectLog.findMany({
        where: eq(reviewSubjectLog.eventKind, "reschedule")
      })
    ).toHaveLength(subjectCount);
  });

  it("keeps batch load balancing separated by recall task without double-fuzzing", async () => {
    await seedBatchSubjects(database, 2, {
      includeLogs: (index) => index === 0,
      recallTask: (index) => (index === 0 ? "other" : "recognition")
    });
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2026-01-29T03:00:00.000Z",
        scheduledDays: 28,
        updatedAt: createdAt
      })
      .where(eq(reviewSubjectState.subjectKey, memoryKey(1)));
    const subjects = await listReviewSubjectFsrsReplaySubjects(database);
    const production = subjects.find(
      (subject) => subject.state.subjectKey === memoryKey(0, "other")
    )!;
    const replayed = replayReviewHistory(
      production.logs.map((log) => ({
        answeredAt: log.answeredAt,
        cardType: log.cardType,
        elapsedDays: log.elapsedDays,
        id: log.id,
        previousState: log.previousState,
        rating: log.rating,
        responseMs: log.responseMs,
        schedulingKey: log.cardId
      }))
    )!;
    const policy = replayed.finalIntervalPolicy!;
    const bounds = getReviewFuzzBounds(
      policy.baseInterval,
      policy.minimumInterval,
      policy.maximumInterval
    );
    const preview = await buildFsrsReschedulePreview({ database, now });

    await applyFsrsReschedule({
      database,
      expectedFsrsCacheKeyPart: preview.fsrsCacheKeyPart,
      now
    });
    const persisted = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, memoryKey(0, "other"))
    });

    expect(policy.baseInterval).toBeCloseTo(18.18, 2);
    expect(replayed.state.scheduledDays).toBeGreaterThanOrEqual(bounds.lower);
    expect(replayed.state.scheduledDays).toBeLessThanOrEqual(bounds.upper);
    expect(persisted?.dueAt).toBe(replayed.state.dueAt);
    expect(persisted?.scheduledDays).toBe(replayed.state.scheduledDays);
  });
});

const now = new Date("2026-01-21T10:05:00.000Z");
const createdAt = "2026-01-01T09:00:00.000Z";
const lastReviewedAt = "2026-01-08T09:00:00.000Z";
const currentDueAt = "2026-01-20T00:00:00.000Z";

async function seedBatchSubjects(
  database: DatabaseClient,
  count: number,
  options: {
    includeLogs?: (index: number) => boolean;
    recallTask?: (index: number) => ReviewRecallTask;
  } = {}
) {
  await database.insert(media).values({
    baseExplanationLanguage: "it",
    createdAt,
    id: "batch-media",
    language: "ja",
    mediaType: "game",
    segmentKind: "chapter",
    slug: "batch-media",
    status: "active",
    title: "Batch media",
    updatedAt: createdAt
  });
  await database.insert(lesson).values({
    createdAt,
    difficulty: "beginner",
    id: "batch-lesson",
    mediaId: "batch-media",
    orderIndex: 1,
    slug: "batch-lesson",
    sourceFile: "tests/fsrs-reschedule-batch.md",
    status: "active",
    title: "Batch lesson",
    updatedAt: createdAt
  });

  const indexes = Array.from({ length: count }, (_, index) => index);

  for (const chunk of chunkArray(indexes, 250)) {
    await database.insert(card).values(
      chunk.map((index) => {
        const recallTask = options.recallTask?.(index) ?? "recognition";

        return {
          back: `back ${index}`,
          cardType: recallTask === "other" ? "production" : recallTask,
          createdAt,
          front: `front ${index}`,
          id: cardId(index),
          lessonId: "batch-lesson",
          mediaId: "batch-media",
          sourceFile: "tests/fsrs-reschedule-batch.md",
          status: "active" as const,
          updatedAt: createdAt
        };
      })
    );
    await database.insert(reviewSubjectState).values(
      chunk.map((index) => {
        const recallTask = options.recallTask?.(index) ?? "recognition";

        return {
          cardId: cardId(index),
          createdAt,
          difficulty: 2.104,
          dueAt: currentDueAt,
          lapses: 0,
          lastInteractionAt: lastReviewedAt,
          lastReviewedAt,
          learningSteps: 0,
          manualOverride: false,
          recallTask,
          reps: 3,
          scheduledDays: 12,
          schedulerVersion: "fsrs_v1" as const,
          stability: 18.18,
          state: "review" as const,
          subjectKey: memoryKey(index, recallTask),
          subjectType: "card" as const,
          suspended: false,
          updatedAt: lastReviewedAt
        };
      })
    );
  }

  const logs = indexes.flatMap((index) => {
    if (options.includeLogs && !options.includeLogs(index)) {
      return [];
    }

    return buildReplayLogs(index, options.recallTask?.(index) ?? "recognition");
  });

  for (const chunk of chunkArray(logs, 250)) {
    await database.insert(reviewSubjectLog).values(chunk);
  }
}

function buildReplayLogs(index: number, recallTask: ReviewRecallTask) {
  const identity = {
    canonicalSubjectKey: `card:${cardId(index)}`,
    cardId: cardId(index),
    cardTypeSnapshot: recallTask === "other" ? "production" : recallTask,
    eventKind: "grade" as const,
    eventSchemaVersion: 2,
    memoryKey: memoryKey(index, recallTask),
    rating: "good" as const,
    recallTask,
    schedulerVersion: "fsrs_v1" as const,
    subjectKey: memoryKey(index, recallTask)
  };

  return [
    {
      ...identity,
      answeredAt: "2026-01-01T09:00:00.000Z",
      id: `${cardId(index)}-log-1`,
      newState: "learning" as const,
      previousState: "new" as const,
      scheduledDueAt: "2026-01-01T09:10:00.000Z"
    },
    {
      ...identity,
      answeredAt: "2026-01-03T09:00:00.000Z",
      elapsedDays: 2,
      id: `${cardId(index)}-log-2`,
      newState: "review" as const,
      previousState: "learning" as const,
      scheduledDueAt: "2026-01-08T00:00:00.000Z"
    },
    {
      ...identity,
      answeredAt: lastReviewedAt,
      elapsedDays: 5,
      id: `${cardId(index)}-log-3`,
      newState: "review" as const,
      previousState: "review" as const,
      scheduledDueAt: "2026-01-26T00:00:00.000Z"
    }
  ];
}

function cardId(index: number) {
  return `batch-card-${index}`;
}

function memoryKey(
  index: number,
  recallTask: ReviewRecallTask = "recognition"
) {
  return buildReviewMemoryKey({
    canonicalSubjectKey: `card:${cardId(index)}`,
    cardId: cardId(index),
    recallTask
  });
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getBatchPayloadSize(
  statements: Parameters<DatabaseClient["$client"]["batch"]>[0] | undefined
) {
  const planLoad = statements?.[2];

  if (typeof planLoad !== "object" || !planLoad || !("args" in planLoad)) {
    return Number.POSITIVE_INFINITY;
  }

  return String(Array.isArray(planLoad.args) ? planLoad.args[0] : "").length;
}
