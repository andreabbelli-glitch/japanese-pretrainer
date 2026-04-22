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

describe("media library query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/lib/data-cache");
    vi.doUnmock("@/lib/local-date");
    vi.doUnmock("@/lib/media-shell-snapshot");
    vi.doUnmock("@/lib/review-loader");
    vi.doUnmock("@/lib/settings");
    vi.doUnmock("@/lib/site");
    vi.doUnmock("@/lib/study-format");
    vi.doUnmock("@/lib/study-metrics");
  });

  it("starts shared review queries before the cached media list settles", async () => {
    const mediaRowsDeferred = createDeferred<
      Array<{
        description: string;
        id: string;
        mediaType: string;
        segmentKind: string;
        slug: string;
        status: string;
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
        newCount: number;
      }>
    >();
    let mediaStarted = false;
    let dailyLimitStarted = false;
    let introducedTodayStarted = false;
    let reviewCandidatesStarted = false;

    vi.doMock("@/db", () => ({
      db: {},
      listGlossaryPreviewEntries: vi.fn(() => Promise.resolve([])),
      listGlossaryProgressSummaries: vi.fn(() => Promise.resolve([])),
      listLessonsByMediaId: vi.fn(() => Promise.resolve([])),
      listLessonsByMediaIdsForShell: vi.fn(() => Promise.resolve([]))
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
      getMediaBySlugCached: vi.fn(),
      listMediaCached: vi.fn(() => {
        mediaStarted = true;
        return mediaRowsDeferred.promise;
      }),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/lib/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/lib/media-shell-snapshot", () => ({
      mapMediaShellSnapshotFromCounts: vi.fn(
        ({ glossary, lessons, media, reviewCounts }) => ({
          activeReviewCards: reviewCounts?.activeReviewCards ?? 0,
          cardsDue: reviewCounts?.dueCount ?? 0,
          cardsTotal: reviewCounts?.cardsTotal ?? 0,
          description: media.description,
          entriesKnown: glossary.entriesCovered,
          entriesTotal: glossary.entriesTotal,
          glossary,
          glossaryProgressPercent: glossary.progressPercent,
          id: media.id,
          inProgressLessons: 0,
          lessonsCompleted: 0,
          lessonsTotal: lessons.length,
          mediaType: media.mediaType,
          mediaTypeLabel: "Gioco",
          nextLesson: null,
          previewEntries: [],
          resumeLesson: null,
          reviewQueueLabel: "",
          reviewStatDetail: "",
          reviewStatValue: "",
          segmentKindLabel: "Capitolo",
          segments: [],
          slug: media.slug,
          statusLabel: "Attivo",
          textbookProgressPercent: null,
          title: media.title
        })
      ),
      pickFocusMedia: vi.fn(() => null)
    }));
    vi.doMock("@/lib/review-loader", () => ({
      loadReviewIntroducedTodayCountCached: vi.fn(() => {
        introducedTodayStarted = true;
        return introducedTodayDeferred.promise;
      }),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      loadReviewLaunchCandidatesCached: vi.fn(() => {
        reviewCandidatesStarted = true;
        return reviewCandidatesDeferred.promise;
      })
    }));
    vi.doMock("@/lib/settings", () => ({
      getReviewDailyLimit: vi.fn(() => {
        dailyLimitStarted = true;
        return dailyLimitDeferred.promise;
      })
    }));
    vi.doMock("@/lib/site", () => ({
      mediaGlossaryEntryHref: vi.fn(() => "/glossary/entry")
    }));
    vi.doMock("@/lib/study-format", () => ({
      calculatePercent: vi.fn(() => 0)
    }));
    vi.doMock("@/lib/study-metrics", () => ({
      buildEmptyGlossaryProgressSnapshot: vi.fn(() => ({
        breakdown: {
          available: 0,
          known: 0,
          learning: 0,
          new: 0,
          review: 0
        },
        entriesCovered: 0,
        entriesTotal: 0,
        previewEntries: [],
        progressPercent: 0
      }))
    }));

    const { getMediaLibraryData } = await import("@/lib/media-shell");
    const mediaLibraryPromise = getMediaLibraryData();

    await flushMicrotasks();

    expect(mediaStarted).toBe(true);
    expect(dailyLimitStarted).toBe(true);
    expect(introducedTodayStarted).toBe(true);
    expect(reviewCandidatesStarted).toBe(true);

    mediaRowsDeferred.resolve([
      {
        description: "Fixture media",
        id: "media-1",
        mediaType: "game",
        segmentKind: "chapter",
        slug: "fixture-media",
        status: "active",
        title: "Fixture Media"
      }
    ]);
    dailyLimitDeferred.resolve(7);
    introducedTodayDeferred.resolve(2);
    reviewCandidatesDeferred.resolve([
      {
        activeReviewCards: 1,
        cardsTotal: 3,
        dueCount: 1,
        mediaId: "media-1",
        newCount: 4
      }
    ]);

    await expect(mediaLibraryPromise).resolves.toEqual([
      expect.objectContaining({
        id: "media-1",
        cardsDue: 1,
        cardsTotal: 3,
        activeReviewCards: 1
      })
    ]);
  });
});
