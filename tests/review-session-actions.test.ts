import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewPage } from "@/components/review/review-page";
import { lessonProgress, reviewSubjectState } from "@/db/schema";
import type { DatabaseClient } from "@/db";
import { developmentFixture } from "@/db/seed";
import { buildKanjiClashContrastKey } from "@/features/kanji-clash";
import {
  getGlobalReviewPageData,
  getReviewPageData,
  hydrateReviewCard
} from "@/features/review/server";
import { applyReviewGrade } from "@/features/review/server/service";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
import type {
  ReviewForcedContrastResolution,
  ReviewQueueCard
} from "@/features/review/types";
import { updateStudySettings } from "@/features/settings/server";
import {
  createIsolatedNewMediaFixture,
  prepareChainedBufferedAdvanceFixture as prepareChainedBufferedAdvanceFixtureBase
} from "./helpers/review-fixture";
import {
  cleanupReviewDatabase,
  setupReviewDatabase
} from "./helpers/review-db-fixture";
import {
  loadReviewActionsForDatabase as loadReviewActionsForDatabaseHarness,
  type LoadReviewActionsOptions
} from "./helpers/review-action-test-harness";

const primaryCanonicalSubjectKey = `entry:term:${developmentFixture.termDbId}`;
const secondaryCanonicalSubjectKey = `entry:grammar:${developmentFixture.grammarDbId}`;
const primarySubjectKey = buildReviewMemoryKey({
  canonicalSubjectKey: primaryCanonicalSubjectKey,
  cardId: developmentFixture.primaryCardId,
  recallTask: "recognition"
});
const secondarySubjectKey = buildReviewMemoryKey({
  canonicalSubjectKey: secondaryCanonicalSubjectKey,
  cardId: developmentFixture.secondaryCardId,
  recallTask: "other"
});
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
      dueAt: "2000-01-01T00:00:00.000Z",
      lastReviewedAt: "2026-03-09T08:59:00.000Z",
      scheduledDays: 1,
      state: "review",
      stability: 100
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
      lastReviewedAt: "2000-01-01T00:00:00.000Z",
      manualOverride: false,
      stability: 1,
      state: "learning"
    })
    .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

  return {
    currentCardId: developmentFixture.primaryCardId,
    nextCardId: developmentFixture.secondaryCardId
  };
}

async function prepareChainedBufferedAdvanceFixture(database: DatabaseClient) {
  return prepareChainedBufferedAdvanceFixtureBase(database, {
    lessonId: developmentFixture.lessonId,
    mediaId: developmentFixture.mediaId,
    secondarySubjectKey,
    segmentId: developmentFixture.segmentId
  });
}

function loadReviewActionsForDatabase(
  database: DatabaseClient,
  options: LoadReviewActionsOptions = {}
) {
  return loadReviewActionsForDatabaseHarness(database, options, {
    updateGlossarySummaryCacheMock,
    updateReviewSummaryCacheMock
  });
}

async function requireFreshReviewPageData(
  database: DatabaseClient,
  mediaSlug: string,
  searchParams: Record<string, string>
) {
  const pageData = await getReviewPageData(mediaSlug, searchParams, database, {
    bypassCache: true
  });

  if (!pageData) {
    throw new Error("Expected review page data.");
  }

  return pageData;
}

function buildCanonicalCandidateSnapshot(card: ReviewQueueCard) {
  return {
    bucket: card.bucket,
    cardId: card.id,
    reviewStateUpdatedAt: card.reviewStateUpdatedAt ?? null,
    schedulingKey: card.reviewSeedState.schedulingKey?.trim() || null
  };
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
      await loadReviewActionsForDatabase(database, {
        getReviewPageData: async ({ mediaSlug, searchParams }) => {
          const pageData = await getReviewPageData(
            mediaSlug,
            searchParams,
            database,
            { bypassCache: true }
          );

          if (!pageData) {
            throw new Error("Expected review page data.");
          }

          return pageData;
        }
      });

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

    expect(reviewPageCalls).toEqual([
      {
        mediaSlug: fixture.mediaSlug,
        scope: "media",
        searchParams: {
          answered: "1"
        }
      }
    ]);
    expect(completionResult.queue.dailyLimit).toBe(1);
    expect(completionResult.queue.newAvailableCount).toBe(2);
    expect(completionResult.queue.newQueuedCount).toBe(0);
    expect(completionResult.queue.queueCount).toBe(1);
    expect(completionResult.selectedCard?.id).toBe(fixture.cardIds[0]);
    expect(completionResult.selectedCard?.bucket).toBe("upcoming");
    expect(completionResult.session.extraNewCount).toBe(0);

    const firstGradedState = await database.query.reviewSubjectState.findFirst({
      where: eq(
        reviewSubjectState.subjectKey,
        buildReviewMemoryKey({
          canonicalSubjectKey: `entry:term:${fixture.termIds[0]}`,
          cardId: fixture.cardIds[0]!,
          recallTask: "recognition"
        })
      )
    });

    expect(completionResult.queue.nextDueAt).toBe(firstGradedState?.dueAt);
    expect(completionResult.queue.upcomingCount).toBeGreaterThanOrEqual(1);

    const completionMarkup = renderToStaticMarkup(
      ReviewPage({ data: completionResult })
    );

    expect(completionMarkup).not.toContain("Aggiungi altre 2 nuove");
    expect(completionMarkup).toContain("Da ripassare nei prossimi giorni");

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
          buildReviewMemoryKey({
            canonicalSubjectKey: `entry:term:${fixture.termIds[1]}`,
            cardId: fixture.cardIds[1]!,
            recallTask: "recognition"
          })
        )
      })
    ).toMatchObject({
      entryId: fixture.termIds[1],
      reps: 1,
      state: "learning"
    });
  });

  it("consumes top-up allowance across server refreshes using the session anchor", async () => {
    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "lesson_order",
        reviewDailyLimit: 1
      },
      database
    );
    const fixture = await createIsolatedNewMediaFixture(database, {
      cardCount: 4,
      mediaId: "topup_anchor_media",
      mediaSlug: "topup-anchor-media",
      title: "Top-up Anchor Media"
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T13:00:00.000Z"));

    try {
      const initialPage = await getReviewPageData(
        fixture.mediaSlug,
        {},
        database
      );

      expect(initialPage?.queue.dailyLimit).toBe(1);
      expect(initialPage?.queue.newQueuedCount).toBe(1);

      await applyReviewGrade({
        cardId: initialPage?.selectedCard?.id ?? fixture.cardIds[0],
        database,
        rating: "good"
      });

      const topUpPage = await getReviewPageData(
        fixture.mediaSlug,
        {
          answered: "1",
          extraNew: "2",
          extraNewAnchor: "1"
        },
        database
      );
      const firstExtraCardId = topUpPage?.selectedCard?.id;

      expect(topUpPage?.queue.newAvailableCount).toBe(3);
      expect(topUpPage?.queue.newQueuedCount).toBe(2);
      expect(
        (
          topUpPage?.session as
            | { extraNewAnchorCount?: number | null }
            | undefined
        )?.extraNewAnchorCount
      ).toBe(1);

      await applyReviewGrade({
        cardId: firstExtraCardId ?? fixture.cardIds[1],
        database,
        rating: "good"
      });

      const refreshedPage = await getReviewPageData(
        fixture.mediaSlug,
        {
          answered: "2",
          extraNew: "2",
          extraNewAnchor: "1"
        },
        database
      );

      expect(refreshedPage?.queue.newAvailableCount).toBe(2);
      expect(refreshedPage?.queue.newQueuedCount).toBe(1);
      expect(refreshedPage?.queue.queueCount).toBe(1);
      expect(refreshedPage?.queueCardIds).toHaveLength(1);
      expect(refreshedPage?.queueCardIds).not.toContain(firstExtraCardId);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats an unanchored top-up as fresh after earlier extra introductions", async () => {
    await updateStudySettings(
      {
        furiganaMode: "on",
        glossaryDefaultSort: "lesson_order",
        reviewDailyLimit: 1
      },
      database
    );
    const fixture = await createIsolatedNewMediaFixture(database, {
      cardCount: 4,
      mediaId: "topup_fresh_anchor_media",
      mediaSlug: "topup-fresh-anchor-media",
      title: "Fresh Top-up Anchor Media"
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T13:00:00.000Z"));

    try {
      const initialPage = await getReviewPageData(
        fixture.mediaSlug,
        {},
        database
      );

      await applyReviewGrade({
        cardId: initialPage?.selectedCard?.id ?? fixture.cardIds[0],
        database,
        rating: "good"
      });

      const firstTopUp = await getReviewPageData(
        fixture.mediaSlug,
        {
          answered: "1",
          extraNew: "1"
        },
        database
      );

      expect(firstTopUp?.session.extraNewAnchorCount).toBe(1);
      expect(firstTopUp?.queue.newQueuedCount).toBe(1);

      await applyReviewGrade({
        cardId: firstTopUp?.selectedCard?.id ?? fixture.cardIds[1],
        database,
        rating: "good"
      });

      const consumedFirstTopUp = await getReviewPageData(
        fixture.mediaSlug,
        {
          answered: "2",
          extraNew: "1",
          extraNewAnchor: "1"
        },
        database
      );

      expect(consumedFirstTopUp?.queue.newQueuedCount).toBe(0);

      const freshTopUp = await getReviewPageData(
        fixture.mediaSlug,
        {
          answered: "2",
          extraNew: "1"
        },
        database
      );

      expect(freshTopUp?.session.extraNewAnchorCount).toBe(2);
      expect(freshTopUp?.queue.newQueuedCount).toBe(1);
      expect(freshTopUp?.queueCardIds).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["again", "hard"] as const)(
    "requeues a one-card %s as learn-ahead and makes it due when its intraday delay expires",
    async (rating) => {
      const fixture = await createIsolatedNewMediaFixture(database, {
        cardCount: 1,
        mediaId: "terminal_again_media",
        mediaSlug: "terminal-again-media",
        title: "Terminal Again Media"
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T13:00:00.000Z"));

      try {
        const initialPage = await getReviewPageData(
          fixture.mediaSlug,
          {},
          database
        );
        const { gradeReviewCardSessionAction, reviewPageCalls } =
          await loadReviewActionsForDatabase(database, {
            getReviewPageData: async ({ mediaSlug, searchParams }) => {
              const pageData = await getReviewPageData(
                mediaSlug,
                searchParams,
                database,
                { bypassCache: true }
              );

              if (!pageData) {
                throw new Error("Expected review page data.");
              }

              return pageData;
            }
          });

        const completionResult = await gradeReviewCardSessionAction({
          answeredCount: initialPage?.session.answeredCount ?? 0,
          cardId: fixture.cardIds[0],
          cardMediaSlug: fixture.mediaSlug,
          extraNewCount: initialPage?.session.extraNewCount ?? 0,
          gradedCardBucket: initialPage?.selectedCard?.bucket,
          mediaSlug: fixture.mediaSlug,
          nextCardId: null,
          rating,
          scope: "media",
          sessionMedia: initialPage?.media,
          sessionQueue: initialPage?.queue,
          sessionSettings: initialPage?.settings
        });

        expect(reviewPageCalls).toEqual([
          {
            mediaSlug: fixture.mediaSlug,
            scope: "media",
            searchParams: {
              answered: "1"
            }
          }
        ]);
        expect(completionResult.selectedCard?.id).toBe(fixture.cardIds[0]);
        expect(completionResult.selectedCard?.bucket).toBe("upcoming");
        expect(completionResult.selectedCardContext.showAnswer).toBe(false);
        expect(completionResult.queue.queueCount).toBe(1);
        expect(completionResult.queue.nextDueAt).toEqual(expect.any(String));
        expect(completionResult.queue.upcomingCount).toBeGreaterThanOrEqual(1);

        vi.setSystemTime(
          new Date(
            new Date(completionResult.queue.nextDueAt!).getTime() + 1_000
          )
        );

        const dueRefresh = await getReviewPageData(
          fixture.mediaSlug,
          {
            answered: String(completionResult.session.answeredCount)
          },
          database
        );

        expect(dueRefresh?.selectedCard?.id).toBe(fixture.cardIds[0]);
        expect(dueRefresh?.selectedCard?.bucket).toBe("due");
        expect(dueRefresh?.selectedCardContext.showAnswer).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    }
  );

  it.each([
    {
      expectedRequeuedCard: "second" as const,
      expectedTerminalRebuilds: 1,
      firstRating: "good" as const,
      preservesFirstScheduledDue: false,
      terminalRating: "again" as const
    },
    {
      expectedRequeuedCard: null,
      expectedTerminalRebuilds: 0,
      firstRating: "good" as const,
      preservesFirstScheduledDue: false,
      terminalRating: "good" as const
    },
    {
      expectedRequeuedCard: null,
      expectedTerminalRebuilds: 0,
      firstRating: "good" as const,
      preservesFirstScheduledDue: true,
      terminalRating: "easy" as const
    },
    {
      expectedRequeuedCard: "first" as const,
      expectedTerminalRebuilds: 1,
      firstRating: "again" as const,
      preservesFirstScheduledDue: false,
      terminalRating: "good" as const
    }
  ])(
    "keeps two learn-ahead cards on the fast path for $firstRating then performs $expectedTerminalRebuilds terminal rebuild(s) after $terminalRating",
    async ({
      expectedRequeuedCard,
      expectedTerminalRebuilds,
      firstRating,
      preservesFirstScheduledDue,
      terminalRating
    }) => {
      const fixture = await createIsolatedNewMediaFixture(database, {
        cardCount: 2,
        mediaId: `learn_ahead_pair_${firstRating}_${terminalRating}`,
        mediaSlug: `learn-ahead-pair-${firstRating}-${terminalRating}`,
        title: `Learn Ahead Pair ${firstRating} ${terminalRating}`
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-11T13:00:00.000Z"));

      try {
        await applyReviewGrade({
          cardId: fixture.cardIds[0]!,
          database,
          rating: "good"
        });
        await applyReviewGrade({
          cardId: fixture.cardIds[1]!,
          database,
          rating: "good"
        });

        const initialPage = await getReviewPageData(
          fixture.mediaSlug,
          {},
          database
        );
        const firstCard = initialPage?.selectedCard;
        const secondCardId = initialPage?.queueCardIds.find(
          (cardId) => cardId !== firstCard?.id
        );

        expect(firstCard?.bucket).toBe("upcoming");
        expect(initialPage?.queue.queueCount).toBe(2);
        expect(secondCardId).toEqual(expect.any(String));

        const { gradeReviewCardSessionAction, reviewPageCalls } =
          await loadReviewActionsForDatabase(database, {
            getReviewPageData: async ({ mediaSlug, searchParams }) => {
              const pageData = await getReviewPageData(
                mediaSlug,
                searchParams,
                database,
                { bypassCache: true }
              );

              if (!pageData) {
                throw new Error("Expected review page data.");
              }

              return pageData;
            }
          });

        const afterFirst = await gradeReviewCardSessionAction({
          answeredCount: initialPage?.session.answeredCount ?? 0,
          candidateCardIds: [secondCardId!],
          canonicalCandidateCardIds: [secondCardId!],
          cardId: firstCard!.id,
          cardMediaSlug: fixture.mediaSlug,
          expectedUpdatedAt:
            initialPage?.selectedCardContext.reviewStateUpdatedAt ?? null,
          extraNewCount: 0,
          gradedCardBucket: firstCard!.bucket,
          gradedCardDueAt: firstCard!.dueAt,
          gradedCardScheduledDays: firstCard!.reviewSeedState.scheduledDays,
          gradedCardState: firstCard!.reviewSeedState.state,
          mediaSlug: fixture.mediaSlug,
          nextCardId: secondCardId!,
          rating: firstRating,
          scope: "media",
          sessionMedia: initialPage!.media,
          sessionQueue: initialPage!.queue,
          sessionSettings: initialPage!.settings
        });

        expect(reviewPageCalls).toEqual([]);
        expect(afterFirst.selectedCard?.id).toBe(secondCardId);
        expect(afterFirst.selectedCard?.bucket).toBe("upcoming");
        expect(afterFirst.queue.queueCount).toBe(1);
        expect(afterFirst.queue.dueCount).toBe(0);
        expect(afterFirst.queue.newQueuedCount).toBe(0);
        if (firstRating === "again") {
          expect(afterFirst.queue.pendingLearningDueAt).toEqual(
            expect.any(String)
          );
          expect(afterFirst.queue.nextLearningDueAt).toBe(
            afterFirst.queue.pendingLearningDueAt
          );
        } else {
          expect(afterFirst.queue.pendingLearningDueAt).toBeNull();
          expect(afterFirst.queue.nextLearningDueAt).toBeNull();
        }

        const secondCard = afterFirst.selectedCard!;
        const terminalResult = await gradeReviewCardSessionAction({
          answeredCount: afterFirst.session.answeredCount,
          cardId: secondCard.id,
          cardMediaSlug: fixture.mediaSlug,
          expectedUpdatedAt:
            afterFirst.selectedCardContext.reviewStateUpdatedAt ?? null,
          extraNewCount: 0,
          gradedCardBucket: secondCard.bucket,
          gradedCardDueAt: secondCard.dueAt,
          gradedCardScheduledDays: secondCard.reviewSeedState.scheduledDays,
          gradedCardState: secondCard.reviewSeedState.state,
          mediaSlug: fixture.mediaSlug,
          nextCardId: null,
          rating: terminalRating,
          scope: "media",
          sessionMedia: afterFirst.media,
          sessionQueue: afterFirst.queue,
          sessionSettings: afterFirst.settings
        });

        expect(reviewPageCalls).toHaveLength(expectedTerminalRebuilds);
        if (expectedTerminalRebuilds === 1) {
          expect(terminalResult.selectedCard?.id).toBe(
            expectedRequeuedCard === "first" ? firstCard!.id : secondCard.id
          );
          expect(terminalResult.selectedCard?.bucket).toBe("upcoming");
          expect(terminalResult.queue.queueCount).toBe(1);
        } else {
          expect(terminalResult.selectedCard).toBeNull();
          expect(terminalResult.queue.queueCount).toBe(0);
          if (preservesFirstScheduledDue) {
            expect(terminalResult.queue.nextDueAt).toBe(
              afterFirst.queue.nextDueAt
            );
          }
        }
      } finally {
        vi.useRealTimers();
      }
    }
  );

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
    const beforeState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });

    await gradeReviewCardSessionAction({
      answeredCount: 0,
      cardId: developmentFixture.primaryCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      extraNewCount: 0,
      expectedUpdatedAt: beforeState?.updatedAt ?? null,
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
        expectedUpdatedAt:
          pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
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
      expect(result.selectedCard?.reviewStateUpdatedAt).toEqual(
        expect.any(String)
      );
      expect(result.selectedCardContext.reviewStateUpdatedAt).toBe(
        result.selectedCard?.reviewStateUpdatedAt
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

  it("falls back instead of advancing to a stale candidate that is no longer queued", async () => {
    const { currentCardId, nextCardId } =
      await prepareTwoQueueCardFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    expect(pageData?.queueCardIds).toEqual([currentCardId, nextCardId]);

    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z",
        state: "review",
        updatedAt: "2026-03-09T12:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));

    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database);

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: currentCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      candidateCardIds: [nextCardId],
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId,
      rating: "good",
      scope: "media",
      sessionMedia: pageData?.media,
      sessionQueue: pageData?.queue,
      sessionSettings: pageData?.settings
    });

    expect(result.selectedCard?.id).not.toBe(nextCardId);
    expect(reviewPageCalls).toEqual([
      {
        mediaSlug: developmentFixture.mediaSlug,
        scope: "media",
        searchParams: {
          answered: "1"
        }
      }
    ]);
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
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
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
        primaryCanonicalSubjectKey,
        secondaryCanonicalSubjectKey
      ),
      current: {
        cardId: currentCardId,
        crossMediaGroupId: null,
        entryId: developmentFixture.termDbId,
        entryType: "term",
        subjectKey: primaryCanonicalSubjectKey,
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
        subjectKey: secondaryCanonicalSubjectKey,
        subjectType: "entry"
      }
    } satisfies ReviewForcedContrastResolution);
  });

  it("rebuilds the canonical queue when the first buffered candidate is unavailable", async () => {
    const { currentCardId, nextCardId } =
      await prepareTwoQueueCardFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database, {
        getReviewPageData: ({ mediaSlug, searchParams }) =>
          requireFreshReviewPageData(database, mediaSlug, searchParams)
      });

    expect(pageData?.queueCardIds).toEqual([currentCardId, nextCardId]);

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: currentCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      candidateCardIds: ["missing-card", nextCardId],
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
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
        searchParams: { answered: "1" }
      }
    ]);
    expect(result.selectedCard?.id).toBe(nextCardId);
    expect(result.selectedCardContext.isQueueCard).toBe(true);
    expect(result.selectedCardContext.position).toBe(1);
  });

  it("rebuilds instead of trusting a legacy multi-candidate window", async () => {
    const { currentCardId, nextCardId } =
      await prepareTwoQueueCardFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const hydrationInputs: Array<{
      bypassCache?: boolean;
      cardId: string;
    }> = [];
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database, {
        getReviewPageData: ({ mediaSlug, searchParams }) =>
          requireFreshReviewPageData(database, mediaSlug, searchParams),
        hydrateReviewCard: (input) => {
          hydrationInputs.push(input);
          return undefined;
        }
      });

    expect(pageData?.queueCardIds).toEqual([currentCardId, nextCardId]);

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: currentCardId,
      cardMediaSlug: developmentFixture.mediaSlug,
      candidateCardIds: [currentCardId, nextCardId],
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId,
      rating: "good",
      scope: "media",
      sessionMedia: pageData?.media,
      sessionQueue: pageData?.queue,
      sessionSettings: pageData?.settings
    });

    expect(reviewPageCalls).toHaveLength(1);
    expect(hydrationInputs).toHaveLength(0);
    expect(hydrationInputs.every((input) => input.bypassCache)).toBe(true);
    expect(result.selectedCard?.id).toBe(nextCardId);
    expect(result.selectedCardContext.position).toBe(1);
  });

  it("rebuilds when the canonical first candidate becomes unavailable", async () => {
    const { bufferedCardBId, bufferedCardCId } =
      await prepareChainedBufferedAdvanceFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database, {
        getReviewPageData: ({ mediaSlug, searchParams }) =>
          requireFreshReviewPageData(database, mediaSlug, searchParams),
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
      canonicalCandidateSnapshot: {
        bucket: "due",
        cardId: bufferedCardBId,
        reviewStateUpdatedAt: "2026-03-08T09:00:00.000Z",
        schedulingKey: `card:${bufferedCardBId}`
      },
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId: bufferedCardCId,
      rating: "good",
      scope: "media",
      sessionMedia: pageData?.media,
      sessionQueue: chainedSessionQueue ?? pageData?.queue,
      sessionSettings: pageData?.settings
    });

    expect(reviewPageCalls).toHaveLength(1);
    expect(firstResult.selectedCard?.id).not.toBe(bufferedCardBId);
  });

  it("hydrates only the server-canonical next card when a client hint points later", async () => {
    const { bufferedCardBId, bufferedCardCId } =
      await prepareChainedBufferedAdvanceFixture(database);
    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database
    );
    const hydrateCallsById = new Map<string, number>();
    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database, {
        hydrateReviewCard: async ({ cardId }) => {
          hydrateCallsById.set(cardId, (hydrateCallsById.get(cardId) ?? 0) + 1);

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

    const result = await gradeReviewCardSessionAction({
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
      canonicalCandidateSnapshot: buildCanonicalCandidateSnapshot(
        (await hydrateReviewCard({ cardId: bufferedCardBId, database }))!
      ),
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
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
    expect(result.selectedCard?.id).toBe(bufferedCardBId);
    expect(result.selectedCardContext.position).toBe(1);
    expect(result.queue.advanceCards).toEqual([]);
    expect(hydrateCallsById.get(bufferedCardBId)).toBe(1);
    expect(hydrateCallsById.get(bufferedCardCId)).toBeUndefined();
    expect(
      hydrateCallsById.get(developmentFixture.secondaryCardId)
    ).toBeUndefined();
  });

  it("rebuilds the canonical queue when a concurrent tab changes the first candidate bucket", async () => {
    const { bufferedCardBId, bufferedCardCId } =
      await prepareChainedBufferedAdvanceFixture(database);

    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z",
        state: "review"
      })
      .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));
    await database
      .update(reviewSubjectState)
      .set({
        difficulty: 1,
        dueAt: "2026-08-11T09:00:00.000Z",
        lastReviewedAt: "2026-08-11T09:00:00.000Z",
        stability: 10_000,
        state: "review",
        updatedAt: "2026-08-11T09:00:00.000Z"
      })
      .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
    await database
      .update(reviewSubjectState)
      .set({
        stability: 100
      })
      .where(eq(reviewSubjectState.cardId, bufferedCardBId));

    const pageData = await getReviewPageData(
      developmentFixture.mediaSlug,
      {},
      database,
      { bypassCache: true }
    );
    const bufferedCardB = await hydrateReviewCard({
      cardId: bufferedCardBId,
      database
    });

    expect(pageData?.queueCardIds.indexOf(bufferedCardBId)).toBeGreaterThan(-1);
    expect(pageData?.queueCardIds.indexOf(bufferedCardCId)).toBeGreaterThan(-1);
    expect(pageData!.queueCardIds.indexOf(bufferedCardBId)).toBeLessThan(
      pageData!.queueCardIds.indexOf(bufferedCardCId)
    );
    expect(bufferedCardB?.bucket).toBe("due");
    expect(pageData?.selectedCard?.id).toBe(developmentFixture.primaryCardId);

    await database
      .update(reviewSubjectState)
      .set({
        dueAt: "2999-01-01T00:00:00.000Z",
        state: "new",
        updatedAt: "2026-03-12T09:00:00.000Z"
      })
      .where(eq(reviewSubjectState.cardId, bufferedCardBId));
    const mutatedBufferedCardB = await hydrateReviewCard({
      bypassCache: true,
      cardId: bufferedCardBId,
      database
    });

    expect(mutatedBufferedCardB?.bucket).toBe("new");

    const { gradeReviewCardSessionAction, reviewPageCalls } =
      await loadReviewActionsForDatabase(database, {
        getReviewPageData: ({ mediaSlug, searchParams }) =>
          requireFreshReviewPageData(database, mediaSlug, searchParams)
      });

    const result = await gradeReviewCardSessionAction({
      answeredCount: pageData?.session.answeredCount ?? 0,
      cardId: pageData!.selectedCard!.id,
      cardMediaSlug: developmentFixture.mediaSlug,
      canonicalCandidateCardIds: [bufferedCardBId, bufferedCardCId],
      canonicalCandidateSnapshot: buildCanonicalCandidateSnapshot(
        bufferedCardB!
      ),
      candidateCardIds: [bufferedCardBId, bufferedCardCId],
      extraNewCount: pageData?.session.extraNewCount ?? 0,
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
      gradedCardBucket: pageData?.selectedCard?.bucket,
      gradedCardDueAt: pageData?.selectedCard?.dueAt,
      gradedCardScheduledDays:
        pageData?.selectedCard?.reviewSeedState.scheduledDays,
      gradedCardState: pageData?.selectedCard?.reviewSeedState.state,
      mediaSlug: developmentFixture.mediaSlug,
      nextCardId: bufferedCardBId,
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
        searchParams: { answered: "1" }
      }
    ]);
    expect(result.selectedCard?.id).toBe(bufferedCardCId);
    expect(result.selectedCard?.bucket).toBe("due");
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
      expectedUpdatedAt:
        pageData.selectedCardContext.reviewStateUpdatedAt ?? null,
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
      expectedUpdatedAt:
        pageData?.selectedCardContext.reviewStateUpdatedAt ?? null,
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
});
