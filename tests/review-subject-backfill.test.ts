import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  card,
  cardEntryLink,
  crossMediaGroup,
  lesson,
  lessonProgress,
  media,
  preReviewConsolidationState,
  reviewCanonicalControl,
  reviewMemoryAlias,
  reviewSubjectLog,
  reviewSubjectState,
  term,
  userSetting
} from "@/db/schema";
import {
  getGlobalReviewPageData,
  getReviewPageData
} from "@/features/review/server";
import { importContentWorkspace } from "@/features/content/importer";
import {
  backfillReviewSubjectState,
  syncReviewSubjectState
} from "@/features/review/server/subject-state-backfill";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
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
      subjectKey: expect.stringMatching(/^mnemonic:v1:recognition:group:term:/),
      canonicalSubjectKey: expect.stringMatching(/^group:term:/),
      recallTask: "recognition",
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

  it("merges legacy per-entry states, compresses aliases, and leaves immutable logs untouched", async () => {
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
    const targetMemoryKey = buildReviewMemoryKey({
      canonicalSubjectKey,
      cardId: crossMediaFixture.alpha.termCardId,
      recallTask: "recognition"
    });
    const alphaLegacyMemoryKey = buildReviewMemoryKey({
      canonicalSubjectKey: `entry:term:${alphaTerm!.id}`,
      cardId: crossMediaFixture.alpha.termCardId,
      recallTask: "recognition"
    });
    const oldAliasMemoryKey = buildReviewMemoryKey({
      canonicalSubjectKey: "entry:term:pre-canonical-alpha",
      cardId: crossMediaFixture.alpha.termCardId,
      recallTask: "recognition"
    });

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
    await database.insert(reviewMemoryAlias).values({
      aliasMemoryKey: oldAliasMemoryKey,
      currentMemoryKey: alphaLegacyMemoryKey,
      migratedAt: "2026-03-10T08:00:00.000Z",
      reason: "older_rekey"
    });

    await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:00:00.000Z")
    });

    const canonicalState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, targetMemoryKey)
    });
    const oldAlphaState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, `entry:term:${alphaTerm!.id}`)
    });
    const oldBetaState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, `entry:term:${betaTerm!.id}`)
    });
    const preservedLogs = await database.query.reviewSubjectLog.findMany();
    const compressedAlias = await database.query.reviewMemoryAlias.findFirst({
      where: eq(reviewMemoryAlias.aliasMemoryKey, oldAliasMemoryKey)
    });

    expect(canonicalState).toMatchObject({
      manualOverride: true,
      canonicalSubjectKey,
      recallTask: "recognition",
      state: "known_manual",
      subjectKey: targetMemoryKey,
      subjectType: "group"
    });
    expect(oldAlphaState).toBeUndefined();
    expect(oldBetaState).toBeUndefined();
    expect(preservedLogs.map((log) => log.id).sort()).toEqual([
      "legacy-log-alpha",
      "legacy-log-beta"
    ]);
    expect(preservedLogs.map((log) => log.subjectKey).sort()).toEqual(
      [`entry:term:${alphaTerm!.id}`, `entry:term:${betaTerm!.id}`].sort()
    );
    expect(preservedLogs.every((log) => log.canonicalSubjectKey === null)).toBe(
      true
    );
    expect(preservedLogs.every((log) => log.cardId)).toBe(true);
    expect(compressedAlias).toMatchObject({
      aliasMemoryKey: oldAliasMemoryKey,
      currentMemoryKey: targetMemoryKey
    });
  });

  it("migrates legacy card subject state, logs, and pending consolidation to the canonical entry subject", async () => {
    const now = "2026-03-11T09:00:00.000Z";
    const legacySubjectKey = "card:card-legacy-card-subject";
    const canonicalSubjectKey = "entry:term:term-legacy-card-subject";
    const targetMemoryKey = buildReviewMemoryKey({
      canonicalSubjectKey,
      cardId: "card-legacy-card-subject",
      recallTask: "recognition"
    });

    await database.insert(media).values({
      id: "media-legacy-card-subject",
      slug: "legacy-card-subject",
      title: "Legacy Card Subject",
      mediaType: "test",
      segmentKind: "lesson",
      language: "ja",
      baseExplanationLanguage: "it",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    await database.insert(lesson).values({
      id: "lesson-legacy-card-subject",
      mediaId: "media-legacy-card-subject",
      segmentId: null,
      slug: "legacy-card-subject-lesson",
      title: "Legacy Card Subject Lesson",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Legacy Card Subject Lesson",
      status: "active",
      sourceFile: "legacy-card-subject.md",
      createdAt: now,
      updatedAt: now
    });
    await database.insert(term).values({
      id: "term-legacy-card-subject",
      sourceId: "term-legacy-card-subject",
      mediaId: "media-legacy-card-subject",
      lemma: "語",
      reading: "ご",
      romaji: "go",
      meaningIt: "parola",
      searchLemmaNorm: "語",
      searchReadingNorm: "ご",
      searchRomajiNorm: "go",
      createdAt: now,
      updatedAt: now
    });
    await database.insert(card).values({
      id: "card-legacy-card-subject",
      mediaId: "media-legacy-card-subject",
      lessonId: "lesson-legacy-card-subject",
      sourceFile: "legacy-card-subject.md",
      cardType: "recognition",
      front: "語",
      normalizedFront: "語",
      back: "ご - parola",
      status: "active",
      orderIndex: 1,
      createdAt: now,
      updatedAt: now
    });
    await database.insert(cardEntryLink).values({
      id: "card-entry-link-legacy-card-subject",
      cardId: "card-legacy-card-subject",
      entryType: "term",
      entryId: "term-legacy-card-subject",
      relationshipType: "primary"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: legacySubjectKey,
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "card-legacy-card-subject",
      state: "review",
      stability: 12,
      difficulty: 4,
      dueAt: "2026-03-20T00:00:00.000Z",
      lastReviewedAt: "2026-03-10T09:00:00.000Z",
      lastInteractionAt: "2026-03-10T09:00:00.000Z",
      scheduledDays: 10,
      learningSteps: 0,
      lapses: 1,
      reps: 7,
      schedulerVersion: "fsrs_v1",
      manualOverride: true,
      suspended: false,
      createdAt: now,
      updatedAt: "2026-03-10T09:00:00.000Z"
    });
    await database.insert(reviewSubjectLog).values({
      id: "legacy-card-subject-log",
      subjectKey: legacySubjectKey,
      cardId: "card-legacy-card-subject",
      answeredAt: "2026-03-10T09:00:00.000Z",
      rating: "good",
      previousState: "learning",
      newState: "review",
      scheduledDueAt: "2026-03-20T00:00:00.000Z",
      elapsedDays: 1,
      responseMs: 1200,
      schedulerVersion: "fsrs_v1"
    });
    await database.insert(preReviewConsolidationState).values({
      subjectKey: legacySubjectKey,
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      representativeCardId: "card-legacy-card-subject",
      lessonId: "lesson-legacy-card-subject",
      mediaId: "media-legacy-card-subject",
      status: "pending",
      attemptCount: 0,
      lastAttemptAt: null,
      readingPassedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    });
    await database.insert(preReviewConsolidationState).values({
      subjectKey: canonicalSubjectKey,
      subjectType: "entry",
      entryType: "term",
      crossMediaGroupId: null,
      entryId: "term-legacy-card-subject",
      representativeCardId: "card-legacy-card-subject",
      lessonId: "lesson-legacy-card-subject",
      mediaId: "media-legacy-card-subject",
      status: "passed",
      attemptCount: 2,
      lastAttemptAt: "2026-03-11T09:10:00.000Z",
      readingPassedAt: "2026-03-11T09:12:00.000Z",
      completedAt: "2026-03-11T09:15:00.000Z",
      createdAt: "2026-03-11T09:05:00.000Z",
      updatedAt: "2026-03-11T09:15:00.000Z"
    });

    await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:30:00.000Z")
    });

    const canonicalState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, targetMemoryKey)
    });
    const oldState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, legacySubjectKey)
    });
    const rewrittenLog = await database.query.reviewSubjectLog.findFirst({
      where: eq(reviewSubjectLog.id, "legacy-card-subject-log")
    });
    const migratedConsolidation =
      await database.query.preReviewConsolidationState.findFirst({
        where: eq(preReviewConsolidationState.subjectKey, targetMemoryKey)
      });
    const oldConsolidation =
      await database.query.preReviewConsolidationState.findFirst({
        where: eq(preReviewConsolidationState.subjectKey, legacySubjectKey)
      });

    expect(canonicalState).toMatchObject({
      cardId: "card-legacy-card-subject",
      dueAt: "2026-03-20T00:00:00.000Z",
      entryId: "term-legacy-card-subject",
      entryType: "term",
      lapses: 1,
      reps: 7,
      scheduledDays: 10,
      state: "review",
      canonicalSubjectKey,
      recallTask: "recognition",
      subjectKey: targetMemoryKey,
      subjectType: "entry"
    });
    expect(oldState).toBeUndefined();
    expect(rewrittenLog).toMatchObject({
      canonicalSubjectKey: null,
      subjectKey: legacySubjectKey
    });
    expect(migratedConsolidation).toMatchObject({
      attemptCount: 0,
      completedAt: null,
      entryId: "term-legacy-card-subject",
      entryType: "term",
      representativeCardId: "card-legacy-card-subject",
      canonicalSubjectKey,
      recallTask: "recognition",
      status: "pending",
      subjectKey: targetMemoryKey,
      subjectType: "entry"
    });
    expect(oldConsolidation).toBeUndefined();
  });

  it("backfills large subject and consolidation sets with bounded writes", async () => {
    const now = "2026-03-11T09:00:00.000Z";
    const rows = Array.from({ length: 1_600 }, (_, index) => index);

    await database.insert(media).values({
      id: "media-large-review-backfill",
      slug: "large-review-backfill",
      title: "Large review backfill",
      mediaType: "test",
      segmentKind: "lesson",
      language: "ja",
      baseExplanationLanguage: "it",
      status: "active",
      createdAt: now,
      updatedAt: now
    });

    await database.insert(lesson).values({
      id: "lesson-large-review-backfill",
      mediaId: "media-large-review-backfill",
      slug: "large-review-backfill-lesson",
      title: "Large Review Backfill Lesson",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Large consolidation state migration fixture.",
      status: "active",
      sourceFile: "large-review-backfill.md",
      createdAt: now,
      updatedAt: now
    });

    for (const batch of chunk(rows, 400)) {
      await database.insert(term).values(
        batch.map((index) => ({
          id: `term-large-review-backfill-${index}`,
          sourceId: `term-large-review-backfill-${index}`,
          mediaId: "media-large-review-backfill",
          lemma: `語${index}`,
          reading: `ご${index}`,
          romaji: `go-${index}`,
          meaningIt: `termine ${index}`,
          searchLemmaNorm: `語${index}`,
          searchReadingNorm: `ご${index}`,
          searchRomajiNorm: `go-${index}`,
          createdAt: now,
          updatedAt: now
        }))
      );

      await database.insert(card).values(
        batch.map((index) => ({
          id: `card-large-review-backfill-${index}`,
          mediaId: "media-large-review-backfill",
          sourceFile: "large-review-backfill.md",
          cardType: "recognition",
          front: `語${index}`,
          normalizedFront: `語${index}`,
          back: `ご${index} - termine ${index}`,
          status: "active" as const,
          orderIndex: index,
          createdAt: now,
          updatedAt: now
        }))
      );

      await database.insert(cardEntryLink).values(
        batch.map((index) => ({
          id: `card-entry-link-large-review-backfill-${index}`,
          cardId: `card-large-review-backfill-${index}`,
          entryType: "term" as const,
          entryId: `term-large-review-backfill-${index}`,
          relationshipType: "primary" as const
        }))
      );

      await database.insert(preReviewConsolidationState).values(
        batch.map((index) => ({
          subjectKey: `card:card-large-review-backfill-${index}`,
          subjectType: "card" as const,
          representativeCardId: `card-large-review-backfill-${index}`,
          lessonId: "lesson-large-review-backfill",
          mediaId: "media-large-review-backfill",
          status: "passed" as const,
          attemptCount: (index % 4) + 1,
          lastAttemptAt: now,
          readingPassedAt: now,
          completedAt: now,
          createdAt: now,
          updatedAt: now
        }))
      );

      await database.insert(reviewSubjectState).values(
        batch
          .filter((index) => index % 10 === 0)
          .map((index) => ({
            subjectKey: `card:card-large-review-backfill-${index}`,
            subjectType: "card" as const,
            entryType: null,
            crossMediaGroupId: null,
            entryId: null,
            cardId: `card-large-review-backfill-${index}`,
            state: "new" as const,
            stability: null,
            difficulty: null,
            dueAt: null,
            lastReviewedAt: null,
            lastInteractionAt: now,
            scheduledDays: 0,
            learningSteps: 0,
            lapses: 0,
            reps: 0,
            schedulerVersion: "fsrs_v1" as const,
            manualOverride: false,
            suspended: false,
            createdAt: now,
            updatedAt: now
          }))
      );
    }

    const insertSpy = vi.spyOn(database, "insert");
    const result = await syncReviewSubjectState(database, {
      now: new Date(now)
    });

    expect(
      insertSpy.mock.calls.filter(
        ([table]) => table === preReviewConsolidationState
      ).length
    ).toBeLessThanOrEqual(50);
    insertSpy.mockRestore();

    const consolidationStates =
      await database.query.preReviewConsolidationState.findMany();

    expect(consolidationStates).toHaveLength(1_600);
    for (const state of consolidationStates) {
      const index = Number(state.representativeCardId.split("-").at(-1));
      const canonicalSubjectKey = `entry:term:term-large-review-backfill-${index}`;

      expect(state).toMatchObject({
        subjectKey: buildReviewMemoryKey({
          canonicalSubjectKey,
          cardId: state.representativeCardId,
          recallTask: "recognition"
        }),
        canonicalSubjectKey,
        recallTask: "recognition",
        subjectType: "entry",
        entryId: `term-large-review-backfill-${index}`,
        lessonId: "lesson-large-review-backfill",
        mediaId: "media-large-review-backfill",
        status: "passed",
        attemptCount: (index % 4) + 1,
        lastAttemptAt: now,
        readingPassedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now
      });
    }

    expect(result.subjectCount).toBe(1_600);
    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(
      1_600
    );
    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(
          reviewSubjectState.subjectKey,
          buildReviewMemoryKey({
            canonicalSubjectKey: "entry:term:term-large-review-backfill-1590",
            cardId: "card-large-review-backfill-1590",
            recallTask: "recognition"
          })
        )
      })
    ).toMatchObject({
      cardId: "card-large-review-backfill-1590",
      subjectType: "entry"
    });
  });

  it("keeps task memories separate, preserves the legacy owner, and migrates canonical controls", async () => {
    const now = "2026-03-11T09:00:00.000Z";
    const canonicalSubjectKey = "entry:term:term-task-split";

    await database.insert(media).values({
      id: "media-task-split",
      slug: "task-split",
      title: "Task split",
      mediaType: "test",
      segmentKind: "lesson",
      language: "ja",
      baseExplanationLanguage: "it",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    await database.insert(term).values({
      id: "term-task-split",
      sourceId: "term-task-split",
      mediaId: "media-task-split",
      lemma: "語",
      reading: "ご",
      romaji: "go",
      meaningIt: "parola",
      searchLemmaNorm: "語",
      searchReadingNorm: "ご",
      searchRomajiNorm: "go",
      createdAt: now,
      updatedAt: now
    });
    await database.insert(card).values([
      {
        id: "card-task-recognition",
        mediaId: "media-task-split",
        sourceFile: "task-split.md",
        cardType: "recognition",
        front: "語",
        normalizedFront: "語",
        back: "parola",
        status: "active",
        orderIndex: 1,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "card-task-concept",
        mediaId: "media-task-split",
        sourceFile: "task-split.md",
        cardType: "concept",
        front: "語",
        normalizedFront: "語",
        back: "parola",
        status: "active",
        orderIndex: 2,
        createdAt: now,
        updatedAt: now
      }
    ]);
    await database.insert(cardEntryLink).values([
      {
        id: "link-task-recognition",
        cardId: "card-task-recognition",
        entryType: "term",
        entryId: "term-task-split",
        relationshipType: "primary"
      },
      {
        id: "link-task-concept",
        cardId: "card-task-concept",
        entryType: "term",
        entryId: "term-task-split",
        relationshipType: "primary"
      }
    ]);
    await database.insert(reviewSubjectState).values({
      subjectKey: canonicalSubjectKey,
      subjectType: "entry",
      entryType: "term",
      entryId: "term-task-split",
      cardId: "card-task-recognition",
      state: "review",
      stability: 12,
      difficulty: 4,
      dueAt: "2026-03-20T09:00:00.000Z",
      lastReviewedAt: now,
      lastInteractionAt: now,
      scheduledDays: 9,
      learningSteps: 0,
      lapses: 1,
      reps: 7,
      schedulerVersion: "fsrs_v1",
      manualOverride: true,
      suspended: false,
      createdAt: now,
      updatedAt: now
    });

    await backfillReviewSubjectState(database, { now: new Date(now) });

    const recognitionMemoryKey = buildReviewMemoryKey({
      canonicalSubjectKey,
      cardId: "card-task-recognition",
      recallTask: "recognition"
    });
    const conceptMemoryKey = buildReviewMemoryKey({
      canonicalSubjectKey,
      cardId: "card-task-concept",
      recallTask: "concept"
    });
    const [recognition, concept] = await Promise.all([
      database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, recognitionMemoryKey)
      }),
      database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, conceptMemoryKey)
      })
    ]);

    expect(recognition).toMatchObject({
      canonicalSubjectKey,
      cardId: "card-task-recognition",
      recallTask: "recognition",
      manualOverride: true,
      reps: 7,
      state: "review"
    });
    expect(concept).toMatchObject({
      canonicalSubjectKey,
      cardId: "card-task-concept",
      recallTask: "concept",
      manualOverride: true,
      reps: 0,
      state: "new"
    });
    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, canonicalSubjectKey)
      })
    ).toBeUndefined();

    expect(
      await database.query.reviewCanonicalControl.findFirst({
        where: eq(
          reviewCanonicalControl.canonicalSubjectKey,
          canonicalSubjectKey
        )
      })
    ).toMatchObject({ status: "known_manual" });
    await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T09:30:00.000Z")
    });

    const controlledStates = await database.query.reviewSubjectState.findMany();

    expect(controlledStates).toHaveLength(2);
    expect(
      controlledStates.every(
        (state) => state.manualOverride && !state.suspended
      )
    ).toBe(true);
    expect(
      controlledStates.find(
        (state) => state.subjectKey === recognitionMemoryKey
      )
    ).toMatchObject({ difficulty: 4, stability: 12, state: "review" });
    expect(
      controlledStates.find((state) => state.subjectKey === conceptMemoryKey)
    ).toMatchObject({ difficulty: null, stability: null, state: "new" });

    const beforeSecondRun = await database.query.reviewSubjectState.findMany();
    await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T10:00:00.000Z")
    });
    expect(await database.query.reviewSubjectState.findMany()).toEqual(
      beforeSecondRun
    );

    const crossMediaGroupId = "group-task-split";
    const groupCanonicalSubjectKey = `group:term:${crossMediaGroupId}`;

    await database.insert(crossMediaGroup).values({
      id: crossMediaGroupId,
      entryType: "term",
      groupKey: "task-split",
      createdAt: "2026-03-11T10:01:00.000Z",
      updatedAt: "2026-03-11T10:01:00.000Z"
    });
    await database
      .update(term)
      .set({
        crossMediaGroupId,
        updatedAt: "2026-03-11T10:01:00.000Z"
      })
      .where(eq(term.id, "term-task-split"));

    await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T10:02:00.000Z")
    });

    expect(
      await database.query.reviewCanonicalControl.findFirst({
        where: eq(
          reviewCanonicalControl.canonicalSubjectKey,
          groupCanonicalSubjectKey
        )
      })
    ).toMatchObject({ status: "known_manual" });
    expect(
      await database.query.reviewSubjectState.findMany({
        where: eq(
          reviewSubjectState.canonicalSubjectKey,
          groupCanonicalSubjectKey
        )
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          manualOverride: true,
          recallTask: "recognition",
          reps: 7,
          state: "review"
        }),
        expect.objectContaining({
          manualOverride: true,
          recallTask: "concept",
          reps: 0,
          state: "new"
        })
      ])
    );

    await database.delete(reviewSubjectState);
    await database.delete(reviewCanonicalControl);
    await database.insert(reviewSubjectState).values({
      subjectKey: canonicalSubjectKey,
      subjectType: "entry",
      entryType: "term",
      entryId: "term-task-split",
      cardId: "card-task-recognition",
      state: "review",
      stability: 12,
      difficulty: 4,
      dueAt: "2026-03-20T09:00:00.000Z",
      lastReviewedAt: now,
      lastInteractionAt: "2026-03-11T10:05:00.000Z",
      scheduledDays: 9,
      learningSteps: 0,
      lapses: 1,
      reps: 7,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: true,
      createdAt: now,
      updatedAt: "2026-03-11T10:05:00.000Z"
    });

    await backfillReviewSubjectState(database, {
      now: new Date("2026-03-11T10:10:00.000Z")
    });

    expect(
      await database.query.reviewCanonicalControl.findFirst({
        where: eq(
          reviewCanonicalControl.canonicalSubjectKey,
          groupCanonicalSubjectKey
        )
      })
    ).toMatchObject({ status: "ignored" });
    expect(
      (await database.query.reviewSubjectState.findMany()).every(
        (state) => state.suspended && !state.manualOverride
      )
    ).toBe(true);
  });

  it("records the one-time migration marker idempotently", async () => {
    const marker = await database.query.userSetting.findFirst({
      where: eq(userSetting.key, "review_memory_key_version")
    });

    expect(marker?.valueJson).toBe(JSON.stringify("mnemonic:v1"));

    await runMigrations(database);

    expect(
      await database.query.userSetting.findFirst({
        where: eq(userSetting.key, "review_memory_key_version")
      })
    ).toEqual(marker);
  });
});

function chunk<T>(values: T[], size: number) {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    batches.push(values.slice(index, index + size));
  }

  return batches;
}
