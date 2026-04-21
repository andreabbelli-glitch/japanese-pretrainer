import { afterEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve) => {
      resolve = innerResolve;
    }),
    resolve
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("dashboard query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/local-date");
    vi.doUnmock("@/lib/media-shell");
    vi.doUnmock("@/lib/review");
    vi.doUnmock("@/lib/settings");
  });

  it("starts the global review overview as soon as the shared review limits are ready", async () => {
    const mediaRowsDeferred = createDeferred<
      Array<{
        id: string;
        slug: string;
        title: string;
      }>
    >();
    const dailyLimitDeferred = createDeferred<number>();
    const introducedTodayDeferred = createDeferred<number>();
    const reviewCandidatesDeferred = createDeferred<
      Array<{
        activeReviewCards: number;
        cardsTotal: number;
        dueCount: number;
        mediaId: string;
        newAvailableCount: number;
        newCount: number;
      }>
    >();
    const globalOverviewDeferred = createDeferred<{
      activeCards: number;
      dailyLimit: number;
      dueCount: number;
      effectiveDailyLimit: number;
      manualCount: number;
      newAvailableCount: number;
      newQueuedCount: number;
      queueCount: number;
      queueLabel: string;
      suspendedCount: number;
      tomorrowCount: number;
      totalCards: number;
      upcomingCount: number;
    }>();
    const mediaSnapshotsDeferred = createDeferred<
      Array<{
        activeReviewCards: number;
        cardsDue: number;
        cardsTotal: number;
        description: string;
        entriesKnown: number;
        entriesTotal: number;
        glossary: {
          breakdown: {
            available: number;
            known: number;
            learning: number;
            new: number;
            review: number;
          };
          entriesCovered: number;
          entriesTotal: number;
          previewEntries: [];
          progressPercent: number | null;
        };
        glossaryProgressPercent: number | null;
        id: string;
        inProgressLessons: number;
        lessonsCompleted: number;
        lessonsTotal: number;
        mediaType: string;
        mediaTypeLabel: string;
        nextLesson: null;
        previewEntries: [];
        resumeLesson: null;
        reviewQueueLabel: string;
        reviewStatDetail: string;
        reviewStatValue: string;
        segmentKindLabel: string;
        segments: [];
        slug: string;
        statusLabel: string;
        textbookProgressPercent: number | null;
        title: string;
      }>
    >();
    let mediaStarted = false;
    let reviewCandidatesStarted = false;
    let overviewStarted = false;

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      canUseDataCache: vi.fn(() => false),
      listMediaCached: vi.fn(() => {
        mediaStarted = true;
        return mediaRowsDeferred.promise;
      }),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell", () => ({
      loadMediaShellSnapshots: vi.fn(() => mediaSnapshotsDeferred.promise),
      pickFocusMedia: vi.fn(() => null)
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(
        (_database: unknown, options: unknown) => {
          void options;
          overviewStarted = true;
          return globalOverviewDeferred.promise;
        }
      ),
      loadReviewIntroducedTodayCountCached: vi.fn(
        () => introducedTodayDeferred.promise
      ),
      loadReviewLaunchCandidatesCached: vi.fn(() => {
        reviewCandidatesStarted = true;
        return reviewCandidatesDeferred.promise;
      })
    }));
    vi.doMock("@/lib/settings", () => ({
      getReviewDailyLimit: vi.fn(() => dailyLimitDeferred.promise)
    }));

    const { getDashboardData } = await import("@/lib/dashboard");
    const reviewModule = await import("@/lib/review");
    const dashboardPromise = getDashboardData();

    await flushMicrotasks();

    expect(mediaStarted).toBe(true);
    expect(reviewCandidatesStarted).toBe(true);
    expect(overviewStarted).toBe(false);

    dailyLimitDeferred.resolve(7);
    introducedTodayDeferred.resolve(2);
    await flushMicrotasks();

    expect(overviewStarted).toBe(true);
    expect(reviewModule.loadGlobalReviewOverviewSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        resolvedDailyLimit: 7,
        resolvedNewIntroducedTodayCount: 2
      })
    );

    mediaRowsDeferred.resolve([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    reviewCandidatesDeferred.resolve([
      {
        activeReviewCards: 1,
        cardsTotal: 2,
        dueCount: 1,
        mediaId: "media-1",
        newAvailableCount: 3,
        newCount: 3
      }
    ]);
    globalOverviewDeferred.resolve({
      activeCards: 1,
      dailyLimit: 7,
      dueCount: 1,
      effectiveDailyLimit: 7,
      manualCount: 0,
      newAvailableCount: 3,
      newQueuedCount: 3,
      queueCount: 4,
      queueLabel: "queue",
      suspendedCount: 0,
      tomorrowCount: 0,
      totalCards: 2,
      upcomingCount: 0
    });
    mediaSnapshotsDeferred.resolve([]);

    const dashboard = await dashboardPromise;

    expect(dashboard.review.cardsDue).toBe(1);
  });

  it("starts loading media shell snapshots before the global review overview settles", async () => {
    const mediaRowsDeferred = createDeferred<
      Array<{ id: string; slug: string; title: string }>
    >();
    const dailyLimitDeferred = createDeferred<number>();
    const introducedTodayDeferred = createDeferred<number>();
    const reviewCandidatesDeferred = createDeferred<unknown[]>();
    const globalOverviewDeferred = createDeferred<Record<string, number | string>>();
    const mediaSnapshotsDeferred = createDeferred<unknown[]>();
    let mediaShellStarted = false;

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      canUseDataCache: vi.fn(() => false),
      listMediaCached: vi.fn(() => mediaRowsDeferred.promise),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell", () => ({
      loadMediaShellSnapshots: vi.fn(() => {
        mediaShellStarted = true;
        return mediaSnapshotsDeferred.promise;
      }),
      pickFocusMedia: vi.fn(() => null)
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(
        () => globalOverviewDeferred.promise
      ),
      loadReviewIntroducedTodayCountCached: vi.fn(
        () => introducedTodayDeferred.promise
      ),
      loadReviewLaunchCandidatesCached: vi.fn(
        () => reviewCandidatesDeferred.promise
      )
    }));
    vi.doMock("@/lib/settings", () => ({
      getReviewDailyLimit: vi.fn(() => dailyLimitDeferred.promise)
    }));

    const { getDashboardData } = await import("@/lib/dashboard");
    const dashboardPromise = getDashboardData();

    await flushMicrotasks();

    mediaRowsDeferred.resolve([
      {
        id: "media-1",
        slug: "fixture-media",
        title: "Fixture Media"
      }
    ]);
    dailyLimitDeferred.resolve(7);
    introducedTodayDeferred.resolve(2);
    reviewCandidatesDeferred.resolve([
      {
        activeReviewCards: 1,
        cardsTotal: 2,
        dueCount: 1,
        mediaId: "media-1",
        newAvailableCount: 3,
        newCount: 3
      }
    ]);

    await flushMicrotasks();

    expect(mediaShellStarted).toBe(true);

    globalOverviewDeferred.resolve({
      activeCards: 1,
      dailyLimit: 7,
      dueCount: 1,
      effectiveDailyLimit: 7,
      manualCount: 0,
      newAvailableCount: 3,
      newQueuedCount: 3,
      queueCount: 4,
      queueLabel: "queue",
      suspendedCount: 0,
      tomorrowCount: 0,
      totalCards: 2,
      upcomingCount: 0
    });
    mediaSnapshotsDeferred.resolve([]);

    const dashboard = await dashboardPromise;

    expect(dashboard.media).toEqual([]);
  });
});
