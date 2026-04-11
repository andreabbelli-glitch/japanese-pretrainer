import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  card,
  closeDatabaseClient,
  createDatabaseClient,
  developmentFixture,
  lesson,
  lessonProgress,
  media,
  reviewSubjectState,
  runMigrations,
  seedDevelopmentDatabase,
  type DatabaseClient
} from "@/db";
import { importContentWorkspace } from "@/lib/content/importer";
import { getDashboardData } from "@/lib/dashboard";
import { getMediaDetailData } from "@/lib/media-shell";
import { loadGlobalReviewOverviewSnapshot } from "@/lib/review";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";

describe("app shell live data", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-app-shell-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("derives overview metrics from live lesson, entry, and review tables", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z",
        lastOpenedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    await database
      .update(reviewSubjectState)
      .set({
        state: "known_manual",
        dueAt: "2026-03-01T00:00:00.000Z",
        manualOverride: true
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    const media = await getMediaDetailData(developmentFixture.mediaSlug, database);

    expect(media).not.toBeNull();
    expect(media?.previewEntries[0]?.label).toBe("行く");
    expect(media?.lessonsCompleted).toBe(1);
    expect(media?.lessonsTotal).toBe(1);
    expect(media?.entriesKnown).toBe(2);
    expect(media?.entriesTotal).toBe(2);
    expect(media?.cardsDue).toBe(0);
    expect(media?.activeReviewCards).toBe(0);
    expect(media?.reviewStatValue).toBe("In pausa");
    expect(media?.reviewStatDetail).toContain("non richiedono Review attiva");

    const dashboard = await getDashboardData(database);

    expect(dashboard.totals.lessonsCompleted).toBe(1);
    expect(dashboard.totals.entriesKnown).toBe(2);
    expect(dashboard.review.cardsDue).toBe(0);
    // The dashboard now uses lesson-aware SQL counts, so the remaining
    // lesson-bound review card is filtered out once its driving entry is
    // manually marked known.
    expect(dashboard.review.activeReviewCards).toBe(0);
    expect(dashboard.review.queueLabel).toMatch(/esclus[ae] manualmente/);
  });

  it("prefers the most reviewable media for review entry points", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    await database.insert(media).values({
      id: "media_duel_masters",
      slug: "duel-masters-dm25",
      title: "Duel Masters",
      mediaType: "tcg",
      segmentKind: "deck",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Media con review veramente pronta.",
      status: "active",
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });

    await database.insert(lesson).values({
      id: "lesson_duel_masters_intro",
      mediaId: "media_duel_masters",
      segmentId: null,
      slug: "tcg-core-overview",
      title: "TCG Core Overview",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Lesson Duel Masters.",
      status: "active",
      sourceFile: "content/media/duel-masters-dm25/textbook/001-tcg-core-overview.md",
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });
    await database.insert(lessonProgress).values({
      lessonId: "lesson_duel_masters_intro",
      status: "completed",
      completedAt: "2026-03-08T09:30:00.000Z"
    });

    await database.insert(card).values({
      id: "card_duel_masters_due",
      mediaId: "media_duel_masters",
      lessonId: "lesson_duel_masters_intro",
      segmentId: null,
      sourceFile: "content/media/duel-masters-dm25/cards/001-tcg-core.md",
      cardType: "recognition",
      front: "シールド",
      back: "scudo",
      status: "active",
      orderIndex: 1,
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });

    await database.insert(reviewSubjectState).values({
      subjectKey: "card:card_duel_masters_due",
      subjectType: "card",
      entryType: null,
      crossMediaGroupId: null,
      entryId: null,
      cardId: "card_duel_masters_due",
      state: "review",
      stability: 3,
      difficulty: 2.5,
      dueAt: "2026-03-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-08T09:00:00.000Z",
      lastInteractionAt: "2026-03-08T09:00:00.000Z",
      scheduledDays: 0,
      learningSteps: 0,
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });

    const dashboard = await getDashboardData(database);
    const duelMastersMedia = await getMediaDetailData("duel-masters-dm25", database);

    expect(dashboard.focusMedia?.slug).toBe("duel-masters-dm25");
    expect(dashboard.reviewMedia?.slug).toBe("duel-masters-dm25");
    expect(
      dashboard.media.find((item) => item.slug === developmentFixture.mediaSlug)
        ?.previewEntries
    ).toHaveLength(0);
    expect(duelMastersMedia?.reviewStatValue).toBe("1 da ripassare");
  });

  it("uses the deduplicated global review snapshot for dashboard review totals", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

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

    const sharedSubjectState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.cardId, crossMediaFixture.alpha.termCardId)
    });

    expect(sharedSubjectState).not.toBeNull();

    await database
      .update(reviewSubjectState)
      .set({
        state: "review",
        stability: 2.4,
        difficulty: 3.1,
        dueAt: "2000-01-01T00:00:00.000Z",
        lastReviewedAt: "2026-03-10T08:00:00.000Z",
        lastInteractionAt: "2026-03-10T08:00:00.000Z",
        scheduledDays: 2,
        learningSteps: 0,
        lapses: 0,
        reps: 3,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false
      })
      .where(eq(reviewSubjectState.subjectKey, sharedSubjectState!.subjectKey));

    const [dashboard, globalReviewOverview] = await Promise.all([
      getDashboardData(database),
      loadGlobalReviewOverviewSnapshot(database)
    ]);

    expect(globalReviewOverview.dueCount).toBeGreaterThan(0);
    expect(dashboard.review.cardsDue).toBe(globalReviewOverview.dueCount);
    expect(dashboard.review.activeReviewCards).toBe(
      globalReviewOverview.activeCards
    );
    expect(dashboard.review.queueCount).toBe(globalReviewOverview.queueCount);
    expect(dashboard.review.newQueuedCount).toBe(
      globalReviewOverview.newQueuedCount
    );
    expect(dashboard.review.queueLabel).toBe(globalReviewOverview.queueLabel);
    expect(
      dashboard.media.reduce((sum, item) => sum + item.cardsDue, 0)
    ).toBeGreaterThan(dashboard.review.cardsDue);
    expect(
      dashboard.media.reduce((sum, item) => sum + item.activeReviewCards, 0)
    ).toBeGreaterThan(dashboard.review.activeReviewCards);
  });

  it("keeps queued new cards visible in the global dashboard totals", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(
        eq(
          reviewSubjectState.subjectKey,
          `entry:term:${developmentFixture.termDbId}`
        )
      );

    await database.insert(card).values({
      id: "card_dashboard_new_queue",
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/dashboard-new-queue.md",
      cardType: "recognition",
      front: "ダッシュボード",
      back: "dashboard",
      notesIt: "Serve per verificare le nuove card in coda sulla dashboard.",
      status: "active",
      orderIndex: 99,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });

    const dashboard = await getDashboardData(database);

    expect(dashboard.review.cardsDue).toBe(0);
    expect(dashboard.review.activeReviewCards).toBe(1);
    expect(dashboard.review.newQueuedCount).toBe(1);
    expect(dashboard.review.queueCount).toBe(1);
    expect(dashboard.review.queueLabel).toContain("1 nuova");
  });
});
