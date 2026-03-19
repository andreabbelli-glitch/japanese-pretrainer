import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  lessonProgress,
  reviewState,
  runMigrations,
  type DatabaseClient
} from "@/db";
import { getGlobalReviewPageData, getReviewPageData } from "@/lib/review";
import { importContentWorkspace } from "@/lib/content/importer";
import {
  backfillReviewSubjectState,
  inspectReviewSubjectStateCoverage
} from "@/lib/review-subject-state-backfill";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";

describe("review subject state backfill", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-backfill-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("backfills missing cross-media subject state idempotently without changing queue selection", async () => {
    const contentRoot = path.join(tempDir, "cross-media-backfill");

    await writeCrossMediaContentFixture(contentRoot);

    const importResult = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(importResult.status).toBe("completed");

    await database.insert(lessonProgress).values([
      {
        lessonId: crossMediaFixture.alpha.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      },
      {
        lessonId: crossMediaFixture.beta.lessonId,
        status: "completed",
        completedAt: "2026-03-11T08:00:00.000Z"
      }
    ]);
    await database.insert(reviewState).values({
      cardId: crossMediaFixture.alpha.termCardId,
      state: "review",
      stability: 2.4,
      difficulty: 3.1,
      dueAt: "2000-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-10T08:00:00.000Z",
      scheduledDays: 2,
      learningSteps: 0,
      lapses: 1,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });

    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(0);

    const coverageBefore = await inspectReviewSubjectStateCoverage(database, {
      now: new Date("2026-03-11T09:00:00.000Z")
    });

    expect(coverageBefore).toMatchObject({
      cardCount: 5,
      complete: false,
      existingStateCount: 0,
      missingStateCount: 3,
      subjectCount: 3
    });

    const [beforeGlobal, beforeBeta] = await Promise.all([
      getGlobalReviewPageData({}, database),
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database)
    ]);

    expect(beforeGlobal.selectedCard?.id).toBe(
      crossMediaFixture.alpha.termCardId
    );
    expect(beforeGlobal.selectedCard?.bucket).toBe("due");
    expect(beforeBeta?.selectedCard?.id).toBe(
      crossMediaFixture.beta.termCardId
    );
    expect(beforeBeta?.selectedCard?.bucket).toBe("due");

    const firstRun = await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:00:00.000Z")
    });

    expect(firstRun.insertedCount).toBe(3);
    expect(firstRun.legacyFallbackCount).toBe(3);
    expect(firstRun.subjectCount).toBe(3);

    const subjectStates = await database.query.reviewSubjectState.findMany();
    const termSubjectState = subjectStates.find(
      (row) =>
        row.cardId === crossMediaFixture.alpha.termCardId &&
        row.entryType === "term"
    );

    expect(subjectStates).toHaveLength(3);
    expect(termSubjectState).toMatchObject({
      cardId: crossMediaFixture.alpha.termCardId,
      crossMediaGroupId: expect.any(String),
      dueAt: "2000-01-01T00:00:00.000Z",
      entryType: "term",
      lapses: 1,
      lastReviewedAt: "2026-03-10T08:00:00.000Z",
      reps: 3,
      scheduledDays: 2,
      stability: 2.4,
      state: "review",
      subjectKey: expect.stringMatching(/^group:term:/),
      suspended: false
    });

    const coverageAfter = await inspectReviewSubjectStateCoverage(database, {
      now: new Date("2026-03-11T09:05:00.000Z")
    });

    expect(coverageAfter).toMatchObject({
      cardCount: 5,
      complete: true,
      existingStateCount: 3,
      missingStateCount: 0,
      subjectCount: 3
    });

    const secondRun = await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:05:00.000Z")
    });

    expect(secondRun.insertedCount).toBe(0);
    expect(secondRun.legacyFallbackCount).toBe(0);
    expect(secondRun.subjectCount).toBe(3);

    const [afterGlobal, afterBeta] = await Promise.all([
      getGlobalReviewPageData({}, database),
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database)
    ]);

    expect(afterGlobal.queue.dueCount).toBe(beforeGlobal.queue.dueCount);
    expect(afterGlobal.selectedCard?.id).toBe(beforeGlobal.selectedCard?.id);
    expect(afterGlobal.selectedCard?.bucket).toBe(
      beforeGlobal.selectedCard?.bucket
    );
    expect(afterBeta?.queue.dueCount).toBe(beforeBeta?.queue.dueCount ?? 0);
    expect(afterBeta?.selectedCard?.id).toBe(
      beforeBeta?.selectedCard?.id ?? null
    );
    expect(afterBeta?.selectedCard?.bucket).toBe(
      beforeBeta?.selectedCard?.bucket ?? null
    );
  });
});
