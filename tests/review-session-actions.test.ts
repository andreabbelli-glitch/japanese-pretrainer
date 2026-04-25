import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewPage } from "@/components/review/review-page";
import { card, lessonProgress, reviewSubjectState } from "@/db/schema";
import type { DatabaseClient } from "@/db";
import { developmentFixture } from "@/db/seed";
import { buildKanjiClashContrastKey } from "@/lib/kanji-clash";
import {
  getGlobalReviewPageData,
  getReviewPageData,
  hydrateReviewCard,
  type ReviewPageData
} from "@/lib/review";
import { applyReviewGrade } from "@/lib/review-service";
import type {
  ReviewForcedContrastResolution,
  ReviewQueueCard
} from "@/lib/review-types";
import {
  buildCanonicalReviewSessionHref,
  mediaReviewCardHref
} from "@/lib/site";
import { updateStudySettings } from "@/lib/settings";
import {
  buildReviewSubjectStateRow,
  createIsolatedNewMediaFixture
} from "./helpers/review-fixture";
import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";

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

async function prepareChainedBufferedAdvanceFixture(database: DatabaseClient) {
  const bufferedCardBId = "card_fixture_buffered_b";
  const bufferedCardCId = "card_fixture_buffered_c";

  await database
    .update(reviewSubjectState)
    .set({
      dueAt: "2026-03-09T08:03:00.000Z",
      manualOverride: false,
      state: "learning"
    })
    .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

  await database.insert(card).values([
    {
      back: "B back",
      cardType: "recognition",
      createdAt: "2026-03-08T09:00:00.000Z",
      exampleJp: null,
      exampleIt: null,
      front: "B",
      id: bufferedCardBId,
      lessonId: developmentFixture.lessonId,
      mediaId: developmentFixture.mediaId,
      notesIt: null,
      orderIndex: 2,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/review-buffered-advance/card-b.md",
      status: "active",
      updatedAt: "2026-03-08T09:00:00.000Z"
    },
    {
      back: "C back",
      cardType: "recognition",
      createdAt: "2026-03-08T09:00:00.000Z",
      exampleJp: null,
      exampleIt: null,
      front: "C",
      id: bufferedCardCId,
      lessonId: developmentFixture.lessonId,
      mediaId: developmentFixture.mediaId,
      notesIt: null,
      orderIndex: 3,
      segmentId: developmentFixture.segmentId,
      sourceFile: "tests/review-buffered-advance/card-c.md",
      status: "active",
      updatedAt: "2026-03-08T09:00:00.000Z"
    }
  ]);

  await database.insert(reviewSubjectState).values([
    buildReviewSubjectStateRow({
      cardId: bufferedCardBId,
      difficulty: 4,
      dueAt: "2026-03-09T08:01:00.000Z",
      lapses: 0,
      learningSteps: 0,
      lastInteractionAt: "2026-03-08T09:00:00.000Z",
      lastReviewedAt: "2026-03-08T09:00:00.000Z",
      reps: 1,
      scheduledDays: 0,
      state: "learning",
      stability: 1.6,
      subjectKey: `card:${bufferedCardBId}`
    }),
    buildReviewSubjectStateRow({
      cardId: bufferedCardCId,
      difficulty: 4,
      dueAt: "2026-03-09T08:02:00.000Z",
      lapses: 0,
      learningSteps: 0,
      lastInteractionAt: "2026-03-08T09:00:00.000Z",
      lastReviewedAt: "2026-03-08T09:00:00.000Z",
      reps: 1,
      scheduledDays: 0,
      state: "learning",
      stability: 1.6,
      subjectKey: `card:${bufferedCardCId}`
    })
  ]);

  return {
    bufferedCardBId,
    bufferedCardCId
  };
}

type ReviewPageLoadCall = {
  mediaSlug?: string;
  resolvedMediaRowsLength?: number;
  scope: "global" | "media";
  searchParams: Record<string, string>;
};

type LoadReviewActionsOptions = {
  hydrateReviewCard?: (input: {
    cardId: string;
  }) =>
    | Promise<ReviewQueueCard | null | undefined>
    | ReviewQueueCard
    | null
    | undefined;
};

async function loadReviewActionsForDatabase(
  database: DatabaseClient,
  options: LoadReviewActionsOptions = {}
) {
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
        hydrateReviewCard: vi.fn(async (input: { cardId: string }) => {
          if (options.hydrateReviewCard) {
            const hydratedCard = await options.hydrateReviewCard(input);

            if (hydratedCard !== undefined) {
              return hydratedCard;
            }
          }

          return actual.hydrateReviewCard(input);
        }),
        getGlobalReviewPageData: vi.fn(
          async (
            searchParams: Record<string, string>,
            _database?: unknown,
            reviewOptions?: {
              resolvedMediaRows?: unknown[];
            }
          ) => {
            reviewPageCalls.push({
              scope: "global",
              searchParams,
              ...(reviewOptions?.resolvedMediaRows
                ? {
                    resolvedMediaRowsLength:
                      reviewOptions.resolvedMediaRows.length
                  }
                : {})
            });

            return {} as ReviewPageData;
          }
        ),
        getReviewPageData: vi.fn(
          async (
            mediaSlug: string,
            searchParams: Record<string, string>,
            _database?: unknown,
            reviewOptions?: {
              resolvedMediaRows?: unknown[];
            }
          ) => {
            reviewPageCalls.push({
              mediaSlug,
              scope: "media",
              searchParams,
              ...(reviewOptions?.resolvedMediaRows
                ? {
                    resolvedMediaRowsLength:
                      reviewOptions.resolvedMediaRows.length
                  }
                : {})
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

describe("review session actions", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    revalidatePathMock.mockReset();
    updateGlossarySummaryCacheMock.mockReset();
    updateReviewSummaryCacheMock.mockReset();
    ({ database, tempDir } = await setupReviewDatabase({
      prefix: "jcs-review-session-actions-",
      seedDevelopmentFixture: true
    }));
  });

  afterEach(async () => {
    await cleanupReviewDatabase({ database, tempDir });
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
    const fixture = await createIsolatedNewMediaFixture(database, {
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
      resolvedMediaRowsLength: 1,
      scope: "media",
      searchParams: {
        notice: "reset"
      }
    });
  });

  it("reuses prefetched media rows when rebuilding a media review session after a mutation", async () => {
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
    expect(reviewPageCalls[0]?.resolvedMediaRowsLength).toBe(1);
  });

  it("revalidates active review paths after grading a card in global review", async () => {
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");

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
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();

    mediaFindFirstSpy.mockRestore();
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
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");

    try {
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
      expect(pageData?.queue.advanceCards.map((card) => card.id)).toEqual([
        nextCardId
      ]);
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
      expect(result.queue.advanceCards).toEqual([]);
      expect(result.session.answeredCount).toBe(
        (pageData?.session.answeredCount ?? 0) + 1
      );
      expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
        developmentFixture.mediaId
      );
      expect(revalidatePathMock).not.toHaveBeenCalled();
      expect(mediaFindFirstSpy).not.toHaveBeenCalled();
    } finally {
      mediaFindFirstSpy.mockRestore();
    }
  });

  it("returns forced contrast session metadata when grading with an incremental session plan", async () => {
    const { currentCardId, nextCardId } =
      await prepareTwoQueueCardFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: currentCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      forcedContrast: {
        source: "review-grading",
        targetResultKey: `grammar:entry:${developmentFixture.grammarDbId}`
      },
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
    expect(result.session.forcedContrast).toEqual({
      contrastKey: buildKanjiClashContrastKey(
        primarySubjectKey,
        secondarySubjectKey
      ),
      current: {
        cardId: currentCardId,
        crossMediaGroupId: null,
        entryId: developmentFixture.termDbId,
        entryType: "term",
        subjectKey: primarySubjectKey,
        subjectType: "entry"
      },
      mediaId: developmentFixture.mediaId,
      mediaSlug: developmentFixture.mediaSlug,
      scope: "media",
      source: "forced",
      target: {
        cardId: null,
        crossMediaGroupId: null,
        entryId: developmentFixture.grammarDbId,
        entryType: "grammar",
        subjectKey: secondarySubjectKey,
        subjectType: "entry"
      }
    } satisfies ReviewForcedContrastResolution);
  });

  it("hydrates a later prefetched queue card when the immediate next one is unavailable", async () => {
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
      candidateCardIds: ["missing-card", nextCardId],
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
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
    expect(result.selectedCardContext.isQueueCard).toBe(true);
    expect(result.selectedCardContext.position).toBe(2);
  });

  it("keeps the canonical queue position when hydration prefers a later candidate", async () => {
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
      candidateCardIds: [currentCardId, nextCardId],
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
    expect(result.selectedCardContext.position).toBe(2);
    expect(result.selectedCardContext.remainingCount).toBe(
      Math.max(0, result.queue.queueCount - 2)
    );
  });

  it("keeps canonical positions through chained buffered advances when the middle card is unavailable", async () => {
    const { bufferedCardBId, bufferedCardCId } =
      await prepareChainedBufferedAdvanceFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database, {
        hydrateReviewCard: ({ cardId }) =>
          cardId === bufferedCardBId ? null : undefined
      });
    const chainedSessionQueue = pageData
      ? {
          ...pageData.queue,
          dueCount: 4,
          introLabel: "4 cards",
          queueCount: 4,
          queueLabel: "4 cards"
        }
      : null;

    expect(chainedSessionQueue).not.toBeNull();

    const firstResult = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: developmentFixture.primaryCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      canonicalCandidateCardIds: [
        bufferedCardBId,
        bufferedCardCId,
        developmentFixture.secondaryCardId
      ],
      candidateCardIds: [
        bufferedCardBId,
        bufferedCardCId,
        developmentFixture.secondaryCardId
      ],
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId: bufferedCardCId,
      rating: "good",
      scope: "media",
      sessionMedia: pageData?.media,
      sessionQueue: chainedSessionQueue ?? pageData?.queue,
      sessionSettings: pageData?.settings
    });

    expect(reviewPageCalls).toEqual([]);
    expect(firstResult.selectedCard?.id).toBe(bufferedCardCId);
    expect(firstResult.selectedCardContext.position).toBe(2);
    expect(firstResult.selectedCardContext.remainingCount).toBe(1);
    expect(firstResult.queue.advanceCards.map((card) => card.id)).toEqual([
      developmentFixture.secondaryCardId
    ]);

    const secondResult = await gradeReviewCardSessionAction({
      answeredCount: firstResult.session.answeredCount,
      cardId: bufferedCardCId,
      cardMediaSlug: developmentFixture.mediaSlug,
      canonicalCandidateCardIds: [
        bufferedCardBId,
        developmentFixture.secondaryCardId
      ],
      candidateCardIds: [developmentFixture.secondaryCardId],
      extraNewCount: firstResult.session.extraNewCount,
      gradedCardBucket: firstResult.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId: developmentFixture.secondaryCardId,
      rating: "good",
      scope: "media",
      sessionMedia: firstResult.media,
      sessionQueue: firstResult.queue,
      sessionSettings: firstResult.settings
    });

    expect(secondResult.selectedCard?.id).toBe(
      developmentFixture.secondaryCardId
    );
    expect(secondResult.selectedCardContext.position).toBe(2);
    expect(secondResult.selectedCardContext.remainingCount).toBe(0);
    expect(secondResult.queue.advanceCards).toEqual([]);

    const sessionHref = buildCanonicalReviewSessionHref({
      answeredCount: secondResult.session.answeredCount,
      cardId: secondResult.selectedCard?.id,
      extraNewCount: secondResult.session.extraNewCount,
      isQueueCard: secondResult.selectedCardContext.isQueueCard,
      mediaSlug: developmentFixture.mediaSlug,
      position: secondResult.selectedCardContext.position,
      segmentId: secondResult.session.segmentId,
      showAnswer: secondResult.selectedCardContext.showAnswer
    });

    expect(sessionHref).toContain(`card=${developmentFixture.secondaryCardId}`);
    expect(sessionHref).not.toContain(`card=${bufferedCardBId}`);
  });

  it("starts later queued card hydrations before the first missing candidate settles and reuses them for advance cards", async () => {
    const { bufferedCardBId, bufferedCardCId } =
      await prepareChainedBufferedAdvanceFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const hydrateGate = (() => {
      let resolve!: () => void;

      return {
        promise: new Promise<void>((innerResolve) => {
          resolve = innerResolve;
        }),
        resolve
      };
    })();
    const hydrateCallsById = new Map<string, number>();
    const startedCardIds = new Set<string>();
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database, {
        hydrateReviewCard: async ({ cardId }) => {
          startedCardIds.add(cardId);
          hydrateCallsById.set(cardId, (hydrateCallsById.get(cardId) ?? 0) + 1);

          if (cardId === bufferedCardBId) {
            await hydrateGate.promise;
            return null;
          }

          return hydrateReviewCard({
            cardId,
            database
          });
        }
      });
    const chainedSessionQueue = pageData
      ? {
          ...pageData.queue,
          dueCount: 4,
          introLabel: "4 cards",
          queueCount: 4,
          queueLabel: "4 cards"
        }
      : null;

    expect(chainedSessionQueue).not.toBeNull();

    const resultPromise = gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: developmentFixture.primaryCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      canonicalCandidateCardIds: [
        bufferedCardBId,
        bufferedCardCId,
        developmentFixture.secondaryCardId
      ],
      candidateCardIds: [
        bufferedCardBId,
        bufferedCardCId,
        developmentFixture.secondaryCardId
      ],
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId: bufferedCardCId,
      rating: "good",
      scope: "media",
      sessionMedia: pageData?.media,
      sessionQueue: chainedSessionQueue ?? pageData?.queue,
      sessionSettings: pageData?.settings
    });

    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (startedCardIds.has(bufferedCardBId)) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    await Promise.resolve();
    await Promise.resolve();

    expect(startedCardIds).toContain(bufferedCardBId);
    expect(startedCardIds).toContain(bufferedCardCId);
    expect(startedCardIds).toContain(developmentFixture.secondaryCardId);

    hydrateGate.resolve();

    const result = await resultPromise;

    expect(reviewPageCalls).toEqual([]);
    expect(result.selectedCard?.id).toBe(bufferedCardCId);
    expect(result.queue.advanceCards.map((card) => card.id)).toEqual([
      developmentFixture.secondaryCardId
    ]);
    expect(hydrateCallsById.get(bufferedCardBId)).toBe(1);
    expect(hydrateCallsById.get(bufferedCardCId)).toBe(1);
    expect(hydrateCallsById.get(developmentFixture.secondaryCardId)).toBe(1);
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

  it("falls back to a full rebuild when nextCardId is null and queued cards remain", async () => {
    const { currentCardId } = await prepareTwoQueueCardFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: currentCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId: null,
      rating: "good",
      scope: "media",
      sessionMedia: pageData?.media,
      sessionQueue: pageData?.queue,
      sessionSettings: pageData?.settings
    });

    expect(reviewPageCalls).toEqual([
      {
        mediaSlug: developmentFixture.mediaSlug,
        scope: "media",
        searchParams: {
          answered: "1"
        }
      }
    ]);
    expect(result).toEqual({});
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
      resolvedMediaRowsLength: 1,
      scope: "media",
      searchParams: {
        notice: "suspended"
      }
    });
  });

  it("revalidates review and glossary paths after marking a linked entry known in global review", async () => {
    const { markLinkedEntryKnownSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);
    const mediaFindFirstSpy = vi.spyOn(database.query.media, "findFirst");

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
        resolvedMediaRowsLength: 1,
        scope: "global",
        searchParams: {
          notice: "known"
        }
      }
    ]);
    expect(mediaFindFirstSpy).not.toHaveBeenCalled();

    mediaFindFirstSpy.mockRestore();
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

  it("rejects malformed review form counters instead of partially parsing them", async () => {
    const { gradeReviewCardAction } =
      await loadReviewActionsForDatabase(database);
    const formData = new FormData();
    formData.set("mediaSlug", developmentFixture.mediaSlug);
    formData.set("cardId", developmentFixture.primaryCardId);
    formData.set("rating", "good");
    formData.set("answered", "3abc");
    formData.set("extraNew", "2abc");

    await expect(gradeReviewCardAction(formData)).rejects.toThrow(
      `redirect:/media/${developmentFixture.mediaSlug}/review?answered=1`
    );

    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
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
      resolvedMediaRowsLength: 1,
      scope: "media",
      searchParams: {
        notice: "learning"
      }
    });
  });
});
