import { afterEach, describe, expect, it, vi } from "vitest";

import { createQuerySchedulingHarness } from "./helpers/query-scheduling";

describe("media library query scheduling", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/db");
    vi.doUnmock("@/db/queries");
    vi.doUnmock("@/features/cache/server/data-cache");
    vi.doUnmock("@/features/shared/model/local-date");
    vi.doUnmock("@/features/media/model/shell-snapshot");
    vi.doUnmock("@/features/review/server/loader");
    vi.doUnmock("@/features/review/server/overview-loader");
    vi.doUnmock("@/features/settings/server");
    vi.doUnmock("@/features/navigation");
    vi.doUnmock("@/features/study/model/format");
    vi.doUnmock("@/features/study/model/metrics");
  });

  it("starts shared review settings before the cached media list settles", async () => {
    const schedule = createQuerySchedulingHarness();
    const mediaRowsGate = schedule.gate<
      Array<{
        description: string;
        id: string;
        mediaType: string;
        segmentKind: string;
        slug: string;
        status: string;
        title: string;
      }>
    >("media rows");
    const dailyLimitGate = schedule.gate<number>("daily limit");
    const introducedTodayGate = schedule.gate<number>("introduced today");
    const reviewSnapshotsGate = schedule.gate<
      Map<
        string,
        {
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
        }
      >
    >("review snapshots");

    vi.doMock("@/db", () => ({
      db: {}
    }));
    vi.doMock("@/db/queries", () => ({
      listGlossaryPreviewEntries: vi.fn(() => Promise.resolve([])),
      listGlossaryProgressSummaries: vi.fn(() => Promise.resolve([])),
      listLessonsByMediaId: vi.fn(() => Promise.resolve([])),
      listLessonsByMediaIdsForShell: vi.fn(() => Promise.resolve([]))
    }));
    vi.doMock("@/features/cache/server/data-cache", () => ({
      GLOSSARY_SUMMARY_TAG: "glossary-summary",
      MEDIA_LIST_TAG: "media-list",
      REVIEW_FIRST_CANDIDATE_TAG: "review-first-candidate",
      REVIEW_SUMMARY_TAG: "review-summary",
      SETTINGS_TAG: "settings",
      buildGlossarySummaryTags: vi.fn(() => []),
      buildReviewSummaryTags: vi.fn(() => []),
      canUseDataCache: vi.fn(() => true),
      getMediaBySlugCached: vi.fn(),
      listMediaCached: vi.fn(mediaRowsGate.loader()),
      runWithTaggedCache: vi.fn(async ({ loader }) => loader())
    }));
    vi.doMock("@/features/shared/model/local-date", () => ({
      getLocalIsoTimeBucketKey: vi.fn(() => "bucket")
    }));
    vi.doMock("@/features/media/model/shell-snapshot", () => ({
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
    vi.doMock("@/features/review/server/loader", () => ({
      loadReviewIntroducedTodayCountCached: vi.fn(introducedTodayGate.loader()),
      loadReviewLaunchCandidateByMediaIdCached: vi.fn(),
      loadReviewLaunchCandidatesCached: vi.fn(() =>
        Promise.resolve([
          {
            activeReviewCards: 1,
            cardsTotal: 3,
            dueCount: 1,
            manualCount: 0,
            mediaId: "media-1",
            newAvailableCount: 4,
            newCount: 4,
            suspendedCount: 0,
            tomorrowCount: 0,
            totalCards: 3
          }
        ])
      )
    }));
    vi.doMock("@/features/review/server/overview-loader", () => ({
      loadReviewOverviewSnapshots: vi.fn(reviewSnapshotsGate.loader())
    }));
    vi.doMock("@/features/settings/server", () => ({
      getReviewDailyLimit: vi.fn(dailyLimitGate.loader())
    }));
    vi.doMock("@/features/navigation", () => ({
      mediaGlossaryEntryHref: vi.fn(() => "/glossary/entry")
    }));
    vi.doMock("@/features/study/model/format", () => ({
      calculatePercent: vi.fn(() => 0)
    }));
    vi.doMock("@/features/study/model/metrics", () => ({
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

    const { getMediaLibraryData } = await import("@/features/media/server");
    const mediaLibraryPromise = getMediaLibraryData();

    await schedule.expectStarted(
      "media rows",
      "daily limit",
      "introduced today"
    );
    schedule.expectNotStarted("review snapshots");
    schedule.expectNotSettled("media rows");

    mediaRowsGate.resolve([
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
    dailyLimitGate.resolve(7);
    introducedTodayGate.resolve(2);
    await schedule.expectStarted("review snapshots");
    reviewSnapshotsGate.resolve(
      new Map([
        [
          "media-1",
          {
            activeCards: 1,
            dailyLimit: 7,
            dueCount: 1,
            effectiveDailyLimit: 7,
            manualCount: 0,
            newAvailableCount: 4,
            newQueuedCount: 4,
            queueCount: 5,
            queueLabel: "",
            suspendedCount: 0,
            tomorrowCount: 0,
            totalCards: 3,
            upcomingCount: 0
          }
        ]
      ])
    );

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
