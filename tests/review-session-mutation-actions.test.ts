import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@/db";
import { reviewSubjectLog, reviewSubjectState } from "@/db/schema";
import { developmentFixture } from "@/db/seed";
import { mediaReviewCardHref } from "@/features/navigation";
import { buildReviewMemoryKey } from "@/features/review/model/recall-task";
import { createIsolatedNewMediaFixture } from "./helpers/review-fixture";
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
    .set({ dueAt: futureDueAt })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
  await database
    .update(reviewSubjectState)
    .set({ dueAt: pastDueAt })
    .where(eq(reviewSubjectState.subjectKey, secondarySubjectKey));
  await database
    .update(reviewSubjectState)
    .set({ manualOverride: true })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));

  return {
    nextCardId: developmentFixture.secondaryCardId,
    targetCardId: developmentFixture.primaryCardId
  };
}

async function prepareTwoQueueCardFixture(database: DatabaseClient) {
  await database
    .update(reviewSubjectState)
    .set({ dueAt: "2000-01-01T00:00:00.000Z" })
    .where(eq(reviewSubjectState.subjectKey, primarySubjectKey));
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

function loadReviewActionsForDatabase(
  database: DatabaseClient,
  options: LoadReviewActionsOptions = {}
) {
  return loadReviewActionsForDatabaseHarness(database, options, {
    updateGlossarySummaryCacheMock,
    updateReviewSummaryCacheMock
  });
}

describe("review session mutation actions", () => {
  let tempDir = "";
  let database: DatabaseClient;

  beforeEach(async () => {
    revalidatePathMock.mockReset();
    updateGlossarySummaryCacheMock.mockReset();
    updateReviewSummaryCacheMock.mockReset();
    ({ database, tempDir } = await setupReviewDatabase({
      prefix: "jcs-review-session-mutation-actions-",
      seedDevelopmentFixture: true
    }));
  });

  afterEach(async () => {
    await cleanupReviewDatabase({ database, tempDir });
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

  it("prefetches a canonical window in one bounded batch and isolates card failures", async () => {
    const hydratedCardIds: string[] = [];
    const hydrationFailure = new Error("card-c hydration failed");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const { prefetchReviewCardsSessionAction, reviewPageCalls } =
        await loadReviewActionsForDatabase(database, {
          hydrateReviewCard: ({ cardId }) => {
            hydratedCardIds.push(cardId);

            if (cardId === "card-c") {
              throw hydrationFailure;
            }

            return null;
          }
        });

      const result = await prefetchReviewCardsSessionAction({
        cardIds: [" card-b ", "card-b", "card-c", "card-d", "card-e"]
      });

      expect(hydratedCardIds).toEqual(["card-b", "card-c", "card-d"]);
      expect(result).toEqual([
        { card: null, cardId: "card-b" },
        { card: null, cardId: "card-c" },
        { card: null, cardId: "card-d" }
      ]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(hydrationFailure);
      expect(reviewPageCalls).toEqual([]);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
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
    const beforeState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const formData = new FormData();
    formData.set("mediaSlug", developmentFixture.mediaSlug);
    formData.set("cardId", developmentFixture.primaryCardId);
    formData.set("rating", "good");
    formData.set("answered", "3abc");
    formData.set("extraNew", "2abc");
    formData.set("expectedUpdatedAt", beforeState?.updatedAt ?? "");

    await expect(gradeReviewCardAction(formData)).rejects.toThrow(
      `redirect:/media/${developmentFixture.mediaSlug}/review?answered=1`
    );

    expect(updateReviewSummaryCacheMock).toHaveBeenCalledWith(
      developmentFixture.mediaId
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects malformed review form ratings instead of grading them as good", async () => {
    const { gradeReviewCardAction } =
      await loadReviewActionsForDatabase(database);
    const beforeState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const beforeLogs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });
    const formData = new FormData();
    formData.set("mediaSlug", developmentFixture.mediaSlug);
    formData.set("cardId", developmentFixture.primaryCardId);
    formData.set("rating", "bogus");
    formData.set("answered", "0");
    formData.set("extraNew", "0");
    formData.set("expectedUpdatedAt", beforeState?.updatedAt ?? "");

    await expect(gradeReviewCardAction(formData)).rejects.toThrow(
      "Invalid review rating."
    );

    const afterState = await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, primarySubjectKey)
    });
    const afterLogs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, primarySubjectKey)
    });

    expect(afterState).toMatchObject({
      dueAt: beforeState?.dueAt,
      reps: beforeState?.reps,
      state: beforeState?.state,
      updatedAt: beforeState?.updatedAt
    });
    expect(afterLogs).toHaveLength(beforeLogs.length);
    expect(updateReviewSummaryCacheMock).not.toHaveBeenCalled();
  });

  it("treats a blank form freshness token as an observed missing subject state", async () => {
    const fixture = await createIsolatedNewMediaFixture(database, {
      cardCount: 1,
      mediaId: "media_form_grade_guard",
      mediaSlug: "form-grade-guard",
      title: "Form Grade Guard"
    });
    const cardId = fixture.cardIds[0]!;
    const subjectKey = buildReviewMemoryKey({
      canonicalSubjectKey: `entry:term:${fixture.termIds[0]}`,
      cardId,
      recallTask: "recognition"
    });
    const { gradeReviewCardAction } =
      await loadReviewActionsForDatabase(database);
    const formData = new FormData();
    formData.set("mediaSlug", fixture.mediaSlug);
    formData.set("cardId", cardId);
    formData.set("rating", "good");
    formData.set("answered", "0");
    formData.set("extraNew", "0");
    formData.set("expectedUpdatedAt", "");

    await expect(gradeReviewCardAction(formData)).rejects.toThrow(
      `redirect:/media/${fixture.mediaSlug}/review?answered=1`
    );
    await expect(gradeReviewCardAction(formData)).rejects.toThrow(
      "Review card is out of date."
    );

    const logs = await database.query.reviewSubjectLog.findMany({
      where: eq(reviewSubjectLog.subjectKey, subjectKey)
    });

    expect(logs).toHaveLength(1);
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
