import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import type { Route } from "next";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import { ReviewPage } from "@/components/review/review-page";
import {
  card,
  cardEntryLink,
  closeDatabaseClient,
  countReviewSubjectsIntroducedOnDayByMediaId,
  countReviewSubjectsIntroducedOnDayByMediaIds,
  countReviewSubjectsIntroducedOnDay,
  createDatabaseClient,
  developmentFixture,
  lesson,
  lessonProgress,
  media,
  reviewSubjectLog,
  reviewSubjectState,
  runMigrations,
  seedDevelopmentDatabase,
  term,
  type DatabaseClient
} from "@/db";
import {
  getGlobalReviewPageLoadResult,
  getGlobalReviewPageData,
  getReviewCardDetailData,
  getReviewLaunchMedia,
  getReviewPageData,
  getReviewQueueSnapshotForMedia,
  hydrateReviewCard,
  loadGlobalReviewOverviewSnapshot,
  loadReviewOverviewSnapshots,
  type ReviewPageData
} from "@/lib/review";
import { resolveReviewCardReading } from "@/lib/review-card-hydration";
import {
  applyReviewGrade,
  resetReviewCardProgress,
  setLinkedEntryStatusByCard,
  setReviewCardSuspended
} from "@/lib/review-service";
import { scheduleReview } from "@/lib/review-scheduler";
import {
  buildCanonicalReviewSessionHref,
  mediaReviewCardHref
} from "@/lib/site";
import { updateStudySettings } from "@/lib/settings";
import { importContentWorkspace } from "@/lib/content/importer";
import {
  crossMediaFixture,
  writeCrossMediaContentFixture
} from "./helpers/cross-media-fixture";
import { getUtcDayBounds } from "@/db/queries/review-query-helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const validContentRoot = path.join(
  __dirname,
  "fixtures",
  "content",
  "valid",
  "content"
);
const primarySubjectKey = `entry:term:${developmentFixture.termDbId}`;
const secondarySubjectKey = `entry:grammar:${developmentFixture.grammarDbId}`;
const {
  updateGlossarySummaryCacheMock,
  revalidatePathMock,
  updateReviewSummaryCacheMock
} = vi.hoisted(() => ({
  updateGlossarySummaryCacheMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  updateReviewSummaryCacheMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/media/test/review",
  useRouter: () => ({
    replace: () => undefined
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

async function prepareReviewSessionRedirectFixture(database: DatabaseClient) {
  const futureDueAt = "2999-01-01T00:00:00.000Z";
  const pastDueAt = "2000-01-01T00:00:00.000Z";

  await database
    .update(reviewSubjectState)
    .set({
      dueAt: futureDueAt
    })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

  await database
    .update(reviewSubjectState)
    .set({
      dueAt: pastDueAt
    })
    .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

  await database
    .update(reviewSubjectState)
    .set({
      manualOverride: true
    })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

  return {
    nextCardId: developmentFixture.secondaryCardId,
    targetCardId: developmentFixture.primaryCardId
  };
}

async function prepareTwoQueueCardFixture(database: DatabaseClient) {
  await database
    .update(reviewSubjectState)
    .set({
      dueAt: "2000-01-01T00:00:00.000Z"
    })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

  await database
    .update(reviewSubjectState)
    .set({
      dueAt: "2000-01-01T00:05:00.000Z"
    })
    .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

  await database
    .update(reviewSubjectState)
    .set({
      dueAt: "2000-01-01T00:05:00.000Z",
      manualOverride: false,
      state: "learning"
    })
    .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

  return {
    currentCardId: developmentFixture.primaryCardId,
    nextCardId: developmentFixture.secondaryCardId
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
    vi.doMock("@/lib/data-cache", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/data-cache")>(
          "@/lib/data-cache"
        );

      return {
        ...actual,
        updateGlossarySummaryCache: updateGlossarySummaryCacheMock,
        updateReviewSummaryCache: updateReviewSummaryCacheMock
      };
    });
    vi.doMock("@/lib/review", async () => {
      const actual =
        await vi.importActual<typeof import("@/lib/review")>("@/lib/review");

      return {
        ...actual,
        getGlobalReviewPageData: vi.fn(
          async (searchParams: Record<string, string>) => {
            reviewPageCalls.push({
              scope: "global",
              searchParams
            });

            return {} as ReviewPageData;
          }
        ),
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
      };
    });
    globalDatabase.__japaneseCustomStudyDb__ = database;

    return {
      ...(await import("@/actions/review")),
      reviewPageCalls
    };
  } finally {
    globalDatabase.__japaneseCustomStudyDb__ = previousDatabase;
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/review");
  }
}

describe("review system", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    revalidatePathMock.mockReset();
    updateGlossarySummaryCacheMock.mockReset();
    updateReviewSummaryCacheMock.mockReset();
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

  it("derives grammar card reading from annotated fronts when the glossary reading is missing", () => {
    const reading = resolveReviewCardReading(
      {
        cardType: "concept",
        entryLinks: [
          {
            id: "link-grammar-takei",
            entryType: "grammar",
            entryId: "grammar-takei",
            cardId: "card-grammar-takei-concept",
            relationshipType: "primary"
          }
        ],
        front: "た{{形|けい}}"
      } as Parameters<typeof resolveReviewCardReading>[0],
      new Map([
        [
          "grammar:grammar-takei",
          {
            href: "/media/demo/glossary/grammar/grammar-takei",
            id: "grammar-takei",
            kind: "grammar",
            label: "た形",
            meaning: "passato",
            reading: undefined
          }
        ]
      ]) as unknown as Parameters<typeof resolveReviewCardReading>[1]
    );

    expect(reading).toBe("たけい");
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

  async function markAllLessonsCompleted(client: DatabaseClient, completedAt: string) {
    const lessons = await client.query.lesson.findMany();

    if (lessons.length === 0) {
      return;
    }

    await client
      .insert(lessonProgress)
      .values(
        lessons.map((lessonRow) => ({
          lessonId: lessonRow.id,
          status: "completed" as const,
          completedAt,
          lastOpenedAt: completedAt
        }))
      )
      .onConflictDoUpdate({
        target: lessonProgress.lessonId,
        set: {
          status: "completed",
          completedAt,
          lastOpenedAt: completedAt
        }
      });
  }

  async function createIsolatedNewMediaFixture(input: {
    cardCount: number;
    mediaId: string;
    mediaSlug: string;
    title: string;
  }) {
    await database.insert(media).values({
      id: input.mediaId,
      slug: input.mediaSlug,
      title: input.title,
      mediaType: "game",
      segmentKind: "chapter",
      language: "ja",
      baseExplanationLanguage: "it",
      description: `${input.title} fixture`,
      status: "active",
      createdAt: "2026-03-11T09:00:00.000Z",
      updatedAt: "2026-03-11T09:00:00.000Z"
    });
    await database.insert(lesson).values({
      id: `${input.mediaId}_lesson`,
      mediaId: input.mediaId,
      segmentId: null,
      slug: `${input.mediaSlug}-intro`,
      title: `${input.title} Intro`,
      orderIndex: 1,
      difficulty: "beginner",
      summary: `${input.title} Intro`,
      status: "active",
      sourceFile: `tests/review/${input.mediaSlug}.md`,
      createdAt: "2026-03-11T09:00:00.000Z",
      updatedAt: "2026-03-11T09:00:00.000Z"
    });
    await database.insert(lessonProgress).values({
      lessonId: `${input.mediaId}_lesson`,
      status: "completed",
      completedAt: "2026-03-11T09:00:00.000Z"
    });

    const cards = Array.from({ length: input.cardCount }, (_, index) => ({
      id: `${input.mediaId}_card_${index + 1}`,
      mediaId: input.mediaId,
      lessonId: `${input.mediaId}_lesson`,
      segmentId: null,
      sourceFile: `tests/review/${input.mediaSlug}.md`,
      cardType: "recognition" as const,
      front: `新規 ${index + 1}`,
      back: `nuova ${index + 1}`,
      notesIt: `Card nuova ${index + 1}`,
      status: "active" as const,
      orderIndex: index + 1,
      createdAt: `2026-03-11T09:0${index}:00.000Z`,
      updatedAt: `2026-03-11T09:0${index}:00.000Z`
    }));
    const terms = Array.from({ length: input.cardCount }, (_, index) => ({
      id: `${input.mediaId}_term_${index + 1}`,
      sourceId: `${input.mediaSlug}-term-${index + 1}`,
      mediaId: input.mediaId,
      segmentId: null,
      lemma: `新規${index + 1}`,
      reading: `しんき${index + 1}`,
      romaji: `shinki-${index + 1}`,
      pos: "sostantivo",
      meaningIt: `nuova ${index + 1}`,
      meaningLiteralIt: null,
      notesIt: `Termine ${index + 1}`,
      levelHint: null,
      searchLemmaNorm: `新規${index + 1}`,
      searchReadingNorm: `しんき${index + 1}`,
      searchRomajiNorm: `shinki-${index + 1}`,
      createdAt: `2026-03-11T09:0${index}:00.000Z`,
      updatedAt: `2026-03-11T09:0${index}:00.000Z`
    }));
    const entryLinks = Array.from({ length: input.cardCount }, (_, index) => ({
      id: `${input.mediaId}_link_${index + 1}`,
      cardId: `${input.mediaId}_card_${index + 1}`,
      entryType: "term" as const,
      entryId: `${input.mediaId}_term_${index + 1}`,
      relationshipType: "primary" as const
    }));

    await database.insert(card).values(cards);
    await database.insert(term).values(terms);
    await database.insert(cardEntryLink).values(entryLinks);

    return {
      cardIds: cards.map((item) => item.id),
      mediaSlug: input.mediaSlug,
      termIds: terms.map((item) => item.id)
    };
  }

  async function loadCrossMediaTermSubjectContext(client: DatabaseClient) {
    const [alphaTermEntry, betaTermEntry] = await Promise.all([
      client.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.alpha.termSourceId)
      }),
      client.query.term.findFirst({
        where: eq(term.sourceId, crossMediaFixture.beta.termSourceId)
      })
    ]);

    if (
      !alphaTermEntry ||
      !betaTermEntry ||
      !alphaTermEntry.crossMediaGroupId ||
      !betaTermEntry.crossMediaGroupId
    ) {
      throw new Error("Cross-media term fixture is missing its canonical group.");
    }

    return {
      alphaTermEntry,
      betaTermEntry,
      crossMediaGroupId: alphaTermEntry.crossMediaGroupId,
      subjectKey: `group:term:${alphaTermEntry.crossMediaGroupId}`
    };
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
    await database.insert(lesson).values({
      id: "lesson_timezone_fixture",
      mediaId: "media_timezone_fixture",
      segmentId: null,
      slug: "timezone-fixture-intro",
      title: "Timezone Fixture Intro",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Lesson fixture for timezone review tests.",
      status: "active",
      sourceFile: "tests/fixtures/db/timezone/lesson.md",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(card).values([
      {
        id: "card_timezone_fixture_before",
        mediaId: "media_timezone_fixture",
        lessonId: "lesson_timezone_fixture",
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
        lessonId: "lesson_timezone_fixture",
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
    await database.insert(lesson).values({
      id: "lesson_timezone_fixture_other",
      mediaId: "media_timezone_fixture_other",
      segmentId: null,
      slug: "timezone-fixture-other-intro",
      title: "Timezone Fixture Other Intro",
      orderIndex: 1,
      difficulty: "beginner",
      summary: "Second lesson fixture for timezone review tests.",
      status: "active",
      sourceFile: "tests/fixtures/db/timezone/other-lesson.md",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z"
    });
    await database.insert(card).values({
      id: "card_timezone_fixture_other",
      mediaId: "media_timezone_fixture_other",
      lessonId: "lesson_timezone_fixture_other",
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
    await database.insert(reviewSubjectState).values([
      {
        subjectKey: "entry:term:term_timezone_fixture_before",
        subjectType: "entry",
        entryType: "term",
        entryId: "term_timezone_fixture_before",
        crossMediaGroupId: null,
        cardId: "card_timezone_fixture_before",
        state: "review",
        stability: 2,
        difficulty: 3,
        dueAt: "2026-03-11T23:59:59.000Z",
        lastReviewedAt: "2026-03-10T23:59:59.000Z",
        lastInteractionAt: "2026-03-10T23:59:59.000Z",
        scheduledDays: 1,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T23:59:59.000Z"
      },
      {
        subjectKey: "entry:term:term_timezone_fixture_target",
        subjectType: "entry",
        entryType: "term",
        entryId: "term_timezone_fixture_target",
        crossMediaGroupId: null,
        cardId: "card_timezone_fixture_target",
        state: "review",
        stability: 2,
        difficulty: 3,
        dueAt: "2026-03-12T00:00:00.000Z",
        lastReviewedAt: "2026-03-11T00:00:00.000Z",
        lastInteractionAt: "2026-03-11T00:00:00.000Z",
        scheduledDays: 1,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z"
      },
      {
        subjectKey: "entry:term:term_timezone_fixture_other",
        subjectType: "entry",
        entryType: "term",
        entryId: "term_timezone_fixture_other",
        crossMediaGroupId: null,
        cardId: "card_timezone_fixture_other",
        state: "review",
        stability: 2,
        difficulty: 3,
        dueAt: "2026-03-12T02:15:00.000Z",
        lastReviewedAt: "2026-03-11T02:15:00.000Z",
        lastInteractionAt: "2026-03-11T02:15:00.000Z",
        scheduledDays: 1,
        learningSteps: 0,
        lapses: 0,
        reps: 1,
        schedulerVersion: "fsrs_v1",
        manualOverride: false,
        suspended: false,
        createdAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-11T02:15:00.000Z"
      }
    ]);
    await database.insert(reviewSubjectLog).values([
      {
        id: "review_subject_log_timezone_before",
        subjectKey: "entry:term:term_timezone_fixture_before",
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
        id: "review_subject_log_timezone_target",
        subjectKey: "entry:term:term_timezone_fixture_target",
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
        id: "review_subject_log_timezone_other",
        subjectKey: "entry:term:term_timezone_fixture_other",
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
      countReviewSubjectsIntroducedOnDayByMediaId(
        database,
        "media_timezone_fixture",
        asOf
      ),
      countReviewSubjectsIntroducedOnDayByMediaIds(
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
    expect(
      [...groupedCountsByMedia.values()].reduce((sum, count) => sum + count, 0)
    ).toBe(2);
  });

  it("counts introduced subjects from canonical review subject logs without double-counting shared cross-media cards", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-count");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { alphaTermEntry, crossMediaGroupId, subjectKey } =
      await loadCrossMediaTermSubjectContext(database);
    await database
      .delete(reviewSubjectState)
      .where(eq(reviewSubjectState.subjectKey, subjectKey));
    await database.insert(reviewSubjectState).values({
      subjectKey,
      subjectType: "group",
      entryType: "term",
      entryId: alphaTermEntry.id,
      crossMediaGroupId,
      cardId: crossMediaFixture.alpha.termCardId,
      state: "review",
      stability: 2.4,
      difficulty: 3.1,
      dueAt: "2026-03-12T08:00:00.000Z",
      lastReviewedAt: "2026-03-11T08:00:00.000Z",
      lastInteractionAt: "2026-03-11T08:00:00.000Z",
      scheduledDays: 1,
      learningSteps: 0,
      lapses: 0,
      reps: 1,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-11T08:00:00.000Z",
      updatedAt: "2026-03-11T08:00:00.000Z"
    });

    await database.insert(reviewSubjectLog).values([
      {
        id: "review_subject_log_cross_media_alpha",
        subjectKey,
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
        id: "review_subject_log_cross_media_beta",
        subjectKey,
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

  it("hides cards tied to incomplete lessons and also excludes orphan cards", async () => {
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
      lessonId: developmentFixture.lessonId,
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

    expect(queue?.cards).toHaveLength(0);
    expect(queue?.dueCount).toBe(0);
    expect(queue?.newAvailableCount).toBe(0);
    expect(queue?.newQueuedCount).toBe(0);
  });

  it("builds a daily queue that separates due, new, manual, and suspended cards", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await database.insert(card).values([
      {
        id: "card_fixture_new_context",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
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
        lessonId: developmentFixture.lessonId,
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
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await database.insert(card).values([
      {
        id: "card_fixture_overview_new",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
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
        lessonId: developmentFixture.lessonId,
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
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

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
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_duel_masters_primary",
      cardId: "card_duel_masters_due",
      entryType: "term",
      entryId: "term_duel_masters_review",
      relationshipType: "primary"
    });
    await database.insert(reviewSubjectState).values({
      subjectKey: "entry:term:term_duel_masters_review",
      subjectType: "entry",
      entryType: "term",
      entryId: "term_duel_masters_review",
      crossMediaGroupId: null,
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

    const launchMedia = await getReviewLaunchMedia(database);

    expect(launchMedia?.slug).toBe("duel-masters-dm25");
  });

  it("persists grading into review_subject_state and review_subject_log without overwriting history", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T12:00:00.000Z"),
      rating: "good"
    });

    const persistedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });

    expect(persistedState?.state).toBe("review");
    expect(persistedState?.reps).toBe(4);
    expect(persistedState?.lapses).toBe(1);
    expect(persistedState?.dueAt).toBe("2026-03-10T00:00:00.000Z");
    expect(persistedState?.schedulerVersion).toBe("fsrs_v1");
    expect(persistedState?.scheduledDays).toBe(1);
    expect(persistedState?.learningSteps).toBe(0);
    expect(logs).toHaveLength(2);
    expect(logs.at(-1)?.previousState).toBe("learning");
    expect(logs.at(-1)?.newState).toBe("review");
    expect(logs.at(-1)?.rating).toBe("good");
    expect(logs.at(-1)?.schedulerVersion).toBe("fsrs_v1");
  });

  it("stores cross-media grading on the canonical shared subject state", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-mirror");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { subjectKey } = await loadCrossMediaTermSubjectContext(database);
    const existingSubjectState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, subjectKey)
    });
    expect(existingSubjectState?.state).toBe("new");
    await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

    const now = new Date("2026-03-11T09:00:00.000Z");
    const nowIso = now.toISOString();

    await applyReviewGrade({
      cardId: crossMediaFixture.alpha.termCardId,
      database,
      now,
      rating: "good"
    });

    const subjectState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, subjectKey)
    });

    expect(subjectState?.lastReviewedAt).toBe(nowIso);
    expect(subjectState?.cardId).toBe(crossMediaFixture.alpha.termCardId);
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
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
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

    await database.insert(card).values([
      {
        id: "card_fixture_new_limit_a",
        mediaId: developmentFixture.mediaId,
        lessonId: developmentFixture.lessonId,
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
        lessonId: developmentFixture.lessonId,
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

  it("uses top-up batches to extend the current session without changing the daily limit", async () => {
    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "lesson_order",
        reviewDailyLimit: 1
      },
      database
    );
    const fixture = await createIsolatedNewMediaFixture({
      cardCount: 3,
      mediaId: "topup_media",
      mediaSlug: "topup-media",
      title: "Top-up Media"
    });
    const initialPage = await getReviewPageData(
      fixture.mediaSlug,
      {},
      database
    );
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    expect(initialPage?.queue.dailyLimit).toBe(1);
    expect(initialPage?.queue.newAvailableCount).toBe(3);
    expect(initialPage?.queue.newQueuedCount).toBe(1);
    expect(initialPage?.queue.queueCount).toBe(1);
    expect(initialPage?.session.extraNewCount).toBe(0);

    const completionResult = await gradeReviewCardSessionAction({
      answeredCount: initialPage?.session.answeredCount ?? 0,
      cardId: fixture.cardIds[0],
      cardMediaSlug: fixture.mediaSlug,
      extraNewCount: initialPage?.session.extraNewCount ?? 0,
      gradedCardBucket: initialPage?.selectedCard?.bucket,
      mediaSlug: fixture.mediaSlug,
      rating: "good",
      scope: "media",
      sessionMedia: initialPage?.media,
      sessionQueue: initialPage?.queue,
      sessionSettings: initialPage?.settings
    });

    expect(reviewPageCalls).toEqual([]);
    expect(completionResult.queue.dailyLimit).toBe(1);
    expect(completionResult.queue.newAvailableCount).toBe(2);
    expect(completionResult.queue.newQueuedCount).toBe(0);
    expect(completionResult.queue.queueCount).toBe(0);
    expect(completionResult.session.extraNewCount).toBe(0);

    const completionMarkup = renderToStaticMarkup(
      ReviewPage({ data: completionResult })
    );

    expect(completionMarkup).toContain("Aggiungi altre 2 nuove");
    expect(completionMarkup).toContain(
      "alla rotazione attuale di questo media"
    );

    const toppedUpPage = await getReviewPageData(
      fixture.mediaSlug,
      {
        answered: "1",
        extraNew: "2"
      },
      database
    );

    expect(toppedUpPage?.queue.dailyLimit).toBe(1);
    expect(toppedUpPage?.queue.newAvailableCount).toBe(2);
    expect(toppedUpPage?.queue.newQueuedCount).toBe(2);
    expect(toppedUpPage?.queue.queueCount).toBe(2);
    expect(toppedUpPage?.queue.queueLabel).toContain(
      "nella rotazione attuale di questa sessione"
    );
    expect(toppedUpPage?.queue.queueLabel).not.toContain("limite giornaliero");
    expect(toppedUpPage?.session.extraNewCount).toBe(2);

    const advancedTopUpResult = await gradeReviewCardSessionAction({
      answeredCount: toppedUpPage?.session.answeredCount ?? 0,
      cardId: fixture.cardIds[1],
      cardMediaSlug: fixture.mediaSlug,
      extraNewCount: toppedUpPage?.session.extraNewCount ?? 0,
      gradedCardBucket: toppedUpPage?.selectedCard?.bucket,
      mediaSlug: fixture.mediaSlug,
      nextCardId: fixture.cardIds[2],
      rating: "good",
      scope: "media",
      sessionMedia: toppedUpPage?.media,
      sessionQueue: toppedUpPage?.queue,
      sessionSettings: toppedUpPage?.settings
    });

    expect(advancedTopUpResult.selectedCard?.id).toBe(fixture.cardIds[2]);
    expect(advancedTopUpResult.queue.newAvailableCount).toBe(1);
    expect(advancedTopUpResult.queue.newQueuedCount).toBe(1);
    expect(advancedTopUpResult.queue.dailyLimit).toBe(1);
    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(
          reviewSubjectState.subjectKey,
          `entry:term:${fixture.termIds[1]}`
        )
      })
    ).toMatchObject({
      entryId: fixture.termIds[1],
      reps: 1,
      state: "learning"
    });
  });

  it("still queues a new card when a top-up is requested after other new subjects were already introduced today", async () => {
    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "lesson_order",
        reviewDailyLimit: 1
      },
      database
    );
    const fixture = await createIsolatedNewMediaFixture({
      cardCount: 3,
      mediaId: "topup_followup_media",
      mediaSlug: "topup-followup-media",
      title: "Top-up Follow-up Media"
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T13:00:00.000Z"));

    try {
      await applyReviewGrade({
        cardId: fixture.cardIds[0],
        database,
        rating: "good"
      });

      const firstTopUpPage = await getReviewPageData(
        fixture.mediaSlug,
        {
          extraNew: "1"
        },
        database
      );

      const firstTopUpCardId = firstTopUpPage?.selectedCard?.id ?? null;

      expect(firstTopUpCardId).not.toBeNull();
      expect(fixture.cardIds.slice(1)).toContain(firstTopUpCardId);
      expect(firstTopUpPage?.queue.newQueuedCount).toBe(1);

      await applyReviewGrade({
        cardId: firstTopUpCardId!,
        database,
        rating: "good"
      });

      const completionPage = await getReviewPageData(
        fixture.mediaSlug,
        {},
        database
      );

      expect(completionPage?.queue.newAvailableCount).toBe(1);
      expect(completionPage?.queue.newQueuedCount).toBe(0);
      expect(completionPage?.queue.queueCount).toBe(0);
      expect(completionPage?.selectedCard).toBeNull();

      const toppedUpPage = await getReviewPageData(
        fixture.mediaSlug,
        {
          extraNew: "1"
        },
        database
      );

      expect(toppedUpPage?.queue.newAvailableCount).toBe(1);
      expect(toppedUpPage?.queue.newQueuedCount).toBe(1);
      expect(toppedUpPage?.queue.queueCount).toBe(1);
      expect(toppedUpPage?.selectedCard?.id).toBe(
        fixture.cardIds.slice(1).find((cardId) => cardId !== firstTopUpCardId)
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the main stage in a completion state when the queue is empty unless a card is explicitly selected", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-11T12:00:00.000Z"),
      rating: "good"
    });
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
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
    expect(
      explicitSelectionPage?.selectedCardContext.gradePreviews
    ).toHaveLength(4);
  });

  it("builds canonical review session urls and tracks only cards remaining after the current one", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    await database.insert(card).values({
      id: "card_fixture_remaining_count",
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
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
    await database.insert(reviewSubjectState).values({
      subjectKey: "entry:term:term_fixture_remaining_count",
      subjectType: "entry",
      entryType: "term",
      entryId: "term_fixture_remaining_count",
      crossMediaGroupId: null,
      cardId: "card_fixture_remaining_count",
      state: "review",
      stability: 2.1,
      difficulty: 3.6,
      dueAt: "2000-01-01T00:05:00.000Z",
      lastReviewedAt: "2026-03-09T09:00:00.000Z",
      lastInteractionAt: "2026-03-09T09:00:00.000Z",
      scheduledDays: 1,
      learningSteps: 0,
      lapses: 0,
      reps: 2,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
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

    expect(frontQueuePage?.selectedCard?.id).toBe(
      developmentFixture.primaryCardId
    );
    expect(frontQueuePage?.queueCardIds).toEqual([
      developmentFixture.primaryCardId,
      "card_fixture_remaining_count"
    ]);
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
        isQueueCard:
          explicitQueuePage?.selectedCardContext.isQueueCard ?? false,
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
    await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

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
    expect(markup).toContain('preload="auto"');
    expect(markup).toContain("pitch-accent__graph");
    expect(markup).toContain(
      "/media/sample-anime/assets/audio/term/term-taberu/term-taberu.ogg"
    );
  });

  it("keeps non-canonical entry-linked cards separate and hides borrowed reading metadata", async () => {
    const chunkCardId = "card_fixture_iku_chunk";

    await database.insert(card).values({
      id: chunkCardId,
      mediaId: developmentFixture.mediaId,
      lessonId: developmentFixture.lessonId,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/fixtures/db/fixture-tcg/cards/iku-chunk.md",
      cardType: "concept",
      front: "{{行|い}}かずに{{残|のこ}}る",
      normalizedFront: "行かずに残る",
      back: "restare senza andare",
      exampleJp: "{{駅|えき}}へ{{行|い}}かずに{{家|いえ}}に{{残|のこ}}る。",
      exampleIt: "Resto a casa senza andare alla stazione.",
      notesIt: "Chunk card legata allo stesso termine ma con fronte non canonico.",
      status: "active",
      orderIndex: 3,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z"
    });
    await database.insert(cardEntryLink).values({
      id: "card_entry_link_fixture_iku_chunk_primary",
      cardId: chunkCardId,
      entryType: "term",
      entryId: developmentFixture.termDbId,
      relationshipType: "primary"
    });

    const queueSnapshot = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );
    const reviewPage = await getReviewPageData(
      developmentFixture.mediaSlug,
      {
        card: chunkCardId,
        show: "answer"
      },
      database
    );
    const detailPage = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      chunkCardId,
      database
    );

    if (!queueSnapshot) {
      return;
    }

    expect(queueSnapshot.queueCount).toBe(2);
    expect(queueSnapshot.cards.map((item) => item.id)).toContain(chunkCardId);
    expect(reviewPage?.selectedCard?.reading).toBeUndefined();
    expect(reviewPage?.selectedCard?.pronunciations).toHaveLength(0);
    expect(reviewPage?.selectedCard?.entries.map((entry) => entry.id)).toContain(
      developmentFixture.termId
    );
    expect(detailPage?.card.reading).toBeUndefined();
    expect(detailPage?.pronunciations).toHaveLength(0);

    await applyReviewGrade({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-11T12:00:00.000Z"),
      rating: "good"
    });

    const chunkReviewState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.cardId, chunkCardId)
    });

    expect(chunkReviewState).toBeUndefined();
  });

  it("hydrates a single review card with the same render-critical fields as the full page selection", async () => {
    const now = new Date("2026-03-12T10:00:00.000Z");

    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const [hydratedCard, reviewPage] = await Promise.all([
        hydrateReviewCard({
          cardId: developmentFixture.primaryCardId,
          database,
          now
        }),
        getReviewPageData(
          developmentFixture.mediaSlug,
          {
            card: developmentFixture.primaryCardId,
            show: "answer"
          },
          database
        )
      ]);

      expect(hydratedCard).not.toBeNull();
      expect(reviewPage?.selectedCard).not.toBeNull();
      expect(hydratedCard?.contexts).toHaveLength(1);
      expect(hydratedCard?.contexts[0]).toMatchObject({
        cardId: developmentFixture.primaryCardId
      });
      expect(hydratedCard).toMatchObject({
        back: reviewPage?.selectedCard?.back,
        bucket: reviewPage?.selectedCard?.bucket,
        bucketDetail: reviewPage?.selectedCard?.bucketDetail,
        bucketLabel: reviewPage?.selectedCard?.bucketLabel,
        dueAt: reviewPage?.selectedCard?.dueAt,
        dueLabel: reviewPage?.selectedCard?.dueLabel,
        effectiveState: reviewPage?.selectedCard?.effectiveState,
        effectiveStateLabel: reviewPage?.selectedCard?.effectiveStateLabel,
        entries: reviewPage?.selectedCard?.entries,
        front: reviewPage?.selectedCard?.front,
        href: reviewPage?.selectedCard?.href,
        id: reviewPage?.selectedCard?.id,
        mediaSlug: reviewPage?.selectedCard?.mediaSlug,
        mediaTitle: reviewPage?.selectedCard?.mediaTitle,
        pronunciations: reviewPage?.selectedCard?.pronunciations,
        rawReviewLabel: reviewPage?.selectedCard?.rawReviewLabel,
        reading: reviewPage?.selectedCard?.reading,
        reviewSeedState: reviewPage?.selectedCard?.reviewSeedState,
        typeLabel: reviewPage?.selectedCard?.typeLabel
      });
      expect(hydratedCard?.gradePreviews).toEqual(
        reviewPage?.selectedCardContext.gradePreviews
      );
      expect(hydratedCard?.gradePreviews).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks single-card hydration, prefetch, and grading when the lesson is incomplete", async () => {
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        completedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    const { prefetchReviewCardSessionAction } =
      await loadReviewActionsForDatabase(database);

    await expect(
      hydrateReviewCard({
        cardId: developmentFixture.primaryCardId,
        database
      })
    ).resolves.toBeNull();
    await expect(
      prefetchReviewCardSessionAction({
        cardId: developmentFixture.primaryCardId
      })
    ).resolves.toBeNull();
    await expect(
      applyReviewGrade({
        cardId: developmentFixture.primaryCardId,
        database,
        now: new Date("2026-03-12T10:00:00.000Z"),
        rating: "good"
      })
    ).rejects.toThrow("Review card not available for grading.");
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

  it("preserves a review return target on the detail page when provided", async () => {
    const detail = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detail).not.toBeNull();

    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({
        data: detail!,
        returnTo: "/review?answered=3&card=card-iku" as Route
      })
    );

    expect(markup).toContain('href="/review?answered=3&amp;card=card-iku"');
    expect(markup).toContain("Apri nella sessione");
    expect(markup).toContain("Torna alla Review");
  });

  it("keeps review return targets on glossary links and detail actions", async () => {
    const detail = await getReviewCardDetailData(
      developmentFixture.mediaSlug,
      developmentFixture.primaryCardId,
      database
    );

    expect(detail).not.toBeNull();

    const returnTo = "/review?answered=3&card=card-iku" as Route;
    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({
        data: detail!,
        returnTo
      })
    );

    expect(markup).toContain(
      `href="/glossary?media=${developmentFixture.mediaSlug}&amp;returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku"`
    );
    expect(markup).toContain(
      `href="/media/${developmentFixture.mediaSlug}/glossary/term/${developmentFixture.termId}?returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku"`
    );
    expect(markup).toContain(
      'name="returnTo" value="/review?answered=3&amp;card=card-iku"'
    );
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

  it("uses review subject manual override for manual mastery and restores the queue when reopened", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

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
    const persistedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });

    expect(
      manualQueue?.cards.some(
        (card) => card.id === developmentFixture.primaryCardId
      )
    ).toBe(false);
    expect(manualQueue?.manualCount).toBe(2);
    expect(persistedState?.state).toBe("learning");
    expect(persistedState?.manualOverride).toBe(true);
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
    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
      })
    ).toMatchObject({
      manualOverride: false,
      state: "learning",
      suspended: false
    });
  });

  it("clears manual override when resetting a manually excluded card", async () => {
    await setLinkedEntryStatusByCard({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:00:00.000Z"),
      status: "known_manual"
    });

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
      })
    ).toMatchObject({
      manualOverride: true,
      state: "learning"
    });

    await resetReviewCardProgress({
      cardId: developmentFixture.primaryCardId,
      database,
      now: new Date("2026-03-09T13:05:00.000Z")
    });

    const resetQueue = await getReviewQueueSnapshotForMedia(
      developmentFixture.mediaSlug,
      database
    );

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
      })
    ).toMatchObject({
      manualOverride: false,
      state: "new",
      suspended: false
    });
    expect(
      resetQueue?.cards.some(
        (queuedCard) => queuedCard.id === developmentFixture.primaryCardId
      )
    ).toBe(true);
  });

  it("shows the reopen action for suspended cards in the review detail page", async () => {
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

    expect(detailData?.card.reviewLabel).toBe("Sospesa");

    const markup = renderToStaticMarkup(
      ReviewCardDetailPage({ data: detailData! })
    );

    expect(markup).toContain("Rimetti in studio");
    expect(markup).not.toContain("Segna già nota");
  });

  it("suspends and resets cards without destroying the underlying review history", async () => {
    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2000-01-01T00:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

    const originalState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
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
    const preservedState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
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

    const resetState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
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
    const { targetCardId } =
      await prepareReviewSessionRedirectFixture(database);
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

  it("revalidates active review paths after grading a card in global review", async () => {
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    await gradeReviewCardSessionAction({
      answeredCount: 0,
      cardId: developmentFixture.primaryCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      extraNewCount: 0,
      rating: "good",
      scope: "global"
    });

    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(reviewPageCalls).toEqual([
      {
        scope: "global",
        searchParams: {
          answered: "1"
        }
      }
    ]);
  });

  it("hydrates the next queue card without a full rebuild when the client sends the session plan", async () => {
    const { currentCardId, nextCardId } =
      await prepareTwoQueueCardFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    expect(pageData?.queueCardIds).toEqual([currentCardId, nextCardId]);

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: currentCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId,
      rating: "good",
      scope: "media",
      sessionMedia: pageData?.media,
      sessionQueue: pageData?.queue,
      sessionSettings: pageData?.settings
    });

    expect(reviewPageCalls).toEqual([]);
    expect(result.selectedCard?.id).toBe(nextCardId);
    expect(result.queue.queueCount).toBe(
      Math.max(0, (pageData?.queue.queueCount ?? 0) - 1)
    );
    expect(result.queue.dueCount).toBe(
      Math.max(0, (pageData?.queue.dueCount ?? 0) - 1)
    );
    expect(result.queueCardIds).toEqual([]);
    expect(result.selectedCardContext.isQueueCard).toBe(true);
    expect(result.selectedCardContext.position).toBe(1);
    expect(result.selectedCardContext.remainingCount).toBe(
      Math.max(0, result.queue.queueCount - 1)
    );
    expect(result.selectedCardContext.showAnswer).toBe(false);
    expect(result.session.answeredCount).toBe(
      (pageData?.session.answeredCount ?? 0) + 1
    );
    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("falls back to a full rebuild instead of forcing completion when the session plan has no nextCardId", async () => {
    const { currentCardId } = await prepareTwoQueueCardFixture(database);
    const pageData = await getGlobalReviewPageData({}, database);
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData.session.answeredCount,
      cardId: currentCardId,
      cardMediaSlug: pageData.selectedCard?.mediaSlug,
      extraNewCount: pageData.session.extraNewCount,
      gradedCardBucket: pageData.selectedCard?.bucket,
      rating: "good",
      scope: "global",
      sessionMedia: pageData.media,
      sessionQueue: pageData.queue,
      sessionSettings: pageData.settings
    });

    expect(result).toEqual({});
    expect(reviewPageCalls).toEqual([
      {
        scope: "global",
        searchParams: {
          answered: "1"
        }
      }
    ]);
    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("prefetches a queued review card without touching session rebuild paths", async () => {
    const { nextCardId } = await prepareTwoQueueCardFixture(database);
    const { prefetchReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    const result = await prefetchReviewCardSessionAction({
      cardId: nextCardId
    });

    expect(reviewPageCalls).toEqual([]);
    expect(result?.id).toBe(nextCardId);
    expect(result?.gradePreviews).toHaveLength(4);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("advances to the next queue card after suspending a manual card when redirectMode advances queue", async () => {
    const { targetCardId } =
      await prepareReviewSessionRedirectFixture(database);
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

  it("revalidates review and glossary paths after marking a linked entry known in global review", async () => {
    const { markLinkedEntryKnownSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    await markLinkedEntryKnownSessionAction({
      answeredCount: 0,
      cardId: developmentFixture.primaryCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      extraNewCount: 0,
      redirectMode: "advance_queue",
      scope: "global"
    });

    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(updateGlossarySummaryCacheMock).toHaveBeenCalledTimes(2);
    expect(updateGlossarySummaryCacheMock).toHaveBeenNthCalledWith(1);
    expect(updateGlossarySummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
    expect(reviewPageCalls).toEqual([
      {
        scope: "global",
        searchParams: {
          notice: "known"
        }
      }
    ]);
  });

  it("keeps stay_detail mutations on tag invalidation only", async () => {
    const { markLinkedEntryKnownAction } =
      await loadReviewActionsForDatabase(database);
    const formData = new FormData();
    formData.set("mediaSlug", developmentFixture.mediaSlug);
    formData.set("cardId", developmentFixture.primaryCardId);
    formData.set("answered", "0");
    formData.set("redirectMode", "stay_detail");
    formData.set("returnTo", "/review?answered=3&card=card-iku");

    await expect(markLinkedEntryKnownAction(formData)).rejects.toThrow(
      `redirect:${mediaReviewCardHref(
        developmentFixture.mediaSlug,
        developmentFixture.primaryCardId
      )}?returnTo=%2Freview%3Fanswered%3D3%26card%3Dcard-iku`
    );

    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(updateGlossarySummaryCacheMock).toHaveBeenCalledTimes(2);
    expect(updateGlossarySummaryCacheMock).toHaveBeenNthCalledWith(1);
    expect(updateGlossarySummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("advances to the next queue card after reopening a manual card when redirectMode advances queue", async () => {
    const { targetCardId } =
      await prepareReviewSessionRedirectFixture(database);
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

  it("uses shared cross-media subject state in both global and local queues", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-fallback");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { alphaTermEntry, crossMediaGroupId, subjectKey } =
      await loadCrossMediaTermSubjectContext(database);

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
    await database
      .delete(reviewSubjectState)
      .where(eq(reviewSubjectState.subjectKey, subjectKey));
    await database.insert(reviewSubjectState).values({
      subjectKey,
      subjectType: "group",
      entryType: "term",
      entryId: alphaTermEntry.id,
      crossMediaGroupId,
      cardId: crossMediaFixture.alpha.termCardId,
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
      suspended: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });
    await database
      .update(lessonProgress)
      .set({
        status: "in_progress",
        completedAt: null
      })
      .where(eq(lessonProgress.lessonId, developmentFixture.lessonId));

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, subjectKey)
      })
    ).not.toBeNull();

    const [globalPage, globalOverview, betaPage] = await Promise.all([
      getGlobalReviewPageData({}, database),
      loadGlobalReviewOverviewSnapshot(database),
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database)
    ]);
    expect(globalPage.queue.dueCount).toBe(1);
    expect(globalPage.queue.cards).toEqual([]);
    expect(globalPage.queue.queueCount).toBeGreaterThan(0);
    expect(globalPage.selectedCard?.id).toBe(
      crossMediaFixture.alpha.termCardId
    );
    expect(globalPage.selectedCard?.bucket).toBe("due");
    expect(globalPage.selectedCard?.contexts).toHaveLength(2);

    expect(globalOverview.dueCount).toBe(1);

    expect(betaPage).not.toBeNull();
    expect(betaPage?.queue.dueCount).toBe(1);
    expect(betaPage?.selectedCard?.id).toBe(crossMediaFixture.beta.termCardId);
    expect(betaPage?.selectedCard?.bucket).toBe("due");
    expect(betaPage?.selectedCard?.contexts).toHaveLength(1);
  });

  it("excludes a graded cross-media sibling from local review rebuilds", async () => {
    const contentRoot = path.join(tempDir, "cross-media-local-exclude");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { alphaTermEntry, crossMediaGroupId, subjectKey } =
      await loadCrossMediaTermSubjectContext(database);

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
    await database
      .delete(reviewSubjectState)
      .where(eq(reviewSubjectState.subjectKey, subjectKey));
    await database.insert(reviewSubjectState).values({
      subjectKey,
      subjectType: "group",
      entryType: "term",
      entryId: alphaTermEntry.id,
      crossMediaGroupId,
      cardId: crossMediaFixture.alpha.termCardId,
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
      suspended: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });

    const [betaPage, excludedBetaPage] = await Promise.all([
      getReviewPageData(crossMediaFixture.beta.mediaSlug, {}, database),
      getReviewPageData(
        crossMediaFixture.beta.mediaSlug,
        {},
        database,
        {
          excludeCardIds: [crossMediaFixture.beta.termCardId]
        }
      )
    ]);

    expect(betaPage).not.toBeNull();
    expect(betaPage?.selectedCard?.id).toBe(crossMediaFixture.beta.termCardId);

    expect(excludedBetaPage).not.toBeNull();
    expect(excludedBetaPage?.queue.queueCount).toBe(
      (betaPage?.queue.queueCount ?? 0) - 1
    );
    expect(excludedBetaPage?.queue.dueCount).toBe(
      (betaPage?.queue.dueCount ?? 0) - 1
    );
    expect(excludedBetaPage?.selectedCard?.id).not.toBe(
      crossMediaFixture.beta.termCardId
    );
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

  it("preserves the representative shared subject state when suspending a cross-media sibling", async () => {
    const contentRoot = path.join(tempDir, "cross-media-legacy-suspend");

    await writeCrossMediaContentFixture(contentRoot);

    const result = await importContentWorkspace({
      contentRoot,
      database
    });

    expect(result.status).toBe("completed");
    const { alphaTermEntry, crossMediaGroupId, subjectKey } =
      await loadCrossMediaTermSubjectContext(database);

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
    await database
      .delete(reviewSubjectState)
      .where(eq(reviewSubjectState.subjectKey, subjectKey));
    await database.insert(reviewSubjectState).values({
      subjectKey,
      subjectType: "group",
      entryType: "term",
      entryId: alphaTermEntry.id,
      crossMediaGroupId,
      cardId: crossMediaFixture.alpha.termCardId,
      state: "review",
      stability: 2.4,
      difficulty: 3.1,
      dueAt: "2000-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-10T08:00:00.000Z",
      lastInteractionAt: "2026-03-10T08:00:00.000Z",
      scheduledDays: 2,
      learningSteps: 0,
      lapses: 1,
      reps: 3,
      schedulerVersion: "fsrs_v1",
      manualOverride: false,
      suspended: false,
      createdAt: "2026-03-10T08:00:00.000Z",
      updatedAt: "2026-03-10T08:00:00.000Z"
    });

    expect(
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, subjectKey)
      })
    ).not.toBeNull();

    await setReviewCardSuspended({
      cardId: crossMediaFixture.beta.termCardId,
      database,
      now: new Date("2026-03-11T09:00:00.000Z"),
      suspended: true
    });

    const persistedSubjectState =
      await database.query.reviewSubjectState.findFirst({
        where: eq(reviewSubjectState.subjectKey, subjectKey)
      });

    expect(persistedSubjectState).not.toBeNull();

    expect(persistedSubjectState).toMatchObject({
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
    await markAllLessonsCompleted(database, "2026-03-11T09:00:00.000Z");

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
