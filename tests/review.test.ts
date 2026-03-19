import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { and, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import { ReviewPage } from "@/components/review/review-page";
import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  countNewCardsIntroducedOnDayByMediaId,
  countNewCardsIntroducedOnDayByMediaIds,
  countReviewSubjectsIntroducedOnDay,
  createDatabaseClient,
  developmentFixture,
  entryStatus,
  getUtcDayBounds,
  lessonProgress,
  media,
  reviewLog,
  reviewState,
  reviewSubjectState,
  runMigrations,
  seedDevelopmentDatabase,
  term,
  type DatabaseClient
} from "@/db";
import { migrateReviewHistoryToFsrs } from "@/db/review-fsrs-migration";
import {
  getGlobalReviewPageLoadResult,
  getGlobalReviewPageData,
  getReviewCardDetailData,
  getReviewLaunchMedia,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  loadGlobalReviewOverviewSnapshot,
  loadReviewOverviewSnapshots,
  type ReviewPageData
} from "@/lib/review";
import {
  applyReviewGrade,
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/lib/review-service";
import { scheduleReview } from "@/lib/review-scheduler";
import { buildCanonicalReviewSessionHref } from "@/lib/site";
import { updateStudySettings } from "@/lib/settings";
import { importContentWorkspace } from "@/lib/content/importer";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validContentRoot = path.join(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);

vi.mock("next/navigation", () => ({
  usePathname: () => "/media/test/review",
  useRouter: () => ({
    replace: () => undefined
  }),
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined
}));

async function prepareReviewSessionRedirectFixture(database: DatabaseClient) {
  const futureDueAt = "2999-01-01T00:00:00.000Z";
  const pastDueAt = "2000-01-01T00:00:00.000Z";

  await database
    .update(reviewState)
    .set({
      dueAt: futureDueAt
    })
    .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

  await database
    .update(reviewState)
    .set({
      dueAt: pastDueAt
    })
    .where(eq(reviewState.cardId, developmentFixture.secondaryCardId));

  await database
    .update(entryStatus)
    .set({
      reason: "Test setup manual override.",
      setAt: "2026-03-09T15:00:00.000Z",
      status: "known_manual"
    })
    .where(
      and(
        eq(entryStatus.entryType, "term"),
        eq(entryStatus.entryId, developmentFixture.termDbId)
      )
    );

  return {
    nextCardId: developmentFixture.secondaryCardId,
    targetCardId: developmentFixture.primaryCardId
  };
}

type ReviewPageLoadCall = {
  mediaSlug?: string;
  scope: "global" | "media";
  searchParams: Record<string, string>;
};

async function loadReviewActionsForDatabase(database: DatabaseClient) {
  const globalDatabase = globalThis as {
    __japaneseCustomStudyDb__?: DatabaseClient;
  };
  const previousDatabase = globalDatabase.__japaneseCustomStudyDb__;
  const reviewPageCalls: ReviewPageLoadCall[] = [];

  try {
    vi.resetModules();
    vi.doMock("@/lib/review", () => ({
      getGlobalReviewPageData: vi.fn(async (searchParams: Record<string, string>) => {
        reviewPageCalls.push({
          scope: "global",
          searchParams
        });

        return {} as ReviewPageData;
      }),
      getReviewPageData: vi.fn(
        async (mediaSlug: string, searchParams: Record<string, string>) => {
          reviewPageCalls.push({
            mediaSlug,
            scope: "media",
            searchParams
          });

          return {} as ReviewPageData;
        }
      )
    }));
    globalDatabase.__japaneseCustomStudyDb__ = database;

    return {
      ...(await import("@/actions/review")),
      reviewPageCalls
    };
  } finally {
    globalDatabase.__japaneseCustomStudyDb__ = previousDatabase;
    vi.doUnmock("@/lib/review");
  }
}

describe("review system", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });

    await runMigrations(database);
    await seedDevelopmentDatabase(database);
    await markFixtureLessonCompleted(database);
  });

  afterEach(async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
  });

  async function markFixtureLessonCompleted(client: DatabaseClient) {
    await client
      .update(lessonProgress)
      .set({
        status: "completed",
        completedAt: "2026-03-09T10:00:00.000Z"
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));
  }

  it("maps FSRS-native review cards into scheduling outputs", () => {
    const fromNew = scheduleReview({
      current: {
        difficulty: null,
        dueAt: null,
        lapses: 0,
        lastReviewedAt: null,
        reps: 0,
        stability: null,
        state: null
      },
      now: new Date("2026-03-09T10:00:00.000Z"),
      rating: "good"
    });
    const now = new Date("2026-03-12T10:00:00.000Z");
    const scheduled = (["again", "hard", "good", "easy"] as const).map(
      (rating) =>
        scheduleReview({
          current: {
            difficulty: 3.2,
            dueAt: "2026-03-12T10:00:00.000Z",
            lapses: 1,
            lastReviewedAt: "2026-03-09T10:00:00.000Z",
            reps: 5,
            stability: 3,
            state: "review"
          },
          now,
          rating
        })
    );
    const dueTimes = scheduled.map((item) => new Date(item.dueAt).getTime());

    expect(fromNew).toEqual({
      difficulty: 2.118,
      dueAt: "2026-03-09T10:10:00.000Z",
      elapsedDays: 0,
      lapses: 0,
      learningSteps: 1,
      reps: 1,
      scheduledDays: 0,
      schedulerVersion: "fsrs_v1",
      stability: 2.307,
      state: "learning"
    });
    expect(dueTimes.every((value) => Number.isFinite(value))).toBe(true);
    expect(dueTimes[0]).toBeLessThanOrEqual(dueTimes[1]);
    expect(dueTimes[1]).toBeLessThanOrEqual(dueTimes[2]);
    expect(dueTimes[2]).toBeLessThanOrEqual(dueTimes[3]);
    expect(scheduled[0]).toMatchObject({
      dueAt: "2026-03-12T10:10:00.000Z",
      elapsedDays: 3,
      lapses: 2,
      learningSteps: 0,
      reps: 6,
      scheduledDays: 0,
      schedulerVersion: "fsrs_v1",
      stability: 0.716,
      state: "relearning"
    });
    expect(scheduled.map((item) => item.reps)).toEqual([6, 6, 6, 6]);
    expect(scheduled[0]?.lapses).toBe(2);
    expect(scheduled[1]?.lapses).toBe(1);
    expect(scheduled[2]?.lapses).toBe(1);
    expect(scheduled[3]?.lapses).toBe(1);
  });

  it("migrates legacy review history into FSRS state through replay", async () => {
    await database
      .update(reviewState)
      .set({
        state: "new",
        stability: null,
        difficulty: null,
        dueAt: "2026-03-09T14:10:00.000Z",
        lastReviewedAt: null,
        scheduledDays: 0,
        learningSteps: 0,
        lapses: 0,
        reps: 0,
        schedulerVersion: "legacy_simple",
        updatedAt: "2026-03-09T14:10:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await database
      .update(reviewLog)
      .set({
        previousState: "new",
        newState: "learning",
        scheduledDueAt: "2026-03-09T08:00:00.000Z",
        elapsedDays: 0.5,
        schedulerVersion: "legacy_simple"
      })
      .where(eq(reviewLog.cardId, developmentFixture.primaryCardId));

    await migrateReviewHistoryToFsrs(database);

    const migratedState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });
    const migratedLogs = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, developmentFixture.primaryCardId)
    });

    expect(migratedState?.schedulerVersion).toBe("fsrs_v1");
    expect(migratedState?.state).toBe("new");
    expect(migratedState?.reps).toBe(0);
    expect(migratedState?.lapses).toBe(0);
    expect(migratedState?.lastReviewedAt).toBeNull();
    expect(migratedLogs).toHaveLength(1);
    expect(migratedLogs[0]?.schedulerVersion).toBe("fsrs_v1");
    expect(migratedLogs[0]?.previousState).toBe("new");
    expect(migratedLogs[0]?.newState).toBe("learning");
  });

  it("derives study-day boundaries in UTC regardless of runtime timezone", () => {
    expect(getUtcDayBounds(new Date("2026-03-10T23:30:00.000-05:00"))).toEqual({
      dayEndIso: "2026-03-12T00:00:00.000Z",
      dayStartIso: "2026-03-11T00:00:00.000Z"
    });
  });

  it("counts newly introduced cards against a stable UTC study day", async () => {
    await database.insert(media).values({
      id: "media_timezone_fixture",
      slug: "timezone-fixture",
      title: "Timezone Fixture",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Fixture per il boundary UTC della review.",
      status: "active",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(card).values([
      {
        id: "card_timezone_fixture_before",
        mediaId: "media_timezone_fixture",
        segmentId: null,
        sourceFile: "tests/fixtures/db/timezone/before.md",
        cardType: "recognition",
        front: "前日",
        back: "giorno precedente",
        notesIt: null,
        status: "active",
        orderIndex: 1,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z"
      },
      {
        id: "card_timezone_fixture_target",
        mediaId: "media_timezone_fixture",
        segmentId: null,
        sourceFile: "tests/fixtures/db/timezone/target.md",
        cardType: "recognition",
        front: "当日",
        back: "giorno target",
        notesIt: null,
        status: "active",
        orderIndex: 2,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z"
      }
    ]);
    await database.insert(media).values({
      id: "media_timezone_fixture_other",
      slug: "timezone-fixture-other",
      title: "Timezone Fixture Other",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Secondo media per verificare il limite globale dei nuovi.",
      status: "active",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(card).values({
      id: "card_timezone_fixture_other",
      mediaId: "media_timezone_fixture_other",
      segmentId: null,
      sourceFile: "tests/fixtures/db/timezone/other.md",
      cardType: "recognition",
      front: "翌日",
      back: "giorno successivo",
      notesIt: null,
      status: "active",
      orderIndex: 1,
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(reviewLog).values([
      {
        id: "review_log_timezone_before",
        cardId: "card_timezone_fixture_before",
        answeredAt: "2026-03-10T23:59:59.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-11T23:59:59.000Z",
        elapsedDays: 0,
        responseMs: null
      },
      {
        id: "review_log_timezone_target",
        cardId: "card_timezone_fixture_target",
        answeredAt: "2026-03-11T00:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T00:00:00.000Z",
        elapsedDays: 0,
        responseMs: null
      },
      {
        id: "review_log_timezone_other",
        cardId: "card_timezone_fixture_other",
        answeredAt: "2026-03-11T02:15:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T02:15:00.000Z",
        elapsedDays: 0,
        responseMs: null
      }
    ]);

    const asOf = new Date("2026-03-10T23:30:00.000-05:00");
    const [singleMediaCount, groupedCounts] = await Promise.all([
      countNewCardsIntroducedOnDayByMediaId(
        database,
        "media_timezone_fixture",
        asOf
      ),
      countNewCardsIntroducedOnDayByMediaIds(
        database,
        ["media_timezone_fixture", "media_timezone_fixture_other"],
        asOf
      )
    ]);
    const groupedCountsByMedia = new Map(
      groupedCounts.map((row) => [row.mediaId, row.count])
    );

    expect(singleMediaCount).toBe(1);
    expect(groupedCountsByMedia.get("media_timezone_fixture")).toBe(1);
    expect(groupedCountsByMedia.get("media_timezone_fixture_other")).toBe(1);
    expect([...groupedCountsByMedia.values()].reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  it("counts introduced subjects from legacy review logs without double-counting shared cross-media cards", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-count");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    await database.insert(reviewLog).values([
      {
        id: "review_log_cross_media_alpha",
        cardId: crossMediaFixture.alpha.termCardId,
        answeredAt: "2026-03-11T08:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T08:00:00.000Z",
        elapsedDays: 0,
        responseMs: null
      },
      {
        id: "review_log_cross_media_beta",
        cardId: crossMediaFixture.beta.termCardId,
        answeredAt: "2026-03-11T09:00:00.000Z",
        rating: "good",
        previousState: "new",
        newState: "review",
        scheduledDueAt: "2026-03-12T09:00:00.000Z",
        elapsedDays: 0,
        responseMs: null
      }
    ]);

    const introducedCount = await countReviewSubjectsIntroducedOnDay(
      database,
      new Date("2026-03-11T12:00:00.000Z")
    );

    expect(introducedCount).toBe(1);
  });

  it("hides cards tied to incomplete lessons but keeps orphan cards visible", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        completedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    await database.insert(term).values({
      id: "term_fixture_orphan",
      sourceId: "term_fixture_orphan",
      mediaId: developmentFixture.mediaId,
      segmentId: developmentFixture.segmentId,
      lemma: "孤立",
      reading: "こりつ",
      romaji: "koritsu",
      pos: "sostantivo",
      meaningIt: "isolamento",
      meaningLiteralIt: null,
      notesIt: "Termine non introdotto in alcuna lesson.",
      levelHint: null,
      searchLemmaNorm: "孤立",
      searchReadingNorm: "こりつ",
      searchRomajiNorm: "koritsu",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(card).values({
      id: "card_fixture_orphan",
      mediaId: developmentFixture.mediaId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/orphan.md",
      cardType: "recognition",
      front: "孤立",
      back: "orfana",
      notesIt: "Card senza entry lesson-linked.",
      status: "active",
      orderIndex: 99,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_orphan_primary",
      cardId: "card_fixture_orphan",
      entryType: "term",
      entryId: "term_fixture_orphan",
      relationshipType: "primary"
    });

    const queue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(queue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
      "card_fixture_orphan"
    ]);
    expect(queue?.dueCount).toBe(0);
    expect(queue?.newAvailableCount).toBe(1);
    expect(queue?.newQueuedCount).toBe(1);
  });

  it("builds a daily queue that separates due, new, manual, and suspended cards", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await database.insert(card).values([
      {
        id: "card_fixture_new_context",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-context.md",
        cardType: "production",
        front: "行きます",
        back: "andare (forma educata)",
        notesIt: "Nuova card da introdurre nel daily queue.",
        status: "active",
        orderIndex: 3,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      },
      {
        id: "card_fixture_suspended",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/suspended.md",
        cardType: "recognition",
        front: "行った",
        back: "andato",
        notesIt: "Card sospesa ma con scheduling preservato.",
        status: "suspended",
        orderIndex: 4,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      }
    ]);
    await database.insert(cardEntryLink).values([
      {
        id: "card_entry_link_fixture_new_context_primary",
        cardId: "card_fixture_new_context",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      },
      {
        id: "card_entry_link_fixture_suspended_primary",
        cardId: "card_fixture_suspended",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      }
    ]);
    await database.insert(reviewState).values({
      cardId: "card_fixture_suspended",
      state: "review",
      stability: 4,
      difficulty: 3,
      dueAt: "2999-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-08T10:00:00.000Z",
      lapses: 0,
      reps: 4,
      manualOverride: false,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });

    const queue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(queue).not.toBeNull();
    expect(queue?.dueCount).toBe(1);
    expect(queue?.newAvailableCount).toBe(0);
    expect(queue?.newQueuedCount).toBe(0);
    expect(queue?.queueCount).toBe(1);
    expect(queue?.manualCount).toBe(1);
    expect(queue?.suspendedCount).toBe(0);
    expect(queue?.cards.map((reviewCard) => reviewCard.id)).toEqual([
      developmentFixture.primaryCardId
    ]);
  });

  it("counts only due and upcoming cards as active review cards in overview snapshots", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await database.insert(card).values([
      {
        id: "card_fixture_overview_new",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/overview-new.md",
        cardType: "production",
        front: "行きます",
        back: "andare (forma educata)",
        notesIt: "Nuova card che non deve contare come attiva.",
        status: "active",
        orderIndex: 30,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      },
      {
        id: "card_fixture_overview_suspended",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/overview-suspended.md",
        cardType: "recognition",
        front: "行った",
        back: "andato",
        notesIt: "Card sospesa che non deve contare come attiva.",
        status: "suspended",
        orderIndex: 31,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      }
    ]);
    await database.insert(cardEntryLink).values([
      {
        id: "card_entry_link_fixture_overview_new_primary",
        cardId: "card_fixture_overview_new",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      },
      {
        id: "card_entry_link_fixture_overview_suspended_primary",
        cardId: "card_fixture_overview_suspended",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "primary"
      }
    ]);
    await database.insert(reviewState).values({
      cardId: "card_fixture_overview_suspended",
      state: "review",
      stability: 4,
      difficulty: 3,
      dueAt: "2999-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-08T10:00:00.000Z",
      lapses: 0,
      reps: 4,
      manualOverride: false,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });

    const [queue, overviewSnapshots] = await Promise.all([
      getReviewQueueSnapshotForMedia(developmentFixture.mediaSlug, database),
      loadReviewOverviewSnapshots(database, [
        {
          id: developmentFixture.mediaId,
          slug: developmentFixture.mediaSlug
        }
      ])
    ]);
    const overview = overviewSnapshots.get(developmentFixture.mediaId);

    expect(queue).not.toBeNull();
    expect(overview).not.toBeUndefined();
    expect(overview?.activeCards).toBe(
      (queue?.dueCount ?? 0) + (queue?.upcomingCount ?? 0)
    );
    expect(overview?.activeCards).toBe(1);
  });

  it("selects the best review launch media without loading the dashboard", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2026-03-20T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

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
    await database.insert(term).values({
      id: "term_duel_masters_review",
      sourceId: "term_duel_masters_review",
      mediaId: "media_duel_masters",
      segmentId: null,
      lemma: "シールド",
      reading: "シールド",
      romaji: "shiirudo",
      pos: "sostantivo",
      meaningIt: "scudo",
      meaningLiteralIt: null,
      notesIt: null,
      levelHint: null,
      searchLemmaNorm: "シールド",
      searchReadingNorm: "シールド",
      searchRomajiNorm: "shiirudo",
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });
    await database.insert(card).values({
      id: "card_duel_masters_due",
      mediaId: "media_duel_masters",
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
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_duel_masters_primary",
      cardId: "card_duel_masters_due",
      entryType: "term",
      entryId: "term_duel_masters_review",
      relationshipType: "primary"
    });
    await database.insert(reviewState).values({
      cardId: "card_duel_masters_due",
      state: "review",
      stability: 3,
      difficulty: 2.5,
      dueAt: "2026-03-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-08T09:00:00.000Z",
      lapses: 0,
      reps: 3,
      manualOverride: false,
      createdAt: "2026-03-08T09:00:00.000Z",
      updatedAt: "2026-03-08T09:30:00.000Z"
    });

    const launchMedia = await getReviewLaunchMedia(database);

    expect(launchMedia?.slug).toBe("duel-masters-dm25");
  });

  it("persists grading into review_state and review_log without overwriting history", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T12:00:00.000Z"),
      rating: "good"
    });

    const persistedState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });
    const logs = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, developmentFixture.primaryCardId)
    });

    expect(persistedState?.state).toBe("review");
    expect(persistedState?.reps).toBe(4);
    expect(persistedState?.lapses).toBe(1);
    expect(persistedState?.dueAt).toBe("2026-03-10T12:00:00.000Z");
    expect(persistedState?.schedulerVersion).toBe("fsrs_v1");
    expect(persistedState?.scheduledDays).toBe(1);
    expect(persistedState?.learningSteps).toBe(0);
    expect(logs).toHaveLength(2);
    expect(logs.at(-1)?.previousState).toBe("learning");
    expect(logs.at(-1)?.newState).toBe("review");
    expect(logs.at(-1)?.rating).toBe("good");
    expect(logs.at(-1)?.schedulerVersion).toBe("fsrs_v1");
  });

  it("mirrors lastReviewedAt into legacy review_state on the first cross-media insert", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-mirror");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(0);

    const now = new Date("2026-03-11T09:00:00.000Z");
    const nowIso = now.toISOString();

    await applyReviewGrade({
      cardId: crossMediaFixture.alpha.termCardId,
      database,
      now,
      rating: "good"
    });

    const alphaState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, crossMediaFixture.alpha.termCardId)
    });
    const betaState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, crossMediaFixture.beta.termCardId)
    });

    expect(alphaState?.lastReviewedAt).toBe(nowIso);
    expect(betaState?.lastReviewedAt).toBe(nowIso);
  });

  it("rejects review mutations when card and requested media do not match", async () => {
    await expect(
      applyReviewGrade({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other",
        rating: "good"
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");

    await expect(
      setLinkedEntryStatusByCard({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other",
        status: "learning"
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");

    await expect(
      setReviewCardSuspended({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other",
        suspended: true
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");

    await expect(
      resetReviewCardProgress({
        cardId: developmentFixture.primaryCardId,
        database,
        expectedMediaId: "media_other"
      })
    ).rejects.toThrow("Review card does not belong to the requested media.");
  });

  it("does not keep backfilling fresh new cards after the daily new limit has been used", async () => {
    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "lesson_order",
        reviewDailyLimit: 1
      },
      database
    );

    await database
      .update(reviewState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, `entry:term:${developmentFixture.termDbId}`));

    await database.insert(card).values([
      {
        id: "card_fixture_new_limit_a",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-limit-a.md",
        cardType: "recognition",
        front: "一枚目",
        back: "prima carta",
        notesIt: "Prima nuova del giorno.",
        status: "active",
        orderIndex: 10,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      },
      {
        id: "card_fixture_new_limit_b",
        mediaId: developmentFixture.mediaId,
        segmentId: developmentFixture.segmentId,
        sourceFile: "tests/fixtures/db/fixture-tcg/cards/new-limit-b.md",
        cardType: "recognition",
        front: "二枚目",
        back: "seconda carta",
        notesIt: "Non deve rimpiazzare la prima nello stesso giorno.",
        status: "active",
        orderIndex: 11,
        createdAt: "2026-03-09T10:00:00.000Z",
        updatedAt: "2026-03-09T10:00:00.000Z"
      }
    ]);
    await database.insert(cardEntryLink).values([
      {
        id: "card_entry_link_fixture_new_limit_a",
        cardId: "card_fixture_new_limit_a",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "secondary"
      },
      {
        id: "card_entry_link_fixture_new_limit_b",
        cardId: "card_fixture_new_limit_b",
        entryType: "term",
        entryId: developmentFixture.termDbId,
        relationshipType: "secondary"
      }
    ]);

    const initialPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(initialPage?.queue.dueCount).toBe(0);
    expect(initialPage?.queue.newAvailableCount).toBe(0);
    expect(initialPage?.queue.newQueuedCount).toBe(0);
    expect(initialPage?.queue.queueCount).toBe(0);
    expect(initialPage?.selectedCard).toBeNull();

    await applyReviewGrade({
      cardId: "card_fixture_new_limit_a",
      database,
      rating: "good"
    });

    const afterFirstNew = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );

    expect(afterFirstNew?.queue.newAvailableCount).toBe(0);
    expect(afterFirstNew?.queue.newQueuedCount).toBe(0);
    expect(afterFirstNew?.queue.queueCount).toBe(0);
    expect(afterFirstNew?.selectedCard).toBeNull();

    const completionMarkup = renderToStaticMarkup(
      ReviewPage({ data: afterFirstNew! })
    );

    expect(completionMarkup).not.toContain("Aggiungi ancora 1 nuova");

    const toppedUpPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        extraNew: "10"
      },
      database
    );

    expect(toppedUpPage?.queue.effectiveDailyLimit).toBe(11);
    expect(toppedUpPage?.queue.newQueuedCount).toBe(0);
    expect(toppedUpPage?.queue.queueCount).toBe(0);
    expect(toppedUpPage?.selectedCard).toBeNull();
  });

  it("keeps the main stage in a completion state when the queue is empty unless a card is explicitly selected", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-11T12:00:00.000Z"),
      rating: "good"
    });
    await database
      .update(reviewState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, `entry:term:${developmentFixture.termDbId}`));

    const completionPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        answered: "1"
      },
      database
    );
    const explicitSelectionPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        answered: "1",
        card: developmentFixture.secondaryCardId
      },
      database
    );

    expect(completionPage).not.toBeNull();
    expect(completionPage?.queue.queueCount).toBe(0);
    expect(completionPage?.selectedCard).toBeNull();
    expect(completionPage?.queue.manualCount).toBe(1);
    expect(completionPage?.queue.upcomingCount).toBe(1);

    expect(explicitSelectionPage?.selectedCard?.id).toBe(
      developmentFixture.secondaryCardId
    );
    expect(explicitSelectionPage?.selectedCard?.gradePreviews).toEqual([]);
    expect(explicitSelectionPage?.selectedCardContext.gradePreviews).toHaveLength(4);
  });

  it("builds canonical review session urls and tracks only cards remaining after the current one", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));
    await database.insert(card).values({
      id: "card_fixture_remaining_count",
      mediaId: developmentFixture.mediaId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/remaining-count.md",
      cardType: "recognition",
      front: "残り",
      back: "restante",
      notesIt: "Serve a verificare il conteggio delle card rimanenti.",
      status: "active",
      orderIndex: 2,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(term).values({
      id: "term_fixture_remaining_count",
      sourceId: "term-fixture-remaining-count",
      mediaId: developmentFixture.mediaId,
      segmentId: developmentFixture.segmentId,
      lemma: "残り",
      reading: "のこり",
      romaji: "nokori",
      pos: "sostantivo",
      meaningIt: "restante",
      meaningLiteralIt: null,
      notesIt: "Termine dedicato al test del conteggio rimanente.",
      levelHint: null,
      searchLemmaNorm: "残り",
      searchReadingNorm: "のこり",
      searchRomajiNorm: "nokori",
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_remaining_count",
      cardId: "card_fixture_remaining_count",
      entryType: "term",
      entryId: "term_fixture_remaining_count",
      relationshipType: "primary"
    });
    await database.insert(reviewState).values({
      cardId: "card_fixture_remaining_count",
      state: "review",
      stability: 2.1,
      difficulty: 3.6,
      dueAt: "2000-01-01T00:05:00.000Z",
      lastReviewedAt: "2026-03-09T09:00:00.000Z",
      scheduledDays: 1,
      learningSteps: 0,
      lapses: 0,
      reps: 2,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      createdAt: "2026-03-09T09:00:00.000Z",
      updatedAt: "2026-03-09T09:00:00.000Z"
    });

    const frontQueuePage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const explicitQueuePage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: "card_fixture_remaining_count"
      },
      database
    );

    expect(frontQueuePage?.selectedCard?.id).toBe(developmentFixture.primaryCardId);
    expect(frontQueuePage?.selectedCardContext.position).toBe(1);
    expect(frontQueuePage?.selectedCardContext.remainingCount).toBe(1);
    expect(
      buildCanonicalReviewSessionHref({
        answeredCount: frontQueuePage?.session.answeredCount,
        cardId: frontQueuePage?.selectedCard?.id ?? null,
        extraNewCount: frontQueuePage?.session.extraNewCount,
        isQueueCard: frontQueuePage?.selectedCardContext.isQueueCard ?? false,
        mediaSlug: developmentFixture.mediaSlug,
        position: frontQueuePage?.selectedCardContext.position ?? null,
        showAnswer: frontQueuePage?.selectedCardContext.showAnswer
      })
    ).toBe(`/media/${developmentFixture.mediaSlug}/review`);

    expect(explicitQueuePage?.selectedCard?.id).toBe(
      "card_fixture_remaining_count"
    );
    expect(explicitQueuePage?.selectedCardContext.position).toBe(2);
    expect(explicitQueuePage?.selectedCardContext.remainingCount).toBe(0);
    expect(
      buildCanonicalReviewSessionHref({
        answeredCount: explicitQueuePage?.session.answeredCount,
        cardId: explicitQueuePage?.selectedCard?.id ?? null,
        extraNewCount: explicitQueuePage?.session.extraNewCount,
        isQueueCard: explicitQueuePage?.selectedCardContext.isQueueCard ?? false,
        mediaSlug: developmentFixture.mediaSlug,
        position: explicitQueuePage?.selectedCardContext.position ?? null,
        showAnswer: explicitQueuePage?.selectedCardContext.showAnswer
      })
    ).toBe(
      `/media/${developmentFixture.mediaSlug}/review?card=card_fixture_remaining_count`
    );
  });

  it("exposes reading and example sentences in review answers", async () => {
    const primaryPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId,
        show: "answer"
      },
      database
    );
    const secondaryPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.secondaryCardId,
        show: "answer"
      },
      database
    );
    const primaryDetail = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(primaryPage?.selectedCard?.reading).toBe("いく");
    expect(primaryPage?.selectedCard?.exampleJp).toBe(
      "{{駅|えき}}まで {{行|い}}く。"
    );
    expect(primaryPage?.selectedCard?.exampleIt).toBe(
      "Vado fino alla stazione."
    );
    expect(secondaryPage?.selectedCard?.reading).toBe("〜ている");
    expect(primaryDetail?.card.reading).toBe("いく");
    expect(primaryDetail?.card.exampleJp).toBe("{{駅|えき}}まで {{行|い}}く。");
    expect(primaryDetail?.card.exampleIt).toBe("Vado fino alla stazione.");

    const primaryMarkup = renderToStaticMarkup(
      ReviewPage({ data: primaryPage! })
    );

    expect(primaryMarkup).toContain("review-stage__reading");
    expect(primaryMarkup).toContain("いく");
    expect(primaryMarkup).toContain("reader-example-sentence");
    expect(primaryMarkup).toContain("Mostra traduzione italiana");
    expect(primaryMarkup).toContain("Vado fino alla stazione.");
  });

  it("renders pronunciation audio players directly in the review answer when audio exists", async () => {
    const imported = await importContentWorkspace({
      contentRoot: validContentRoot,
      database,
      mediaSlugs: ["sample-anime"]
    });

    expect(imported.status).toBe("completed");

    const reviewPage = await getReviewPageData(
      "sample-anime",
      {
        card: "card-taberu-recognition",
        show: "answer"
      },
      database
    );

    expect(reviewPage?.selectedCard?.pronunciations).toHaveLength(1);
    expect(reviewPage?.selectedCard?.pronunciations[0]?.audio.src).toBe(
      "/media/sample-anime/assets/audio/term/term-taberu/term-taberu.ogg"
    );
    expect(
      reviewPage?.selectedCard?.pronunciations[0]?.audio.pitchAccent
    ).toMatchObject({
      downstep: 2,
      shape: "nakadaka"
    });

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));

    expect(markup).toContain("Pronuncia");
    expect(markup).toContain("pronunciation-audio__player");
    expect(markup).toContain("pitch-accent__graph");
    expect(markup).toContain(
      "/media/sample-anime/assets/audio/term/term-taberu/term-taberu.ogg"
    );
  });

  it("renders furigana markup in review card fronts instead of showing raw braces", async () => {
    await database
      .update(card)
      .set({
        front: "{{語彙|ごい}}"
      })
      .where(eq(card.id, developmentFixture.primaryCardId));

    const [reviewPage, reviewDetail] = await Promise.all([
      getReviewPageData(
        developmentFixture.mediaSlug,
        {
          card: developmentFixture.primaryCardId
        },
        database
      ),
      getReviewCardDetailData(
        developmentFixture.mediaSlug,
        developmentFixture.primaryCardId,
        database
      )
    ]);

    expect(reviewPage).not.toBeNull();
    expect(reviewDetail).not.toBeNull();

    const reviewMarkup = renderToStaticMarkup(
      ReviewPage({ data: reviewPage! })
    );
    const detailMarkup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: reviewDetail! })
    );

    expect(reviewMarkup).toContain(
      'review-stage__front jp-inline"><ruby class="app-ruby">'
    );
    expect(reviewMarkup).not.toContain("{{語彙|ごい}}");
    expect(detailMarkup).toContain(
      'glossary-entry-hero__title jp-inline"><ruby class="app-ruby">'
    );
    expect(detailMarkup).not.toContain("{{語彙|ごい}}");
  });

  it("can hide furigana on the review front until the answer is revealed", async () => {
    await database
      .update(card)
      .set({
        front: "{{語彙|ごい}}"
      })
      .where(eq(card.id, developmentFixture.primaryCardId));

    await updateStudySettings(
      {
        reviewFrontFurigana: false
      },
      database
    );

    const [frontHiddenPage, revealedPage] = await Promise.all([
      getReviewPageData(
        developmentFixture.mediaSlug,
        {
          card: developmentFixture.primaryCardId
        },
        database
      ),
      getReviewPageData(
        developmentFixture.mediaSlug,
        {
          card: developmentFixture.primaryCardId,
          show: "answer"
        },
        database
      )
    ]);

    expect(frontHiddenPage).not.toBeNull();
    expect(revealedPage).not.toBeNull();

    const frontHiddenMarkup = renderToStaticMarkup(
      ReviewPage({ data: frontHiddenPage! })
    );
    const revealedMarkup = renderToStaticMarkup(
      ReviewPage({ data: revealedPage! })
    );

    expect(frontHiddenMarkup).toContain(
      'review-stage__front jp-inline">語彙</h2>'
    );
    expect(frontHiddenMarkup).not.toContain(
      'review-stage__front jp-inline"><ruby class="app-ruby">'
    );
    expect(frontHiddenMarkup).not.toContain("{{語彙|ごい}}");
    expect(revealedMarkup).toContain(
      'review-stage__front jp-inline"><ruby class="app-ruby">'
    );
  });

  it("renders grading actions from easy to again with next-review previews", async () => {
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId,
        show: "answer"
      },
      database
    );

    expect(reviewPage?.selectedCardContext.gradePreviews).toHaveLength(4);
    expect(reviewPage?.selectedCard?.gradePreviews).toEqual([]);
    expect(
      reviewPage?.queue.cards.every((card) => card.gradePreviews.length === 0)
    ).toBe(true);
    expect(
      reviewPage?.selectedCardContext.gradePreviews.map(
        (preview) => preview.rating
      )
    ).toEqual(["again", "hard", "good", "easy"]);

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));
    const easyIndex = markup.indexOf(">Easy<");
    const goodIndex = markup.indexOf(">Good<");
    const hardIndex = markup.indexOf(">Hard<");
    const againIndex = markup.indexOf(">Again<");

    expect(easyIndex).toBeGreaterThan(-1);
    expect(goodIndex).toBeGreaterThan(easyIndex);
    expect(hardIndex).toBeGreaterThan(goodIndex);
    expect(againIndex).toBeGreaterThan(hardIndex);
    expect(markup).toContain("Prossima review:");
    expect(
      reviewPage?.selectedCardContext.gradePreviews.every(
        (preview) => preview.nextReviewLabel.length > 0
      )
    ).toBe(true);
  });

  it("keeps the review page focused on the active card instead of rendering the lower queue panels", async () => {
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: developmentFixture.primaryCardId
      },
      database
    );

    const markup = renderToStaticMarkup(ReviewPage({ data: reviewPage! }));

    expect(markup).not.toContain("Pronte oggi");
    expect(markup).not.toContain("Contesto utile");
    expect(markup).not.toContain("Fuori coda");
  });

  it("uses entry_status for manual mastery and restores the queue when reopened", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:00:00.000Z"),
      status: "known_manual"
    });

    const manualQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );
    const persistedState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });
    const logs = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, developmentFixture.primaryCardId)
    });

    expect(
      manualQueue?.cards.some(
        (card) => card.id === developmentFixture.primaryCardId
      )
    ).toBe(false);
    expect(manualQueue?.manualCount).toBe(2);
    expect(persistedState?.state).toBe("learning");
    expect(logs).toHaveLength(1);

    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:05:00.000Z"),
      status: "learning"
    });

    const reopenedQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(
      reopenedQueue?.cards.some(
        (card) => card.id === developmentFixture.primaryCardId
      )
    ).toBe(true);
    expect(reopenedQueue?.manualCount).toBe(1);
  });

  it("clears driving entry_status rows when resetting a manually excluded card", async () => {
    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:00:00.000Z"),
      status: "known_manual"
    });

    const cardWithLinks = await database.query.card.findFirst({
      where: eq(card.id, developmentFixture.primaryCardId),
      with: {
        entryLinks: true
      }
    });
    const primaryLinks =
      cardWithLinks?.entryLinks.filter(
        (link) => link.relationshipType === "primary"
      ) ?? [];
    const drivingLinks =
      primaryLinks.length > 0 ? primaryLinks : (cardWithLinks?.entryLinks ?? []);
    const drivingEntryKeys = new Set(
      drivingLinks.map((link) => `${link.entryType}:${link.entryId}`)
    );

    const manualStatuses = await database.query.entryStatus.findMany();

    expect(
      manualStatuses.filter((row) =>
        drivingEntryKeys.has(`${row.entryType}:${row.entryId}`)
      )
    ).not.toHaveLength(0);

    await resetReviewCardProgress({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:05:00.000Z")
    });

    const resetQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );
    const remainingStatuses = await database.query.entryStatus.findMany();

    expect(
      remainingStatuses.filter((row) =>
        drivingEntryKeys.has(`${row.entryType}:${row.entryId}`)
      )
    ).toHaveLength(0);
    expect(
      resetQueue?.cards.some(
        (queuedCard) => queuedCard.id === developmentFixture.primaryCardId
      )
    ).toBe(true);
  });

  it("shows the reopen action for ignored cards in the review detail page", async () => {
    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:00:00.000Z"),
      status: "ignored"
    });

    const detailData = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detailData?.card.reviewLabel).toBe("Ignorata");

    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: detailData! })
    );

    expect(markup).toContain("Rimetti in studio");
    expect(markup).not.toContain("Segna già nota");
  });

  it("suspends and resets cards without destroying the underlying review history", async () => {
    await database
      .update(reviewState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewState.cardId, developmentFixture.primaryCardId));

    const originalState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });

    await setReviewCardSuspended({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T14:00:00.000Z"),
      suspended: true
    });

    const suspendedQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );
    const suspendedCard = await database.query.card.findFirst({
      where: eq(card.id, developmentFixture.primaryCardId)
    });
    const preservedState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });

    expect(suspendedCard?.status).toBe("suspended");
    expect(suspendedQueue?.suspendedCount).toBe(1);
    expect(preservedState?.dueAt).toBe(originalState?.dueAt);

    await setReviewCardSuspended({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T14:05:00.000Z"),
      suspended: false
    });
    await resetReviewCardProgress({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T14:10:00.000Z")
    });

    const resetState = await database.query.reviewState.findFirst({
      where: eq(reviewState.cardId, developmentFixture.primaryCardId)
    });
    const logs = await database.query.reviewLog.findMany({
      where: eq(reviewLog.cardId, developmentFixture.primaryCardId)
    });
    const resetQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(resetState?.state).toBe("new");
    expect(resetState?.reps).toBe(0);
    expect(resetState?.lapses).toBe(0);
    expect(resetState?.dueAt).toBe("2026-03-09T14:10:00.000Z");
    expect(logs).toHaveLength(1);
    expect(resetQueue?.cards[0]?.id).toBe(developmentFixture.primaryCardId);
  });

  it("advances to the next queue card after resetting a manual card when redirectMode advances queue", async () => {
    const { targetCardId } = await prepareReviewSessionRedirectFixture(
      database
    );
    const { resetReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    await resetReviewCardSessionAction({
      answeredCount: 0,
      cardId: targetCardId,
      extraNewCount: 0,
      mediaSlug: developmentFixture.mediaSlug,
      redirectMode: "advance_queue",
      scope: "media"
    });

    expect(reviewPageCalls).toHaveLength(1);
    expect(reviewPageCalls[0]).toEqual({
      mediaSlug: developmentFixture.mediaSlug,
      scope: "media",
      searchParams: {
        notice: "reset"
      }
    });
  });

  it("advances to the next queue card after suspending a manual card when redirectMode advances queue", async () => {
    const { targetCardId } = await prepareReviewSessionRedirectFixture(
      database
    );
    const { setReviewCardSuspendedSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    await setReviewCardSuspendedSessionAction({
      answeredCount: 0,
      cardId: targetCardId,
      extraNewCount: 0,
      mediaSlug: developmentFixture.mediaSlug,
      redirectMode: "advance_queue",
      scope: "media",
      suspended: true
    });

    expect(reviewPageCalls).toHaveLength(1);
    expect(reviewPageCalls[0]).toEqual({
      mediaSlug: developmentFixture.mediaSlug,
      scope: "media",
      searchParams: {
        notice: "suspended"
      }
    });
  });

  it("advances to the next queue card after reopening a manual card when redirectMode advances queue", async () => {
    const { targetCardId } = await prepareReviewSessionRedirectFixture(
      database
    );
    const { setLinkedEntryLearningSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    await setLinkedEntryLearningSessionAction({
      answeredCount: 0,
      cardId: targetCardId,
      extraNewCount: 0,
      mediaSlug: developmentFixture.mediaSlug,
      redirectMode: "advance_queue",
      scope: "media"
    });

    expect(reviewPageCalls).toHaveLength(1);
    expect(reviewPageCalls[0]).toEqual({
      mediaSlug: developmentFixture.mediaSlug,
      scope: "media",
      searchParams: {
        notice: "learning"
      }
    });
  });

  it("reuses legacy cross-media review state in both global and local queues before subject backfill exists", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-fallback");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

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
      lapses: 0,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });

    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(0);

    const [globalPage, globalOverview, betaPage] = await Promise.all([
      getGlobalReviewPageData({}, database),
      loadGlobalReviewOverviewSnapshot(database),
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database)
    ]);
    const sharedGlobalCard = globalPage.queue.cards.find((reviewCard) =>
      reviewCard.contexts.some(
        (context) =>
          context.cardId === crossMediaFixture.alpha.termCardId ||
          context.cardId === crossMediaFixture.beta.termCardId
      )
    );

    expect(globalPage.queue.dueCount).toBe(1);
    expect(globalPage.selectedCard?.id).toBe(crossMediaFixture.alpha.termCardId);
    expect(globalPage.selectedCard?.contexts).toHaveLength(2);
    expect(sharedGlobalCard?.bucket).toBe("due");
    expect(sharedGlobalCard?.contexts).toHaveLength(2);

    expect(globalOverview.dueCount).toBe(1);

    expect(betaPage).not.toBeNull();
    expect(betaPage?.queue.dueCount).toBe(1);
    expect(betaPage?.selectedCard?.id).toBe(crossMediaFixture.beta.termCardId);
    expect(betaPage?.selectedCard?.bucket).toBe("due");
    expect(betaPage?.selectedCard?.contexts).toHaveLength(1);
  });

  it("does not let a legacy manual entry_status mask an active cross-media sibling before backfill exists", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-entry-status");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    await database
      .insert(reviewState)
      .values([
        {
          cardId: crossMediaFixture.alpha.termCardId,
          state: "review",
          stability: 2.4,
          difficulty: 3.1,
          dueAt: "2000-01-01T00:00:00.000Z",
          lastReviewedAt: "2026-03-10T08:00:00.000Z",
          scheduledDays: 2,
          learningSteps: 0,
          lapses: 0,
          reps: 3,
          schedulerVersion: "fsrs_v1",
          manualOverride: false,
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T08:00:00.000Z"
        },
        {
          cardId: crossMediaFixture.beta.termCardId,
          state: "review",
          stability: 2.4,
          difficulty: 3.1,
          dueAt: "2000-01-01T00:00:00.000Z",
          lastReviewedAt: "2026-03-10T08:00:00.000Z",
          scheduledDays: 2,
          learningSteps: 0,
          lapses: 0,
          reps: 3,
          schedulerVersion: "fsrs_v1",
          manualOverride: false,
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T08:00:00.000Z"
        }
      ])
      .onConflictDoUpdate({
        target: reviewState.cardId,
        set: {
          state: "review",
          stability: 2.4,
          difficulty: 3.1,
          dueAt: "2000-01-01T00:00:00.000Z",
          lastReviewedAt: "2026-03-10T08:00:00.000Z",
          scheduledDays: 2,
          learningSteps: 0,
          lapses: 0,
          reps: 3,
          schedulerVersion: "fsrs_v1",
          manualOverride: false,
          createdAt: "2026-03-10T08:00:00.000Z",
          updatedAt: "2026-03-10T08:00:00.000Z"
        }
      });

    const [alphaTermEntry, betaTermEntry] = await Promise.all([
      database.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.alpha.termSourceId)
      }),
      database.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.beta.termSourceId)
      })
    ]);

    expect(alphaTermEntry).not.toBeNull();
    expect(betaTermEntry).not.toBeNull();

    await database
      .insert(entryStatus)
      .values({
        id: "entry_status_cross_media_alpha_manual",
        entryType: "term",
        entryId: alphaTermEntry!.id,
        status: "known_manual",
        reason: "Cross-media legacy manual override.",
        setAt: "2026-03-11T08:00:00.000Z"
      })
      .onConflictDoUpdate({
        target: entryStatus.id,
        set: {
          entryType: "term",
          entryId: alphaTermEntry!.id,
          status: "known_manual",
          reason: "Cross-media legacy manual override.",
          setAt: "2026-03-11T08:00:00.000Z"
        }
      });

    expect(await database.query.reviewSubjectState.findMany()).toHaveLength(0);

    const globalPage = await getGlobalReviewPageData({}, database);

    expect(globalPage.queue.dueCount).toBe(1);
    expect(globalPage.queue.cards[0]?.id).toBe(crossMediaFixture.beta.termCardId);
    expect(globalPage.selectedCard?.id).toBe(crossMediaFixture.beta.termCardId);
    expect(globalPage.selectedCard?.contexts).toHaveLength(2);
  });

  it("returns the dedicated global empty state when no media exist", async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-empty-media-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);

    await expect(getGlobalReviewPageLoadResult({}, database)).resolves.toEqual({
      kind: "empty-media"
    });
  });

  it("returns the dedicated global empty state when media exist but no active cards do", async () => {
    closeDatabaseClient(database);
    await rm(tempDir, { recursive: true, force: true });
    tempDir = await mkdtemp(path.join(tmpdir(), "jcs-review-empty-cards-"));
    database = createDatabaseClient({
      databaseUrl: path.join(tempDir, "test.sqlite")
    });
    await runMigrations(database);

    await database.insert(media).values({
      id: "media_empty_cards",
      slug: "media-empty-cards",
      title: "Media Empty Cards",
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: "Fixture senza card attive",
      status: "active",
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-10T09:00:00.000Z"
    });

    await expect(getGlobalReviewPageLoadResult({}, database)).resolves.toEqual({
      kind: "empty-cards"
    });
  });

  it("keeps the global route in ready mode when active cards exist but none are eligible yet", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        completedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const result = await getGlobalReviewPageLoadResult({}, database);

    expect(result.kind).toBe("ready");

    if (result.kind !== "ready") {
      return;
    }

    expect(result.data.queue.queueCount).toBe(0);
    expect(result.data.selectedCard).toBeNull();
  });

  it("seeds suspended legacy cross-media subjects from the representative sibling state", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-suspend");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

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

    await setReviewCardSuspended({
      cardId: crossMediaFixture.beta.termCardId,
      database,
      now: new Date("2026-03-11T09:00:00.000Z"),
      suspended: true
    });

    const persistedSubjectStates = await database.query.reviewSubjectState.findMany();

    expect(persistedSubjectStates).toHaveLength(1);

    expect(persistedSubjectStates[0]).toMatchObject({
      cardId: crossMediaFixture.alpha.termCardId,
      createdAt: "2026-03-10T08:00:00.000Z",
      difficulty: 3.1,
      dueAt: "2000-01-01T00:00:00.000Z",
      lapses: 1,
      lastReviewedAt: "2026-03-10T08:00:00.000Z",
      reps: 3,
      scheduledDays: 2,
      stability: 2.4,
      state: "review",
      suspended: true
    });
  });

  it("surfaces shared cross-media siblings while keeping local review card ids stable", async () => {
    const contentRoot = path.join(tempDir, "cross-media-content");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");

    const [alphaQueue, betaDetail] = await Promise.all([
      getReviewQueueSnapshotForMedia(
        crossMediaFixture.alpha.mediaSlug,
        database
      ),
      getReviewCardDetailData(
        crossMediaFixture.beta.mediaSlug,
        crossMediaFixture.beta.termCardId,
        database
      )
    ]);

    expect(alphaQueue?.cards.map((card) => card.id)).toContain(
      crossMediaFixture.alpha.termCardId
    );
    expect(betaDetail?.entries[0]?.id).toBe(
      crossMediaFixture.beta.termSourceId
    );
    expect(betaDetail?.entries[0]?.meaning).toBe(
      crossMediaFixture.beta.termMeaning
    );
    expect(betaDetail?.entries[0]?.href).toBe(
      `/media/${crossMediaFixture.beta.mediaSlug}/glossary/term/${crossMediaFixture.beta.termSourceId}`
    );
    expect(betaDetail?.crossMedia).toHaveLength(1);
    expect(betaDetail?.crossMedia[0]?.siblings[0]?.href).toBe(
      `/media/${crossMediaFixture.alpha.mediaSlug}/glossary/term/${crossMediaFixture.alpha.termSourceId}`
    );

    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: betaDetail! })
    );

    expect(markup).toContain("Altri media in cui compare");
    expect(markup).toContain(crossMediaFixture.alpha.termMeaning);
  });
});
