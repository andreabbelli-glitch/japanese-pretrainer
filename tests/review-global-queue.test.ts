import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabaseClient,
  createDatabaseClient,
  type DatabaseClient
} from "@/db";
import { runMigrations } from "@/db/migrate";
import {
  card,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  segment,
  userSetting
} from "@/db/schema";
import { getDashboardData } from "@/lib/dashboard";
import { getMediaDetailData } from "@/lib/media-shell";
import {
  getGlobalReviewFirstCandidateLoadResult,
  getGlobalReviewPageData,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  loadReviewOverviewSnapshots
} from "@/lib/review";
import {
  buildReviewDailyLimitSetting,
  buildReviewSubjectLogRow,
  buildReviewSubjectStateRow,
  seedTwoMediaGlobalQueueFixture
} from "./helpers/review-fixture";

describe("global review queue filtering", () => {
  let database: DatabaseClient;
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-global-queue-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("keeps local review pages aligned with the global daily limit while preserving media scoping", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const [
      globalPage,
      mediaAPage,
      mediaBPage,
      mediaAQueue,
      mediaBQueue,
      snapshots
    ] = await Promise.all([
      getGlobalReviewPageData({}, database),
      getReviewPageData("media-a", {}, database),
      getReviewPageData("media-b", {}, database),
      getReviewQueueSnapshotForMedia("media-a", database),
      getReviewQueueSnapshotForMedia("media-b", database),
      loadReviewOverviewSnapshots(database, [
        { id: "media_a", slug: "media-a" },
        { id: "media_b", slug: "media-b" }
      ])
    ]);

    expect(globalPage.queue.advanceCards).toEqual([]);
    expect(globalPage.queue.queueCount).toBe(1);
    expect(globalPage.selectedCard?.id).toBe("card_a");

    expect(mediaAPage?.queue.advanceCards).toEqual([]);
    expect(mediaAPage?.queue.newQueuedCount).toBe(1);
    expect(mediaAPage?.queue.queueCount).toBe(1);
    expect(mediaAPage?.selectedCard?.id).toBe("card_a");

    expect(mediaBPage?.queue.advanceCards).toEqual([]);
    expect(mediaBPage?.queue.newAvailableCount).toBe(1);
    expect(mediaBPage?.queue.newQueuedCount).toBe(0);
    expect(mediaBPage?.queue.queueCount).toBe(0);
    expect(mediaBPage?.selectedCard).toBeNull();

    expect(mediaAQueue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
      "card_a"
    ]);
    expect(mediaAQueue?.newQueuedCount).toBe(1);
    expect(mediaBQueue?.cards).toEqual([]);
    expect(mediaBQueue?.newAvailableCount).toBe(1);
    expect(mediaBQueue?.newQueuedCount).toBe(0);
    expect(mediaBQueue?.queueCount).toBe(0);

    expect(snapshots.get("media_a")?.queueCount).toBe(1);
    expect(snapshots.get("media_a")?.newQueuedCount).toBe(1);
    expect(snapshots.get("media_b")?.queueCount).toBe(0);
    expect(snapshots.get("media_b")?.newAvailableCount).toBe(1);
    expect(snapshots.get("media_b")?.newQueuedCount).toBe(0);
  });

  it("ignores cross-media card deep links on local review pages", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const mediaAPage = await getReviewPageData(
      "media-a",
      { card: "card_b" },
      database
    );

    expect(mediaAPage?.media.slug).toBe("media-a");
    expect(mediaAPage?.selectedCard?.id).toBe("card_a");
    expect(mediaAPage?.selectedCard?.mediaSlug).toBe("media-a");
    expect(mediaAPage?.selectedCardContext.isQueueCard).toBe(true);
  });

  it("applies the same global daily limit on local review pages after another media introduces a new subject", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const now = new Date("2026-03-10T13:00:00.000Z");
    const tomorrow = new Date("2026-03-11T13:00:00.000Z");
    const nowIso = now.toISOString();
    const tomorrowIso = tomorrow.toISOString();

    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      await database.insert(reviewSubjectState).values(
        buildReviewSubjectStateRow(
          {
            cardId: "card_a",
            difficulty: 2.5,
            dueAt: tomorrowIso,
            lapses: 0,
            learningSteps: 0,
            lastInteractionAt: nowIso,
            lastReviewedAt: nowIso,
            reps: 1,
            scheduledDays: 1,
            state: "review",
            stability: 3,
            subjectKey: "card:card_a"
          },
          nowIso
        )
      );
      await database.insert(reviewSubjectLog).values(
        buildReviewSubjectLogRow({
          answeredAt: nowIso,
          cardId: "card_a",
          elapsedDays: 0,
          id: "review_subject_log_card_a_introduced_today",
          newState: "review",
          previousState: "new",
          rating: "good",
          responseMs: null,
          scheduledDueAt: tomorrowIso,
          subjectKey: "card:card_a"
        })
      );

      const [
        globalPage,
        mediaAPage,
        mediaBPage,
        mediaBQueue,
        dashboard,
        mediaBDetail
      ] = await Promise.all([
        getGlobalReviewPageData({}, database),
        getReviewPageData("media-a", {}, database),
        getReviewPageData("media-b", {}, database),
        getReviewQueueSnapshotForMedia("media-b", database),
        getDashboardData(database),
        getMediaDetailData("media-b", database)
      ]);

      expect(globalPage.queue.newQueuedCount).toBe(0);
      expect(globalPage.queue.queueCount).toBe(0);

      expect(mediaAPage?.queue.newQueuedCount).toBe(0);
      expect(mediaAPage?.queue.queueCount).toBe(0);

      expect(mediaBPage?.queue.newAvailableCount).toBe(1);
      expect(mediaBPage?.queue.newQueuedCount).toBe(0);
      expect(mediaBPage?.queue.queueCount).toBe(0);
      expect(mediaBPage?.selectedCard).toBeNull();

      expect(mediaBQueue?.newAvailableCount).toBe(1);
      expect(mediaBQueue?.newQueuedCount).toBe(0);
      expect(mediaBQueue?.queueCount).toBe(0);

      expect(
        dashboard.media.find((item) => item.slug === "media-b")?.reviewStatValue
      ).toBe("In pausa");
      expect(
        dashboard.media.find((item) => item.slug === "media-b")
          ?.reviewQueueLabel
      ).toBe(
        "Le card presenti non richiedono Review attiva in questo momento."
      );

      expect(mediaBDetail?.reviewStatValue).toBe("In pausa");
      expect(mediaBDetail?.reviewQueueLabel).toBe(
        "Le card presenti non richiedono Review attiva in questo momento."
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses top-up batches in global review without changing the base daily limit", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const basePage = await getGlobalReviewPageData({}, database);
    const toppedUpPage = await getGlobalReviewPageData(
      {
        extraNew: "10"
      },
      database
    );

    expect(basePage.queue.dailyLimit).toBe(1);
    expect(basePage.queue.newAvailableCount).toBe(2);
    expect(basePage.queue.newQueuedCount).toBe(1);
    expect(basePage.queue.queueCount).toBe(1);

    expect(toppedUpPage.queue.dailyLimit).toBe(1);
    expect(toppedUpPage.session.extraNewCount).toBe(10);
    expect(toppedUpPage.queue.newAvailableCount).toBe(2);
    expect(toppedUpPage.queue.newQueuedCount).toBe(2);
    expect(toppedUpPage.queue.queueCount).toBe(2);
    expect(toppedUpPage.queue.queueLabel).toContain(
      "nella rotazione attuale di questa sessione"
    );
    expect(toppedUpPage.queue.queueLabel).not.toContain("limite giornaliero");
    expect(toppedUpPage.selectedCard?.id).toBe("card_a");
  });

  it("returns a minimal first-candidate payload that matches the full global selection", async () => {
    await database.insert(media).values([
      {
        id: "media_a",
        slug: "media-a",
        title: "Media A",
        mediaType: "game",
        segmentKind: "chapter",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture A",
        status: "active",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      },
      {
        id: "media_b",
        slug: "media-b",
        title: "Media B",
        mediaType: "game",
        segmentKind: "chapter",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture B",
        status: "active",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(lesson).values([
      {
        id: "lesson_a",
        mediaId: "media_a",
        segmentId: null,
        slug: "intro-a",
        title: "Lesson A",
        orderIndex: 1,
        difficulty: "beginner",
        summary: "Lesson A",
        status: "active",
        sourceFile: "tests/review-global-queue/media-a.md",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      },
      {
        id: "lesson_b",
        mediaId: "media_b",
        segmentId: null,
        slug: "intro-b",
        title: "Lesson B",
        orderIndex: 1,
        difficulty: "beginner",
        summary: "Lesson B",
        status: "active",
        sourceFile: "tests/review-global-queue/media-b.md",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(lessonProgress).values([
      {
        lessonId: "lesson_a",
        status: "completed",
        completedAt: "2026-03-10T09:00:00.000Z"
      },
      {
        lessonId: "lesson_b",
        status: "completed",
        completedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(card).values([
      {
        id: "card_a",
        mediaId: "media_a",
        lessonId: "lesson_a",
        segmentId: null,
        sourceFile: "tests/review-global-queue/media-a.md",
        cardType: "recognition",
        front: "A",
        back: "A back",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T10:00:00.000Z",
        updatedAt: "2026-03-10T10:00:00.000Z"
      },
      {
        id: "card_b",
        mediaId: "media_b",
        lessonId: "lesson_b",
        segmentId: null,
        sourceFile: "tests/review-global-queue/media-b.md",
        cardType: "recognition",
        front: "B",
        back: "B back",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database
      .insert(userSetting)
      .values(buildReviewDailyLimitSetting("2026-03-10T11:00:00.000Z"));

    const [firstCandidate, fullPage] = await Promise.all([
      getGlobalReviewFirstCandidateLoadResult({}, database),
      getGlobalReviewPageData({}, database)
    ]);

    expect(firstCandidate.kind).toBe("ready");
    expect(fullPage.selectedCard?.id).toBe("card_a");

    if (firstCandidate.kind !== "ready") {
      return;
    }

    expect(firstCandidate.data.selectedCard?.id).toBe(
      fullPage.selectedCard?.id
    );
    expect(firstCandidate.data.selectedCard?.bucket).toBe(
      fullPage.selectedCard?.bucket
    );
    expect(firstCandidate.data.selectedCardContext).toMatchObject({
      bucket: fullPage.selectedCard?.bucket ?? null,
      isQueueCard: true,
      position: 1,
      remainingCount: 0,
      showAnswer: false
    });
    expect(firstCandidate.data.queueCardIds).toEqual(fullPage.queueCardIds);
    expect(firstCandidate.data.queue.queueCount).toBe(
      fullPage.queue.queueCount
    );
    expect(
      firstCandidate.data.queue.advanceCards.map((card) => card.id)
    ).toEqual(fullPage.queueCardIds.slice(1, 4));
    expect(firstCandidate.data.nextCardId).toBe(
      fullPage.queueCardIds[1] ?? null
    );
    expect("entries" in firstCandidate.data.selectedCard!).toBe(false);
    expect("pronunciations" in firstCandidate.data.selectedCard!).toBe(false);
    expect("contexts" in firstCandidate.data.selectedCard!).toBe(false);
    expect("gradePreviews" in firstCandidate.data.selectedCard!).toBe(false);
  });

  it("applies the segment filter to the global first-candidate payload", async () => {
    await database.insert(media).values([
      {
        id: "media_a",
        slug: "media-a",
        title: "Media A",
        mediaType: "game",
        segmentKind: "chapter",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture A",
        status: "active",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      },
      {
        id: "media_b",
        slug: "media-b",
        title: "Media B",
        mediaType: "game",
        segmentKind: "chapter",
        language: "ja",
        baseExplanationLanguage: "it",
        description: "Fixture B",
        status: "active",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(segment).values([
      {
        id: "segment_a",
        mediaId: "media_a",
        slug: "segment-a",
        title: "Segment A",
        orderIndex: 1,
        segmentType: "chapter",
        notes: null
      },
      {
        id: "segment_b",
        mediaId: "media_b",
        slug: "segment-b",
        title: "Segment B",
        orderIndex: 1,
        segmentType: "chapter",
        notes: null
      }
    ]);
    await database.insert(lesson).values([
      {
        id: "lesson_a",
        mediaId: "media_a",
        segmentId: "segment_a",
        slug: "intro-a",
        title: "Lesson A",
        orderIndex: 1,
        difficulty: "beginner",
        summary: "Lesson A",
        status: "active",
        sourceFile: "tests/review-global-queue/media-a.md",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      },
      {
        id: "lesson_b",
        mediaId: "media_b",
        segmentId: "segment_b",
        slug: "intro-b",
        title: "Lesson B",
        orderIndex: 1,
        difficulty: "beginner",
        summary: "Lesson B",
        status: "active",
        sourceFile: "tests/review-global-queue/media-b.md",
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(lessonProgress).values([
      {
        lessonId: "lesson_a",
        status: "completed",
        completedAt: "2026-03-10T09:00:00.000Z"
      },
      {
        lessonId: "lesson_b",
        status: "completed",
        completedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database.insert(card).values([
      {
        id: "card_a",
        mediaId: "media_a",
        lessonId: "lesson_a",
        segmentId: "segment_a",
        sourceFile: "tests/review-global-queue/media-a.md",
        cardType: "recognition",
        front: "A",
        back: "A back",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T10:00:00.000Z",
        updatedAt: "2026-03-10T10:00:00.000Z"
      },
      {
        id: "card_b",
        mediaId: "media_b",
        lessonId: "lesson_b",
        segmentId: "segment_b",
        sourceFile: "tests/review-global-queue/media-b.md",
        cardType: "recognition",
        front: "B",
        back: "B back",
        exampleJp: null,
        exampleIt: null,
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z"
      }
    ]);
    await database
      .insert(userSetting)
      .values(buildReviewDailyLimitSetting("2026-03-10T11:00:00.000Z"));

    const [firstCandidate, fullPage] = await Promise.all([
      getGlobalReviewFirstCandidateLoadResult(
        {
          segment: "segment_b"
        },
        database
      ),
      getGlobalReviewPageData(
        {
          segment: "segment_b"
        },
        database
      )
    ]);

    expect(firstCandidate.kind).toBe("ready");
    expect(fullPage.selectedCard?.id).toBe("card_b");

    if (firstCandidate.kind !== "ready") {
      return;
    }

    expect(firstCandidate.data.selectedCard?.id).toBe("card_b");
    expect(firstCandidate.data.selectedCard?.id).toBe(
      fullPage.selectedCard?.id
    );
    expect(firstCandidate.data.session.segmentId).toBe("segment_b");
    expect(firstCandidate.data.queue.queueCount).toBe(
      fullPage.queue.queueCount
    );
  });
});
