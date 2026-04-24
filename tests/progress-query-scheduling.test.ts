import { afterEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let reject!: (reason: unknown) => void;
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((innerResolve, innerReject) => {
      reject = innerReject;
      resolve = innerResolve;
    }),
    reject,
    resolve
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("progress query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/local-date");
    vi.doUnmock("@/lib/media-shell");
    vi.doUnmock("@/lib/review");
    vi.doUnmock("@/lib/settings");
    vi.doUnmock("@/lib/site");
    vi.doUnmock("@/lib/study-format");
  });

  it("starts shared settings lookups before the cache-enabled media lookup settles", async () => {
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewFrontFurigana: true,
      reviewDailyLimit: 7
    };
    const mediaDeferred = createDeferred<{
      id: string;
      slug: string;
      title: string;
    } | null>();
    const settingsDeferred = createDeferred<typeof settingsValue>();
    const introducedTodayDeferred = createDeferred<number>();
    let mediaStarted = false;
    let settingsStarted = false;
    let introducedTodayStarted = false;

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildGlossarySummaryTags: vi.fn(() => []),
      buildReviewSummaryTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => true),
      getMediaBySlugCached: vi.fn(() => {
        mediaStarted = true;
        return mediaDeferred.promise;
      }),
      listMediaCached: vi.fn(),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(),
      loadReviewIntroducedTodayCountCached: vi.fn(() => {
        introducedTodayStarted = true;
        return introducedTodayDeferred.promise;
      }),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      mapReviewOverviewSnapshot: vi.fn()
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(() => {
        settingsStarted = true;
        return settingsDeferred.promise;
      })
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await flushMicrotasks();

    expect(mediaStarted).toBe(true);
    expect(settingsStarted).toBe(true);
    expect(introducedTodayStarted).toBe(true);

    mediaDeferred.resolve(null);
    settingsDeferred.resolve(settingsValue);
    introducedTodayDeferred.resolve(2);
    await expect(progressPromise).resolves.toBeNull();
  });

  it("handles shared query failures when the media lookup misses", async () => {
    const mediaDeferred = createDeferred<{
      id: string;
      slug: string;
      title: string;
    } | null>();
    const settingsDeferred = createDeferred<never>();
    const introducedTodayDeferred = createDeferred<number>();

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildGlossarySummaryTags: vi.fn(() => []),
      buildReviewSummaryTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => true),
      getMediaBySlugCached: vi.fn(() => mediaDeferred.promise),
      listMediaCached: vi.fn(),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot: vi.fn(),
      loadReviewIntroducedTodayCountCached: vi.fn(
        () => introducedTodayDeferred.promise
      ),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      mapReviewOverviewSnapshot: vi.fn()
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(() => settingsDeferred.promise)
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("missing-media");

    await flushMicrotasks();
    settingsDeferred.reject(new Error("settings lookup failed after media miss"));
    introducedTodayDeferred.resolve(2);
    mediaDeferred.resolve(null);

    await expect(progressPromise).resolves.toBeNull();
    await flushMicrotasks();
  });

  it("starts the global review overview before the cache-enabled media lookup settles", async () => {
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewFrontFurigana: true,
      reviewDailyLimit: 7
    };
    const mediaDeferred = createDeferred<{
      id: string;
      slug: string;
      title: string;
    } | null>();
    const settingsDeferred = createDeferred<typeof settingsValue>();
    const introducedTodayDeferred = createDeferred<number>();
    const globalOverviewDeferred = createDeferred<unknown>();
    let overviewStarted = false;

    const loadGlobalReviewOverviewSnapshot = vi.fn(() => {
      overviewStarted = true;
      return globalOverviewDeferred.promise;
    });

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildGlossarySummaryTags: vi.fn(() => []),
      buildReviewSummaryTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => true),
      getMediaBySlugCached: vi.fn(() => mediaDeferred.promise),
      listMediaCached: vi.fn(),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell", () => ({
      getMediaDetailData: vi.fn()
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot,
      loadReviewIntroducedTodayCountCached: vi.fn(
        () => introducedTodayDeferred.promise
      ),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      mapReviewOverviewSnapshot: vi.fn()
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(() => settingsDeferred.promise)
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await flushMicrotasks();
    expect(overviewStarted).toBe(false);

    settingsDeferred.resolve(settingsValue);
    introducedTodayDeferred.resolve(2);
    await flushMicrotasks();

    expect(overviewStarted).toBe(true);
    expect(loadGlobalReviewOverviewSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        resolvedDailyLimit: 7,
        resolvedNewIntroducedTodayCount: 2
      })
    );

    mediaDeferred.resolve(null);
    globalOverviewDeferred.resolve(null);
    await expect(progressPromise).resolves.toBeNull();
  });

  it("starts the global review overview load before the local media candidate settles", async () => {
    const settingsValue = {
      furiganaMode: "hover" as const,
      glossaryDefaultSort: "lesson_order" as const,
      kanjiClashDailyNewLimit: 5,
      kanjiClashDefaultScope: "global" as const,
      kanjiClashManualDefaultSize: 20,
      reviewFrontFurigana: true,
      reviewDailyLimit: 7
    };
    const globalOverviewValue = {
      activeReviewCards: 3,
      cardsTotal: 5,
      dueCount: 1,
      manualCount: 0,
      newAvailableCount: 2,
      firstDueFront: "共有レビュー",
      firstNewFront: "新しいカード",
      suspendedCount: 0,
      tomorrowCount: 0,
      totalCards: 5
    };
    const sharedMediaValue = {
      activeLesson: null,
      description: "Fixture media",
      glossary: {
        breakdown: {
          available: 0,
          known: 0,
          learning: 0,
          new: 0,
          review: 0
        },
        entriesCovered: 0,
        entriesTotal: 0,
        previewEntries: []
      },
      inProgressLessons: 0,
      lastOpenedLesson: null,
      lessonsCompleted: 0,
      lessonsTotal: 0,
      mediaTypeLabel: "Gioco",
      nextLesson: null,
      resumeLesson: null,
      segmentKindLabel: "Capitolo",
      segments: [],
      slug: "fixture-media",
      statusLabel: "Attivo",
      textbookProgressPercent: null,
      title: "Fixture Media"
    };
    const settingsDeferred = createDeferred<typeof settingsValue>();
    const introducedTodayDeferred = createDeferred<number>();
    const mediaCandidateDeferred = createDeferred<{
      activeReviewCards: number;
      cardsTotal: number;
      dueCount: number;
      newCount: number;
    } | null>();
    const globalOverviewDeferred = createDeferred<typeof globalOverviewValue>();
    const sharedMediaDeferred = createDeferred<typeof sharedMediaValue>();

    const loadGlobalReviewOverviewSnapshot = vi.fn(
      () => globalOverviewDeferred.promise
    );

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/lib/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildGlossarySummaryTags: vi.fn(() => []),
      buildReviewSummaryTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => false),
      getMediaBySlugCached: vi.fn(),
      listMediaCached: vi.fn(async () => [
        {
          id: "media-1",
          slug: "fixture-media",
          title: "Fixture Media"
        }
      ]),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell", () => ({
      getMediaDetailData: vi.fn(() => sharedMediaDeferred.promise)
    }));
    vi.doMock("@/lib/review", () => ({
      loadGlobalReviewOverviewSnapshot,
      loadReviewIntroducedTodayCountCached: vi.fn(
        () => introducedTodayDeferred.promise
      ),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(
        () => mediaCandidateDeferred.promise
      ),
      mapReviewOverviewSnapshot: vi.fn(
        ({
          dailyLimit,
          newIntroducedTodayCount,
          overview
        }: {
          dailyLimit: number;
          newIntroducedTodayCount: number;
          overview:
            | {
                activeReviewCards: number;
                cardsTotal?: number;
                dueCount: number;
                newAvailableCount?: number;
                newCount?: number;
              }
            | undefined;
        }) => ({
          activeCards: overview?.activeReviewCards ?? 0,
          dailyLimit,
          dueCount: overview?.dueCount ?? 0,
          manualCount: 0,
          newAvailableCount:
            overview?.newAvailableCount ?? overview?.newCount ?? 0,
          newQueuedCount: 0,
          queueCount: overview?.dueCount ?? 0,
          queueLabel: `limit:${dailyLimit}-introduced:${newIntroducedTodayCount}`,
          suspendedCount: 0,
          tomorrowCount: 0,
          totalCards: overview?.cardsTotal ?? 0,
          upcomingCount: 0
        })
      )
    }));
    vi.doMock("@/lib/settings", () => ({
      getStudySettings: vi.fn(() => settingsDeferred.promise)
    }));
    vi.doMock("@/lib/site", () => ({
      mediaGlossaryHref: (slug: string) => `/media/${slug}/glossary`,
      mediaHref: (slug: string) => `/media/${slug}`,
      mediaStudyHref: (slug: string, area: string) => `/media/${slug}/${area}`,
      mediaTextbookLessonHref: (slug: string, lesson: string) =>
        `/media/${slug}/textbook/${lesson}`,
      reviewHref: () => "/review"
    }));
    vi.doMock("@/lib/study-format", () => ({
      calculatePercent: vi.fn(() => null)
    }));

    const { getMediaProgressPageData } = await import("@/lib/progress");
    const progressPromise = getMediaProgressPageData("fixture-media");

    await flushMicrotasks();
    settingsDeferred.resolve(settingsValue);
    introducedTodayDeferred.resolve(2);
    await flushMicrotasks();

    expect(loadGlobalReviewOverviewSnapshot).toHaveBeenCalledTimes(1);
    expect(loadGlobalReviewOverviewSnapshot).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        resolvedDailyLimit: 7,
        resolvedNewIntroducedTodayCount: 2
      })
    );

    mediaCandidateDeferred.resolve({
      activeReviewCards: 1,
      cardsTotal: 2,
      dueCount: 1,
      newCount: 1
    });
    globalOverviewDeferred.resolve(globalOverviewValue);
    sharedMediaDeferred.resolve(sharedMediaValue);

    const data = await progressPromise;

    expect(data).not.toBeNull();
    expect(data?.media.slug).toBe("fixture-media");
    expect(data?.review.dailyLimit).toBe(7);
  });
});
