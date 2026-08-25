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
import { refreshReviewCardIdentityCache } from "@/db/backfills/review-card-identity";
import { runMigrations } from "@/db/migrate";
import {
  card,
  cardEntryLink,
  crossMediaGroup,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  segment,
  term,
  userSetting
} from "@/db/schema";
import { getDashboardData } from "@/features/dashboard/server";
import { getMediaDetailData } from "@/features/media/server";
import { getMediaProgressPageData } from "@/features/progress/server";
import {
  getGlobalReviewFirstCandidateLoadResult,
  getGlobalReviewPageData,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  loadReviewOverviewSnapshots
} from "@/features/review/server";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
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

  it("keeps media shell review shortcuts aligned with the global daily queue order", async () => {
    await seedTwoMediaGlobalQueueFixture(database);

    const [dashboard, mediaADetail, mediaBDetail, mediaBProgress] =
      await Promise.all([
        getDashboardData(database),
        getMediaDetailData("media-a", database),
        getMediaDetailData("media-b", database),
        getMediaProgressPageData("media-b", database)
      ]);

    expect(dashboard.review.newQueuedCount).toBe(1);
    expect(dashboard.review.queueCount).toBe(1);

    expect(
      dashboard.media.find((item) => item.slug === "media-a")?.reviewStatValue
    ).toBe("Nuove pronte");
    expect(
      dashboard.media.find((item) => item.slug === "media-b")?.reviewStatValue
    ).toBe("In pausa");
    expect(mediaADetail?.reviewStatValue).toBe("Nuove pronte");
    expect(mediaBDetail?.reviewStatValue).toBe("In pausa");
    expect(mediaBDetail?.reviewQueueLabel).toBe(
      "Le card presenti non richiedono Review attiva in questo momento."
    );
    expect(mediaBProgress?.review.newQueuedCount).toBe(0);
    expect(mediaBProgress?.review.queueCount).toBe(0);
  });

  it("points the dashboard review shortcut at the media with a globally queued new card", async () => {
    await seedTwoMediaGlobalQueueFixture(database);
    await database
      .update(card)
      .set({
        updatedAt: "2026-03-10T12:00:00.000Z"
      })
      .where(eq(card.id, "card_b"));

    const dashboard = await getDashboardData(database);

    expect(dashboard.reviewMedia?.slug).toBe("media-b");
    expect(
      dashboard.media.find((item) => item.slug === "media-a")?.reviewStatValue
    ).toBe("In pausa");
    expect(
      dashboard.media.find((item) => item.slug === "media-b")?.reviewStatValue
    ).toBe("Nuove pronte");
  });

  it("shows the first globally queued new subject front in single-media progress", async () => {
    await seedCrossMediaNewOrderingFixture(database);

    const [mediaBProgress, snapshots] = await Promise.all([
      getMediaProgressPageData("media-b", database),
      loadReviewOverviewSnapshots(database, [
        { id: "media_b", slug: "media-b" }
      ])
    ]);
    const mediaBSnapshot = snapshots.get("media_b");

    expect(mediaBSnapshot?.newAvailableCount).toBe(2);
    expect(mediaBSnapshot?.newQueuedCount).toBe(1);
    expect(mediaBSnapshot?.nextCardFront).toBe("B shared");
    expect(mediaBProgress?.review.newAvailableCount).toBe(2);
    expect(mediaBProgress?.review.newQueuedCount).toBe(1);
    expect(mediaBProgress?.review.nextCardFront).toBe("B shared");
  });

  it("does not count a globally queued new subject when the local shared sibling is suspended", async () => {
    await seedCrossMediaNewOrderingFixture(database);
    await database
      .update(card)
      .set({ status: "suspended" })
      .where(eq(card.id, "card_b_shared"));

    const [mediaBPage, mediaBQueue, mediaBProgress, snapshots] =
      await Promise.all([
        getReviewPageData("media-b", {}, database),
        getReviewQueueSnapshotForMedia("media-b", database),
        getMediaProgressPageData("media-b", database),
        loadReviewOverviewSnapshots(database, [
          { id: "media_b", slug: "media-b" }
        ])
      ]);
    const mediaBSnapshot = snapshots.get("media_b");

    expect(mediaBSnapshot?.newAvailableCount).toBe(1);
    expect(mediaBSnapshot?.newQueuedCount).toBe(0);
    expect(mediaBSnapshot?.queueCount).toBe(0);
    expect(mediaBSnapshot?.nextCardFront).toBeUndefined();

    expect(mediaBPage?.queue.newAvailableCount).toBe(1);
    expect(mediaBPage?.queue.newQueuedCount).toBe(0);
    expect(mediaBPage?.queue.queueCount).toBe(0);
    expect(mediaBPage?.queueCardIds).toEqual([]);
    expect(mediaBPage?.selectedCard).toBeNull();

    expect(mediaBQueue?.cards).toEqual([]);
    expect(mediaBQueue?.newAvailableCount).toBe(1);
    expect(mediaBQueue?.newQueuedCount).toBe(0);
    expect(mediaBQueue?.queueCount).toBe(0);

    expect(mediaBProgress?.review.newAvailableCount).toBe(1);
    expect(mediaBProgress?.review.newQueuedCount).toBe(0);
    expect(mediaBProgress?.review.queueCount).toBe(0);
    expect(mediaBProgress?.review.nextCardFront).toBeUndefined();
  });

  it("shows the first globally due subject front in single-media progress", async () => {
    await seedCrossMediaDueOrderingFixture(database);
    const now = new Date("2026-03-10T13:00:00.000Z");

    await database.insert(reviewSubjectLog).values(
      buildReviewSubjectLogRow({
        answeredAt: now.toISOString(),
        cardId: "card_a_due_one",
        elapsedDays: 0,
        id: "review_subject_log_exhaust_new_slots_for_due_front",
        newState: "review",
        previousState: "new",
        rating: "good",
        responseMs: null,
        scheduledDueAt: "2026-03-11T13:00:00.000Z",
        subjectKey: "group:term:due_group_one"
      })
    );

    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const [mediaBPage, mediaBProgress] = await Promise.all([
        getReviewPageData("media-b", {}, database),
        getMediaProgressPageData("media-b", database)
      ]);

      expect(mediaBPage?.selectedCard?.front).toBe("B due one");
      expect(mediaBProgress?.review.dueCount).toBe(2);
      expect(mediaBProgress?.review.newQueuedCount).toBe(0);
      expect(mediaBProgress?.review.nextCardFront).toBe("B due one");
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips suspended local shared siblings when showing the first globally due subject front", async () => {
    await seedCrossMediaDueOrderingFixture(database);
    await database
      .update(card)
      .set({ status: "suspended" })
      .where(eq(card.id, "card_b_due_one"));

    const now = new Date("2026-03-10T13:00:00.000Z");

    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const [mediaBPage, mediaBQueue, mediaBProgress, snapshots] =
        await Promise.all([
          getReviewPageData("media-b", {}, database),
          getReviewQueueSnapshotForMedia("media-b", database),
          getMediaProgressPageData("media-b", database),
          loadReviewOverviewSnapshots(database, [
            { id: "media_b", slug: "media-b" }
          ])
        ]);
      const mediaBSnapshot = snapshots.get("media_b");

      expect(mediaBSnapshot?.dueCount).toBe(1);
      expect(mediaBSnapshot?.queueCount).toBe(1);
      expect(mediaBSnapshot?.nextCardFront).toBe("B due two");

      expect(mediaBPage?.queue.dueCount).toBe(1);
      expect(mediaBPage?.queue.queueCount).toBe(1);
      expect(mediaBPage?.queueCardIds).toEqual(["card_b_due_two"]);
      expect(mediaBPage?.selectedCard?.id).toBe("card_b_due_two");

      expect(mediaBQueue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
        "card_b_due_two"
      ]);
      expect(mediaBQueue?.dueCount).toBe(1);
      expect(mediaBQueue?.queueCount).toBe(1);

      expect(mediaBProgress?.review.dueCount).toBe(1);
      expect(mediaBProgress?.review.queueCount).toBe(1);
      expect(mediaBProgress?.review.nextCardFront).toBe("B due two");
    } finally {
      vi.useRealTimers();
    }
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
    await database.insert(term).values(
      buildReviewTerm({
        audioSrc: "assets/audio/term/a-term/a-term.mp3",
        crossMediaGroupId: null,
        id: "term_a",
        lemma: "A",
        mediaId: "media_a",
        sourceId: "a"
      })
    );
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
      .insert(cardEntryLink)
      .values(buildReviewCardEntryLink("card_a_term_a", "card_a", "term_a"));
    await database
      .insert(userSetting)
      .values(buildReviewDailyLimitSetting("2026-03-10T11:00:00.000Z"));
    await refreshReviewCardIdentityCache(database);

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
    expect(firstCandidate.data.selectedCard?.pronunciations).toEqual(
      fullPage.selectedCard?.pronunciations
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
    await refreshReviewCardIdentityCache(database);

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

async function seedCrossMediaNewOrderingFixture(database: DatabaseClient) {
  const createdAt = "2026-03-10T09:00:00.000Z";

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
      createdAt,
      updatedAt: createdAt
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
      createdAt,
      updatedAt: createdAt
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
      createdAt,
      updatedAt: createdAt
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
      createdAt,
      updatedAt: createdAt
    }
  ]);
  await database.insert(lessonProgress).values([
    {
      lessonId: "lesson_a",
      status: "completed",
      completedAt: createdAt
    },
    {
      lessonId: "lesson_b",
      status: "completed",
      completedAt: createdAt
    }
  ]);
  await database.insert(crossMediaGroup).values({
    id: "shared_group",
    entryType: "term",
    groupKey: "shared",
    createdAt,
    updatedAt: createdAt
  });
  await database.insert(term).values([
    buildReviewTerm({
      crossMediaGroupId: "shared_group",
      id: "term_a_shared",
      lemma: "A shared",
      mediaId: "media_a",
      sourceId: "a-shared"
    }),
    buildReviewTerm({
      crossMediaGroupId: "shared_group",
      id: "term_b_shared",
      lemma: "B shared",
      mediaId: "media_b",
      sourceId: "b-shared"
    }),
    buildReviewTerm({
      crossMediaGroupId: null,
      id: "term_b_local",
      lemma: "B local",
      mediaId: "media_b",
      sourceId: "b-local"
    })
  ]);
  await database.insert(card).values([
    {
      id: "card_a_shared",
      mediaId: "media_a",
      lessonId: "lesson_a",
      segmentId: null,
      sourceFile: "tests/review-global-queue/media-a.md",
      cardType: "recognition",
      front: "A shared",
      back: "A shared back",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 1,
      createdAt,
      updatedAt: "2026-03-10T12:00:00.000Z"
    },
    {
      id: "card_b_shared",
      mediaId: "media_b",
      lessonId: "lesson_b",
      segmentId: null,
      sourceFile: "tests/review-global-queue/media-b.md",
      cardType: "recognition",
      front: "B shared",
      back: "B shared back",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 1,
      createdAt,
      updatedAt: "2026-03-10T09:00:00.000Z"
    },
    {
      id: "card_b_local",
      mediaId: "media_b",
      lessonId: "lesson_b",
      segmentId: null,
      sourceFile: "tests/review-global-queue/media-b.md",
      cardType: "recognition",
      front: "B local",
      back: "B local back",
      exampleJp: null,
      exampleIt: null,
      notesIt: null,
      status: "active",
      orderIndex: 2,
      createdAt,
      updatedAt: "2026-03-10T11:00:00.000Z"
    }
  ]);
  await database.insert(cardEntryLink).values([
    {
      id: "link_a_shared",
      cardId: "card_a_shared",
      entryType: "term",
      entryId: "term_a_shared",
      relationshipType: "primary"
    },
    {
      id: "link_b_shared",
      cardId: "card_b_shared",
      entryType: "term",
      entryId: "term_b_shared",
      relationshipType: "primary"
    },
    {
      id: "link_b_local",
      cardId: "card_b_local",
      entryType: "term",
      entryId: "term_b_local",
      relationshipType: "primary"
    }
  ]);
  await database
    .insert(userSetting)
    .values(buildReviewDailyLimitSetting("2026-03-10T13:00:00.000Z"));
  await refreshReviewCardIdentityCache(database);
}

async function seedCrossMediaDueOrderingFixture(database: DatabaseClient) {
  const createdAt = "2026-03-10T09:00:00.000Z";

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
      createdAt,
      updatedAt: createdAt
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
      createdAt,
      updatedAt: createdAt
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
      createdAt,
      updatedAt: createdAt
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
      createdAt,
      updatedAt: createdAt
    }
  ]);
  await database.insert(lessonProgress).values([
    {
      lessonId: "lesson_a",
      status: "completed",
      completedAt: createdAt
    },
    {
      lessonId: "lesson_b",
      status: "completed",
      completedAt: createdAt
    }
  ]);
  await database.insert(crossMediaGroup).values([
    {
      id: "due_group_one",
      entryType: "term",
      groupKey: "due-one",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "due_group_two",
      entryType: "term",
      groupKey: "due-two",
      createdAt,
      updatedAt: createdAt
    }
  ]);
  await database.insert(term).values([
    buildReviewTerm({
      crossMediaGroupId: "due_group_one",
      id: "term_a_due_one",
      lemma: "A due one",
      mediaId: "media_a",
      sourceId: "a-due-one"
    }),
    buildReviewTerm({
      crossMediaGroupId: "due_group_one",
      id: "term_b_due_one",
      lemma: "B due one",
      mediaId: "media_b",
      sourceId: "b-due-one"
    }),
    buildReviewTerm({
      crossMediaGroupId: "due_group_two",
      id: "term_a_due_two",
      lemma: "A due two",
      mediaId: "media_a",
      sourceId: "a-due-two"
    }),
    buildReviewTerm({
      crossMediaGroupId: "due_group_two",
      id: "term_b_due_two",
      lemma: "B due two",
      mediaId: "media_b",
      sourceId: "b-due-two"
    })
  ]);
  await database.insert(card).values([
    buildReviewCard({
      front: "A due one",
      id: "card_a_due_one",
      lessonId: "lesson_a",
      mediaId: "media_a",
      orderIndex: 1
    }),
    buildReviewCard({
      front: "A due two",
      id: "card_a_due_two",
      lessonId: "lesson_a",
      mediaId: "media_a",
      orderIndex: 2
    }),
    buildReviewCard({
      front: "B due one",
      id: "card_b_due_one",
      lessonId: "lesson_b",
      mediaId: "media_b",
      orderIndex: 2
    }),
    buildReviewCard({
      front: "B due two",
      id: "card_b_due_two",
      lessonId: "lesson_b",
      mediaId: "media_b",
      orderIndex: 1
    })
  ]);
  await database
    .insert(cardEntryLink)
    .values([
      buildReviewCardEntryLink(
        "link_a_due_one",
        "card_a_due_one",
        "term_a_due_one"
      ),
      buildReviewCardEntryLink(
        "link_b_due_one",
        "card_b_due_one",
        "term_b_due_one"
      ),
      buildReviewCardEntryLink(
        "link_a_due_two",
        "card_a_due_two",
        "term_a_due_two"
      ),
      buildReviewCardEntryLink(
        "link_b_due_two",
        "card_b_due_two",
        "term_b_due_two"
      )
    ]);
  await database.insert(reviewSubjectState).values([
    buildDueSubjectState({
      cardId: "card_a_due_one",
      crossMediaGroupId: "due_group_one",
      entryId: "term_a_due_one",
      subjectKey: "group:term:due_group_one"
    }),
    buildDueSubjectState({
      cardId: "card_a_due_two",
      crossMediaGroupId: "due_group_two",
      entryId: "term_a_due_two",
      subjectKey: "group:term:due_group_two"
    })
  ]);
  await database
    .insert(userSetting)
    .values(buildReviewDailyLimitSetting("2026-03-10T13:00:00.000Z"));
  await refreshReviewCardIdentityCache(database);
}

function buildReviewTerm(input: {
  audioSrc?: string;
  crossMediaGroupId: string | null;
  id: string;
  lemma: string;
  mediaId: string;
  sourceId: string;
}): typeof term.$inferInsert {
  return {
    id: input.id,
    sourceId: input.sourceId,
    mediaId: input.mediaId,
    segmentId: null,
    crossMediaGroupId: input.crossMediaGroupId,
    lemma: input.lemma,
    reading: input.lemma,
    romaji: input.sourceId,
    pos: "sostantivo",
    meaningIt: input.lemma,
    meaningLiteralIt: null,
    notesIt: null,
    audioSrc: input.audioSrc ?? null,
    audioSource: input.audioSrc ? "fixture" : null,
    audioSpeaker: input.audioSrc ? "Fixture Speaker" : null,
    audioLicense: input.audioSrc ? "Fixture License" : null,
    audioAttribution: input.audioSrc ? "Fixture Attribution" : null,
    audioPageUrl: input.audioSrc ? "https://example.test/audio" : null,
    levelHint: null,
    searchLemmaNorm: input.lemma,
    searchReadingNorm: input.lemma,
    searchRomajiNorm: input.sourceId,
    createdAt: "2026-03-10T09:00:00.000Z",
    updatedAt: "2026-03-10T09:00:00.000Z"
  };
}

function buildReviewCard(input: {
  front: string;
  id: string;
  lessonId: string;
  mediaId: string;
  orderIndex: number;
}): typeof card.$inferInsert {
  return {
    id: input.id,
    mediaId: input.mediaId,
    lessonId: input.lessonId,
    segmentId: null,
    sourceFile: "tests/review-global-queue/media.md",
    cardType: "recognition",
    front: input.front,
    back: `${input.front} back`,
    exampleJp: null,
    exampleIt: null,
    notesIt: null,
    status: "active",
    orderIndex: input.orderIndex,
    createdAt: "2026-03-10T09:00:00.000Z",
    updatedAt: "2026-03-10T09:00:00.000Z"
  };
}

function buildReviewCardEntryLink(
  id: string,
  cardId: string,
  entryId: string
): typeof cardEntryLink.$inferInsert {
  return {
    id,
    cardId,
    entryType: "term",
    entryId,
    relationshipType: "primary"
  };
}

function buildDueSubjectState(input: {
  cardId: string;
  crossMediaGroupId: string;
  entryId: string;
  subjectKey: string;
}): typeof reviewSubjectState.$inferInsert {
  const memoryKey = buildReviewMemoryKey({
    canonicalSubjectKey: input.subjectKey,
    cardId: input.cardId,
    recallTask: "recognition"
  });

  return {
    canonicalSubjectKey: input.subjectKey,
    subjectKey: memoryKey,
    subjectType: "group",
    entryType: "term",
    entryId: input.entryId,
    crossMediaGroupId: input.crossMediaGroupId,
    cardId: input.cardId,
    state: "review",
    stability: 3,
    difficulty: 2.5,
    dueAt: "2026-03-10T08:00:00.000Z",
    lastReviewedAt: "2026-03-09T08:00:00.000Z",
    lastInteractionAt: "2026-03-10T12:00:00.000Z",
    scheduledDays: 1,
    learningSteps: 0,
    lapses: 0,
    reps: 1,
    recallTask: "recognition",
    schedulerVersion: "fsrs_v1",
    manualOverride: false,
    suspended: false,
    createdAt: "2026-03-10T09:00:00.000Z",
    updatedAt: "2026-03-10T09:00:00.000Z"
  };
}
