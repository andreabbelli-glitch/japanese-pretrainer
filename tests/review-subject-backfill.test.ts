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
  lessonProgress,
  reviewSubjectLog,
  reviewSubjectState,
  term
} from "@/db/schema";
import { getGlobalReviewPageData, getReviewPageData } from "@/lib/review";
import { importContentWorkspace } from "@/lib/content/importer";
import { backfillReviewSubjectState } from "@/lib/review-subject-state-backfill";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";

describe("review subject state recovery backfill", () => {
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

  it("recovers missing cross-media subject state idempotently without changing queue selection", async () => {
    const contentRoot = path.join(tempDir, "cross-media-backfill");

    await writeCrossMediaContentFixture(contentRoot);

    const importResult = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(importResult.status).toBe("completed");
    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(3);

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

    await database.delete(reviewSubjectState);

    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(0);

    const [beforeGlobal, beforeBeta] = await Promise.all([
      getGlobalReviewPageData({}, database),
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database)
    ]);

    expect(beforeGlobal.selectedCard?.id).toBe(
      crossMediaFixture.alpha.termCardId
    );
    expect(beforeGlobal.selectedCard?.bucket).toBe("new");
    expect(beforeBeta?.selectedCard?.id).toBe(
      crossMediaFixture.beta.mixedCardTermCardId
    );
    expect(beforeBeta?.selectedCard?.bucket).toBe("new");

    const firstRun = await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:00:00.000Z")
    });

    expect(firstRun.insertedCount).toBe(3);
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
      dueAt: null,
      entryType: "term",
      lapses: 0,
      lastReviewedAt: null,
      reps: 0,
      scheduledDays: 0,
      stability: null,
      state: "new",
      subjectKey: expect.stringMatching(/^group:term:/),
      suspended: false
    });

    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(3);

    const secondRun = await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:05:00.000Z")
    });

    expect(secondRun.insertedCount).toBe(0);
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

  it("merges legacy per-entry subject states into the canonical surface subject and rewrites logs", async () => {
    const contentRoot = path.join(tempDir, "cross-media-state-merge");

    await writeCrossMediaContentFixture(contentRoot);

    const importResult = await importContentWorkspace({
      contentRoot,
      database,
      now: new Date("2026-03-11T08:00:00.000Z")
    });

    expect(importResult.status).toBe("completed");

    const [alphaTerm, betaTerm] = await Promise.all([
      database.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.alpha.termSourceId)
      }),
      database.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.beta.termSourceId)
      })
    ]);

    expect(alphaTerm?.crossMediaGroupId).toBeTruthy();
    expect(betaTerm?.crossMediaGroupId).toBe(alphaTerm?.crossMediaGroupId);

    const canonicalSubjectKey = `group:term:${alphaTerm?.crossMediaGroupId}`;

    await database.insert(reviewSubjectState).values([
      {
        subjectKey: `entry:term:${alphaTerm!.id}`,
        subjectType: "entry",
        entryType: "term",
        crossMediaGroupId: null,
        entryId: alphaTerm!.id,
        cardId: crossMediaFixture.alpha.termCardId,
        state: "known_manual",
        stability: null,
        difficulty: null,
        dueAt: null,
        lastReviewedAt: null,
        lastInteractionAt: "2026-03-11T08:30:00.000Z",
        scheduledDays: 0,
        learningSteps: 0,
        lapses: 0,
        reps: 0,
        schedulerVersion: "fsrs_v1",
        manualOverride: true,
        suspended: false,
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-11T08:30:00.000Z"
      },
      {
        subjectKey: `entry:term:${betaTerm!.id}`,
        subjectType: "entry",
        entryType: "term",
        crossMediaGroupId: null,
        entryId: betaTerm!.id,
        cardId: crossMediaFixture.beta.termCardId,
        state: "review",
        stability: 99,
        difficulty: 2,
        dueAt: "2026-04-11T08:00:00.000Z",
        lastReviewedAt: "2026-03-11T08:40:00.000Z",
        lastInteractionAt: "2026-03-11T08:40:00.000Z",
        scheduledDays: 31,
        learningSteps: 0,
        lapses: 0,
        reps: 9,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false,
        createdAt: "2026-03-11T08:00:00.000Z",
        updatedAt: "2026-03-11T08:40:00.000Z"
      }
    ]);
    await database.insert(reviewSubjectLog).values([
      {
        id: "legacy-log-alpha",
        subjectKey: `entry:term:${alphaTerm!.id}`,
        cardId: crossMediaFixture.alpha.termCardId,
        answeredAt: "2026-03-11T08:30:00.000Z",
        rating: "easy",
        previousState: "new",
        newState: "known_manual",
        scheduledDueAt: null,
        elapsedDays: 0,
        responseMs: 1200,
        schedulerVersion: "fsrs_v1"
      },
      {
        id: "legacy-log-beta",
        subjectKey: `entry:term:${betaTerm!.id}`,
        cardId: crossMediaFixture.beta.termCardId,
        answeredAt: "2026-03-11T08:40:00.000Z",
        rating: "good",
        previousState: "learning",
        newState: "review",
        scheduledDueAt: "2026-04-11T08:00:00.000Z",
        elapsedDays: 1,
        responseMs: 1800,
        schedulerVersion: "fsrs_v1"
      }
    ]);

    await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:00:00.000Z")
    });

    const canonicalState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, canonicalSubjectKey)
    });
    const oldAlphaState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, `entry:term:${alphaTerm!.id}`)
    });
    const oldBetaState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, `entry:term:${betaTerm!.id}`)
    });
    const rewrittenLogs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, canonicalSubjectKey)
    });

    expect(canonicalState).toMatchObject({
      manualOverride: true,
      state: "known_manual",
      subjectKey: canonicalSubjectKey,
      subjectType: "group"
    });
    expect(oldAlphaState).toBeUndefined();
    expect(oldBetaState).toBeUndefined();
    expect(rewrittenLogs.map((log) => log.id).sort()).toEqual([
      "legacy-log-alpha",
      "legacy-log-beta"
    ]);
    expect(rewrittenLogs.every((log) => log.cardId)).toBe(true);
  });
});
