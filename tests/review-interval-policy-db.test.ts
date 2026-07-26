import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import type { DatabaseClient } from "@/db";
import { listReviewSubjectDueCountsInRange } from "@/db/queries";
import { reviewSubjectState } from "@/db/schema";
import { developmentFixture, seedDevelopmentDatabase } from "@/db/seed";
import { applyReviewGrade } from "@/features/review/server/service";
import { scheduleReviewRatingsWithDailyIntervalPolicy } from "@/features/review/server/interval-policy";
import {
  cleanupTestDatabase,
  markLessonsCompleted,
  setupTestDatabase
} from "./helpers/test-db";
import { primarySubjectKey } from "./helpers/review-shared";

describe("review daily interval load query", () => {
  let database: DatabaseClient;
  let tempDir: string;

  beforeEach(async () => {
    ({ database, tempDir } = await setupTestDatabase({
      prefix: "jcs-review-interval-policy-"
    }));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupTestDatabase({ database, tempDir });
  });

  it("uses one bounded aggregate, filters by recall-task preset and folds legacy rows by UTC hour", async () => {
    await database.insert(reviewSubjectState).values([
      buildState("recognition-a", "recognition", "2026-03-29T02:05:00.000Z"),
      buildState("recognition-b", "recognition", "2026-03-29T02:45:00.000Z"),
      buildState("recognition-c", "recognition", "2026-03-30T02:15:00.000Z"),
      buildState("concept-a", "concept", "2026-03-29T02:25:00.000Z"),
      buildState(
        "mnemonic:v1:recognition:card:legacy-recognition",
        null,
        "2026-03-29T02:35:00.000Z"
      ),
      buildState("legacy-task-ambiguous", null, "2026-03-29T02:40:00.000Z"),
      {
        ...buildState(
          "recognition-intraday",
          "recognition",
          "2026-03-29T02:50:00.000Z"
        ),
        scheduledDays: 0
      },
      // Before the 04:00 Europe/Rome rollover, outside the queried day range.
      buildState(
        "recognition-before",
        "recognition",
        "2026-03-29T01:55:00.000Z"
      )
    ]);
    const selectSpy = vi.spyOn(database, "select");
    const rows = await listReviewSubjectDueCountsInRange(database, {
      endExclusiveIso: "2026-03-31T02:00:00.000Z",
      recallTask: "recognition",
      startInclusiveIso: "2026-03-29T02:00:00.000Z"
    });

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([
      { count: 3, dueAt: "2026-03-29T02:05:00.000Z" },
      { count: 1, dueAt: "2026-03-30T02:15:00.000Z" }
    ]);
  });

  it("plans the bounded range through the due_at index", async () => {
    const plan = await database.$client.execute({
      sql: `EXPLAIN QUERY PLAN
        SELECT substr(due_at, 1, 13), count(*), min(due_at)
        FROM review_subject_state
        WHERE due_at IS NOT NULL
          AND due_at >= ?
          AND due_at < ?
          AND manual_override = 0
          AND suspended = 0
          AND scheduled_days > 0
          AND state NOT IN ('new', 'known_manual', 'suspended')
          AND recall_task = ?
        GROUP BY substr(due_at, 1, 13)`,
      args: [
        "2026-03-29T02:00:00.000Z",
        "2026-04-28T02:00:00.000Z",
        "recognition"
      ]
    });
    const details = plan.rows.map((row) => String(row.detail ?? ""));

    expect(details.some((detail) => detail.includes("due_idx"))).toBe(true);
  });

  it("builds all four server preview schedules with one query, not one per rating", async () => {
    const selectSpy = vi.spyOn(database, "select");
    const scheduled = await scheduleReviewRatingsWithDailyIntervalPolicy({
      current: {
        difficulty: 4,
        dueAt: "2026-03-28T12:00:00.000Z",
        lapses: 0,
        lastReviewedAt: "2026-03-08T12:00:00.000Z",
        learningSteps: 0,
        reps: 8,
        scheduledDays: 20,
        stability: 20,
        state: "review"
      },
      database,
      excludeSubjectKey: "recognition-a",
      intervalPolicy: { schedulingKey: "card-preview" },
      now: new Date("2026-03-28T12:00:00.000Z"),
      ratings: ["again", "hard", "good", "easy"],
      recallTask: "recognition"
    });

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(scheduled.size).toBe(4);
    expect(scheduled.get("again")?.scheduledDays).toBe(0);
    expect(scheduled.get("good")?.scheduledDays).toBeGreaterThan(0);
  });

  it("keeps the deterministic server preview schedule equal to the persisted grade", async () => {
    await seedDevelopmentDatabase(database);
    await markLessonsCompleted(database, "2026-03-01T00:00:00.000Z");
    const now = new Date("2026-03-28T12:00:00.000Z");

    await database
      .update(reviewSubjectState)
      .set({
        difficulty: 4,
        dueAt: now.toISOString(),
        lapses: 0,
        lastInteractionAt: "2026-03-08T12:00:00.000Z",
        lastReviewedAt: "2026-03-08T12:00:00.000Z",
        learningSteps: 0,
        reps: 8,
        scheduledDays: 20,
        stability: 20,
        state: "review",
        updatedAt: "2026-03-08T12:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    const before = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const previews = await scheduleReviewRatingsWithDailyIntervalPolicy({
      current: {
        difficulty: before!.difficulty,
        dueAt: before!.dueAt,
        lapses: before!.lapses,
        lastReviewedAt: before!.lastReviewedAt,
        learningSteps: before!.learningSteps,
        reps: before!.reps,
        scheduledDays: before!.scheduledDays,
        stability: before!.stability,
        state: before!.state
      },
      database,
      excludeSubjectKey: primarySubjectKey,
      intervalPolicy: {
        schedulingKey: primarySubjectKey
      },
      now,
      ratings: ["again", "hard", "good", "easy"],
      recallTask: "recognition"
    });

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      expectedUpdatedAt: before!.updatedAt,
      now,
      rating: "good"
    });

    const persisted = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const preview = previews.get("good")!;

    expect(persisted?.dueAt).toBe(preview.dueAt);
    expect(persisted?.scheduledDays).toBe(preview.scheduledDays);
  });
});

function buildState(
  subjectKey: string,
  recallTask: "recognition" | "concept" | null,
  dueAt: string
): typeof reviewSubjectState.$inferInsert {
  return {
    canonicalSubjectKey: `card:${subjectKey}`,
    createdAt: "2026-03-01T00:00:00.000Z",
    difficulty: 5,
    dueAt,
    lastInteractionAt: "2026-03-01T00:00:00.000Z",
    lastReviewedAt: "2026-03-01T00:00:00.000Z",
    recallTask,
    reps: 5,
    scheduledDays: 28,
    schedulerVersion: "fsrs_v2_study_day",
    stability: 28,
    state: "review",
    subjectKey,
    subjectType: "card",
    updatedAt: "2026-03-01T00:00:00.000Z"
  };
}
